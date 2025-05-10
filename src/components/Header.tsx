'use client';

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import BookItTrimLogo from '@/components/BookItTrimLogo';
import { MenuIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function Header() {
  const { userId, isLoaded } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null); 

  const navLinks = [
    { href: "/services", label: "Services" },
    { href: "/book", label: "Book" },
    { href: "/chat", label: "Chat" },
  ];

  const userNavLinks = userId ? [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/admin", label: "Admin" },
  ] : [];

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  if (!isLoaded) {
    return (
      <div className="navbar bg-base-200 text-base-content shadow-lg sticky top-0 z-50">
        <div className="navbar-start">
          <div className="h-8 w-8 bg-base-300 rounded animate-pulse"></div>
          <div className="h-6 w-24 bg-base-300 rounded animate-pulse ml-2"></div>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 space-x-2">
            <li className="h-8 w-20 bg-base-300 rounded animate-pulse"></li>
            <li className="h-8 w-20 bg-base-300 rounded animate-pulse"></li>
            <li className="h-8 w-20 bg-base-300 rounded animate-pulse"></li>
          </ul>
        </div>
        <div className="navbar-end">
          <div className="h-8 w-24 bg-base-300 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="navbar bg-base-200 text-base-content shadow-lg sticky top-0 z-50">
      <div className="navbar-start">
        <div
          ref={dropdownContainerRef}
          className={`dropdown ${isMobileMenuOpen ? 'dropdown-open' : ''}`}
        >
          <button
            tabIndex={0}
            aria-label="Open menu"
            role="button"
            className="btn btn-ghost lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-expanded={isMobileMenuOpen}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[51] p-2 shadow bg-base-200 text-base-content rounded-box w-52"
          >
            {navLinks.map((link) => (
              <li key={link.href}><Link href={link.href} onClick={closeMobileMenu}>{link.label}</Link></li>
            ))}
            {userId && userNavLinks.map((link) => (
              <li key={link.href}><Link href={link.href} onClick={closeMobileMenu}>{link.label}</Link></li>
            ))}
            <div className="divider my-1 px-2"></div>
            {!userId ? (
              <>
                <li><Link href="/sign-in" onClick={closeMobileMenu} className="justify-between">Sign In</Link></li>
                <li className="mt-1"><Link href="/sign-up" onClick={closeMobileMenu} className="btn btn-primary btn-sm w-full">Sign Up</Link></li>
              </>
            ) : (
              <li>
                <div className="flex justify-center py-2">
                   <UserButton afterSignOutUrl="/" />
                </div>
              </li>
            )}
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-xl px-2">
          <BookItTrimLogo size={32} />
          <span className="ml-1 font-bold hidden sm:inline">FrizNaKlik</span>
        </Link>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          {navLinks.map((link) => (
            <li key={link.href}><Link href={link.href} className="btn btn-ghost">{link.label}</Link></li>
          ))}
        </ul>
      </div>
      <div className="navbar-end">
        {userId ? (
          <>
            <ul className="menu menu-horizontal px-1 hidden lg:flex">
              {userNavLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="btn btn-ghost">{link.label}</Link></li>
              ))}
            </ul>
            <div className="ml-2 hidden lg:flex">
              <UserButton afterSignOutUrl="/" />
            </div>
          </>
        ) : (
          <div className="hidden lg:flex items-center space-x-2">
            <Link href="/sign-in" className="btn btn-ghost">Sign In</Link>
            <Link href="/sign-up" className="btn btn-primary">Sign Up</Link>
          </div>
        )}
      </div>
    </div>
  );
}
