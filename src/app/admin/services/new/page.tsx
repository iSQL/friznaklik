import { getCurrentUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import ServiceForm from '@/components/admin/services/ServiceForm';
import { UserRole, Vendor } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

export default async function NewServicePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.VENDOR_OWNER) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Pristup Odbijen</h1>
        <p className="mb-6">Nemate dozvolu za kreiranje novih usluga.</p>
        <Link href="/admin" className="btn btn-primary">
          Nazad na Admin Panel
        </Link>
      </div>
    );
  }
  
  if (user.role === UserRole.VENDOR_OWNER && !user.ownedVendorId) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Nije Moguće Kreirati Uslugu</h1>
        <p className="mb-6">Niste povezani ni sa jednim salonom. Molimo kontaktirajte administratora.</p>
        <Link href="/admin" className="btn btn-primary">
          Nazad na Admin Panel
        </Link>
      </div>
    );
  }

  let allVendors: Vendor[] = [];
  if (user.role === UserRole.SUPER_ADMIN) {
    allVendors = await getAllVendors();
    if (allVendors.length === 0) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6 text-center">
              <h1 className="text-2xl font-bold text-warning mb-4">Nema Salona</h1>
              <p className="mb-6">Trenutno nema kreiranih salona u sistemu. SUPER_ADMIN mora prvo kreirati salon pre dodavanja usluga.</p>
              <Link href="/admin" className="btn btn-primary"> 
                Nazad na Admin Panel
              </Link>
            </div>
          );
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">Kreiranje Nove Usluge</h1>
      <ServiceForm
        userRole={user.role}
        ownedVendorId={user.ownedVendorId} 
        allVendors={allVendors} 
      />
    </div>
  );
}
