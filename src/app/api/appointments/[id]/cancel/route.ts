import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    console.log('PUT /api/appointments/[id]/cancel: Korisnik nije autentifikovan ili nije pronađen u bazi, vraćam 401');
    return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
  }

  let appointmentId: string;
  try {
    const routeParams = await context.params;
    appointmentId = routeParams.id;
  } catch (paramError) {
    console.error('PUT /api/appointments/[id]/cancel: Greška pri pristupu parametrima rute:', paramError);
    return NextResponse.json({ message: 'Interna greška servera prilikom čitanja parametara.' }, { status: 500 });
  }
  
  if (!appointmentId) {
    console.log('PUT /api/appointments/cancel: Nedostaje ID termina iz URL-a, vraćam 400');
    return NextResponse.json({ message: 'Nevažeći ID termina u URL-u.' }, { status: 400 });
  }
  try {

    const updatedAppointment = await prisma.appointment.update({
      where: {
          id: appointmentId,
          userId: user.id, 
          status: {         
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]
          }
      },
      data: {
        status: AppointmentStatus.CANCELLED_BY_USER,
        // Opciono: dodati vreme otkazivanja ili napomenu
        // notes: `Otkazao korisnik dana ${new Date().toLocaleString('sr-RS')}. Prethodne napomene: ${existingAppointment.notes || ''}`
      },
    });

    console.log(`Termin ${appointmentId} uspešno otkazan od strane korisnika ${user.id}.`);

    // TODO: Optional: Trigger notification (e.g., email) to admin/vendor about the cancellation

    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error: unknown) {
    console.error(`Greška prilikom otkazivanja termina sa ID ${appointmentId} za korisnika ${user.id}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record to update not found (or where condition not met)
        if (error.code === 'P2025') {
            console.log(`PUT /api/appointments/${appointmentId}/cancel: Termin nije pronađen, ne pripada korisniku, ili nije u statusu koji se može otkazati.`);
            return NextResponse.json({ message: 'Termin nije pronađen, ne pripada Vama, ili se ne može otkazati.' }, { status: 404 });
        }
    }
    console.log(`PUT /api/appointments/${appointmentId}/cancel: Neočekivana interna greška servera prilikom otkazivanja.`);
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}
