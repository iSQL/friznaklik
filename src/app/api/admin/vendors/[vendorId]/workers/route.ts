// src/app/api/admin/vendors/[vendorId]/workers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums'; // Ensure this is your correct enum path
import {  Prisma } from '@prisma/client';
import { z } from 'zod';

const createWorkerSchema = z.object({
  name: z.string().min(1, 'Ime radnika je obavezno.'),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().url('URL fotografije nije validan.').optional().nullable(),
  userEmail: z.string().email("Neispravan format email adrese.").optional().nullable(),
});

interface RouteContext {
  params: Promise<{ vendorId: string }>;
}

async function GET_handler(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId } = await context.params;

  if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Nemate pristup radnicima ovog salona.' }, { status: 403 });
  }

  try {
    const workers = await prisma.worker.findMany({
      where: { vendorId: vendorId },
      orderBy: { name: 'asc' },
      include: {
        user: { select: { email: true, firstName: true, lastName: true, clerkId: true } },
        services: { select: { id: true, name: true } } 
      }
    });
    return NextResponse.json(workers);
  } catch (error) {
    console.error(`Greška pri dobavljanju radnika za salon ${vendorId}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja radnika.' }, { status: 500 });
  }
}

async function POST_handler(req: NextRequest, context: RouteContext) {
  const performingUser = await getCurrentUser(); // User performing the action (admin/vendor owner)
  if (!performingUser) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { vendorId } = await context.params;

  if (performingUser.role === UserRole.VENDOR_OWNER && performingUser.ownedVendorId !== vendorId) {
    return NextResponse.json({ message: 'Zabranjeno: Ne možete dodavati radnike za ovaj salon.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parseResult = createWorkerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, bio, photoUrl, userEmail } = parseResult.data;
    let prismaUserIdToLink: string | null = null;

    if (userEmail) {
      const userToBecomeWorker = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true, role: true }
      });

      if (!userToBecomeWorker) {
        return NextResponse.json({ message: `Korisnik sa email adresom ${userEmail} nije pronađen.` }, { status: 404 });
      }
      
      const existingWorkerLink = await prisma.worker.findFirst({
          where: { vendorId: vendorId, userId: userToBecomeWorker.id }
      });
      if (existingWorkerLink) {
          return NextResponse.json({ message: `Korisnik sa emailom ${userEmail} je već radnik u ovom salonu.`}, { status: 409 });
      }
      prismaUserIdToLink = userToBecomeWorker.id;

      // Update user role to WORKER if they are currently just a USER
      if (userToBecomeWorker.role === UserRole.USER) {
        await prisma.user.update({
          where: { id: userToBecomeWorker.id },
          data: { role: UserRole.WORKER },
        });
        console.log(`User role for ${userEmail} updated to WORKER.`);
      } else {
        console.log(`User ${userEmail} already has role ${userToBecomeWorker.role}, not changing to WORKER.`);
      }
    }

    const vendorServices = await prisma.service.findMany({
        where: { vendorId: vendorId, active: true },
        select: { id: true },
    });

    const newWorker = await prisma.worker.create({
      data: {
        name,
        bio,
        photoUrl,
        vendorId: vendorId,
        userId: prismaUserIdToLink,
        services: { 
            connect: vendorServices.map(service => ({ id: service.id }))
        }
      },
      include: { 
        user: { select: { clerkId: true, email: true, firstName: true, lastName: true, role: true } }, // Include role
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
      if (error.code === 'P2002' && (error.meta?.target as string[])?.includes('unique_vendor_user_worker')) {
         return NextResponse.json({ message: 'Ovaj korisnik je već registrovan kao radnik za ovaj salon.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja radnika.' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = withRoleProtection(POST_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
