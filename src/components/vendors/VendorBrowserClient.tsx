// src/components/vendors/VendorBrowserClient.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { formatErrorMessage } from '@/lib/errorUtils';
import type { Vendor as PrismaVendor, Service as PrismaService } from '@prisma/client';
import { AlertTriangle, Loader2, Store, SlidersHorizontal, ExternalLink, MapPin, Phone, Info, SearchX } from 'lucide-react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Type for Vendor data received from the API (includes services)
export interface VendorWithServices extends Omit<PrismaVendor, 'operatingHours'> {
  operatingHours?: any | null; // Keep as any for now, or define a stricter type
  services: Array<Pick<PrismaService, 'id' | 'name' | 'description' | 'price' | 'duration'>>;
}

// Type for individual service filter item
interface ServiceFilterItem extends Pick<PrismaService, 'id' | 'name'> {}

// --- VendorCard Component ---
interface VendorCardProps {
  vendor: VendorWithServices;
}

function VendorCard({ vendor }: VendorCardProps) {
  return (
    <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out h-full flex flex-col">
      <div className="card-body flex flex-col flex-grow">
        <h2 className="card-title text-xl text-primary hover:text-primary-focus transition-colors">
          <Link href={`/vendors/${vendor.id}`}>{vendor.name}</Link>
        </h2>
        {vendor.description && (
          <p className="text-sm text-base-content/80 mb-2 line-clamp-3">
            {vendor.description}
          </p>
        )}
        {vendor.address && (
          <p className="text-xs text-base-content/70 flex items-center mb-1">
            <MapPin size={14} className="mr-2 shrink-0" /> {vendor.address}
          </p>
        )}
        {vendor.phoneNumber && (
          <p className="text-xs text-base-content/70 flex items-center">
            <Phone size={14} className="mr-2 shrink-0" /> {vendor.phoneNumber}
          </p>
        )}

        {vendor.services && vendor.services.length > 0 && (
          <div className="mt-3 pt-3 border-t border-base-300/50 flex-grow">
            <h4 className="text-xs font-semibold uppercase text-base-content/60 mb-1.5">Usluge (Top 3):</h4>
            <ul className="space-y-1">
              {vendor.services.slice(0, 3).map(service => (
                <li key={service.id} className="text-xs text-base-content/90">
                  {service.name} - {service.price.toFixed(2)} RSD
                </li>
              ))}
              {vendor.services.length > 3 && (
                <li className="text-xs text-accent italic hover:underline">
                    <Link href={`/vendors/${vendor.id}`}>+ još {vendor.services.length - 3} usluga...</Link>
                </li>
              )}
            </ul>
          </div>
        )}
         {vendor.services.length === 0 && (
            <div className="mt-3 pt-3 border-t border-base-300/50 flex-grow">
                 <p className="text-xs text-base-content/60 italic">Ovaj salon trenutno nema istaknutih usluga.</p>
            </div>
        )}


        <div className="card-actions justify-end mt-auto pt-3">
          <Link href={`/book?vendorId=${vendor.id}`} className="btn btn-sm btn-secondary">
            Zakaži
          </Link>
          <Link href={`/vendors/${vendor.id}`} className="btn btn-sm btn-primary btn-outline">
            Detalji <ExternalLink size={14} className="ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- VendorServiceFilter Component ---
interface VendorServiceFilterProps {
  allServices: ServiceFilterItem[];
  selectedServices: string[];
  onFilterChange: (serviceId: string, isSelected: boolean) => void;
  isLoading: boolean;
}

function VendorServiceFilter({ allServices, selectedServices, onFilterChange, isLoading }: VendorServiceFilterProps) {
  if (isLoading) {
    return (
        <div className="card bg-base-200 shadow animate-pulse">
            <div className="card-body">
                <div className="h-6 bg-base-300 rounded w-3/4 mb-4"></div>
                 <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-2">
                        <div className="h-5 w-5 bg-base-300 rounded"></div>
                        <div className="h-5 bg-base-300 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  }
  
  if (!allServices || allServices.length === 0) {
    return (
        <div className="card bg-base-200 shadow">
            <div className="card-body">
                <h3 className="card-title text-md">Filter po Uslugama</h3>
                <p className="text-sm text-base-content/70">Nema dostupnih usluga za filtriranje.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-md sticky top-24"> {/* sticky for filter */}
      <div className="card-body">
        <h3 className="card-title text-md flex items-center">
            <SlidersHorizontal size={18} className="mr-2"/> Filter po Uslugama
        </h3>
        <div className="form-control space-y-1 max-h-96 overflow-y-auto pr-1">
          {allServices.map(service => (
            <label key={service.id} className="label cursor-pointer hover:bg-base-300/50 rounded-md p-2 -m-2 transition-colors">
              <span className="label-text text-sm">{service.name}</span>
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={selectedServices.includes(service.id)}
                onChange={(e) => onFilterChange(service.id, e.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}


// --- Main VendorBrowserClient Component ---
export default function VendorBrowserClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict

  const [vendors, setVendors] = useState<VendorWithServices[]>([]);
  const [allAvailableServices, setAllAvailableServices] = useState<ServiceFilterItem[]>([]);
  const [selectedServiceFilters, setSelectedServiceFilters] = useState<string[]>([]);

  const [isLoadingVendors, setIsLoadingVendors] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from URL on mount
  useEffect(() => {
    const serviceIdsFromUrl = searchParamsHook.get('serviceIds')?.split(',') || [];
    setSelectedServiceFilters(serviceIdsFromUrl.filter(id => id));
  }, [searchParamsHook]);

  // Fetch all unique services for filtering options
  useEffect(() => {
    const fetchAllServicesForFilter = async () => {
      setIsLoadingServices(true);
      try {
        // This API call should return all distinct, active services available across all active vendors
        const response = await fetch(`${SITE_URL}/api/services?distinct=true&activeOnly=true`);
        if (!response.ok) {
          throw new Error('Neuspešno preuzimanje liste usluga za filter.');
        }
        const data: PrismaService[] = await response.json();
        // Map to only id and name for filter items, and remove duplicates by name
        const uniqueServicesMap = new Map<string, ServiceFilterItem>();
        data.forEach(service => {
            if (!uniqueServicesMap.has(service.name.toLowerCase())) { // Deduplicate by name
                uniqueServicesMap.set(service.name.toLowerCase(), { id: service.id, name: service.name });
            }
        });
        setAllAvailableServices(Array.from(uniqueServicesMap.values()).sort((a,b) => a.name.localeCompare(b.name)));
      } catch (err) {
        setError(formatErrorMessage(err, "preuzimanja usluga za filter"));
      } finally {
        setIsLoadingServices(false);
      }
    };
    fetchAllServicesForFilter();
  }, []);

  // Fetch vendors based on current filters
  const fetchVendors = useCallback(async (serviceIds: string[]) => {
    setIsLoadingVendors(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (serviceIds.length > 0) {
        queryParams.set('serviceIds', serviceIds.join(','));
      }
      const response = await fetch(`${SITE_URL}/api/vendors?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { message: `Neuspešno preuzimanje salona: ${response.status}`, status: response.status, details: errorData.message || response.statusText };
      }
      const data: VendorWithServices[] = await response.json();
      setVendors(data);
    } catch (err) {
      setError(formatErrorMessage(err, "preuzimanja salona"));
    } finally {
      setIsLoadingVendors(false);
    }
  }, []);

  // Effect to fetch vendors when filters change
  useEffect(() => {
    fetchVendors(selectedServiceFilters);

    // Update URL query params
    const current = new URLSearchParams(Array.from(searchParamsHook.entries()));
    if (selectedServiceFilters.length > 0) {
      current.set('serviceIds', selectedServiceFilters.join(','));
    } else {
      current.delete('serviceIds');
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.replace(`${pathname}${query}`, { scroll: false }); // Use replace to avoid polluting history too much

  }, [selectedServiceFilters, fetchVendors, pathname, router, searchParamsHook]);


  const handleServiceFilterChange = (serviceId: string, isSelected: boolean) => {
    setSelectedServiceFilters(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(serviceId);
      } else {
        newSet.delete(serviceId);
      }
      return Array.from(newSet);
    });
  };


  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <aside className="lg:w-1/4 xl:w-1/5">
        <VendorServiceFilter
          allServices={allAvailableServices}
          selectedServices={selectedServiceFilters}
          onFilterChange={handleServiceFilterChange}
          isLoading={isLoadingServices}
        />
      </aside>

      <main className="lg:w-3/4 xl:w-4/5">
        {isLoadingVendors && !error && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-3 text-lg text-base-content/70">Pretraživanje salona...</p>
          </div>
        )}
        {error && (
          <div role="alert" className="alert alert-error">
            <AlertTriangle />
            <span>{error}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => fetchVendors(selectedServiceFilters)}>Pokušaj ponovo</button>
          </div>
        )}
        {!isLoadingVendors && !error && vendors.length === 0 && (
          <div className="text-center py-20 card bg-base-100 shadow-md">
            <div className='card-body items-center'>
              <SearchX size={64} className="text-base-content/30 mb-4" />
              <p className="text-xl text-base-content/70 font-semibold">Nema salona koji odgovaraju filterima.</p>
              <p className="text-base-content/60 mt-1">Pokušajte da promenite ili uklonite filtere.</p>
            </div>
          </div>
        )}
        {!isLoadingVendors && !error && vendors.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {vendors.map(vendor => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}