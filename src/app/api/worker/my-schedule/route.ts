import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { UserRole, AppointmentStatus } from '@/lib/types/prisma-enums'; // Corrected enum import
import { startOfToday } from 'date-fns';

export async function GET() {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: 'Neautorizovan pristup. Molimo prijavite se.' }, { status: 401 });
    }

    // Ensure the user has the WORKER role.
    // Note: The `WORKER` role should be assigned to a User when they are linked to a Worker profile.
    // This might happen during worker creation by a VENDOR_OWNER or SUPER_ADMIN.
    // If a User is linked to a Worker entity but doesn't have the WORKER role,
    // this check will prevent access. Consider if your user/worker creation logic handles role assignment.
    if (user.role !== UserRole.WORKER) {
      return NextResponse.json({ message: 'Pristup odbijen. Samo radnici mogu videti svoj raspored.' }, { status: 403 });
    }

    // Find the Worker profile linked to the authenticated User's Prisma ID.
    // The `user.id` from `AuthenticatedUser` is the Prisma `User` table's ID.
    const workerProfile = await prisma.worker.findUnique({
      where: {
        userId: user.id, // `userId` in Worker model should be the Prisma User ID
      },
      include: {
        availabilities: {
          orderBy: { dayOfWeek: 'asc' },
        },
        scheduleOverrides: {
          where: {
            date: { gte: startOfToday() } // Only fetch future or current day overrides
          },
          orderBy: { date: 'asc' },
        },
        appointments: {
          where: {
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
            startTime: { gte: new Date() }, // Upcoming appointments
          },
          include: {
            service: { select: { name: true, duration: true } },
            user: { select: { firstName: true, lastName: true, email: true, profileImageUrl: true } }, // Customer details
            vendor: { select: { name: true, address: true } }, // Include vendor details
          },
          orderBy: { startTime: 'asc' },
          take: 20, // Limit the number of upcoming appointments shown
        },
        vendor: { // Include basic vendor info for context
            select: { id: true, name: true }
        }
      },
    });

    if (!workerProfile) {
      return NextResponse.json({ message: 'Vaš profil radnika nije pronađen ili nije povezan sa vašim nalogom.' }, { status: 404 });
    }

    // Structure the response
    const responseData = {
      workerId: workerProfile.id,
      workerName: workerProfile.name,
      vendorInfo: workerProfile.vendor ? {id: workerProfile.vendor.id, name: workerProfile.vendor.name} : null,
      upcomingAppointments: workerProfile.appointments.map(app => ({
        ...app,
        // Ensure date fields are consistently formatted if needed, though client can handle Date objects
        startTime: app.startTime.toISOString(),
        endTime: app.endTime.toISOString(),
      })),
      weeklyAvailability: workerProfile.availabilities,
      scheduleOverrides: workerProfile.scheduleOverrides.map(override => ({
        ...override,
        date: override.date.toISOString().split('T')[0], // Format date as YYYY-MM-DD string
      })),
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch (error: unknown) {
    console.error('Greška pri dobavljanju rasporeda radnika:', error);
    const errorMessage = error instanceof Error ? error.message : 'Došlo je do nepoznate greške.';
    return NextResponse.json({ message: 'Interna greška servera.', details: errorMessage }, { status: 500 });
  }
}
