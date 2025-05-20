// src/app/api/user/update-phone/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const phoneUpdateSchema = z.object({
  phoneNumber: z.string().min(6, "Broj telefona mora imati najmanje 6 karaktera.").max(20, "Broj telefona ne može biti duži od 20 karaktera.").optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();

    if (!user || !user.id) { // user.id je Prisma ID
      return NextResponse.json({ message: 'Korisnik nije autentifikovan.' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = phoneUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Neispravan unos.', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { phoneNumber } = parseResult.data;

    // Provera da li je broj telefona (ako je unet) već zauzet od strane drugog korisnika
    if (phoneNumber) {
      const existingUserWithPhoneNumber = await prisma.user.findUnique({
        where: {
          phoneNumber: phoneNumber,
          NOT: {
            id: user.id, // Izuzmi trenutnog korisnika iz provere
          },
        },
      });

      if (existingUserWithPhoneNumber) {
        return NextResponse.json({ message: 'Ovaj broj telefona je već u upotrebi.' }, { status: 409 }); // Conflict
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id }, // Koristimo Prisma user.id
      data: {
        phoneNumber: phoneNumber || null, // Postavi na null ako je prazan string ili null
      },
      select: { // Vraćamo samo relevantne podatke
        id: true,
        phoneNumber: true,
        firstName: true,
        email: true,
      }
    });

    return NextResponse.json({ message: 'Broj telefona uspešno sačuvan.', user: updatedUser }, { status: 200 });

  } catch (error: unknown) {
    console.error('Greška pri ažuriranju broja telefona:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Greška jedinstvenosti ako @unique na phoneNumber nije dobro obrađena gore (mada bi trebalo da jeste)
      if (error.code === 'P2002' && error.meta?.target === 'User_phoneNumber_key') {
        return NextResponse.json({ message: 'Ovaj broj telefona je već u upotrebi.' }, { status: 409 });
      }
    }
    return NextResponse.json({ message: 'Interna greška servera.' }, { status: 500 });
  }
}
