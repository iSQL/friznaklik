import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import VendorForm, { VendorFormInitialData } from '@/components/admin/vendors/VendorForm';
import { Vendor as PrismaVendor, Prisma, $Enums as PrismaEnums } from '@prisma/client';
import { UserRole as LocalUserRole, VendorStatus as LocalVendorStatus } from '@/lib/types/prisma-enums';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, Edit2 } from 'lucide-react';
import type { Metadata } from 'next';

export async function generateMetadata({ params: paramsPromise }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const routeParams = await paramsPromise;
  const vendor = await prisma.vendor.findUnique({
    where: { id: routeParams.id },
    select: { name: true }
  });
  if (!vendor) {
    return {
      title: 'Salon Nije Pronađen - FrizNaKlik Admin',
    };
  }
  return {
    title: `Izmena Salona: ${vendor.name} - FrizNaKlik Admin`,
    description: `Administratorska forma za izmenu detalja salona ${vendor.name}.`,
  };
}

// Type for data fetched from DB (owner.role and status are Prisma enums)
type VendorWithPrismaOwnerAndStatus = Omit<PrismaVendor, 'operatingHours' | 'status'> & {
    operatingHours?: Prisma.JsonValue | null;
    status: PrismaEnums.VendorStatus; // Prisma enum
    owner: ({
        id: string;
        clerkId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        role: PrismaEnums.UserRole; 
        profileImageUrl: string | null; 
    }) | null;
};


async function getVendorWithOwnerById(vendorId: string): Promise<VendorWithPrismaOwnerAndStatus | null> {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        owner: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profileImageUrl: true, 
          },
        },
      },
    });

    return vendor as VendorWithPrismaOwnerAndStatus | null;
  } catch (error) {
    console.error(`Greška pri dobavljanju salona sa ID ${vendorId}:`, error);
    return null;
  }
}

export default async function EditVendorPage(
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const routeParams = await paramsPromise;
  const { id: vendorId } = routeParams;

  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?redirect_url=/admin/vendors/edit/${vendorId}`);
  }

  const isSuperAdmin = user.role === LocalUserRole.SUPER_ADMIN;
  const isVendorOwner = user.role === LocalUserRole.VENDOR_OWNER;

  if (!isSuperAdmin && !isVendorOwner) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu za izmenu podataka o salonima.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }

  const vendorToEdit = await getVendorWithOwnerById(vendorId);

  if (!vendorToEdit) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
         <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-warning mb-4" />
                <h1 className="card-title text-2xl text-warning mb-2">Salon Nije Pronađen</h1>
                <p className="mb-6">Traženi salon ne postoji ili je došlo do greške.</p>
                <Link href={isSuperAdmin ? "/admin/vendors" : "/admin"} className="btn btn-primary">
                  {isSuperAdmin ? "Nazad na Listu Salona" : "Nazad na Admin Panel"}
                </Link>
            </div>
        </div>
      </div>
    );
  }

  if (isVendorOwner && user.ownedVendorId !== vendorId) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu da menjate podatke za ovaj salon.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }

  // Construct initialFormData explicitly to match VendorFormInitialData TODO: replace with $Enums from prisma
  // and use Prisma enums directly in the form
  const initialFormData: VendorFormInitialData = {
      id: vendorToEdit.id,
      name: vendorToEdit.name,
      description: vendorToEdit.description ?? null,
      address: vendorToEdit.address ?? null,
      phoneNumber: vendorToEdit.phoneNumber ?? null,
      createdAt: vendorToEdit.createdAt,
      updatedAt: vendorToEdit.updatedAt,
      operatingHours: vendorToEdit.operatingHours,
      status: vendorToEdit.status as LocalVendorStatus, // Cast Prisma enum to local enum
      owner: vendorToEdit.owner ? {
          id: vendorToEdit.owner.id,
          clerkId: vendorToEdit.owner.clerkId,
          email: vendorToEdit.owner.email,
          firstName: vendorToEdit.owner.firstName,
          lastName: vendorToEdit.owner.lastName,
          role: vendorToEdit.owner.role as LocalUserRole, // Cast Prisma enum to local enum
          profileImageUrl: vendorToEdit.owner.profileImageUrl ?? undefined,
      } : undefined,
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
       <div className="flex items-center mb-8">
        <Edit2 className="h-8 w-8 mr-3 text-primary" />
        <div>
            <h1 className="text-3xl font-bold text-neutral-content">
                Izmena Salona
            </h1>
            <p className="text-neutral-content/70 text-sm">
                Salon: <span className="font-semibold text-primary">{vendorToEdit.name}</span>
            </p>
        </div>
      </div>
      <VendorForm initialData={initialFormData} currentUserRole={user.role as LocalUserRole} />
    </div>
  );
}
