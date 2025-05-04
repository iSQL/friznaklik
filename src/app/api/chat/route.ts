// src/app/api/chat/route.ts

import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
// We'll add Clerk auth and Prisma imports later if we decide to
// require authentication for chat or save history in this handler.

// Import the SDK for Google AI (Gemini)
import { GoogleGenerativeAI } from '@google/generative-ai';


// Get your Google AI API key from environment variables
// Ensure you have GOOGLE_API_KEY set in your .env file
const aiApiKey = process.env.GOOGLE_API_KEY;


// Ensure the API key is set
if (!aiApiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set.');
  // In a real application, you might want to return an error response if the key is missing
  // throw new Error('GOOGLE_API_KEY environment variable is not set.');
}

// Initialize the Google AI model client
// Use aiApiKey! because we check above to ensure it's not undefined
const genAI = aiApiKey ? new GoogleGenerativeAI(aiApiKey) : null; // Initialize only if key exists
// Specify the Gemini Flash model
// 'gemini-1.0-flash' is a common model ID for the Flash model
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite'}) : null;


// Handles POST requests to /api/chat
// Receives user messages and interacts with an AI model.
export async function POST(request: Request) {
  console.log('POST /api/chat: Request received'); // Debug log

  // If the AI model client is not initialized (due to missing API key), return an error
  if (!model) { // Check if the model was successfully initialized
      console.error('POST /api/chat: AI model client not initialized (API key missing?), returning 500');
      return new NextResponse('AI model configuration error', { status: 500 });
  }


  try {
    // Parse the request body to get the user's message
    const body = await request.json();
    const userMessage = body.message;

    console.log('POST /api/chat: User message:', userMessage); // Debug log

    // Basic validation for the message
    if (!userMessage || typeof userMessage !== 'string') {
      console.log('POST /api/chat: Invalid message format'); // Debug log
      return new NextResponse('Invalid message format', { status: 400 });
    }

    // --- Interact with the AI Model (Gemini Flash) ---
    let aiResponseText = 'Sorry, I could not get a response from the AI.'; // Default error message

    try {
        // Send the userMessage to the Gemini Flash model
        const result = await model.generateContent(userMessage);
        const response = await result.response;
        aiResponseText = response.text();

        console.log('POST /api/chat: Received AI response:', aiResponseText); // Debug log

    } catch (aiError) {
        console.error('Error interacting with Google AI model:', aiError); // Log AI interaction errors
        // Keep the default error message or set a specific AI error message
        aiResponseText = 'There was an error communicating with the AI model.'; // More specific error for the user
    }
    // --- End of AI Model Interaction ---


    // Return the AI's response as a JSON response
    // The frontend expects a JSON object with a 'reply' property.
    return NextResponse.json({ reply: aiResponseText }, { status: 200 });

  } catch (error) {
    console.error('Error in /api/chat handler:', error); // Log general handler errors
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Note: GET requests might be used later for fetching chat history.
