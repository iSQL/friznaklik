import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

// This is a Server Component Layout, meaning it runs on the server.
// It's ideal for fetching data (like user roles) and protecting routes.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the authentication status and user ID from Clerk
  const { userId } = await auth();

  // If the user is not signed in, redirect them to the sign-in page.
  // This is an extra layer of protection, although middleware should handle most cases.
  if (!userId) {
    // In .NET MVC/Razor Pages, this is similar to an [Authorize] attribute
    // redirecting to a login page if the user is not authenticated.
    redirect('/sign-in');
  }

  // Fetch the full user object to check their role.
  // currentUser() is a helper from Clerk for Server Components.
  const user = await currentUser();

  // TODO: Implement actual admin role check.
  // For now, we'll assume the user is an admin if they are authenticated.
  // In a real application, you would store a 'role' field in your database
  // and check if user.role === 'admin'. We'll integrate this with Prisma later.
  const isAdmin = true; // Placeholder: Assume authenticated user is admin for now.
  // A more realistic check would involve fetching the user from your database:
  /*
  import prisma from '@/lib/prisma'; // Need to create this utility later
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId }, // Assuming you store Clerk's userId in your User model
  });
  const isAdmin = dbUser?.role === 'admin';
  */


  // If the user is not an admin, redirect them or show an unauthorized message.
  if (!isAdmin) {
    // Similar to returning an UnauthorizedResult or ForbidResult in .NET MVC.
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
          <p className="text-gray-700 mb-4">You do not have permission to view this page.</p>
          <Link href="/" className="text-blue-500 hover:underline">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // If the user is authenticated and is an admin, render the admin layout.
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Admin Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 text-white p-6 space-y-6">
        <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
        <nav>
          <ul className="space-y-2">
            <li>
              {/* Link to the Services management page */}
              <Link href="/admin/services" className="block py-2 px-4 rounded hover:bg-gray-700">
                Services
              </Link>
            </li>
            {/* TODO: Add links for Appointments, Chat Management, etc. */}
            {/*
            <li>
              <Link href="/admin/appointments" className="block py-2 px-4 rounded hover:bg-gray-700">
                Appointments
              </Link>
            </li>
            <li>
              <Link href="/admin/chat" className="block py-2 px-4 rounded hover:bg-gray-700">
                Chat Management
              </Link>
            </li>
            */}
          </ul>
        </nav>
      </aside>

      {/* Main content area - renders the nested admin pages (children) */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
