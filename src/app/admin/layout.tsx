import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import AdminShell from '@/components/admin/AdminShell';

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
    redirect('/sign-in');
  }

  const isAdmin = await checkAdmin(userId);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100 text-base-content">
        <div className="p-6 bg-base-200 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-error mb-4">Unauthorized Access</h1>
          <p className="mb-4">You do not have permission to view this page.</p>
          <Link href="/" className="link link-primary">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const adminNavLinks = [
    { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/admin/services', label: 'Services', icon: 'Settings2' },
    { href: '/admin/appointments', label: 'Appointments', icon: 'CalendarCheck' },
    { href: '/admin/chat', label: 'Chat Management', icon: 'MessageSquare' },
  ];

  return <AdminShell navLinks={adminNavLinks}>{children}</AdminShell>;
}
