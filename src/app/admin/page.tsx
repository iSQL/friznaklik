// src/app/admin/page.tsx

import Link from 'next/link';
import prisma from '@/lib/prisma'; // Import Prisma client
import {
    Users, // Icon for Total Users (example)
    ClipboardList, // Icon for Total Services
    CalendarClock, // Icon for Pending Appointments
    MessageSquare, // Icon for Chat Sessions
    LayoutDashboard, // Icon for main dashboard link (optional)
    Settings, // Icon for Services link
    CalendarCheck, // Icon for Appointments link
} from 'lucide-react'; // Using lucide-react for icons

// This is a Server Component - fetches data directly
export default async function AdminDashboardPage() {

    // Fetch statistics directly using Prisma aggregates
    // Use Promise.all for parallel fetching
    const [pendingAppointmentCount, totalServiceCount, totalSessionCount, totalUserCount] = await Promise.all([
        prisma.appointment.count({
            where: { status: 'pending' },
        }),
        prisma.service.count(),
        prisma.chatSession.count(), // Count total chat sessions
        prisma.user.count(), // Count total users in your DB
    ]);

    const stats = {
        pendingAppointments: pendingAppointmentCount,
        totalServices: totalServiceCount,
        activeChats: totalSessionCount, // Renamed for clarity, represents total sessions
        totalUsers: totalUserCount,
    };

    // Data for the management panels
    const managementPanels = [
        {
            href: '/admin/appointments',
            title: 'Manage Appointments',
            description: 'View, approve, reject, or reschedule appointments.',
            icon: CalendarCheck,
            bgColor: 'bg-blue-100 dark:bg-blue-900',
            hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-800',
            textColor: 'text-blue-800 dark:text-blue-200',
            descriptionColor: 'text-blue-700 dark:text-blue-300',
            iconColor: 'text-blue-700 dark:text-blue-300',
        },
        {
            href: '/admin/services',
            title: 'Manage Services',
            description: 'Add, edit, or remove haircut services and details.',
            icon: Settings, // Changed icon
            bgColor: 'bg-purple-100 dark:bg-purple-900',
            hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-800',
            textColor: 'text-purple-800 dark:text-purple-200',
            descriptionColor: 'text-purple-700 dark:text-purple-300',
            iconColor: 'text-purple-700 dark:text-purple-300',
        },
        {
            href: '/admin/chat',
            title: 'Manage Chats',
            description: 'View user chat history and respond as admin.',
            icon: MessageSquare,
            bgColor: 'bg-green-100 dark:bg-green-900',
            hoverColor: 'hover:bg-green-200 dark:hover:bg-green-800',
            textColor: 'text-green-800 dark:text-green-200',
            descriptionColor: 'text-green-700 dark:text-green-300',
            iconColor: 'text-green-700 dark:text-green-300',
        },
         // Add more panels here if needed in the future
    ];

    return (
        <div className="container mx-auto px-4 py-8"> {/* Removed redundant px-4 py-8 as layout provides padding */}
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Admin Dashboard</h1>

            {/* Statistics Section */}
            <section className="mb-10">
                <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Pending Appointments Stat Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow duration-200">
                         <CalendarClock className="h-10 w-10 text-yellow-500" strokeWidth={1.5} />
                         <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Appointments</h3>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingAppointments}</p>
                        </div>
                    </div>

                     {/* Total Services Stat Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow duration-200">
                         <ClipboardList className="h-10 w-10 text-purple-500" strokeWidth={1.5} />
                         <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Services</h3>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalServices}</p>
                        </div>
                    </div>

                     {/* Total Chats Stat Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow duration-200">
                         <MessageSquare className="h-10 w-10 text-green-500" strokeWidth={1.5} />
                         <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Chat Sessions</h3>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeChats}</p>
                        </div>
                    </div>

                     {/* Total Users Stat Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow duration-200">
                         <Users className="h-10 w-10 text-blue-500" strokeWidth={1.5} />
                         <div>
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Management Panels Section */}
            <section>
                 <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Management Tools</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managementPanels.map((panel) => (
                        <Link href={panel.href} key={panel.href}>
                            <div className={`block p-6 ${panel.bgColor} rounded-lg shadow-md ${panel.hoverColor} transition-colors duration-150 cursor-pointer group`}>
                                <panel.icon className={`h-8 w-8 mb-3 ${panel.iconColor}`} strokeWidth={1.5} />
                                <h3 className={`text-xl font-semibold ${panel.textColor} mb-2 group-hover:underline`}>{panel.title}</h3>
                                <p className={`${panel.descriptionColor}`}>{panel.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}
