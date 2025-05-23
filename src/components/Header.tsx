// src/components/Header.tsx
'use client';

import { UserButton, useAuth } from "@clerk/nextjs"; // Added useUser for robustness if needed
import Link from "next/link";
import Image from 'next/image';
import {
    CalendarDays,
    MessageSquare, 
    Store,
    ShieldCheck,
    Building2,
    Loader2,
    Sun,
    Moon,
    LayoutDashboard,
    LogIn,
    Settings, 
    ChevronDown,
    UserCircle 
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import type { AuthenticatedUser } from '@/lib/authUtils';
import { UserRole } from '@/lib/types/prisma-enums';

import { useBookingStore } from '@/store/bookingStore';
import Cookies from 'js-cookie';

interface HeaderProps {
  user: AuthenticatedUser | null; 
  isAdmin: boolean; 
}

const THEME_COOKIE_NAME = 'friznaklik-theme';
const LIGHT_THEME = 'light';
const DARK_THEME = 'dark';

export default function Header({ user: userProp, isAdmin: isAdminProp }: HeaderProps) { 
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth(); 

  const pathname = usePathname();

  const {
    selectedVendorId,
    selectVendor: setGlobalVendor,
    allVendors: storeAllVendors,
    isLoadingAllVendors: storeIsLoadingAllVendors,
    fetchAndSetAllVendors
  } = useBookingStore();

  const [isDesktopVendorDropdownOpen, setIsDesktopVendorDropdownOpen] = useState(false);
  const desktopVendorDropdownRef = useRef<HTMLDivElement>(null);

  const [currentTheme, setCurrentTheme] = useState<string>(LIGHT_THEME);
  const [isPanelPopupOpen, setIsPanelPopupOpen] = useState(false);
  const panelPopupRef = useRef<HTMLDivElement>(null);

  const applyTheme = useCallback((themeToApply: string) => {
    document.documentElement.setAttribute('data-theme', themeToApply);
    setCurrentTheme(themeToApply);
    Cookies.set(THEME_COOKIE_NAME, themeToApply, { expires: 365, path: '/' });
  }, []);

  useEffect(() => {
    const savedTheme = Cookies.get(THEME_COOKIE_NAME);
    if (savedTheme && (savedTheme === LIGHT_THEME || savedTheme === DARK_THEME)) {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? DARK_THEME : LIGHT_THEME);
    }
  }, [applyTheme]);

  const toggleTheme = () => {
    const newTheme = currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
    applyTheme(newTheme);
  };

  useEffect(() => {
    const showSelector = !pathname.startsWith('/admin') && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up');
    if (showSelector) {
      fetchAndSetAllVendors();
    }
  }, [pathname, fetchAndSetAllVendors]);

  useEffect(() => {
    if (selectedVendorId && storeAllVendors.length > 0 && !storeAllVendors.some(v => v.id === selectedVendorId)) {
        setGlobalVendor(null);
    }
  }, [selectedVendorId, storeAllVendors, setGlobalVendor]);

  const handleGlobalVendorSelect = (vendorId: string | null) => {
    setGlobalVendor(vendorId);
    setIsDesktopVendorDropdownOpen(false);
  };

  const selectedVendorName = storeAllVendors.find(v => v.id === selectedVendorId)?.name || "Izaberite Salon";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopVendorDropdownRef.current && !desktopVendorDropdownRef.current.contains(event.target as Node)) {
        setIsDesktopVendorDropdownOpen(false);
      }
      if (panelPopupRef.current && !panelPopupRef.current.contains(event.target as Node)) {
        setIsPanelPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const topNavLinks = [
    { href: "/vendors", label: "Saloni", icon: Building2, disabled: false },
    { href: "/book", label: "Zakazivanje", icon: CalendarDays, disabled: false },
  ];

  // Define bottom navigation links with roles and a 'public' flag
  const bottomNavLinks = [
    { href: "/vendors", label: "Saloni", icon: Building2, disabled: false, roles: [UserRole.USER, UserRole.WORKER, UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN], public: true },
    { href: "/book", label: "Zakaži", icon: CalendarDays, disabled: false, roles: [UserRole.USER, UserRole.WORKER, UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN], public: true },
    { href: "/admin", label: "Administracija", icon: Settings, disabled: false, roles: [UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN], public: false },
    { href: "/my-schedule", label: "Moj raspored", icon: MessageSquare, disabled: false, roles: [UserRole.WORKER], public: false },
    // Add "Moj kutak" / Dashboard link for all logged-in users
    { href: "/dashboard", label: "Moj kutak", icon: LayoutDashboard, disabled: false, roles: [UserRole.USER, UserRole.WORKER, UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN], public: false },
  ];

  const toggleDesktopVendorDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDesktopVendorDropdownOpen(prev => !prev);
  };

  const togglePanelPopup = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPanelPopupOpen(prev => !prev);
  };

  // Derive current user's role based on client-side isSignedIn and the userProp from server
  // userProp might be stale immediately after logout, so isSignedIn is the primary gate.
  const currentUserRole = isSignedIn && userProp ? userProp.role : null;
  // Derive admin status for top nav based on isSignedIn and server-provided isAdminProp (which is based on userProp)
  const showDesktopAdminPanelLink = isSignedIn && isAdminProp;


  if (!isAuthLoaded) { // Show skeleton loader while Clerk is initializing
    return (
      <div className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
        <div className="navbar-start"><div className="btn btn-ghost px-2 flex items-center"><div className="h-8 w-32 bg-base-300 rounded animate-pulse"></div></div></div>
        <div className="navbar-center hidden lg:flex"><ul className="menu menu-horizontal px-1 space-x-1">{[1, 2].map(i => <li key={i} className="h-9 w-24 bg-base-300 rounded animate-pulse"></li>)}</ul></div>
        <div className="navbar-end"><div className="h-9 w-28 bg-base-300 rounded animate-pulse mr-2"></div><div className="h-8 w-8 bg-base-300 rounded-full"></div></div>
      </div>
    );
  }

  const showVendorSelector = !pathname.startsWith('/admin') && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up');

  return (
    <>
      <nav className="navbar bg-base-200 text-base-content shadow-md sticky top-0 z-50 print:hidden">
        <div className="navbar-start">
          <Link href="/" className="btn btn-ghost text-xl px-1 sm:px-2 flex items-center">
            <Image src="/logo-wide.png" alt="FrizNaKlik Logo" width={125} height={50} priority style={{width: 'auto', height: '50px'}} />
          </Link>
        </div>

        <div className="navbar-center hidden lg:flex">
          {showVendorSelector && (
              <div className={`dropdown dropdown-end mr-2 ${isDesktopVendorDropdownOpen ? "dropdown-open" : ""}`} ref={desktopVendorDropdownRef}>
              <button tabIndex={0} role="button" className="btn btn-ghost btn-sm" onClick={toggleDesktopVendorDropdown} aria-label="Izaberi salon">
                  {storeIsLoadingAllVendors ? <Loader2 className="animate-spin h-4 w-4"/> : <Store size={16}/>}
                  <span className="ml-1 hidden xl:inline truncate max-w-[120px]">{selectedVendorName}</span>
                  <span className="ml-1 inline xl:hidden">{selectedVendorId && storeAllVendors.find(v=>v.id === selectedVendorId) ? storeAllVendors.find(v=>v.id === selectedVendorId)!.name.substring(0,5)+'...' : "Salon"}</span>
                  <ChevronDown size={16} className={`ml-1 transition-transform ${isDesktopVendorDropdownOpen ? 'rotate-180' : ''}`}/>
              </button>
              <ul tabIndex={0} className="dropdown-content z-[51] menu p-2 shadow-xl bg-base-100 rounded-box w-52 max-h-60 overflow-y-auto">
                  {storeIsLoadingAllVendors && <li className="p-2 text-center"><span className="loading loading-dots loading-md"></span></li>}
                  {!storeIsLoadingAllVendors && storeAllVendors.length === 0 && <li><a className="text-sm text-base-content/70">Nema dostupnih salona</a></li>}
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
            {topNavLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.disabled ? '#' : link.href}
                  className={`btn btn-ghost font-medium ${pathname === link.href && !link.disabled ? 'btn-active text-primary' : ''} ${link.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                  onClick={link.disabled ? (e) => e.preventDefault() : undefined} aria-disabled={link.disabled} tabIndex={link.disabled ? -1 : undefined}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="navbar-end">
          <button onClick={toggleTheme} className="btn btn-ghost btn-circle hidden lg:inline-flex" aria-label={currentTheme === LIGHT_THEME ? "Aktiviraj tamnu temu" : "Aktiviraj svetlu temu"}>
              {currentTheme === LIGHT_THEME ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          {isSignedIn ? ( // Use client-side isSignedIn
            <>
              <ul className="menu menu-horizontal px-1 space-x-1 hidden lg:flex">
                  <li>
                    <Link href="/dashboard" className={`btn btn-ghost font-medium ${pathname.startsWith('/dashboard') ? 'btn-active text-primary' : ''}`}>
                      <LayoutDashboard className="h-5 w-5" /> Kontrolna Tabla
                    </Link>
                  </li>
                  {showDesktopAdminPanelLink && ( // Use derived admin status
                    <li>
                      <Link href="/admin" className={`btn btn-ghost font-medium ${pathname.startsWith('/admin') ? 'btn-active text-primary' : ''}`}>
                        <ShieldCheck className="h-5 w-5" /> Admin Panel
                      </Link>
                    </li>
                  )}
              </ul>
              <div className="ml-2 pl-1 border-l border-base-300/70 hidden lg:flex items-center">
                <UserButton
                  appearance={{ elements: { userButtonAvatarBox: "w-9 h-9", userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg"} }}
                  afterSignOutUrl="/"
                />
              </div>
            </>
          ) : (
            <div className="hidden lg:flex items-center space-x-2">
              <Link href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`} className="btn btn-ghost">Prijavi se</Link>
              {/* <Link href={`/sign-up?redirect_url=${encodeURIComponent(pathname)}`} className="btn btn-primary">Registruj se</Link> */} {/* Mozda da sakrijem sign up, jer ga svakako ima na sign in page */}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Navigation (for lg:hidden screens) */}
      <div className="btm-nav fixed bottom-0 left-0 right-0 w-full flex flex-row items-center justify-around lg:hidden z-[50] shadow-top bg-base-200 print:hidden">
        {bottomNavLinks.map((item) => {
          let showLink = false;
          if (item.public) {
            showLink = true;
          } else if (isSignedIn && currentUserRole) { // Check isSignedIn first
            if (item.roles.includes(currentUserRole as UserRole)) {
              showLink = true;
            }
          }

          return showLink ? (
            <Link
              key={item.href}
              href={item.disabled ? '#' : item.href}
              className={`
                ${pathname === item.href && !item.disabled ? 'active text-primary' : 'text-base-content hover:text-primary'}
                ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                flex flex-col items-center justify-center p-2 text-xs font-medium flex-1 min-w-0
              `}
              aria-current={pathname === item.href && !item.disabled ? 'page' : undefined}
              onClick={item.disabled ? (e) => e.preventDefault() : undefined}
            >
              <item.icon className="h-5 w-5 mb-0.5" />
              <span className="btm-nav-label truncate">{item.label}</span>
            </Link>
          ) : null;
        })}

        {/* "Profil" dropdown or Sign In/Up for the last slot in btm-nav */}
        {isSignedIn ? (
          <div className={`dropdown dropdown-top dropdown-end ${isPanelPopupOpen ? 'dropdown-open' : ''} flex-1 min-w-0`} ref={panelPopupRef}>
            <button tabIndex={0} role="button"
              className={`btm-nav-item ${isPanelPopupOpen ? 'active text-primary' : 'text-base-content hover:text-primary'} flex flex-col items-center justify-center p-2 text-xs font-medium w-full`}
              onClick={togglePanelPopup}>
               <Settings className="h-5 w-5 mb-0.5" /> 
              <span className="btm-nav-label truncate">Profil</span>
            </button>
            <ul tabIndex={0} className="dropdown-content z-[51] menu p-2 shadow bg-base-100 rounded-box w-52 mb-16">
              <li>
                <div className="flex justify-center p-2">
                  <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8", userButtonPopoverCard: "bg-base-100 border border-base-300 shadow-lg"}}} afterSignOutUrl="/" />
                </div>
              </li>
              <li>
                <Link href="/user" onClick={() => setIsPanelPopupOpen(false)} className="text-sm">
                  <UserCircle className="h-4 w-4 mr-2" /> Podešavanja Profila
                </Link>
              </li>
              {showDesktopAdminPanelLink && ( // Re-use the same logic as desktop for Admin Panel link
                <>
                  <div className="divider my-0"></div>
                  <li>
                    <Link href="/admin" onClick={() => setIsPanelPopupOpen(false)} className="text-sm">
                      <ShieldCheck className="h-4 w-4 mr-2" /> Admin Panel
                    </Link>
                  </li>
                </>
              )}
              <div className="divider my-0"></div>
              <li>
                <button onClick={() => { toggleTheme(); setIsPanelPopupOpen(false); }} className="flex items-center w-full text-sm p-2 hover:bg-base-200 rounded">
                  {currentTheme === LIGHT_THEME ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span className="ml-2">{currentTheme === LIGHT_THEME ? "Tamna tema" : "Svetla tema"}</span>
                </button>
              </li>
            </ul>
          </div>
        ) : (
          <>
            <Link href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`} className="text-base-content hover:text-primary flex flex-col items-center justify-center p-2 text-xs font-medium flex-1 min-w-0">
              <LogIn className="h-5 w-5 mb-0.5" />
              <span className="btm-nav-label truncate">Prijava</span>
            </Link>

             <button onClick={toggleTheme} className="text-base-content hover:text-primary flex flex-col items-center justify-center p-2 text-xs font-medium flex-1 min-w-0">
              {currentTheme === LIGHT_THEME ? <Moon className="h-5 w-5 mb-0.5" /> : <Sun className="h-5 w-5 mb-0.5" />}
              <span className="btm-nav-label truncate">Tema</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
