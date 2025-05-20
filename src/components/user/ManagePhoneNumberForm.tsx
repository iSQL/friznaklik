// src/components/user/ManagePhoneNumberForm.tsx
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Phone, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatErrorMessage } from '@/lib/errorUtils';

interface ManagePhoneNumberFormProps {
  initialPhoneNumber: string | null;
  userId: string; 
}

export default function ManagePhoneNumberForm({ initialPhoneNumber }: ManagePhoneNumberFormProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setPhoneNumber(initialPhoneNumber || '');
  }, [initialPhoneNumber]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/user/update-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() === '' ? null : phoneNumber.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw { message: data.message || `Greška: ${response.status}`, details: data.errors };
      }

      setSuccessMessage(data.message || 'Broj telefona uspešno sačuvan!');

    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'čuvanja broja telefona'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-lg border border-base-300/50 w-full max-w-md">
      <div className="card-body p-6">
        <h2 className="card-title text-xl mb-4 text-primary flex items-center">
          <Phone className="h-5 w-5 mr-2" />
          Vaš Broj Telefona
        </h2>
        <p className="text-xs text-base-content/70 mb-1">
          Unesite vaš broj telefona kako bismo mogli da vam šaljemo obaveštenja o terminima (npr. SMS podsetnike u budućnosti).
        </p>
        <p className="text-xs text-info mb-4">
          Ovo se koristi isključivo za potrebe podsetnika za rezervisane termine.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label htmlFor="phoneNumber" className="label">
              <span className="label-text">Broj telefona</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Npr. 0601234567"
              className="input input-bordered w-full focus:input-primary"
              disabled={isLoading}
            />
            <label className="label">
                <span className="label-text-alt">Ostavite prazno ako želite da uklonite broj.</span>
            </label>
          </div>

          {error && (
            <div role="alert" className="alert alert-error text-xs p-2">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div role="alert" className="alert alert-success text-xs p-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="card-actions justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Čuvanje...
                </>
              ) : (
                'Sačuvaj Broj Telefona'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
