import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import VendorForm from '@/components/admin/vendors/VendorForm';
import { UserRole, Vendor, User as PrismaUser } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

type VendorFormInitialData = Vendor & {
    owner?: AuthenticatedUser;
};

async function getVendorWithOwnerById(vendorId: string): Promise<(Vendor & { owner: AuthenticatedUser | null }) | null> {
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
          },
        },
      },
    });
    
    if (vendor) {
        return vendor as Vendor & { owner: AuthenticatedUser | null };
    }
    return null;
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

  if (user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu za izmenu podataka o salonima.</p>
                <Link href="/admin/vendors" className="btn btn-primary">
                  Nazad na Listu Salona
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
                <Link href="/admin/vendors" className="btn btn-primary">
                  Nazad na Listu Salona
                </Link>
            </div>
        </div>
      </div>
    );
  }
  
  const initialFormData: VendorFormInitialData = {
      ...vendorToEdit,
      owner: vendorToEdit.owner ? {
          id: vendorToEdit.owner.id,
          clerkId: vendorToEdit.owner.clerkId,
          email: vendorToEdit.owner.email,
          firstName: vendorToEdit.owner.firstName,
          lastName: vendorToEdit.owner.lastName,
          role: vendorToEdit.owner.role,
      } : undefined,
      description: vendorToEdit.description ?? '',
      address: vendorToEdit.address ?? '',
      phoneNumber: vendorToEdit.phoneNumber ?? '',
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <VendorForm initialData={initialFormData} />
    </div>
  );
}
