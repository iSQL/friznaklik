import { WebhookEvent, UserJSON } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { formatErrorMessage } from '@/lib/errorUtils'; 

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
  } catch (err: any) {
    console.error('Greška pri verifikaciji webhook-a:', err.message);
    return new NextResponse(`Greška pri verifikaciji: ${err.message}`, {
      status: 400,
    });
  }

  const eventType = evt.type;
  const eventData = evt.data as UserJSON; // Podaci o korisniku

  console.log(`Primljen webhook događaj: ${eventType}`);

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
            email: eventData.email_addresses.find(email => email.id === eventData.primary_email_address_id)?.email_address || eventData.email_addresses[0]?.email_address || `user_${eventData.id}@example.com`,
            name: `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim() || null,
           
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
          console.warn(`Korisnik ${eventData.id} nije pronađen za ažuriranje. Možda je potrebno prvo kreirati korisnika.`);
          
          break;
        }
        await prisma.user.update({
          where: { clerkId: eventData.id },
          data: {
            email: eventData.email_addresses.find(email => email.id === eventData.primary_email_address_id)?.email_address || eventData.email_addresses[0]?.email_address,
            name: `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim() || null,
          },
        });
        console.log(`Korisnik ${eventData.id} uspešno ažuriran u bazi.`);
        break;

      case 'user.deleted':
        console.log('Obrada user.deleted:', eventData);
        if (!eventData.id) {
          console.error('user.deleted događaj bez ID-a korisnika.');
          return new NextResponse('Nedostaje ID korisnika za brisanje.', { status: 400 });
        }
        const userToDelete = await prisma.user.findUnique({
          where: { clerkId: eventData.id },
        });
        if (!userToDelete) {
          console.warn(`Korisnik ${eventData.id} nije pronađen za brisanje. Možda je već obrisan.`);
          break;
        }
        await prisma.user.delete({
          where: { clerkId: eventData.id },
        });
        console.log(`Korisnik ${eventData.id} uspešno obrisan iz baze.`);
        break;

      default:
        console.log(`Nije obrađen događaj: ${eventType}`);
    }

    return new NextResponse('Webhook uspešno obrađen.', { status: 200 });

  } catch (error: any) {
    const errorMessage = formatErrorMessage(error, `obrade webhook događaja ${eventType}`);
    console.error(errorMessage);
    return new NextResponse('Interna greška servera prilikom obrade webhook-a.', { status: 500 });
  }
}
