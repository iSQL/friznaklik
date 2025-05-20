// src/app/api/admin/appointments/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { z } from 'zod';
import { sendEmail } from '@/lib/emailService'; // Import email service
import { format } from 'date-fns'; // For formatting dates in email
import { srLatn } from 'date-fns/locale'; // For Serbian date formatting

const rejectCancelAppointmentSchema = z.object({
  rejectionReason: z.string().min(1, "Razlog ne može biti prazan ako je naveden.").optional(),
});

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

async function POST_handler(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const adminUser: AuthenticatedUser | null = await getCurrentUser(); // Admin performing the action
    if (!adminUser) {
      return NextResponse.json({ message: 'Neautorizovan pristup ili korisnik nije pronađen.' }, { status: 401 });
    }

    const { id: appointmentId } = await context.params;

    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    let reason: string | undefined;
    let requestBody;
    try {
      requestBody = await req.json();
      const parseResult = rejectCancelAppointmentSchema.safeParse(requestBody);
      if (!parseResult.success) {
        return NextResponse.json({ message: 'Nevalidan unos za razlog.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
      }
      reason = parseResult.data.rejectionReason;
    } catch (e) {
      console.error('Greška pri parsiranju zahteva:', e);
      console.log('Telo zahteva za odbijanje/otkazivanje je prazno ili nije validan JSON.');
    }

    const existingAppointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            notes: true,
            status: true,
            vendorId: true,
            startTime: true, // For email
            service: { select: { name: true } }, // For email
            vendor: { select: { name: true } }, // For email
            user: { select: { email: true, firstName: true, lastName: true } }, // Customer details for email
        }
    });

    if (!existingAppointment) {
        return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }

    // Authorization check for VENDOR_OWNER
    if (adminUser.role === UserRole.VENDOR_OWNER) {
      if (!adminUser.ownedVendorId || existingAppointment.vendorId !== adminUser.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da menjate ovaj termin.' }, { status: 403 });
      }
    }
    // SUPER_ADMIN can reject/cancel any appointment

    let newStatus: AppointmentStatus;
    let actionTextForNotes: string;
    let emailSubjectToUser: string;
    let emailActionTextForUser: string;

    if (existingAppointment.status === AppointmentStatus.PENDING) {
      newStatus = AppointmentStatus.REJECTED;
      actionTextForNotes = reason ? `Odbijen od strane salona: ${reason}` : "Termin odbijen od strane salona.";
      emailSubjectToUser = `Vaš zahtev za termin je odbijen: ${existingAppointment.service.name}`;
      emailActionTextForUser = `nažalost, morali smo da odbijemo Vaš zahtev za termin.`;
    } else if (existingAppointment.status === AppointmentStatus.CONFIRMED) {
      newStatus = AppointmentStatus.CANCELLED_BY_VENDOR;
      actionTextForNotes = reason ? `Otkazan od strane salona: ${reason}` : "Termin otkazan od strane salona.";
      emailSubjectToUser = `Vaš termin je otkazan: ${existingAppointment.service.name}`;
      emailActionTextForUser = `nažalost, morali smo da otkažemo Vaš potvrđeni termin.`;
    } else {
      return NextResponse.json(
        { message: `Termin se ne može otkazati/odbiti. Trenutni status: ${existingAppointment.status}` },
        { status: 409 } // Conflict
      );
    }

    const currentNotes = existingAppointment.notes || "";
    const newNotesForDb = `${actionTextForNotes} Originalne napomene korisnika: ${currentNotes}`.trim();

    const updatedAppointment = await prisma.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        status: newStatus,
        notes: newNotesForDb, // Update notes with admin's action and reason
      },
      // Re-include data needed for email, even if some was in existingAppointment
      include: {
        service: { select: { name: true } },
        vendor: { select: { name: true } },
        user: { select: { email: true, firstName: true, lastName: true } },
      }
    });

    // --- Send Rejection/Cancellation Email to User ---
    if (updatedAppointment.user?.email) {
      const customer = updatedAppointment.user;
      const formattedStartTime = format(new Date(existingAppointment.startTime), "eeee, dd. MMMM yyyy. 'u' HH:mm 'h'", { locale: srLatn });
      const contactLink = `${process.env.NEXT_PUBLIC_SITE_URL}/book`; // Or a specific contact page

      const emailHtmlContent = `
        <p>Poštovani ${customer.firstName || customer.lastName || 'korisniče'},</p>
        <p>Obaveštavamo Vas da smo ${emailActionTextForUser}</p>
        <ul style="list-style-type: none; padding: 0;">
          <li style="margin-bottom: 5px;"><strong>Salon:</strong> ${updatedAppointment.vendor.name}</li>
          <li style="margin-bottom: 5px;"><strong>Usluga:</strong> ${updatedAppointment.service.name}</li>
          <li style="margin-bottom: 5px;"><strong>Prvobitno vreme:</strong> ${formattedStartTime}</li>
        </ul>
        ${reason ? `<p><strong>Razlog:</strong> ${reason}</p>` : ''}
        <p style="margin-top: 15px;">Žao nam je zbog eventualnih neprijatnosti.</p>
        <p>Ako želite da zakažete novi termin ili imate pitanja, možete nas <a href="${contactLink}" style="color: #007bff; text-decoration: none;">kontaktirati ili pokušati ponovo</a>.</p>
        <br>
        <p>S poštovanjem,<br>Tim Salona ${updatedAppointment.vendor.name} i FrizNaKlik</p>
      `;

      try {
        await sendEmail({
          to: customer.email,
          subject: emailSubjectToUser,
          html: emailHtmlContent,
        });
      } catch (emailError) {
        console.error(`Greška pri slanju email obaveštenja o odbijanju/otkazivanju korisniku ${customer.email}:`, emailError);
        // Log error, but don't fail the main operation
      }
    }
    // --- End Send Rejection/Cancellation Email to User ---

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const { id: appointmentId } = await context.params;
    console.error(`Greška prilikom odbijanja/otkazivanja termina ${appointmentId || 'unknown'}:`, error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Termin nije pronađen ili je izmenjen tokom obrade.' },
        { status: 404 }
      );
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos za razlog.', errors: error.flatten().fieldErrors }, { status: 400 });
    }

    return NextResponse.json({ message: 'Interna greška servera prilikom odbijanja/otkazivanja termina.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);