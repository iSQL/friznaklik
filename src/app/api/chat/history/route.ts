import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import {  Prisma } from '@prisma/client'; 
import { SenderType } from '@/lib/types/prisma-enums'; 

interface FrontendChatMessage {
  id: string;
  text: string;
  sender: SenderType;
  senderId: string | null; 
  timestamp: Date;
}

export async function GET() {
  console.log('GET /api/chat/history: Zahtev primljen');

  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    console.log('GET /api/chat/history: Korisnik nije autentifikovan, vraćam 401');
    return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
  }

  try {
   
    let chatSession = await prisma.chatSession.findFirst({
      where: { userId: user.id }, 
    });

    if (!chatSession) {
      console.log(`GET /api/chat/history: Nije pronađena čet sesija za korisnika (Prisma ID) ${user.id}, kreiram novu.`);
      
      const DEFAULT_VENDOR_ID_FOR_CHAT = process.env.CHAT_DEFAULT_VENDOR_ID || "cmao5ay1d0001hm2kji2qrltf"; // ToDo: Get curently selected vendor ID from the context or session

      chatSession = await prisma.chatSession.create({
        data: {
          userId: user.id, 
          vendorId: DEFAULT_VENDOR_ID_FOR_CHAT, 
        },
      });
      console.log(`GET /api/chat/history: Nova čet sesija kreirana sa ID: ${chatSession.id} za korisnika (Prisma ID) ${user.id}`);
      return NextResponse.json([], { status: 200 });
    }

    const messagesFromDb = await prisma.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        message: true,
        senderType: true,
        senderId: true, 
        timestamp: true,
      }
    });

    const historyMessages: FrontendChatMessage[] = messagesFromDb.map(msg => ({
      id: msg.id,
      text: msg.message,
      sender: msg.senderType as SenderType,
      senderId: msg.senderId,
      timestamp: msg.timestamp,
    }));

    return NextResponse.json(historyMessages, { status: 200 });

  } catch (error) {
    console.error('Greška prilikom dobavljanja istorije četa:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json({ message: 'Greška u komunikaciji sa bazom podataka.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja istorije četa.' }, { status: 500 });
  }
}