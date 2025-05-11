import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import AdminShell from '@/components/admin/AdminShell';
import { ShieldAlert, LogIn } from 'lucide-react'; 

async function checkAdmin(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role === 'admin';
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    // Preusmeravanje na stranicu za prijavu ako korisnik nije ulogovan
    // Možete dodati i query parametar za povratak na admin stranicu nakon prijave
    redirect(`/sign-in?redirect_url=${encodeURIComponent('/admin')}`);
  }

  const isAdmin = await checkAdmin(userId);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 text-base-content p-4">
        <div className="card bg-base-200 shadow-xl max-w-md w-full">
            <div className="card-body items-center text-center">
                <ShieldAlert className="h-16 w-16 text-error mb-4" />
                <h1 className="card-title text-2xl text-error mb-2">Neovlašćen pristup</h1>
                <p className="mb-6">Nemate dozvolu za pregled ove stranice.</p>
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

  const adminNavLinks = [
    { href: '/admin', label: 'Kontrolna tabla', icon: 'LayoutDashboard' },
    { href: '/admin/services', label: 'Usluge', icon: 'Settings2' }, 
    { href: '/admin/appointments', label: 'Termini', icon: 'CalendarCheck' },
    { href: '/admin/chat', label: 'Čet administracija', icon: 'MessageSquare' },
  ];

  return <AdminShell navLinks={adminNavLinks}>{children}</AdminShell>;
}
