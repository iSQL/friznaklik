import ServiceForm from '@/components/admin/services/ServiceForm';
import Link from 'next/link';
import { ArrowLeft, PlusCircle } from 'lucide-react'; 

export default async function NewServicePage() {
  return (
    <div className="container mx-auto px-4 py-8"> 
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4"> 
        <div className="flex items-center">
          <PlusCircle className="h-8 w-8 mr-3 text-primary" /> 
          <h1 className="text-2xl sm:text-3xl font-bold text-base-content">Dodaj novu uslugu</h1>
        </div>
        <Link href="/admin/services" className="btn btn-ghost btn-sm sm:btn-md self-start sm:self-center"> 
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nazad na usluge
        </Link>
      </div>

      <div className="card bg-base-100 shadow-xl border border-base-300"> 
        <div className="card-body p-4 sm:p-6 md:p-8">
          <ServiceForm />
        </div>
      </div>
    </div>
  );
}