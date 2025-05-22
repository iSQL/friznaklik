import { NextPage } from 'next';

export const metadata = {
  title: 'Politika privatnosti - FrizNaKlik',
  description: 'Politika privatnosti aplikacije FrizNaKlik.',
};

const PolitikaPrivatnostiPage: NextPage = () => {
  return (
    <>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Politika privatnosti aplikacije &quot;FrizNaKlik&quot;</h1>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">1. Uvod</h2>
          <p className="mb-2">
            Ova Politika privatnosti (u daljem tekstu: &quot;Politika&quot;) opisuje kako FrizNaKlik tim
            (u daljem tekstu: &quot;Mi&quot;, &quot;Nas&quot; ili &quot;Naš&quot;) prikuplja, koristi, otkriva i štiti Vaše lične podatke
            prilikom korišćenja mobilne aplikacije FrizNaKlik (u daljem tekstu: &quot;Aplikacija&quot;).
          </p>
          <p>
            Vaša privatnost nam je izuzetno važna. Molimo Vas da pažljivo pročitate ovu Politiku kako biste
            razumeli naše prakse u vezi sa Vašim ličnim podacima. Korišćenjem Aplikacije, saglasni ste sa
            prikupljanjem i korišćenjem informacija u skladu sa ovom Politikom.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">2. Koje Podatke Prikupljamo</h2>
          <p className="mb-2">Možemo prikupljati sledeće vrste ličnih podataka:</p>
          <ul className="list-disc list-inside mb-2 pl-4">
            <li>
              <strong>Podaci koje direktno pružate:</strong>
              <ul className="list-circle list-outside ml-8">
                <li>Prilikom registracije: ime i prezime, email adresa, broj telefona, lozinka.</li>
                <li>Prilikom zakazivanja termina: odabrani salon, usluga, datum i vreme termina.</li>
                <li>Prilikom komunikacije sa nama ili salonima putem Aplikacije: sadržaj Vaših poruka.</li>
              </ul>
            </li>
            <li>
              <strong>Podaci koji se automatski prikupljaju:</strong>
              <ul className="list-circle list-outside ml-8">
                <li>Podaci o korišćenju Aplikacije: informacije o Vašim interakcijama sa Aplikacijom, kao što su pregledane stranice, korišćene funkcije, vreme provedeno u Aplikaciji.</li>
                <li>Tehnički podaci: IP adresa, tip uređaja, operativni sistem, jedinstveni identifikatori uređaja, informacije o mobilnoj mreži.</li>
                <li>Podaci o lokaciji: ukoliko nam date dozvolu, možemo prikupljati podatke o Vašoj približnoj ili tačnoj lokaciji kako bismo Vam prikazali salone u blizini.</li>
              </ul>
            </li>
            <li>
              <strong>Podaci iz drugih izvora:</strong>
              <ul className="list-circle list-outside ml-8">
                <li>Ukoliko se prijavljujete putem trećih strana (npr. Google, Facebook), možemo primiti određene podatke sa Vašeg naloga na tim platformama, u skladu sa Vašim podešavanjima privatnosti na tim platformama.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">3. Kako Koristimo Vaše Podatke</h2>
          <p className="mb-2">Vaše lične podatke koristimo u sledeće svrhe:</p>
          <ul className="list-disc list-inside mb-2 pl-4">
            <li>Omogućavanje i pružanje funkcionalnosti Aplikacije (npr. kreiranje naloga, zakazivanje termina, komunikacija).</li>
            <li>Personalizacija Vašeg iskustva u Aplikaciji.</li>
            <li>Komunikacija sa Vama u vezi sa Vašim nalogom, zakazanim terminima ili drugim upitima.</li>
            <li>Slanje administrativnih informacija, kao što su promene naših uslova ili politika.</li>
            <li>Poboljšanje i razvoj Aplikacije, uključujući analizu korišćenja i identifikaciju trendova.</li>
            <li>Obezbeđivanje sigurnosti Aplikacije i sprečavanje prevara.</li>
            <li>Ispunjavanje zakonskih obaveza.</li>
            <li>Uz Vašu saglasnost, za slanje marketinških materijala o našim uslugama ili uslugama naših partnera.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">4. Deljenje Vaših Podataka</h2>
          <p className="mb-2">Vaše lične podatke možemo deliti sa sledećim stranama:</p>
          <ul className="list-disc list-inside mb-2 pl-4">
            <li>
              <strong>Frizerski saloni:</strong> Kada zakažete termin, Vaše ime, kontakt informacije i detalji termina biće podeljeni sa odabranim salonom.
            </li>
            <li>
              <strong>Pružaoci usluga trećih strana:</strong> Koristimo usluge trećih strana koje nam pomažu u radu Aplikacije (npr. hosting provajderi, analitičke platforme, platforme za korisničku podršku, provajderi platnih usluga ako ih imaš). Ove treće strane imaju pristup Vašim podacima samo u meri u kojoj je to neophodno za obavljanje njihovih usluga i obavezni su da čuvaju poverljivost Vaših podataka.
            </li>
            <li>
              <strong>Pravni zahtevi:</strong> Možemo otkriti Vaše podatke ukoliko je to potrebno radi poštovanja zakona, sudskog naloga ili drugog pravnog procesa.
            </li>
            <li>
              <strong>Poslovni transferi:</strong> U slučaju spajanja, akvizicije, reorganizacije, prodaje imovine ili bankrota, Vaši podaci mogu biti preneti kao deo te transakcije. O tome ćemo Vas obavestiti.
            </li>
            <li>
              <strong>Uz Vašu saglasnost:</strong> Možemo deliti Vaše podatke sa drugim trećim stranama uz Vašu prethodnu saglasnost.
            </li>
          </ul>
          <p>
            Ne prodajemo Vaše lične podatke trećim licima.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">5. Sigurnost Podataka</h2>
          <p className="mb-2">
            Preduzimamo razumne tehničke i organizacione mere kako bismo zaštitili Vaše lične podatke od
            neovlašćenog pristupa, korišćenja, izmene ili uništavanja. Međutim, nijedan metod prenosa
            putem interneta ili metod elektronskog skladištenja nije 100% siguran. Stoga, iako se trudimo
            da koristimo komercijalno prihvatljiva sredstva za zaštitu Vaših ličnih podataka, ne možemo
            garantovati njihovu apsolutnu sigurnost.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">6. Vaša Prava</h2>
          <p className="mb-2">U skladu sa važećim zakonima o zaštiti podataka, imate sledeća prava:</p>
          <ul className="list-disc list-inside mb-2 pl-4">
            <li><strong>Pravo na pristup:</strong> Imate pravo da zatražite kopiju ličnih podataka koje imamo o Vama.</li>
            <li><strong>Pravo na ispravku:</strong> Imate pravo da zatražite ispravku netačnih ili nepotpunih ličnih podataka.</li>
            <li><strong>Pravo na brisanje (&quot;pravo na zaborav&quot;):</strong> Imate pravo da zatražite brisanje Vaših ličnih podataka pod određenim uslovima.</li>
            <li><strong>Pravo na ograničenje obrade:</strong> Imate pravo da zatražite ograničenje obrade Vaših ličnih podataka pod određenim uslovima.</li>
            <li><strong>Pravo na prenosivost podataka:</strong> Imate pravo da dobijete lične podatke koje ste nam pružili u strukturiranom, uobičajeno korišćenom i mašinski čitljivom formatu, i da te podatke prenesete drugom kontroloru.</li>
            <li><strong>Pravo na prigovor:</strong> Imate pravo da uložite prigovor na obradu Vaših ličnih podataka pod određenim uslovima, uključujući obradu za direktni marketing.</li>
            <li><strong>Pravo na povlačenje saglasnosti:</strong> Ukoliko se obrada podataka zasniva na Vašoj saglasnosti, imate pravo da povučete saglasnost u bilo kom trenutku, bez uticaja na zakonitost obrade pre povlačenja.</li>
            <li><strong>Pravo na podnošenje žalbe nadzornom organu:</strong> Imate pravo da podnesete žalbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti.</li>
          </ul>
          <p>
            Za ostvarivanje ovih prava, molimo Vas da nas kontaktirate putem informacija navedenih u odeljku &quot;Kontakt Informacije&quot;.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">7. Čuvanje Podataka</h2>
          <p>
            Vaše lične podatke čuvamo onoliko dugo koliko je potrebno za ispunjenje svrha navedenih u ovoj
            Politici, osim ako duži period čuvanja nije zahtevan ili dozvoljen zakonom. Kada Vaši podaci
            više nisu potrebni, bezbedno ćemo ih obrisati ili anonimizovati.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">8. Privatnost Dece</h2>
          <p>
            Aplikacija nije namenjena deci mlađoj od [Navesti Uzrast, npr. 16] godina. Svesno ne prikupljamo
            lične podatke od dece mlađe od ovog uzrasta. Ukoliko postanemo svesni da smo prikupili lične
            podatke od deteta bez saglasnosti roditelja ili staratelja, preduzećemo korake da te podatke
            uklonimo. Ako ste roditelj ili staratelj i smatrate da nam je Vaše dete pružilo lične podatke,
            molimo Vas da nas kontaktirate.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">9. Linkovi ka Drugim Veb Stranicama</h2>
          <p>
            Aplikacija može sadržati linkove ka drugim veb stranicama ili servisima koji nisu pod našom
            kontrolom. Nismo odgovorni za prakse privatnosti tih trećih strana. Preporučujemo Vam da
            pročitate politike privatnosti svake veb stranice koju posetite.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">10. Izmene Ove Politike Privatnosti</h2>
          <p>
            Zadržavamo pravo da s vremena na vreme ažuriramo ovu Politiku. Obavestićemo Vas o svim
            značajnim promenama objavljivanjem nove Politike na ovoj stranici i/ili putem obaveštenja
            u Aplikaciji. Preporučujemo Vam da periodično pregledate ovu Politiku radi najnovijih
            informacija o našim praksama privatnosti. Promene ove Politike stupaju na snagu kada
            su objavljene na ovoj stranici.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">11. Kontakt Informacije</h2>
          <p>
            Ukoliko imate bilo kakvih pitanja, komentara ili zahteva u vezi sa ovom Politikom privatnosti
            ili našim praksama obrade podataka, molimo Vas da nas kontaktirate putem:
            <br />
            Email: kontakt@friznaklik.com
            <br />
            FrizNaKlik tim
          </p>
        </section>

        <p className="mt-8 text-sm text-gray-600">
          Datum poslednje izmene: 14. maj 2025.
        </p>
      </main>
    </>
  );
};

export default PolitikaPrivatnostiPage;