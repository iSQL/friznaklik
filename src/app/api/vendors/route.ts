// src/app/api/vendors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { VendorStatus } from '@prisma/client';

/**
 * Handles GET requests to fetch all active vendors.
 * This is a public route for users to select a vendor when booking.
 */
export async function GET(request: NextRequest) {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        status: VendorStatus.ACTIVE, // Samo aktivni saloni
      },
      select: { // Vraćamo samo neophodne informacije za prikaz i odabir
        id: true,
        name: true,
        description: true,
        address: true,
        phoneNumber: true,
        // operatingHours: true, // Može biti korisno za prikaz radnog vremena na listi
      },
      orderBy: {
        name: 'asc', // Sortiraj po imenu
      },
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Greška pri dobavljanju aktivnih salona:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja salona.' }, { status: 500 });
  }
}
