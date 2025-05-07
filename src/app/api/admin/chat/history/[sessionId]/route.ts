// src/app/api/admin/chat/history/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

// Handles GET requests to /api/admin/chat/history/:sessionId
// Fetches the full message history for a specific chat session.
export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } } // Destructure 'sessionId' from params
) {

  // 1. Authentication
  const { userId } = await auth(); 

  if (!userId) {
    console.log(`GET /api/admin/chat/history/[sessionId]: User not authenticated, returning 401`);
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Get sessionId from params
  const sessionId = params.sessionId;

  if (!sessionId) {
    // This case should ideally not be hit if the route is matched correctly by Next.js.
    console.log(`GET /api/admin/chat/history/[sessionId]: Session ID is missing from params`);
    return new NextResponse('Bad Request: Invalid Session ID in URL', { status: 400 });
  }

  console.log(`GET /api/admin/chat/history/${sessionId}: Request received for ID`);
  console.log(`GET /api/admin/chat/history/${sessionId}: Clerk userId:`, userId);

  // 3. Authorization (Admin Check)
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.log(`GET /api/admin/chat/history/${sessionId}: User is not admin, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log(`GET /api/admin/chat/history/${sessionId}: User is admin. Proceeding to fetch history.`);


  // 4. Data Fetching
  try {
    const chatSessionWithHistory = await prisma.chatSession.findUnique({
      where: {
        id: sessionId, // Find the session by its ID
      },
      include: {
        // Include the associated user details
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // Include all messages for this session, ordered chronologically
        messages: {
          orderBy: {
            timestamp: 'asc', // Oldest first for chronological display
          },
          // No need for take or select here, we want all message fields
        },
      },
    });

    // Check if the session was found
    if (!chatSessionWithHistory) {
      console.log(`GET /api/admin/chat/history/${sessionId}: Chat session not found`);
      return new NextResponse('Not Found: Chat session not found', { status: 404 });
    }

    console.log(`GET /api/admin/chat/history/${sessionId}: Fetched session with ${chatSessionWithHistory.messages.length} messages.`);

    // 5. Response
    // Return the full session object including the user and messages array
    return NextResponse.json(chatSessionWithHistory, { status: 200 });

  } catch (error) {
    console.error(`GET /api/admin/chat/history/${sessionId}: Error fetching chat history:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
