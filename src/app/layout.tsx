import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from "next";
import "./globals.css"; 
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Haircut Appointment App',
  description: 'Book your next haircut appointment easily.',
  icons: {
    icon: '/logo-square.png',
    shortcut: '/logo-square.png',
    apple: '/android-chrome-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" data-theme="dark"> 
        <body>
          <div className="flex flex-col min-h-screen"> 
            <Header /> 
            
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8"> 
              
              {children}
            </main>

           
            <footer className="footer footer-center p-4 bg-base-300 text-base-content">
              <div>
                <p>Copyright © {new Date().getFullYear()} - All rights reserved by FrizNaKlik</p>
              </div>
            </footer>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}