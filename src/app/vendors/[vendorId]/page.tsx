// src/app/vendors/[vendorId]/page.tsx
import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Vendor, Service as PrismaService, Worker as PrismaWorker, VendorStatus } from '@prisma/client';
import { format, parseISO, isValid } from 'date-fns';
import { srLatn } from 'date-fns/locale';
import { Store, ListOrdered, Users2, MapPin, Phone, ClockIcon, Info, Briefcase, ExternalLink, Sparkles } from 'lucide-react'; // Added Sparkles
import type { Metadata, ResolvingMetadata } from 'next';

interface VendorProfileProps {
  params: { vendorId: string };
}

// Define the types for the data we'll fetch
interface ServiceWithDetails extends Pick<PrismaService, 'id' | 'name' | 'description' | 'price' | 'duration'> {}

interface WorkerWithServices extends Pick<PrismaWorker, 'id' | 'name' | 'bio' | 'photoUrl'> {
  services: Array<Pick<PrismaService, 'id' | 'name'>>; // Services this worker is assigned to
}

interface VendorProfileData extends Pick<Vendor, 'id' | 'name' | 'description' | 'address' | 'phoneNumber' | 'operatingHours' | 'status'> {
  services: ServiceWithDetails[]; // All active services of the vendor
  workers: WorkerWithServices[];  // All workers of the vendor, with their assigned services
}

async function getVendorProfile(vendorId: string): Promise<VendorProfileData | null> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phoneNumber: true,
        operatingHours: true,
        status: true,
        services: { // Fetch all active services offered by this vendor
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
          orderBy: { name: 'asc' },
        },
        workers: { // Fetch all workers associated with this vendor
          select: {
            id: true,
            name: true,
            bio: true,
            photoUrl: true,
            services: { // For each worker, fetch the active services they are specifically assigned to
              where: { active: true },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
      // Do not return non-active vendors for public profiles
      return null;
    }
    return vendor;
  } catch (error) {
    console.error(`Greška pri dobavljanju profila salona ${vendorId}:`, error);
    return null;
  }
}

export async function generateMetadata(
  { params }: VendorProfileProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const vendorId = params.vendorId;
  const vendor = await getVendorProfile(vendorId); // Fetches active vendor

  if (!vendor) {
    return {
      title: 'Salon Nije Pronađen - FrizNaKlik',
      description: 'Traženi salon nije pronađen ili trenutno nije dostupan.',
    };
  }

  const previousImages = (await parent).openGraph?.images || [];
  const serviceNames = vendor.services.map(s => s.name).join(', ');

  return {
    title: `${vendor.name} - Usluge i Rezervacije | FrizNaKlik`,
    description: vendor.description ? `${vendor.description.substring(0, 150)}...` : `Pogledajte usluge (${serviceNames}) i radnike salona ${vendor.name}. Zakažite termin online lako i brzo.`,
    alternates: {
      canonical: `/vendors/${vendor.id}`,
    },
    openGraph: {
      title: `${vendor.name} | FrizNaKlik`,
      description: vendor.description || `Profesionalne frizerske usluge u salonu ${vendor.name}.`,
      // url: `https://yourdomain.com/vendors/${vendor.id}`, // Replace with your actual domain
      // images: [ /* Add relevant images */ ],
      locale: 'sr_RS',
      type: 'profile', // More specific type for OG
    },
    keywords: [vendor.name, 'frizerski salon', 'usluge', 'zakazivanje', ...vendor.services.map(s => s.name)],
  };
}


export default async function VendorProfilePage({ params }: VendorProfileProps) {
  const vendor = await getVendorProfile(params.vendorId);

  if (!vendor) {
    notFound();
  }

  const formatOperatingHours = (operatingHours: any): Array<{ day: string; hours: string }> => {
    if (!operatingHours || typeof operatingHours !== 'object') return [];
    const daysOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const translations: Record<string, string> = {
        monday: "Ponedeljak", tuesday: "Utorak", wednesday: "Sreda",
        thursday: "Četvrtak", friday: "Petak", saturday: "Subota", sunday: "Nedelja"
    };

    return daysOrder
        .map(dayKey => {
            const dayInfo = operatingHours[dayKey];
            const dayName = translations[dayKey] || dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
            if (dayInfo && dayInfo.open && dayInfo.close) {
                return { day: dayName, hours: `${dayInfo.open} - ${dayInfo.close}` };
            }
            return { day: dayName, hours: "Zatvoreno" }; // Show as closed if not defined
        });
  };

  const formattedHours = formatOperatingHours(vendor.operatingHours);

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Vendor Header */}
      <div className="mb-8 p-6 card bg-base-200 shadow-xl border border-base-300/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Store size={48} className="text-primary shrink-0" />
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-1">{vendor.name}</h1>
            {vendor.description && <p className="text-base-content/80 mb-3 prose max-w-none dark:prose-invert">{vendor.description}</p>}
          </div>
        </div>
        <div className="divider my-3">Kontakt & Lokacija</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {vendor.address && (
            <p className="flex items-center"><MapPin size={16} className="mr-2 text-base-content/70 shrink-0" /> {vendor.address}</p>
          )}
          {vendor.phoneNumber && (
            <p className="flex items-center"><Phone size={16} className="mr-2 text-base-content/70 shrink-0" /> {vendor.phoneNumber}</p>
          )}
        </div>
      </div>

      {/* Operating Hours */}
      {formattedHours.length > 0 && (
        <div className="mb-8 p-6 card bg-base-100 shadow-lg">
          <h2 className="text-xl font-semibold mb-3 card-title flex items-center">
            <ClockIcon size={22} className="mr-2 text-secondary" /> Radno Vreme
          </h2>
          <div className="overflow-x-auto">
            <table className="table table-sm w-full max-w-md">
              <tbody>
                {formattedHours.map(item => (
                  <tr key={item.day} className={`${item.hours === 'Zatvoreno' ? 'opacity-60' : ''}`}>
                    <td className="font-medium pr-4">{item.day}:</td>
                    <td>{item.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services Section */}
      <div className="mb-8 p-6 card bg-base-100 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 card-title flex items-center">
          <ListOrdered size={22} className="mr-2 text-accent" /> Usluge Salona
        </h2>
        {vendor.services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vendor.services.map(service => (
              <div key={service.id} className="card card-compact bg-base-200 shadow hover:shadow-md transition-shadow h-full flex flex-col">
                <div className="card-body flex-grow flex flex-col">
                  <h3 className="card-title text-md">{service.name}</h3>
                  {service.description && <p className="text-xs text-base-content/70 mb-1 line-clamp-3 flex-grow min-h-[3em]">{service.description}</p>}
                  <div className="mt-auto">
                    <p className="text-sm font-semibold">{service.price.toFixed(2)} RSD</p>
                    <p className="text-xs text-base-content/70">Trajanje: {service.duration} min</p>
                    <div className="card-actions justify-end mt-2">
                      <Link href={`/book?vendorId=${vendor.id}&serviceId=${service.id}`} className="btn btn-xs btn-primary">
                        Zakaži Ovu Uslugu
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Sparkles size={32} className="text-base-content/30 mx-auto mb-2" />
            <p className="italic text-base-content/70">Ovaj salon trenutno nema javno istaknutih usluga.</p>
            <p className="text-sm mt-1">Molimo proverite kasnije ili kontaktirajte salon direktno.</p>
          </div>
        )}
      </div>

      {/* Workers Section */}
      <div className="mb-8 p-6 card bg-base-100 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 card-title flex items-center">
          <Users2 size={22} className="mr-2 text-info" /> Naš Tim
        </h2>
        {vendor.workers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendor.workers.map(worker => (
              <div key={worker.id} className="card bg-base-200 shadow">
                <div className="card-body items-center text-center sm:items-start sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center gap-4 mb-3 w-full">
                    {worker.photoUrl ? (
                       <div className="avatar">
                         <div className="w-20 h-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                           <img src={worker.photoUrl} alt={worker.name} />
                         </div>
                       </div>
                    ) : (
                        <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-20 h-20">
                                <span className="text-3xl">{worker.name.charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-center sm:text-left">{worker.name}</h3>
                        {worker.bio && <p className="text-xs text-base-content/70 line-clamp-2 text-center sm:text-left">{worker.bio}</p>}
                    </div>
                  </div>
                  {worker.services && worker.services.length > 0 && (
                    <div className="w-full">
                      <h4 className="text-xs font-medium uppercase text-base-content/60 mt-2 mb-1.5 text-center sm:text-left">Usluge koje pruža:</h4>
                      <div className="flex flex-wrap gap-1 justify-center sm:justify-start">
                        {worker.services.map(service => (
                          <span key={service.id} className="badge badge-outline badge-sm">{service.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!worker.services || worker.services.length === 0) && (
                    <p className="text-xs italic text-base-content/60 mt-2 w-full text-center sm:text-left">Nema posebno dodeljenih usluga.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="text-center py-6">
            <Users2 size={32} className="text-base-content/30 mx-auto mb-2" />
            <p className="italic text-base-content/70">Ovaj salon trenutno nema istaknutih radnika.</p>
          </div>
        )}
      </div>

       <div className="text-center mt-10">
         <Link href={`/book?vendorId=${vendor.id}`} className="btn btn-primary btn-lg">
           <Briefcase className="mr-2" /> Zakažite Uslugu u Ovom Salonu
         </Link>
       </div>
    </div>
  );
}