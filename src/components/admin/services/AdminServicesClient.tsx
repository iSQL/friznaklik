'use client';

import { Service } from '@prisma/client';
import ServiceList from './ServiceList';
import ServiceForm from './ServiceForm';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, AlertTriangle } from 'lucide-react';

interface AdminServicesClientProps {
  services: Service[];
}

export default function AdminServicesClient({ services }: AdminServicesClientProps) {
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();
  const addServiceModalRef = useRef<HTMLDialogElement>(null);
  const editServiceModalRef = useRef<HTMLDialogElement>(null);
  const confirmDeleteModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (serviceToEdit && editServiceModalRef.current && !editServiceModalRef.current.open) {
      editServiceModalRef.current.showModal();
    }
  }, [serviceToEdit]);

  useEffect(() => {
    if (isAddModalOpen && addServiceModalRef.current && !addServiceModalRef.current.open) {
      addServiceModalRef.current.showModal();
    }
    // No automatic close via useEffect for add modal, rely on explicit close handlers
  }, [isAddModalOpen]);

  useEffect(() => {
    if (serviceToDelete && confirmDeleteModalRef.current && !confirmDeleteModalRef.current.open) {
      confirmDeleteModalRef.current.showModal();
    }
  }, [serviceToDelete]);

  const handleEditClick = (service: Service) => {
    setServiceToEdit(service);
  };

  const handleCloseEditModal = () => {
    editServiceModalRef.current?.close();
    setServiceToEdit(null);
  };

  const handleEditSuccess = () => {
    editServiceModalRef.current?.close();
    setServiceToEdit(null);
    router.refresh();
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    addServiceModalRef.current?.close();
    setIsAddModalOpen(false);
  };

  const handleAddSuccess = () => {
    addServiceModalRef.current?.close();
    setIsAddModalOpen(false);
    router.refresh();
  };

  const handleDeleteClick = (service: Service) => {
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
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} ${errorText}`);
      }
      router.refresh();
    } catch (err) {
      alert(`Failed to delete service: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
    } finally {
      setIsDeleting(false);
      handleCloseDeleteConfirmModal();
    }
  };

  return (
    <div className="bg-base-100 p-4 md:p-6 rounded-box shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-base-content">Manage Services</h1>
        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <PlusCircle className="h-5 w-5 mr-2" />
          Add New Service
        </button>
      </div>

      <ServiceList
        services={services}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <dialog ref={editServiceModalRef} className="modal">
        <div className="modal-box w-11/12 max-w-lg bg-base-200">
          <form method="dialog">
            <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={handleCloseEditModal}>✕</button>
          </form>
          {serviceToEdit && (
            <>
              <h3 className="font-bold text-xl mb-4 text-base-content">Edit Service</h3>
              <ServiceForm
                initialData={serviceToEdit}
                onSuccess={handleEditSuccess}
                onCancel={handleCloseEditModal}
              />
            </>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseEditModal}>close</button>
        </form>
      </dialog>

      <dialog ref={addServiceModalRef} className="modal">
        <div className="modal-box w-11/12 max-w-lg bg-base-200">
           <form method="dialog">
             <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={handleCloseAddModal}>✕</button>
           </form>
           {isAddModalOpen && (
            <>
              <h3 className="font-bold text-xl mb-4 text-base-content">Add New Service</h3>
              <ServiceForm
                  onSuccess={handleAddSuccess}
                  onCancel={handleCloseAddModal}
              />
            </>
           )}
        </div>
        <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={handleCloseAddModal}>close</button>
        </form>
      </dialog>

      <dialog ref={confirmDeleteModalRef} className="modal">
        <div className="modal-box w-11/12 max-w-md bg-base-200">
          <form method="dialog">
              <button type="button" className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={handleCloseDeleteConfirmModal}>✕</button>
          </form>
          {serviceToDelete && (
            <>
              <div className="flex items-center mb-4">
                  <AlertTriangle className="h-10 w-10 text-error mr-3" />
                  <h3 className="font-bold text-xl text-base-content">Confirm Deletion</h3>
              </div>
              <p className="py-4 text-base-content">
                Are you sure you want to delete the service &quot;{serviceToDelete.name}&quot;? This action cannot be undone.
              </p>
            </>
          )}
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={handleCloseDeleteConfirmModal} disabled={isDeleting}>
              Cancel
            </button>
            <button className="btn btn-error" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <span className="loading loading-spinner"></span> : 'Delete Service'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCloseDeleteConfirmModal}>close</button>
        </form>
      </dialog>
    </div>
  );
}
