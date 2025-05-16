import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getCurrentUser,
  withRoleProtection,
  AuthenticatedUser,
} from '@/lib/authUtils';
import { UserRole, Prisma } from '@prisma/client'; 
import { z, ZodError } from 'zod'; 

const serviceUpdateSchema = z.object({
  name: z.string().min(1, 'Naziv usluge ne može biti prazan').optional(),
  description: z.string().optional().nullable(),
  price: z.number().positive('Cena mora biti pozitivan broj').optional(),
  duration: z.number().int().positive('Trajanje mora biti pozitivan ceo broj (u minutima)').optional(),
});

interface RouteHandlerContext {
  params: Promise<{
    id: string; 
  }>;
}

/**
 * Handles GET requests to fetch a specific service by its ID.
 * SUPER_ADMIN can fetch any service.
 * VENDOR_OWNER can only fetch services belonging to their vendor.
 */
async function GET_handler(req: NextRequest, context: RouteHandlerContext) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije' }, { status: 404 });
    }

    const routeParams = await context.params; 
    const { id: serviceId } = routeParams;

    if (!serviceId) {
      return NextResponse.json({ message: 'ID usluge je obavezan' }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        vendor: { select: { id: true, name: true }}
      }
    });

    if (!service) {
      return NextResponse.json({ message: 'Usluga nije pronađena' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || service.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovoj usluzi' }, { status: 403 });
      }
    }

    return NextResponse.json(service);
  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri dobavljanju usluge ${routeParams.id}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja usluge' }, { status: 500 });
  }
}

/**
 * Handles PUT requests to update an existing service.
 * SUPER_ADMIN can update any service.
 * VENDOR_OWNER can only update services belonging to their vendor.
 */
async function PUT_handler(req: NextRequest, context: RouteHandlerContext) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije' }, { status: 404 });
    }

    const routeParams = await context.params; // Await params
    const { id: serviceId } = routeParams;

    if (!serviceId) {
      return NextResponse.json({ message: 'ID usluge je obavezan' }, { status: 400 });
    }

    const existingService = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!existingService) {
      return NextResponse.json({ message: 'Usluga nije pronađena' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || existingService.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Ne možete ažurirati ovu uslugu' }, { status: 403 });
      }
    }

    const body = await req.json();
    const parseResult = serviceUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Nevalidan unos', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    if (Object.keys(parseResult.data).length === 0) {
        return NextResponse.json({ message: 'Nema podataka za ažuriranje' }, { status: 400 });
    }
    
    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: parseResult.data,
    });

    return NextResponse.json(updatedService);
  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri ažuriranju usluge ${routeParams.id}:`, error);
    if (error instanceof ZodError) {
        return NextResponse.json({ message: 'Nevalidan unos', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja usluge' }, { status: 500 });
  }
}

/**
 * Handles DELETE requests to remove a service.
 * SUPER_ADMIN can delete any service.
 * VENDOR_OWNER can only delete services belonging to their vendor.
 */
async function DELETE_handler(req: NextRequest, context: RouteHandlerContext) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Korisnik nije pronađen nakon autentifikacije' }, { status: 404 });
    }

    const routeParams = await context.params; 
    const { id: serviceId } = routeParams;

    if (!serviceId) {
      return NextResponse.json({ message: 'ID usluge je obavezan' }, { status: 400 });
    }

    const serviceToDelete = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!serviceToDelete) {
      return NextResponse.json({ message: 'Usluga nije pronađena' }, { status: 404 });
    }

    if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId || serviceToDelete.vendorId !== user.ownedVendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Ne možete obrisati ovu uslugu' }, { status: 403 });
      }
    }

    const relatedAppointments = await prisma.appointment.count({
        where: { serviceId: serviceId }
    });

    if (relatedAppointments > 0) {
        return NextResponse.json({ 
            message: `Ne može se obrisati usluga: Povezana je sa ${relatedAppointments} termin(a). Razmislite o arhiviranju ili preusmeravanju.` 
        }, { status: 409 });
    }

    await prisma.service.delete({
      where: { id: serviceId },
    });

    return NextResponse.json({ message: 'Usluga uspešno obrisana' }, { status: 200 });
  } catch (error: unknown) {
    const routeParams = await context.params;
    console.error(`Greška pri brisanju usluge ${routeParams.id}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003' || error.code === 'P2014') { 
            return NextResponse.json({ message: 'Ne može se obrisati usluga: Još uvek je referencirana od strane drugih zapisa (npr. termina).' }, { status: 409 });
        }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom brisanja usluge' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const DELETE = withRoleProtection(DELETE_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
