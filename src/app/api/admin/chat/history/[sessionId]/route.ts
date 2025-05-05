// src/app/api/admin/chat/history/[sessionId]/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

// Helper function to check if the authenticated user is an admin
// TODO: Consider moving this to a shared utility file (e.g., /lib/authUtils.ts)
async function isAdminUser(userId: string): Promise<boolean> {
  console.log('[isAdminUser] Checking role for userId:', userId);
  if (!userId) return false;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });
    console.log('[isAdminUser] DB user found:', dbUser);
    return dbUser?.role === 'admin';
  } catch (error) {
    console.error('[isAdminUser] Error fetching user role:', error);
    return false;
  }
}

// Handles GET requests to /api/admin/chat/history/:sessionId
// Fetches the full message history for a specific chat session.
export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } } // Destructure params to get sessionId
) {
  const sessionId = params.sessionId; // Get sessionId from the route parameter
  console.log(`GET /api/admin/chat/history/${sessionId}: Request received`);

  // 1. Authentication & Authorization
  const { userId } = await auth(); // Use await for auth()
  console.log(`GET /api/admin/chat/history/${sessionId}: Clerk userId:`, userId);

  if (!userId) {
    console.log(`GET /api/admin/chat/history/${sessionId}: User not authenticated, returning 401`);
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.log(`GET /api/admin/chat/history/${sessionId}: User is not admin, returning 403`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log(`GET /api/admin/chat/history/${sessionId}: User is admin. Proceeding to fetch history.`);

  // 2. Validate sessionId
  if (!sessionId) {
      console.log(`GET /api/admin/chat/history/${sessionId}: Missing sessionId parameter`);
      return new NextResponse('Bad Request: Missing sessionId', { status: 400 });
  }

  // 3. Data Fetching
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

    // 4. Response
    // Return the full session object including the user and messages array
    return NextResponse.json(chatSessionWithHistory, { status: 200 });

  } catch (error) {
    console.error(`GET /api/admin/chat/history/${sessionId}: Error fetching chat history:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
