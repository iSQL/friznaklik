// src/components/admin/services/EditServiceModal.tsx
'use client'; // This is a Client Component

import { Service } from '@prisma/client'; // Import the Service type
import ServiceForm from './ServiceForm'; // Import the reusable ServiceForm component
import { useState, useEffect } from 'react'; // Import React hooks

// Define the props for the EditServiceModal component
interface EditServiceModalProps {
  // The service data to pre-fill the form. Null means the modal is closed.
  serviceToEdit: Service | null;
  // Callback function to close the modal
  onClose: () => void;
  // Callback function to trigger data revalidation after a successful edit
  onEditSuccess: () => void;
}

// This Client Component acts as a modal wrapper for the ServiceForm
// when editing an existing service.
export default function EditServiceModal({ serviceToEdit, onClose, onEditSuccess }: EditServiceModalProps) {
  // State to control the visibility of the modal
  const [isOpen, setIsOpen] = useState(false);

  // Use useEffect to open/close the modal based on the serviceToEdit prop
  useEffect(() => {
    if (serviceToEdit) {
      console.log('EditServiceModal: serviceToEdit received, opening modal.'); // Debug log
      setIsOpen(true);
    } else {
      console.log('EditServiceModal: serviceToEdit is null, closing modal.'); // Debug log
      setIsOpen(false);
    }
  }, [serviceToEdit]); // Re-run this effect whenever serviceToEdit changes

  // Handle closing the modal
  const handleClose = () => {
    console.log('EditServiceModal: Closing modal.'); // Debug log
    setIsOpen(false);
    onClose(); // Call the onClose prop provided by the parent
  };

  // Handle successful edit submission from the ServiceForm
  const handleEditSuccess = () => {
    console.log('EditServiceModal: Edit successful, calling onEditSuccess and closing.'); // Debug log
    onEditSuccess(); // Trigger data revalidation in the parent
    handleClose(); // Close the modal
  };

  // If the modal is not open, render nothing
  if (!isOpen) {
    console.log('EditServiceModal: Modal is not open, rendering null.'); // Debug log
    return null;
  }

   console.log('EditServiceModal: Modal is open, attempting to render modal structure.'); // Debug log
   // Temporary test render: If you see this text, the modal component is rendering when open.
   // Remove this line after debugging.
   // return <div>Modal is attempting to render!</div>;


  // Render the modal structure
  return (
    // Modal backdrop - covers the background and allows clicking outside to close
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center"
      onClick={handleClose} // Close modal when clicking the backdrop
    >
      {/* Modal content - prevents closing when clicking inside */}
      <div
        className="relative p-8 border w-full max-w-md md:max-w-lg lg:max-w-xl shadow-lg rounded-md bg-white m-4"
        onClick={(e) => e.stopPropagation()} // Prevent click from closing the modal
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Edit Service</h3>
          {/* Close button */}
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times; {/* 'times' symbol for close */}
          </button>
        </div>

        {/* Modal Body - Contains the ServiceForm */}
        <div className="mt-2">
          {/* Render the ServiceForm, passing the service data and success callback */}
          {serviceToEdit && ( // Ensure serviceToEdit is not null before rendering form
            <ServiceForm
              initialData={serviceToEdit} // Pass the service data for editing
              onSuccess={handleEditSuccess} // Pass the success handler for the modal
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Troubleshooting: If the modal does not appear when clicking Edit:
// 1. Verify the file path: src/components/admin/services/EditServiceModal.tsx
// 2. Verify the import in src/components/admin/services/AdminServicesClient.tsx:
//    import EditServiceModal from './EditServiceModal';
// 3. Check terminal logs for "EditServiceModal: serviceToEdit received, opening modal."
//    If this log appears, the modal component is receiving the data and attempting to open.
// 4. Temporarily uncomment the 'return <div>Modal is attempting to render!</div>;' line
//    to see if anything from the modal component renders at all when open.
