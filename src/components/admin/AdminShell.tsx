'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, Settings2, CalendarCheck, MessageSquare, ShieldCheck } from 'lucide-react'; 

interface NavLink {
  href: string;
  label: string; 
  icon?: string;
}

interface AdminShellProps {
  navLinks: NavLink[];
  children: React.ReactNode;
}

const iconComponents: { [key: string]: React.ElementType } = {
  LayoutDashboard,
  Settings2,
  CalendarCheck,
  MessageSquare,
};

export default function AdminShell({ navLinks, children }: AdminShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  const SidebarContent = () => (
    <aside className="bg-base-200 text-base-content w-64 min-h-full p-4 space-y-6 shadow-lg lg:shadow-none print:hidden"> {/* Dodata print:hidden klasa */}
      <div className="flex flex-col items-center text-center border-b border-base-300 pb-4 mb-4"> {/* Prilagođen header */}
        <ShieldCheck className="h-12 w-12 text-primary mb-2" />
        <h2 className="text-xl font-bold">
          Admin Panel
        </h2>
      </div>
      <nav>
        <ul className="menu space-y-1 p-0">
          {navLinks.map((link) => {
            const IconComponent = link.icon ? iconComponents[link.icon] : null;
            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href) && link.href.length > '/admin'.length);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-150 font-medium
                    ${isActive
                      ? 'bg-primary text-primary-content shadow-sm'
                      : 'hover:bg-base-300 hover:bg-opacity-70'
                    }`}
                >
                  {IconComponent && <IconComponent className={`h-5 w-5 ${isActive ? '' : 'opacity-70'}`} />}
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );

  return (
    <div className="drawer lg:drawer-open bg-base-100">
      <input
        id="admin-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={isDrawerOpen}
        onChange={toggleDrawer}
      />
      <div className="drawer-content flex flex-col">
        <div className="navbar bg-base-200 lg:hidden sticky top-0 z-40 shadow print:hidden">
          <div className="flex-none">
            <label htmlFor="admin-drawer" aria-label="otvori bočnu traku" className="btn btn-square btn-ghost"> 
              <Menu className="h-5 w-5" />
            </label>
          </div>
          <div className="flex-1">
            <Link href="/admin" className="btn btn-ghost text-xl normal-case">
              <ShieldCheck className="h-6 w-6 mr-2 text-primary inline-block sm:hidden" /> 
              Admin Panel
            </Link>
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto bg-base-100"> 
          {children}
        </main>
      </div>
      <div className="drawer-side z-50 lg:z-auto print:hidden"> 
        <label htmlFor="admin-drawer" aria-label="zatvori bočnu traku" className="drawer-overlay"></label>
        <SidebarContent />
      </div>
    </div>
  );
}
