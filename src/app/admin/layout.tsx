import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { ShieldAlert, LogIn } from 'lucide-react';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import { UserRole } from '@prisma/client';

export default async function AdminLayout({children, }: { children: React.ReactNode;}) {
  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent('/admin')}`);
  }

  const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_OWNER;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 text-base-content p-4">
        <div className="card bg-base-200 shadow-xl max-w-md w-full mx-auto">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Neovlašćen pristup</h1>
                <p className="mb-6">Nemate dozvolu za pregled administrativnog panela.</p>
                <div className="card-actions justify-center">
                    <Link href="/" className="btn btn-primary">
                        <LogIn className="h-4 w-4 mr-2" />
                        Idi na početnu stranicu
                    </Link>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
