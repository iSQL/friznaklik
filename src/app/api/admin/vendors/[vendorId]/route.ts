import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withRoleProtection,
} from '@/lib/authUtils';
import { UserRole, VendorStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const vendorUpdateSchema = z.object({
  name: z.string().min(1, 'Naziv salona je obavezan.').optional(),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  operatingHours: z.any().optional().nullable(),
  status: z.nativeEnum(VendorStatus).optional(),
});

interface RouteContext {
  params: Promise<{ vendorId: string }>; 
}

/**
 * Handles GET requests to fetch a specific vendor by its ID.
 * Only accessible by SUPER_ADMIN.
 */
async function GET_handler(req: NextRequest, context: RouteContext) {
  try {
    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        owner: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ message: 'Salon nije pronađen.' }, { status: 404 });
    }

    return NextResponse.json(vendor);
  } catch (error) {
    const routeParams = await context.params;
    console.error(`Greška pri dobavljanju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja salona.' }, { status: 500 });
  }
}


/**
 * Handles PUT requests to update an existing vendor.
 * Only accessible by SUPER_ADMIN.
 */
async function PUT_handler(req: NextRequest, context: RouteContext) {
  try {
    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    const body = await req.json();
    const parseResult = vendorUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const dataToUpdate = { ...parseResult.data }; 
    if (typeof dataToUpdate.operatingHours === 'string' && dataToUpdate.operatingHours.trim() !== '') {
        try {
            (dataToUpdate as any).operatingHours = JSON.parse(dataToUpdate.operatingHours);
        } catch (e) {
            return NextResponse.json({ message: 'Format radnog vremena (operatingHours) nije validan JSON.' }, { status: 400 });
        }
    } else if (dataToUpdate.operatingHours === null || (typeof dataToUpdate.operatingHours === 'string' && dataToUpdate.operatingHours.trim() === '')) {
        (dataToUpdate as any).operatingHours = Prisma.JsonNull;
    }


    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedVendor);

  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri ažuriranju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Salon nije pronađen za ažuriranje.' }, { status: 404 });
      }
    }
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja salona.' }, { status: 500 });
  }
}

/**
 * Handles DELETE requests to "soft delete" (suspend) a vendor.
 * Only accessible by SUPER_ADMIN.
 * This changes the vendor's status to SUSPENDED.
 */
async function DELETE_handler(req: NextRequest, context: RouteContext) {
  try {
    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    const existingVendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!existingVendor) {
      return NextResponse.json({ message: 'Salon nije pronađen.' }, { status: 404 });
    }
    if (existingVendor.status === VendorStatus.SUSPENDED) {
        return NextResponse.json({ message: 'Salon je već suspendovan.', vendor: existingVendor }, { status: 200 });
    }

    const suspendedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: VendorStatus.SUSPENDED,
        // Opciono: dodati polje npr. `suspendedAt: new Date()`
      },
    });

    // Razmatranja za budućnost (nisu implementirana ovde):
    // 1. Šta se dešava sa uslugama ovog salona? (Možda ih treba označiti kao neaktivne)
    // 2. Šta se dešava sa terminima ovog salona? (Možda otkazati PENDING/CONFIRMED termine)
    // 3. Da li se uloga VENDOR_OWNER-a menja? (Za sada ne, ali je opcija)

    return NextResponse.json({ message: 'Salon uspešno suspendovan.', vendor: suspendedVendor }, { status: 200 });

  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri suspendovanju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: 'Salon nije pronađen za suspendovanje.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom suspendovanja salona.' }, { status: 500 });
  }
}


export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN]);
export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN]);
export const DELETE = withRoleProtection(DELETE_handler, [UserRole.SUPER_ADMIN]);
