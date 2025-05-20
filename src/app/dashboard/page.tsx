// src/app/dashboard/page.tsx
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRole } from '@/lib/types/prisma-enums';
import {
    Appointment as PrismaAppointment,
    Service as PrismaService,
    Vendor as PrismaVendor,
    Worker as PrismaWorker
} from '@prisma/client';
import UserAppointmentList from '@/components/user/UserAppointmentList';
import QuickReserveWidget from '@/components/QuickReserveWidget';
import { LayoutDashboard, UserCircle, ShieldCheck, Scissors, MessageSquare } from 'lucide-react';

export interface UserDashboardAppointment extends PrismaAppointment {
  service: PrismaService;
  vendor: Pick<PrismaVendor, 'name'>;
  worker?: Pick<PrismaWorker, 'name'> | null;
  startTime: Date;
  endTime: Date;
}

async function getUserAppointments(prismaUserId: string): Promise<UserDashboardAppointment[]> {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: prismaUserId,
      },
      include: {
        service: true,
        vendor: {
          select: { name: true }
        },
        worker: {
          select: { name: true }
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 5,
    });

    return appointments
      .filter(app => app.service && app.vendor)
      .map(app => ({
        ...app,
        service: app.service!,
        vendor: app.vendor!,
        worker: app.worker ? { name: app.worker.name } : null,
        startTime: new Date(app.startTime),
        endTime: new Date(app.endTime),
    })) as UserDashboardAppointment[];

  } catch (error) {
    console.error("Greška pri dobavljanju korisničkih termina:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/dashboard');
  }

  const appointments = await getUserAppointments(user.id);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <div className="flex items-center">
            <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 mr-2 text-primary" strokeWidth={1.5} />
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-base-content">
                    Moja Kontrolna Tabla
                </h1>
                {user.firstName && (
                    <p className="text-sm text-base-content/70">Dobrodošli, {user.firstName}!</p>
                )}
            </div>
        </div>
        {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_OWNER) && (
            <Link href="/admin" className="btn btn-accent btn-outline btn-xs sm:btn-sm">
                <ShieldCheck className="h-3.5 w-3.5 mr-1 sm:mr-2" />
                Admin Panel
            </Link>
        )}
      </div>

      {/* Quick Actions and Quick Reserve Widget Section */}
      {/* Na lg ekranima, prva kolona zauzima 1/4, druga 3/4 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Column 1: Quick Actions (Profile & Chat) - lg:col-span-1 */}
        <div className="flex flex-col space-y-4 lg:col-span-1">
          <Link href="/user" className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow flex-1">
            <div className="card-body items-center text-center p-4 justify-center">
              <UserCircle className="h-10 w-10 text-secondary mb-2" />
              <h2 className="card-title text-lg">Moj Profil</h2>
              <p className="text-xs text-base-content/70">Podešavanja naloga i broj telefona.</p>
            </div>
          </Link>
          {/* Link ka Chat stranici - Onemogućen */}
           <div className="card bg-base-100 shadow-md flex-1 opacity-50 cursor-not-allowed" title="Uskoro dostupno">
            <div className="card-body items-center text-center p-4 justify-center">
              <MessageSquare className="h-10 w-10 text-info mb-2" />
              <h2 className="card-title text-lg">Ćaskajte sa Salonom</h2>
              <p className="text-xs text-base-content/70">Direktna komunikacija. (Uskoro...)</p>
            </div>
          </div>
        </div>

        {/* Column 2: Quick Reserve Widget - lg:col-span-3 */}
        <div className="card bg-base-100 shadow-xl border border-base-300/40 lg:col-span-3">
          <div className="card-body p-4 sm:p-5">
            <h2 className="card-title text-lg sm:text-xl mb-3 text-secondary flex items-center">
              <Scissors className="h-5 w-5 mr-2" /> Brza Rezervacija (za sutra)
            </h2>
            <QuickReserveWidget />
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-3 text-base-content">Moji Termini (poslednjih {appointments.length > 0 ? appointments.length : 0})</h2>
        <UserAppointmentList appointments={appointments} />
      </section>
    </div>
  );
}
