import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import AdminServicesClient from '@/components/admin/services/AdminServicesClient';
import { UserRole } from '@/lib/types/prisma-enums'; 
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default async function AdminServicesPage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/admin/services');
  }

  const canAccessServicesAdmin =
    user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_OWNER;

  if (!canAccessServicesAdmin) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu za pregled stranice sa uslugama.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }
  
  if (user.role === UserRole.VENDOR_OWNER && !user.ownedVendorId) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
         <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-warning mb-4" />
                <h1 className="card-title text-2xl text-warning mb-2">Nije Moguće Upravljati Uslugama</h1>
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
     <AdminServicesClient userRole={user.role} />
  );
}
