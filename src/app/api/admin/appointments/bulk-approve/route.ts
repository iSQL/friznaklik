import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { Prisma } from '@prisma/client';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums';
import { sendEmail } from '@/lib/emailService';
import { format } from 'date-fns';
import { srLatn } from 'date-fns/locale';

async function POST_handler(req: NextRequest) {
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
      // SUPER_ADMIN could potentially approve for a specific vendor if vendorId is passed in body
      // For now, this route is primarily for VENDOR_OWNER.
      // If SUPER_ADMIN needs this, the request body should include vendorId.
      // const body = await req.json().catch(() => null);
      // targetVendorId = body?.vendorId;
      // if (!targetVendorId) {
      //   return NextResponse.json({ message: 'Za SUPER_ADMIN-a, ID salona je obavezan za ovu operaciju.' }, { status: 400 });
      // }
       return NextResponse.json({ message: 'SUPER_ADMIN trenutno ne može koristiti ovu funkciju za određeni salon.' }, { status: 403 });
    } else {
        return NextResponse.json({ message: 'Nemate dozvolu za ovu akciju.' }, { status: 403 });
    }

    if (!targetVendorId) {
        return NextResponse.json({ message: 'ID Salona nije mogao biti utvrđen.' }, { status: 400 });
    }

    const pendingAppointments = await prisma.appointment.findMany({
      where: {
        vendorId: targetVendorId,
        status: AppointmentStatus.PENDING,
      },
      include: { 
        service: { select: { name: true } },
        vendor: { select: { name: true } },
        user: { select: { email: true, firstName: true, lastName: true } },
        worker: { select: { id:true, name: true } }, 
      }
    });

    if (pendingAppointments.length === 0) {
      return NextResponse.json({ message: 'Nema termina na čekanju za odobravanje.', approvedCount: 0 }, { status: 200 });
    }

    const appointmentIdsToApprove = pendingAppointments.map(app => app.id);

    // Auto-assign worker logic (simplified: assign first available if not already assigned)
    // This is a complex part; for bulk, a simpler strategy or pre-assignment might be better.
    // For now, we'll just approve. Worker assignment can be a separate step or handled by admin individually.
    // If a worker is already assigned (e.g. by user preference), keep it.
    // If not, and if salon has workers, assign one.

    const workersOfVendor = await prisma.worker.findMany({
        where: { vendorId: targetVendorId },
        select: { id: true }
    });


    const updatePromises = pendingAppointments.map(appointment => {
        let workerToConnect: Prisma.WorkerWhereUniqueInput | undefined = undefined;
        if (appointment.workerId) { // If worker already selected by user or previously by admin
            workerToConnect = { id: appointment.workerId };
        } else if (workersOfVendor.length > 0) { // Auto-assign if no worker and vendor has workers
            // Simple: assign first worker. A more complex logic could check worker's availability for the service/time.
            workerToConnect = { id: workersOfVendor[0].id };
        }

        return prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                status: AppointmentStatus.CONFIRMED,
                ...(workerToConnect && { worker: { connect: workerToConnect }}) // Conditionally connect worker
            },
            include: { // Re-fetch for email
                service: { select: { name: true } },
                vendor: { select: { name: true } },
                user: { select: { email: true, firstName: true, lastName: true } },
                worker: { select: { name: true } },
            }
        });
    });

    const approvedAppointments = await prisma.$transaction(updatePromises);

    // Send email notifications for each approved appointment
    for (const approvedApp of approvedAppointments) {
        if (approvedApp.user?.email) {
            const customer = approvedApp.user;
            const formattedStartTime = format(new Date(approvedApp.startTime), "eeee, dd. MMMM yyyy. 'u' HH:mm 'h'", { locale: srLatn });
            const dashboardLink = `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`;
            const emailSubject = `Vaš termin je potvrđen: ${approvedApp.service.name} u ${approvedApp.vendor.name}`;
            const emailHtmlContent = `
                <p>Poštovani ${customer.firstName || customer.lastName || 'korisniče'},</p>
                <p>Vaš zahtev za termin je <strong>uspešno potvrđen!</strong></p>
                <ul style="list-style-type: none; padding: 0;">
                  <li style="margin-bottom: 5px;"><strong>Salon:</strong> ${approvedApp.vendor.name}</li>
                  <li style="margin-bottom: 5px;"><strong>Usluga:</strong> ${approvedApp.service.name}</li>
                  <li style="margin-bottom: 5px;"><strong>Potvrđeno vreme:</strong> ${formattedStartTime}</li>
                  ${approvedApp.worker?.name ? `<li style="margin-bottom: 5px;"><strong>Radnik:</strong> ${approvedApp.worker.name}</li>` : ''}
                </ul>
                <p style="margin-top: 15px;">Radujemo se Vašem dolasku!</p>
                <p>Možete videti detalje Vašeg termina na Vašoj kontrolnoj tabli:</p>
                <p><a href="${dashboardLink}" style="color: #007bff; text-decoration: none;">Moja Kontrolna Tabla</a></p>
                <br>
                <p>S poštovanjem,<br>Tim Salona ${approvedApp.vendor.name} i FrizNaKlik</p>
            `;
            sendEmail({ to: customer.email, subject: emailSubject, html: emailHtmlContent })
                .catch(emailError => console.error(`Greška pri slanju email potvrde za termin ${approvedApp.id}:`, emailError));
        }
    }

    return NextResponse.json({
      message: `Uspešno odobreno ${approvedAppointments.length} termin(a).`,
      approvedCount: approvedAppointments.length,
    }, { status: 200 });

  } catch (error) {
    console.error('Greška pri masovnom odobravanju termina:', error);
    const errorMessage = error instanceof Error ? error.message : 'Interna greška servera.';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

export const POST = withRoleProtection(POST_handler, [UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN]);
