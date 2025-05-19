// src/app/api/admin/vendors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withRoleProtection } from '@/lib/authUtils';
import { UserRole, VendorStatus } from '@/lib/types/prisma-enums'; // Ispravljen import
import { Prisma } from '@prisma/client'; // Prisma ostaje za Prisma.JsonNull i druge Prisma tipove
import { z } from 'zod';

const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; 

// Zod šema za validaciju dnevnog radnog vremena (ista kao u [vendorId]/route.ts)
const dailyHoursSchema = z.object({
    open: z.string().nullable().optional(),
    close: z.string().nullable().optional(),
    isClosed: z.boolean().optional().default(false),
})
.superRefine((data, ctx) => {
    if (data.isClosed === false) {
        if (!data.open || !timeFormatRegex.test(data.open)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Vreme otvaranja je obavezno i mora biti u HH:mm formatu kada salon nije označen kao zatvoren.",
                path: ['open'],
            });
        }
        if (!data.close || !timeFormatRegex.test(data.close)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Vreme zatvaranja je obavezno i mora biti u HH:mm formatu kada salon nije označen kao zatvoren.",
                path: ['close'],
            });
        }
        if (data.open && data.close && timeFormatRegex.test(data.open) && timeFormatRegex.test(data.close)) {
            const [openHour, openMinute] = data.open.split(':').map(Number);
            const [closeHour, closeMinute] = data.close.split(':').map(Number);
            if (openHour > closeHour || (openHour === closeHour && openMinute >= closeMinute)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Krajnje vreme mora biti nakon početnog vremena.",
                    path: ['close'],
                });
            }
        }
    }
}).optional().nullable();

// Zod šema za validaciju kompletnog objekta radnog vremena (ista kao u [vendorId]/route.ts)
const operatingHoursSchema = z.object({
  monday: dailyHoursSchema,
  tuesday: dailyHoursSchema,
  wednesday: dailyHoursSchema,
  thursday: dailyHoursSchema,
  friday: dailyHoursSchema,
  saturday: dailyHoursSchema,
  sunday: dailyHoursSchema,
}).optional().nullable();

// Zod šema za validaciju podataka prilikom kreiranja novog salona
const vendorCreateSchema = z.object({
  name: z.string().min(1, 'Naziv salona je obavezan.'),
  description: z.string().optional().nullable(),
  ownerId: z.string().min(1, 'ID vlasnika (Clerk ID) je obavezan.'), 
  address: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  operatingHours: operatingHoursSchema, // Koristimo definisanu šemu
});

// GET handler za dobavljanje svih salona (samo za SUPER_ADMIN)
async function GET_all_vendors_handler(req: NextRequest) {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        owner: { // Uključujemo podatke o vlasniku
          select: {
            id: true,
            clerkId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: { // Broj povezanih usluga i termina
            select: { services: true, appointments: true }
        }
      },
      orderBy: {
        createdAt: 'desc', // Sortiramo po datumu kreiranja, najnoviji prvo
      },
    });
    return NextResponse.json(vendors);
  } catch (error) {
    console.error('Greška pri dobavljanju salona:', error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja salona.' }, { status: 500 });
  }
}

// POST handler za kreiranje novog salona (samo za SUPER_ADMIN)
async function POST_create_vendor_handler(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = vendorCreateSchema.safeParse(body);

    if (!parseResult.success) {
      // Detaljniji ispis Zod grešaka na serveru
      console.error("Zod validation failed for vendor creation:", JSON.stringify(parseResult.error.flatten(), null, 2));
      return NextResponse.json({ message: 'Nevalidan unos', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, description, ownerId: ownerClerkId, address, phoneNumber, operatingHours: formOperatingHours } = parseResult.data;

    // Provera da li korisnik (budući vlasnik) postoji
    const ownerUser = await prisma.user.findUnique({
      where: { clerkId: ownerClerkId }, 
    });

    if (!ownerUser) {
      return NextResponse.json({ message: `Korisnik (vlasnik) sa Clerk ID ${ownerClerkId} nije pronađen.` }, { status: 404 });
    }

    // Provera da li korisnik već poseduje salon
    const existingVendorForOwner = await prisma.vendor.findUnique({
        where: { ownerId: ownerUser.id } // ownerId u Vendor tabeli je Prisma User ID
    });

    if (existingVendorForOwner) {
        return NextResponse.json({ message: `Korisnik ${ownerUser.email} već poseduje salon: ${existingVendorForOwner.name}.` }, { status: 409 });
    }
    
    // Priprema operatingHours za Prisma bazu
    let prismaOperatingHoursValue: Prisma.InputJsonValue | undefined = undefined;
    if (formOperatingHours) {
        const tempPrismaHours: Prisma.JsonObject = {};
         for (const day of Object.keys(formOperatingHours) as Array<keyof typeof formOperatingHours>) {
            const dayData = formOperatingHours[day];
            if (dayData) { // Ako dan postoji u payload-u
                if (dayData.isClosed) { // Ako je eksplicitno zatvoren
                    tempPrismaHours[day] = { open: null, close: null, isClosed: true };
                } else if (dayData.open && dayData.close) { // Ako je otvoren i ima oba vremena
                    tempPrismaHours[day] = { open: dayData.open, close: dayData.close, isClosed: false };
                } else { // Ako nije zatvoren ali nedostaje vreme (Zod bi trebalo ovo da uhvati)
                    tempPrismaHours[day] = null; // Smatramo nevalidnim ili nekompletnim unosom za dan
                }
            } else { // Ako dan nije uopšte poslat u payload-u za operatingHours
                 tempPrismaHours[day] = null;
            }
        }
        prismaOperatingHoursValue = tempPrismaHours;
    }


    // Kreiranje novog salona
    const newVendor = await prisma.vendor.create({
      data: {
        name,
        description,
        ownerId: ownerUser.id, // Koristimo Prisma User ID
        address,
        phoneNumber,
        operatingHours: prismaOperatingHoursValue, // Formatirano za Prisma
        status: VendorStatus.ACTIVE, // Novi saloni su podrazumevano aktivni
      },
    });

    // Ako je korisnik bio samo USER, unapredi mu ulogu u VENDOR_OWNER
    if (ownerUser.role === UserRole.USER) {
        await prisma.user.update({
            where: { id: ownerUser.id },
            data: { role: UserRole.VENDOR_OWNER },
        });
    }

    return NextResponse.json(newVendor, { status: 201 });

  } catch (error: unknown) {
    console.error('Greška pri kreiranju salona:', error);
    if (error instanceof z.ZodError) {
        // Detaljniji ispis Zod grešaka na serveru
        console.error("Zod error details on POST:", JSON.stringify(error.flatten(), null, 2));
        return NextResponse.json({ message: 'Nevalidan unos (Zod)', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom kreiranja salona.' }, { status: 500 });
  }
}

// Exportovanje handlera sa zaštitom ruta
export const GET = withRoleProtection(GET_all_vendors_handler, [UserRole.SUPER_ADMIN]);
export const POST = withRoleProtection(POST_create_vendor_handler, [UserRole.SUPER_ADMIN]);
