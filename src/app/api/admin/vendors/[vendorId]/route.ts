import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  withRoleProtection,
  getCurrentUser, 
} from '@/lib/authUtils';
import { UserRole, VendorStatus } from '@/lib/types/prisma-enums'; 
import { Prisma } from '@prisma/client'; 
import { z } from 'zod';

const timeFormatRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; 

// Zod šema za validaciju dnevnog radnog vremena
const dailyHoursSchema = z.object({
    open: z.string().nullable().optional(), 
    close: z.string().nullable().optional(),
    isClosed: z.boolean().optional().default(false),
})
.superRefine((data, ctx) => {
    // Validacija se primenjuje samo ako dan NIJE označen kao zatvoren
    if (data.isClosed === false) { 
        // Ako nije zatvoren, open i close su obavezni
        if (!data.open || !timeFormatRegex.test(data.open)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Vreme otvaranja je obavezno i mora biti u HH:mm formatu kada salon nije označen kao zatvoren.",
                path: ['open'], // Putanja do polja koje je izazvalo grešku
            });
        }
        if (!data.close || !timeFormatRegex.test(data.close)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Vreme zatvaranja je obavezno i mora biti u HH:mm formatu kada salon nije označen kao zatvoren.",
                path: ['close'],
            });
        }
        // Provera da li je krajnje vreme posle početnog, samo ako su oba vremena validna i postoje
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
    // Ako je data.isClosed === true, ne radimo dodatnu validaciju za open/close polja
}).optional().nullable(); // Ceo objekat za dan može biti opciono null


// Zod šema za validaciju kompletnog objekta radnog vremena
const operatingHoursSchema = z.object({
  monday: dailyHoursSchema,
  tuesday: dailyHoursSchema,
  wednesday: dailyHoursSchema,
  thursday: dailyHoursSchema,
  friday: dailyHoursSchema,
  saturday: dailyHoursSchema,
  sunday: dailyHoursSchema,
}).optional().nullable(); // Ceo objekat operatingHours može biti opciono null


// Zod šema za validaciju podataka prilikom ažuriranja salona
const vendorUpdateSchema = z.object({
  name: z.string().min(1, 'Naziv salona je obavezan.').optional(),
  description: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  operatingHours: operatingHoursSchema, 
  status: z.nativeEnum(VendorStatus).optional(), // Koristi VendorStatus iz lokalnih enuma
});

// Interfejs za parametre rute
interface RouteContext {
  params: Promise<{ vendorId: string; }>; 
}

// GET handler za dobavljanje specifičnog salona
async function GET_handler(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(); 
    if (!user) {
      return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
    }

    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    // Dobavljanje salona sa podacima o vlasniku
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
            role: true, // Uključujemo rolu vlasnika
          },
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ message: 'Salon nije pronađen.' }, { status: 404 });
    }

    // Provera da li VENDOR_OWNER pristupa svom salonu
    if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Nemate pristup ovom salonu.' }, { status: 403 });
    }
    // SUPER_ADMIN može pristupiti bilo kom salonu

    return NextResponse.json(vendor);
  } catch (error) {
    const routeParams = await context.params; // Ponovo pristupamo ako je potrebno za logovanje
    console.error(`Greška pri dobavljanju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    return NextResponse.json({ message: 'Interna greška servera prilikom dobavljanja salona.' }, { status: 500 });
  }
}

// PUT handler za ažuriranje postojećeg salona
async function PUT_handler(req: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser(); 
    if (!user) {
      return NextResponse.json({ message: 'Neautorizovan pristup.' }, { status: 401 });
    }

    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    // Provera da li VENDOR_OWNER menja svoj salon
    if (user.role === UserRole.VENDOR_OWNER && user.ownedVendorId !== vendorId) {
        return NextResponse.json({ message: 'Zabranjeno: Možete menjati samo svoj salon.' }, { status: 403 });
    }
    // SUPER_ADMIN može menjati bilo koji salon

    const body = await req.json();
    const parseResult = vendorUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      // Detaljniji ispis Zod grešaka na serveru za lakše debugiranje
      console.error("Zod validation failed for vendor update:", JSON.stringify(parseResult.error.flatten(), null, 2));
      return NextResponse.json({ message: 'Nevalidan unos', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    // Priprema podataka za Prisma update, izostavljajući operatingHours za sada
    const dataToUpdate: Partial<Omit<Prisma.VendorUpdateInput, 'operatingHours'> & { operatingHours?: Prisma.InputJsonValue | typeof Prisma.JsonNull }> = {};

    if (parseResult.data.name !== undefined) dataToUpdate.name = parseResult.data.name;
    if (parseResult.data.description !== undefined) dataToUpdate.description = parseResult.data.description;
    if (parseResult.data.address !== undefined) dataToUpdate.address = parseResult.data.address;
    if (parseResult.data.phoneNumber !== undefined) dataToUpdate.phoneNumber = parseResult.data.phoneNumber;
    if (parseResult.data.status !== undefined) dataToUpdate.status = parseResult.data.status;
    
    // Konvertovanje operatingHours u Prisma.JsonValue ili Prisma.JsonNull
    if (parseResult.data.hasOwnProperty('operatingHours')) { // Proveravamo da li je operatingHours uopšte poslat
        if (parseResult.data.operatingHours === null) { // Ako je eksplicitno null
            dataToUpdate.operatingHours = Prisma.JsonNull;
        } else if (parseResult.data.operatingHours) { // Ako postoji i nije null
            const prismaOperatingHours: Prisma.JsonObject = {};
            for (const day of Object.keys(parseResult.data.operatingHours) as Array<keyof typeof parseResult.data.operatingHours>) {
                const dayData = parseResult.data.operatingHours[day];
                if (dayData) { // Ako dan postoji u payload-u
                    if (dayData.isClosed) { 
                        prismaOperatingHours[day] = { open: null, close: null, isClosed: true }; 
                    } else if (dayData.open && dayData.close) { 
                        prismaOperatingHours[day] = { open: dayData.open, close: dayData.close, isClosed: false };
                    } else { 
                        // Ako nije zatvoren ali nedostaje vreme, Zod bi trebalo da uhvati ovo.
                        // Za svaki slučaj, možemo postaviti na null ili preskočiti ovaj dan.
                        // Postavljanje na Prisma.JsonNull za ceo dan ako je nekonzistentno.
                        prismaOperatingHours[day] = null; 
                    }
                } else { 
                     prismaOperatingHours[day] = null; 
                }
            }
            dataToUpdate.operatingHours = prismaOperatingHours;
        }
    }


    const updatedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: dataToUpdate as Prisma.VendorUpdateInput, // Cast jer smo sigurni u strukturu
    });

    return NextResponse.json(updatedVendor);

  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri ažuriranju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Greška ako zapis za ažuriranje nije pronađen
        return NextResponse.json({ message: 'Salon nije pronađen za ažuriranje.' }, { status: 404 });
      }
    }
    if (error instanceof z.ZodError) { // Greška validacije
        console.error("Zod error details on PUT:", JSON.stringify(error.flatten(), null, 2));
        return NextResponse.json({ message: 'Nevalidan unos (Zod)', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom ažuriranja salona.' }, { status: 500 });
  }
}

// DELETE handler za "brisanje" (suspendovanje) salona
async function DELETE_handler(req: NextRequest, context: RouteContext) {
  try {
    // Samo SUPER_ADMIN može da suspenduje salon preko ove rute
    const routeParams = await context.params;
    const { vendorId } = routeParams;

    if (!vendorId) {
      return NextResponse.json({ message: 'ID salona je obavezan.' }, { status: 400 });
    }

    // Provera da li salon postoji
    const existingVendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!existingVendor) {
      return NextResponse.json({ message: 'Salon nije pronađen.' }, { status: 404 });
    }
    // Ako je salon već suspendovan, vraćamo uspeh
    if (existingVendor.status === VendorStatus.SUSPENDED) {
        return NextResponse.json({ message: 'Salon je već suspendovan.', vendor: existingVendor }, { status: 200 });
    }

    // Ažuriranje statusa salona na SUSPENDED
    const suspendedVendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: VendorStatus.SUSPENDED,
      },
    });

    return NextResponse.json({ message: 'Salon uspešno suspendovan.', vendor: suspendedVendor }, { status: 200 });

  } catch (error: unknown) {
    const routeParams = await context.params; 
    console.error(`Greška pri suspendovanju salona ${routeParams?.vendorId || 'unknown'}:`, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Greška ako zapis za ažuriranje nije pronađen
        return NextResponse.json({ message: 'Salon nije pronađen za suspendovanje.' }, { status: 404 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera prilikom suspendovanja salona.' }, { status: 500 });
  }
}

// Exportovanje handlera sa zaštitom ruta
export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const PUT = withRoleProtection(PUT_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const DELETE = withRoleProtection(DELETE_handler, [UserRole.SUPER_ADMIN]); // Samo SUPER_ADMIN može da suspenduje
