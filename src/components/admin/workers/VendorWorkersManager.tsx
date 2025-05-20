'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Image from 'next/image'; 
import { Worker as PrismaWorker, Service as PrismaService, WorkerAvailability, WorkerScheduleOverride,  } from '@prisma/client';
import { PlusCircle, Edit3, Trash2, AlertTriangle, Users2, Loader2, ImageIcon, Info, ListChecks, CalendarCog, Mail } from 'lucide-react';
import { formatErrorMessage } from '@/lib/errorUtils';
import WorkerScheduleForm from './WorkerScheduleForm';

export interface WorkerWithDetails extends PrismaWorker {
  user?: {
    id: string;
    clerkId: string | null;
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  services?: Array<{ id: string; name: string }>;
  availabilities?: WorkerAvailability[];
  scheduleOverrides?: WorkerScheduleOverride[];
}

interface WorkerFormData {
  name: string;
  bio: string | null;
  photoUrl: string | null;
  userEmail: string | null;
}

interface WorkerScheduleSubmitData {
  availabilities: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>;
  overrides: Array<{ date: string; startTime: string | null; endTime: string | null; isDayOff: boolean; notes: string | null }>;
}

interface VendorWorkersManagerProps {
  vendorId: string;
}

const WorkerDetailsForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isProcessing,
  actionError,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: WorkerFormData) => Promise<void>;
  initialData?: WorkerWithDetails | null;
  isProcessing: boolean;
  actionError: string | null;
}) => {
  const [formData, setFormData] = useState<WorkerFormData>({
    name: '',
    bio: null,
    photoUrl: null,
    userEmail: null,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        bio: initialData.bio || null,
        photoUrl: initialData.photoUrl || null,
        userEmail: initialData.user?.email || null,
      });
    } else {
      setFormData({ name: '', bio: null, photoUrl: null, userEmail: null });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value.trim() === '' ? null : value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
        alert("Ime radnika je obavezno.");
        return;
    }
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <dialog open className="modal modal-bottom sm:modal-middle modal-open">
      <div className="modal-box w-11/12 max-w-lg">
        <h3 className="font-bold text-xl mb-4">{initialData ? 'Izmeni Radnika' : 'Dodaj Novog Radnika'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="workerFormName" className="label">
              <span className="label-text">Ime Radnika <span className="text-error">*</span></span>
            </label>
            <input
              type="text"
              id="workerFormName"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input input-bordered w-full"
              required
              disabled={isProcessing}
            />
          </div>
          <div>
            <label htmlFor="workerFormBio" className="label">
              <span className="label-text">Biografija (opciono)</span>
            </label>
            <textarea
              id="workerFormBio"
              name="bio"
              value={formData.bio || ''}
              onChange={handleChange}
              className="textarea textarea-bordered w-full h-24"
              disabled={isProcessing}
            />
          </div>
          <div>
            <label htmlFor="workerFormPhotoUrl" className="label">
              <span className="label-text">URL Fotografije (opciono)</span>
            </label>
            <div className="input-group">
                <span className="bg-base-200"><ImageIcon size={18}/></span>
                <input
                type="url"
                id="workerFormPhotoUrl"
                name="photoUrl"
                value={formData.photoUrl || ''}
                onChange={handleChange}
                placeholder="https://example.com/slika.jpg"
                className="input input-bordered w-full"
                disabled={isProcessing}
                />
            </div>
          </div>
          <div>
            <label htmlFor="workerFormUserEmail" className="label">
              <span className="label-text">Poveži sa Korisnikom (Email - opciono)</span>
            </label>
             <div className="input-group">
                <span className="bg-base-200"><Mail size={18}/></span>
                <input
                type="email"
                id="workerFormUserEmail"
                name="userEmail"
                value={formData.userEmail || ''}
                onChange={handleChange}
                placeholder="email@example.com"
                className="input input-bordered w-full"
                disabled={isProcessing || (!!initialData && !!initialData.user && !!initialData.user.email)}
                />
            </div>
            {initialData?.user && initialData.user.email && (
                <p className="text-xs text-warning mt-1">Povezani korisnik: {initialData.user.email}. Izmena povezanog emaila nije direktno podržana putem ove forme nakon inicijalnog povezivanja. Za promenu, prvo uklonite vezu (ako je API podržava) ili kontaktirajte administratora.</p>
            )}
             {(!initialData || !initialData.user || !initialData.user.email) && (
                 <p className="text-xs text-info mt-1 flex items-start">
                    <Info size={14} className="mr-1 mt-0.5 shrink-0"/>
                    <span>Unesite email postojećeg korisnika platforme da biste ga povezali sa ovim radnikom. Ostavite prazno ako ne želite da povežete.</span>
                </p>
            )}
          </div>

          {actionError && (
            <div role="alert" className="alert alert-error text-xs p-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="modal-action pt-4">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isProcessing}>
              Otkaži
            </button>
            <button type="submit" className="btn btn-primary" disabled={isProcessing}>
              {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : (initialData ? 'Sačuvaj Izmene' : 'Dodaj Radnika')}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} disabled={isProcessing}>close</button>
      </form>
    </dialog>
  );
};


const WorkerServicesForm = ({
    isOpen,
    onClose,
    onSubmit,
    worker,
    allVendorServices,
    isProcessing,
    actionError,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (selectedServiceIds: string[]) => Promise<void>;
    worker: WorkerWithDetails | null;
    allVendorServices: PrismaService[];
    isProcessing: boolean;
    actionError: string | null;
}) => {
    const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (worker && worker.services) {
            setSelectedServices(new Set(worker.services.map(s => s.id)));
        } else {
            setSelectedServices(new Set());
        }
    }, [worker, isOpen]);
    const handleToggleService = (serviceId: string) => {
        setSelectedServices(prev => {
            const next = new Set(prev);
            if (next.has(serviceId)) {
                next.delete(serviceId);
            } else {
                next.add(serviceId);
            }
            return next;
        });
    };
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        onSubmit(Array.from(selectedServices));
    };
    if (!isOpen || !worker) return null;
    return (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
            <div className="modal-box w-11/12 max-w-lg">
                <h3 className="font-bold text-xl mb-4">Dodeli Usluge Radniku: {worker.name}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {allVendorServices.length === 0 ? (
                        <p className="text-center text-base-content/70">Nema dostupnih usluga u ovom salonu za dodeljivanje.</p>
                    ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2 p-1">
                            {allVendorServices.map(service => (
                                <div key={service.id} className="form-control">
                                    <label className="label cursor-pointer justify-start gap-3 p-2 hover:bg-base-200 rounded-md">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary checkbox-sm"
                                            checked={selectedServices.has(service.id)}
                                            onChange={() => handleToggleService(service.id)}
                                            disabled={isProcessing}
                                        />
                                        <span className="label-text">{service.name}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                    {actionError && (
                        <div role="alert" className="alert alert-error text-xs p-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{actionError}</span>
                        </div>
                    )}
                    <div className="modal-action pt-4">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isProcessing}>
                            Otkaži
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isProcessing || allVendorServices.length === 0}>
                            {isProcessing ? <span className="loading loading-spinner loading-xs"></span> : 'Sačuvaj Usluge'}
                        </button>
                    </div>
                </form>
            </div>
            <form method="dialog" className="modal-backdrop"><button type="button" onClick={onClose} disabled={isProcessing}>close</button></form>
        </dialog>
    );
};

const WorkerList = ({
  workers,
  onEdit,
  onDeleteRequest,
  onManageServices,
  onManageSchedule,
  isProcessingDelete,
  processingWorkerId,
}: {
  workers: WorkerWithDetails[];
  onEdit: (worker: WorkerWithDetails) => void;
  onDeleteRequest: (worker: WorkerWithDetails) => void;
  onManageServices: (worker: WorkerWithDetails) => void;
  onManageSchedule: (worker: WorkerWithDetails) => void;
  isProcessingDelete: boolean;
  processingWorkerId: string | null;
}) => {
  if (workers.length === 0) {
    return (
      <div className="text-center py-10 card bg-base-200 shadow-md border border-base-300/50">
        <div className="card-body items-center">
          <Users2 className="h-16 w-16 mx-auto text-base-content/40 mb-4" />
          <p className="text-base-content/70 text-lg">Ovaj salon trenutno nema dodatih radnika.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg shadow-md border border-base-300/50">
      <table className="table w-full table-zebra bg-base-100">
        <thead className="bg-base-200">
          <tr className="text-base text-base-content">
            <th>Radnik</th>
            <th>Usluge</th>
            <th>Povezan Korisnik (Email)</th>
            <th className="text-right">Akcije</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr key={worker.id} className="hover:bg-base-200/50 transition-colors">
              <td>
                <div className="flex items-center space-x-3">
                  <div className="avatar">
                    <div className="mask mask-squircle w-12 h-12 bg-base-300">
                      {worker.photoUrl ? (
                        <Image
                            src={worker.photoUrl}
                            alt={worker.name || 'Radnik'}
                            width={48}
                            height={48}
                            className="object-cover"
                            onError={(e) => (e.currentTarget.src = `https://placehold.co/48x48/E0E0E0/B0B0B0?text=${worker.name ? worker.name.charAt(0) : 'R'}&font=roboto`)}
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-xl font-semibold text-base-content/70">
                          {worker.name ? worker.name.charAt(0).toUpperCase() : 'R'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-base-content">{worker.name}</div>
                    <div className="text-xs opacity-60 font-mono">{worker.id.substring(0,12)}...</div>
                  </div>
                </div>
              </td>
              <td className="text-sm text-base-content/80">
                {worker.services && worker.services.length > 0 ? `${worker.services.length} usluga` : <span className="italic text-base-content/50">Nema dodeljenih</span>}
              </td>
              <td className="text-sm text-base-content/80">
                {worker.user?.email || <span className="italic text-base-content/50">Nije povezan</span>}
              </td>
              <td className="text-right">
                <div className="flex space-x-1 justify-end">
                   <button onClick={() => onManageSchedule(worker)} className="btn btn-outline btn-info btn-xs" title="Upravljaj Rasporedom Radnika">
                    <CalendarCog size={16} />
                  </button>
                  <button onClick={() => onManageServices(worker)} className="btn btn-outline btn-accent btn-xs" title="Upravljaj Uslugama Radnika">
                    <ListChecks size={16} />
                  </button>
                  <button onClick={() => onEdit(worker)} className="btn btn-outline btn-primary btn-xs" title="Izmeni Detalje Radnika">
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteRequest(worker)}
                    className="btn btn-outline btn-error btn-xs"
                    title="Obriši Radnika"
                    disabled={isProcessingDelete && processingWorkerId === worker.id}
                  >
                    {isProcessingDelete && processingWorkerId === worker.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function VendorWorkersManager({ vendorId }: VendorWorkersManagerProps) {
  const [workers, setWorkers] = useState<WorkerWithDetails[]>([]);
  const [allVendorServices, setAllVendorServices] = useState<PrismaService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDetailsFormOpen, setIsDetailsFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerWithDetails | null>(null);
  const [isProcessingDetailsForm, setIsProcessingDetailsForm] = useState(false);
  const [detailsFormActionError, setDetailsFormActionError] = useState<string | null>(null);

  const [isServicesFormOpen, setIsServicesFormOpen] = useState(false);
  const [isProcessingServicesForm, setIsProcessingServicesForm] = useState(false);
  const [serviceAssignmentError, setServiceAssignmentError] = useState<string | null>(null);

  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [editingWorkerForSchedule, setEditingWorkerForSchedule] = useState<WorkerWithDetails | null>(null);
  const [isProcessingScheduleForm, setIsProcessingScheduleForm] = useState(false);
  const [scheduleFormActionError, setScheduleFormActionError] = useState<string | null>(null);

  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [processingWorkerId, setProcessingWorkerId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerWithDetails | null>(null);
  const [deleteActionError, setDeleteActionError] = useState<string | null>(null);

  const fetchWorkersAndSchedules = useCallback(async () => {
    if (!vendorId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/workers`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje radnika: ${response.statusText}` }));
        throw new Error(errorData.message || `Neuspešno preuzimanje radnika: ${response.statusText}`);
      }
      const data: WorkerWithDetails[] = await response.json();
      setWorkers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do nepoznate greške.');
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  const fetchVendorServices = useCallback(async () => {
    if(!vendorId) return;
    try {
        const response = await fetch(`/api/services?vendorId=${vendorId}&activeOnly=true`);
        if(!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje usluga salona: ${response.statusText}`}));
            throw new Error(errorData.message || "Greška pri preuzimanju usluga salona");
        }
        const data: PrismaService[] = await response.json();
        setAllVendorServices(data);
    } catch (err) {
        setError(err instanceof Error ? `Greška kod usluga: ${err.message}` : 'Nepoznata greška kod preuzimanja usluga salona.');
    }
  }, [vendorId]);

  useEffect(() => {
    fetchWorkersAndSchedules();
    fetchVendorServices();
  }, [fetchWorkersAndSchedules, fetchVendorServices]);

  const handleOpenDetailsForm = (worker: WorkerWithDetails | null = null) => {
    setEditingWorker(worker);
    setIsDetailsFormOpen(true);
    setDetailsFormActionError(null);
  };
  const handleCloseDetailsForm = () => {
    setIsDetailsFormOpen(false);
    setEditingWorker(null);
    setDetailsFormActionError(null);
  };

  const handleSubmitDetailsForm = async (formData: WorkerFormData) => {
    setIsProcessingDetailsForm(true);
    setDetailsFormActionError(null);

    const payload = {
        name: formData.name,
        bio: formData.bio,
        photoUrl: formData.photoUrl,
        userEmail: formData.userEmail,
    };

    const url = editingWorker
      ? `/api/admin/vendors/${vendorId}/workers/${editingWorker.id}`
      : `/api/admin/vendors/${vendorId}/workers`;
    const method = editingWorker ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || `Neuspešno ${editingWorker ? 'ažuriranje' : 'dodavanje'} radnika.`);
      fetchWorkersAndSchedules();
      handleCloseDetailsForm();
    } catch (err) {
      setDetailsFormActionError(err instanceof Error ? err.message : 'Došlo je do greške.');
    } finally {
      setIsProcessingDetailsForm(false);
    }
  };

  const handleOpenServicesForm = (worker: WorkerWithDetails) => {
    setEditingWorker(worker);
    setIsServicesFormOpen(true);
    setServiceAssignmentError(null);
  };
  const handleCloseServicesForm = () => {
    setIsServicesFormOpen(false);
    setEditingWorker(null);
    setServiceAssignmentError(null);
  };
  const handleSubmitWorkerServices = async (selectedServiceIds: string[]) => {
    if (!editingWorker) return;
    setIsProcessingServicesForm(true);
    setServiceAssignmentError(null);
    try {
        const response = await fetch(`/api/admin/workers/${editingWorker.id}/services`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceIds: selectedServiceIds }) });
        const responseData = await response.json();
        if (!response.ok) throw new Error(responseData.message || 'Neuspešno dodeljivanje usluga.');
        fetchWorkersAndSchedules();
        handleCloseServicesForm();
    } catch (err) {
        setServiceAssignmentError(err instanceof Error ? err.message : 'Greška prilikom dodeljivanja usluga.');
    } finally {
        setIsProcessingServicesForm(false);
    }
  };

  const handleOpenScheduleForm = async (worker: WorkerWithDetails) => {
    setScheduleFormActionError(null);
    setIsProcessingScheduleForm(true);
    try {
        const response = await fetch(`/api/admin/vendors/${vendorId}/workers/${worker.id}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "Neuspešno preuzimanje trenutnog rasporeda radnika.");
        }
        const workerDetailsWithSchedule: WorkerWithDetails = await response.json();
        setEditingWorkerForSchedule(workerDetailsWithSchedule);
        setIsScheduleFormOpen(true);
    } catch (err) {
        setScheduleFormActionError(formatErrorMessage(err, "preuzimanja rasporeda radnika"));
    } finally {
        setIsProcessingScheduleForm(false);
    }
  };
  const handleCloseScheduleForm = () => {
    setIsScheduleFormOpen(false);
    setEditingWorkerForSchedule(null);
    setScheduleFormActionError(null);
  };
  const handleSubmitWorkerSchedule = async (formData: WorkerScheduleSubmitData) => {
    if (!editingWorkerForSchedule) return;
    setIsProcessingScheduleForm(true);
    setScheduleFormActionError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/workers/${editingWorkerForSchedule.id}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || 'Neuspešno ažuriranje rasporeda radnika.');
      fetchWorkersAndSchedules();
      handleCloseScheduleForm();
    } catch (err) {
      setScheduleFormActionError(err instanceof Error ? err.message : 'Došlo je do greške prilikom ažuriranja rasporeda.');
    } finally {
      setIsProcessingScheduleForm(false);
    }
  };

  const handleDeleteRequest = (worker: WorkerWithDetails) => {
    setWorkerToDelete(worker);
    setShowDeleteConfirm(true);
    setDeleteActionError(null);
  };
  const handleCloseDeleteModal = () => {
    setWorkerToDelete(null);
    setShowDeleteConfirm(false);
    setDeleteActionError(null);
  };
  const confirmDeleteWorker = async () => {
    if (!workerToDelete) return;
    setIsProcessingDelete(true);
    setProcessingWorkerId(workerToDelete.id);
    setDeleteActionError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/workers/${workerToDelete.id}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.message || 'Brisanje radnika nije uspelo.');
      fetchWorkersAndSchedules();
      handleCloseDeleteModal();
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : 'Greška prilikom brisanja.');
    } finally {
      setIsProcessingDelete(false);
      setProcessingWorkerId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-base-content/70">Učitavanje radnika...</p>
      </div>
    );
  }
  if (error && !isLoading) {
    return (
      <div role="alert" className="alert alert-error my-6">
        <AlertTriangle className="h-6 w-6"/>
        <div><h3 className="font-bold">Greška!</h3><div className="text-xs">{error}</div></div>
        <button className="btn btn-sm btn-ghost" onClick={() => { fetchWorkersAndSchedules(); fetchVendorServices(); }}>Pokušaj ponovo</button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex justify-end items-center mb-6">
        <button onClick={() => handleOpenDetailsForm()} className="btn btn-primary btn-sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Dodaj Radnika
        </button>
      </div>

      <WorkerList
        workers={workers}
        onEdit={handleOpenDetailsForm}
        onDeleteRequest={handleDeleteRequest}
        onManageServices={handleOpenServicesForm}
        onManageSchedule={handleOpenScheduleForm}
        isProcessingDelete={isProcessingDelete}
        processingWorkerId={processingWorkerId}
      />

      <WorkerDetailsForm
        isOpen={isDetailsFormOpen}
        onClose={handleCloseDetailsForm}
        onSubmit={handleSubmitDetailsForm}
        initialData={editingWorker}
        isProcessing={isProcessingDetailsForm}
        actionError={detailsFormActionError}
      />
      <WorkerServicesForm
        isOpen={isServicesFormOpen}
        onClose={handleCloseServicesForm}
        onSubmit={handleSubmitWorkerServices}
        worker={editingWorker}
        allVendorServices={allVendorServices}
        isProcessing={isProcessingServicesForm}
        actionError={serviceAssignmentError}
      />

      <WorkerScheduleForm
        isOpen={isScheduleFormOpen}
        onClose={handleCloseScheduleForm}
        onSubmit={handleSubmitWorkerSchedule}
        workerName={editingWorkerForSchedule?.name || null}
        initialAvailabilities={editingWorkerForSchedule?.availabilities || []}
        initialOverrides={editingWorkerForSchedule?.scheduleOverrides || []}
        isProcessing={isProcessingScheduleForm}
        actionError={scheduleFormActionError}
      />

      {showDeleteConfirm && workerToDelete && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Potvrda Brisanja Radnika</h3>
             <button type="button" onClick={handleCloseDeleteModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessingDelete}>✕</button>
            <p className="py-4">Da li ste sigurni da želite da obrišete radnika &quot;<strong>{workerToDelete.name}</strong>&quot;? Ova akcija se ne može opozvati.</p>
            {deleteActionError && ( <div role="alert" className="alert alert-warning text-xs p-2 my-2"> <AlertTriangle className="w-4 h-4" /> <span>{deleteActionError}</span> </div> )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={handleCloseDeleteModal} disabled={isProcessingDelete}>Otkaži</button>
              <button type="button" className="btn btn-error" onClick={confirmDeleteWorker} disabled={isProcessingDelete}>
                {isProcessingDelete ? <Loader2 size={16} className="animate-spin" /> : ''} Da, obriši radnika
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button type="button" onClick={handleCloseDeleteModal} disabled={isProcessingDelete}>close</button></form>
        </dialog>
      )}
    </div>
  );
}
