// src/components/Header.tsx
'use client';

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import Image from 'next/image';
import { Menu as MenuIcon, LogIn, UserPlus, LayoutDashboard, MessageCircle, CalendarPlus, ListOrdered, X, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
// ISPRAVKA IMPORTA: Uvozimo tip iz novog fajla sa tipovima
import type { AuthenticatedUser } from '@/lib/types/auth'; 

interface HeaderProps {
  user: AuthenticatedUser | null;
  isAdmin: boolean;
}

export default function Header({ user, isAdmin }: HeaderProps) {
  const { isLoaded, userId: clerkUserIdClient } = useAuth(); 
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  const isUserAdmin = isAdmin; 

  const navLinks = [
    { href: "/services", label: "Usluge", icon: ListOrdered },
    { href: "/book", label: "Zakaži", icon: CalendarPlus },
    { href: "/chat", label: "Čet", icon: MessageCircle },
  ];

  const userNavLinks = [];
  if (user) {
    userNavLinks.push({ href: "/dashboard", label: "Kontrolna tabla", icon: LayoutDashboard });
    if (isUserAdmin) { 
      userNavLinks.push({ href: "/admin", label: "Admin Panel", icon: ShieldCheck });
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuButtonRef.current && menuButtonRef.current.contains(event.target as Node)) {
        return;
      }
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
      <div className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
        <div className="navbar-start">
          <div className="btn btn-ghost px-2 flex items-center">
            <div className="h-8 w-32 bg-base-300 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 space-x-1">
            {[1, 2, 3].map(i => <li key={i} className="h-9 w-24 bg-base-300 rounded animate-pulse"></li>)}
          </ul>
        </div>
        <div className="navbar-end">
          <div className="h-9 w-28 bg-base-300 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <nav className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
      <div className="navbar-start">
        <div
          ref={dropdownContainerRef}
          className={`dropdown ${isMobileMenuOpen ? 'dropdown-open' : ''}`}
        >
          <button
            ref={menuButtonRef}
            tabIndex={0}
            aria-label={isMobileMenuOpen ? "Zatvori meni" : "Otvori meni"}
            role="button"
            className="btn btn-ghost lg:hidden"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <ul
            tabIndex={isMobileMenuOpen ? 0 : -1}
            className="menu menu-sm dropdown-content mt-3 z-[51] p-2 shadow-lg bg-base-100 text-base-content rounded-box w-64"
          >
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={closeMobileMenu} className={`flex items-center gap-2 p-2 rounded-md ${pathname === link.href ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}>
                  {link.icon && <link.icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              </li>
            ))}
            {userNavLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={closeMobileMenu} className={`flex items-center gap-2 p-2 rounded-md ${pathname.startsWith(link.href) && link.href !== '/' ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}>
                  {link.icon && <link.icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              </li>
            ))}
            <div className="divider my-2 px-2 text-xs">Korisnik</div>
            {!user ? (
              <>
                <li>
                  <Link href="/sign-in" onClick={closeMobileMenu} className="flex items-center gap-2 p-2 rounded-md hover:bg-base-300">
                    <LogIn className="h-4 w-4" /> Prijavi se
                  </Link>
                </li>
                <li className="mt-1">
                  <Link href="/sign-up" onClick={closeMobileMenu} className="btn btn-primary btn-sm w-full mt-1">
                    <UserPlus className="h-4 w-4 mr-1" /> Registruj se
                  </Link>
                </li>
              </>
            ) : (
              <li>
                <div className="flex justify-center items-center py-2 px-2 rounded-md hover:bg-base-300">
                  <UserButton
                    afterSignOutUrl="/"
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "w-8 h-8",
                        userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg",
                      }
                    }}
                  />
                  <span className="ml-2 text-sm font-medium">Profil</span>
                </div>
              </li>
            )}
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-xl px-1 sm:px-2 flex items-center" onClick={closeMobileMenu}>
          <Image src="/logo-wide.png" alt="FrizNaKlik Logo" width={125} height={50} priority style={{width: 'auto', height: '50px'}} />
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1 space-x-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={`btn btn-ghost font-medium ${pathname === link.href ? 'btn-active text-primary' : ''}`}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="navbar-end">
        {user ? (
          <>
            <ul className="menu menu-horizontal px-1 space-x-1 hidden lg:flex">
              {userNavLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={`btn btn-ghost font-medium ${pathname.startsWith(link.href) && link.href !== '/' ? 'btn-active text-primary' : ''}`}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="ml-2 pl-1 border-l border-base-300/70 hidden lg:flex">
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "w-9 h-9",
                    userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg",
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="hidden lg:flex items-center space-x-2">
            <Link href="/sign-in" className="btn btn-ghost">Prijavi se</Link>
            <Link href="/sign-up" className="btn btn-primary">Registruj se</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
