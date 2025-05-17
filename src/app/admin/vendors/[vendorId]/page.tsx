// src/app/admin/vendors/[vendorId]/page.tsx
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import { UserRole, Vendor, Service, Appointment, User as PrismaUser, AppointmentStatus, VendorStatus, Worker as PrismaWorker } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Store, UserCircle, ListOrdered, CalendarDays, Edit3, ArrowLeft, Phone, MapPin, Info, Users2 } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns'; // Added isValid
import { sr } from 'date-fns/locale';
import VendorWorkersManager from '@/components/admin/workers/VendorWorkersManager';

type VendorDetails = Vendor & {
  owner: PrismaUser;
  services: Service[];
  appointments: (Appointment & {
    user: Pick<PrismaUser, 'firstName' | 'lastName' | 'email'>;
    service: Pick<Service, 'name'>;
    // Ensure startTime is treated as Date
    startTime: Date;
  })[];
};

interface VendorDetailsPageProps {
  params: Promise<{ vendorId: string; }>;
}

async function getVendorDetails(vendorId: string): Promise<VendorDetails | null> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        owner: true,
        services: {
          orderBy: { name: 'asc' },
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 10,
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            service: { select: { name: true } },
          },
        },
      },
    });
    // Ensure startTime is a Date object
    if (vendor) {
      vendor.appointments = vendor.appointments.map(app => ({
        ...app,
        startTime: new Date(app.startTime),
      }));
    }
    return vendor as VendorDetails | null;
  } catch (error) {
    console.error(`Greška pri dobavljanju detalja salona ${vendorId}:`, error);
    return null;
  }
}

const statusTextMap: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'Aktivan',
  [VendorStatus.PENDING_APPROVAL]: 'Na čekanju za odobrenje',
  [VendorStatus.REJECTED]: 'Odbijen',
  [VendorStatus.SUSPENDED]: 'Suspendovan',
};

const statusColorMap: Record<VendorStatus, string> = {
  [VendorStatus.ACTIVE]: 'badge-success',
  [VendorStatus.PENDING_APPROVAL]: 'badge-warning',
  [VendorStatus.REJECTED]: 'badge-error',
  [VendorStatus.SUSPENDED]: 'badge-neutral',
};

const appointmentStatusTextMap: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: 'Na čekanju',
  [AppointmentStatus.CONFIRMED]: 'Potvrđen',
  [AppointmentStatus.CANCELLED_BY_USER]: 'Otkazao korisnik',
  [AppointmentStatus.CANCELLED_BY_VENDOR]: 'Otkazao salon',
  [AppointmentStatus.REJECTED]: 'Odbijen',
  [AppointmentStatus.COMPLETED]: 'Završen',
  [AppointmentStatus.NO_SHOW]: 'Nije se pojavio',
};

const appointmentStatusColorMap: Record<AppointmentStatus, string> = {
    [AppointmentStatus.PENDING]: 'badge-warning',
    [AppointmentStatus.CONFIRMED]: 'badge-success',
    [AppointmentStatus.CANCELLED_BY_USER]: 'badge-error',
    [AppointmentStatus.CANCELLED_BY_VENDOR]: 'badge-error',
    [AppointmentStatus.REJECTED]: 'badge-error',
    [AppointmentStatus.COMPLETED]: 'badge-info',
    [AppointmentStatus.NO_SHOW]: 'badge-ghost',
};


export default async function VendorDetailsPage({ params: paramsPromise }: VendorDetailsPageProps) {
  const routeParams = await paramsPromise;
  const { vendorId } = routeParams;

  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?redirect_url=/admin/vendors/${vendorId}`);
  }

  if (user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
          <div className="card-body items-center text-center">
            <ShieldAlert className="h-16 w-16 text-error mb-4" />
            <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
            <p className="mb-6">Nemate dozvolu za pregled detalja o drugim salonima.</p>
            <Link href="/admin" className="btn btn-primary">
              Nazad na Admin Panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const vendorDetails = await getVendorDetails(vendorId);

  if (!vendorDetails) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
          <div className="card-body items-center text-center">
            <ShieldAlert className="h-16 w-16 text-warning mb-4" />
            <h1 className="card-title text-2xl text-warning mb-2">Salon Nije Pronađen</h1>
            <p className="mb-6">Traženi salon ne postoji ili je došlo do greške.</p>
            <Link href="/admin/vendors" className="btn btn-primary">
              Nazad na Listu Salona
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4">
      <div className="mb-6">
        <Link href="/admin/vendors" className="btn btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nazad na listu salona
        </Link>
      </div>

      {/* Vendor Info Card */}
      <div className="card lg:card-side bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="card-title text-3xl font-bold text-primary mb-1 flex items-center">
                <Store className="h-8 w-8 mr-2" /> {vendorDetails.name}
              </h1>
              <span className={`badge ${statusColorMap[vendorDetails.status] || 'badge-ghost'} font-semibold`}>
                Status: {statusTextMap[vendorDetails.status] || vendorDetails.status}
              </span>
            </div>
            <Link href={`/admin/vendors/edit/${vendorDetails.id}`} className="btn btn-outline btn-primary btn-sm self-start sm:self-center">
              <Edit3 className="h-4 w-4 mr-2" /> Izmeni Podatke Salona
            </Link>
          </div>
          {vendorDetails.description && (
            <p className="mt-4 text-base-content/80 flex items-start">
              <Info className="h-5 w-5 mr-2 mt-1 shrink-0 text-info" />
              <span>{vendorDetails.description}</span>
            </p>
          )}
          <div className="divider my-4">Osnovne Informacije</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="flex items-center mb-1"><MapPin className="h-4 w-4 mr-2 text-gray-500" /><strong>Adresa:</strong> {vendorDetails.address || <span className="italic text-gray-500">Nije uneta</span>}</p>
              <p className="flex items-center"><Phone className="h-4 w-4 mr-2 text-gray-500" /><strong>Telefon:</strong> {vendorDetails.phoneNumber || <span className="italic text-gray-500">Nije unet</span>}</p>
            </div>
            <div>
              <p className="mb-1"><strong>ID Salona:</strong> <span className="font-mono text-xs">{vendorDetails.id}</span></p>
              <p><strong>Kreiran:</strong> {isValid(new Date(vendorDetails.createdAt)) ? format(new Date(vendorDetails.createdAt), 'dd.MM.yyyy HH:mm', { locale: sr }) : 'Nevažeći datum'}</p>
            </div>
          </div>
          {vendorDetails.operatingHours && typeof vendorDetails.operatingHours === 'object' && Object.keys(vendorDetails.operatingHours).length > 0 && (
            <>
              <div className="divider my-4">Radno Vreme</div>
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <tbody>
                    {Object.entries(vendorDetails.operatingHours as Record<string, {open: string, close: string} | null>).map(([day, hours]) => (
                      <tr key={day}>
                        <td className="font-semibold capitalize">{day.charAt(0).toUpperCase() + day.slice(1)}:</td>
                        <td>{hours && typeof hours === 'object' && hours.open && hours.close ? `${hours.open} - ${hours.close}` : <span className="italic text-gray-500">Nije definisano</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Owner Info Card */}
      <div className="card bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-secondary mb-3 flex items-center">
            <UserCircle className="h-6 w-6 mr-2" /> Vlasnik Salona
          </h2>
          <p><strong>Ime:</strong> {vendorDetails.owner.firstName || ''} {vendorDetails.owner.lastName || <span className="italic text-gray-500">Nije uneto</span>}</p>
          <p><strong>Email:</strong> {vendorDetails.owner.email}</p>
          <p><strong>Korisnička uloga:</strong> <span className="badge badge-outline">{vendorDetails.owner.role}</span></p>
        </div>
      </div>

      {/* Worker Management Section for SUPER_ADMIN */}
      {user.role === UserRole.SUPER_ADMIN && (
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-xl font-semibold text-purple-600 mb-3 flex items-center">
              <Users2 className="h-6 w-6 mr-2" /> Radnici Salona
            </h2>
            <VendorWorkersManager vendorId={vendorDetails.id} />
          </div>
        </div>
      )}


      {/* Services List Card */}
      <div className="card bg-base-100 shadow-xl mb-8">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-accent mb-3 flex items-center">
            <ListOrdered className="h-6 w-6 mr-2" /> Usluge Salona ({vendorDetails.services.length})
          </h2>
          {vendorDetails.services.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Naziv Usluge</th>
                    <th>Trajanje (min)</th>
                    <th>Cena (RSD)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorDetails.services.map(service => (
                    <tr key={service.id} className="hover">
                      <td>{service.name}</td>
                      <td>{service.duration}</td>
                      <td>{service.price.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${service.active ? 'badge-success' : 'badge-error'} badge-xs`}>
                          {service.active ? 'Aktivna' : 'Neaktivna'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="italic text-gray-500">Ovaj salon trenutno nema definisanih usluga.</p>
          )}
          <div className="card-actions justify-end mt-4">
            <Link href={`/admin/services?vendorId=${vendorDetails.id}`} className="btn btn-outline btn-accent btn-sm">
              Upravljaj Uslugama Salona
            </Link>
          </div>
        </div>
      </div>

      {/* Appointments List Card */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-info mb-3 flex items-center">
            <CalendarDays className="h-6 w-6 mr-2" /> Termini Salona (prikazano poslednjih {vendorDetails.appointments.length})
          </h2>
          {vendorDetails.appointments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr>
                    <th>Datum i Vreme</th>
                    <th>Korisnik</th>
                    <th>Usluga</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorDetails.appointments.map(app => (
                    <tr key={app.id} className="hover">
                      <td>
                        {/* Check if app.startTime is a valid Date object before formatting */}
                        {app.startTime && isValid(app.startTime)
                          ? format(app.startTime, 'dd.MM.yyyy HH:mm', { locale: sr })
                          : 'Nevažeći datum'}
                      </td>
                      <td>{app.user.firstName} {app.user.lastName} ({app.user.email})</td>
                      <td>{app.service.name}</td>
                      <td>
                        <span className={`badge ${appointmentStatusColorMap[app.status] || 'badge-ghost'} badge-xs`}>
                          {appointmentStatusTextMap[app.status] || app.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="italic text-gray-500">Ovaj salon trenutno nema zakazanih termina.</p>
          )}
           <div className="card-actions justify-end mt-4">
            <Link href={`/admin/appointments?vendorId=${vendorDetails.id}`} className="btn btn-outline btn-info btn-sm">
              Upravljaj Svim Terminima Salona
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
