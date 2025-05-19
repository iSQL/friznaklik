// src/app/admin/workers/page.tsx
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { UserRole } from '@prisma/client'; // Koristimo UserRole iz @prisma/client direktno ako je tako konzistentno
import { redirect } from 'next/navigation';
import Link from 'next/link';
// import AdminWorkersClient from '@/components/admin/workers/AdminWorkersClient'; // Stara komponenta
import VendorWorkersManager from '@/components/admin/workers/VendorWorkersManager'; // Nova, bogatija komponenta
import { ShieldAlert, Users2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administracija Radnika - FrizNaKlik',
  description: 'Upravljajte radnicima Vašeg salona.',
};


export default async function AdminWorkersPage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/admin/workers');
  }

  // Samo VENDOR_OWNER treba da pristupa ovoj stranici direktno za svoje radnike
  if (user.role !== UserRole.VENDOR_OWNER) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Samo vlasnici salona mogu direktno upravljati svojim radnicima putem ove stranice.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }

  if (!user.ownedVendorId) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-warning mb-4" />
                <h1 className="card-title text-2xl text-warning mb-2">Nije Moguće Upravljati Radnicima</h1>
                <p className="mb-6">Niste povezani ni sa jednim salonom. Molimo kontaktirajte administratora.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4">
        <div className="flex items-center mb-8">
            <Users2 className="h-8 w-8 mr-3 text-primary" />
            <h1 className="text-3xl font-bold text-neutral-content">
              Upravljanje Radnicima Salona
            </h1>
        </div>
      {/* Prosleđujemo vendorId komponenti VendorWorkersManager.
        Komponenta VendorWorkersManager interno upravlja preuzimanjem radnika
        i prikazivanjem svih potrebnih formi (detalji, usluge, raspored).
      */}
      <VendorWorkersManager vendorId={user.ownedVendorId} />
    </div>
  );
}
