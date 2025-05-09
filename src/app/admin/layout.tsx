// src/app/admin/layout.tsx

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma'; // Import the Prisma client utility

// This is a Server Component Layout, meaning it runs on the server.
// It's ideal for fetching data (like user roles) and protecting routes.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the authentication status and user ID from Clerk
  // Added await based on previous correction
  const { userId } = await auth();

  // If the user is not signed in, redirect them to the sign-in page.
  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch the full user object to check their role.
  // Note: currentUser() is deprecated in latest Next.js/Clerk versions,
  // but keeping it if your version requires it.
  // Consider fetching role directly via prisma if currentUser() causes issues.
  // const user = await currentUser(); // Deprecated, use prisma fetch below

  // Use the imported prisma client utility to fetch the user's role
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId }, // Assuming you store Clerk's userId in your User model
    select: { role: true }, // Only fetch the role field
  });

  const isAdmin = dbUser?.role === 'admin';

  // If the user is not an admin, show an unauthorized message.
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">You do not have permission to view this page.</p>
          <Link href="/" className="text-blue-500 hover:underline">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // If the user is authenticated and is an admin, render the admin layout.
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Admin Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 text-white p-6 space-y-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center border-b border-gray-700 pb-3">Admin Panel</h2>
        <nav>
          <ul className="space-y-2">
             <li>
                 {/* Link to the Admin Dashboard home page */}
                 <Link href="/admin" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-150">
                   Dashboard
                 </Link>
             </li>
            <li>
              {/* Link to the Services management page */}
              <Link href="/admin/services" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-150">
                Services
              </Link>
            </li>
            <li> {/* Link for Appointments */}
              <Link href="/admin/appointments" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-150">
                Appointments
              </Link>
            </li>
            {/* *** ADDED LINK FOR CHAT MANAGEMENT *** */}
            <li>
              <Link href="/admin/chat" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-150">
                Chat Management
              </Link>
            </li>
             {/* Add more admin links here as needed */}
          </ul>
        </nav>
      </aside>

      {/* Main content area - renders the nested admin pages (children) */}
      <main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
