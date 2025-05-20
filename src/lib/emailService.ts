// src/lib/emailService.ts
import { Resend } from 'resend';
import { formatErrorMessage } from './errorUtils';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const NODE_ENV = process.env.NODE_ENV; // Access Node environment

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  // Log warning only if not in a test environment where keys might be intentionally missing
  if (NODE_ENV !== 'test') {
    console.warn('RESEND_API_KEY is not set. Email notifications via Resend will be disabled.');
  }
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const isDev = NODE_ENV === 'development';

  if (isDev) {
    console.log("--------------------------------------------------");
    console.log("📧 RAZVOJNI REŽIM: Preskače se slanje emaila.");
    console.log(`👤 Za: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`🏷️ Naslov: ${options.subject}`);
    console.log("📄 HTML Sadržaj (isečak):");
    console.log(options.html.substring(0, 300) + (options.html.length > 300 ? "..." : "")); // Display a snippet
    // Možete dodati i console.log(options.html) ako želite ceo HTML u konzoli, ali može biti predugačko.
    if (options.text) {
      console.log("📄 Tekstualni Sadržaj (isečak):");
      console.log(options.text.substring(0, 200) + (options.text.length > 200 ? "..." : ""));
    }
    console.log("--------------------------------------------------");
    // U razvojnom režimu, nećemo ni pokušavati da kontaktiramo Resend.
    // Možete odlučiti da li želite da simulirate uspeh ili grešku ovde ako je potrebno za testiranje.
    return Promise.resolve(); // Simuliramo uspešno "slanje" (tj. logovanje)
  }

  // Produkcijski režim (ili bilo koji drugi koji nije 'development')
  if (!resend || !RESEND_FROM_EMAIL) {
    const errorMessage = "Resend API Key or From Email not configured. Email not sent in production.";
    console.error(errorMessage);
    // U produkciji, verovatno želite da ova greška bude vidljivija ili da se baci izuzetak
    throw new Error(errorMessage);
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `FrizNaKlik <${RESEND_FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error("Resend API Error object:", JSON.stringify(error, null, 2));
      throw error; // Bacamo originalni Resend error objekat da bi ga formatErrorMessage obradio
    }

    console.log(`Email sent successfully via Resend to ${options.to}. Message ID: ${data?.id}`);
  } catch (error: unknown) {
    // Koristimo centralizovani error formatter
    const userFriendlyError = formatErrorMessage(error, `slanja emaila putem Resend na ${options.to}`);
    console.error(`Failed to send email via Resend: ${userFriendlyError}`);
    // U produkciji, ovo bi trebalo da bude praćeno (npr. Sentry)
    throw new Error(userFriendlyError); // Ponovo bacamo grešku da bi pozivalac mogao da je obradi
  }
}
