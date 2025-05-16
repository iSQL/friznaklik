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
import { LayoutDashboard, CalendarPlus, UserCircle, ShieldCheck } from 'lucide-react';

// Ovaj interfejs definiše oblik podataka koji se prosleđuje UserAppointmentList komponenti.
// On nasleđuje sva polja iz PrismaAppointment i dodaje kompletne povezane objekte.
export interface UserDashboardAppointment extends PrismaAppointment {
  service: PrismaService;
  vendor: PrismaVendor;
  worker?: PrismaWorker | null;
  startTime: Date; 
  endTime: Date;   
}

async function getUserAppointments(userId: string): Promise<UserDashboardAppointment[]> {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        userId: userId, 
      },
      include: {
        service: true,  
        vendor: true,   
        worker: true,   
      },
      orderBy: {
        startTime: 'asc', 
      },
      take: 10, 
    });

    return appointments
      .filter(app => app.service && app.vendor) 
      .map(app => ({
        ...app,
        service: app.service!, 
        vendor: app.vendor!,   
        worker: app.worker,    
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

  const appointments = await getUserAppointments(user.clerkId); 

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center">
            <LayoutDashboard className="h-8 w-8 sm:h-10 sm:w-10 mr-3 text-primary" strokeWidth={1.5} />
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-base-content">
                    Moja Kontrolna Tabla
                </h1>
                {user.firstName && (
                    <p className="text-base-content/70">Dobrodošli nazad, {user.firstName}!</p>
                )}
            </div>
        </div>
        {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_OWNER) && (
            <Link href="/admin" className="btn btn-accent btn-outline btn-sm sm:btn-md">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Admin Panel
            </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Kartica za brzu akciju - Zakazivanje */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <CalendarPlus className="h-12 w-12 text-primary mb-3" />
            <h2 className="card-title">Novi Termin</h2>
            <p className="text-sm text-base-content/70">Brzo zakažite vaš sledeći termin.</p>
            <div className="card-actions justify-center mt-4">
              <Link href="/book" className="btn btn-primary">Zakaži Sada</Link>
            </div>
          </div>
        </div>

        {/* Kartica za profil */}
        <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <UserCircle className="h-12 w-12 text-secondary mb-3" />
            <h2 className="card-title">Moj Profil</h2>
            <p className="text-sm text-base-content/70">Pregledajte i ažurirajte vaše podatke.</p>
            <div className="card-actions justify-center mt-4">
              <Link href="/user" className="btn btn-secondary">Vidi Profil</Link>
            </div>
          </div>
        </div>
        
        {/* Dodatna kartica */}
         <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-12 w-12 text-accent mb-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.646.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.333.183-.583.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="card-title">Moje Usluge</h2>
            <p className="text-sm text-base-content/70">Pregledajte omiljene ili prethodno korišćene usluge.</p>
            <div className="card-actions justify-center mt-4">
              <Link href="/services" className="btn btn-accent">Vidi Usluge</Link>
            </div>
          </div>
        </div>
      </div>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4 text-base-content">Moji Termini</h2>
        {appointments.length === 0 ? (
            <div className="card bg-base-100 shadow">
                <div className="card-body items-center text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-400 mb-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <p className="text-gray-500 py-6">Trenutno nemate zakazanih termina.</p>
                    <Link href="/book" className="btn btn-primary btn-sm">
                        <CalendarPlus className="mr-2 h-4 w-4" /> Zakažite Novi Termin
                    </Link>
                </div>
            </div>
        ) : (
            <UserAppointmentList appointments={appointments} /> 
        )}
      </section>
    </div>
  );
}
