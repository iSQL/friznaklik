// src/components/admin/workers/VendorWorkersManager.tsx
'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { UserRole, Worker as PrismaWorker } from '@prisma/client';
import { PlusCircle, Edit3, Trash2, AlertTriangle, Users2, Loader2, Image as ImageIcon, Link2, Info } from 'lucide-react';

// Define the Worker type for the frontend
export interface WorkerWithOptionalUser extends PrismaWorker {
  user?: {
    email: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

interface WorkerFormData {
  name: string;
  bio: string | null;
  photoUrl: string | null;
  userClerkId: string | null;
}

interface VendorWorkersManagerProps {
  vendorId: string; // The ID of the vendor whose workers are being managed
  // userRole: UserRole; // Potentially useful if SUPER_ADMIN has slightly different UI than VENDOR_OWNER on this component
}

// WorkerForm Component (can be shared or slightly adapted if needed)
const WorkerForm = ({
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
  initialData?: WorkerWithOptionalUser | null;
  isProcessing: boolean;
  actionError: string | null;
}) => {
  const [formData, setFormData] = useState<WorkerFormData>({
    name: '',
    bio: null,
    photoUrl: null,
    userClerkId: null,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        bio: initialData.bio || null,
        photoUrl: initialData.photoUrl || null,
        userClerkId: initialData.userId || null, // Assuming initialData.userId is the Clerk ID if fetched with user relation
      });
    } else {
      setFormData({ name: '', bio: null, photoUrl: null, userClerkId: null });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value || null }));
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
            <label htmlFor="workerFormUserClerkId" className="label">
              <span className="label-text">Poveži sa Korisnikom (Clerk ID - opciono)</span>
            </label>
             <div className="input-group">
                <span className="bg-base-200"><Link2 size={18}/></span>
                <input
                type="text"
                id="workerFormUserClerkId"
                name="userClerkId"
                value={formData.userClerkId || ''}
                onChange={handleChange}
                placeholder="user_xxxxxxxxxxxxxxxxx"
                className="input input-bordered w-full"
                disabled={isProcessing || !!initialData?.userId}
                />
            </div>
            {initialData?.userId && (
                <p className="text-xs text-warning mt-1">Povezivanje sa korisnikom se ne može menjati nakon kreiranja radnika.</p>
            )}
            {!initialData?.userId && (
                 <p className="text-xs text-info mt-1 flex items-start">
                    <Info size={14} className="mr-1 mt-0.5 shrink-0"/>
                    <span>Ako se unese, ovaj radnik će biti povezan sa postojećim korisničkim nalogom na platformi.</span>
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
        <button onClick={onClose} disabled={isProcessing}>close</button>
      </form>
    </dialog>
  );
};

// WorkerList Component (can be shared or slightly adapted)
const WorkerList = ({
  workers,
  onEdit,
  onDeleteRequest,
  isProcessingDelete,
  processingWorkerId,
}: {
  workers: WorkerWithOptionalUser[];
  onEdit: (worker: WorkerWithOptionalUser) => void;
  onDeleteRequest: (worker: WorkerWithOptionalUser) => void;
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
            <th>Biografija</th>
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
                        <img src={worker.photoUrl} alt={worker.name} onError={(e) => e.currentTarget.src = `https://placehold.co/48x48/E0E0E0/B0B0B0?text=${worker.name.charAt(0)}&font=roboto`} />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-xl font-semibold text-base-content/70">
                          {worker.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-base-content">{worker.name}</div>
                    <div className="text-xs opacity-60 font-mono">{worker.id}</div>
                  </div>
                </div>
              </td>
              <td className="max-w-xs whitespace-nowrap overflow-hidden text-ellipsis text-sm text-base-content/80" title={worker.bio || undefined}>
                {worker.bio || <span className="italic text-base-content/50">Nema biografije</span>}
              </td>
              <td className="text-sm text-base-content/80">
                {worker.user?.email || <span className="italic text-base-content/50">Nije povezan</span>}
              </td>
              <td className="text-right">
                <div className="flex space-x-2 justify-end">
                  <button onClick={() => onEdit(worker)} className="btn btn-outline btn-primary btn-xs" title="Izmeni Radnika">
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

// Main Client Component for managing workers of a specific vendor
export default function VendorWorkersManager({ vendorId }: VendorWorkersManagerProps) {
  const [workers, setWorkers] = useState<WorkerWithOptionalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formActionError, setFormActionError] = useState<string | null>(null);
  const [deleteActionError, setDeleteActionError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerWithOptionalUser | null>(null);
  const [isProcessingForm, setIsProcessingForm] = useState(false);

  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [processingWorkerId, setProcessingWorkerId] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<WorkerWithOptionalUser | null>(null);

  const fetchWorkers = useCallback(async () => {
    if (!vendorId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/workers`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Neuspešno preuzimanje radnika: ${response.statusText}` }));
        throw new Error(errorData.message || `Neuspešno preuzimanje radnika: ${response.statusText}`);
      }
      const data: WorkerWithOptionalUser[] = await response.json();
      // Assuming the API returns linked user details if available
      setWorkers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do nepoznate greške.');
    } finally {
      setIsLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleOpenForm = (worker: WorkerWithOptionalUser | null = null) => {
    setEditingWorker(worker);
    setIsFormOpen(true);
    setFormActionError(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingWorker(null);
    setFormActionError(null);
  };

  const handleSubmitForm = async (formData: WorkerFormData) => {
    setIsProcessingForm(true);
    setFormActionError(null);
    const url = editingWorker
      ? `/api/admin/vendors/${vendorId}/workers/${editingWorker.id}`
      : `/api/admin/vendors/${vendorId}/workers`;
    const method = editingWorker ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || responseData.errors?.[Object.keys(responseData.errors)[0]]?.[0] || `Neuspešno ${editingWorker ? 'ažuriranje' : 'dodavanje'} radnika.`);
      }
      fetchWorkers();
      handleCloseForm();
    } catch (err) {
      setFormActionError(err instanceof Error ? err.message : 'Došlo je do greške.');
    } finally {
      setIsProcessingForm(false);
    }
  };

  const handleDeleteRequest = (worker: WorkerWithOptionalUser) => {
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
      const response = await fetch(`/api/admin/vendors/${vendorId}/workers/${workerToDelete.id}`, {
        method: 'DELETE',
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Brisanje radnika nije uspelo.');
      }
      fetchWorkers();
      handleCloseDeleteModal();
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : 'Došlo je do nepoznate greške prilikom brisanja.');
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

  if (error) {
    return (
      <div role="alert" className="alert alert-error my-6">
        <AlertTriangle className="h-6 w-6"/>
        <div>
            <h3 className="font-bold">Greška!</h3>
            <div className="text-xs">Greška pri učitavanju radnika: {error}</div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={fetchWorkers}>Pokušaj ponovo</button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex justify-end items-center mb-6">
        <button onClick={() => handleOpenForm()} className="btn btn-primary btn-sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Dodaj Radnika
        </button>
      </div>

      <WorkerList
        workers={workers}
        onEdit={handleOpenForm}
        onDeleteRequest={handleDeleteRequest}
        isProcessingDelete={isProcessingDelete}
        processingWorkerId={processingWorkerId}
      />

      <WorkerForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        initialData={editingWorker}
        isProcessing={isProcessingForm}
        actionError={formActionError}
      />

      {showDeleteConfirm && workerToDelete && (
        <dialog open className="modal modal-bottom sm:modal-middle modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error">Potvrda Brisanja Radnika</h3>
             <button onClick={handleCloseDeleteModal} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isProcessingDelete}>✕</button>
            <p className="py-4">
              Da li ste sigurni da želite da obrišete radnika "<strong>{workerToDelete.name}</strong>"?
              Ova akcija se ne može opozvati.
            </p>
            {deleteActionError && (
              <div role="alert" className="alert alert-warning text-xs p-2 my-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{deleteActionError}</span>
              </div>
            )}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={handleCloseDeleteModal} disabled={isProcessingDelete}>
                Otkaži
              </button>
              <button
                className="btn btn-error"
                onClick={confirmDeleteWorker}
                disabled={isProcessingDelete}
              >
                {isProcessingDelete ? <Loader2 size={16} className="animate-spin" /> : ''}
                Da, obriši radnika
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={handleCloseDeleteModal} disabled={isProcessingDelete}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
