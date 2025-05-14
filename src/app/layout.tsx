import { ClerkProvider } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server'; 
import type { Metadata } from "next";
import "./globals.css";
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Inter } from 'next/font/google'; 
import {srRS} from './locales/sr-RS';
import { isAdminUser as checkIsAdmin } from '@/lib/authUtils';
import Script from 'next/script';
import { AnalyticsEvents } from '@/components/AnalyticsEvents';
import CookieConsentHandler from '@/components/CookieConsentHandler'; 

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();
  let isUserAdmin = false;

  if (userId) {
    isUserAdmin = await checkIsAdmin(userId);
  }
  return (
    <ClerkProvider localization={srRS}>
      <html lang="sr" data-theme="dark" className={inter.className}>
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
        <body>
          <div className="flex flex-col min-h-screen bg-base-100 text-base-content"> 
            <Header isUserAdminFromServer={isUserAdmin} />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
              {children}
            </main>

            <Footer />
            {GA_MEASUREMENT_ID && <CookieConsentHandler />}
            {GA_MEASUREMENT_ID && <AnalyticsEvents />}
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
