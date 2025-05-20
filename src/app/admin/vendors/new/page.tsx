// src/app/admin/vendors/new/page.tsx
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import prisma from '@/lib/prisma';
import VendorForm from '@/components/admin/vendors/VendorForm';
import { UserRole as LocalUserRole } from '@/lib/types/prisma-enums'; // Koristimo lokalni enum
import { Vendor } from '@prisma/client'; // Prisma tip za Vendor
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, PlusCircle } from 'lucide-react'; // Dodata ikona
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kreiraj Novi Salon - FrizNaKlik Admin',
  description: 'Administratorska forma za kreiranje novog salona.',
};

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

export default async function NewVendorPage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/admin/vendors/new');
  }

  // Sada koristimo LocalUserRole za poređenje
  if (user.role !== LocalUserRole.SUPER_ADMIN) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu za kreiranje novih salona.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }
  
  let allVendors: Vendor[] = [];
  // Provera uloge pre poziva getAllVendors, iako je već pokriveno gornjim if-om
  if (user.role === LocalUserRole.SUPER_ADMIN) {
    allVendors = await getAllVendors();
    if (allVendors.length === 0 && process.env.NODE_ENV !== 'development') { // U produkciji, ako nema salona, ovo je čudno za SUPER_ADMINA
        // U developmentu, ovo može biti normalno na početku
        // Možda ne treba prikazati grešku ovde, već samo proslediti prazan niz
        console.warn("[NewVendorPage] Nema postojećih salona, ali SUPER_ADMIN kreira novi. Ovo je ok.");
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center mb-8">
        <PlusCircle className="h-8 w-8 mr-3 text-primary" />
        <h1 className="text-3xl font-bold text-neutral-content">
            Kreiranje Novog Salona
        </h1>
      </div>
      <VendorForm
        currentUserRole={user.role} // Prosleđujemo ulogu korisnika
        allVendors={allVendors} 
        // initialData je null ili undefined jer kreiramo novi salon
      />
    </div>
  );
}
