// src/app/page.tsx
import Link from 'next/link';
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ShoppingBag, CalendarDays, MessageSquare, LayoutDashboard, Scissors } from 'lucide-react';
import QuickReserveWidget from '@/components/QuickReserveWidget'; // We will create this component

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="hero min-h-[60vh] bg-base-200 rounded-box">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-primary">Dobrodošli u FrizNaKlik!</h1>
            <p className="py-6 text-lg">
              Vaša frizura iz snova je na samo par klikova od Vas. Brzo i lako zakažite svoj termin ili
              pregledajte naše usluge 
            </p>
            <Link href="/book" className="btn btn-primary btn-wide">
              <CalendarDays className="mr-2 h-5 w-5" /> Zakažite Termin
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Reserve Widget Section */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4">
            <Scissors className="mr-2 h-6 w-6 text-secondary" /> Brza Rezervacija za sutra
          </h2>
          <QuickReserveWidget />
        </div>
      </div>

      {/* Navigation Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/services" className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <ShoppingBag className="h-12 w-12 text-accent mb-2" />
            <h2 className="card-title">Naše Usluge</h2>
            <p>Pogledajte kompletnu ponudu naših usluga.</p>
          </div>
        </Link>

        <Link href="/book" className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <CalendarDays className="h-12 w-12 text-info mb-2" />
            <h2 className="card-title">Zakažite Termin</h2>
            <p>Odaberite uslugu i vreme koje Vam odgovara.</p>
          </div>
        </Link>

        <Link href="/chat" className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
          <div className="card-body items-center text-center">
            <MessageSquare className="h-12 w-12 text-success mb-2" />
            <h2 className="card-title">AI Asistent</h2>
            <p>Postavite pitanje ili zatražite pomoć.</p>
          </div>
        </Link>

        <SignedIn>
          <Link href="/dashboard" className="card bg-base-100 shadow-md hover:shadow-xl transition-shadow">
            <div className="card-body items-center text-center">
              <LayoutDashboard className="h-12 w-12 text-warning mb-2" />
              <h2 className="card-title">Vaš Panel</h2>
              <p>Pregledajte i upravljajte Vašim terminima.</p>
            </div>
          </Link>
        </SignedIn>
        <SignedOut>
          <div className="card bg-base-100 shadow-md">
            <div className="card-body items-center text-center">
              <LayoutDashboard className="h-12 w-12 text-base-content/30 mb-2" />
              <h2 className="card-title text-base-content/50">Vaš Panel</h2>
              <p className="text-base-content/50">Prijavite se da vidite Vaše termine.</p>
               <Link href="/sign-in" className="btn btn-outline btn-sm mt-2">Prijavi se</Link>
            </div>
          </div>
        </SignedOut>
      </div>
    </div>
  );
}