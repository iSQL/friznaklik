import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client'; 
import { UserRole } from '@/lib/types/prisma-enums'; 

async function GET_handler() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: 'Niste autorizovani ili korisnik nije pronađen.' }, { status: 401 });
  }

  try {
    const whereClause: Prisma.ChatSessionWhereInput = {};

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        console.warn(`VENDOR_OWNER ${user.id} nema povezan ownedVendorId.`);
        return NextResponse.json({ sessions: [], message: 'Vlasnik salona nema povezan salon.' }, { status: 200 }); // Ili 403
      }
      whereClause.vendorId = user.ownedVendorId;
    }
    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: 'desc', 
      },
      include: {
        user: { 
            select: { firstName: true, lastName: true, email: true, profileImageUrl: true }
        },
        _count: {
            select: { messages: true } 
        }
       
      },
      // Dodati paginaciju ako je potrebno
      // take: 20,
      // skip: 0, 
    });

    return NextResponse.json(sessions);

  } catch (error) {
    console.error('Greška prilikom preuzimanja čet sesija:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom preuzimanja čet sesija.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [
  UserRole.SUPER_ADMIN,
  UserRole.VENDOR_OWNER,
]);
