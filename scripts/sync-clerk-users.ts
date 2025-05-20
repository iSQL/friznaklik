// scripts/sync-clerk-users.ts
import { PrismaClient } from '@prisma/client';
// Importujemo clerkClient i User. TypeScript sugeriše da je clerkClient funkcija.
import { clerkClient as getClerkClientFunction, User } from '@clerk/nextjs/server'; 

// Opciono: Ako koristite dotenv za učitavanje .env fajla za skripte
// import * as dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '../../.env') }); 

enum UserRole {
  USER = 'USER',
  VENDOR_OWNER = 'VENDOR_OWNER',
  WORKER = 'WORKER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

const prisma = new PrismaClient();

async function main() {
  console.log('Pokretanje skripte za sinhronizaciju Clerk korisnika sa lokalnom bazom...');

  if (!process.env.CLERK_SECRET_KEY) {
    console.error('GREŠKA: CLERK_SECRET_KEY environment varijabla nije postavljena.');
    process.exit(1);
  }

  let allClerkUsers: User[] = [];
  let offset = 0;
  const limit = 50; 
  let hasMore = true;

  try {
    // Pozivamo uvezenu funkciju getClerkClientFunction i čekamo da Promise vrati instancu klijenta
    const actualClerkClient = await getClerkClientFunction();

    console.log('Preuzimanje korisnika iz Clerka...');
    while (hasMore) {
      // Koristimo dobijenu instancu klijenta
      const userListResponse = await actualClerkClient.users.getUserList({
        limit,
        offset,
        orderBy: '+created_at', 
      });

      const users = userListResponse.data ?? [];

      if (users.length > 0) {
        allClerkUsers = allClerkUsers.concat(users);
        offset += users.length;
        console.log(`Preuzeto ${users.length} korisnika, ukupno do sada: ${allClerkUsers.length}`);
      } else {
        hasMore = false;
      }
      if (hasMore) await new Promise(resolve => setTimeout(resolve, 200)); 
    }
    console.log(`Ukupno preuzeto ${allClerkUsers.length} korisnika iz Clerka.`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const clerkUser of allClerkUsers) {
      const primaryEmailAddress = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      )?.emailAddress;

      if (!primaryEmailAddress) {
        console.warn(`Korisnik ${clerkUser.id} (${clerkUser.firstName} ${clerkUser.lastName}) nema primarnu email adresu. Preskačem.`);
        skippedCount++;
        continue;
      }

      const userRoleInDb: UserRole = UserRole.USER; 

      try {
        const result = await prisma.user.upsert({
          where: { clerkId: clerkUser.id },
          update: {
            email: primaryEmailAddress,
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
          },
          create: {
            clerkId: clerkUser.id,
            email: primaryEmailAddress,
            firstName: clerkUser.firstName || null,
            lastName: clerkUser.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
            role: userRoleInDb,
          },
        });
        
        if (result.createdAt.getTime() === result.updatedAt.getTime()) { 
          console.log(`Kreiran korisnik: ${primaryEmailAddress} (Clerk ID: ${clerkUser.id})`);
          createdCount++;
        } else {
          console.log(`Ažuriran korisnik: ${primaryEmailAddress} (Clerk ID: ${clerkUser.id})`);
          updatedCount++;
        }
      } catch (dbError) {
        console.error(`Greška pri upisu korisnika ${primaryEmailAddress} (Clerk ID: ${clerkUser.id}) u bazu:`, dbError);
        skippedCount++;
      }
    }

    console.log('\n--- Rezime sinhronizacije ---');
    console.log(`Ukupno Clerk korisnika: ${allClerkUsers.length}`);
    console.log(`Kreirano novih korisnika u lokalnoj bazi: ${createdCount}`);
    console.log(`Ažurirano postojećih korisnika: ${updatedCount}`);
    console.log(`Preskočeno korisnika (npr. bez emaila ili greška pri upisu): ${skippedCount}`);
    console.log('Sinhronizacija završena.');

  } catch (error) {
    console.error('Došlo je do greške tokom procesa sinhronizacije:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
