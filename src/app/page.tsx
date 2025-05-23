import Link from 'next/link';
import {  CalendarDays, Scissors } from 'lucide-react';
import QuickReserveWidget from '@/components/QuickReserveWidget'; 

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

    </div>
  );
}