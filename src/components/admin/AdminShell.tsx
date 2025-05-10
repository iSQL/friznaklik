'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, Settings2, CalendarCheck, MessageSquare } from 'lucide-react';

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
    <aside className="bg-base-200 text-base-content w-64 min-h-full p-4 space-y-6 shadow-lg lg:shadow-none">
      <h2 className="text-2xl font-bold text-center border-b border-base-300 pb-3">
        Admin Panel
      </h2>
      <nav>
        <ul className="menu space-y-1 p-0">
          {navLinks.map((link) => {
            const IconComponent = link.icon ? iconComponents[link.icon] : null;
            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors duration-150 hover:bg-base-300 ${isActive ? 'bg-primary text-primary-content' : 'hover:bg-opacity-50'}`}
                >
                  {IconComponent && <IconComponent className="h-5 w-5" />}
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
        <div className="navbar bg-base-200 lg:hidden sticky top-0 z-40 shadow">
          <div className="flex-none">
            <label htmlFor="admin-drawer" aria-label="open sidebar" className="btn btn-square btn-ghost">
              <Menu className="h-5 w-5" />
            </label>
          </div>
          <div className="flex-1">
            <Link href="/admin" className="btn btn-ghost text-xl normal-case">Admin Panel</Link>
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
      <div className="drawer-side z-50 lg:z-auto">
        <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
        <SidebarContent />
      </div>
    </div>
  );
}
