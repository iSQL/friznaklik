import 'server-only';
import Link from 'next/link';
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer footer-center p-4 bg-base-300 text-base-content print:hidden">
      <div className="container mx-auto px-4">
        <nav className="mb-2 md:mb-0 md:order-first"> 
          <Link href="/uslovi-koriscenja" className="link link-hover text-sm mx-2">
            Uslovi korišćenja
          </Link>
          <span className="text-sm mx-1 hidden sm:inline">|</span>
          <Link href="/politika-privatnosti" className="link link-hover text-sm mx-2">
            Politika privatnosti
          </Link>
        </nav>
        <aside>
          <p className="text-sm">
            Autorska prava © {currentYear} - Sva prava zadržana od strane FrizNaKlik
          </p>
        </aside>
      </div>
    </footer>
  );
};

export default Footer;
