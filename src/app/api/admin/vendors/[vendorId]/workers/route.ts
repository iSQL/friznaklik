// src/app/api/admin/vendors/[vendorId]/workers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import {  Prisma } from '@prisma/client';
import { z } from 'zod';

// Zod schema for creating a worker
const createWorkerSchema = z.object({
  name: z.string().min(1, 'Ime radnika je obavezno.'),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url('URL fotografije nije validan.').optional().nullable(),
  userClerkId: z.string().optional().nullable(), // Clerk ID if linking to an existing User
});

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

// GET handler to list workers for a specific vendor
async function GET_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId } = await context.params;

  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Nemate pristup radnicima ovog salona.' }, { status: 403 });
  }
  // SUPER_ADMIN can access any vendor's workers

  try {
    const workers = await prisma.worker.findMany({
      where: { vendorId: vendorId },
      orderBy: { name: 'asc' },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } }, // Include basic user info if linked
        services: { select: { id: true, name: true } } // Include services worker can perform
      }
    });
    return NextResponse.json(workers);
  } catch (error) {
    console.error(`Greška pri dobavljanju radnika za salon ${vendorId}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja radnika.' }, { status: 500 });
  }
}

// POST handler to create a new worker for a specific vendor
async function POST_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId } = await context.params;

  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete dodavati radnike za ovaj salon.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parseResult = createWorkerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, bio, photoUrl, userClerkId } = parseResult.data;
    let prismaUserId: string | null = null;

    if (userClerkId) {
      const linkedUser = await prisma.user.findUnique({
        where: { clerkId: userClerkId },
        select: { id: true, role: true }
      });
      if (!linkedUser) {
        return NextResponse.json({ message: `Korisnik sa Clerk ID ${userClerkId} nije pronađen.` }, { status: 404 });
      }
      const existingWorkerLink = await prisma.worker.findFirst({
          where: { vendorId: vendorId, userId: linkedUser.id }
      });
      if (existingWorkerLink) {
          return NextResponse.json({ message: `Korisnik ${userClerkId} je već radnik u ovom salonu.`}, { status: 409 });
      }
      prismaUserId = linkedUser.id;
      // Optionally, if a USER becomes a WORKER, you might want to update their role to WORKER
      // For now, we are not changing the UserRole here, but it's a consideration.
      // if (linkedUser.role === UserRole.USER) {
      //   await prisma.user.update({ where: { id: linkedUser.id }, data: { role: UserRole.WORKER }});
      // }
    }

    // Fetch all active services for the vendor
    const vendorServices = await prisma.service.findMany({
        where: {
            vendorId: vendorId,
            active: true,
        },
        select: {
            id: true,
        },
    });

    const newWorker = await prisma.worker.create({
      data: {
        name,
        bio,
        photoUrl,
        vendorId: vendorId,
        userId: prismaUserId,
        services: { // Connect to all vendor's active services by default
            connect: vendorServices.map(service => ({ id: service.id }))
        }
      },
      include: { // Include services in the response
        services: { select: { id: true, name: true }}
      }
    });

    return NextResponse.json(newWorker, { status: 201 });

  } catch (error: unknown) {
    console.error(`Greška pri kreiranju radnika za salon ${vendorId}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target === 'Worker_userId_key' || (error.meta?.target as string[])?.includes('unique_vendor_user_worker')) {
         // Adjusted to check for the named unique constraint as well
         return NextResponse.json({ message: 'Ovaj korisnik (User) je već registrovan kao radnik za ovaj salon ili globalno ako je userId unikatan.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja radnika.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = withRoleProtection(POST_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);