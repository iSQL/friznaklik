// src/app/vendors/page.tsx
import VendorBrowser from '@/components/vendors/VendorBrowserClient'; // We'll create this
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Pronađite Salon - FrizNaKlik',
  description: 'Pretražite i filtrirajte frizerske salone po uslugama koje nude. Pronađite savršen salon za vaše potrebe.',
  openGraph: {
    title: 'Pronađite Salon - FrizNaKlik',
    description: 'Otkrijte najbolje frizerske salone i usluge u vašoj blizini.',
    // url: 'https://friznaklik.zabari.online/vendors', // Update with your actual production URL
    // images: [
    //   {
    //     url: 'https://friznaklik.zabari.online/og-image-vendors.png',
    //     width: 1200,
    //     height: 630,
    //     alt: 'Pretraga Salona - FrizNaKlik',
    //   },
    // ],
    locale: 'sr_RS',
    type: 'website',
  },
  keywords: ['frizerski saloni', 'pretraga salona', 'filter usluga', 'FrizNaKlik', 'zakazivanje frizera'],
  alternates: {
    canonical: '/vendors',
  },
};


export default function VendorsPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <header className="mb-8 text-center">
        <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-neutral-content mb-2">Pronađite Savršen Salon</h1>
        <p className="text-lg text-neutral-content/80">
          Pretražite našu mrežu salona i filtrirajte po uslugama koje Vas interesuju.
        </p>
      </header>

      <Suspense fallback={<VendorBrowserSkeleton />}>
        <VendorBrowser />
      </Suspense>
    </div>
  );
}

function VendorBrowserSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="lg:w-1/4 animate-pulse">
        <div className="card bg-base-200 shadow">
          <div className="card-body">
            <div className="h-6 bg-base-300 rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-5 w-5 bg-base-300 rounded"></div>
                  <div className="h-5 bg-base-300 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="lg:w-3/4 animate-pulse">
        <div className="h-8 bg-base-300 rounded w-1/2 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card bg-base-200 shadow">
              <div className="card-body space-y-3">
                <div className="h-7 bg-base-300 rounded w-3/5"></div>
                <div className="h-4 bg-base-300 rounded w-full"></div>
                <div className="h-4 bg-base-300 rounded w-5/6"></div>
                <div className="h-4 bg-base-300 rounded w-4/6"></div>
                <div className="flex justify-end mt-2">
                  <div className="h-9 w-24 bg-base-300 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}