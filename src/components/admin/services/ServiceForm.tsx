'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Service } from '@prisma/client';
import { AlertTriangle, XCircle, Save, Plus } from 'lucide-react'; 

interface ServiceFormProps {
  initialData?: Service;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ServiceForm({ initialData, onSuccess, onCancel }: ServiceFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setDuration(initialData.duration?.toString() || '');
      setPrice(initialData.price?.toString() || '');
    } else {
      setName('');
      setDescription('');
      setDuration('');
      setPrice('');
    }
    setError(null); 
  }, [initialData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!name.trim() || !duration.trim() || !price.trim()) {
      setError('Naziv usluge, trajanje i cena su obavezna polja.');
      setIsLoading(false);
      return;
    }

    const durationNum = parseInt(duration, 10);
    const priceNum = parseFloat(price.replace(',', '.')); 

    if (isNaN(durationNum) || durationNum <= 0) {
      setError('Molimo unesite validno pozitivno trajanje u minutima.');
      setIsLoading(false);
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Molimo unesite validnu nenegativnu cenu.');
      setIsLoading(false);
      return;
    }

    const serviceData = {
      name: name.trim(),
      description: description.trim() || null,
      duration: durationNum,
      price: priceNum,
    };

    const apiEndpoint = isEditing ? `/api/admin/services/${initialData?.id}` : '/api/admin/services';
    const httpMethod = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(apiEndpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Zahtev nije uspeo: Status ${response.status}` }));
        throw new Error(errorData.message || `Došlo je do greške pri komunikaciji sa serverom.`);
      }

        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh(); 
          if (!isEditing) {
            router.push('/admin/services'); 
          }
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Došlo je do nepoznate greške.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6"> 
      {error && (
        <div role="alert" className="alert alert-error shadow-md">
          <AlertTriangle className="h-6 w-6" />
          <span>{error}</span>
        </div>
      )}
      <label className="form-control w-full">
        <div className="label">
          <span className="label-text text-base-content font-medium">Naziv usluge</span> 
          <span className="label-text-alt text-error">* Obavezno</span>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="npr. Muško šišanje"
          className={`input input-bordered w-full ${error && !name.trim() ? 'input-error' : 'focus:input-primary'}`}
          required
        />
      </label>

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text text-base-content font-medium">Opis (Opciono)</span>
        </div>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setError(null); }}
          placeholder="Detaljan opis usluge (npr. uključuje pranje, masažu...)"
          className="textarea textarea-bordered w-full h-28 focus:textarea-primary" 
          rows={4}
        ></textarea>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6"> 
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-base-content font-medium">Trajanje (minuti)</span>
            <span className="label-text-alt text-error">* Obavezno</span>
          </div>
          <input
            type="number"
            value={duration}
            onChange={(e) => { setDuration(e.target.value); setError(null);  }}
            placeholder="npr. 30"
            className={`input input-bordered w-full ${error && (!duration.trim() || parseInt(duration) <=0) ? 'input-error' : 'focus:input-primary'}`}
            required
            min="1"
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-base-content font-medium">Cena (RSD)</span>
            <span className="label-text-alt text-error">* Obavezno</span>
          </div>
          <input
            type="text" 
            value={price}
            onChange={(e) => { setPrice(e.target.value); setError(null); }}
            placeholder="npr. 1500.00 ili 1500,00"
            className={`input input-bordered w-full ${error && (!price.trim() || parseFloat(price.replace(',', '.')) < 0) ? 'input-error' : 'focus:input-primary'}`}
            required
          />
        </label>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-3 mt-8"> 
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost w-full sm:w-auto" disabled={isLoading}>
            <XCircle className="h-5 w-5 mr-1" />
            Otkaži
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full sm:w-auto"
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            isEditing ? <><Save className="h-5 w-5 mr-2" />Sačuvaj izmene</> : <><Plus className="h-5 w-5 mr-2" />Dodaj uslugu</>
          )}
        </button>
      </div>
    </form>
  );
}