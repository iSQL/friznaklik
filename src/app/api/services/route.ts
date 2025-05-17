// src/app/api/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma for types

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendorId');

  console.log(`GET /api/services: Request received. vendorId: ${vendorId}`);

  try {
    const whereClause: Prisma.ServiceWhereInput = {
      active: true, // Always fetch only active services
    };

    if (vendorId) {
      // Validate if vendorId is a CUID, though Prisma will also handle invalid formats
      if (!/^[a-z0-9]{25}$/.test(vendorId)) {
         console.warn(`GET /api/services: Invalid vendorId format received: ${vendorId}`);
         return NextResponse.json({ message: 'Neispravan format ID-ja salona.' }, { status: 400 });
      }
      whereClause.vendorId = vendorId;
    }
    // If no vendorId is provided, it will fetch all active services from all vendors.
    // This might be desired for a general /services page, but the booking flow will now always provide vendorId.

    const services = await prisma.service.findMany({
      where: whereClause,
      orderBy: {
        name: 'asc', // Optional: order services by name
      },
    });

    console.log(`GET /api/services: Fetched ${services.length} services. Filtered by vendorId: ${vendorId || 'None'}`);
    return NextResponse.json(services, { status: 200 });
  } catch (error) {
    console.error('Error fetching services:', error);
    // It's good practice to not expose raw error messages in production
    // For Prisma errors, you might want to log them and return a generic message
    let errorMessage = 'Interna greška servera prilikom preuzimanja usluga.';
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle known Prisma errors if needed, e.g., P2023 for invalid CUID in where clause
        if (error.code === 'P2023') {
             errorMessage = 'Došlo je do greške sa ID-jem salona.';
        }
        console.error(`Prisma Error Code: ${error.code}, Meta: ${JSON.stringify(error.meta)}`);
    }
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
