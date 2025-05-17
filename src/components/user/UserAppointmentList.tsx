'use client';

import { useState, useMemo } from 'react';
import type { Appointment as PrismaAppointment, Service as PrismaService } from '@prisma/client';
import { AppointmentStatus } from '@/lib/types/prisma-enums';
import { parseISO, isPast } from 'date-fns';
import Link from 'next/link';
import AppointmentItem from '@/app/dashboard/AppointmentItem'; 
import { CalendarPlus, ListFilter, Inbox } from 'lucide-react';


export interface AppointmentWithServiceDetails extends PrismaAppointment {
  service: PrismaService;
  startTime: Date; 
  endTime: Date;   
}


type ProcessedAppointment = Omit<AppointmentWithServiceDetails, 'status'> & {
  status: AppointmentStatus; // Koristimo naš lokalni enum
};

// Opcije za filter statusa, sada koristeći naš enum
const APPOINTMENT_STATUS_OPTIONS = [
  'all', // Specijalna vrednost za "Svi"
  ...Object.values(AppointmentStatus), // Sve vrednosti iz našeg enuma
] as const;

export type AppointmentStatusFilter = typeof APPOINTMENT_STATUS_OPTIONS[number];

interface UserAppointmentListProps {
  appointments: AppointmentWithServiceDetails[]; // Lista termina koja dolazi sa servera
}

export default function UserAppointmentList({ appointments: initialAppointments }: UserAppointmentListProps) {
  const [activeFilter, setActiveFilter] = useState<AppointmentStatusFilter>('all');

  // Memoizacija i procesiranje inicijalnih termina
  const appointments = useMemo((): ProcessedAppointment[] => {
    return initialAppointments.map(app => {
      // startTime i endTime bi trebalo da su već Date objekti prema AppointmentWithServiceDetails
      // Ako nisu, parseISO bi bio potreban, ali je bolje to rešiti na mestu gde se podaci dobavljaju (npr. DashboardPage)
      const startTime = app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string);
      const endTime = app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string);
      
      let currentStatus: AppointmentStatus = app.status as AppointmentStatus; // Tipski kast jer su string vrednosti iste

      // Automatski prebaci u COMPLETED ako je termin prošao, a bio je CONFIRMED (ili APPROVED u staroj logici)
      if (currentStatus === AppointmentStatus.CONFIRMED && isPast(endTime)) {
        currentStatus = AppointmentStatus.COMPLETED;
      }

      return {
        ...app,
        startTime,
        endTime,
        status: currentStatus, // status je sada naš lokalni AppointmentStatus
      };
    });
  }, [initialAppointments]);

  // Memoizacija za filtrirane i sortirane termine
  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    if (activeFilter !== 'all') {
      // Filtriramo poređenjem sa vrednostima našeg AppointmentStatus enuma
      filtered = appointments.filter(app => app.status === activeFilter);
    }

    // Sortiranje
    return filtered.sort((a, b) => {
      const statusOrder = (status: AppointmentStatus): number => {
        // Redosled za sortiranje
        if (status === AppointmentStatus.PENDING) return 0;
        if (status === AppointmentStatus.CONFIRMED) return 1; 
        if (status === AppointmentStatus.COMPLETED) return 2; 
        if (status === AppointmentStatus.CANCELLED_BY_USER) return 3; 
        if (status === AppointmentStatus.CANCELLED_BY_VENDOR) return 3; // Isto kao korisnik
        if (status === AppointmentStatus.REJECTED) return 4; 
        if (status === AppointmentStatus.NO_SHOW) return 5;
        return 6; // Ostali
      };

      // Ako je filter "Svi", prvo sortiraj po statusu, pa po datumu
      if (activeFilter === 'all') {
        const statusComparison = statusOrder(a.status) - statusOrder(b.status);
        if (statusComparison !== 0) {
          return statusComparison;
        }
      }
      // Za sve filtere (uključujući "Svi" ako su statusi isti), sortiraj po datumu, najnoviji prvo
      return b.startTime.getTime() - a.startTime.getTime();
    });
  }, [appointments, activeFilter]);
  
  // Funkcija za dobijanje prevedenih naziva filtera
  const getTranslatedFilterLabel = (statusValue: AppointmentStatusFilter): string => {
    if (statusValue === 'all') return 'Svi';
    // Koristimo naš AppointmentStatus enum za prevod
    switch (statusValue as AppointmentStatus) { // Tipski kast jer 'all' nije deo enuma
      case AppointmentStatus.PENDING: return 'Na čekanju';
      case AppointmentStatus.CONFIRMED: return 'Predstojeći / Odobreni'; // Može biti i "Potvrđeni"
      case AppointmentStatus.COMPLETED: return 'Završeni';
      case AppointmentStatus.CANCELLED_BY_USER: return 'Otkazao korisnik';
      case AppointmentStatus.CANCELLED_BY_VENDOR: return 'Otkazao salon';
      case AppointmentStatus.REJECTED: return 'Odbijeni';
      case AppointmentStatus.NO_SHOW: return 'Nije se pojavio';
      default: 
        // Fallback ako status nije prepoznat (ne bi trebalo da se desi sa enumom)
        const s = statusValue as string;
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  // Generisanje opcija za filter dugmad
  const filterOptions = useMemo(() => {
    return APPOINTMENT_STATUS_OPTIONS.map(statusValue => ({
        value: statusValue,
        label: getTranslatedFilterLabel(statusValue)
    }));
  }, []); // getTranslatedFilterLabel ne zavisi od stanja pa ga ne treba u dependency array

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-base-content flex items-center">
          <ListFilter className="h-7 w-7 mr-3 text-primary" />
          Vaši Termini
        </h2>
        <div className="join">
          {filterOptions.map(option => (
            <button
              key={option.value}
              className={`btn join-item btn-sm sm:btn-md ${activeFilter === option.value ? 'btn-active btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAndSortedAppointments.length === 0 ? (
        <div className="card bg-base-200 shadow-xl border border-base-300">
          <div className="card-body items-center text-center py-10">
              <Inbox className="h-16 w-16 text-base-content opacity-40 mb-4" />
            <h2 className="card-title text-xl text-base-content">
              {activeFilter === 'all' ? 'Nema Zakazanih Termina' : `Nema termina sa statusom "${getTranslatedFilterLabel(activeFilter)}"`}
            </h2>
            <p className="text-base-content opacity-70 mt-2">
              {activeFilter === 'all'
                ? 'Trenutno nemate zakazanih termina.'
                : `Trenutno nemate termina sa statusom "${getTranslatedFilterLabel(activeFilter)}".`}
            </p>
            {activeFilter === 'all' && (
                <Link href="/book" className="btn btn-primary mt-6">
                    <CalendarPlus className="mr-2 h-5 w-5" /> Zakažite Novi Termin
                </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedAppointments.map((appointment) => (

            <AppointmentItem key={appointment.id} appointment={appointment} />
          ))}
        </div>
      )}
    </div>
  );
}
