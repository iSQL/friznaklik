'use client'; // This directive marks this as a Client Component

import { useState, FormEvent } from 'react'; // Import React hooks
import { useRouter } from 'next/navigation'; // Import Next.js router for navigation/revalidation
import { Service } from '@prisma/client'; // Import the Service type (optional, but good for typing initial data)

// Define the props for the ServiceForm component
interface ServiceFormProps {
  // Optional: Pass initial data for editing an existing service
  initialData?: Service;
  // Optional: Callback function to execute after successful submission (e.g., close a modal)
  onSuccess?: () => void;
}

// This Client Component renders a form for adding or editing a service.
export default function ServiceForm({ initialData, onSuccess }: ServiceFormProps) {
  // State to manage form inputs
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [duration, setDuration] = useState(initialData?.duration.toString() || ''); // Duration as string initially for input
  const [price, setPrice] = useState(initialData?.price.toString() || ''); // Price as string initially for input
  const [isLoading, setIsLoading] = useState(false); // State to indicate loading/submitting status
  const [error, setError] = useState<string | null>(null); // State to store submission errors

  const router = useRouter(); // Get the Next.js router instance

  // Determine if the form is for editing or adding based on initialData
  const isEditing = !!initialData;

  // Handle form submission
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default browser form submission

    setIsLoading(true); // Set loading state
    setError(null); // Clear previous errors

    // Basic validation
    if (!name || !duration || !price) {
      setError('Please fill in all required fields.');
      setIsLoading(false);
      return;
    }

    // Convert duration and price to numbers
    const durationNum = parseInt(duration, 10);
    const priceNum = parseFloat(price);

    if (isNaN(durationNum) || isNaN(priceNum) || durationNum <= 0 || priceNum < 0) {
       setError('Please enter valid numbers for duration and price.');
       setIsLoading(false);
       return;
    }


    // Prepare the data to be sent to the API
    const serviceData = {
      name,
      description: description || null, // Send null if description is empty
      duration: durationNum,
      price: priceNum,
    };

    // Determine the API endpoint and HTTP method based on whether we are editing or adding
    const apiEndpoint = isEditing ? `/api/admin/services/${initialData.id}` : '/api/admin/services';
    const httpMethod = isEditing ? 'PUT' : 'POST';

    try {
      // Make the API call
      // Similar to making an HttpClient request in .NET
      const response = await fetch(apiEndpoint, {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData),
      });

      // Handle the API response
      if (!response.ok) {
        // If the response is not OK, throw an error with the status
        const errorData = await response.json(); // Attempt to get error details from the response body
        throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }

      // If the submission was successful
      console.log('Service saved successfully!');
      // Execute the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      } else {
        // If no onSuccess callback, navigate back to the services list or redirect
        // router.push('/admin/services'); // Navigate to the services list page
        router.refresh(); // Revalidate the data on the current page (if used in a modal/same page)
        // Or if this is on a dedicated /new page, you might redirect:
         if (!isEditing) { // Only redirect after adding a new service
             router.push('/admin/services');
         }
      }

    } catch (err) {
      // Handle errors during the fetch call or from the API response
      console.error('Error saving service:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      // Always set loading state back to false after the request is complete
      setIsLoading(false);
    }
  };

  return (
    // Render the form
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display error message if there is one */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Service Name Input */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Service Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required // Make this field required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      {/* Service Description Input (Optional) */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description (Optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3} // Set number of visible rows
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        ></textarea>
      </div>

      {/* Service Duration Input */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
          Duration (minutes)
        </label>
        <input
          type="number" // Use type="number" for numeric input
          id="duration"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
          min="1" // Duration should be at least 1 minute
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      {/* Service Price Input */}
      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Price ($) {/* Adjust currency symbol */}
        </label>
        <input
          type="number" // Use type="number" for numeric input
          id="price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          min="0" // Price can be 0 or more
          step="0.01" // Allow decimal values for price
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isLoading} // Disable button while loading
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isLoading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {isLoading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Service')}
        </button>
      </div>
    </form>
  );
}
