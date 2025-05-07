// src/app/api/admin/chat/sessions/route.ts

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { isAdminUser } from '@/lib/authUtils'; // Import the centralized isAdminUser function

// Handles GET requests to /api/admin/chat/sessions
// Fetches a list of all chat sessions for the admin panel.
export async function GET(request: Request) {
  console.log('GET /api/admin/chat/sessions: Request received');

  // 1. Authentication & Authorization
  const { userId } = await auth();
  console.log('GET /api/admin/chat/sessions: Clerk userId:', userId);

  if (!userId) {
    console.log('GET /api/admin/chat/sessions: User not authenticated, returning 401');
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    console.log('GET /api/admin/chat/sessions: User is not admin, returning 403');
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log('GET /api/admin/chat/sessions: User is admin. Proceeding to fetch sessions.');

  // 2. Data Fetching
  try {
    const chatSessions = await prisma.chatSession.findMany({
      orderBy: {
        // Order sessions by the timestamp of their latest message (descending)
        // This requires fetching the latest message.
        // Alternatively, order by session updatedAt or createdAt if preferred.
         messages: {
           _count: 'desc', // Fallback ordering if no messages exist? Or use updatedAt
         }
         // updatedAt: 'desc', // Simpler alternative ordering
      },
      include: {
        // Include user details for display
        user: {
          select: {
            id: true, // Include user DB id if needed
            name: true,
            email: true,
          },
        },
        // Include the latest message for context/preview
        messages: {
          orderBy: {
            timestamp: 'desc', // Get the most recent message first
          },
          take: 1, // Only take the latest one
          select: {
            message: true,
            timestamp: true,
            sender: true,
          }
        },
        // Optionally include a count of messages
        _count: {
          select: { messages: true },
        },
      },
    });

    console.log(`GET /api/admin/chat/sessions: Fetched ${chatSessions.length} sessions.`);

    // 3. Response
    // We might want to format the response slightly for the frontend
    const formattedSessions = chatSessions.map(session => ({
        sessionId: session.id,
        userId: session.user?.id, // User's database ID
        userName: session.user?.name ?? 'Unknown User',
        userEmail: session.user?.email ?? 'No Email',
        latestMessage: session.messages[0] ?? null, // Get the single message included (or null)
        messageCount: session._count.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt, // Useful for sorting potentially
    }));


    return NextResponse.json(formattedSessions, { status: 200 });

  } catch (error) {
    console.error('GET /api/admin/chat/sessions: Error fetching chat sessions:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
