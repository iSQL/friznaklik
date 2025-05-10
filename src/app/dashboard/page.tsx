import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList';
import prisma from '@/lib/prisma';
import { Appointment, Service } from '@prisma/client';
import { parseISO } from "date-fns";
import { formatErrorMessage } from '@/lib/errorUtils';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import Link from "next/link";

export type AppointmentWithServiceDetails = Appointment & {
  service: Service;
  startTime: Date;
  endTime: Date;
};

export const dynamic = 'force-dynamic';

async function getUserAppointments(clerkUserId: string): Promise<AppointmentWithServiceDetails[]> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!dbUser) {
      return [];
    }

    const rawAppointments = await prisma.appointment.findMany({
      where: {
        userId: dbUser.id,
      },
      include: {
        service: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return rawAppointments.map(app => ({
      ...app,
      startTime: app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string),
      endTime: app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string),
    }));
  } catch (error: unknown) {
    const userFriendlyMessage = formatErrorMessage(error, `fetching appointments for user ${clerkUserId}`);
    throw new Error(userFriendlyMessage);
  }
}

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user || !user.id) {
    redirect('/sign-in');
  }

  let userAppointments: AppointmentWithServiceDetails[] = [];
  let error: string | null = null;

  try {
    userAppointments = await getUserAppointments(user.id);
  } catch (fetchError: unknown) {
    if (fetchError instanceof Error) {
        error = fetchError.message;
    } else {
        error = formatErrorMessage(fetchError, "displaying dashboard appointments");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-base-content">
        Welcome to Your Dashboard, {user.firstName || user.username || 'User'}!
      </h1>

      {error ? (
        <div role="alert" className="alert alert-error shadow-lg">
          <AlertTriangle className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Error Loading Appointments!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      ) : userAppointments.length === 0 ? (
        <div className="text-center py-10 bg-base-200 rounded-box mt-6">
            <CalendarDays className="h-12 w-12 mx-auto text-base-content opacity-50 mb-4" />
            <p className="text-xl font-semibold text-base-content">No Appointments Yet</p>
            <p className="text-base-content opacity-70">You have no upcoming or past appointments.</p>
            <Link href="/book" className="btn btn-primary mt-6">Book an Appointment</Link>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}
