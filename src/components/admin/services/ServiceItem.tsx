'use client';

import { Service } from '@prisma/client';
import { Edit3, Trash2 } from 'lucide-react';

interface ServiceItemProps {
  service: Service;
  onEditClick: (service: Service) => void;
  onDeleteClick: (service: Service) => void;
}

export default function ServiceItem({ service, onEditClick, onDeleteClick }: ServiceItemProps) {
  const handleAttemptDelete = () => {
    onDeleteClick(service);
  };

  return (
    <tr className="hover group"> 
      <td className="text-base-content font-medium px-3 py-3 sm:px-4 sm:py-3 align-middle"> 
        {service.name}
      </td>
      <td className="text-base-content px-3 py-3 sm:px-4 sm:py-3 align-middle">
        {service.duration} min
      </td>
      <td className="text-base-content px-3 py-3 sm:px-4 sm:py-3 align-middle">
        {service.price.toFixed(2)} RSD
      </td>
      <td className="text-right px-3 py-3 sm:px-4 sm:py-3 align-middle">
        <div className="flex items-center justify-end space-x-1 sm:space-x-2">
          <button
            onClick={() => onEditClick(service)}
            className="btn btn-xs sm:btn-sm btn-ghost btn-square text-info hover:bg-info hover:text-info-content" 
            aria-label="Izmeni uslugu" 
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={handleAttemptDelete}
            className="btn btn-xs sm:btn-sm btn-ghost btn-square text-error hover:bg-error hover:text-error-content" 
            aria-label="Obriši uslugu" 
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
