// src/app/api/admin/workers/[workerId]/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const updateWorkerServicesSchema = z.object({
  serviceIds: z.array(z.string().cuid('Svaki ID usluge mora biti validan CUID.')).min(0, "Lista ID-usluga ne može biti prazna ako se šalje, ali može biti prazan niz za uklanjanje svih usluga."),
});

interface RouteContext {
  params: Promise<{
    workerId: string;
    // vendorId is not directly in this route's params, but we get it from the worker
  }>;
}

async function PUT_handler(req: NextRequest, context: RouteContext) {
  const user: AuthenticatedUser | null = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije.' }, { status: 404 });
  }

  const { workerId } = await context.params;
  if (!workerId) {
    return NextResponse.json({ message: 'ID radnika je obavezan.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parseResult = updateWorkerServicesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { serviceIds } = parseResult.data;

    // Fetch the worker to verify ownership and get their vendorId
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { vendorId: true }
    });

    if (!worker) {
      return NextResponse.json({ message: `Radnik sa ID ${workerId} nije pronađen.` }, { status: 404 });
    }

    // Authorization: VENDOR_OWNER can only manage workers of their own vendor
    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || worker.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovom radniku.' }, { status: 403 });
      }
    }
    // SUPER_ADMIN can manage any worker's services

    // Validate that all provided serviceIds belong to the worker's vendor
    if (serviceIds.length > 0) {
        const servicesFromVendor = await prisma.service.findMany({
            where: {
                id: { in: serviceIds },
                vendorId: worker.vendorId, // Ensure services are from the same vendor as the worker
            },
            select: { id: true }
        });

        if (servicesFromVendor.length !== serviceIds.length) {
            const foundServiceIds = servicesFromVendor.map(s => s.id);
            const missingOrInvalidIds = serviceIds.filter(id => !foundServiceIds.includes(id));
            return NextResponse.json({ message: `Jedna ili više pruženih usluga (ID: ${missingOrInvalidIds.join(', ')}) ne pripadaju salonu ovog radnika ili ne postoje.` }, { status: 400 });
        }
    }

    // Update the worker's services
    // Using set will replace all existing service assignments for this worker with the new list
    const updatedWorker = await prisma.worker.update({
      where: { id: workerId },
      data: {
        services: {
          set: serviceIds.map(id => ({ id: id })),
        },
      },
      include: { // Return the updated worker with their new service list
        services: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(updatedWorker);

  } catch (error: unknown) {
    console.error(`Greška pri ažuriranju usluga za radnika ${workerId}:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Nevalidan unos.', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found (worker)
        return NextResponse.json({ message: 'Radnik nije pronađen za ažuriranje.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja usluga radnika.' }, { status: 500 });
  }
}

export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);