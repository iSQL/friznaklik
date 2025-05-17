import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, Prisma } from '@prisma/client';
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
      // Optionally include user details if linked
      // include: { user: { select: { email: true, firstName: true, lastName: true } } }
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
  // SUPER_ADMIN can add workers to any vendor

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
      // Optional: Check if this user is already a worker for THIS vendor
      const existingWorkerLink = await prisma.worker.findFirst({
          where: { vendorId: vendorId, userId: linkedUser.id }
      });
      if (existingWorkerLink) {
          return NextResponse.json({ message: `Korisnik ${userClerkId} je već radnik u ovom salonu.`}, { status: 409 });
      }
      prismaUserId = linkedUser.id;
      // Optional: if a USER becomes a WORKER, update their role if necessary
      // For now, linking doesn't automatically change UserRole, but you might add that
    }

    const newWorker = await prisma.worker.create({
      data: {
        name,
        bio,
        photoUrl,
        vendorId: vendorId,
        userId: prismaUserId,
      },
    });

    return NextResponse.json(newWorker, { status: 201 });

  } catch (error: unknown) {
    console.error(`Greška pri kreiranju radnika za salon ${vendorId}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle potential unique constraint violation if a user is already a worker globally (due to @unique on userId in Worker model)
      if (error.code === 'P2002' && error.meta?.target === 'Worker_userId_key') {
         return NextResponse.json({ message: 'Ovaj korisnik je već registrovan kao radnik negde drugde.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja radnika.' }, { status: 500 });
  }
}

// Apply role protection
export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = withRoleProtection(POST_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);