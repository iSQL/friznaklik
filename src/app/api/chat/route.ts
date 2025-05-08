// src/app/api/chat/route.ts

import { NextResponse } from 'next/server'; 
import { auth } from '@clerk/nextjs/server'; 
import prisma from '@/lib/prisma'; 

// Import the necessary types from the SDK
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
  Schema, 
  FunctionDeclarationsTool, 
  FunctionDeclaration, 
} from '@google/generative-ai';

import { parseISO, format, isValid, addDays, startOfDay } from 'date-fns'; 
import { headers } from 'next/headers';

// --- Helper Function for Serbian Diacritic Normalization ---
function normalizeSerbianText(text: string): string {
    // ... (keep existing normalization function)
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/š/g, 's')
        .replace(/đ/g, 'dj') // Or just 'd' if preferred
        .replace(/č/g, 'c')
        .replace(/ć/g, 'c')
        .replace(/ž/g, 'z');
}

// --- Define Schemas for Tool Parameters (with Serbian descriptions) ---
const serviceNameSchema: Schema = { type: SchemaType.STRING, description: "Tačan naziv frizerske usluge (npr. 'Šišanje', 'Pranje kose'). Neosetljivo na velika/mala slova i dijakritičke znake (npr. 'Sisanje' je isto kao 'Šišanje')." }; 
const dateSchema: Schema = { type: SchemaType.STRING, description: "Željeni datum za termin u formatu YYYY-MM-DD (npr. '2024-12-31'). AI može zaključiti ovo iz relativnih izraza kao što je 'sutra' na osnovu trenutnog datuma datog u instrukcijama." }; 
const serviceIdSchema: Schema = { type: SchemaType.STRING, description: "Jedinstveni ID frizerske usluge." }; 
const slotSchema: Schema = { type: SchemaType.STRING, description: "Specifičan termin u HH:mm formatu (npr. '10:00'), dobijen iz dostupnih termina." }; 

// --- Define ALL Tools (Using Standard Format, with Serbian descriptions) ---
const listServicesDeclaration: FunctionDeclaration = { /* ... keep existing declaration ... */ 
  name: "listAvailableServices",
  description: "Navodi sve dostupne frizerske usluge, uključujući naziv, opis, trajanje i cenu. Koristite ovu funkciju kada korisnik eksplicitno traži da vidi ili navede sve dostupne usluge.", // sr: Lists all available haircut services... Use this function when...
};
const checkAvailabilityDeclaration: FunctionDeclaration = { /* ... keep existing declaration ... */ 
  name: "checkAppointmentAvailability",
  description: "Proverava dostupne termine za određenu uslugu na određeni datum. Koristite ovo pre pokušaja zakazivanja termina.", // sr: Checks for available appointment time slots... Use this before attempting to book...
  parameters: {
    type: SchemaType.OBJECT,
    properties: { serviceName: serviceNameSchema, date: dateSchema },
    required: ["serviceName", "date"],
  },
};
const bookAppointmentDeclaration: FunctionDeclaration = { /* ... keep existing declaration ... */ 
  name: "bookAppointment",
  description: "Zakazuje termin za korisnika. Zahteva naziv usluge, datum i specifičan termin.", // sr: Books an appointment for a user. Requires the service name, date, and the specific time slot.
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

// --- System Instruction will be generated dynamically inside POST ---

// Handles POST requests to /api/chat
export async function POST(request: Request) {
  console.log('POST /api/chat: Request received');

  // --- Initialize AI Client *inside* the handler ---
  const aiApiKey = process.env.GOOGLE_API_KEY; // Use the environment variable directly
  let genAI: GoogleGenerativeAI | null = null;
  let model: any | null = null; // Use 'any' or a more specific type if available from the SDK for the model instance

  if (!aiApiKey) {
      // Log the error but allow the function to potentially continue if AI isn't strictly needed for all paths
      console.error('POST /api/chat: GOOGLE_API_KEY environment variable is not set.');
      // Return error immediately if AI is essential for this endpoint
      return new NextResponse('AI configuration error: Missing API Key', { status: 500 });
  } else {
      try {
          genAI = new GoogleGenerativeAI(aiApiKey);
          model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Changed model name
          console.log('POST /api/chat: Google AI Client and Model initialized successfully.');
      } catch (initError: any) {
          console.error('POST /api/chat: Error initializing Google AI Client:', initError);
          return new NextResponse(`AI initialization error: ${initError.message}`, { status: 500 });
      }
  }

  // Ensure model is initialized before proceeding (redundant check if we return error above, but safe)
  if (!model) {
      console.error('POST /api/chat: AI model client not initialized, returning 500');
      return new NextResponse('AI model failed to initialize', { status: 500 });
  }
  // --- End AI Client Initialization ---

  const { userId } = await auth();
  console.log('POST /api/chat: Clerk userId:', userId);

  if (!userId) {
    console.log('POST /api/chat: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }


  try {
    // --- Database User Check ---
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
    });
    if (!dbUser) {
        console.error('POST /api/chat: Database user not found for clerkId:', userId);
        return new NextResponse('User not found in database', { status: 404 });
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
    const body = await request.json();
    const userMessageObject = body;
    console.log('POST /api/chat: User message object:', userMessageObject);
    if (!userMessageObject || typeof userMessageObject.text !== 'string' || !userMessageObject.id || !userMessageObject.timestamp || userMessageObject.sender !== 'user') {
      console.log('POST /api/chat: Invalid user message object format');
      return new NextResponse('Invalid user message object format', { status: 400 });
    }

    // --- Save User Message ---
    console.log('POST /api/chat: Saving user message to database...');
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

    // --- Prepare History for AI (Limit to last 10 messages) ---
     const recentDbMessages = await prisma.chatMessage.findMany({
        where: { sessionId: currentSessionId },
        orderBy: { timestamp: 'desc' }, 
        take: 10 
     });
     const orderedRecentMessages = recentDbMessages.reverse();
     let history = orderedRecentMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model', 
        parts: [{ text: msg.message }],
     }));
     if (history.length > 0 && history[0].role !== 'user') {
        console.log('[History Fix] First message role is not "user", removing it.');
        history.shift(); 
     }
     console.log(`POST /api/chat: Conversation history sent to AI: ${history.length} messages (limited, starts with user)`);

    // --- Interact with AI Model ---
    let aiResponseText = 'Žao mi je, došlo je do problema prilikom obrade vašeg zahteva.'; 
    let toolCalls: any[] | undefined;

    // --- Generate Dynamic System Instruction ---
    const currentDate = format(new Date(), 'yyyy-MM-dd'); 
    const dynamicSystemInstruction = `Vi ste ljubazan i koristan asistent za zakazivanje frizerskih termina u našem salonu. Započnite razgovor pozdravom.
Današnji datum je ${currentDate}.
Vaše mogućnosti, koristeći dostupne alate, su:
1.  Navesti sve dostupne usluge (alat 'listAvailableServices').
2.  Proveriti dostupne termine za određenu uslugu i datum (alat 'checkAppointmentAvailability').
3.  Zakazati termin za određenu uslugu, datum i vreme (alat 'bookAppointment').

Proaktivno ponudite ove opcije korisniku. Zaključite datume kao što je 'sutra' na osnovu današnjeg datuma (${currentDate}). Budite jasni oko informacija koje su vam potrebne (kao što su naziv usluge, datum, vreme).`; 
    console.log("POST /api/chat: Dynamic System Instruction (Serbian):", dynamicSystemInstruction);
    console.log('POST /api/chat: Tools being passed (standard format):', JSON.stringify(tools, null, 2));

    // --- Start AI Chat ---
    const chat = model.startChat({
        systemInstruction: {
            role: "system", 
            parts: [{ text: dynamicSystemInstruction }],
        },
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
            console.log('POST /api/chat: AI requested tool calls:', toolCalls);

            // --- Get headers for forwarding ---
            const incomingRequestHeaders = new Headers(await headers());
            const cookieHeader = incomingRequestHeaders.get('Cookie');
            const fetchHeaders: HeadersInit = { 'Content-Type': 'application/json' };
             if (cookieHeader) {
                 fetchHeaders['Cookie'] = cookieHeader; 
             }
             console.log(`[Header Forwarding] Cookie header ${cookieHeader ? 'found' : 'not found'}. Forwarding headers:`, fetchHeaders);

            // --- Execute Tool Calls ---
            const toolResultPromises = toolCalls.map(async (toolCall) => {
                const functionName = toolCall.name;
                const functionArgs = toolCall.args;
                console.log(`POST /api/chat: Executing tool: ${functionName} with args:`, functionArgs);
                let toolResponsePayload: any = { output: null, error: null };

                try {
                    // --- Tool Logic (listAvailableServices, checkAppointmentAvailability, bookAppointment) ---
                    // ... (Keep existing tool execution logic, including internal fetch calls) ...
                    // --- Tool: listAvailableServices ---
                    if (functionName === 'listAvailableServices') {
                        console.log('[listServices] Fetching all services...');
                        const allServices = await prisma.service.findMany({
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                duration: true,
                                price: true,
                            }
                        });
                        toolResponsePayload.output = { services: allServices };
                        console.log(`[listServices] Found ${allServices.length} services.`);
                    }
                    // --- Tool: checkAppointmentAvailability ---
                    else if (functionName === 'checkAppointmentAvailability') {
                        const { serviceName, date: dateString } = functionArgs;
                        console.log(`[checkAvailability] Received serviceName: "${serviceName}", date: "${dateString}"`);
                        const normalizedInputName = normalizeSerbianText(serviceName);
                        console.log(`[checkAvailability] Normalized input name: "${normalizedInputName}"`);
                        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !isValid(parseISO(dateString))) {
                            toolResponsePayload.error = `Nevažeći format datuma: '${dateString}'. Molimo koristite YYYY-MM-DD.`;
                            console.log(`[checkAvailability] Invalid date format.`);
                        } else {
                            const allDbServices = await prisma.service.findMany({ select: { id: true, name: true } });
                            const matchingServices = allDbServices.filter(dbService => normalizeSerbianText(dbService.name) === normalizedInputName);
                            console.log(`[checkAvailability] Found ${matchingServices.length} services matching normalized name "${normalizedInputName}":`, matchingServices);
                            if (matchingServices.length === 0) {
                                toolResponsePayload.error = `Žao mi je, nisam mogao/la pronaći uslugu pod nazivom "${serviceName}" (ili sličnim). Možete me pitati da navedem sve usluge kako biste videli tačne nazive.`;
                                console.log(`[checkAvailability] Tool execution failed - Service not found by normalized name.`);
                            } else if (matchingServices.length > 1) {
                                const originalNames = matchingServices.map(s => s.name).join(', ');
                                toolResponsePayload.error = `Pronašao/la sam više usluga koje odgovaraju "${serviceName}" (nakon normalizacije): ${originalNames}. Molimo Vas da budete precizniji ili kontaktirate podršku.`;
                                console.log(`[checkAvailability] Tool execution failed - Ambiguous normalized service name.`);
                            } else {
                                const service = matchingServices[0];
                                console.log(`[checkAvailability] Unique service found via normalization: ID=${service.id}, Original Name=${service.name}. Proceeding.`);
                                const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                                const availabilityApiUrl = `${SITE_URL}/api/appointments/available?serviceId=${service.id}&date=${dateString}`;
                                console.log(`[checkAvailability] Calling internal availability API: ${availabilityApiUrl}`);
                                const availabilityRes = await fetch(availabilityApiUrl, { headers: fetchHeaders });
                                if (!availabilityRes.ok) {
                                    const errorText = await availabilityRes.text();
                                    toolResponsePayload.error = `Neuspešna provera dostupnosti preko internog API-ja za ${service.name} (ID: ${service.id}) na ${dateString}. Status: ${availabilityRes.status} - ${errorText || '(Nema teksta greške)'}`;
                                    console.error(`[checkAvailability] Internal availability API call failed: ${availabilityRes.status}. URL: ${availabilityApiUrl}`);
                                } else {
                                    const availableSlots = await availabilityRes.json();
                                    toolResponsePayload.output = { serviceId: service.id, serviceName: service.name, date: dateString, availableSlots: availableSlots };
                                    console.log(`[checkAvailability] Internal availability API call successful. Slots:`, availableSlots);
                                }
                            }
                        }
                    }
                    // --- Tool: bookAppointment ---
                    else if (functionName === 'bookAppointment') {
                         const { serviceName, date: dateString, slot } = functionArgs;
                         console.log(`[bookAppointment] Received serviceName: "${serviceName}", date: "${dateString}", slot: "${slot}"`);
                         const normalizedInputName = normalizeSerbianText(serviceName);
                         console.log(`[bookAppointment] Normalized input name: "${normalizedInputName}"`);
                         if (!serviceName || !dateString || !slot || !/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !/^\d{2}:\d{2}$/.test(slot)) {
                            toolResponsePayload.error = `Zakazivanje neuspešno: Nedostaje ili je nevažeći naziv usluge, datum (YYYY-MM-DD), ili termin (HH:mm).`;
                            console.log(`[bookAppointment] Invalid input parameters.`);
                         } else {
                             const allDbServices = await prisma.service.findMany({ select: { id: true, name: true } });
                             const matchingServices = allDbServices.filter(dbService => normalizeSerbianText(dbService.name) === normalizedInputName);
                             console.log(`[bookAppointment] Found ${matchingServices.length} services matching normalized name "${normalizedInputName}" for booking:`, matchingServices);
                             if (matchingServices.length === 0) {
                                toolResponsePayload.error = `Zakazivanje neuspešno: Žao mi je, nisam mogao/la pronaći uslugu pod nazivom "${serviceName}" (ili sličnim) za zakazivanje. Molimo proverite naziv ili me pitajte da navedem usluge.`;
                                console.log(`[bookAppointment] Tool execution failed - Service not found by normalized name.`);
                            } else if (matchingServices.length > 1) {
                                const originalNames = matchingServices.map(s => s.name).join(', ');
                                toolResponsePayload.error = `Zakazivanje neuspešno: Pronađeno je više usluga koje odgovaraju "${serviceName}" (nakon normalizacije): ${originalNames}. Molimo Vas da budete precizniji.`;
                                console.log(`[bookAppointment] Tool execution failed - Ambiguous normalized service name.`);
                            } else {
                                const serviceToBook = matchingServices[0]; 
                                const serviceId = serviceToBook.id;
                                console.log(`[bookAppointment] Unique service found via normalization for booking: ID=${serviceId}, Original Name=${serviceToBook.name}. Proceeding.`);
                                const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                                const bookingApiUrl = `${SITE_URL}/api/appointments`;
                                console.log(`[bookAppointment] Calling internal booking API: ${bookingApiUrl}`);
                                const bookingRes = await fetch(bookingApiUrl, {
                                    method: 'POST',
                                    headers: fetchHeaders, 
                                    body: JSON.stringify({ serviceId: serviceId, date: dateString, slot }),
                                });
                                if (!bookingRes.ok) {
                                    const errorText = await bookingRes.text();
                                    toolResponsePayload.error = `Zakazivanje neuspešno preko internog API-ja: ${bookingRes.status} - ${errorText || '(Nema teksta greške)'}`;
                                    console.error(`[bookAppointment] Internal booking API call failed: ${bookingRes.status}. URL: ${bookingApiUrl}`);
                                } else {
                                    const bookingResult = await bookingRes.json();
                                    toolResponsePayload.output = { success: true, appointmentDetails: bookingResult };
                                    console.log(`[bookAppointment] Internal booking API call successful.`);
                                }
                            }
                         }
                    }
                    // --- Unknown Tool ---
                    else {
                        toolResponsePayload.error = `Nepoznat alat zatražen: ${functionName}`;
                        console.error(`POST /api/chat: Unknown tool requested by AI: ${functionName}`);
                    }
                } catch (toolError: any) {
                    toolResponsePayload.error = `Greška pri izvršavanju alata ${functionName}: ${toolError.message || 'Nepoznata greška'}`;
                    console.error(`POST /api/chat: Error during tool execution for ${functionName}:`, toolError);
                }

                return {
                    toolCallId: toolCall.id,
                    functionResponse: {
                        name: functionName,
                        response: toolResponsePayload,
                    },
                };
            }); 

            // --- Send Tool Results back to AI ---
            const toolResults = await Promise.all(toolResultPromises);
            console.log('POST /api/chat: Tool results being sent back to AI:', JSON.stringify(toolResults, null, 2));
            const toolResultResponse = await chat.sendMessage(JSON.stringify(toolResults));
            const finalResponse = toolResultResponse.response;
            aiResponseText = finalResponse.text(); 
            console.log('POST /api/chat: Received final AI response after tool use:', aiResponseText);

        } else {
             // No tool call requested
             aiResponseText = response.text();
             console.log('POST /api/chat: Received AI text response (no tool call):', aiResponseText);
        }

    } catch (aiError: any) {
        console.error('Error interacting with Google AI model:', aiError);
        aiResponseText = `Žao mi je, došlo je do greške prilikom pokušaja razumevanja ili obrade vašeg zahteva. Detalji: ${aiError.message || 'Nepoznata AI greška'}`;
    }
    // --- End AI Interaction ---

    // --- Prepare AI Response ---
    const aiResponseMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        text: aiResponseText,
        sender: 'ai' as 'ai',
        timestamp: new Date(),
    };

    // --- Save AI Response & Prune History ---
    console.log('POST /api/chat: Saving AI message and pruning history...');
    try {
        await prisma.$transaction(async (tx) => {
            // Save AI message
            await tx.chatMessage.create({
                data: {
                    id: aiResponseMessage.id,
                    sessionId: currentSessionId,
                    sender: 'ai',
                    message: aiResponseMessage.text,
                    timestamp: aiResponseMessage.timestamp,
                }
            });
            console.log('[DB Pruning] AI message saved.');

            // Prune history logic
            const messageCount = await tx.chatMessage.count({ where: { sessionId: currentSessionId } });
            console.log(`[DB Pruning] Total messages in session ${currentSessionId}: ${messageCount}`);
            const historyLimit = 20; 
            if (messageCount > historyLimit) {
                const messagesToDeleteCount = messageCount - historyLimit;
                console.log(`[DB Pruning] Message count exceeds limit (${historyLimit}). Need to delete ${messagesToDeleteCount} oldest messages.`);
                const messagesToDelete = await tx.chatMessage.findMany({
                    where: { sessionId: currentSessionId },
                    orderBy: { timestamp: 'asc' }, 
                    take: messagesToDeleteCount,
                    select: { id: true }, 
                });
                const idsToDelete = messagesToDelete.map(msg => msg.id);
                console.log('[DB Pruning] IDs to delete:', idsToDelete);
                if (idsToDelete.length > 0) {
                    const deleteResult = await tx.chatMessage.deleteMany({
                        where: { id: { in: idsToDelete }, sessionId: currentSessionId },
                    });
                    console.log(`[DB Pruning] Deleted ${deleteResult.count} messages.`);
                } else {
                     console.log('[DB Pruning] No message IDs found to delete.');
                }
            } else {
                 console.log(`[DB Pruning] Message count (${messageCount}) is within the limit (${historyLimit}). No deletion needed.`);
            }
        }); 
         console.log('[DB Pruning] Transaction completed successfully.');
    } catch (pruneError) {
         console.error('Error during database history pruning:', pruneError);
    }

    // Return AI response to frontend
    console.log('POST /api/chat: Returning AI ChatMessage object:', aiResponseMessage);
    return NextResponse.json(aiResponseMessage, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/chat handler:', error);
    return new NextResponse(`Interna greška servera: ${error.message || 'Nepoznata greška'}`, { status: 500 });
  }
}
