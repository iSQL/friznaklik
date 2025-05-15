import { auth } from '@clerk/nextjs/server'; 
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; 
import { isAdminUser } from '@/lib/authUtils'; 

//const DEFAULT_VENDOR_ID = "cmao5ay1d0001hm2kji2qrltf"
function getServiceIdFromUrl(requestUrl: string): string | undefined {
  try {
     const url = new URL(requestUrl);
     return url.pathname.split('/').pop();
 } catch (urlError) {
     console.error('Error parsing request URL:', urlError);
     return undefined;
 }
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const serviceId = getServiceIdFromUrl(request.url);
  if (!serviceId) {
      return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
  }
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

   const ownedVendor = await prisma.vendor.findUnique({
    where: { ownerId: userId },
    select: { id: true }
  });
  if (!ownedVendor) {
    console.error(`Admin user ${userId} does not own a vendor.`);
    return new NextResponse('Forbidden: Admin not associated with a default vendor.', { status: 403 });
  }
  const DEFAULT_VENDOR_ID = ownedVendor.id;


  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return new NextResponse('Service not found', { status: 404 });
    }

    if (service.vendorId !== DEFAULT_VENDOR_ID) {
      console.warn(`Admin ${userId} attempting to access service ${serviceId} not belonging to their vendor ${DEFAULT_VENDOR_ID}.`);
      return new NextResponse('Service not found for this vendor', { status: 404 });
    }

    return NextResponse.json(service, { status: 200 });
  } catch (error) {
    console.error(`Error fetching service with ID ${serviceId}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const serviceId = getServiceIdFromUrl(request.url);
   if (!serviceId) {
      return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
  }
  const isAdmin = await isAdminUser(userId);
  if (!isAdmin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

   const ownedVendor = await prisma.vendor.findUnique({
    where: { ownerId: userId },
    select: { id: true }
  });
  if (!ownedVendor) {
    console.error(`Admin user ${userId} does not own a vendor.`);
    return new NextResponse('Forbidden: Admin not associated with a default vendor.', { status: 403 });
  }
  const DEFAULT_VENDOR_ID = ownedVendor.id;

  try {
    const existingService = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!existingService || existingService.vendorId !== DEFAULT_VENDOR_ID) {
      return new NextResponse('Service not found for this vendor', { status: 404 });
    }

    const body = await request.json();
    const {name, description, duration, price } = body;

     if (!name || typeof duration !== 'number' || typeof price !== 'number') {
        console.log(`PUT /api/admin/services/${serviceId}: Invalid request body`);
        return new NextResponse('Invalid request body', { status: 400 });
    }

    const updatedService = await prisma.service.update({
      where: { id: serviceId },
      data: {
        // vendorId: DEFAULT_VENDOR_ID,
        name,
        description,
        duration,
        price,
      },
    });

  return NextResponse.json(updatedService, { status: 200 });
  } catch (error) {
    console.error(`Error updating service with ID ${serviceId}:`, error);
     if (error instanceof Error && error.message.includes('Record to update not found')) {
         return new NextResponse('Service not found', { status: 404 });
     }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: Request) {
    const { userId } = await auth();
    if (!userId) {
       return new NextResponse('Unauthorized', { status: 401 });
    }
    const serviceId = getServiceIdFromUrl(request.url);
    if (!serviceId) {
         return new NextResponse('Bad Request: Invalid Service ID in URL', { status: 400 });
    }
    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) {
       return new NextResponse('Forbidden', { status: 403 });
    }
    const ownedVendor = await prisma.vendor.findUnique({
      where: { ownerId: userId },
      select: { id: true }
    });

    if (!ownedVendor) {
      console.error(`Admin user ${userId} does not own a vendor for DELETE operation.`);
      return new NextResponse('Forbidden: Admin not associated with a default vendor.', { status: 403 });
    }
    const DEFAULT_VENDOR_ID = ownedVendor.id;

    try {
      const serviceToDelete = await prisma.service.findUnique({
        where: { id: serviceId }
      });

      if (!serviceToDelete || serviceToDelete.vendorId !== DEFAULT_VENDOR_ID) {
        return new NextResponse('Service not found for this vendor', { status: 404 });
      }
       const relatedAppointmentsCount = await prisma.appointment.count({
           where: { serviceId: serviceId },
       });
       if (relatedAppointmentsCount > 0) {
           return new NextResponse('Cannot delete service: Related appointments exist. Please delete appointments first.', { status: 409 });
       }

       const deletedService = await prisma.service.delete({
         where: {
           id: serviceId,
         },
       });
       return NextResponse.json(deletedService, { status: 200 });

    } catch (error) {
       console.error(`Error deleting service with ID ${serviceId}:`, error);
       if (error instanceof Error && error.message.includes('Record to delete not found')) {
         return new NextResponse('Service not found or not deletable for this vendor', { status: 404 });
        }
       return new NextResponse('Internal Server Error', { status: 500 });
    }
}
