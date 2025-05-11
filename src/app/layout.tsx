import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from "next";
import "./globals.css";
import Header from '@/components/Header';
import { Inter } from 'next/font/google'; 
import {srRS} from './locales/sr-RS';

const inter = Inter({ subsets: ['latin', 'latin-ext'] }); 
export const metadata: Metadata = {
  title: 'Friz Na Klik', 
  description: 'Dobar friz kreće sa rezervacijom.', 
  openGraph: {
    title: 'Friz Na Klik',
    description: 'Dobar friz kreće sa rezervacijom.',
     url: 'https://friznaklik.zabari.online', 
     siteName: 'Friz Na Klik',
     images: [ 
       {
         url: 'https://friznaklik.zabari.online/logo-wide.png', 
         width: 1080,
         height: 500,
       },
     ],
    locale: 'sr_RS', 
    type: 'website',
  },
  icons: { 
    icon: '/logo-square.png',
    shortcut: '/logo-square.png',
    apple: '/android-chrome-192x192.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={srRS}>
      <html lang="sr" data-theme="dark" className={inter.className}>
        <body>
          <div className="flex flex-col min-h-screen bg-base-100 text-base-content"> 
            <Header />

            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>

            <footer className="footer footer-center p-4 bg-base-300 text-base-content print:hidden"> 
              <div>
                <p>Autorska prava © {new Date().getFullYear()} - Sva prava zadržana od strane FrizNaKlik</p>
              </div>
            </footer>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
