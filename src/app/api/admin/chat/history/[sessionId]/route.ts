import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  
  withRoleProtection,
  
} from '@/lib/authUtils';
import { UserRole } from '@prisma/client'; 

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

async function GET_handler(request: NextRequest, context: RouteContext) {
  const routeParams = await context.params;
  const { sessionId } = routeParams;

  if (!sessionId) {
    return NextResponse.json({ message: 'ID sesije je obavezan.' }, { status: 400 });
  }

  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        sessionId: sessionId,
      },
      orderBy: {
        timestamp: 'asc',
      },
      // Opciono: informacije o pošiljaocu ako je potrebno
      // include: {
      //   // Ako senderId referencira User tabelu i želite da prikažete ime pošiljaoca
      //   // sender: { select: { firstName: true, lastName: true, email: true }}
      // }
    });

    
    if (messages.length === 0) {
      return NextResponse.json({ message: 'Nema poruka za ovu sesiju.' }, { status: 404 });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error(`Greška prilikom preuzimanja istorije četa za sesiju ${sessionId}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom preuzimanja istorije četa.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [
  UserRole.SUPER_ADMIN,
  UserRole.VENDOR_OWNER,
]);
