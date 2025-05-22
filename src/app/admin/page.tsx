import Link from 'next/link';
import prisma from '@/lib/prisma';
import {
    Users,
    ClipboardList,
    CalendarClock,
    MessageSquare,
    Settings2 as Settings,
    CalendarCheck,
    LayoutDashboard,
    Store, 
    Edit2, 
} from 'lucide-react';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import { UserRole, AppointmentStatus, VendorStatus } from '@/lib/types/prisma-enums'; 
import type { Metadata } from 'next';
import { Prisma } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Admin Panel - FrizNaKlik',
  description: 'Administratorska tabla za upravljanje FrizNaKlik platformom.',
};

export default async function AdminDashboardPage() {
    const user: AuthenticatedUser | null = await getCurrentUser();

    if (!user || (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.VENDOR_OWNER)) {
        return (
             <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold text-error mb-4">Pristup Odbijen</h1>
                <p>Nemate dozvolu za pristup administratorskoj tabli.</p>
                <Link href="/" className="btn btn-primary mt-4">Nazad na Početnu</Link>
            </div>
        );
    }

    let pendingAppointmentCount: number = 0;
    let totalServiceCount: number = 0;
    let activeVendorCount: number | null = null;
    let totalSessionCount: number | null = null;
    let totalUserCount: number | null = null;

    const whereClauseAppointments: Prisma.AppointmentWhereInput = { status: AppointmentStatus.PENDING };
    const whereClauseServices: Prisma.ServiceWhereInput = {};

    if (user.role === UserRole.VENDOR_OWNER) {
        if (!user.ownedVendorId) {
            return (
                <div className="container mx-auto px-4 py-8 text-center">
                    <h1 className="text-2xl font-bold text-warning mb-4">Niste Povezani sa Salonom</h1>
                    <p>Da biste videli statistike i upravljali salonom, morate biti vlasnik salona. Molimo kontaktirajte administratora.</p>
                     <Link href="/" className="btn btn-primary mt-4">Nazad na Početnu</Link>
                </div>
            );
        }
        whereClauseAppointments.vendorId = user.ownedVendorId;
        whereClauseServices.vendorId = user.ownedVendorId;
    } else if (user.role === UserRole.SUPER_ADMIN) {
        totalSessionCount = await prisma.chatSession.count();
        totalUserCount = await prisma.user.count();
        activeVendorCount = await prisma.vendor.count({ where: { status: VendorStatus.ACTIVE }});
    }

    try {
        [pendingAppointmentCount, totalServiceCount] = await Promise.all([
            prisma.appointment.count({ where: whereClauseAppointments }),
            prisma.service.count({ where: whereClauseServices }),
        ]);
    } catch (dbError) {
        console.error("Greška pri preuzimanju statistika:", dbError);
    }


    const overviewStats = [];
    overviewStats.push({ 
        title: user.role === UserRole.VENDOR_OWNER ? 'Termini na čekanju (Vaš salon)' : 'Termini na čekanju (Ukupno)', 
        value: pendingAppointmentCount, 
        icon: CalendarClock, 
        iconColor: 'text-warning' 
    });
    overviewStats.push({ 
        title: user.role === UserRole.VENDOR_OWNER ? 'Usluge (Vaš salon)' : 'Ukupno usluga', 
        value: totalServiceCount, 
        icon: ClipboardList, 
        iconColor: 'text-info' 
    });

    if (user.role === UserRole.SUPER_ADMIN) {
        if (activeVendorCount !== null) {
            overviewStats.push({ title: 'Aktivni saloni', value: activeVendorCount, icon: Store, iconColor: 'text-secondary' });
        }
        if (totalSessionCount !== null) {
            overviewStats.push({ title: 'Ukupno čet sesija', value: totalSessionCount, icon: MessageSquare, iconColor: 'text-success' });
        }
        if (totalUserCount !== null) {
            overviewStats.push({ title: 'Ukupno korisnika', value: totalUserCount, icon: Users, iconColor: 'text-primary' });
        }
    }

    const managementPanels = [
        {
            href: '/admin/appointments',
            title: 'Upravljanje terminima',
            description: 'Pregledajte, odobrite, odbijte ili promenite termine.',
            icon: CalendarCheck,
            accentColor: 'border-primary',
            roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER],
        },
        {
            href: '/admin/services',
            title: 'Upravljanje uslugama',
            description: 'Dodajte, izmenite ili uklonite usluge i njihove detalje.',
            icon: Settings,
            accentColor: 'border-secondary',
            roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER],
        },
        ...(user.role === UserRole.VENDOR_OWNER && user.ownedVendorId ? [{
            href: `/admin/vendors/edit/${user.ownedVendorId}`, 
            title: 'Informacije o Salonu',
            description: 'Izmenite naziv, opis, adresu i radno vreme Vašeg salona.',
            icon: Edit2, 
            accentColor: 'border-success',
            roles: [UserRole.VENDOR_OWNER],
        }] : []),
        {
            href: '/admin/workers', 
            title: 'Upravljanje Radnicima',
            description: 'Dodajte, izmenite ili uklonite radnike Vašeg salona.',
            icon: Users, 
            accentColor: 'border-info',
            roles: [UserRole.VENDOR_OWNER],
        },
        {
            href: '/admin/chat',
            title: 'Upravljanje četom',
            description: 'Pregledajte istoriju korisničkih četova i odgovarajte.',
            icon: MessageSquare,
            accentColor: 'border-accent',
            roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER],
        },
        // Panel za upravljanje svim salonima - samo za SUPER_ADMIN
        ...(user.role === UserRole.SUPER_ADMIN ? [{
            href: '/admin/vendors',
            title: 'Upravljanje Svim Salonima',
            description: 'Kreirajte, pregledajte i upravljajte svim salonima na platformi.',
            icon: Store,
            accentColor: 'border-warning', 
            roles: [UserRole.SUPER_ADMIN],
        }] : [])
    ].filter(panel => panel.roles.includes(user.role as UserRole)); // Filtriramo panele na osnovu uloge


    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-8">
                <LayoutDashboard className="h-10 w-10 mr-3 text-primary" strokeWidth={1.5} />
                <h1 className="text-3xl font-bold text-base-content">
                    Administratorska tabla 
                    {user.role === UserRole.VENDOR_OWNER && user.ownedVendorId && 
                        <span className="text-lg font-normal text-base-content/70"> (Salon ID: {user.ownedVendorId.substring(0,8)}...)</span>
                    }
                </h1>
            </div>

            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4 text-base-content">Pregled statistike</h2>
                {overviewStats.length > 0 ? (
                    <div className="stats stats-vertical lg:stats-horizontal shadow-lg w-full bg-base-100">
                        {overviewStats.map((statItem) => (
                            <div className="stat" key={statItem.title}>
                                <div className={`stat-figure ${statItem.iconColor}`}>
                                    <statItem.icon className="h-8 w-8" strokeWidth={1.5} />
                                </div>
                                <div className="stat-title text-base-content/70">{statItem.title}</div>
                                <div className="stat-value text-base-content">{statItem.value}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-base-content/70">Nema dostupnih statistika za vašu ulogu.</p>
                )}
            </section>

            <section>
                <h2 className="text-2xl font-semibold mb-6 text-base-content">Alati za upravljanje</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managementPanels.map((panel) => (
                        <Link href={panel.href} key={panel.href} className="card bg-base-100 shadow-lg hover:shadow-xl hover:scale-[1.02] transform transition-all duration-200 ease-in-out group">
                            <div className={`card-body items-center text-center sm:items-start sm:text-left border-l-4 ${panel.accentColor} rounded-r-md`}>
                                <panel.icon className="h-10 w-10 mb-3 text-base-content opacity-80 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                                <h3 className="card-title text-xl font-semibold text-base-content mb-1 group-hover:text-primary transition-colors">
                                    {panel.title}
                                </h3>
                                <p className="text-base-content/70 text-sm">{panel.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}