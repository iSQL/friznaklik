import { WebhookEvent } from '@clerk/nextjs/server'; // Import Clerk webhook event types
import { headers } from 'next/headers'; // Import headers helper for accessing request headers
import { Webhook } from 'svix'; // Import Svix for verifying webhook signatures
import prisma from '@/lib/prisma'; // Import your Prisma client utility
import { NextResponse } from 'next/server'; // Import NextResponse for sending responses

// This is your Clerk webhook secret.
// You can find it in the Clerk Dashboard -> Webhooks -> Your Webhook Endpoint -> Reveal Secret.
// Store this in your environment variables for security.
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

// Handles POST requests from Clerk webhooks
export async function POST(req: Request) {
  // Get the headers from the incoming request
  const headerPayload = headers();
  const svix_id = (await headerPayload).get('svix-id');
  const svix_timestamp = (await headerPayload).get('svix-timestamp');
  const svix_signature = (await headerPayload).get('svix-signature');

  // If there are no Svix headers, return an error
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error occured -- no Svix headers', {
      status: 400,
    });
  }

  // Get the request body as text
  const payload = await req.text();

  // Verify the webhook signature
  // This is crucial to ensure the request is genuinely from Clerk
  const wh = new Webhook(webhookSecret!); // Use webhookSecret! because we check for its existence below
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
  // Get the event type and data
  const eventType = msg.type;
  const data = msg.data;

  console.log(`Processing webhook event: ${eventType}`);

  // Handle the 'user.created' event
  if (eventType === 'user.created') {
    console.log('User created event received:', data);

    // Extract necessary data from the Clerk user object
    const clerkId = data.id;
    // Clerk stores emails in an array, get the first one (primary)
    const email = data.email_addresses[0]?.email_address;
    const firstName = data.first_name;
    const lastName = data.last_name;
    const name = `${firstName || ''} ${lastName || ''}`.trim() || 'New User'; // Construct full name

    // Basic validation
    if (!clerkId || !email) {
        console.error('Webhook data missing required fields (clerkId or email)');
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

  // TODO: Handle other webhook events like 'user.updated', 'user.deleted', etc.
  // Example for user.deleted:
  /*
  if (eventType === 'user.deleted') {
      console.log('User deleted event received:', data);
      const clerkId = data.id; // Clerk user ID of the deleted user
      if (!clerkId) {
           console.error('Webhook data missing clerkId for deletion');
           return new NextResponse('Webhook data missing clerkId', { status: 400 });
      }
      try {
          await prisma.user.delete({
              where: { clerkId: clerkId }
          });
          console.log('User deleted from database:', clerkId);
          return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
      } catch (dbError) {
          console.error('Error deleting user from database:', dbError);
          // Handle case where user might not exist in your DB (already deleted or never created)
          if (dbError instanceof Error && dbError.message.includes('Record to delete not found')) {
             return new NextResponse('User not found in database for deletion', { status: 404 });
          }
          return new NextResponse('Database error deleting user', { status: 500 });
      }
  }
  */


  // If the event type is not handled, return a success response (Clerk expects this)
  return new NextResponse('Event received, but not handled', { status: 200 });
}
