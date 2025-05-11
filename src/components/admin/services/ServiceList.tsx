'use client';

import { Service } from '@prisma/client';
import ServiceItem from './ServiceItem';
import { PackageOpen, Settings, Clock, Tag } from 'lucide-react'; 

interface ServiceListProps {
  services: Service[];
  onEditClick: (service: Service) => void;
  onDeleteClick: (service: Service) => void;
}

export default function ServiceList({ services, onEditClick, onDeleteClick }: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16 bg-base-100 border border-base-300 rounded-box shadow-md p-4">
        <PackageOpen className="h-14 w-14 sm:h-16 sm:w-16 mx-auto text-base-content opacity-40 mb-5" />
        <p className="text-xl font-semibold text-base-content mb-1">Nema dostupnih usluga.</p>
        <p className="text-base-content opacity-70">
          Dodajte novu uslugu da biste započeli sa radom.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-base-100 border border-base-300 rounded-box shadow-md"> 
      <table className="table table-zebra w-full table-fixed sm:table-auto"> 
        <thead className="bg-base-200">
          <tr>
            <th className="text-base-content px-3 py-3 sm:px-4 sm:py-3 w-2/5 sm:w-auto"> 
                <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 opacity-70 hidden sm:inline-block" />
                    Naziv
                </div>
            </th>
            <th className="text-base-content px-3 py-3 sm:px-4 sm:py-3 w-1/5 sm:w-auto">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 opacity-70 hidden sm:inline-block" />
                    Trajanje
                </div>
            </th>
            <th className="text-base-content px-3 py-3 sm:px-4 sm:py-3 w-1/5 sm:w-auto">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm opacity-70 hidden sm:inline-block">RSD</span>
                    Cena
                </div>
            </th>
            <th className="text-right text-base-content px-3 py-3 sm:px-4 sm:py-3 w-1/5 sm:w-auto">
                <div className="flex items-center justify-end gap-2">
                    <Settings className="h-4 w-4 opacity-70 hidden sm:inline-block" />
                    Akcije
                </div>
            </th>
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
