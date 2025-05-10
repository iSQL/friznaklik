import AdminServicesClient from '@/components/admin/services/AdminServicesClient';
import { Service } from '@prisma/client';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ServerCrash } from 'lucide-react';

async function isAdminUser(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  });
  return dbUser?.role === 'admin';
}

export default async function AdminServicesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <div role="alert" className="alert alert-error max-w-lg">
          <ShieldAlert className="h-6 w-6" />
          <div>
            <h3 className="font-bold">Unauthorized Access</h3>
            <div className="text-xs">You do not have permission to view this page.</div>
          </div>
          <Link href="/admin" className="btn btn-sm btn-neutral">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  let services: Service[] = [];
  let error: string | null = null;

  try {
    services = await prisma.service.findMany({
      orderBy: {
        name: 'asc',
      }
    });
  } catch (e) {
    console.error('Error fetching services:', e);
    error = 'Failed to load services. Please try again later.';
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6 text-base-content">Manage Services</h1>
        <div role="alert" className="alert alert-warning">
          <ServerCrash className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Error Loading Data</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminServicesClient services={services} />
  );
}
