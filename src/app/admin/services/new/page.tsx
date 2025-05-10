import ServiceForm from '@/components/admin/services/ServiceForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewServicePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-base-content">Add New Service</h1>
        <Link href="/admin/services" className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Services
        </Link>
      </div>

      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <ServiceForm />
        </div>
      </div>
    </div>
  );
}
