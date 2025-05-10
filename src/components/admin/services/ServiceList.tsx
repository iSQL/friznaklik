'use client';

import { Service } from '@prisma/client';
import ServiceItem from './ServiceItem'; 
import { ListCollapse } from 'lucide-react';

interface ServiceListProps {
  services: Service[];
  onEditClick: (service: Service) => void;
  onDeleteClick: (service: Service) => void;
}

export default function ServiceList({ services, onEditClick, onDeleteClick }: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-10 bg-base-200 rounded-box">
        <ListCollapse className="h-12 w-12 mx-auto text-base-content opacity-50 mb-4" />
        <p className="text-xl font-semibold text-base-content">No services found.</p>
        <p className="text-base-content opacity-70">Add a new service to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-base-200 rounded-box">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th className="text-base-content">Name</th>
            <th className="text-base-content">Duration</th>
            <th className="text-base-content">Price</th>
            <th className="text-right text-base-content">Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
