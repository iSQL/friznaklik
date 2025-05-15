
import { auth } from '@clerk/nextjs/server'; 
import { NextResponse } from 'next/server'; 
import prisma from '@/lib/prisma'; 
import { isAdminUser } from '@/lib/authUtils';

const DEFAULT_VENDOR_ID = "cmao5ay1d0001hm2kji2qrltf"

export async function GET() {
  const { userId } = await auth(); 
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const services = await prisma.service.findMany({
      where: {
        vendorId: DEFAULT_VENDOR_ID
      },
    });
    return NextResponse.json(services, { status: 200 });
  } catch (error) {
    console.error('Error fetching services:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth(); 
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, duration, price } = body;

    // ToDo: create more robust validation
    if (!name || typeof duration !== 'number' || typeof price !== 'number') {
      return new NextResponse('Invalid request body', { status: 400 });
    }

    const newService = await prisma.service.create({
      data: {
        vendorId: DEFAULT_VENDOR_ID,
        name,
        description,
        duration,
        price,
      },
    });

    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
