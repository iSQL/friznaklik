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
} from 'lucide-react';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import { UserRole, AppointmentStatus } from '@prisma/client'; 

export default async function AdminDashboardPage() {
    const user: AuthenticatedUser | null = await getCurrentUser();

    if (!user || (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.VENDOR_OWNER)) {
        return <p className="p-4 text-center text-error">Pristup administratorskoj tabli nije dozvoljen.</p>;
    }

    let pendingAppointmentCount: number;
    let totalServiceCount: number;
    let activeVendorCount: number | null = null;
    let totalSessionCount: number | null = null;
    let totalUserCount: number | null = null;

    const whereClauseAppointments: any = { status: AppointmentStatus.PENDING };
    const whereClauseServices: any = {};

    if (user.role === UserRole.VENDOR_OWNER) {
        if (!user.ownedVendorId) {
            return (
                <div className="container mx-auto px-4 py-8 text-center">
                    <h1 className="text-2xl font-bold text-warning mb-4">Niste Povezani sa Salonom</h1>
                    <p>Da biste videli statistike, morate biti vlasnik salona. Molimo kontaktirajte administratora.</p>
                </div>
            );
        }
        whereClauseAppointments.vendorId = user.ownedVendorId;
        whereClauseServices.vendorId = user.ownedVendorId;
    } else if (user.role === UserRole.SUPER_ADMIN) {
        totalSessionCount = await prisma.chatSession.count();
        totalUserCount = await prisma.user.count();
        activeVendorCount = await prisma.vendor.count({ where: { status: 'ACTIVE' }});
    }

    [pendingAppointmentCount, totalServiceCount] = await Promise.all([
        prisma.appointment.count({ where: whereClauseAppointments }),
        prisma.service.count({ where: whereClauseServices }),
    ]);

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
        },
        {
            href: '/admin/services',
            title: 'Upravljanje uslugama',
            description: 'Dodajte, izmenite ili uklonite usluge i njihove detalje.',
            icon: Settings,
            accentColor: 'border-secondary',
        },
        {
            href: '/admin/chat',
            title: 'Upravljanje četom',
            description: 'Pregledajte istoriju korisničkih četova i odgovarajte kao administrator.',
            icon: MessageSquare,
            accentColor: 'border-accent',
        },
        
        ...(user.role === UserRole.SUPER_ADMIN ? [{
            href: '/admin/vendors',
            title: 'Upravljanje Salonima',
            description: 'Kreirajte, pregledajte i upravljajte svim salonima na platformi.',
            icon: Store,
            accentColor: 'border-info',
            disabled: true, 
        }] : [])
    ];

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-8">
                <LayoutDashboard className="h-10 w-10 mr-3 text-primary" strokeWidth={1.5} />
                <h1 className="text-3xl font-bold text-base-content">
                    Administratorska tabla {user.role === UserRole.VENDOR_OWNER ? ` (Salon ID: ${user.ownedVendorId})` : ''}
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
                        panel.disabled ? (
                            <div key={panel.href} className="card bg-base-100 shadow-lg opacity-50 cursor-not-allowed">
                                 <div className={`card-body items-center text-center sm:items-start sm:text-left border-l-4 ${panel.accentColor} rounded-r-md`}>
                                    <panel.icon className="h-10 w-10 mb-3 text-base-content opacity-80" strokeWidth={1.5} />
                                    <h3 className="card-title text-xl font-semibold text-base-content mb-1">
                                        {panel.title}
                                    </h3>
                                    <p className="text-base-content/70 text-sm">{panel.description}</p>
                                    <p className="text-xs text-warning mt-2">(Uskoro dostupno)</p>
                                </div>
                            </div>
                        ) : (
                        <Link href={panel.href} key={panel.href} className="card bg-base-100 shadow-lg hover:shadow-xl hover:scale-[1.02] transform transition-all duration-200 ease-in-out group">
                            <div className={`card-body items-center text-center sm:items-start sm:text-left border-l-4 ${panel.accentColor} rounded-r-md`}>
                                <panel.icon className="h-10 w-10 mb-3 text-base-content opacity-80 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                                <h3 className="card-title text-xl font-semibold text-base-content mb-1 group-hover:text-primary transition-colors">
                                    {panel.title}
                                </h3>
                                <p className="text-base-content/70 text-sm">{panel.description}</p>
                            </div>
                        </Link>
                        )
                    ))}
                </div>
            </section>
        </div>
    );
}
