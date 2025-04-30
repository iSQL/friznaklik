'use client'; // This directive makes this a Client Component

import { UserButton, useAuth } from "@clerk/nextjs"; // Use useAuth hook
import Link from "next/link";

export default function Header() {
  const { userId, isLoaded } = useAuth(); // Use useAuth hook to get userId and loading state

  // isLoaded indicates if the auth state has finished loading
  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <header className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          Haircut App
        </Link>
        <nav>
          <ul className="flex space-x-4">
            <li><Link href="/services" className="hover:underline">Services</Link></li>
            {userId ? (
              // If user is signed in
              <>
                <li><Link href="/dashboard" className="hover:underline">Dashboard</Link></li>
                <li><UserButton /></li> {/* Clerk's user button */}
              </>
            ) : (
              // If user is signed out
              <>
                <li><Link href="/sign-in" className="hover:underline">Sign In</Link></li>
                <li><Link href="/sign-up" className="hover:underline">Sign Up</Link></li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
