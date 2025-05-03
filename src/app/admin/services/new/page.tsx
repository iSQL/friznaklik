// This is a Server Component Page. It runs on the server.
// It lives inside the /admin/services route segment, so it will use the AdminLayout.
// Its purpose is to render the ServiceForm component for adding a new service.

import ServiceForm from '@/components/admin/services/ServiceForm'; // Import the ServiceForm Client Component
import Link from 'next/link'; // Import Link for navigation

export default async function NewServicePage() {
  // This is a simple Server Component page.
  // It doesn't need to fetch any data initially because the ServiceForm
  // is for creating a *new* service, so it doesn't require initialData.

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Add New Service</h1>

      {/* Render the ServiceForm component */}
      {/* We don't pass initialData here because we are adding a new service */}
      {/* The form's default behavior upon success is to redirect to the services list */}
      <ServiceForm />

      {/* Optional: Add a link to go back to the services list */}
      <div className="mt-6">
        <Link href="/admin/services" className="text-indigo-600 hover:text-indigo-900">
          &larr; Back to Services List
        </Link>
      </div>
    </div>
  );
}
