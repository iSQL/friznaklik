import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Welcome to the Haircut Appointment App</h1>
      <p className="mb-4">Book your next haircut with ease.</p>
      <Link href="/services" className="text-blue-500 hover:underline">
        View Services
      </Link>
      <button className="btn btn-soft">Default</button>
<button className="btn btn-soft btn-primary">Primary</button>
<button className="btn btn-soft btn-secondary">Secondary</button>
<button className="btn btn-soft btn-accent">Accent</button>
<button className="btn btn-soft btn-info">Info</button>
<button className="btn btn-soft btn-success">Success</button>
<button className="btn btn-soft btn-warning">Warning</button>
<button className="btn btn-soft btn-error">Error</button>
      
      

    </div>
  );
}
