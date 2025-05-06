// src/app/api/chat/route.ts

import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import prisma from '@/lib/prisma'; // Import Prisma client utility

// Import the SDK for Google AI (Gemini)
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
  Schema, // Ensure Schema is imported
  FunctionDeclarationsTool, // Import FunctionDeclarationsTool
  FunctionDeclaration, // Import FunctionDeclaration type
} from '@google/generative-ai';


// Import date-fns for parsing dates from AI and getting current date
import { parseISO, format, isValid, addDays, startOfDay } from 'date-fns'; // format is used for current date

// Import headers helper for forwarding cookies - Needed for internal server-side fetches
import { headers } from 'next/headers';


// Get your Google AI API key from environment variables
const aiApiKey = process.env.GOOGLE_API_KEY;


// Ensure the API key is set
if (!aiApiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set.');
  // Handle missing API key appropriately
}

// Initialize the Google AI model client
const genAI = aiApiKey ? new GoogleGenerativeAI(aiApiKey) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.0-flash'}) : null;

// --- Helper Function for Serbian Diacritic Normalization ---
function normalizeSerbianText(text: string): string {
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
const serviceNameSchema: Schema = { type: SchemaType.STRING, description: "Tačan naziv frizerske usluge (npr. 'Šišanje', 'Pranje kose'). Neosetljivo na velika/mala slova i dijakritičke znake (npr. 'Sisanje' je isto kao 'Šišanje')." }; // sr: Exact name... Case-insensitive and diacritic-insensitive...
const dateSchema: Schema = { type: SchemaType.STRING, description: "Željeni datum za termin u formatu<y_bin_46>-MM-DD (npr. '2024-12-31'). AI može zaključiti ovo iz relativnih izraza kao što je 'sutra' na osnovu trenutnog datuma datog u instrukcijama." }; // sr: Desired date...<y_bin_46>-MM-DD... AI can infer...
const serviceIdSchema: Schema = { type: SchemaType.STRING, description: "Jedinstveni ID frizerske usluge." }; // sr: Unique ID of the haircut service.
const slotSchema: Schema = { type: SchemaType.STRING, description: "Specifičan termin u HH:mm formatu (npr. '10:00'), dobijen iz dostupnih termina." }; // sr: Specific time slot... HH:mm format... obtained from available slots.


// --- Define ALL Tools (Using Standard Format, with Serbian descriptions) ---
// Define the individual function declarations first
const listServicesDeclaration: FunctionDeclaration = {
  name: "listAvailableServices",
  description: "Navodi sve dostupne frizerske usluge, uključujući naziv, opis, trajanje i cenu. Koristite ovu funkciju kada korisnik eksplicitno traži da vidi ili navede sve dostupne usluge.", // sr: Lists all available haircut services... Use this function when...
};

const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "checkAppointmentAvailability",
  description: "Proverava dostupne termine za određenu uslugu na određeni datum. Koristite ovo pre pokušaja zakazivanja termina.", // sr: Checks for available appointment time slots... Use this before attempting to book...
  parameters: {
    type: SchemaType.OBJECT,
    properties: { serviceName: serviceNameSchema, date: dateSchema },
    required: ["serviceName", "date"],
  },
};

const bookAppointmentDeclaration: FunctionDeclaration = {
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

// Array containing the function declarations
const allFunctionDeclarations: FunctionDeclaration[] = [
    listServicesDeclaration,
    checkAvailabilityDeclaration,
    bookAppointmentDeclaration,
];

// Standard tools structure using FunctionDeclarationsTool[]
const tools: FunctionDeclarationsTool[] = [
  { functionDeclarations: allFunctionDeclarations },
];


// --- Define System Instruction (Refined and in Serbian) ---
// Note: This will be dynamically generated within the POST handler


// Handles POST requests to /api/chat
export async function POST(request: Request) {
  console.log('POST /api/chat: Request received');

  if (!model) {
      console.error('POST /api/chat: AI model client not initialized (API key missing?), returning 500');
      return new NextResponse('AI model configuration error', { status: 500 });
  }

  const { userId } = await auth();
  console.log('POST /api/chat: Clerk userId:', userId);

  if (!userId) {
    console.log('POST /api/chat: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }


  try {
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
    });

    if (!dbUser) {
        console.error('POST /api/chat: Database user not found for clerkId:', userId);
        return new NextResponse('User not found in database', { status: 404 });
    }
    console.log(`POST /api/chat: Database userId: ${dbUser.id}`);

    // Find or create chat session
    let chatSession = await prisma.chatSession.findFirst({ // Renamed variable for clarity
        where: { userId: dbUser.id },
        // No need to include messages here initially
    });

    if (!chatSession) {
        console.log(`POST /api/chat: No chat session found for user ${dbUser.id}, creating new session.`);
        chatSession = await prisma.chatSession.create({ data: { userId: dbUser.id } });
        console.log(`POST /api/chat: New chat session created with ID: ${chatSession.id}`);
    } else {
        console.log(`POST /api/chat: Found chat session ${chatSession.id}.`);
    }
    const currentSessionId = chatSession.id; // Store session ID

    // Parse and validate user message
    const body = await request.json();
    const userMessageObject = body;
    console.log('POST /api/chat: User message object:', userMessageObject);
    if (!userMessageObject || typeof userMessageObject.text !== 'string' || !userMessageObject.id || !userMessageObject.timestamp || userMessageObject.sender !== 'user') {
      console.log('POST /api/chat: Invalid user message object format');
      return new NextResponse('Invalid user message object format', { status: 400 });
    }

    // --- Save User Message ---
    console.log('POST /api/chat: Saving user message to database...');
    const savedUserMessage = await prisma.chatMessage.create({ // Store saved message
        data: {
            id: userMessageObject.id,
            sessionId: currentSessionId, // Use stored session ID
            sender: 'user',
            message: userMessageObject.text,
            timestamp: new Date(userMessageObject.timestamp),
        }
    });
    console.log('POST /api/chat: User message saved.');

    // --- Prepare History for AI (Limit to last 10 messages) ---
    // Fetch the recent messages *after* saving the new user message
     const recentDbMessages = await prisma.chatMessage.findMany({
        where: { sessionId: currentSessionId },
        orderBy: { timestamp: 'desc' }, // Get newest first
        take: 10 // Limit to 10
     });
     // Reverse the array to get chronological order for the AI history
     const orderedRecentMessages = recentDbMessages.reverse();

    let history = orderedRecentMessages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model', // Map 'ai'/'admin' to 'model' for AI
        parts: [{ text: msg.message }],
    }));

    // *** FIX: Ensure history starts with 'user' role ***
    if (history.length > 0 && history[0].role !== 'user') {
        console.log('[History Fix] First message role is not "user", removing it.');
        history.shift(); // Remove the first element (which must be 'model')
    }
    // Note: The current user message is already included in orderedRecentMessages if it's within the last 10
    console.log(`POST /api/chat: Conversation history sent to AI: ${history.length} messages (limited, starts with user)`);


    // --- Interact with AI Model ---
    let aiResponseText = 'Žao mi je, došlo je do problema prilikom obrade vašeg zahteva.'; // sr: Sorry, I encountered an issue...
    let toolCalls: any[] | undefined;

    // *** Generate Refined Dynamic System Instruction in Serbian ***
    const currentDate = format(new Date(), 'yyyy-MM-dd'); // Get current date in<y_bin_46>-MM-DD format
    const dynamicSystemInstruction = `Vi ste ljubazan i koristan asistent za zakazivanje frizerskih termina u našem salonu. Započnite razgovor pozdravom.
Današnji datum je ${currentDate}.
Vaše mogućnosti, koristeći dostupne alate, su:
1.  Navesti sve dostupne usluge (alat 'listAvailableServices').
2.  Proveriti dostupne termine za određenu uslugu i datum (alat 'checkAppointmentAvailability').
3.  Zakazati termin za određenu uslugu, datum i vreme (alat 'bookAppointment').

Proaktivno ponudite ove opcije korisniku. Zaključite datume kao što je 'sutra' na osnovu današnjeg datuma (${currentDate}). Budite jasni oko informacija koje su vam potrebne (kao što su naziv usluge, datum, vreme).`; // sr: You are a friendly and helpful assistant... Today's date is... Your capabilities... Proactively offer... Infer dates... Be clear...
    console.log("POST /api/chat: Dynamic System Instruction (Serbian):", dynamicSystemInstruction);


    // Log the tools object being passed
    console.log('POST /api/chat: Tools being passed (standard format):', JSON.stringify(tools, null, 2));

    const chat = model.startChat({
        // Use Dynamic System Instruction
        systemInstruction: {
            role: "system", // Using 'system' role, adjust if SDK requires differently
            parts: [{ text: dynamicSystemInstruction }],
        },
        history: history, // Pass the potentially modified history
        // Use the standard tools format
        tools: tools,
        safetySettings: [ // Configure safety settings
             { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
         ],
    });

    try {
        // *** Send the user's *current* message text, not the whole history object ***
        // The history is set in startChat
        const result = await chat.sendMessage(userMessageObject.text);

        const response = result.response;
        toolCalls = response.functionCalls(); // Check for function calls

        if (toolCalls && toolCalls.length > 0) {
            console.log('POST /api/chat: AI requested tool calls:', toolCalls);

            // --- Get headers from the incoming request for forwarding ---
            const incomingRequestHeaders = new Headers(await headers());
            const cookieHeader = incomingRequestHeaders.get('Cookie');
            const fetchHeaders: HeadersInit = { 'Content-Type': 'application/json' };
             if (cookieHeader) {
                 fetchHeaders['Cookie'] = cookieHeader; // Add cookie if present
             }
             console.log(`[Header Forwarding] Cookie header ${cookieHeader ? 'found' : 'not found'}. Forwarding headers:`, fetchHeaders);


            // --- Execute Tool Calls ---
            const toolResultPromises = toolCalls.map(async (toolCall) => {
                const functionName = toolCall.name;
                const functionArgs = toolCall.args;
                console.log(`POST /api/chat: Executing tool: ${functionName} with args:`, functionArgs);

                let toolResponsePayload: any = { output: null, error: null };

                try {
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

                        // *** Normalize the input service name ***
                        const normalizedInputName = normalizeSerbianText(serviceName);
                        console.log(`[checkAvailability] Normalized input name: "${normalizedInputName}"`);

                        // Validate date
                        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !isValid(parseISO(dateString))) {
                            toolResponsePayload.error = `Nevažeći format datuma: '${dateString}'. Molimo koristite<y_bin_46>-MM-DD.`;
                            console.log(`[checkAvailability] Invalid date format.`);
                        } else {
                            // Fetch ALL services (less efficient, but avoids schema changes)
                            console.log(`[checkAvailability] Fetching all services for normalization check...`);
                            const allDbServices = await prisma.service.findMany({
                                select: { id: true, name: true }
                            });

                            // *** Filter services based on normalized names ***
                            const matchingServices = allDbServices.filter(dbService =>
                                normalizeSerbianText(dbService.name) === normalizedInputName
                            );
                            console.log(`[checkAvailability] Found ${matchingServices.length} services matching normalized name "${normalizedInputName}":`, matchingServices);

                            if (matchingServices.length === 0) {
                                toolResponsePayload.error = `Žao mi je, nisam mogao/la pronaći uslugu pod nazivom "${serviceName}" (ili sličnim). Možete me pitati da navedem sve usluge kako biste videli tačne nazive.`;
                                console.log(`[checkAvailability] Tool execution failed - Service not found by normalized name.`);
                            } else if (matchingServices.length > 1) {
                                // This could happen if "Sisanje" and "Šišanje" were both entered as separate services
                                const originalNames = matchingServices.map(s => s.name).join(', ');
                                toolResponsePayload.error = `Pronašao/la sam više usluga koje odgovaraju "${serviceName}" (nakon normalizacije): ${originalNames}. Molimo Vas da budete precizniji ili kontaktirate podršku.`;
                                console.log(`[checkAvailability] Tool execution failed - Ambiguous normalized service name.`);
                            } else {
                                // Exactly one service found
                                const service = matchingServices[0]; // Use the matched service
                                console.log(`[checkAvailability] Unique service found via normalization: ID=${service.id}, Original Name=${service.name}. Proceeding.`);
                                const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                                const availabilityApiUrl = `${SITE_URL}/api/appointments/available?serviceId=${service.id}&date=${dateString}`;
                                console.log(`[checkAvailability] Calling internal availability API: ${availabilityApiUrl}`);

                                // Use fetchHeaders with forwarded Cookie
                                const availabilityRes = await fetch(availabilityApiUrl, { headers: fetchHeaders });

                                if (!availabilityRes.ok) {
                                    const errorText = await availabilityRes.text();
                                    toolResponsePayload.error = `Neuspešna provera dostupnosti preko internog API-ja za ${service.name} (ID: ${service.id}) na ${dateString}. Status: ${availabilityRes.status} - ${errorText || '(Nema teksta greške)'}`;
                                    console.error(`[checkAvailability] Internal availability API call failed: ${availabilityRes.status}. URL: ${availabilityApiUrl}`);
                                } else {
                                    const availableSlots = await availabilityRes.json();
                                    toolResponsePayload.output = {
                                        serviceId: service.id,
                                        serviceName: service.name, // Return original name
                                        date: dateString,
                                        availableSlots: availableSlots
                                    };
                                    console.log(`[checkAvailability] Internal availability API call successful. Slots:`, availableSlots);
                                }
                            }
                        }
                    }
                    // --- Tool: bookAppointment ---
                    else if (functionName === 'bookAppointment') {
                         const { serviceName, date: dateString, slot } = functionArgs;
                         console.log(`[bookAppointment] Received serviceName: "${serviceName}", date: "${dateString}", slot: "${slot}"`);

                         // *** Normalize the input service name ***
                         const normalizedInputName = normalizeSerbianText(serviceName);
                         console.log(`[bookAppointment] Normalized input name: "${normalizedInputName}"`);

                         // Validate inputs
                         if (!serviceName || !dateString || !slot || !/^\d{4}-\d{2}-\d{2}$/.test(dateString) || !/^\d{2}:\d{2}$/.test(slot)) {
                            toolResponsePayload.error = `Zakazivanje neuspešno: Nedostaje ili je nevažeći naziv usluge, datum (YYYY-MM-DD), ili termin (HH:mm).`;
                            console.log(`[bookAppointment] Invalid input parameters.`);
                         } else {
                            // Fetch ALL services for normalization check
                            console.log(`[bookAppointment] Fetching all services for normalization check...`);
                             const allDbServices = await prisma.service.findMany({
                                select: { id: true, name: true }
                            });

                            // *** Filter services based on normalized names ***
                            const matchingServices = allDbServices.filter(dbService =>
                                normalizeSerbianText(dbService.name) === normalizedInputName
                            );
                            console.log(`[bookAppointment] Found ${matchingServices.length} services matching normalized name "${normalizedInputName}" for booking:`, matchingServices);


                            if (matchingServices.length === 0) {
                                toolResponsePayload.error = `Zakazivanje neuspešno: Žao mi je, nisam mogao/la pronaći uslugu pod nazivom "${serviceName}" (ili sličnim) za zakazivanje. Molimo proverite naziv ili me pitajte da navedem usluge.`;
                                console.log(`[bookAppointment] Tool execution failed - Service not found by normalized name.`);
                            } else if (matchingServices.length > 1) {
                                const originalNames = matchingServices.map(s => s.name).join(', ');
                                toolResponsePayload.error = `Zakazivanje neuspešno: Pronađeno je više usluga koje odgovaraju "${serviceName}" (nakon normalizacije): ${originalNames}. Molimo Vas da budete precizniji.`;
                                console.log(`[bookAppointment] Tool execution failed - Ambiguous normalized service name.`);
                            } else {
                                // Exactly one service found
                                const serviceToBook = matchingServices[0]; // Use the matched service
                                const serviceId = serviceToBook.id;
                                console.log(`[bookAppointment] Unique service found via normalization for booking: ID=${serviceId}, Original Name=${serviceToBook.name}. Proceeding.`);

                                // Call internal booking API
                                const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
                                const bookingApiUrl = `${SITE_URL}/api/appointments`;
                                console.log(`[bookAppointment] Calling internal booking API: ${bookingApiUrl}`);

                                // Use fetchHeaders with forwarded Cookie
                                const bookingRes = await fetch(bookingApiUrl, {
                                    method: 'POST',
                                    headers: fetchHeaders, // Use prepared headers
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

                // Return structured result for the AI
                return {
                    toolCallId: toolCall.id,
                    functionResponse: {
                        name: functionName,
                        response: toolResponsePayload,
                    },
                };
            }); // End map

            // Wait for all tools to finish
            const toolResults = await Promise.all(toolResultPromises);
            console.log('POST /api/chat: Tool results being sent back to AI:', JSON.stringify(toolResults, null, 2));

            // --- Send Tool Results back to AI ---
             const toolResultResponse = await chat.sendMessage(JSON.stringify(toolResults));


            const finalResponse = toolResultResponse.response;
            aiResponseText = finalResponse.text(); // Get final AI text
            console.log('POST /api/chat: Received final AI response after tool use:', aiResponseText);

        } else {
             // No tool call requested, get text response directly
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
        // Use a transaction to save the AI message and delete old messages atomically
        await prisma.$transaction(async (tx) => {
            // Save the AI message
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

            // Count total messages in the session
            const messageCount = await tx.chatMessage.count({
                where: { sessionId: currentSessionId },
            });
            console.log(`[DB Pruning] Total messages in session ${currentSessionId}: ${messageCount}`);

            const historyLimit = 20; // Define the limit

            // If count exceeds the limit, delete the oldest ones
            if (messageCount > historyLimit) {
                const messagesToDeleteCount = messageCount - historyLimit;
                console.log(`[DB Pruning] Message count exceeds limit (${historyLimit}). Need to delete ${messagesToDeleteCount} oldest messages.`);

                // Find the IDs of the oldest messages to delete
                const messagesToDelete = await tx.chatMessage.findMany({
                    where: { sessionId: currentSessionId },
                    orderBy: { timestamp: 'asc' }, // Oldest first
                    take: messagesToDeleteCount,
                    select: { id: true }, // Only select IDs
                });

                const idsToDelete = messagesToDelete.map(msg => msg.id);
                console.log('[DB Pruning] IDs to delete:', idsToDelete);

                // Delete the oldest messages
                if (idsToDelete.length > 0) {
                    const deleteResult = await tx.chatMessage.deleteMany({
                        where: {
                            id: { in: idsToDelete },
                            sessionId: currentSessionId, // Ensure we only delete from the correct session
                        },
                    });
                    console.log(`[DB Pruning] Deleted ${deleteResult.count} messages.`);
                } else {
                     console.log('[DB Pruning] No message IDs found to delete (this should not happen if count > limit).');
                }
            } else {
                 console.log(`[DB Pruning] Message count (${messageCount}) is within the limit (${historyLimit}). No deletion needed.`);
            }
        }); // End transaction
         console.log('[DB Pruning] Transaction completed successfully.');

    } catch (pruneError) {
         // Log error during pruning but don't block returning the AI response
         console.error('Error during database history pruning:', pruneError);
         // Optionally, you could add logic here to handle the error,
         // but typically you'd still want the user to get the AI response.
    }

    // Return AI response to frontend
    console.log('POST /api/chat: Returning AI ChatMessage object:', aiResponseMessage);
    return NextResponse.json(aiResponseMessage, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/chat handler:', error);
    return new NextResponse(`Interna greška servera: ${error.message || 'Nepoznata greška'}`, { status: 500 });
  }
}
