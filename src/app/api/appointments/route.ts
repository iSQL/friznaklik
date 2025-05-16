import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { 
    ensureAuthenticated, 
    getCurrentUser,      
    withRoleProtection, 
    AuthenticatedUser 
} from '@/lib/authUtils';
import { UserRole, AppointmentStatus } from '@prisma/client';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const createAppointmentSchema = z.object({
  serviceId: z.string().cuid('Invalid service ID'),
  vendorId: z.string().cuid('Invalid vendor ID'), 
  workerId: z.string().cuid('Invalid worker ID').optional(), 
  startTime: z.string().datetime('Invalid start time format'),
  notes: z.string().optional(),
});


// GET handler for fetching appointments (for Admin Panel)
// SUPER_ADMIN sees all appointments.
// VENDOR_OWNER sees appointments for their vendor only.
async function GET_handler(req: NextRequest) {
  try {
    const user: AuthenticatedUser | null = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const queryParams = req.nextUrl.searchParams;
    const statusFilter = queryParams.get('status') as AppointmentStatus | null;
    const page = parseInt(queryParams.get('page') || '1', 10);
    const limit = parseInt(queryParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const whereClause: Prisma.AppointmentWhereInput = {}; 

    if (statusFilter) {
        whereClause.status = statusFilter;
    }

    if (user.role === UserRole.SUPER_ADMIN) {
    } else if (user.role === UserRole.VENDOR_OWNER) {
      if (!user.ownedVendorId) {
        return NextResponse.json({ message: 'Vendor owner does not have an associated vendor.' }, { status: 403 });
      }
      whereClause.vendorId = user.ownedVendorId; 
    } else {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    
    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        user: { // User who booked
          select: { firstName: true, lastName: true, email: true },
        },
        service: { // Service booked
          select: { name: true, duration: true },
        },
        vendor: { // Vendor for the appointment
            select: { name: true, id: true }
        },
        worker: { // Worker assigned (if any)
            select: { name: true }
        }
      },
      orderBy: {
        startTime: 'desc', 
      },
      skip: skip,
      take: limit,
    });

    const totalAppointments = await prisma.appointment.count({ where: whereClause });

    return NextResponse.json({
        appointments,
        totalPages: Math.ceil(totalAppointments / limit),
        currentPage: page,
        totalAppointments
    });

  } catch (error) {
    console.error('Error fetching appointments (admin):', error);
    return NextResponse.json({ message: 'Internal server error while fetching appointments' }, { status: 500 });
  }
}

async function POST_handler(req: NextRequest) {
  try {
    const bookingUser = await ensureAuthenticated(); 

    const body = await req.json();
    const parseResult = createAppointmentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ message: 'Invalid input', errors: parseResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { serviceId, vendorId, workerId, startTime, notes } = parseResult.data;
    const parsedStartTime = new Date(startTime);

    const service = await prisma.service.findUnique({
      where: { id: serviceId, vendorId: vendorId }, 
    });

    if (!service) {
      return NextResponse.json({ message: 'Service not found or does not belong to the specified vendor.' }, { status: 404 });
    }
    
    // TODO: Add more validation logic here:
    // 1. Check if the time slot is available (no overlapping appointments for the vendor/worker).
    // 2. Check against vendor operating hours and worker working hours (if applicable in later phases).
    // 3. Ensure the selected worker (if any) can perform the selected service.

    const endTime = new Date(parsedStartTime.getTime() + service.duration * 60000); 

    const newAppointment = await prisma.appointment.create({
      data: {
        userId: bookingUser.id, 
        serviceId,
        vendorId,
        workerId: workerId || null, 
        startTime: parsedStartTime,
        endTime,
        status: AppointmentStatus.PENDING, 
        notes,
      },
    });

    return NextResponse.json(newAppointment, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating appointment:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ message: 'Internal server error while creating appointment' }, { status: 500 });
  }
}

export const GET = withRoleProtection(GET_handler, [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER]);
export const POST = POST_handler;
