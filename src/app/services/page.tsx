
import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { Service } from '@prisma/client';
import { formatErrorMessage } from '@/lib/errorUtils'; 
import type { Metadata } from 'next';
import { Scissors, AlertTriangle } from 'lucide-react'; 

// Uzeti u obzir da ako bude vise vendora / salona, ovo treba da bude dinamicno
export const metadata: Metadata = {
  title: 'Naše Usluge - Friz Na Klik',
  description: 'Pregledajte sve frizerske usluge koje nudimo u salonu Friz Na Klik. Pronađite savršenu uslugu za sebe i zakažite termin online.', 
  openGraph: {
    title: 'Naše Usluge - Friz Na Klik',
    description: 'Otkrijte širok spektar frizerskih usluga dostupnih u Friz Na Klik. Od šišanja do specijalnih tretmana.',
    // url: 'https://friznaklik.zabari.online/services',
    // images: [
    //   {
    //     url: 'https://friznaklik.zabari.online/neka slika za servise.png',
    //     width: 1200,
    //     height: 630,
    //     alt: 'Frizerske usluge - Friz Na Klik',
    //   },
    // ],
    locale: 'sr_RS',
    type: 'website', 
  },
  keywords: ['frizerske usluge', 'šišanje', 'farbanje', 'feniranje', 'Friz Na Klik', 'zakazivanje frizera'],
  alternates: { 
    canonical: '/services', 
    
  },
};

async function getServicesDirectly(): Promise<Service[]> {
  try {
    console.log("Preuzimanje usluga direktno iz baze za /services stranicu...");
    const services = await prisma.service.findMany({
      orderBy: {
        name: 'asc', 
      },
    });
    console.log(`Preuzeto ${services.length} usluga direktno iz baze.`);
    return services;
  } catch (error: unknown) { 
    const userFriendlyMessage = formatErrorMessage(error, "preuzimanja usluga direktno iz baze");
    throw new Error(userFriendlyMessage);
  }
}

export const dynamic = 'force-dynamic';
// Ili, za revalidaciju (npr. svakih sat vremena):
// export const revalidate = 3600;

export default async function ServicesPage() {
  let services: Service[] = [];
  let fetchError: string | null = null;

  try {
    services = await getServicesDirectly();
  } catch (error: unknown) { 
    if (error instanceof Error) {
        fetchError = error.message; 
    } else {
        fetchError = formatErrorMessage(error, "prikazivanja stranice sa uslugama");
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8 text-center">
        <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
          <Scissors className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-neutral-content mb-2">Naše Usluge</h1>
        <p className="text-lg text-neutral-content/80">
          Otkrijte paletu profesionalnih frizerskih i stilskih usluga koje nudimo.
        </p>
      </header>

      {fetchError && (
        <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
          <AlertTriangle className="h-6 w-6"/>
          <div>
            <h3 className="font-bold">Ups! Došlo je do greške.</h3>
            <div className="text-xs">{fetchError}</div>
          </div>
        </div>
      )}

      {!fetchError && services.length === 0 && (
        <div className="text-center py-10 bg-base-200 rounded-box p-8">
          <Scissors className="h-16 w-16 mx-auto text-base-content opacity-30 mb-4" />
          <p className="text-xl text-neutral-content/70 font-semibold">
            Trenutno nema dostupnih usluga.
          </p>
          <p className="text-neutral-content/60 mt-2">
            Molimo Vas, proverite kasnije.
          </p>
        </div>
      )}

      {!fetchError && services.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out flex flex-col">
              <div className="card-body flex flex-col flex-grow">
                <h2 className="card-title text-2xl mb-2 text-primary">{service.name}</h2>
                <p className="text-base-content/80 mb-4 h-24 overflow-y-auto text-sm leading-relaxed flex-grow">
                  {service.description || "Nema dostupnog opisa."}
                </p>
                <div className="mb-4 space-y-1 text-sm">
                  <p>
                    <span className="font-semibold text-base-content/90">Trajanje:</span> {service.duration} minuta
                  </p>
                  <p>
                    <span className="font-semibold text-base-content/90">Cena:</span> {service.price.toFixed(2)} RSD
                  </p>
                </div>
                <div className="card-actions justify-end mt-auto">
                  <Link href={`/book?serviceId=${service.id}&serviceName=${encodeURIComponent(service.name)}`} className="btn btn-primary">
                    Zakaži
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}