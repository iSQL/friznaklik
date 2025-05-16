// src/app/api/webhooks/clerk/route.ts
import { WebhookEvent, UserJSON } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { formatErrorMessage } from '@/lib/errorUtils';
import { UserRole } from '@prisma/client';

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET nije postavljen u env varijablama.');
    return new NextResponse('Webhook tajna nije konfigurisana.', { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.warn('Webhook greška: Nedostaju Svix zaglavlja.');
    return new NextResponse('Greška: Nedostaju Svix zaglavlja.', {
      status: 400,
    });
  }

  const payload = await req.text(); 
  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err: unknown) {
    const errorMessage = formatErrorMessage(err);
    console.error('Greška pri verifikaciji webhook-a:', errorMessage);
    return new NextResponse(`Greška pri verifikaciji: ${errorMessage}`, {
      status: 400,
    });
  }

  const eventType = evt.type;
  const eventData = evt.data as UserJSON | undefined; 

  console.log(`Primljen webhook događaj: ${eventType}`);

  if (!eventData) {
    console.error(`Webhook događaj ${eventType} nema eventData.`);
    return new NextResponse('Nedostaju podaci događaja.', { status: 400 });
  }

  try {
    switch (eventType) {
      case 'user.created':
        console.log('Obrada user.created:', eventData);
        const existingUserOnCreate = await prisma.user.findUnique({
          where: { clerkId: eventData.id },
        });
        if (existingUserOnCreate) {
          console.log(`Korisnik ${eventData.id} već postoji u bazi. Preskače se kreiranje.`);
          break;
        }
        await prisma.user.create({
          data: {
            clerkId: eventData.id,
            email: eventData.email_addresses?.find(email => email.id === eventData.primary_email_address_id)?.email_address || 
                   eventData.email_addresses?.[0]?.email_address || 
                   `user_${eventData.id}@example.com`, // Fallback email
            firstName: eventData.first_name || null, // Mapiramo na firstName
            lastName: eventData.last_name || null,   // Mapiramo na lastName
            profileImageUrl: eventData.image_url || null,
            role: UserRole.USER, // Podrazumevana uloga za novog korisnika
            // Ostala polja se mogu postaviti na podrazumevane vrednosti ili ostaviti prazna
          },
        });
        console.log(`Korisnik ${eventData.id} uspešno kreiran u bazi.`);
        break;

      case 'user.updated':
        console.log('Obrada user.updated:', eventData);
        const userToUpdate = await prisma.user.findUnique({
          where: { clerkId: eventData.id },
        });
        if (!userToUpdate) {
          // Ako korisnik ne postoji, možemo ga kreirati (upsert logika) ili samo logovati upozorenje
          console.warn(`Korisnik ${eventData.id} nije pronađen za ažuriranje. Razmislite o kreiranju.`);
          // Alternativno, kreiraj korisnika ako ne postoji:
          // await prisma.user.create({ data: { ... } });
          break;
        }
        await prisma.user.update({
          where: { clerkId: eventData.id },
          data: {
            email: eventData.email_addresses?.find(email => email.id === eventData.primary_email_address_id)?.email_address || 
                   eventData.email_addresses?.[0]?.email_address,
            firstName: eventData.first_name || null, // Mapiramo na firstName
            lastName: eventData.last_name || null,   // Mapiramo na lastName
            profileImageUrl: eventData.image_url || null,
            // Ostala polja se mogu ažurirati prema potrebama
          },
        });
        console.log(`Korisnik ${eventData.id} uspešno ažuriran u bazi.`);
        break;

      case 'user.deleted':
        console.log('Obrada user.deleted:', eventData);
        // Clerk može poslati { id: string, deleted: true } za user.deleted
        const clerkIdToDelete = eventData.id;
        if (!clerkIdToDelete) {
          console.error('user.deleted događaj bez ID-a korisnika.');
          return new NextResponse('Nedostaje ID korisnika za brisanje.', { status: 400 });
        }
        const userToDelete = await prisma.user.findUnique({
          where: { clerkId: clerkIdToDelete },
        });
        if (!userToDelete) {
          console.warn(`Korisnik ${clerkIdToDelete} nije pronađen za brisanje. Možda je već obrisan.`);
          break;
        }
        // TODO: Razmisliti o tome kako obraditi povezane entitete pre brisanja korisnika
        // Pre brisanja korisnika, možda da se brisu ili anonimizuju njegovi podatke
        // npr. termine, čet sesije, itd., ili da ih prebaci na nekog "ghost" korisnika.
        // Za sada, direktno brisanje:

        await prisma.user.delete({
          where: { clerkId: clerkIdToDelete },
        });
        console.log(`Korisnik ${clerkIdToDelete} uspešno obrisan iz baze.`);
        break;

      default:
        console.log(`Nije obrađen događaj: ${eventType}`);
    }

    return new NextResponse('Webhook uspešno obrađen.', { status: 200 });

  } catch (error: unknown) {
    const errorMessage = formatErrorMessage(error, `obrade webhook događaja ${eventType}`);
    console.error(errorMessage);
    return new NextResponse('Interna greška servera prilikom obrade webhook-a.', { status: 500 });
  }
}
