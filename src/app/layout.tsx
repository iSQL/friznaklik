import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from "next";
import "./globals.css";
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Haircut Appointment App',
  description: 'Book your next haircut appointment easily.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey="pk_test_ZW5vdWdoLW5ld3QtNjAuY2xlcmsuYWNjb3VudHMuZGV2JA">
      <html lang="en" data-theme="dark">
      <body>
      <Header /> 
        <main className="container mx-auto p-4"> 
          {/* Main content area */}
          {/* You can add a sidebar or other components here */}
          {children}
        </main>
      </body>
    </html>
    </ClerkProvider>
  );
}
