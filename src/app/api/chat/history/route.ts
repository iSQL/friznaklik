
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import { SenderType } from '@prisma/client'; 

interface FrontendChatMessage {
  id: string;
  text: string; 
  sender: SenderType; 
  senderId: string;  
  timestamp: Date;
}

export async function GET(request: NextRequest) {
  console.log('GET /api/chat/history: Zahtev primljen');

  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    console.log('GET /api/chat/history: Korisnik nije autentifikovan, vraćam 401');
    return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
  }

  try {
    let chatSession = await prisma.chatSession.findFirst({
      where: { userId: user.clerkId },
    });

    if (!chatSession) {
      console.log(`GET /api/chat/history: Nije pronađena čet sesija za korisnika ${user.id}, kreiram novu.`);
      chatSession = await prisma.chatSession.create({
        data: {
          userId: user.clerkId,
          // vendorId se može postaviti ako je čet uvek vezan za podrazumevani salon za nove korisnike,
          // ili ako korisnik bira salon pre započinjanja četa. Za sada ostavljamo null.
          // vendorId: "default_vendor_id_if_applicable", 
          // TODO: Korisnik bira salon pre započinjanja četa, pa ćemo ovde postaviti vendorId
          // vendorId: user.selectedVendorId ili neka vrednost koja se odabere na frontend-u
        },
      });
      console.log(`GET /api/chat/history: Nova čet sesija kreirana sa ID: ${chatSession.id}`);
      return NextResponse.json([], { status: 200 });
    }

    const messagesFromDb = await prisma.chatMessage.findMany({
      where: { sessionId: chatSession.id },
      orderBy: { timestamp: 'asc' },
    });

    console.log(`GET /api/chat/history: Pronađena čet sesija ${chatSession.id} sa ${messagesFromDb.length} poruka.`);

    const historyMessages: FrontendChatMessage[] = messagesFromDb.map(msg => ({
      id: msg.id,
      text: msg.message,         // Mapiramo 'message' iz baze u 'text' za frontend
      sender: msg.senderType,    // Koristimo 'senderType' iz baze kao 'sender' za frontend
      senderId: msg.senderId,    // Prosleđujemo senderId
      timestamp: msg.timestamp,
    }));

    return NextResponse.json(historyMessages, { status: 200 });

  } catch (error) {
    console.error('Greška prilikom dobavljanja istorije četa:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja istorije četa.' }, { status: 500 });
  }
}
