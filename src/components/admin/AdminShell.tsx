// src/components/admin/AdminShell.tsx
'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  CalendarDays,
  ListOrdered,
  MessageSquare,
  Store,
  Users2, 
  Menu,
  X,
  ShieldCheck,
  Edit2, // Importovana ikona za izmenu
} from 'lucide-react';
import { UserRole } from '@/lib/types/prisma-enums';
import type { AuthenticatedUser } from '@/lib/authUtils';

interface NavItem {
  id?: string; // Opcioni identifikator za lakše dinamičko rukovanje
  name: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
  disabled?: boolean;
}

// Lista svih mogućih navigacionih linkova
const allNavLinks: NavItem[] = [
  { 
    name: 'Kontrolna tabla', 
    href: '/admin', 
    icon: Home, 
    roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER] 
  },
  { 
    id: 'edit-my-vendor', // ID za lakše pronalaženje ovog linka
    name: 'Informacije o Salonu', 
    href: '/admin/vendors/edit/placeholder', // Privremeni href, biće dinamički postavljen
    icon: Edit2, 
    roles: [UserRole.VENDOR_OWNER],
    disabled: true // Podrazumevano onemogućen dok se ne proveri ownedVendorId
  },
  { 
    name: 'Termini', 
    href: '/admin/appointments', 
    icon: CalendarDays, 
    roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER] 
  },
  { 
    name: 'Usluge', 
    href: '/admin/services', 
    icon: ListOrdered, 
    roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER] 
  },
  { 
    name: 'Radnici', 
    href: '/admin/workers', 
    icon: Users2, 
    roles: [UserRole.VENDOR_OWNER] 
  },
  { 
    name: 'Chat', 
    href: '/admin/chat', 
    icon: MessageSquare, 
    roles: [UserRole.SUPER_ADMIN, UserRole.VENDOR_OWNER] 
  },
  { 
    name: 'Saloni', 
    href: '/admin/vendors', 
    icon: Store, 
    roles: [UserRole.SUPER_ADMIN] 
  },
  // Primer onemogućenog linka
  // { name: 'Svi Radnici', href: '/admin/all-workers', icon: Users, roles: [UserRole.SUPER_ADMIN], disabled: true },
];

interface AdminShellProps {
  children: React.ReactNode;
  user: AuthenticatedUser | null;
}

export default function AdminShell({ children, user }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const [visibleNavLinks, setVisibleNavLinks] = useState<NavItem[]>([]);

  useEffect(() => {
    if (user?.role) {
      const filteredLinks = allNavLinks
        .filter(link => link.roles.includes(user.role as UserRole))
        .map(link => {
          // Dinamičko postavljanje href-a za "Informacije o Salonu"
          if (link.id === 'edit-my-vendor' && user.role === UserRole.VENDOR_OWNER) {
            if (user.ownedVendorId) {
              return { ...link, href: `/admin/vendors/edit/${user.ownedVendorId}`, disabled: false };
            } else {
              // Ako VENDOR_OWNER nema ownedVendorId, link ostaje onemogućen
              return { ...link, disabled: true }; 
            }
          }
          return link;
        });
      setVisibleNavLinks(filteredLinks);
    } else {
      setVisibleNavLinks([]);
    }
  }, [user]); // user objekat sadrži ownedVendorId, pa je dovoljan kao zavisnost

  if (!user) {
    // Prikaz poruke ako korisnik nije ulogovan
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
            <p className="text-lg mb-4">Morate biti prijavljeni da biste pristupili admin panelu.</p>
            <Link href="/sign-in" className="btn btn-primary">Prijavi se</Link>
        </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-base-200">
        {/* Mobilni sidebar */}
        <Transition show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-40 md:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </Transition.Child>

            <div className="fixed inset-0 z-40 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative flex w-full max-w-xs flex-1 flex-col bg-base-100 pt-5 pb-4">
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Zatvori sidebar</span>
                      <X className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                  
                  <div className="flex flex-shrink-0 items-center px-4">
                    <Link href="/admin" className="flex items-center text-xl font-semibold text-primary">
                        <ShieldCheck className="h-8 w-8 mr-2" />
                        <span>Admin Panel</span>
                    </Link>
                  </div>
                  <div className="mt-5 h-0 flex-1 overflow-y-auto">
                    <nav className="space-y-1 px-2">
                      {visibleNavLinks.map((item) => (
                        <Link
                          key={item.name}
                          href={item.disabled ? '#' : item.href} // Ako je onemogućen, href je '#'
                          className={`
                            ${pathname === item.href && !item.disabled
                              ? 'bg-primary text-primary-content'
                              : 'text-base-content hover:bg-base-200 hover:text-base-content'
                            }
                            ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                            group flex items-center px-2 py-2 text-base font-medium rounded-md
                          `}
                          aria-current={pathname === item.href && !item.disabled ? 'page' : undefined}
                          onClick={(e) => {
                            if (item.disabled) e.preventDefault();
                            else setSidebarOpen(false); 
                          }}
                        >
                          <item.icon
                            className="mr-4 h-6 w-6 flex-shrink-0"
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      ))}
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
              <div className="w-14 flex-shrink-0" aria-hidden="true">
                {/* Prazan prostor za offset */}
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Desktop sidebar */}
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
          <div className="flex flex-grow flex-col overflow-y-auto border-r border-base-300 bg-base-100 pt-5">
            <div className="flex flex-shrink-0 items-center px-4">
                <Link href="/admin" className="flex items-center text-xl font-semibold text-primary">
                    <ShieldCheck className="h-8 w-8 mr-2" />
                    <span>Admin Panel</span>
                </Link>
            </div>
            <div className="mt-5 flex flex-grow flex-col">
              <nav className="flex-1 space-y-1 px-2 pb-4">
                {visibleNavLinks.map((item) => (
                  <Link
                    key={item.name}
                    href={item.disabled ? '#' : item.href}
                    className={`
                      ${pathname === item.href && !item.disabled
                        ? 'bg-primary text-primary-content'
                        : 'text-base-content hover:bg-base-200 hover:text-base-content'
                      }
                      ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
                      group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    `}
                    aria-current={pathname === item.href && !item.disabled ? 'page' : undefined}
                    onClick={item.disabled ? (e) => e.preventDefault() : undefined}
                  >
                    <item.icon
                      className="mr-3 h-6 w-6 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Glavni sadržaj */}
        <div className="flex flex-1 flex-col md:pl-64">
          <div className="sticky top-0 z-10 h-16 flex-shrink-0 bg-base-100 shadow hidden md:flex">
            <button
              type="button"
              className="border-r border-base-300 px-4 text-base-content focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Otvori sidebar</span>
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <div className="flex flex-1 justify-between px-4">
              <div className="flex flex-1">
                {/* Opciono: Pretraga ili drugi sadržaj hedera */}
              </div>
              <div className="ml-4 flex items-center md:ml-6">
                <div className="ml-3 relative">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            </div>
          </div>

          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Fixed bottom menu for mobile */}
      <div className="btm-nav fixed bottom-0 left-0 right-0 w-full flex flex-row items-center justify-around md:hidden z-[50] shadow-top bg-base-200 print:hidden">
        {visibleNavLinks.slice(0, 5).map((item) => ( // Display up to 5 items in the bottom nav
          <Link
            key={item.name}
            href={item.disabled ? '#' : item.href}
            className={`
              ${pathname === item.href && !item.disabled
                ? 'active text-primary' // DaisyUI active class for btm-nav
                : 'text-base-content hover:text-primary'
              }
              ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
              flex flex-col items-center justify-center p-2 text-xs font-medium
            `}
            aria-current={pathname === item.href && !item.disabled ? 'page' : undefined}
            onClick={item.disabled ? (e) => e.preventDefault() : () => setSidebarOpen(false)} // Close sidebar on click
          >
            <item.icon className="h-5 w-5 mb-1" />
            <span className="btm-nav-label">{item.name}</span>
          </Link>
        ))}
      </div>
    </>
  );
}