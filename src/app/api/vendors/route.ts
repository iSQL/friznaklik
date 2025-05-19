// src/app/api/vendors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { VendorStatus, Prisma } from '@prisma/client';

/**
 * Handles GET requests to fetch all active vendors.
 * This is a public route for users to select a vendor when booking.
 * Supports filtering by service IDs (vendor must offer ALL specified services).
 * Includes active services offered by each vendor in the response.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceIdsParam = searchParams.get('serviceIds');

    const whereClause: Prisma.VendorWhereInput = {
      status: VendorStatus.ACTIVE,
    };

    if (serviceIdsParam) {
      const serviceIds = serviceIdsParam.split(',').map(id => id.trim()).filter(id => id);
      if (serviceIds.length > 0) {
        // Vendor must offer ALL of the specified active services.
        // We construct an AND condition: for each serviceId in the filter,
        // the vendor must have 'some' service matching that id and being active.
        whereClause.AND = serviceIds.map(serviceId => ({
          services: {
            some: {
              id: serviceId,
              active: true,
            },
          },
        }));
      }
    }

    const vendors = await prisma.vendor.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phoneNumber: true,
        operatingHours: true,
        status: true,
        services: {
          where: {
            active: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            duration: true,
          },
          orderBy: {
            name: 'asc',
          }
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // If filtering by services, we might also want to ensure that the services
    // included in the response for each vendor are relevant or re-check.
    // However, the primary filtering happens in the `whereClause`.
    // The `services` in select will return all active services for the vendors that passed the filter.

    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Greška pri dobavljanju aktivnih salona:', error);
    let errorMessage = 'Interna greška servera prilikom dobavljanja salona.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        errorMessage = 'Greška pri komunikaciji sa bazom podataka.';
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}