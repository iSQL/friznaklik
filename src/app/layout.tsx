// src/app/layout.tsx
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { srRS } from './locales/sr-RS';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import CookieConsentHandler from '@/components/CookieConsentHandler';
import {AnalyticsEvents} from '@/components/AnalyticsEvents';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getCurrentUser, AuthenticatedUser } from '@/lib/authUtils'; 
import { UserRole } from '@/lib/types/prisma-enums';
import type { Metadata } from "next";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'FrizNaKlik - Zakažite termin lako!',
  description: 'Platforma za jednostavno zakazivanje frizerskih i kozmetičkih termina.',
  openGraph: {
    title: 'FrizNaKlik',
    description: 'Dobar friz kreće sa rezervacijom.',
    url: 'https://friznaklik.zabari.online',
    siteName: 'FrizNaKlik',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user: AuthenticatedUser | null = await getCurrentUser();
  const isAdminUser = user ? (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.VENDOR_OWNER) : false;

  return (
    <ClerkProvider localization={srRS}>
      <html lang="sr"> 
        <head>
          {GA_MEASUREMENT_ID && (
            <>
              <Script
                id="google-consent-init"
                strategy="beforeInteractive"
                dangerouslySetInnerHTML={{
                  __html: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('consent', 'default', {
                      'ad_storage': 'denied',
                      'ad_user_data': 'denied',
                      'ad_personalization': 'denied',
                      'analytics_storage': 'denied',
                      'wait_for_update': 500 
                    });
                  `,
                }}
              />
              <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              />
              <Script
                id="google-analytics-config"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}');
                  `,
                }}
              />
            </>
          )}
        </head>
        <body className={`${inter.className} flex flex-col min-h-screen bg-base-200 text-base-content`}>
          <ErrorBoundary>
            <Header 
              user={user} 
              isAdmin={isAdminUser} 
            />
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            <Footer />
            {GA_MEASUREMENT_ID && <CookieConsentHandler />}
            {GA_MEASUREMENT_ID && <AnalyticsEvents />} 
          </ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
