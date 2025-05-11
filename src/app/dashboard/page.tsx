import { currentUser } from "@clerk/nextjs/server";
import { redirect } from 'next/navigation';
import UserAppointmentList from '@/components/user/UserAppointmentList';
import prisma from '@/lib/prisma';
import { Appointment, Service, User as PrismaUser } from '@prisma/client';
import { parseISO } from "date-fns";
import { formatErrorMessage } from '@/lib/errorUtils';
import { getOrCreateDbUser } from '@/lib/authUtils';
import { AlertTriangle, UserCheck } from 'lucide-react';

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
      console.warn(`[getUserAppointments] Korisnik sa Clerk ID ${clerkUserId} nije pronađen u bazi iako je trebalo da bude kreiran.`);
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
  const clerkUser = await currentUser();

  if (!clerkUser || !clerkUser.id) {
    redirect('/sign-in');
  }

  let localDbUser: PrismaUser | null = null;
  let userWasNewlyCreated = false;
  let userAppointments: AppointmentWithServiceDetails[] = [];
  let error: string | null = null;
  let initialDbUserError: string | null = null;

  try {
    const dbUserResult = await getOrCreateDbUser(clerkUser.id);
    localDbUser = dbUserResult.user;
    userWasNewlyCreated = dbUserResult.wasCreated;

    if (!localDbUser) {
      console.error(`[DashboardPage] Nije moguće pribaviti ili kreirati lokalnog korisnika za Clerk ID: ${clerkUser.id}`);
      initialDbUserError = "Došlo je do problema sa sinhronizacijom Vašeg naloga. Molimo pokušajte kasnije ili kontaktirajte podršku.";
    } else {
      userAppointments = await getUserAppointments(clerkUser.id);
    }
  } catch (fetchError: unknown) {
    if (fetchError instanceof Error) {
        error = fetchError.message;
    } else {
        error = formatErrorMessage(fetchError, "prikazivanja termina na kontrolnoj tabli");
    }
  }
  
  const displayError = initialDbUserError || error;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-base-300">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Dobrodošli na Vašu Kontrolnu Tablu, {clerkUser.firstName || clerkUser.username || 'Korisniče'}!
          </h1>
          <p className="text-base-content/70 mt-1">Ovde možete pregledati i upravljati Vašim zakazanim terminima.</p>
        </div>
        {userWasNewlyCreated && !displayError && ( 
            <div className="badge badge-outline badge-success gap-2 p-3 hidden sm:flex">
                <UserCheck className="h-4 w-4" />
                Nalog Uspešno Sinhronizovan!
            </div>
        )}
      </div>

      {displayError ? (
        <div role="alert" className="alert alert-error shadow-lg">
          <AlertTriangle className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Greška!</h3>
            <div className="text-xs">{displayError}</div>
            {initialDbUserError && <p className="text-xs mt-1">ID Greške: DB_USER_SYNC_FAIL</p>}
          </div>
        </div>
      ) : (
        <UserAppointmentList appointments={userAppointments} />
      )}
    </div>
  );
}
