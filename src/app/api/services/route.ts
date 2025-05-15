import { NextResponse } from 'next/server'; 
import prisma from '@/lib/prisma'; 

export async function GET() {
  console.log('GET /api/services: Request received');

  try {
    const services = await prisma.service.findMany();
    console.log('GET /api/services: Services fetched successfully'); 
    return NextResponse.json(services, { status: 200 });
  } catch (error) {
    console.error('Error fetching services:', error); 
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
