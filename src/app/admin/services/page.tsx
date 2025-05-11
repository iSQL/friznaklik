import AdminServicesClient from '@/components/admin/services/AdminServicesClient';
import { Service } from '@prisma/client';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert, ServerCrash, ListOrdered } from 'lucide-react'; // 

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
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4 text-center"> 
        <div role="alert" className="alert alert-error max-w-md shadow-lg"> 
          <ShieldAlert className="h-8 w-8" />
          <div>
            <h3 className="font-bold text-lg">Neovlašćen pristup</h3>
            <div className="text-sm">Nemate dozvolu za pregled ove stranice.</div>
          </div>
          <Link href="/admin" className="btn btn-sm btn-neutral mt-2 sm:mt-0">Idi na kontrolnu tablu</Link>
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
    console.error('Greška pri dohvatanju usluga:', e); 
    error = 'Neuspešno učitavanje usluga. Molimo pokušajte ponovo kasnije.';
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <ListOrdered className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-3xl font-bold text-base-content">Upravljanje uslugama</h1>
        </div>
        <div role="alert" className="alert alert-warning shadow-md"> 
          <ServerCrash className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Greška pri učitavanju podataka</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
       <div className="flex items-center mb-6">
          <ListOrdered className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-3xl font-bold text-base-content">Upravljanje uslugama</h1>
        </div>
      <AdminServicesClient services={services} />
    </div>
  );
}