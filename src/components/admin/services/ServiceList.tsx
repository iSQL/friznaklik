
import ServiceItem from './ServiceItem';
import { Service } from './AdminServicesClient'; 
import { UserRole } from '@/lib/types/prisma-enums'; 

interface ServiceListProps {
  services: Service[];
  onDelete: (serviceId: string) => Promise<void>;
  userRole: UserRole; 
}

export default function ServiceList({ services, onDelete, userRole }: ServiceListProps) {
  if (!services || services.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 text-lg">Nema pronađenih usluga.</p>
        { (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.VENDOR_OWNER) && (
            <p className="mt-2 text-sm text-gray-400">
                Možete dodati novu uslugu koristeći dugme &quot;Dodaj Novu Uslugu&quot;.
            </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services.map((service) => (
        <ServiceItem 
          key={service.id} 
          service={service} 
          onDelete={onDelete}
          userRole={userRole}
        />
      ))}
    </div>
  );
}
