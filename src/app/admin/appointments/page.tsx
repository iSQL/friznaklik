import AppointmentList from '@/components/admin/appointments/AppointmentList';
import { Appointment, Service, User as PrismaUser } from '@prisma/client'; 
import prisma from '@/lib/prisma';
import { parseISO } from 'date-fns';
import { formatErrorMessage } from '@/lib/errorUtils';
import { ServerCrash, CalendarX2 } from 'lucide-react';
import { auth } from '@clerk/nextjs/server'; 
import { isAdminUser } from '@/lib/authUtils'; // For checking admin role (optional here if layout handles it)
import { redirect } from 'next/navigation';


export type AppointmentWithDetails = Appointment & {
  service: Service;
  user: PrismaUser; // Use PrismaUser type
  startTime: Date;
  endTime: Date;
};

export const dynamic = 'force-dynamic';

export default async function AdminAppointmentsPage() {
  const { userId: clerkUserId } = await auth(); 

  if (!clerkUserId) {
    redirect('/sign-in'); 
  }

  const isUserAdmin = await isAdminUser(clerkUserId);
  if (!isUserAdmin) {
   redirect('/not-authorized');
 }

  let pendingAppointments: AppointmentWithDetails[] = [];
  let error: string | null = null;
  let defaultVendorId: string | null = null;

  try {
    const ownedVendor = await prisma.vendor.findUnique({
      where: { ownerId: clerkUserId }, // Assuming clerkUserId is the same as User.id in Vendor's owner relation
                                      // If not, you need to fetch User by clerkId first, then Vendor by User.id
      select: { id: true }
    });

    if (!ownedVendor) {
      console.warn(`Admin user with Clerk ID ${clerkUserId} does not own a vendor. Displaying no appointments.`);

    } else {
      defaultVendorId = ownedVendor.id;
      console.log(`Admin user ${clerkUserId} is owner of vendor ${defaultVendorId}. Fetching pending appointments.`);

      const rawAppointments = await prisma.appointment.findMany({
        where: {
          status: 'pending',
          vendorId: defaultVendorId, 
        },
        include: {
          service: true,
          user: true, // This refers to the PrismaUser model
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      pendingAppointments = rawAppointments.map(app => ({
        ...app,
        startTime: app.startTime instanceof Date ? app.startTime : parseISO(app.startTime as unknown as string),
        endTime: app.endTime instanceof Date ? app.endTime : parseISO(app.endTime as unknown as string),
      }));
    }
  } catch (fetchError: unknown) {
    error = formatErrorMessage(fetchError, "učitavanja termina na čekanju");
    console.error(error); 
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="pb-4 border-b border-base-300">
        <h1 className="text-3xl font-bold text-base-content">Upravljanje terminima na čekanju</h1>
        <p className="text-base-content opacity-70 mt-1">
          Pregledajte, ažurirajte trajanje, odobrite ili odbijte termine klijenata na čekanju za Vaš salon.
        </p>
      </div>

      {error && (
        <div role="alert" className="alert alert-error shadow-lg">
          <ServerCrash className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Greška pri učitavanju termina!</h3>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}

      {!error && pendingAppointments.length === 0 && (
        <div className="text-center py-10 bg-base-200 rounded-box mt-6">
            <CalendarX2 className="h-12 w-12 mx-auto text-base-content opacity-50 mb-4" />
            <p className="text-xl font-semibold text-base-content">
              {defaultVendorId ? "Nema termina na čekanju za Vaš salon." : "Niste povezani ni sa jednim salonom kao vlasnik."}
            </p>
            <p className="text-base-content opacity-70">
              {defaultVendorId ? "Trenutno nema termina koji čekaju na pregled." : "Molimo kontaktirajte administratora platforme."}
            </p>
        </div>
      )}

      {!error && pendingAppointments.length > 0 && (
        <AppointmentList appointments={pendingAppointments} />
      )}
    </div>
  );
}