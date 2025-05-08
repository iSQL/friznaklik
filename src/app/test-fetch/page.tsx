// src/app/test-fetch/page.tsx
console.log('--- Loading /test-fetch/page.tsx ---'); // Debug log at the top of the file

// This is a simple Server Component Page for testing server-side fetches.

// Use PUBLIC_SITE_URL for the base URL, as configured in your .env
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default async function TestFetchPage() {
  const apiUrl = `http://localhost:3000/api/test`; // Construct the URL for the test API route

  console.log('TestFetchPage: Attempting to fetch from URL:', apiUrl); // Debug log

  let message = 'Fetching data...';
  let error = null;

  try {
    // Perform the server-side fetch to the test API route
    const res = await fetch(apiUrl, {
      cache: 'no-store', // Ensure fresh data
    });

    console.log('TestFetchPage: Fetch response status:', res.status); // Debug log

    if (!res.ok) {
      // If the response is not OK, read the error body if available
      const errorBody = await res.text(); // Read as text in case it's not JSON
      throw new Error(`Fetch failed with status ${res.status}: ${errorBody}`);
    }

    // Parse the JSON response
    const data = await res.json();
    message = data.message || 'Fetch successful, but no message received.'; // Get the message from the API response

    console.log('TestFetchPage: Fetch successful, data:', data); // Debug log

  } catch (fetchError: any) {
    console.error('TestFetchPage: Error during fetch:', fetchError); // Debug log
    error = `Error fetching data: ${fetchError.message}`;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Server-Side Fetch Test Page</h1>
      {error ? (
        // Display error message if fetch failed
        <p className="text-red-600">Error: {error}</p>
      ) : (
        // Display the message from the API if fetch was successful
        <p className="text-green-600">API Response: {message}</p>
      )}
      <p className="mt-4">This page is a Server Component fetching data from <code>/api/test</code>.</p>
    </div>
  );
}
