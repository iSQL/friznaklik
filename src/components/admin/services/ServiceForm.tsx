'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Service } from '@prisma/client';

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
    }
  }, [initialData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!name.trim() || !duration.trim() || !price.trim()) {
      setError('Name, duration, and price are required.');
      setIsLoading(false);
      return;
    }

    const durationNum = parseInt(duration, 10);
    const priceNum = parseFloat(price);

    if (isNaN(durationNum) || durationNum <= 0) {
      setError('Please enter a valid positive number for duration.');
      setIsLoading(false);
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid non-negative number for price.');
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
        const errorData = await response.json().catch(() => ({ message: `Request failed with status ${response.status}` }));
        throw new Error(errorData.message || `API request failed`);
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
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      )}

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text text-base-content">Service Name</span>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Men's Haircut"
          className="input input-bordered w-full"
          required
        />
      </label>

      <label className="form-control w-full">
        <div className="label">
          <span className="label-text text-base-content">Description (Optional)</span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed description of the service"
          className="textarea textarea-bordered w-full h-24"
          rows={3}
        ></textarea>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-base-content">Duration (minutes)</span>
          </div>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g., 30"
            className="input input-bordered w-full"
            required
            min="1"
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text text-base-content">Price</span>
          </div>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g., 25.00"
            className="input input-bordered w-full"
            required
            min="0"
            step="0.01"
          />
        </label>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? (
            <span className="loading loading-spinner"></span>
          ) : (
            isEditing ? 'Save Changes' : 'Add Service'
          )}
        </button>
      </div>
    </form>
  );
}
