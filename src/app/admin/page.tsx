import Link from 'next/link';
import prisma from '@/lib/prisma';
import {
    Users,
    ClipboardList,
    CalendarClock,
    MessageSquare,
    Settings2 as Settings, 
    CalendarCheck,
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
        { title: 'Pending Appointments', value: pendingAppointmentCount, icon: CalendarClock, iconColor: 'text-warning' },
        { title: 'Total Services', value: totalServiceCount, icon: ClipboardList, iconColor: 'text-info' },
        { title: 'Total Chat Sessions', value: totalSessionCount, icon: MessageSquare, iconColor: 'text-success' },
        { title: 'Total Users', value: totalUserCount, icon: Users, iconColor: 'text-primary' },
    ];

    const managementPanels = [
        {
            href: '/admin/appointments',
            title: 'Manage Appointments',
            description: 'View, approve, reject, or reschedule appointments.',
            icon: CalendarCheck,
            accentColor: 'border-primary',
        },
        {
            href: '/admin/services',
            title: 'Manage Services',
            description: 'Add, edit, or remove haircut services and details.',
            icon: Settings,
            accentColor: 'border-secondary',
        },
        {
            href: '/admin/chat',
            title: 'Manage Chats',
            description: 'View user chat history and respond as admin.',
            icon: MessageSquare,
            accentColor: 'border-accent',
        },
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-base-content">Admin Dashboard</h1>

            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4 text-base-content">Overview</h2>
                <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                    {overviewStats.map((statItem) => (
                        <div className="stat" key={statItem.title}>
                            <div className={`stat-figure ${statItem.iconColor}`}>
                                <statItem.icon className="h-8 w-8" strokeWidth={1.5} />
                            </div>
                            <div className="stat-title">{statItem.title}</div>
                            <div className="stat-value">{statItem.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section>
                 <h2 className="text-2xl font-semibold mb-4 text-base-content">Management Tools</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managementPanels.map((panel) => (
                        <Link href={panel.href} key={panel.href} className="card bg-base-200 shadow-lg hover:shadow-xl transition-shadow duration-200 ease-in-out group">
                            <div className={`card-body border-l-4 ${panel.accentColor}`}>
                                <panel.icon className="h-8 w-8 mb-3 text-base-content opacity-80 group-hover:opacity-100" strokeWidth={1.5} />
                                <h3 className="card-title text-xl font-semibold text-base-content mb-1 group-hover:text-primary transition-colors">
                                    {panel.title}
                                </h3>
                                <p className="text-base-content opacity-70 text-sm">{panel.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
