import Link from 'next/link';
import { UserRole } from '@/lib/types/prisma-enums';
import { Service } from './AdminServicesClient';
import { Edit3, Trash2, DollarSign, Clock } from 'lucide-react';

interface ServiceItemProps {
  service: Service;
  onDelete: (serviceId: string) => Promise<void>;
  userRole: UserRole;
}

export default function ServiceItem({ service, onDelete, userRole }: ServiceItemProps) {
  const formattedPrice = new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'RSD' }).format(service.price);

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out flex flex-col h-full">
      <div className="card-body flex flex-col flex-grow"> {/* flex-grow da bi sadržaj zauzeo prostor */}
        <h2 className="card-title text-xl font-semibold text-gray-800 dark:text-gray-100">{service.name}</h2>
        
        {userRole === UserRole.SUPER_ADMIN && service.vendor && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
            Salon: {service.vendor.name} <span className="text-gray-400 dark:text-gray-500">(ID: {service.vendor.id})</span>
          </p>
        )}

        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-1 mt-2">
          <Clock className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
          <span>Trajanje: {service.duration} minuta</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-3">
          <DollarSign className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
          <span>Cena: {formattedPrice}</span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed flex-grow"> {/* flex-grow za opis */}
          {service.description || <span className="italic text-gray-500 dark:text-gray-400">Nema dostupnog opisa.</span>}
        </p>
        
        <div className="card-actions justify-end mt-4 pt-4 border-t border-base-300"> {/* mt-auto da gurne na dno ako je Card flex-col */}
          <Link href={`/admin/services/edit/${service.id}`} className="btn btn-outline btn-sm">
            <Edit3 className="mr-1 h-4 w-4" /> Izmeni
          </Link>
          <button className="btn btn-error btn-sm" onClick={() => onDelete(service.id)}>
            <Trash2 className="mr-1 h-4 w-4" /> Obriši
          </button>
        </div>
      </div>
    </div>
  );
}
