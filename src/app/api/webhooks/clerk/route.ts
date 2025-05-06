// src/app/api/webhooks/clerk/route.ts

import { WebhookEvent, UserJSON } from '@clerk/nextjs/server'; // Import specific type UserJSON if available, or use type assertion
import { headers } from 'next/headers';
import { Webhook } from 'svix';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

// This is your Clerk webhook secret.
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

// Handles POST requests from Clerk webhooks
export async function POST(req: Request) {
  // Get the headers from the incoming request
  const headerPayload = headers();
  const svix_id = (await headerPayload).get('svix-id'); // Removed await as headers() returns Headers object directly
  const svix_timestamp = (await headerPayload).get('svix-timestamp');
  const svix_signature = (await headerPayload).get('svix-signature');

  // If there are no Svix headers, return an error
  if (!webhookSecret) {
     console.error('Error: CLERK_WEBHOOK_SECRET is not set in environment variables.');
     return new NextResponse('Webhook secret not configured', { status: 500 });
  }
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log('Webhook Error: Missing Svix headers');
    return new NextResponse('Error occured -- no Svix headers', {
      status: 400,
    });
  }

  // Get the request body as text
  const payload = await req.text();

  // Verify the webhook signature
  const wh = new Webhook(webhookSecret);
  let msg: WebhookEvent;

  try {
    // Verify the payload and headers against the secret
    msg = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent; // Cast the verified message to WebhookEvent
  } catch (err) {
    // If verification fails, log the error and return a 400
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error occured -- verification failed', {
      status: 400,
    });
  }

  // --- Process the webhook event ---
  const eventType = msg.type;
  const eventData = msg.data; // Use a different variable name to avoid confusion

  console.log(`Processing webhook event: ${eventType}`);

  // Handle the 'user.created' event
  if (eventType === 'user.created') {
    console.log('User created event received:', eventData);

    // *** Type Assertion/Guard for User Data ***
    // Since we are inside the 'user.created' block, we expect data matching UserJSON
    // Use type assertion to inform TypeScript
    const userData = eventData as UserJSON; // Assert type here

    // Extract necessary data from the typed userData object
    const clerkId = userData.id;
    // Clerk stores emails in an array, get the first one (primary)
    // Accessing email_addresses is now safe due to the type assertion above
    const email = userData.email_addresses[0]?.email_address;
    const firstName = userData.first_name;
    const lastName = userData.last_name;
    const name = `${firstName || ''} ${lastName || ''}`.trim() || 'New User'; // Construct full name

    // Basic validation
    if (!clerkId || !email) {
        console.error('Webhook Error (user.created): Data missing required fields (clerkId or email)');
         return new NextResponse('Webhook data missing required fields', { status: 400 });
    }


    try {
      // Create a new user record in your database using Prisma
      const newUser = await prisma.user.create({
        data: {
          clerkId: clerkId,
          email: email,
          name: name, // Save the constructed name
          // role defaults to 'user' as defined in schema.prisma
        },
      });
      console.log('User created in database:', newUser);
      // Return a success response
      return NextResponse.json({ message: 'User created successfully', user: newUser }, { status: 201 });

    } catch (dbError) {
      console.error('Error creating user in database:', dbError);
      // Return an error response if database operation fails
      return new NextResponse('Database error creating user', { status: 500 });
    }
  }

  // Handle the 'user.deleted' event
  if (eventType === 'user.deleted') {
      console.log('User deleted event received:', eventData);
      // *** Type Assertion/Guard for Deleted Object Data ***
      // Assert the type expected for deleted events (often contains just 'id' and 'deleted')
      const deletedData = eventData as { id?: string; deleted?: boolean }; // Adjust type as needed based on Clerk docs

      const clerkId = deletedData.id; // Accessing 'id' should be safer now
      if (!clerkId) {
           console.error('Webhook Error (user.deleted): Data missing clerkId for deletion');
           return new NextResponse('Webhook data missing clerkId', { status: 400 });
      }
      try {
          // Use deleteMany as the user might not exist if webhook failed before
          const deleteResult = await prisma.user.deleteMany({
              where: { clerkId: clerkId }
          });
          if (deleteResult.count > 0) {
             console.log(`User deleted from database (Clerk ID: ${clerkId}). Count: ${deleteResult.count}`);
          } else {
             console.log(`User with Clerk ID ${clerkId} not found in database for deletion (might have been deleted already).`);
          }
          return NextResponse.json({ message: 'User deletion processed' }, { status: 200 });
      } catch (dbError) {
          console.error(`Error deleting user (Clerk ID: ${clerkId}) from database:`, dbError);
          return new NextResponse('Database error deleting user', { status: 500 });
      }
  }

  // TODO: Handle other relevant webhook events like 'user.updated'
  // if (eventType === 'user.updated') {
  //    const userData = eventData as UserJSON;
  //    // ... logic to update user details in your DB ...
  // }


  // If the event type is not handled, return a success response (Clerk expects this)
  console.log(`Webhook event type ${eventType} received but not explicitly handled.`);
  return new NextResponse('Event received', { status: 200 });
}
