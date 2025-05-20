// src/app/api/admin/appointments/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { sendEmail } from '@/lib/emailService'; // Import email service
import { format } from 'date-fns'; // For formatting dates in email
import { srLatn } from 'date-fns/locale'; // For Serbian date formatting

async function POST_handler(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser: AuthenticatedUser | null = await getCurrentUser(); // Admin performing the action
    if (!adminUser) {
      return NextResponse.json({ message: 'Niste autorizovani.' }, { status: 401 });
    }

    const { id: appointmentId } = await context.params;
    if (!appointmentId) {
      return NextResponse.json({ message: 'ID termina je obavezan.' }, { status: 400 });
    }

    const appointmentToApprove = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        status: true,
        vendorId: true,
        workerId: true,
        userId: true, // Need userId to fetch customer's email
        startTime: true,
        service: { select: { name: true } },
        vendor: { select: { name: true } },
        user: { select: { email: true, firstName: true, lastName: true } }, // Customer details for email
        worker: { select: { name: true } }, // Worker details for email
      },
    });

    if (!appointmentToApprove) {
      return NextResponse.json({ message: 'Termin nije pronađen.' }, { status: 404 });
    }

    // Authorization check for VENDOR_OWNER
    if (adminUser.role === UserRole.VENDOR_OWNER) {
      if (!adminUser.ownedVendorId || appointmentToApprove.vendorId !== adminUser.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate dozvolu da odobrite ovaj termin.' }, { status: 403 });
      }
    }
    // SUPER_ADMIN can approve any appointment

    if (appointmentToApprove.status !== AppointmentStatus.PENDING) {
      return NextResponse.json(
        { message: `Termin se ne može odobriti. Trenutni status: ${appointmentToApprove.status}` },
        { status: 409 }
      );
    }

    const dataToUpdate: Prisma.AppointmentUpdateInput = {
      status: AppointmentStatus.CONFIRMED,
    };

    // Automatic worker assignment logic (if worker not already assigned by admin before approval)
    if (!appointmentToApprove.workerId) {
      const workersOfVendor = await prisma.worker.findMany({
        where: {
          vendorId: appointmentToApprove.vendorId,
          // Optional: Add filter for workers qualified for the specific service if needed
          // services: { some: { id: appointmentToApprove.serviceId } }
        },
        select: { id: true },
      });

      if (workersOfVendor.length > 0) {
        dataToUpdate.worker = {
          connect: {
            id: workersOfVendor[0].id, // Assign the first available worker
          },
        };
        console.log(`Termin ${appointmentId} automatski dodeljen radniku ${workersOfVendor[0].id} prilikom odobravanja.`);
         // Re-fetch worker name if one was auto-assigned for the email
        if (!appointmentToApprove.worker) {
            const assignedWorker = await prisma.worker.findUnique({
                where: { id: workersOfVendor[0].id},
                select: { name: true }
            });
            appointmentToApprove.worker = assignedWorker;
        }

      } else {
        console.log(`Nema dostupnih radnika u salonu ${appointmentToApprove.vendorId} za automatsku dodelu terminu ${appointmentId}.`);
      }
    }


    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: dataToUpdate,
      include: { // Re-include necessary fields for the email and response
        service: { select: { name: true } },
        vendor: { select: { name: true } },
        user: { select: { email: true, firstName: true, lastName: true } },
        worker: { select: { name: true } },
      },
    });

    // --- Send Confirmation Email to User ---
    if (updatedAppointment.user?.email && updatedAppointment.status === AppointmentStatus.CONFIRMED) {
      const customer = updatedAppointment.user;
      const formattedStartTime = format(new Date(updatedAppointment.startTime), "eeee, dd. MMMM yyyy. 'u' HH:mm 'h'", { locale: srLatn });
      const dashboardLink = `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`;

      const emailSubject = `Vaš termin je potvrđen: ${updatedAppointment.service.name} u ${updatedAppointment.vendor.name}`;
      const emailHtmlContent = `
        <p>Poštovani ${customer.firstName || customer.lastName || 'korisniče'},</p>
        <p>Vaš zahtev za termin je <strong>uspešno potvrđen!</strong></p>
        <ul style="list-style-type: none; padding: 0;">
          <li style="margin-bottom: 5px;"><strong>Salon:</strong> ${updatedAppointment.vendor.name}</li>
          <li style="margin-bottom: 5px;"><strong>Usluga:</strong> ${updatedAppointment.service.name}</li>
          <li style="margin-bottom: 5px;"><strong>Potvrđeno vreme:</strong> ${formattedStartTime}</li>
          ${updatedAppointment.worker?.name ? `<li style="margin-bottom: 5px;"><strong>Radnik:</strong> ${updatedAppointment.worker.name}</li>` : ''}
          ${updatedAppointment.notes ? `<li style="margin-bottom: 5px;"><strong>Vaša napomena:</strong> ${updatedAppointment.notes}</li>` : ''}
        </ul>
        <p style="margin-top: 15px;">Radujemo se Vašem dolasku!</p>
        <p>Možete videti detalje Vašeg termina na Vašoj kontrolnoj tabli:</p>
        <p><a href="${dashboardLink}" style="color: #007bff; text-decoration: none;">Moja Kontrolna Tabla</a></p>
        <br>
        <p>S poštovanjem,<br>Tim Salona ${updatedAppointment.vendor.name} i FrizNaKlik</p>
      `;

      try {
        await sendEmail({
          to: customer.email,
          subject: emailSubject,
          html: emailHtmlContent,
        });
      } catch (emailError) {
        console.error(`Greška pri slanju email potvrde korisniku ${customer.email}:`, emailError);
        // Log error, but don't fail the main operation
      }
    }
    // --- End Send Confirmation Email to User ---

    return NextResponse.json(updatedAppointment);

  } catch (error: unknown) {
    const { id: appointmentId } = await context.params;
    console.error(`Greška pri odobravanju termina ${appointmentId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Termin nije pronađen ili nije na čekanju.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}

export const POST = withRoleProtection(
  POST_handler,
  [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]
);