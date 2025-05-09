// src/app/api/services/route.ts

import { NextResponse } from 'next/server'; // Import NextResponse for sending responses
import prisma from '@/lib/prisma'; // Import your Prisma client utility

// Handles GET requests to /api/services
// This will fetch all services from the database and make them publicly available.
export async function GET() {
  console.log('GET /api/services: Request received'); // Debug log

  try {
    // Fetch all services from the database using Prisma
    // No authentication or authorization check needed here as this is a public endpoint.
    const services = await prisma.service.findMany();

    console.log('GET /api/services: Services fetched successfully'); // Debug log

    // Return the services as a JSON response with a 200 status code.
    return NextResponse.json(services, { status: 200 });
  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error fetching services:', error); // Debug log
    // Return an Internal Server Error response.
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
