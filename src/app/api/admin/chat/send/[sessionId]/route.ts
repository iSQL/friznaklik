import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { SenderType, ChatMessage } from '@prisma/client'; 
import { UserRole } from '@/lib/types/prisma-enums'; 
import { z } from 'zod';

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}
const sendMessageSchema = z.object({
  message: z.string().min(1, 'Poruka ne može biti prazna.'),
});

async function POST_handler(request: NextRequest, context: RouteContext) {
  const adminUser: AuthenticatedUser | null = await getCurrentUser();

  if (!adminUser) {
    return NextResponse.json({ message: 'Niste autorizovani ili korisnik nije pronađen.' }, { status: 401 });
  }

  const routeParams = await context.params; 
  const { sessionId } = routeParams;

  if (!sessionId) {
    return NextResponse.json({ message: 'ID sesije je obavezan.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parseResult = sendMessageSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos za poruku.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { message } = parseResult.data;

    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!chatSession) {
      return NextResponse.json({ message: `Čet sesija sa ID ${sessionId} nije pronađena.` }, { status: 404 });
    }

  
    const newChatMessage: ChatMessage = await prisma.chatMessage.create({
      data: {
        sessionId: sessionId,
        senderId: adminUser.id,
        senderType: SenderType.ADMIN,
        message: message,
        // timestamp se podrazumevano postavlja
        // isRead će biti false po defaultu za primaoca
      },
    });
    
    await prisma.chatSession.update({
        where: { id: sessionId },
        data: { 
            updatedAt: new Date(),
            adminId: adminUser.id 
        }
    });

    // TODO: Implementirati mehanizam za slanje notifikacije korisniku (npr. Pusher, WebSockets)

    return NextResponse.json(newChatMessage, { status: 201 });

  } catch (error: unknown) {
    console.error(`Greška prilikom slanja poruke u sesiju ${sessionId}:`, error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos za poruku.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom slanja poruke.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(POST_handler, [
  UserRole.SUPER_ADMIN,
  UserRole.VENDOR_OWNER,
]);
