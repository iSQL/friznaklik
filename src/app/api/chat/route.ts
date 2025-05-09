// src/app/api/chat/route.ts

import { NextResponse, type NextRequest } from 'next/server'; // Using NextRequest for consistency
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { Prisma, Appointment, Service } from '@prisma/client'; // Import Prisma for specific error types and models

// Import the necessary types from the SDK
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
  Schema,
  FunctionDeclarationsTool,
  FunctionDeclaration,
  GenerativeModel, // Added for typing 'model'
  FunctionCall,    // Added for typing 'toolCalls'
} from '@google/generative-ai';

import { parseISO, format, isValid } from 'date-fns';
import { headers } from 'next/headers';
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility

// --- Helper Function for Serbian Diacritic Normalization ---
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

// --- Define Schemas for Tool Parameters ---
const serviceNameSchema: Schema = { type: SchemaType.STRING, description: "Tačan naziv frizerske usluge (npr. 'Šišanje', 'Pranje kose'). Neosetljivo na velika/mala slova i dijakritičke znake (npr. 'Sisanje' je isto kao 'Šišanje')." };
const dateSchema: Schema = { type: SchemaType.STRING, description: "Željeni datum za termin u formatu YYYY-MM-DD (npr. '2024-12-31'). AI može zaključiti ovo iz relativnih izraza kao što je 'sutra' na osnovu trenutnog datuma datog u instrukcijama." };
const slotSchema: Schema = { type: SchemaType.STRING, description: "Specifičan termin u HH:mm formatu (npr. '10:00'), dobijen iz dostupnih termina." };

// --- Define ALL Tools ---
const listServicesDeclaration: FunctionDeclaration = {
  name: "listAvailableServices",
  description: "Navodi sve dostupne frizerske usluge, uključujući naziv, opis, trajanje i cenu. Koristite ovu funkciju kada korisnik eksplicitno traži da vidi ili navede sve dostupne usluge.",
};
const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "checkAppointmentAvailability",
  description: "Proverava dostupne termine za određenu uslugu na određeni datum. Koristite ovo pre pokušaja zakazivanja termina.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { serviceName: serviceNameSchema, date: dateSchema },
    required: ["serviceName", "date"],
  },
};
const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "bookAppointment",
  description: "Zakazuje termin za korisnika. Zahteva naziv usluge, datum i specifičan termin. **MORA** se pozvati nakon što je dostupnost proverena i korisnik je potvrdio da želi da zakaže.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      serviceName: serviceNameSchema,
      date: dateSchema,
      slot: slotSchema
    },
    required: ["serviceName", "date", "slot"],
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

// --- Define specific output types for each tool function ---
interface ListServicesToolOutput {
  services: Array<Pick<Service, 'id' | 'name' | 'description' | 'duration' | 'price'>>;
}

interface CheckAvailabilityToolOutput {
  serviceId: string;
  serviceName: string;
  date: string;
  availableSlots: string[]; // Assuming /api/appointments/available returns string[]
}

interface BookAppointmentToolOutput {
  success: boolean;
  appointmentDetails: Appointment; // Assuming /api/appointments returns a Prisma Appointment
}

// Union type for all possible tool outputs
type ToolOutput = ListServicesToolOutput | CheckAvailabilityToolOutput | BookAppointmentToolOutput | null;

// Custom error interface for errors that might have a status property
interface ErrorWithStatus extends Error {
    status?: number;
}


// Handles POST requests to /api/chat
export async function POST(request: NextRequest) { // Changed to NextRequest for consistency
  console.log('POST /api/chat: Request received');

  // --- Initialize AI Client *inside* the handler ---
  const aiApiKey = process.env.GOOGLE_API_KEY;
  let genAI: GoogleGenerativeAI | null = null;
  let model: GenerativeModel | null = null; // Corrected type from 'any'

  if (!aiApiKey) {
    const errorMessage = formatErrorMessage(
      new Error('GOOGLE_API_KEY environment variable is not set.'),
      "AI client initialization"
    );
    // console.error is called within formatErrorMessage
    return new NextResponse(JSON.stringify({ error: "AI configuration error: Missing API Key", details: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  } else {
    try {
      genAI = new GoogleGenerativeAI(aiApiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Ensure this model name is correct
      console.log('POST /api/chat: Google AI Client and Model initialized successfully.');
    } catch (initError: unknown) {
      const errorMessage = formatErrorMessage(initError, "Google AI Client initialization");
      return new NextResponse(JSON.stringify({ error: "AI initialization error", details: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!model) {
    // This case should ideally be caught by the try-catch above, but as a fallback:
    const errorMessage = formatErrorMessage(new Error('AI model client not initialized after setup attempt.'), "AI model availability check");
    return new NextResponse(JSON.stringify({ error: "AI model failed to initialize", details: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  // --- End AI Client Initialization ---

  const { userId } = await auth();
  if (!userId) {
    console.warn('POST /api/chat: User not authenticated, returning 401');
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  console.log('POST /api/chat: Clerk userId:', userId);


  try {
    // --- Database User Check ---
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!dbUser) {
      const errorMessage = formatErrorMessage(new Error(`Database user not found for clerkId: ${userId}`), "database user lookup");
      return new NextResponse(JSON.stringify({ error: 'User not found in database', details: errorMessage }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    console.log(`POST /api/chat: Database userId: ${dbUser.id}`);

    // --- Find or Create Chat Session ---
    let chatSession = await prisma.chatSession.findFirst({
      where: { userId: dbUser.id },
    });
    if (!chatSession) {
      console.log(`POST /api/chat: No chat session found for user ${dbUser.id}, creating new session.`);
      chatSession = await prisma.chatSession.create({ data: { userId: dbUser.id } });
      console.log(`POST /api/chat: New chat session created with ID: ${chatSession.id}`);
    } else {
      console.log(`POST /api/chat: Found chat session ${chatSession.id}.`);
    }
    const currentSessionId = chatSession.id;

    // --- Parse and Validate User Message ---
    let userMessageObject: { text: string; id: string; timestamp: string; sender: 'user' };
    try {
      userMessageObject = await request.json();
      if (!userMessageObject || typeof userMessageObject.text !== 'string' || !userMessageObject.id || !userMessageObject.timestamp || userMessageObject.sender !== 'user') {
        throw new Error('Invalid user message object format');
      }
    } catch (parseError: unknown) {
      const errorMessage = formatErrorMessage(parseError, "parsing user message JSON");
      return new NextResponse(JSON.stringify({ error: 'Invalid request body', details: errorMessage }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    console.log('POST /api/chat: User message object:', userMessageObject);

    // --- Save User Message ---
    await prisma.chatMessage.create({
      data: {
        id: userMessageObject.id,
        sessionId: currentSessionId,
        sender: 'user',
        message: userMessageObject.text,
        timestamp: new Date(userMessageObject.timestamp),
      }
    });
    console.log('POST /api/chat: User message saved.');

    // --- Prepare History for AI ---
    const recentDbMessages = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId }, orderBy: { timestamp: 'desc' }, take: 10
    });
    const orderedRecentMessages = recentDbMessages.reverse();
    const history = orderedRecentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.message }],
    }));
    if (history.length > 0 && history[0].role !== 'user') {
      history.shift();
    }
    console.log(`POST /api/chat: Conversation history sent to AI: ${history.length} messages`);

    // --- Interact with AI Model ---
    let aiResponseText = 'Žao mi je, došlo je do problema prilikom obrade vašeg zahteva.';
    let toolCalls: FunctionCall[] | undefined; // Corrected type from 'any[]'

    // --- Generate Dynamic System Instruction ---
    const currentDate = format(new Date(), 'yyyy-MM-dd');
    const dynamicSystemInstruction = `Vi ste ljubazan i koristan asistent za zakazivanje frizerskih termina u našem salonu. Započnite razgovor pozdravom.
Današnji datum je ${currentDate}.
Vaše mogućnosti, koristeći dostupne alate, su:
1.  Navesti sve dostupne usluge (alat 'listAvailableServices').
2.  Proveriti dostupne termine za određenu uslugu i datum (alat 'checkAppointmentAvailability'). **Uvek koristite ovaj alat PRE zakazivanja.**
3.  Zakazati termin za određenu uslugu, datum i vreme (alat 'bookAppointment'). **Ovaj alat se MORA pozvati NAKON što je dostupnost proverena sa 'checkAppointmentAvailability' i korisnik je potvrdio da želi da zakaže taj termin.**

Važan proces zakazivanja:
a) Kada korisnik želi da zakaže, PRVO pozovite 'checkAppointmentAvailability' sa uslugom i datumom.
b) Predstavite dostupne termine korisniku. Ako je traženi termin dostupan, pitajte korisnika da potvrdi zakazivanje.
c) Ako korisnik potvrdi ("da", "ok", "može", itd.), ONDA i SAMO ONDA pozovite alat 'bookAppointment' sa tačnim nazivom usluge, datumom i potvrđenim vremenom (slot).
d) Tek nakon što dobijete USPEŠAN odgovor od alata 'bookAppointment' (output.success === true), potvrdite korisniku da je termin uspešno zakazan.
e) Ako alat 'bookAppointment' vrati grešku (error field nije null), obavestite korisnika da zakazivanje nije uspelo i navedite razlog greške. Nemojte potvrđivati zakazivanje u slučaju greške.

Proaktivno ponudite ove opcije korisniku. Zaključite datume kao što je 'sutra' na osnovu današnjeg datuma (${currentDate}). Budite jasni oko informacija koje su vam potrebne (kao što su naziv usluge, datum, vreme).`;

    const chat = model.startChat({
      systemInstruction: { role: "system", parts: [{ text: dynamicSystemInstruction }] },
      history: history,
      tools: tools,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
    });

    try {
      const result = await chat.sendMessage(userMessageObject.text);
      const response = result.response;
      toolCalls = response.functionCalls();

      if (toolCalls && toolCalls.length > 0) {
        console.log('POST /api/chat: AI requested tool calls:', JSON.stringify(toolCalls, null, 2));
        const incomingRequestHeaders = new Headers(await headers());
        const cookieHeader = incomingRequestHeaders.get('Cookie');
        const fetchHeaders: HeadersInit = { 'Content-Type': 'application/json' };
        if (cookieHeader) { fetchHeaders['Cookie'] = cookieHeader; }

        const toolResultPromises = toolCalls.map(async (toolCall) => {
          const functionName = toolCall.name;
          // toolCall.args is Record<string, any> by SDK definition, explicit typing for args destructuring.
          const functionArgs = toolCall.args as { serviceName?: string; date?: string; slot?: string };
          const toolResponsePayload: { output: ToolOutput; error: string | null } = { output: null, error: null }; // Corrected type for 'output'

          try {
            // --- Tool Logic ---
            if (functionName === 'listAvailableServices') {
              const allServices = await prisma.service.findMany({
                select: { id: true, name: true, description: true, duration: true, price: true }
              });
              toolResponsePayload.output = { services: allServices };
            } else if (functionName === 'checkAppointmentAvailability') {
              const { serviceName, date: dateString } = functionArgs;
              if (!serviceName || !dateString) {
                                toolResponsePayload.error = "Nedostaje naziv usluge ili datum za proveru dostupnosti.";
              } else {
                const normalizedInputName = normalizeSerbianText(serviceName);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !isValid(parseISO(dateString))) {
                  toolResponsePayload.error = `Nevažeći format datuma: '${dateString}'. Molimo koristite YYYY-MM-DD.`;
                } else {
                  const allDbServices = await prisma.service.findMany({ select: { id: true, name: true } });
                  const matchingServices = allDbServices.filter(dbService => normalizeSerbianText(dbService.name) === normalizedInputName);
                  if (matchingServices.length === 0) {
                    toolResponsePayload.error = `Žao mi je, nisam mogao/la pronaći uslugu pod nazivom "${serviceName}".`;
                  } else if (matchingServices.length > 1) {
                    toolResponsePayload.error = `Pronađeno je više usluga za "${serviceName}". Molimo budite precizniji.`;
                  } else {
                    const service = matchingServices[0];
                    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    const availabilityApiUrl = `${SITE_URL}/api/appointments/available?serviceId=${service.id}&date=${dateString}`;
                    const availabilityRes = await fetch(availabilityApiUrl, { headers: fetchHeaders });
                    if (!availabilityRes.ok) {
                      const errorText = await availabilityRes.text();
                      toolResponsePayload.error = `Greška pri proveri dostupnosti: ${availabilityRes.status} - ${errorText || 'Interna greška'}`;
                    } else {
                      // Assuming availabilityRes.json() returns string[]
                      const availableSlots: string[] = await availabilityRes.json();
                      toolResponsePayload.output = { serviceId: service.id, serviceName: service.name, date: dateString, availableSlots };
                    }
                  }
                }
              }
            } else if (functionName === 'bookAppointment') {
              const { serviceName, date: dateString, slot } = functionArgs;
              if (!serviceName || !dateString || !slot) {
                                toolResponsePayload.error = "Nedostaje naziv usluge, datum ili vreme za zakazivanje.";
              } else {
                const normalizedInputName = normalizeSerbianText(serviceName);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !/^\d{2}:\d{2}$/.test(slot)) {
                  toolResponsePayload.error = `Zakazivanje neuspešno: Nedostaju ili su nevažeći parametri za datum ili vreme.`;
                } else {
                  const allDbServices = await prisma.service.findMany({ select: { id: true, name: true } });
                  const matchingServices = allDbServices.filter(dbService => normalizeSerbianText(dbService.name) === normalizedInputName);
                  if (matchingServices.length === 0) {
                    toolResponsePayload.error = `Zakazivanje neuspešno: Usluga "${serviceName}" nije pronađena.`;
                  } else if (matchingServices.length > 1) {
                    toolResponsePayload.error = `Zakazivanje neuspešno: Pronađeno više usluga za "${serviceName}".`;
                  } else {
                    const serviceToBook = matchingServices[0];
                    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                    const bookingApiUrl = `${SITE_URL}/api/appointments`;
                    const bookingRes = await fetch(bookingApiUrl, {
                      method: 'POST',
                      headers: fetchHeaders,
                      body: JSON.stringify({ serviceId: serviceToBook.id, date: dateString, slot }),
                    });
                    if (!bookingRes.ok) {
                      const errorText = await bookingRes.text();
                      toolResponsePayload.error = `Zakazivanje neuspešno: ${bookingRes.status} - ${errorText || 'Interna greška API-ja'}`;
                    } else {
                      // Assuming bookingRes.json() returns a Prisma Appointment
                      const appointmentDetails: Appointment = await bookingRes.json();
                      toolResponsePayload.output = { success: true, appointmentDetails };
                    }
                  }
                }
              }
            } else {
              toolResponsePayload.error = `Nepoznat alat zatražen: ${functionName}`;
            }
          } catch (toolError: unknown) { // Catch unknown for tool execution
            // Log detailed error via formatErrorMessage, but return a simpler error to AI
            formatErrorMessage(toolError, `executing tool ${functionName}`);
            toolResponsePayload.error = `Greška pri izvršavanju alata ${functionName}.`;
          }
          // The SDK expects the response part to be an object, not just the payload.
          return { functionResponse: { name: functionName, response: { content: toolResponsePayload } } };
        });

        const toolResults = await Promise.all(toolResultPromises);
        console.log('POST /api/chat: Tool results being sent back to AI:', JSON.stringify(toolResults, null, 2));
        // Send tool results back to the model
        // The SDK expects an array of Part objects for history, or a simple string for a single message.
        // For function responses, we send the array of objects as constructed.
        const toolResultResponse = await chat.sendMessage(JSON.stringify(toolResults)); // This might need adjustment based on SDK version for sending tool responses.
                                                                                        // Often it's `chat.sendMessage([{ functionResponse: ... }])`
                                                                                        // Or the content of toolResults might need to be directly `Part[]`
                                                                                        // For gemini-1.5-flash with function calling, sending the stringified array of FunctionResponseParts is typical.
        aiResponseText = toolResultResponse.response.text();
        console.log('POST /api/chat: Received final AI response after tool use:', aiResponseText);
      } else {
        aiResponseText = response.text();
        console.log('POST /api/chat: Received AI text response (no tool call):', aiResponseText);
      }
    } catch (aiError: unknown) { // Catch unknown for AI interaction
      const formattedError = formatErrorMessage(aiError, "interacting with Google AI model");
      // The formatErrorMessage already logs the detailed error.
      // For the user, we might want a generic AI error message.
      aiResponseText = `Žao mi je, došlo je do greške sa AI asistentom. Molimo pokušajte kasnije. (Detalji: ${formattedError})`; // Append original formatted message for context
    }
    // --- End AI Interaction ---

    const aiResponseMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      text: aiResponseText,
      sender: 'ai',
      timestamp: new Date(),
    } as const;

    // --- Save AI Response & Prune History ---
    try {
      await prisma.$transaction(async (tx) => {
        await tx.chatMessage.create({
          data: {
            id: aiResponseMessage.id, sessionId: currentSessionId, sender: 'ai',
            message: aiResponseMessage.text, timestamp: aiResponseMessage.timestamp,
          }
        });
        const messageCount = await tx.chatMessage.count({ where: { sessionId: currentSessionId } });
        const historyLimit = 20;
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
    } catch (pruneError: unknown) { // Catch unknown for pruning
      formatErrorMessage(pruneError, "database history pruning"); // Log detailed error
      // Don't block returning AI response for pruning errors
    }

    return NextResponse.json(aiResponseMessage, { status: 200 });

  } catch (error: unknown) { // Catch unknown for the main handler
    const userMessage = formatErrorMessage(error, "/api/chat main handler");
    // Determine status code based on error type if possible
    let statusCode = 500;
    // Refined error status checking
    if (error instanceof Error && typeof (error as ErrorWithStatus).status === 'number') {
        statusCode = (error as ErrorWithStatus).status!;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
      statusCode = 400; // Or a more specific code based on Prisma error
    }

    return new NextResponse(JSON.stringify({ error: "Interna greška servera", details: userMessage }), { status: statusCode, headers: { 'Content-Type': 'application/json' } });
  }
}
