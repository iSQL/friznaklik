'use client';

import { AppointmentStatus } from '@/lib/types/prisma-enums'; 
import type { WorkerAvailability, WorkerScheduleOverride } from '@prisma/client'; // Import Prisma types
import { format, parseISO, isValid } from 'date-fns';
import { srLatn } from 'date-fns/locale';
import { Calendar, Clock, User, Info, Building, AlertCircle } from 'lucide-react';

// Match the structure from the page component
interface AppointmentData {
  id: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  service: { name?: string | null; duration?: number | null };
  user: { // Customer details
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
  status: string; // AppointmentStatus enum as string
}

interface ScheduleData {
  workerId: string;
  workerName: string;
  vendorInfo: {
    id: string;
    name: string;
  } | null;
  upcomingAppointments: AppointmentData[];
  weeklyAvailability: Array<WorkerAvailability>; // Use the imported Prisma type
  scheduleOverrides: Array<Omit<WorkerScheduleOverride, 'date'> & { date: string }>; // Use Prisma type, but date is string here
}

interface WorkerDashboardClientProps {
  scheduleData: ScheduleData;
}

const daysOfWeekMap: { [key: number]: string } = {
  1: 'Ponedeljak',
  2: 'Utorak',
  3: 'Sreda',
  4: 'Četvrtak',
  5: 'Petak',
  6: 'Subota',
  0: 'Nedelja',
};

export default function WorkerDashboardClient({ scheduleData }: WorkerDashboardClientProps) {
  const {
    upcomingAppointments,
    weeklyAvailability,
    scheduleOverrides,
  } = scheduleData;

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return 'N/A';
    try {
      // Assuming timeStr is "HH:mm"
      const [hours, minutes] = timeStr.split(':');
      const date = new Date();
      date.setHours(parseInt(hours, 10));
      date.setMinutes(parseInt(minutes, 10));
      return format(date, 'HH:mm');
    } catch {
      return timeStr; // Fallback if parsing fails
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'eeee, dd.MM.yyyy.', { locale: srLatn });
    } catch {
      return dateStr;
    }
  };
  
  const formatDateForOverride = (dateStr: string) => { // dateStr is YYYY-MM-DD
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day); 
      if (!isValid(dateObj)) return dateStr;
      return format(dateObj, 'dd.MM.yyyy. (eeee)', { locale: srLatn });
    } catch {
      return dateStr;
    }
  };


  return (
    <div className="space-y-8">
      {/* Upcoming Appointments Section */}
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl text-primary mb-4">
            <Calendar className="mr-2" /> Moji Predstojeći Termini ({upcomingAppointments.length})
          </h2>
          {upcomingAppointments.length === 0 ? (
            <p className="text-base-content/70 italic">Trenutno nemate zakazanih termina.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {upcomingAppointments.map((app) => (
                <div key={app.id} className="p-4 border rounded-lg shadow-sm bg-base-200 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-lg text-secondary">
                      {app.service.name || 'Nepoznata usluga'}
                    </h3>
                    <span className={`badge badge-sm ${app.status === AppointmentStatus.CONFIRMED ? 'badge-success' : 'badge-warning'}`}>
                      {app.status === AppointmentStatus.CONFIRMED ? 'Potvrđen' : 'Na čekanju'}
                    </span>
                  </div>
                  <p className="text-sm text-base-content/80 flex items-center mb-1">
                    <Clock size={14} className="mr-2 opacity-70" />
                    {formatDate(app.startTime)} od {format(parseISO(app.startTime), 'HH:mm')} do {format(parseISO(app.endTime), 'HH:mm')}
                  </p>
                  {app.user && (
                    <p className="text-sm text-base-content/80 flex items-center mb-1">
                      <User size={14} className="mr-2 opacity-70" />
                      Klijent: {app.user.firstName || ''} {app.user.lastName || ''} ({app.user.email || 'N/A'})
                    </p>
                  )}
                   {app.vendor && (
                    <p className="text-sm text-base-content/80 flex items-center mb-1">
                      <Building size={14} className="mr-2 opacity-70" />
                      Salon: {app.vendor.name || 'N/A'} {app.vendor.address && `(${app.vendor.address})`}
                    </p>
                  )}
                  {app.notes && (
                    <p className="text-xs text-base-content/70 mt-1 pt-1 border-t border-base-300/50 flex items-start">
                      <Info size={12} className="mr-1.5 mt-0.5 opacity-70 shrink-0" />
                      Napomena klijenta: <span className="italic">{app.notes}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Weekly Availability Section */}
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl text-primary mb-4">
            <Clock className="mr-2" /> Moj Nedeljni Raspored
          </h2>
          {weeklyAvailability.length === 0 ? (
             <div className="alert alert-info">
                <AlertCircle />
                <span>Vaš podrazumevani nedeljni raspored još nije podešen. Molimo kontaktirajte vlasnika salona.</span>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th>Dan</th>
                  <th>Status</th>
                  <th>Početak</th>
                  <th>Kraj</th>
                </tr>
              </thead>
              <tbody>
                {daysOfWeekMap && Object.entries(daysOfWeekMap)
                .sort(([valA], [valB]) => (parseInt(valA) === 0 ? 7 : parseInt(valA)) - (parseInt(valB) === 0 ? 7 : parseInt(valB))) 
                .map(([dayVal, dayName]) => {
                  const dayNum = parseInt(dayVal);
                  const avail = weeklyAvailability.find(a => a.dayOfWeek === dayNum);
                  return (
                    <tr key={dayNum} className={avail?.isAvailable ? '' : 'opacity-50'}>
                      <td className="font-semibold">{dayName}</td>
                      <td>
                        <span className={`badge badge-xs ${avail?.isAvailable ? 'badge-success' : 'badge-error'}`}>
                          {avail?.isAvailable ? 'Radi' : 'Ne radi'}
                        </span>
                      </td>
                      <td>{avail?.isAvailable ? formatTime(avail.startTime) : '---'}</td>
                      <td>{avail?.isAvailable ? formatTime(avail.endTime) : '---'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </section>

      {/* Schedule Overrides Section */}
      <section className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl text-primary mb-4">
            <Calendar className="mr-2" /> Izuzeci u Rasporedu (Slobodni dani / Izmene)
          </h2>
          {scheduleOverrides.length === 0 ? (
            <p className="text-base-content/70 italic">Nemate unetih izuzetaka za predstojeći period.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {scheduleOverrides.map((override) => (
                <div key={override.id} className={`p-3 border rounded-md shadow-sm ${override.isDayOff ? 'bg-error/10 border-error/30' : 'bg-warning/10 border-warning/30'}`}>
                  <p className="font-semibold text-md">
                    {formatDateForOverride(override.date)} - {override.isDayOff ? <span className="badge badge-error badge-outline">Slobodan dan</span> : <span className="badge badge-warning badge-outline">Izmenjeno radno vreme</span>}
                  </p>
                  {!override.isDayOff && (
                    <p className="text-sm">
                      <Clock size={12} className="inline mr-1 opacity-70" />
                      Radno vreme: {formatTime(override.startTime)} - {formatTime(override.endTime)}
                    </p>
                  )}
                  {override.notes && (
                    <p className="text-xs text-base-content/80 mt-1">
                      <Info size={12} className="inline mr-1 opacity-70" />
                      Napomena: {override.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
