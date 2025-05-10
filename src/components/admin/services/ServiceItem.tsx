'use client';

import { Service } from '@prisma/client';
import { Edit3, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ServiceItemProps {
  service: Service;
  onEditClick: (service: Service) => void;
  onDeleteClick: (service: Service) => void; 
}

export default function ServiceItem({ service, onEditClick, onDeleteClick }: ServiceItemProps) {
  const [isProcessingAction] = useState(false);
  const handleAttemptDelete = () => {
    onDeleteClick(service);
  };

  return (
    <tr className="hover">
      <td className="text-base-content font-medium">{service.name}</td>
      <td className="text-base-content">{service.duration} min</td>
      <td className="text-base-content">${service.price.toFixed(2)}</td>
      <td className="text-right">
        <div className="space-x-2">
          <button
            onClick={() => onEditClick(service)}
            className="btn btn-sm btn-ghost btn-square"
            aria-label="Edit Service"
            disabled={isProcessingAction} 
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={handleAttemptDelete}
            className="btn btn-sm btn-ghost btn-square text-error hover:bg-error hover:text-error-content"
            aria-label="Delete Service"
            disabled={isProcessingAction}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
