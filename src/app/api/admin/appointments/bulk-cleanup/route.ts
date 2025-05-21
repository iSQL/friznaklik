import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { subDays } from 'date-fns';

async function POST_handler() {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    let targetVendorId: string | undefined;

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vlasnik salona nema povezan salon.' }, { status: 403 });
      }
      targetVendorId = user.ownedVendorId;
    } else if (user.role === UserRole.SUPER_ADMIN) {
      // For SUPER_ADMIN, if no vendorId is provided in the body, it will clean up for ALL vendors.
      // This could be dangerous. Consider requiring vendorId or specific confirmation.
      // For now, let's assume SUPER_ADMIN can clean up all if no vendorId is passed.
      // If you want to restrict SUPER_ADMIN to a specific vendor via body:
      // const body = await req.json().catch(() => null);
      // targetVendorId = body?.vendorId;
      // if (body && !targetVendorId) { // if body exists but no vendorId
      //    return NextResponse.json({ message: 'Za SUPER_ADMIN-a, ID salona je opcioni parametar za čišćenje određenog salona.' }, { status: 400 });
      // }
      console.warn("SUPER_ADMIN pokreće čišćenje. Ako vendorId nije specificiran, odnosi se na sve salone.");
    } else {
        return NextResponse.json({ message: 'Nemate dozvolu za ovu akciju.' }, { status: 403 });
    }

    const thirtyDaysAgo = subDays(new Date(), 30);

    const whereConditions: Prisma.AppointmentWhereInput[] = [
      { status: AppointmentStatus.REJECTED },
      { status: AppointmentStatus.CANCELLED_BY_USER },
      { status: AppointmentStatus.CANCELLED_BY_VENDOR },
      { status: AppointmentStatus.NO_SHOW },
      { status: AppointmentStatus.COMPLETED, endTime: { lt: thirtyDaysAgo } },
    ];

    const finalWhereClause: Prisma.AppointmentWhereInput = {
      OR: whereConditions,
    };

    if (targetVendorId) {
      finalWhereClause.vendorId = targetVendorId;
    }

    const appointmentsToDelete = await prisma.appointment.findMany({
        where: finalWhereClause,
        select: { id: true } 
    });

    if (appointmentsToDelete.length === 0) {
        return NextResponse.json({ message: 'Nema termina koji odgovaraju kriterijumima za čišćenje.', deletedCount: 0 }, { status: 200 });
    }

    const deleteResult = await prisma.appointment.deleteMany({
      where: {
        id: { in: appointmentsToDelete.map(app => app.id) }
      },
    });

    return NextResponse.json({
      message: `Uspešno obrisano ${deleteResult.count} termin(a).`,
      deletedCount: deleteResult.count,
    }, { status: 200 });

  } catch (error) {
    console.error('Greška pri čišćenju termina:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interna greška servera.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

export const POST = withRoleProtection(POST_handler, [UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN]);
