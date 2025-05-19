// src/app/dashboard/my-schedule/page.tsx
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, CalendarDays, Briefcase, UserCircle, Clock, Building, AlertTriangle } from 'lucide-react';
import WorkerDashboardClient from '@/components/worker/WorkerDashboardClient';
import { formatErrorMessage } from '@/lib/errorUtils';
import type { Metadata } from 'next';
import { headers } from 'next/headers'; // Import headers

export const metadata: Metadata = {
  title: 'Moj Raspored - FrizNaKlik',
  description: 'Pregledajte vaš radni raspored i predstojeće termine.',
};

interface WorkerScheduleData {
  workerId: string;
  workerName: string;
  vendorInfo: {
    id: string;
    name: string;
  } | null;
  upcomingAppointments: Array<{
    id: string;
    startTime: string; 
    endTime: string;   
    service: { name?: string | null; duration?: number | null };
    user: { 
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      profileImageUrl?: string | null;
    };
    vendor: { 
        name?: string | null;
        address?: string | null;
    };
    notes?: string | null;
    status: string; 
  }>;
  weeklyAvailability: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }>;
  scheduleOverrides: Array<{
    id: string;
    date: string; 
    startTime: string | null;
    endTime: string | null;
    isDayOff: boolean;
    notes: string | null;
  }>;
}


async function getWorkerScheduleData(): Promise<WorkerScheduleData | { error: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // Get current request's headers to forward cookies for authentication
    const requestHeaders = headers();
    const forwardedHeaders = new Headers();
    if (requestHeaders.has('cookie')) {
      forwardedHeaders.set('cookie', requestHeaders.get('cookie')!);
    }
    // Add any other headers you might need to forward

    const response = await fetch(`${baseUrl}/api/worker/my-schedule`, {
      method: 'GET',
      headers: forwardedHeaders, // Forward the necessary headers
      cache: 'no-store', 
    });

    if (!response.ok) {
      // Try to parse error message from API if available
      let errorResponseMessage = `Nije moguće preuzeti podatke o rasporedu (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        errorResponseMessage = errorData.message || errorData.details || errorResponseMessage;
      } catch (e) {
        // If parsing JSON fails, use the status text
        errorResponseMessage = `Nije moguće preuzeti podatke o rasporedu: ${response.statusText} (Status: ${response.status})`;
      }
      console.error("API Error in getWorkerScheduleData:", errorResponseMessage);
      return { error: errorResponseMessage };
    }
    return await response.json() as WorkerScheduleData;
  } catch (error: unknown) {
    console.error("Fetch Error in getWorkerScheduleData:", error);
    return { error: formatErrorMessage(error, "preuzimanja podataka o rasporedu radnika") };
  }
}


export default async function MySchedulePage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/dashboard/my-schedule');
  }

  if (user.role !== UserRole.WORKER) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-4">Samo korisnici sa ulogom 'Radnik' mogu pristupiti ovoj stranici.</p>
                <p className="text-sm mb-6">Ako smatrate da je ovo greška, molimo kontaktirajte administratora vašeg salona.</p>
                <Link href="/dashboard" className="btn btn-primary">
                  Nazad na Kontrolnu Tablu
                </Link>
            </div>
        </div>
      </div>
    );
  }

  const scheduleDataResponse = await getWorkerScheduleData();

  if ('error' in scheduleDataResponse) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
         <div className="card bg-base-200 shadow-xl max-w-lg w-full mx-auto">
            <div className="card-body items-center text-center">
                <AlertTriangle className="h-16 w-16 text-warning mb-4" />
                <h1 className="card-title text-2xl text-warning mb-2">Greška pri Učitavanju Rasporeda</h1>
                <p className="mb-4">Nije bilo moguće učitati vaše podatke o rasporedu.</p>
                <p className="text-sm text-base-content/70 mb-6">{scheduleDataResponse.error}</p>
                <Link href="/dashboard" className="btn btn-primary">
                  Nazad na Kontrolnu Tablu
                </Link>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-neutral-content flex items-center">
                <CalendarDays className="h-8 w-8 mr-3 text-primary" />
                Moj Radni Raspored i Termini
            </h1>
            {scheduleDataResponse.vendorInfo && (
                <p className="text-neutral-content/70 text-sm ml-11">
                    Salon: <span className="font-semibold">{scheduleDataResponse.vendorInfo.name}</span>
                </p>
            )}
        </div>
      </div>
      <WorkerDashboardClient scheduleData={scheduleDataResponse} />
    </div>
  );
}
