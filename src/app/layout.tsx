import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from '@/components/Header'; // We'll create this component

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <ClerkProvider>
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
