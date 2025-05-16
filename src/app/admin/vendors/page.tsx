import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminVendorsClient from '@/components/admin/vendors/AdminVendorsClient'; 
import { ShieldAlert } from 'lucide-react';

export default async function AdminVendorsPage() {
  const user: AuthenticatedUser | null = await getCurrentUser();

  if (!user) {
    redirect('/sign-in?redirect_url=/admin/vendors');
  }

  if (user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Pristup Odbijen</h1>
                <p className="mb-6">Nemate dozvolu za pregled stranice sa salonima.</p>
                <Link href="/admin" className="btn btn-primary">
                  Nazad na Admin Panel
                </Link>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <AdminVendorsClient userRole={user.role} />
    </div>
  );
}
