import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { AppointmentStatus, Prisma } 
from '@prisma/client';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { sendEmail } from '@/lib/emailService'; // Import email service
import { format } from 'date-fns'; // For formatting dates in email
import { srLatn } from 'date-fns/locale'; // For Serbian date formatting

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
  const bookingUser: AuthenticatedUser | null = await getCurrentUser(); // User cancelling the appointment

  if (!bookingUser) {
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
    const appointmentToCancel = await prisma.appointment.findUnique({
      where: {
        id: appointmentId,
        userId: bookingUser.id, // Ensure the user owns this appointment
      },
      include: {
        service: { select: { name: true } },
        vendor: { select: { name: true, owner: { select: { email: true, firstName: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } }, // For logging or if needed
        worker: { select: { name: true } },
      },
    });

    if (!appointmentToCancel) {
      console.log(`PUT /api/appointments/${appointmentId}/cancel: Termin nije pronađen ili ne pripada korisniku ${bookingUser.id}.`);
      return NextResponse.json({ message: 'Termin nije pronađen ili nemate dozvolu da ga otkažete.' }, { status: 404 });
    }

    if (appointmentToCancel.status !== AppointmentStatus.PENDING && appointmentToCancel.status !== AppointmentStatus.CONFIRMED) {
      console.log(`PUT /api/appointments/${appointmentId}/cancel: Termin se ne može otkazati. Trenutni status: ${appointmentToCancel.status}.`);
      return NextResponse.json({ message: `Termin se ne može otkazati. Trenutni status: ${appointmentToCancel.status}.` }, { status: 409 });
    }

    // Additional check: Prevent cancellation if it's too close to the appointment time (e.g., within 24 hours)
    // This logic can be adjusted based on business rules
    // const now = new Date();
    // const appointmentStartTime = new Date(appointmentToCancel.startTime);
    // if (differenceInHours(appointmentStartTime, now) < 24) {
    //   return NextResponse.json({ message: 'Termin se ne može otkazati manje od 24 sata unapred.' }, { status: 403 });
    // }

    const updatedAppointment = await prisma.appointment.update({
      where: {
          id: appointmentId,
          // userId: bookingUser.id, // Already implicitly checked by fetching appointmentToCancel
      },
      data: {
        status: AppointmentStatus.CANCELLED_BY_USER,
        // Optionally add notes about the cancellation
        // notes: `Otkazao korisnik ${bookingUser.email || bookingUser.id} dana ${format(new Date(), "dd.MM.yyyy HH:mm", { locale: srLatn })}. Originalne napomene: ${appointmentToCancel.notes || ''}`.trim(),
      },
      // Re-include data needed for notifications
      include: {
        service: { select: { name: true } },
        vendor: { select: { name: true, owner: { select: { email: true, firstName: true } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        worker: { select: { name: true } },
      },
    });

    console.log(`Termin ${appointmentId} uspešno otkazan od strane korisnika ${bookingUser.id}.`);

    // --- Send Notification Email to Vendor Owner about User's Cancellation ---
    if (updatedAppointment.vendor?.owner?.email) {
      const vendorOwner = updatedAppointment.vendor.owner;
      const customer = updatedAppointment.user; // This is the user who cancelled
      const formattedStartTime = format(new Date(updatedAppointment.startTime), "eeee, dd. MMMM yyyy. 'u' HH:mm 'h'", { locale: srLatn });
      const adminAppointmentsLink = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/appointments`;

      const emailSubject = `Termin Otkazan od Strane Korisnika: ${updatedAppointment.service.name} u ${updatedAppointment.vendor.name}`;
      const emailHtmlContent = `
        <p>Poštovani ${vendorOwner.firstName || 'vlasniče salona'},</p>
        <p>Korisnik <strong>${customer.firstName || ''} ${customer.lastName || ''} (${customer.email})</strong> je otkazao svoj termin.</p>
        <ul style="list-style-type: none; padding: 0;">
          <li style="margin-bottom: 5px;"><strong>Salon:</strong> ${updatedAppointment.vendor.name}</li>
          <li style="margin-bottom: 5px;"><strong>Usluga:</strong> ${updatedAppointment.service.name}</li>
          <li style="margin-bottom: 5px;"><strong>Prvobitno vreme:</strong> ${formattedStartTime}</li>
          ${updatedAppointment.worker?.name ? `<li style="margin-bottom: 5px;"><strong>Radnik:</strong> ${updatedAppointment.worker.name}</li>` : ''}
          ${updatedAppointment.notes ? `<li style="margin-bottom: 5px;"><strong>Napomena korisnika (originalna):</strong> ${appointmentToCancel.notes}</li>` : ''}
        </ul>
        <p style="margin-top: 15px;">Ovaj termin je sada označen kao "Otkazao korisnik" u Vašem sistemu.</p>
        <p>Možete videti ažuriranu listu termina u Vašem administratorskom panelu:</p>
        <p><a href="${adminAppointmentsLink}" style="color: #007bff; text-decoration: none;">Idi na Admin Panel - Termini</a></p>
        <br>
        <p>S poštovanjem,<br>FrizNaKlik Tim</p>
      `;

      // Fire-and-forget email sending
      sendEmail({
        to: vendorOwner.email,
        subject: emailSubject,
        html: emailHtmlContent,
      }).then(() => {
        console.log(`[BACKGROUND] Email o otkazivanju termina ${updatedAppointment.id} poslat vlasniku salona ${vendorOwner.email}.`);
      }).catch(emailError => {
        console.error(`[BACKGROUND] Greška pri slanju emaila vlasniku salona ${vendorOwner.email} o otkazivanju termina ${updatedAppointment.id}:`, emailError);
      });
    } else {
      console.warn(`Email vlasnika salona nije pronađen za salon ID: ${updatedAppointment.vendorId}. Notifikacija o otkazivanju od strane korisnika nije poslata.`);
    }
    // --- End Send Notification Email ---


    return NextResponse.json(updatedAppointment, { status: 200 });

  } catch (error: unknown) {
    console.error(`Greška prilikom otkazivanja termina sa ID ${appointmentId} za korisnika ${bookingUser.id}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
            console.log(`PUT /api/appointments/${appointmentId}/cancel: Termin nije pronađen, ne pripada korisniku, ili nije u statusu koji se može otkazati.`);
            return NextResponse.json({ message: 'Termin nije pronađen, ne pripada Vama, ili se ne može otkazati.' }, { status: 404 });
        }
    }
    console.log(`PUT /api/appointments/${appointmentId}/cancel: Neočekivana interna greška servera prilikom otkazivanja.`);
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}
