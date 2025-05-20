import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Vendor, Service as PrismaService, Worker as PrismaWorker, VendorStatus } from '@prisma/client';
import { Store, ListOrdered, Users2, MapPin, Phone, ClockIcon, Info, Briefcase, ExternalLink, Sparkles, UserCog, CheckSquare } from 'lucide-react';
import type { Metadata, ResolvingMetadata } from 'next';

interface VendorProfilePageParams {
  vendorId: string;
}

interface VendorProfileProps {
  params: Promise<VendorProfilePageParams>; // Params je sada Promise
  // searchParams?: { [key: string]: string | string[] | undefined }; // Dodajte ako koristite searchParams
}

// Definišemo tipove za podatke koje ćemo dohvatiti
interface ServiceWithDetails extends Pick<PrismaService, 'id' | 'name' | 'description' | 'price' | 'duration'> {}

interface WorkerWithAssignedServices extends Pick<PrismaWorker, 'id' | 'name' | 'bio' | 'photoUrl'> {
  services: Array<Pick<PrismaService, 'id' | 'name'>>;
}

interface VendorProfileData extends Pick<Vendor, 'id' | 'name' | 'description' | 'address' | 'phoneNumber' | 'operatingHours' | 'status'> {
  services: ServiceWithDetails[];
  workers: WorkerWithAssignedServices[];
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
        services: {
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
        workers: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            bio: true,
            photoUrl: true,
            services: {
              where: { active: true, vendorId: vendorId },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
      return null;
    }
    return vendor;
  } catch (error) {
    console.error(`Greška pri dobavljanju profila salona ${vendorId}:`, error);
    return null;
  }
}

export async function generateMetadata(
  { params: paramsPromise }: VendorProfileProps, // Destrukturiramo i preimenujemo params u paramsPromise
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await paramsPromise; // Čekamo da se Promise razreši
  const vendorId = params.vendorId;
  const vendor = await getVendorProfile(vendorId);

  if (!vendor) {
    return {
      title: 'Salon Nije Pronađen - FrizNaKlik',
      description: 'Traženi salon nije pronađen ili trenutno nije dostupan.',
    };
  }

  const serviceNames = vendor.services.map(s => s.name).join(', ');
  const workerNames = vendor.workers.map(w => w.name).join(', ');

  return {
    title: `${vendor.name} - Usluge, Tim i Rezervacije | FrizNaKlik`,
    description: vendor.description ? `${vendor.description.substring(0, 150)}...` : `Pogledajte usluge (${serviceNames}), upoznajte naš tim (${workerNames}) i zakažite termin u salonu ${vendor.name}.`,
    alternates: {
      canonical: `/vendors/${vendor.id}`,
    },
    openGraph: {
      title: `${vendor.name} | FrizNaKlik`,
      description: vendor.description || `Profesionalne frizerske usluge u salonu ${vendor.name}. Upoznajte naš tim i zakažite online.`,
      locale: 'sr_RS',
      type: 'profile',
    },
    keywords: [vendor.name, 'frizerski salon', 'usluge', 'radnici', 'tim', 'zakazivanje', ...vendor.services.map(s => s.name), ...vendor.workers.map(w => w.name || '')].filter(Boolean),
  };
}


export default async function VendorProfilePage({ params: paramsPromise }: VendorProfileProps) { // Destrukturiramo i preimenujemo params u paramsPromise
  const params = await paramsPromise; // Čekamo da se Promise razreši
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
            if (dayInfo && dayInfo.open && dayInfo.close && !dayInfo.isClosed) { // Dodata provera za isClosed
                return { day: dayName, hours: `${dayInfo.open} - ${dayInfo.close}` };
            }
            return { day: dayName, hours: "Zatvoreno" };
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
              <div key={worker.id} className="card bg-base-200 shadow hover:shadow-md transition-shadow h-full flex flex-col">
                <div className="card-body items-center text-center sm:items-start sm:text-left flex-grow flex flex-col">
                  <div className="flex flex-col sm:flex-row items-center gap-4 mb-3 w-full">
                    {worker.photoUrl ? (
                       <div className="avatar">
                         <div className="w-20 h-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                           <img src={worker.photoUrl} alt={worker.name || 'Radnik'} onError={(e) => (e.currentTarget.src = `https://placehold.co/80x80/E0E0E0/B0B0B0?text=${(worker.name || 'R').charAt(0)}&font=roboto`)} />
                         </div>
                       </div>
                    ) : (
                        <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-20 h-20 flex items-center justify-center">
                                <span className="text-3xl">{(worker.name || 'R').charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                    )}
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-center sm:text-left">{worker.name || 'Radnik'}</h3>
                        {worker.bio && <p className="text-xs text-base-content/70 line-clamp-2 text-center sm:text-left">{worker.bio}</p>}
                    </div>
                  </div>

                  <div className="w-full mt-auto pt-3 border-t border-base-300/30">
                    <h4 className="text-xs font-medium uppercase text-base-content/60 mb-1.5 text-center sm:text-left">
                      Pruža usluge:
                    </h4>
                    {worker.services && worker.services.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center sm:justify-start">
                        {worker.services.map(service => (
                          <span key={service.id} className="badge badge-outline badge-accent badge-sm">
                            <CheckSquare size={12} className="mr-1"/> {service.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs italic text-base-content/60 text-center sm:text-left">Nema posebno dodeljenih aktivnih usluga.</p>
                    )}
                  </div>
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
