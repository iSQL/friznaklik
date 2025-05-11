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
} from 'lucide-react';

export default async function AdminDashboardPage() {
    const [pendingAppointmentCount, totalServiceCount, totalSessionCount, totalUserCount] = await Promise.all([
        prisma.appointment.count({
            where: { status: 'pending' },
        }),
        prisma.service.count(),
        prisma.chatSession.count(),
        prisma.user.count(),
    ]);

    const overviewStats = [
        { title: 'Termini na čekanju', value: pendingAppointmentCount, icon: CalendarClock, iconColor: 'text-warning' },
        { title: 'Ukupno usluga', value: totalServiceCount, icon: ClipboardList, iconColor: 'text-info' },
        { title: 'Ukupno čet sesija', value: totalSessionCount, icon: MessageSquare, iconColor: 'text-success' },
        { title: 'Ukupno korisnika', value: totalUserCount, icon: Users, iconColor: 'text-primary' },
    ];

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
            description: 'Dodajte, izmenite ili uklonite frizerske usluge i detalje.',
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
    ];

    return (
        <div className="container mx-auto px-4 py-8"> 
            <div className="flex items-center mb-8"> 
                <LayoutDashboard className="h-10 w-10 mr-3 text-primary" strokeWidth={1.5} />
                <h1 className="text-3xl font-bold text-base-content">Administratorska tabla</h1>
            </div>

            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4 text-base-content">Pregled statistike</h2>
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