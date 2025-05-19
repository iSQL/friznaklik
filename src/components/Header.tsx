// src/components/Header.tsx
'use client';

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import Image from 'next/image';
import {
    Menu as MenuIcon, LogIn, UserPlus, LayoutDashboard, MessageCircle,
    CalendarPlus, ListOrdered, X, ShieldCheck, Store, ChevronDown, Building2, Loader2 // Ensured Loader2 is imported
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthenticatedUser } from '@/lib/authUtils'; // Corrected import path
import { UserRole } from '@/lib/types/prisma-enums'; // Corrected import path

import { useBookingStore } from '@/store/bookingStore';
import type { Vendor } from '@prisma/client';
// formatErrorMessage is not used in this version of Header, but can be kept if error display becomes more complex
// import { formatErrorMessage } from '@/lib/errorUtils';

interface HeaderProps {
  user: AuthenticatedUser | null;
  isAdmin: boolean;
}

export default function Header({ user, isAdmin }: HeaderProps) {
  const { isLoaded } = useAuth();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Get state and actions from useBookingStore for global vendor management
  const {
    selectedVendorId,
    selectVendor: setGlobalVendor,
    allVendors: storeAllVendors, // Use vendors from the store
    isLoadingAllVendors: storeIsLoadingAllVendors, // Use loading state from the store
    fetchAndSetAllVendors // Action to fetch vendors and update the store
  } = useBookingStore();

  const [isDesktopVendorDropdownOpen, setIsDesktopVendorDropdownOpen] = useState(false);
  const desktopVendorDropdownRef = useRef<HTMLDivElement>(null);

  const [isMobileVendorListOpen, setIsMobileVendorListOpen] = useState(false);

  // Fetch global vendors when component mounts or pathname changes (if relevant)
  useEffect(() => {
    const showSelector = !pathname.startsWith('/admin') && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up');
    if (showSelector) {
      // Call the action from the store to fetch vendors.
      // The action itself will handle setting isLoadingAllVendors and allVendors.
      fetchAndSetAllVendors();
    }
  }, [pathname, fetchAndSetAllVendors]);

  // Effect to ensure selectedVendorId is valid if storeAllVendors changes
  useEffect(() => {
    if (selectedVendorId && storeAllVendors.length > 0 && !storeAllVendors.some(v => v.id === selectedVendorId)) {
        setGlobalVendor(null); // Reset if selected vendor is not in the new list
    }
  }, [selectedVendorId, storeAllVendors, setGlobalVendor]);


  const handleGlobalVendorSelect = (vendorId: string | null) => {
    setGlobalVendor(vendorId);
    setIsDesktopVendorDropdownOpen(false);
    setIsMobileVendorListOpen(false);
    setIsMobileMenuOpen(false);
  };

  const selectedVendorName = storeAllVendors.find(v => v.id === selectedVendorId)?.name || "Izaberite Salon";

  // Click outside handler for ALL dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopVendorDropdownRef.current && !desktopVendorDropdownRef.current.contains(event.target as Node)) {
        setIsDesktopVendorDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
        setIsMobileVendorListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navLinks = [
    { href: "/vendors", label: "Saloni", icon: Building2 },
    { href: "/services", label: "Usluge", icon: ListOrdered },
    { href: "/book", label: "Zakaži", icon: CalendarPlus },
    { href: "/chat", label: "Pomoć", icon: MessageCircle },
  ];

  const userNavLinks = [];
  if (user) {
    userNavLinks.push({ href: "/dashboard", label: "Kontrolna Tabla", icon: LayoutDashboard });
    if (user.role === UserRole.WORKER) { // Check for WORKER role
    userNavLinks.push({ href: "/dashboard/my-schedule", label: "Moj Raspored", icon: LayoutDashboard }); // Or a more specific icon
    }
    if (isAdmin) {
      userNavLinks.push({ href: "/admin", label: "Admin Panel", icon: ShieldCheck });
    }
  }

  const toggleMobileMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(prev => {
        const newState = !prev;
        if (!newState) setIsMobileVendorListOpen(false);
        return newState;
    });
  };

  const toggleDesktopVendorDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDesktopVendorDropdownOpen(prev => !prev);
  };
  
  const toggleMobileVendorList = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileVendorListOpen(prev => !prev);
  };

  if (!isLoaded) {
    return (
      <div className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
        <div className="navbar-start"><div className="btn btn-ghost px-2 flex items-center"><div className="h-8 w-32 bg-base-300 rounded animate-pulse"></div></div></div>
        <div className="navbar-center hidden lg:flex"><ul className="menu menu-horizontal px-1 space-x-1">{[1, 2, 3, 4].map(i => <li key={i} className="h-9 w-24 bg-base-300 rounded animate-pulse"></li>)}</ul></div>
        <div className="navbar-end"><div className="h-9 w-28 bg-base-300 rounded animate-pulse"></div></div>
      </div>
    );
  }

  const showVendorSelector = !pathname.startsWith('/admin') && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up');

  return (
    <nav className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
      <div className="navbar-start">
        <div className={`dropdown lg:hidden ${isMobileMenuOpen ? "dropdown-open" : ""}`} ref={mobileDropdownRef}>
          <button
            tabIndex={0}
            aria-label="Otvori meni"
            role="button"
            className="btn btn-ghost"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[51] p-2 shadow-lg bg-base-100 text-base-content rounded-box w-64"
          >
            {showVendorSelector && (
              <>
                <li>
                  <div className="justify-between font-semibold text-sm p-2 text-left w-full flex items-center"
                       onClick={toggleMobileVendorList}>
                    <span className="flex items-center">
                      {storeIsLoadingAllVendors ? <Loader2 className="animate-spin h-4 w-4 mr-1"/> : <Store size={14} className="mr-1"/>}
                      {selectedVendorName}
                    </span>
                    <ChevronDown size={14} className={`transition-transform ${isMobileVendorListOpen ? 'rotate-180' : ''}`}/>
                  </div>
                  {isMobileVendorListOpen && (
                    <ul className="menu menu-xs p-1 bg-base-200 rounded-box shadow-lg max-h-48 overflow-y-auto mt-1">
                      {storeIsLoadingAllVendors && <li><span className="loading loading-dots loading-xs"></span></li>}
                      {!storeIsLoadingAllVendors && storeAllVendors.length === 0 && <li><a>Nema dostupnih salona</a></li>}
                      {/* Consider adding vendorSelectorError display here if needed */}
                      {storeAllVendors.map(vendor => (
                        <li key={vendor.id}>
                          <a onClick={() => handleGlobalVendorSelect(vendor.id)} className={selectedVendorId === vendor.id ? 'active' : ''}>
                            {vendor.name}
                          </a>
                        </li>
                      ))}
                      {storeAllVendors.length > 0 && (
                        <>
                          <div className="divider my-0.5"></div>
                          <li><a onClick={() => handleGlobalVendorSelect(null)} className={`italic ${!selectedVendorId ? 'text-base-content/70 font-semibold' : ''}`}>Prikaži sve / Resetuj</a></li>
                        </>
                      )}
                    </ul>
                  )}
                </li>
                <div className="divider my-1"></div>
              </>
            )}
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => {setIsMobileMenuOpen(false); setIsMobileVendorListOpen(false);}} className={`flex items-center gap-2 p-2 rounded-md ${pathname === link.href ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}>
                  {link.icon && <link.icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              </li>
            ))}
            {userNavLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => {setIsMobileMenuOpen(false); setIsMobileVendorListOpen(false);}} className={`flex items-center gap-2 p-2 rounded-md ${pathname.startsWith(link.href) && link.href !== '/' ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}>
                  {link.icon && <link.icon className="h-4 w-4" />}
                  {link.label}
                </Link>
              </li>
            ))}
            <div className="divider my-2 px-2 text-xs">Korisnik</div>
            {!user ? (
              <>
                <li><Link href="/sign-in" onClick={() => {setIsMobileMenuOpen(false); setIsMobileVendorListOpen(false);}} className="flex items-center gap-2 p-2 rounded-md hover:bg-base-300"><LogIn className="h-4 w-4" /> Prijavi se</Link></li>
                <li className="mt-1"><Link href="/sign-up" onClick={() => {setIsMobileMenuOpen(false); setIsMobileVendorListOpen(false);}} className="btn btn-primary btn-sm w-full mt-1"><UserPlus className="h-4 w-4 mr-1" /> Registruj se</Link></li>
              </>
            ) : (
              <li><div className="flex justify-center items-center py-2 px-2 rounded-md hover:bg-base-300"><UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-8 h-8", userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg" }}}/><span className="ml-2 text-sm font-medium">Profil</span></div></li>
            )}
          </ul>
        </div>
        <Link href="/" className="btn btn-ghost text-xl px-1 sm:px-2 flex items-center" onClick={() => {setIsMobileMenuOpen(false); setIsMobileVendorListOpen(false);}}>
          <Image src="/logo-wide.png" alt="FrizNaKlik Logo" width={125} height={50} priority style={{width: 'auto', height: '50px'}} />
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
        {showVendorSelector && (
            <div className={`dropdown dropdown-end mr-2 ${isDesktopVendorDropdownOpen ? "dropdown-open" : ""}`} ref={desktopVendorDropdownRef}>
            <button
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-sm"
                onClick={toggleDesktopVendorDropdown}
            >
                {storeIsLoadingAllVendors ? <Loader2 className="animate-spin h-4 w-4"/> : <Store size={16}/>}
                <span className="ml-1 hidden xl:inline truncate max-w-[120px]">{selectedVendorName}</span>
                <span className="ml-1 inline xl:hidden">{selectedVendorId && storeAllVendors.find(v=>v.id === selectedVendorId) ? storeAllVendors.find(v=>v.id === selectedVendorId)!.name.substring(0,5)+'...' : "Salon"}</span>
                <ChevronDown size={16} className={`ml-1 transition-transform ${isDesktopVendorDropdownOpen ? 'rotate-180' : ''}`}/>
            </button>
            <ul
                tabIndex={0}
                className="dropdown-content z-[51] menu p-2 shadow-xl bg-base-100 rounded-box w-52 max-h-60 overflow-y-auto"
            >
                {storeIsLoadingAllVendors && <li className="p-2 text-center"><span className="loading loading-dots loading-md"></span></li>}
                {!storeIsLoadingAllVendors && storeAllVendors.length === 0 && <li><a className="text-sm text-base-content/70">Nema dostupnih salona</a></li>}
                 {/* Consider adding vendorSelectorError display here if needed from store */}
                {storeAllVendors.map((vendor) => (
                    <li key={vendor.id}>
                    <a onClick={() => handleGlobalVendorSelect(vendor.id)} className={selectedVendorId === vendor.id ? 'active' : ''}>
                        {vendor.name}
                    </a>
                    </li>
                ))}
                {storeAllVendors.length > 0 && (
                    <>
                        <div className="divider my-1"></div>
                        <li><a onClick={() => handleGlobalVendorSelect(null)} className={`italic ${!selectedVendorId ? 'text-base-content/70 font-semibold' : ''}`}>Prikaži sve / Resetuj</a></li>
                    </>
                )}
            </ul>
            </div>
        )}
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
                appearance={{ elements: { userButtonAvatarBox: "w-9 h-9", userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg"} }}
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
