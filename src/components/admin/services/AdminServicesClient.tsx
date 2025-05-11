'use client';

import { Service } from '@prisma/client';
import ServiceList from './ServiceList';
import ServiceForm from './ServiceForm';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, AlertTriangle, Edit3, Trash2, CheckCircle2 } from 'lucide-react'; 

interface AdminServicesClientProps {
  services: Service[];
}

export default function AdminServicesClient({ services }: AdminServicesClientProps) {
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const router = useRouter();
  const addServiceModalRef = useRef<HTMLDialogElement>(null);
  const editServiceModalRef = useRef<HTMLDialogElement>(null);
  const confirmDeleteModalRef = useRef<HTMLDialogElement>(null);

   const showFeedback = (type: 'success' | 'error', message: string) => {
     setFeedbackMessage({ type, message });
     setTimeout(() => setFeedbackMessage(null), 4000);
   };

  useEffect(() => {
    if (serviceToEdit && editServiceModalRef.current && !editServiceModalRef.current.open) {
      editServiceModalRef.current.showModal();
    }
  }, [serviceToEdit]);

  useEffect(() => {
    if (isAddModalOpen && addServiceModalRef.current && !addServiceModalRef.current.open) {
      addServiceModalRef.current.showModal();
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (serviceToDelete && confirmDeleteModalRef.current && !confirmDeleteModalRef.current.open) {
      confirmDeleteModalRef.current.showModal();
    }
  }, [serviceToDelete]);

  const handleEditClick = (service: Service) => {
    setFeedbackMessage(null); 
    setServiceToEdit(service);
  };

  const handleCloseEditModal = () => {
    editServiceModalRef.current?.close();
    setServiceToEdit(null);
  };

  const handleEditSuccess = () => {
    editServiceModalRef.current?.close();
    setServiceToEdit(null);
    showFeedback('success', 'Usluga je uspešno ažurirana!');
    router.refresh();
  };

  const handleOpenAddModal = () => {
    setFeedbackMessage(null); 
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    addServiceModalRef.current?.close();
    setIsAddModalOpen(false);
  };

  const handleAddSuccess = () => {
    addServiceModalRef.current?.close();
    setIsAddModalOpen(false);
    showFeedback('success', 'Nova usluga je uspešno dodata!');
    router.refresh();
  };

  const handleDeleteClick = (service: Service) => {
    setFeedbackMessage(null); 
    setServiceToDelete(service);
  };

  const handleCloseDeleteConfirmModal = () => {
    confirmDeleteModalRef.current?.close();
    setServiceToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/admin/services/${serviceToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Brisanje nije uspelo: Status ${response.status}` }));
        throw new Error(errorData.message || `Brisanje nije uspelo: Status ${response.status}`);
      }
      showFeedback('success', `Usluga "${serviceToDelete.name}" je uspešno obrisana.`);
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Došlo je do nepoznate greške.';
      showFeedback('error', `Greška pri brisanju usluge: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
      handleCloseDeleteConfirmModal();
    }
  };

  return (
    <div className="bg-base-100 p-4 md:p-6 rounded-box shadow-xl">
       {feedbackMessage && (
        <div className={`alert ${feedbackMessage.type === 'success' ? 'alert-success' : 'alert-error'} shadow-lg mb-4`}>
          <div>
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            <span>{feedbackMessage.message}</span>
          </div>
        </div>
      )} 

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full flex justify-end"> 
            <button onClick={handleOpenAddModal} className="btn btn-primary">
            <PlusCircle className="h-5 w-5 mr-2" />
            Dodaj novu uslugu
            </button>
        </div>
      </div>

      <ServiceList
        services={services}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />
      <dialog ref={editServiceModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-lg bg-base-100 border border-base-300"> 
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10" onClick={handleCloseEditModal}>✕</button>
          </form>
          {serviceToEdit && (
            <>
              <div className="flex items-center mb-4">
                <Edit3 className="h-6 w-6 mr-2 text-secondary"/>
                <h3 className="font-bold text-xl text-base-content">Izmeni uslugu</h3>
              </div>
              <ServiceForm
                initialData={serviceToEdit}
                onSuccess={handleEditSuccess}
                onCancel={handleCloseEditModal}
              />
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseEditModal}>Zatvori</button>
        </form>
      </dialog>

      <dialog ref={addServiceModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-lg bg-base-100 border border-base-300"> 
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10" onClick={handleCloseAddModal}>✕</button>
          </form>
          {isAddModalOpen && ( 
            <>
              <div className="flex items-center mb-4">
                  <PlusCircle className="h-6 w-6 mr-2 text-primary"/>
                  <h3 className="font-bold text-xl text-base-content">Dodaj novu uslugu</h3>
              </div>
              <ServiceForm
                onSuccess={handleAddSuccess}
                onCancel={handleCloseAddModal}
              />
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseAddModal}>Zatvori</button>
        </form>
      </dialog>

      <dialog ref={confirmDeleteModalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-md bg-base-100 border border-base-300"> 
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 z-10" onClick={handleCloseDeleteConfirmModal} disabled={isDeleting}>✕</button>
          </form>
          {serviceToDelete && (
            <>
              <div className="flex items-start mb-1"> 
                <AlertTriangle className="h-10 w-10 text-error mr-3 flex-shrink-0 mt-1" /> 
                <div>
                    <h3 className="font-bold text-xl text-base-content">Potvrda brisanja</h3>
                    <p className="py-4 text-base-content/80"> 
                    Da li ste sigurni da želite da obrišete uslugu &quot;{serviceToDelete.name}&quot;? Ova akcija se ne može opozvati.
                    </p>
                </div>
              </div>
            </>
          )}
          <div className="modal-action mt-2"> 
            <button className="btn btn-ghost" onClick={handleCloseDeleteConfirmModal} disabled={isDeleting}>
              Otkaži
            </button>
            <button className="btn btn-error" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <span className="loading loading-spinner loading-sm"></span> : <><Trash2 className="h-4 w-4 mr-2"/>Obriši uslugu</>}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseDeleteConfirmModal} disabled={isDeleting}>Zatvori</button>
        </form>
      </dialog>
    </div>
  );
}