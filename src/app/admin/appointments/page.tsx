import { getCurrentUser } from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminAppointmentsClient from '@/components/admin/appointments/AdminAppointmentsClient'; 

export default async function AdminAppointmentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.VENDOR_OWNER) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Pristup Odbijen</h1>
        <p className="mb-6">Nemate dozvolu za pregled administrativne stranice sa terminima.</p>
        <Link href="/admin" className="btn btn-primary">
          Nazad na Admin Panel
        </Link>
      </div>
    );
  }
  
  if (user.role === UserRole.VENDOR_OWNER && !user.ownedVendorId) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <h1 className="text-2xl font-bold text-error mb-4">Nije Moguće Prikazati Termine</h1>
        <p className="mb-6">Niste povezani ni sa jednim salonom. Molimo kontaktirajte administratora.</p>
        <Link href="/admin" className="btn btn-primary">
          Nazad na Admin Panel
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
        Administracija Termina
      </h1>
      <AdminAppointmentsClient 
        userRole={user.role} 
        ownedVendorId={user.ownedVendorId}
      />
    </div>
  );
}
