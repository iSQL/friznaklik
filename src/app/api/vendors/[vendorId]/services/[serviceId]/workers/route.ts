// src/app/api/vendors/[vendorId]/services/[serviceId]/workers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { VendorStatus } from '@/lib/types/prisma-enums'; // Using your enum path
import { Prisma } from '@prisma/client';

interface RouteContext {
  params: Promise<{
    vendorId: string;
    serviceId: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { vendorId, serviceId } = await context.params;

    if (!vendorId || !serviceId) {
      return NextResponse.json({ message: 'ID Salona (vendorId) i ID Usluge (serviceId) su obavezni.' }, { status: 400 });
    }

    // 1. Verify the vendor exists and is active
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId, status: VendorStatus.ACTIVE },
      select: { id: true } // Only need to confirm existence and status
    });

    if (!vendor) {
      return NextResponse.json({ message: 'Salon nije pronađen ili nije aktivan.' }, { status: 404 });
    }

    // 2. Verify the service exists, is active, and belongs to the vendor
    const service = await prisma.service.findUnique({
        where: { id: serviceId, vendorId: vendorId, active: true },
        select: { id: true }
    });

    if (!service) {
        return NextResponse.json({ message: 'Usluga nije pronađena, nije aktivna, ili ne pripada odabranom salonu.' }, { status: 404 });
    }

    // 3. Fetch workers for the vendor who are assigned to the specified active service
    const workers = await prisma.worker.findMany({
      where: {
        vendorId: vendorId,
        services: {
          some: {
            id: serviceId,
            active: true // Ensure the service link is to an active service (redundant due to above check but safe)
          }
        }
        // Optionally, add a filter for worker status if you add an `isActive` field to Worker model
        // e.g., isActive: true,
      },
      select: {
        id: true,
        name: true,
        photoUrl: true, // Include photoUrl for better UI
        bio: true,      // Include bio for more info on worker selection
        // Do NOT include sensitive data like email or full schedule details here
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(workers);

  } catch (error: unknown) {
    const { vendorId, serviceId } = await context.params;
    console.error(`Greška pri dobavljanju radnika za salon ${vendorId} i uslugu ${serviceId}:`, error);
    
    let errorMessage = 'Interna greška servera prilikom dobavljanja radnika.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        errorMessage = 'Greška pri komunikaciji sa bazom podataka.';
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
