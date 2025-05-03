// src/components/admin/services/AdminServicesClient.tsx
'use client'; // This is a Client Component

import { Service } from '@prisma/client'; // Import the Service type
import ServiceList from './ServiceList'; // Import the ServiceList component
import EditServiceModal from './EditServiceModal'; // Import the modal component
import { useState } from 'react'; // Import useState for modal state
import { useRouter } from 'next/navigation'; // Import useRouter for revalidation
import Link from 'next/link'; // Import Link for the Add New Service button


// Define the props for the AdminServicesClient component
interface AdminServicesClientProps {
  services: Service[]; // Receives the initial list of services from the Server Component parent
}

// This Client Component receives the initial service data,
// displays the list, and manages the state for the edit modal.
export default function AdminServicesClient({ services }: AdminServicesClientProps) {
  // State to manage which service is being edited (null if no service is being edited)
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);

  const router = useRouter(); // Get the router for revalidation

  // Function to handle when the Edit button is clicked in a ServiceItem
  const handleEditClick = (service: Service) => {
    setServiceToEdit(service); // Set the service to be edited, which opens the modal
  };

  // Function to handle closing the modal
  const handleCloseModal = () => {
    setServiceToEdit(null); // Set serviceToEdit to null, which closes the modal
  };

  // Function to handle successful edit submission from the modal
  const handleEditSuccess = () => {
    console.log('Edit successful, revalidating data...');
    router.refresh(); // Revalidate the data on the page to show updated list
  };

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Services</h1>

      {/* Add a button or link to add a new service */}
       <div className="mb-4">
          {/* Link to the dedicated new service page */}
          <Link href="/admin/services/new" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
            Add New Service
          </Link>
       </div>


      {/* Render the list of services using the ServiceList Client Component */}
      {/* Pass the fetched services data and the handleEditClick callback */}
      <ServiceList services={services} onEditClick={handleEditClick} /> {/* Pass the callback */}

      {/* Render the Edit Service Modal */}
      {/* Pass the service to edit and the close/success callbacks */}
      <EditServiceModal
        serviceToEdit={serviceToEdit}
        onClose={handleCloseModal}
        onEditSuccess={handleEditSuccess}
      />

    </div>
  );
}
