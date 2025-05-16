// src/app/api/chat/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma, Appointment, Service, SenderType, UserRole } from '@prisma/client';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';

import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
  Schema,
  FunctionDeclarationsTool,
  FunctionDeclaration,
  GenerativeModel,
  FunctionCall,
  Part, 
  Content, // Importujemo Content tip za istoriju
} from '@google/generative-ai';

import { parseISO, format, isValid, set } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils';

// --- Pomoćna funkcija za normalizaciju srpskog teksta ---
function normalizeSerbianText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/š/g, 's')
    .replace(/đ/g, 'dj')
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/ž/g, 'z');
}

// --- Definicija Schema za parametre alata ---
const vendorIdSchema: Schema = { type: SchemaType.STRING, description: "ID salona (vendorId) za koji se vrši provera ili zakazivanje. Ako korisnik ne navede salon, koristi podrazumevani ID koji ti je dat u sistemskim instrukcijama." };
const serviceNameSchema: Schema = { type: SchemaType.STRING, description: "Tačan naziv frizerske usluge (npr. 'Šišanje', 'Pranje kose'). Neosetljivo na velika/mala slova i dijakritičke znake." };
const dateSchema: Schema = { type: SchemaType.STRING, description: "Željeni datum za termin u formatu<y_bin_564>-MM-DD (npr. '2024-12-31')." };
const slotSchema: Schema = { type: SchemaType.STRING, description: "Specifičan termin u HH:mm formatu (npr. '10:00'), dobijen iz dostupnih termina." };

// --- Definicija SVIH Alata ---
const DEFAULT_VENDOR_ID_FOR_CHAT = process.env.CHAT_DEFAULT_VENDOR_ID || "cmao5ay1d0001hm2kji2qrltf"; 

const listServicesDeclaration: FunctionDeclaration = {
  name: "listAvailableServices",
  description: "Navodi sve dostupne aktivne frizerske usluge za određeni salon, uključujući naziv, opis, trajanje i cenu.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { vendorId: vendorIdSchema },
    required: ["vendorId"],
  },
};
const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "checkAppointmentAvailability",
  description: "Proverava dostupne termine za određenu uslugu, u određenom salonu, na određeni datum. Koristite ovo pre pokušaja zakazivanja termina.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { vendorId: vendorIdSchema, serviceName: serviceNameSchema, date: dateSchema },
    required: ["vendorId", "serviceName", "date"],
  },
};
const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "bookAppointment",
  description: "Zakazuje termin za korisnika u određenom salonu. Zahteva ID salona, naziv usluge, datum i specifičan termin. **MORA** se pozvati nakon što je dostupnost proverena i korisnik je potvrdio da želi da zakaže.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      vendorId: vendorIdSchema,
      serviceName: serviceNameSchema,
      date: dateSchema,
      slot: slotSchema
    },
    required: ["vendorId", "serviceName", "date", "slot"],
  },
};
const allFunctionDeclarations: FunctionDeclaration[] = [
  listServicesDeclaration,
  checkAvailabilityDeclaration,
  bookAppointmentDeclaration,
];
const tools: FunctionDeclarationsTool[] = [
  { functionDeclarations: allFunctionDeclarations },
];

// --- Definicija izlaznih tipova za svaki alat ---
interface ListServicesToolOutput {
  services: Array<Pick<Service, 'id' | 'name' | 'description' | 'duration' | 'price'>>;
  vendorId: string;
}
interface CheckAvailabilityToolOutput {
  vendorId: string;
  serviceId: string;
  serviceName: string;
  date: string;
  availableSlotsData: { availableSlots: string[], message?: string };
}
interface BookAppointmentToolOutput {
  success: boolean;
  appointmentDetails: Appointment;
  vendorId: string;
}
type ToolOutput = ListServicesToolOutput | CheckAvailabilityToolOutput | BookAppointmentToolOutput | null;

interface ErrorWithStatus extends Error {
    status?: number;
}

export async function POST(request: NextRequest) {
  console.log('POST /api/chat: Zahtev primljen');

  const aiApiKey = process.env.GOOGLE_API_KEY;
  let model: GenerativeModel;

  if (!aiApiKey) {
    const errorMessage = formatErrorMessage(new Error('GOOGLE_API_KEY varijabla okruženja nije postavljena.'), "AI klijent inicijalizacija");
    return NextResponse.json({ error: "AI konfiguraciona greška: Nedostaje API Ključ", details: errorMessage }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const genAI = new GoogleGenerativeAI(aiApiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('POST /api/chat: Google AI Klijent i Model uspešno inicijalizovani.');
  } catch (initError: unknown) {
    const errorMessage = formatErrorMessage(initError, "Google AI Klijent inicijalizacija");
    return NextResponse.json({ error: "AI inicijalizaciona greška", details: errorMessage }, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    console.warn('POST /api/chat: Korisnik nije autentifikovan, vraćam 401');
    return NextResponse.json({ error: 'Neautorizovan pristup.' }, { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  console.log(`POST /api/chat: Clerk userId: ${user.clerkId}, Prisma userId: ${user.id}`);

  try {
    let chatSession = await prisma.chatSession.findFirst({
      where: { userId: user.id },
    });

    if (!chatSession) {
      console.log(`POST /api/chat: Nije pronađena čet sesija za korisnika ${user.id}, kreiram novu.`);
      chatSession = await prisma.chatSession.create({ 
        data: { 
          userId: user.id, 
          vendorId: DEFAULT_VENDOR_ID_FOR_CHAT
        } 
      });
      console.log(`POST /api/chat: Nova čet sesija kreirana sa ID: ${chatSession.id} i VendorID: ${chatSession.vendorId}`);
    } else {
      if (!chatSession.vendorId) { 
        chatSession = await prisma.chatSession.update({
          where: { id: chatSession.id },
          data: { vendorId: DEFAULT_VENDOR_ID_FOR_CHAT }
        });
        console.log(`POST /api/chat: Postojećoj sesiji ${chatSession.id} dodat podrazumevani vendorId: ${DEFAULT_VENDOR_ID_FOR_CHAT}.`);
      }
      console.log(`POST /api/chat: Pronađena čet sesija ${chatSession.id}. VendorID: ${chatSession.vendorId}`);
    }
    const currentSessionId = chatSession.id;
    const currentVendorIdForAI = chatSession.vendorId || DEFAULT_VENDOR_ID_FOR_CHAT; 

    let userMessageObject: { text: string; id: string; timestamp: string; };
    try {
      userMessageObject = await request.json();
      if (!userMessageObject || typeof userMessageObject.text !== 'string' || !userMessageObject.id || !userMessageObject.timestamp) {
        throw new Error('Neispravan format korisničke poruke');
      }
    } catch (parseError: unknown) {
      const errorMessage = formatErrorMessage(parseError, "parsiranja JSON-a korisničke poruke");
      return NextResponse.json({ error: 'Neispravno telo zahteva', details: errorMessage }, { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    console.log('POST /api/chat: Objekat korisničke poruke:', userMessageObject);

    await prisma.chatMessage.create({
      data: {
        id: userMessageObject.id,
        sessionId: currentSessionId,
        senderId: user.id,
        senderType: SenderType.USER,
        message: userMessageObject.text,
        timestamp: new Date(userMessageObject.timestamp),
      }
    });
    console.log('POST /api/chat: Korisnička poruka sačuvana.');

    const recentDbMessages = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId }, orderBy: { timestamp: 'desc' }, take: 20
    });
    const orderedRecentMessages = recentDbMessages.reverse();
    // ISPRAVKA TIPA: history treba da bude Content[]
    const history: Content[] = orderedRecentMessages.map(msg => ({
      role: msg.senderType === SenderType.USER ? 'user' : 'model', // 'model' za AI odgovore
      parts: [{ text: msg.message }], 
    }));
    console.log(`POST /api/chat: Istorija razgovora poslata AI: ${history.length} poruka`);

    let aiResponseText = 'Žao mi je, došlo je do problema prilikom obrade vašeg zahteva.';
    let toolCalls: FunctionCall[] | undefined;

    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const dynamicSystemInstruction = `Vi ste ljubazan i koristan asistent za zakazivanje frizerskih termina. Započnite razgovor pozdravom.
Današnji datum je ${currentDate}. Trenutno komunicirate u ime salona sa ID: ${currentVendorIdForAI}. **Sve akcije (listanje usluga, provera dostupnosti, zakazivanje) se odnose na ovaj salon (vendorId: ${currentVendorIdForAI}). Obavezno prosledite ovaj vendorId ("${currentVendorIdForAI}") svim alatima koji ga zahtevaju.**
Vaše mogućnosti, koristeći dostupne alate, su:
1.  Navesti sve dostupne aktivne usluge za salon (alat 'listAvailableServices').
2.  Proveriti dostupne termine za određenu uslugu i datum za salon (alat 'checkAppointmentAvailability'). **Uvek koristite ovaj alat PRE zakazivanja.**
3.  Zakazati termin za određenu uslugu, datum i vreme za salon (alat 'bookAppointment'). **Ovaj alat se MORA pozvati NAKON što je dostupnost proverena i korisnik je potvrdio.**

Važan proces zakazivanja:
a) Kada korisnik želi da zakaže, PRVO pozovite 'checkAppointmentAvailability' sa vendorId ("${currentVendorIdForAI}"), nazivom usluge i datumom.
b) Predstavite dostupne termine korisniku. Ako je traženi termin dostupan, pitajte korisnika da potvrdi zakazivanje.
c) Ako korisnik potvrdi, ONDA pozovite alat 'bookAppointment' sa vendorId ("${currentVendorIdForAI}"), tačnim nazivom usluge, datumom i potvrđenim vremenom (slot).
d) Tek nakon USPEŠNOG odgovora od 'bookAppointment' (output.success === true), potvrdite korisniku da je termin uspešno zakazan.
e) Ako 'bookAppointment' vrati grešku, obavestite korisnika.

Proaktivno ponudite opcije. Zaključite datume kao 'sutra' na osnovu ${currentDate}. Budite jasni oko informacija koje su vam potrebne. Normalizujte nazive usluga pre poziva alata (npr. 'sisanje' umesto 'Šišanje').`;

    const aiChat = model.startChat({
      systemInstruction: { role: "system", parts: [{ text: dynamicSystemInstruction }] },
      history: history, // history je sada Content[]
      tools: tools,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    try {
      const result = await aiChat.sendMessage(userMessageObject.text);
      const response = result.response;
      toolCalls = response.functionCalls();

      if (toolCalls && toolCalls.length > 0) {
        console.log('POST /api/chat: AI zahteva pozive alata:', JSON.stringify(toolCalls, null, 2));
        const incomingRequestHeaders = new Headers(request.headers);
        const cookieHeader = incomingRequestHeaders.get('Cookie');
        const fetchHeaders: HeadersInit = { 'Content-Type': 'application/json' };
        if (cookieHeader) { fetchHeaders['Cookie'] = cookieHeader; }

        const toolResultPromises = toolCalls.map(async (toolCall): Promise<Part> => {
          const functionName = toolCall.name;
          const functionArgs = toolCall.args as { vendorId?: string; serviceName?: string; date?: string; slot?: string };
          const toolResponsePayload: { output: ToolOutput; error: string | null } = { output: null, error: null };
          
          const effectiveVendorId = functionArgs.vendorId || currentVendorIdForAI;
          if (!effectiveVendorId && (functionName === 'listAvailableServices' || functionName === 'checkAppointmentAvailability' || functionName === 'bookAppointment')) {
              toolResponsePayload.error = "ID Salona (vendorId) nije specificiran za alat, a obavezan je.";
              return { functionResponse: { name: functionName, response: { content: toolResponsePayload } } };
          }

          try {
            if (functionName === 'listAvailableServices') {
              const allServices = await prisma.service.findMany({
                where: { vendorId: effectiveVendorId, active: true }, // Koristimo 'active' polje
                select: { id: true, name: true, description: true, duration: true, price: true }
              });
              toolResponsePayload.output = { services: allServices, vendorId: effectiveVendorId };
            } else if (functionName === 'checkAppointmentAvailability') {
              const { serviceName, date: dateString } = functionArgs;
              if (!serviceName || !dateString) {
                toolResponsePayload.error = "Nedostaje naziv usluge ili datum za proveru dostupnosti.";
              } else {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !isValid(parseISO(dateString))) {
                  toolResponsePayload.error = `Nevažeći format datuma: '${dateString}'. Molimo koristite YYYY-MM-DD.`;
                } else {
                  const service = await prisma.service.findFirst({
                    where: {
                      name: { equals: serviceName, mode: 'insensitive' },
                      vendorId: effectiveVendorId,
                      active: true, // Koristimo 'active' polje
                    }
                  });
                  if (!service) {
                    toolResponsePayload.error = `Žao mi je, nisam mogao/la pronaći aktivnu uslugu pod nazivom "${serviceName}" u salonu (ID: ${effectiveVendorId}).`;
                  } else {
                    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    const availabilityApiUrl = `${SITE_URL}/api/appointments/available?serviceId=${service.id}&date=${dateString}&vendorId=${effectiveVendorId}`;
                    const availabilityRes = await fetch(availabilityApiUrl, { headers: fetchHeaders });
                    if (!availabilityRes.ok) {
                      const errorJson = await availabilityRes.json().catch(() => ({ message: availabilityRes.statusText }));
                      toolResponsePayload.error = `Greška pri proveri dostupnosti: ${errorJson.message || availabilityRes.statusText}`;
                    } else {
                      const availabilityData: { availableSlots: string[], message?: string } = await availabilityRes.json();
                      toolResponsePayload.output = { vendorId: effectiveVendorId, serviceId: service.id, serviceName: service.name, date: dateString, availableSlotsData: availabilityData };
                    }
                  }
                }
              }
            } else if (functionName === 'bookAppointment') {
              const { serviceName, date: dateString, slot } = functionArgs;
              if (!serviceName || !dateString || !slot) {
                toolResponsePayload.error = "Nedostaje naziv usluge, datum ili vreme za zakazivanje.";
              } else {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !/^\d{2}:\d{2}$/.test(slot)) {
                  toolResponsePayload.error = `Zakazivanje neuspešno: Nevažeći format za datum ili vreme.`;
                } else {
                  const serviceToBook = await prisma.service.findFirst({
                    where: {
                      name: { equals: serviceName, mode: 'insensitive' },
                      vendorId: effectiveVendorId,
                      active: true, // Koristimo 'active' polje
                    }
                  });
                  if (!serviceToBook) {
                    toolResponsePayload.error = `Zakazivanje neuspešno: Aktivna usluga "${serviceName}" nije pronađena u salonu (ID: ${effectiveVendorId}).`;
                  } else {
                    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    const bookingApiUrl = `${SITE_URL}/api/appointments`;
                    const [hours, minutes] = slot.split(':').map(Number);
                    const startTimeDate = set(parseISO(dateString), { hours, minutes, seconds: 0, milliseconds: 0 });

                    const bookingRes = await fetch(bookingApiUrl, {
                      method: 'POST',
                      headers: fetchHeaders,
                      body: JSON.stringify({ 
                        serviceId: serviceToBook.id, 
                        vendorId: effectiveVendorId,
                        startTime: startTimeDate.toISOString(),
                      }),
                    });
                    if (!bookingRes.ok) {
                      const errorJson = await bookingRes.json().catch(() => ({ message: bookingRes.statusText }));
                      toolResponsePayload.error = `Zakazivanje neuspešno: ${errorJson.message || bookingRes.statusText}`;
                    } else {
                      const appointmentDetails: Appointment = await bookingRes.json();
                      toolResponsePayload.output = { success: true, appointmentDetails, vendorId: effectiveVendorId };
                    }
                  }
                }
              }
            } else {
              toolResponsePayload.error = `Nepoznat alat zatražen: ${functionName}`;
            }
          } catch (toolError: unknown) {
            formatErrorMessage(toolError, `izvršavanja alata ${functionName}`);
            toolResponsePayload.error = `Greška pri izvršavanju alata ${functionName}.`;
          }
          return { functionResponse: { name: functionName, response: { content: toolResponsePayload } } };
        });

        const toolResultsAsParts: Part[] = await Promise.all(toolResultPromises);
        console.log('POST /api/chat: Rezultati alata koji se šalju nazad AI (kao Part[]):', JSON.stringify(toolResultsAsParts, null, 2));
        
        // Šaljemo Part[] nazad modelu. Ovo je ispravno prema SDK.
        const toolResultResponse = await aiChat.sendMessage(toolResultsAsParts); 
        aiResponseText = toolResultResponse.response.text();
        console.log('POST /api/chat: Primljen konačan AI odgovor nakon upotrebe alata:', aiResponseText);
      } else {
        aiResponseText = response.text();
        console.log('POST /api/chat: Primljen AI tekstualni odgovor (bez poziva alata):', aiResponseText);
      }
    } catch (aiError: unknown) {
      const formattedError = formatErrorMessage(aiError, "interakcije sa Google AI modelom");
      aiResponseText = `Žao mi je, došlo je do greške sa AI asistentom. Molimo pokušajte kasnije. (Detalji: ${formattedError})`;
    }

    const aiResponseMessage = {
      id: user.clerkId + Date.now().toString() + Math.random().toString(36).substring(2, 9),
      text: aiResponseText,
      sender: SenderType.AI,
      senderId: "AI_GEMINI_1_5_FLASH",
      timestamp: new Date(),
    } as const;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.chatMessage.create({
          data: {
            id: aiResponseMessage.id, 
            sessionId: currentSessionId, 
            senderId: aiResponseMessage.senderId,
            senderType: aiResponseMessage.sender,
            message: aiResponseMessage.text, 
            timestamp: aiResponseMessage.timestamp,
          }
        });
        const messageCount = await tx.chatMessage.count({ where: { sessionId: currentSessionId } });
        const historyLimit = 30;
        if (messageCount > historyLimit) {
          const messagesToDeleteCount = messageCount - historyLimit;
          const messagesToDelete = await tx.chatMessage.findMany({
            where: { sessionId: currentSessionId }, orderBy: { timestamp: 'asc' },
            take: messagesToDeleteCount, select: { id: true },
          });
          const idsToDelete = messagesToDelete.map(msg => msg.id);
          if (idsToDelete.length > 0) {
            await tx.chatMessage.deleteMany({
              where: { id: { in: idsToDelete }, sessionId: currentSessionId },
            });
          }
        }
      });
    } catch (pruneError: unknown) {
      formatErrorMessage(pruneError, "skraćivanja istorije baze podataka");
    }

    return NextResponse.json(aiResponseMessage, { status: 200 });

  } catch (error: unknown) {
    const userMessage = formatErrorMessage(error, "/api/chat glavni handler");
    let statusCode = 500;
    if (error instanceof Error && typeof (error as ErrorWithStatus).status === 'number') {
        statusCode = (error as ErrorWithStatus).status!;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
      statusCode = 400;
    }
    return NextResponse.json({ error: "Interna greška servera", details: userMessage }, { status: statusCode, headers: { 'Content-Type': 'application/json' } });
  }
}
