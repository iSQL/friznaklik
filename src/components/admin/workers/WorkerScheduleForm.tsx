// src/components/admin/workers/WorkerScheduleForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { WorkerAvailability, WorkerScheduleOverride } from '@prisma/client';
import { AlertTriangle, CalendarPlus, Trash2, Save } from 'lucide-react'; // Removed Clock and X
import { format, parse, isValid, parseISO, isBefore } from 'date-fns';

interface AvailabilityData {
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  isAvailable: boolean;
}

interface OverrideData {
  id?: string;
  date: string; // Always YYYY-MM-DD for input
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  notes: string;
}

interface OnSubmitOverrideData {
    date: string; // YYYY-MM-DD
    startTime: string | null;
    endTime: string | null;
    isDayOff: boolean;
    notes: string | null;
}

interface WorkerScheduleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    availabilities: AvailabilityData[];
    overrides: OnSubmitOverrideData[];
  }) => Promise<void>;
  workerName: string | null;
  initialAvailabilities?: WorkerAvailability[];
  initialOverrides?: WorkerScheduleOverride[];
  isProcessing: boolean;
  actionError: string | null;
}

const daysOfWeek = [
  { value: 1, label: 'Ponedeljak' }, { value: 2, label: 'Utorak' },
  { value: 3, label: 'Sreda' }, { value: 4, label: 'Četvrtak' },
  { value: 5, label: 'Petak' }, { value: 6, label: 'Subota' },
  { value: 0, label: 'Nedelja' },
];

export default function WorkerScheduleForm({
  isOpen,
  onClose,
  onSubmit,
  workerName,
  initialAvailabilities = [],
  initialOverrides = [],
  isProcessing,
  actionError,
}: WorkerScheduleFormProps) {
  const [weeklyAvailabilities, setWeeklyAvailabilities] = useState<AvailabilityData[]>([]);
  const [dateOverrides, setDateOverrides] = useState<OverrideData[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const initialWeekly: AvailabilityData[] = daysOfWeek.map(day => {
      const existing = initialAvailabilities.find(a => a.dayOfWeek === day.value);
      return {
        dayOfWeek: day.value,
        startTime: existing?.startTime || '09:00',
        endTime: existing?.endTime || '17:00',
        isAvailable: existing?.isAvailable ?? true,
      };
    });
    setWeeklyAvailabilities(initialWeekly);

    const initialDateOverridesData: OverrideData[] = initialOverrides.map((override, index) => ({
      id: override.id || `temp-${index}-${Date.now()}`,
      date: format(parseISO(override.date as unknown as string), 'yyyy-MM-dd'),
      startTime: override.isDayOff ? null : (override.startTime || '09:00'),
      endTime: override.isDayOff ? null : (override.endTime || '17:00'),
      isDayOff: override.isDayOff,
      notes: override.notes || '',
    }));
    setDateOverrides(initialDateOverridesData);
  }, [initialAvailabilities, initialOverrides, isOpen]);

  const handleWeeklyChange = (index: number, field: keyof AvailabilityData, value: string | boolean) => {
    const updated = [...weeklyAvailabilities];
    const itemToUpdate = { ...updated[index] } as AvailabilityData;
    (itemToUpdate[field] as string | boolean) = value;
    updated[index] = itemToUpdate;
    setWeeklyAvailabilities(updated);
    setFormError(null);
  };

  const handleOverrideChange = (index: number, field: keyof OverrideData, value: string | boolean) => {
    const updated = [...dateOverrides];
    const currentOverride = { ...updated[index] };

    if (field === 'isDayOff') {
        currentOverride.isDayOff = value as boolean;
        if (currentOverride.isDayOff) {
            currentOverride.startTime = null;
            currentOverride.endTime = null;
        }
    } else if (field === 'startTime' || field === 'endTime' || field === 'date' || field === 'notes') {
        (currentOverride[field] as string | null) = value as string;
    }
    updated[index] = currentOverride;
    setDateOverrides(updated);
    setFormError(null);
  };

  const addOverride = () => {
    setDateOverrides([
      ...dateOverrides,
      {
        id: `new-${Date.now()}`,
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '17:00',
        isDayOff: false,
        notes: '',
      },
    ]);
  };

  const removeOverride = (index: number) => {
    setDateOverrides(dateOverrides.filter((_, i) => i !== index));
  };

  const validateTimes = (): boolean => {
    for (const avail of weeklyAvailabilities) {
      if (avail.isAvailable) {
        if (!avail.startTime || !avail.endTime || !/^[0-2]\d:[0-5]\d$/.test(avail.startTime) || !/^[0-2]\d:[0-5]\d$/.test(avail.endTime)) {
          setFormError(`Molimo unesite ispravno početno i krajnje vreme (HH:mm) za ${daysOfWeek.find(d=>d.value === avail.dayOfWeek)?.label || 'dan'}.`);
          return false;
        }
        const start = parse(avail.startTime, 'HH:mm', new Date());
        const end = parse(avail.endTime, 'HH:mm', new Date());
        if (!isValid(start) || !isValid(end) || isBefore(end, start) || avail.startTime === avail.endTime) {
          setFormError(`Neispravno vreme za ${daysOfWeek.find(d=>d.value === avail.dayOfWeek)?.label}. Krajnje vreme mora biti posle početnog.`);
          return false;
        }
      }
    }
    for (const override of dateOverrides) {
      if (!override.isDayOff) {
        if (!override.startTime || !override.endTime || !/^[0-2]\d:[0-5]\d$/.test(override.startTime) || !/^[0-2]\d:[0-5]\d$/.test(override.endTime)) {
          setFormError(`Molimo unesite ispravno početno i krajnje vreme (HH:mm) za izuzetak datuma ${override.date}.`);
          return false;
        }
        const start = parse(override.startTime, 'HH:mm', new Date());
        const end = parse(override.endTime, 'HH:mm', new Date());
        if (!isValid(start) || !isValid(end) || isBefore(end, start) || override.startTime === override.endTime) {
          setFormError(`Neispravno vreme za izuzetak datuma ${override.date}. Krajnje vreme mora biti posle početnog.`);
          return false;
        }
      }
      if (!override.date || !isValid(parseISO(override.date))) {
          setFormError(`Neispravan format datuma za izuzetak: ${override.date}. Koristite YYYY-MM-DD.`);
          return false;
      }
    }
    setFormError(null);
    return true;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateTimes()) {
      return;
    }
    const payloadOverrides: OnSubmitOverrideData[] = dateOverrides.map(({ id: _id, ...rest }) => ({ // eslint-disable-line @typescript-eslint/no-unused-vars
        date: rest.date,
        startTime: rest.isDayOff ? null : (rest.startTime || null),
        endTime: rest.isDayOff ? null : (rest.endTime || null),
        isDayOff: rest.isDayOff,
        notes: rest.notes || null,
    }));

    onSubmit({
        availabilities: weeklyAvailabilities,
        overrides: payloadOverrides,
    });
  };

  if (!isOpen) return null;

  return (
    <dialog open className="modal modal-bottom sm:modal-middle modal-open">
      <div className="modal-box w-11/12 max-w-3xl">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessing}>✕</button>
        <h3 className="font-bold text-xl mb-1">Raspored Radnika: {workerName || 'N/A'}</h3>
        <p className="text-xs text-base-content/70 mb-4">Podesite nedeljnu dostupnost i specifične izuzetke.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-4 border border-base-300 rounded-lg bg-base-100/30">
            <h4 className="text-lg font-semibold mb-3 text-primary">Nedeljna Dostupnost</h4>
            <div className="space-y-3">
              {weeklyAvailabilities.map((avail, index) => (
                <div key={avail.dayOfWeek} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center p-2 rounded-md hover:bg-base-200/50 transition-colors">
                  <label className="label sm:col-span-1 cursor-pointer py-0">
                    <span className="label-text font-medium">{daysOfWeek.find(d => d.value === avail.dayOfWeek)?.label}</span>
                  </label>
                  <div className="form-control sm:col-span-1">
                     <label className="cursor-pointer label justify-start gap-2">
                        <input
                        type="checkbox"
                        className="toggle toggle-success toggle-sm"
                        checked={avail.isAvailable}
                        onChange={(e) => handleWeeklyChange(index, 'isAvailable', e.target.checked)}
                        disabled={isProcessing}
                        />
                        <span className="label-text text-xs">{avail.isAvailable ? 'Radi' : 'Ne radi'}</span>
                    </label>
                  </div>
                  <div className="flex gap-2 sm:col-span-2 items-center">
                    <input
                      type="time"
                      className={`input input-bordered input-sm w-full ${!avail.isAvailable ? 'input-disabled' : ''}`}
                      value={avail.startTime}
                      onChange={(e) => handleWeeklyChange(index, 'startTime', e.target.value)}
                      disabled={!avail.isAvailable || isProcessing}
                      step="900"
                    />
                    <span className={`${!avail.isAvailable ? 'text-base-content/30' : ''}`}>-</span>
                    <input
                      type="time"
                      className={`input input-bordered input-sm w-full ${!avail.isAvailable ? 'input-disabled' : ''}`}
                      value={avail.endTime}
                      onChange={(e) => handleWeeklyChange(index, 'endTime', e.target.value)}
                      disabled={!avail.isAvailable || isProcessing}
                      step="900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 border border-base-300 rounded-lg bg-base-100/30">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-lg font-semibold text-secondary">Specifični Izuzeci (Praznici, Slobodni dani)</h4>
                <button type="button" onClick={addOverride} className="btn btn-outline btn-secondary btn-xs" disabled={isProcessing}>
                    <CalendarPlus size={14} className="mr-1"/> Dodaj Izuzetak
                </button>
            </div>
            {dateOverrides.length === 0 && <p className="text-sm text-base-content/60 italic">Nema definisanih izuzetaka.</p>}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {dateOverrides.map((override, index) => (
                <div key={override.id || index} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center p-2 rounded-md border border-base-300/50 hover:bg-base-200/50 transition-colors">
                  <div className="form-control md:col-span-2">
                    <label className="label py-0"><span className="label-text text-xs">Datum</span></label>
                    <input
                      type="date"
                      className="input input-bordered input-sm w-full"
                      value={override.date}
                      onChange={(e) => handleOverrideChange(index, 'date', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="form-control md:col-span-1">
                    <label className="label cursor-pointer py-0 justify-start gap-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-error checkbox-xs"
                        checked={override.isDayOff}
                        onChange={(e) => handleOverrideChange(index, 'isDayOff', e.target.checked)}
                        disabled={isProcessing}
                      />
                      <span className="label-text text-xs">Slobodan dan</span>
                    </label>
                  </div>
                  <div className={`flex gap-2 md:col-span-2 items-center ${override.isDayOff ? 'opacity-50' : ''}`}>
                    <input
                      type="time"
                      className="input input-bordered input-sm w-full"
                      value={override.startTime || ''}
                      onChange={(e) => handleOverrideChange(index, 'startTime', e.target.value)}
                      disabled={override.isDayOff || isProcessing}
                      step="900"
                    />
                    <span>-</span>
                    <input
                      type="time"
                      className="input input-bordered input-sm w-full"
                      value={override.endTime || ''}
                      onChange={(e) => handleOverrideChange(index, 'endTime', e.target.value)}
                      disabled={override.isDayOff || isProcessing}
                      step="900"
                    />
                  </div>
                   <div className="form-control md:col-span-2">
                     <label className="label py-0"><span className="label-text text-xs">Napomena</span></label>
                    <input
                      type="text"
                      placeholder="Npr. Praznik"
                      className="input input-bordered input-sm w-full"
                      value={override.notes}
                      onChange={(e) => handleOverrideChange(index, 'notes', e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end md:justify-start pt-2 md:pt-0">
                    <button type="button" onClick={() => removeOverride(index)} className="btn btn-error btn-xs btn-outline" disabled={isProcessing}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(formError || actionError) && (
            <div role="alert" className="alert alert-error text-xs p-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{formError || actionError}</span>
            </div>
          )}

          <div className="modal-action pt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isProcessing}>
              Otkaži
            </button>
            <button type="submit" className="btn btn-primary" disabled={isProcessing}>
              {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : <><Save size={16} className="mr-2"/> Sačuvaj Raspored</>}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button type="button" onClick={onClose} disabled={isProcessing}>close</button></form>
    </dialog>
  );
}