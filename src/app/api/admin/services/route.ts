import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import { z } from 'zod';

const serviceSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be a positive number'),
  duration: z.number().int().positive('Duration must be a positive integer (minutes)'),
  vendorId: z.string().cuid('Invalid vendor ID format').optional(),
});

/**
 * Handles GET requests to fetch services.
 * SUPER_ADMIN can fetch all services.
 * VENDOR_OWNER can fetch services for their own vendor.
 */
async function GET_handler() {
  try {
    const user = await getCurrentUser(); 
    if (!user) {
        return NextResponse.json({ message: 'User not found after authentication' }, { status: 404 });
    }

    let services;
    if (user.role === UserRole.SUPER_ADMIN) {
      services = await prisma.service.findMany({
        include: {
          vendor: {
            select: { name: true, id: true },
          },
        },
        orderBy: { vendorId: 'asc' }, 
      });
    } else if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vendor owner does not have an associated vendor.' }, { status: 403 });
      }
      services = await prisma.service.findMany({
        where: { vendorId: user.ownedVendorId },
        orderBy: { name: 'asc' },
      });
    } else {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ message: 'Internal server error while fetching services' }, { status: 500 });
  }
}

/**
 * Handles POST requests to create a new service.
 * SUPER_ADMIN must provide a vendorId.
 * VENDOR_OWNER will have the service associated with their ownedVendorId.
 */
async function POST_handler(req: NextRequest) {
  try {
    const user = await getCurrentUser();
     if (!user) {
        return NextResponse.json({ message: 'User not found after authentication' }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = serviceSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Invalid input', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, description, price, duration } = parseResult.data;
    let targetVendorId: string | undefined | null = parseResult.data.vendorId;

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vendor owner does not have an associated vendor.' }, { status: 403 });
      }
      if (targetVendorId && targetVendorId !== user.ownedVendorId) {
          return NextResponse.json({ message: 'Vendor owner cannot create services for another vendor.' }, { status: 403 });
      }
      targetVendorId = user.ownedVendorId; 
    } else if (user.role === UserRole.SUPER_ADMIN) {
      if (!targetVendorId) {
        return NextResponse.json({ message: 'vendorId is required for SUPER_ADMIN to create a service.' }, { status: 400 });
      }
      const vendorExists = await prisma.vendor.findUnique({ where: { id: targetVendorId } });
      if (!vendorExists) {
        return NextResponse.json({ message: `Vendor with ID ${targetVendorId} not found.` }, { status: 404 });
      }
    } else {
        return NextResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    
    if (!targetVendorId) {
        return NextResponse.json({ message: 'Vendor ID could not be determined.' }, { status: 500 });
    }

    const newService = await prisma.service.create({
      data: {
        name,
        description,
        price,
        duration,
        vendorId: targetVendorId,
      },
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    if (error instanceof z.ZodError) { 
        return NextResponse.json({ message: 'Invalid input', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while creating service' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = withRoleProtection(POST_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
