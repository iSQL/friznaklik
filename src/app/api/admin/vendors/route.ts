import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, VendorStatus } from '@prisma/client'; 
import { z } from 'zod';

const vendorSchema = z.object({
  name: z.string().min(1, 'Naziv salona je obavezan.'),
  description: z.string().optional().nullable(),
  ownerId: z.string().min(1, 'ID vlasnika (Clerk ID) je obavezan.'), 
  address: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  operatingHours: z.any().optional().nullable(),
});

/**
 * Handles GET requests to fetch all vendors.
 * Only accessible by SUPER_ADMIN.
 */
async function GET_handler(req: NextRequest) {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        owner: {
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
            select: { services: true, appointments: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Greška pri dobavljanju salona:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja salona.' }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new vendor.
 * Only accessible by SUPER_ADMIN.
 */
async function POST_handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = vendorSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, description, ownerId: ownerClerkId, address, phoneNumber, operatingHours } = parseResult.data;

    const ownerUser = await prisma.user.findUnique({
      where: { clerkId: ownerClerkId }, 
    });

    if (!ownerUser) {
      return NextResponse.json({ message: `Korisnik (vlasnik) sa Clerk ID ${ownerClerkId} nije pronađen.` }, { status: 404 });
    }

    const existingVendorForOwner = await prisma.vendor.findUnique({
        where: { ownerId: ownerUser.id } 
    });

    if (existingVendorForOwner) {
        return NextResponse.json({ message: `Korisnik ${ownerUser.email} već poseduje salon: ${existingVendorForOwner.name}.` }, { status: 409 });
    }

    const newVendor = await prisma.vendor.create({
      data: {
        name,
        description,
        ownerId: ownerUser.id, 
        address,
        phoneNumber,
        operatingHours: operatingHours || Prisma.JsonNull,
        status: VendorStatus.ACTIVE,
      },
    });

    if (ownerUser.role !== UserRole.SUPER_ADMIN && ownerUser.role !== UserRole.VENDOR_OWNER) {
        await prisma.user.update({
            where: { id: ownerUser.id },
            data: { role: UserRole.VENDOR_OWNER },
        });
    }

    return NextResponse.json(newVendor, { status: 201 });

  } catch (error: unknown) {
    console.error('Greška pri kreiranju salona:', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja salona.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN]);
export const POST = withRoleProtection(POST_handler, [UserRole.SUPER_ADMIN]);