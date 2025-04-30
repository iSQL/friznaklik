import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Welcome to the Haircut Appointment App</h1>
      <p className="mb-4">Book your next haircut with ease.</p>
      <Link href="/services" className="text-blue-500 hover:underline">
        View Services
      </Link>
    </div>
  );
}
