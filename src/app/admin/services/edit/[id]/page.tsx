import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import ServiceForm from '@/components/admin/services/ServiceForm';
import { UserRole } from '@/lib/types/prisma-enums'; // Using the correct enum
import { Vendor, Service as PrismaService } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ListOrdered } from 'lucide-react';

// Type for the initial data expected by ServiceForm when editing
type ServiceFormInitialData = PrismaService & {
  vendor?: { id: string; name: string }; // Include vendor details
};

async function getServiceById(serviceId: string): Promise<ServiceFormInitialData | null> {
  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        vendor: {
          select: { id: true, name: true },
        },
      },
    });
    if (service) {
      return {
        ...service,
        price: Number(service.price),
        duration: Number(service.duration),
      };
    }
    return null;
  } catch (error) {
    console.error(`Greška pri dobavljanju usluge sa ID ${serviceId}:`, error);
    return null;
  }
}

async function getAllVendors(): Promise<Vendor[]> {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });
    return vendors;
  } catch (error) {
    console.error("Greška pri dobavljanju svih salona:", error);
    return [];
  }
}

export default async function EditServicePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const routeParams = await paramsPromise;
  const { id: serviceId } = routeParams;

  const user: AuthenticatedUser | null = await getCurrentUser();

  // Log user object for debugging
  // console.log('USER OBJECT IN EditServicePage:', JSON.stringify(user, null, 2));

  if (!user) {
    redirect(`/sign-in?redirect_url=/admin/services/edit/${serviceId}`);
  }

  const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
  const isVendorOwner = user.role === UserRole.VENDOR_OWNER;

  // Initial access check: Must be SUPER_ADMIN or VENDOR_OWNER with an ownedVendorId
  if (!isSuperAdmin && !(isVendorOwner && user.ownedVendorId)) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
          <div className="card-body items-center text-center">
            <ShieldAlert className="h-16 w-16 text-error mb-4" />
            <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
            <p className="mb-6">Nemate dozvolu za izmenu usluga.</p>
            <Link href="/admin/services" className="btn btn-primary">
              Nazad na Listu Usluga
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const serviceToEdit = await getServiceById(serviceId);

  if (!serviceToEdit) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
          <div className="card-body items-center text-center">
            <ShieldAlert className="h-16 w-16 text-warning mb-4" />
            <h1 className="card-title text-2xl text-warning mb-2">Usluga Nije Pronađena</h1>
            <p className="mb-6">Tražena usluga ne postoji ili je došlo do greške.</p>
            <Link href="/admin/services" className="btn btn-primary">
              Nazad na Listu Usluga
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Secondary authorization: VENDOR_OWNER can only edit their own services.
  // SUPER_ADMIN can edit any service.
  if (isVendorOwner) {
    // user.ownedVendorId is guaranteed to be non-null here due to the earlier check
    if (serviceToEdit.vendorId !== user.ownedVendorId) {
      return (
        <div className="container mx-auto py-8 px-4 md:px-6 text-center">
          <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
              <ShieldAlert className="h-16 w-16 text-error mb-4" />
              <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
              <p className="mb-6">Nemate dozvolu da menjate usluge koje ne pripadaju Vašem salonu.</p>
              <Link href="/admin/services" className="btn btn-primary">
                Nazad na Listu Usluga
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }
  // If execution reaches here, the user is authorized (either SUPER_ADMIN or VENDOR_OWNER editing their own service)

  let allVendors: Vendor[] = [];
  if (isSuperAdmin) {
    // SUPER_ADMIN might need to re-assign a service to a different vendor,
    // though the current ServiceForm doesn't support changing vendorId on edit.
    // If changing vendorId is not a feature, this fetch might be unnecessary for SUPER_ADMIN on edit.
    allVendors = await getAllVendors();
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center mb-6">
        <ListOrdered className="h-8 w-8 mr-3 text-primary" />
        <div>
            <h1 className="text-3xl font-bold text-neutral-content">
                Izmena Usluge
            </h1>
            <p className="text-neutral-content/70 text-sm">
                Usluga: <span className="font-semibold text-primary">{serviceToEdit.name}</span>
                {serviceToEdit.vendor && ` (Salon: ${serviceToEdit.vendor.name})`}
            </p>
        </div>
      </div>
      <ServiceForm
        initialData={serviceToEdit}
        userRole={user.role as UserRole}
        ownedVendorId={user.ownedVendorId}
        allVendors={allVendors}
      />
    </div>
  );
}
