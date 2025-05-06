// src/components/Header.tsx (or your actual path)
'use client'; // This directive makes this a Client Component

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import BookItTrimLogo from '@/components/BookItTrimLogo'; // Adjust path if your logo component is elsewhere

export default function Header() {
  const { userId, isLoaded } = useAuth(); // Use useAuth hook to get userId and loading state

  // isLoaded indicates if the auth state has finished loading
  if (!isLoaded) {
    // You might want to return a placeholder or a simplified header during loading
    // to prevent layout shifts, or null if that's preferred.
    return (
      <header className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="h-8 w-32 bg-gray-700 rounded animate-pulse"></div> {/* Logo Placeholder */}
          <nav>
            <ul className="flex space-x-4">
              <li className="h-5 w-16 bg-gray-700 rounded animate-pulse"></li>
              <li className="h-5 w-12 bg-gray-700 rounded animate-pulse"></li>
              <li className="h-5 w-10 bg-gray-700 rounded animate-pulse"></li>
            </ul>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-gray-800 text-white p-4 shadow-md"> {/* Added shadow for a bit of depth */}
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2 group"> {/* Added group for potential hover effects on logo + text */}
          <BookItTrimLogo size={64} /> {/* Using the logo component, adjust size as needed */}
          <span className="text-xl font-bold group-hover:text-gray-300 transition-colors"> {/* App name next to logo */}
            FrizNaKlik
          </span>
        </Link>
        <nav>
          <ul className="flex space-x-4 items-center"> {/* Added items-center for vertical alignment with UserButton */}
            <li><Link href="/services" className="hover:text-gray-300 transition-colors">Services</Link></li>
            <li><Link href="/book" className="hover:text-gray-300 transition-colors">Book</Link></li>
            <li><Link href="/chat" className="hover:text-gray-300 transition-colors">Chat</Link></li>

            {userId ? (
              // If user is signed in
              <>
                <li><Link href="/dashboard" className="hover:text-gray-300 transition-colors">Dashboard</Link></li>
                {/* TODO: Implement actual admin role check before showing Admin link */}
                {/* For now, show Admin link if logged in */}
                <li><Link href="/admin" className="hover:text-gray-300 transition-colors">Admin</Link></li>
                <li><UserButton/></li> {/* Added afterSignOutUrl for better UX */}
              </>
            ) : (
              // If user is signed out
              <>
                <li><Link href="/sign-in" className="hover:text-gray-300 transition-colors">Sign In</Link></li>
                <li><Link href="/sign-up" className="btn btn-primary btn-sm">Sign Up</Link></li> {/* Styled Sign Up as a button */}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
