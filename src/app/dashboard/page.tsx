// src/app/dashboard/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList';
import prisma from '@/lib/prisma';
import { Appointment, Service } from '@prisma/client';
import { parseISO } from "date-fns";
import { formatErrorMessage } from '@/lib/errorUtils';
import { AlertTriangle } from 'lucide-react'; 

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
      console.warn(`Korisnik sa Clerk ID ${clerkUserId} nije pronađen u bazi.`);
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
    const userFriendlyMessage = formatErrorMessage(error, `preuzimanja termina za korisnika ${clerkUserId}`);
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
        error = formatErrorMessage(fetchError, "prikazivanja termina na kontrolnoj tabli");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-base-300">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Dobrodošli na Vašu Kontrolnu Tablu, {user.firstName || user.username || 'Korisniče'}!
          </h1>
          <p className="text-base-content/70 mt-1">Ovde možete pregledati i upravljati Vašim zakazanim terminima.</p>
        </div>
      </div>


      {error ? (
        <div role="alert" className="alert alert-error shadow-lg">
          <AlertTriangle className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Greška pri učitavanju termina!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}