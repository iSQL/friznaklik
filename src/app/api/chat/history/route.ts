// src/app/api/chat/history/route.ts

import { auth } from '@clerk/nextjs/server'; // Import auth helper for server-side authentication
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Handles GET requests to /api/chat/history
// This will fetch the chat history for the currently logged-in user.
export async function GET() {
  console.log('GET /api/chat/history: Request received'); // Debug log

  // Check authentication status using Clerk
  const { userId } = await auth(); // User must be logged in to fetch their chat history
   console.log('GET /api/chat/history: Clerk userId:', userId); // Debug log


  if (!userId) {
    console.log('GET /api/chat/history: User not authenticated, returning 401'); // Debug log
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Find the database user ID based on the Clerk userId
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true }, // Only fetch the database user ID
    });

    if (!dbUser) {
        console.error('GET /api/chat/history: Database user not found for clerkId:', userId); // Debug log
         // This indicates a mismatch between Clerk and your DB - webhook is crucial
        return new NextResponse('User not found in database', { status: 404 });
    }

    console.log(`GET /api/chat/history: Database userId: ${dbUser.id}`); // Debug log

    // Find the user's chat session using findFirst (more suitable for non-ID unique fields)
    let chatSession = await prisma.chatSession.findFirst({
        where: { userId: dbUser.id }, // Use userId in the where clause
    });

    // If no session exists for this user, create a new one
    if (!chatSession) {
        console.log(`GET /api/chat/history: No chat session found for user ${dbUser.id}, creating new session.`); // Debug log
        chatSession = await prisma.chatSession.create({
            data: { userId: dbUser.id },
            // Removed include here, will fetch messages in a separate step
        });
         console.log(`GET /api/chat/history: New chat session created with ID: ${chatSession.id}`); // Debug log
    }

    // Now fetch the session again, explicitly including the messages
    const chatSessionWithMessages = await prisma.chatSession.findUnique({
        where: { id: chatSession.id }, // Use the session ID to find unique
        include: { messages: { orderBy: { timestamp: 'asc' } } }, // Include messages, ordered by timestamp
    });

     // Ensure we got the session with messages (should not be null after findUnique by ID)
     if (!chatSessionWithMessages) {
         console.error(`GET /api/chat/history: Failed to fetch chat session with messages after creation/finding.`); // Debug log
         return new NextResponse('Internal Server Error: Could not retrieve chat session messages.', { status: 500 });
     }

    console.log(`GET /api/chat/history: Found chat session ${chatSessionWithMessages.id} with ${chatSessionWithMessages.messages.length} messages.`); // Debug log


    // Map database messages to the frontend ChatMessage interface format (adjusting 'message' to 'text')
    const historyMessages = chatSessionWithMessages.messages.map(msg => ({
        id: msg.id,
        text: msg.message, // Map database 'message' field to frontend 'text'
        sender: msg.sender,
        timestamp: msg.timestamp,
        // isReadByAdmin is not needed on the frontend
    }));


    // Return the chat history as a JSON response
    return NextResponse.json(historyMessages, { status: 200 });

  } catch (error) {
    console.error('Error fetching chat history:', error); // Debug log
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Note: POST requests for new messages are handled in /api/chat/route.ts
