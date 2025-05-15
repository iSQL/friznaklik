import prisma from '@/lib/prisma';
import { clerkClient, type User as ClerkUser } from '@clerk/nextjs/server';
import type { User as PrismaUser } from '@prisma/client';
import { formatErrorMessage } from '@/lib/errorUtils';

/**
 * Proverava da li autentifikovani korisnik ima 'admin' ulogu u bazi podataka.
 * @param userId - Clerk korisnički ID korisnika za proveru.
 * @returns True ako je korisnik admin, inače false.
 */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.log('[isAdminUser] Nevažeći ili nedostajući userId.');
    return false; 
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true }, 
    });

    if (!dbUser) {
      console.log(`[isAdminUser] Korisnik sa Clerk ID ${userId} nije pronađen u bazi.`);
      return false;
    }
    return dbUser.role === 'admin';
  } catch (error) {
    console.error(`[isAdminUser] Greška pri preuzimanju uloge za Clerk ID ${userId}:`, error);
    return false;
  }
}

interface GetOrCreateDbUserResult {
  user: PrismaUser | null;
  wasCreated: boolean;
}

/**
 * Pribavlja korisnika iz lokalne baze podataka na osnovu Clerk ID-ja.
 * Ako korisnik ne postoji u lokalnoj bazi, pribavlja podatke sa Clerk-a i kreira ga.
 * @param clerkId ID korisnika sa Clerk-a.
 * @returns Objekat sa PrismaUser objektom (ili null) i boolean vrednošću 'wasCreated'.
 */
export async function getOrCreateDbUser(clerkId: string): Promise<GetOrCreateDbUserResult> {
  if (!clerkId) {
    console.error('[getOrCreateDbUser] Pozvano bez clerkId.');
    return { user: null, wasCreated: false };
  }

  try {
    let dbUser = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (dbUser) {
      return { user: dbUser, wasCreated: false };
    }

    console.log(`[getOrCreateDbUser] Korisnik ${clerkId} nije pronađen u lokalnoj bazi. Pribavljanje sa Clerk-a...`);
    let clerkUser: ClerkUser | null = null;
    try {
      const client = await clerkClient();
      clerkUser = await client.users.getUser(clerkId); 
    } catch (clerkError: unknown) {
      if ((clerkError as { status: number }).status === 404) 
      {
          console.warn(`[getOrCreateDbUser] Korisnik sa Clerk ID ${clerkId} nije pronađen ni na Clerk-u.`);
          return { user: null, wasCreated: false };
      }
      throw clerkError; 
    }

    if (!clerkUser) {
      console.warn(`[getOrCreateDbUser] Nije moguće pribaviti Clerk podatke za korisnika ${clerkId}.`);
      return { user: null, wasCreated: false };
    }

    const primaryEmailObject = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );
    const emailAddress = primaryEmailObject?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!emailAddress) {
      console.error(`[getOrCreateDbUser] Nije moguće pronaći email adresu za Clerk korisnika ${clerkId}. Kreiranje nije moguće.`);
      return { user: null, wasCreated: false };
    }
    
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null;

    console.log(`[getOrCreateDbUser] Kreiranje korisnika ${clerkId} u lokalnoj bazi...`);
    dbUser = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email: emailAddress,
        name: name,
      },
    });

    console.log(`[getOrCreateDbUser] Korisnik ${clerkId} uspešno kreiran u lokalnoj bazi.`);
    return { user: dbUser, wasCreated: true };

  } catch (error: unknown) {
    const userFriendlyMessage = formatErrorMessage(error, `pribavljanja ili kreiranja korisnika ${clerkId}`);
    console.error(userFriendlyMessage);
    return { user: null, wasCreated: false };
  }
}
