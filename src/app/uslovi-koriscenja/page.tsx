import { NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';

const UsloviKoriscenjaPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Uslovi korišćenja - FrizNaKlik</title>
        <meta name="description" content="Uslovi korišćenja aplikacije FrizNaKlik." />
      </Head>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Uslovi korišćenja aplikacije &quot;FrizNaKlik&quot;</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">1. Uvod</h2>
          <p className="mb-2">
            Dobrodošli u FrizNaKlik (u daljem tekstu: &quot;Aplikacija&quot;). Pristupanjem i korišćenjem Aplikacije,
            slažete se sa ovim Uslovima korišćenja (u daljem tekstu: &quot;Uslovi&quot;). Ukoliko se ne slažete sa
            Uslovima, molimo Vas da ne koristite Aplikaciju.
          </p>
          <p>
            Ovi Uslovi predstavljaju pravno obavezujući ugovor između Vas (u daljem tekstu: &quot;Korisnik&quot; ili &quot;Vi&quot;)
            i FrizNaKlik tima (u daljem tekstu: &quot;Mi&quot;, &quot;Nas&quot; ili &quot;Naš&quot;).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">2. Korišćenje Aplikacije</h2>
          <p className="mb-2">
            Aplikacija FrizNaKlik omogućava korisnicima da pretražuju frizerske salone, zakazuju termine i komuniciraju sa salonima.
          </p>
          <p className="mb-2">
            Korisnik se obavezuje da će Aplikaciju koristiti u skladu sa važećim zakonima i ovim Uslovima.
            Zabranjeno je svako korišćenje Aplikacije koje može naneti štetu Aplikaciji, drugim korisnicima
            ili trećim licima.
          </p>
          <p className="mb-2">
            Za korišćenje određenih funkcionalnosti Aplikacije može biti potrebna registracija i kreiranje
            korisničkog naloga. Korisnik je odgovoran za tačnost podataka unetih prilikom registracije
            i za čuvanje poverljivosti svojih pristupnih podataka.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">3. Usluge i Zakazivanje</h2>
          <p className="mb-2">
            Aplikacija omogućava zakazivanje usluga kod frizerskih salona koji su partneri Aplikacije.
            Mi nismo direktni pružaoci frizerskih usluga. Svi uslovi vezani za konkretnu uslugu
            (cena, trajanje, otkazivanje) definišu se od strane frizerskog salona.
          </p>
          <p className="mb-2">
            Korisnik je odgovoran za poštovanje uslova zakazanog termina. U slučaju nemogućnosti dolaska,
            Korisnik je dužan da otkaže termin u skladu sa politikom otkazivanja salona.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">4. Intelektualna Svojina</h2>
          <p className="mb-2">
            Sav sadržaj dostupan u Aplikaciji, uključujući tekst, grafiku, logotipe, ikonice, slike,
            audio i video zapise, softver i kod, predstavlja intelektualnu svojinu Našu ili Naših partnera
            i zaštićen je zakonima o autorskim pravima i drugim zakonima o intelektualnoj svojini.
          </p>
          <p>
            Nije dozvoljeno kopiranje, distribucija, modifikacija, javno prikazivanje ili bilo koji drugi
            način korišćenja sadržaja Aplikacije bez Naše prethodne pismene saglasnosti.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">5. Ograničenje Odgovornosti</h2>
          <p className="mb-2">
            Aplikacija se pruža &quot;takva kakva jeste&quot; i &quot;kako je dostupna&quot;, bez bilo kakvih garancija,
            izričitih ili podrazumevanih. Ne garantujemo da će Aplikacija raditi bez prekida ili grešaka.
          </p>
          <p className="mb-2">
            Nismo odgovorni za bilo kakvu direktnu, indirektnu, slučajnu, posebnu ili posledičnu štetu
            koja može nastati kao rezultat korišćenja ili nemogućnosti korišćenja Aplikacije, uključujući
            ali ne ograničavajući se na gubitak profita, podataka ili druge nematerijalne gubitke.
          </p>
          <p>
            Nismo odgovorni za kvalitet usluga pruženih od strane frizerskih salona, niti za bilo kakve sporove
            koji mogu nastati između Korisnika i salona.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">6. Privatnost Podataka</h2>
          <p>
            Način na koji prikupljamo, koristimo i štitimo Vaše lične podatke opisan je u našoj{' '}
            <Link href="/politika-privatnosti" className="text-blue-600 hover:underline">
              Politici privatnosti
            </Link>
            , koja čini sastavni deo ovih Uslova.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">7. Izmene Uslova</h2>
          <p>
            Zadržavamo pravo da u bilo kom trenutku izmenimo ove Uslove. Sve izmene stupaju na snagu
            objavljivanjem na ovoj stranici ili putem obaveštenja u Aplikaciji. Vaše dalje korišćenje
            Aplikacije nakon objavljivanja izmena smatraće se prihvatanjem tih izmena. Preporučujemo
            Vam da redovno proveravate ovu stranicu radi uvida u eventualne promene.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">8. Prestanak Korišćenja</h2>
          <p>
            Zadržavamo pravo da, po sopstvenom nahođenju, suspendujemo ili ukinemo Vaš pristup Aplikaciji,
            bez prethodne najave, ukoliko smatramo da ste prekršili ove Uslove ili važeće zakone.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">9. Merodavno Pravo i Rešavanje Sporova</h2>
          <p>
            Ovi Uslovi se tumače i primenjuju u skladu sa zakonima Republike Srbije. U slučaju spora
            koji proistekne iz ovih Uslova ili korišćenja Aplikacije, nadležan je sud u Požarevcu.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">10. Kontakt Informacije</h2>
          <p>
            Ukoliko imate bilo kakvih pitanja u vezi sa ovim Uslovima, možete nas kontaktirati putem:
            <br />
            Email: kontakt@friznaklik.com
            <br />
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-600">
          Datum poslednje izmene: 14. maj 2025.
        </p>
      </main>
    </>
  );
};

export default UsloviKoriscenjaPage;