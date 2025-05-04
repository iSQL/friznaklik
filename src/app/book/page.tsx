// src/app/book/page.tsx
'use client'; // This directive marks this as a Client Component

import { useBookingStore } from '@/store/bookingStore'; // Import the Zustand booking store
import { useState, useEffect } from 'react'; // Import React hooks
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import Link from 'next/link'; // Import Link for navigation (e.g., back to home)

// Import react-datepicker and its CSS
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Define the base URL for your API.
// Use NEXT_PUBLIC_SITE_URL which should be set in your .env file (e.g., http://localhost:3000)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// This Client Component page handles the appointment booking flow.
export default function BookingPage() {
  // Access state and actions from the Zustand store
  const {
    selectedServiceId,
    selectedDate,
    availableSlots,
    selectedSlot, // Get selectedSlot from the store
    bookingStatus, // Get bookingStatus from the store
    bookingError, // Get bookingError from the store
    selectService,
    selectDate,
    setAvailableSlots,
    selectSlot, // Get selectSlot action
    setBookingStatus, // Get setBookingStatus action
    setBookingError, // Get setBookingError action
    resetBooking
  } = useBookingStore();

  // State to hold the list of available services fetched from the API
  const [services, setServices] = useState<Service[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // State to track loading of available slots
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);


  // Fetch the list of services when the component mounts
  useEffect(() => {
    const fetchServices = async () => {
      setIsLoadingServices(true);
      setServicesError(null);
      try {
        // Fetch services from your public backend API
        const response = await fetch(`${SITE_URL}/api/services`);
        if (!response.ok) {
           const errorText = await response.text();
           throw new Error(`Failed to fetch services: ${response.status} ${errorText}`);
        }
        const data: Service[] = await response.json(); // Assuming the API returns an array of Service objects
        setServices(data);
      } catch (err: any) {
        console.error('Error fetching services:', err);
        setServicesError(err.message || 'Failed to load services.');
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();

    // Clean up the booking state when the component unmounts (optional, but good practice)
    // return () => {
    //   resetBooking();
    // };

  }, []); // Empty dependency array means this effect runs only once on mount


  // Fetch available slots when selectedServiceId or selectedDate changes
  useEffect(() => {
    // Only fetch if both a service and a date are selected
    if (selectedServiceId && selectedDate) {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]); // Clear previous slots

        try {
          // Fetch available slots from the backend API route
          const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedServiceId}&date=${selectedDate.toISOString().split('T')[0]}`); // Pass serviceId and date as query params
          if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Failed to fetch available slots: ${response.status} ${errorText}`);
          }
          const data: string[] = await response.json(); // Assuming the API returns an array of time strings (HH:mm)
          setAvailableSlots(data);
        } catch (err: any) {
          console.error('Error fetching available slots:', err);
          setSlotsError(err.message || 'Failed to load available slots.');
        } finally {
          setIsLoadingSlots(false);
        }
      };

      fetchAvailableSlots();
    } else {
        // If service or date is not selected, clear available slots
        setAvailableSlots([]);
        selectSlot(null); // Also clear selected slot
    }

  }, [selectedServiceId, selectedDate, setAvailableSlots, selectSlot]); // Re-run when serviceId or date changes


  // Handle service selection click
  const handleServiceSelect = (serviceId: string) => {
    selectService(serviceId); // Update the selectedServiceId in the store
  };

  // Handle date selection from the calendar
  const handleDateSelect = (date: Date | null) => {
    selectDate(date); // Update the selectedDate in the store
  };

  // Handle time slot selection
  const handleSlotSelect = (slot: string) => {
      selectSlot(slot); // Update the selectedSlot in the store
  };

  // Implement the booking submission logic
  const handleBookingSubmit = async () => {
      if (!selectedServiceId || !selectedDate || !selectedSlot) {
          console.error("Attempted booking without all required selections.");
          return; // Should not happen if button is disabled correctly
      }

      setBookingStatus('submitting');
      setBookingError(null);

      try {
          // Call the backend API to submit the booking request
          // This will hit your src/app/api/appointments/route.ts POST handler
          const response = await fetch(`${SITE_URL}/api/appointments`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  serviceId: selectedServiceId,
                  date: selectedDate.toISOString().split('T')[0], // Send date as YYYY-MM-DD string
                  slot: selectedSlot, // Send selected time slot string (HH:mm)
              }),
          });

          if (!response.ok) {
              const errorData = await response.json(); // Assuming API returns JSON error
              throw new Error(errorData.message || `Booking failed with status ${response.status}`);
          }

          // If booking was successful
          setBookingStatus('success');
          console.log('Appointment requested successfully!');
          // Optionally reset the booking flow after success
          // resetBooking(); // You might want the success message to stay for a bit

      } catch (err: any) {
          setBookingStatus('error');
          setBookingError(err.message || 'An unknown error occurred during booking.');
          console.error('Booking submission error:', err);
      }
  };


  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Book an Appointment</h1>

      {/* Step 1: Service Selection */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Select a Service</h2>
        {isLoadingServices ? (
          <p>Loading services...</p>
        ) : servicesError ? (
          <p className="text-red-600">Error loading services: {servicesError}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                // Apply Tailwind classes for styling and selection state
                className={`p-4 border rounded-md cursor-pointer hover:border-blue-500 transition-colors ${
                  selectedServiceId === service.id ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'
                }`}
                onClick={() => handleServiceSelect(service.id)} // Call handler on click
              >
                <h3 className="text-lg font-bold">{service.name}</h3>
                <p className="text-gray-600 text-sm mb-2">{service.description}</p>
                <p className="text-gray-800 font-semibold">${service.price.toFixed(2)} - {service.duration} min</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Date Selection */}
      {selectedServiceId && ( // Only show date selection if a service is selected
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Select a Date</h2>
          <div className="border p-4 rounded-md inline-block"> {/* Use inline-block to wrap the date picker */}
             {/* React DatePicker Component */}
             <DatePicker
                selected={selectedDate} // Currently selected date from store
                onChange={handleDateSelect} // Call handler when date is selected
                dateFormat="yyyy/MM/dd" // Date format
                minDate={new Date()} // Prevent selecting past dates
                // You can add more props here for customization, e.g.,
                // filterDate={(date) => isWeekday(date)} // Example: Only allow weekdays
                // highlightDates={highlightedDates} // Example: Highlight specific dates
             />
          </div>
        </div>
      )}

      {/* Step 3: Time Slot Selection */}
      {selectedDate && ( // Only show time slot selection if a date is selected
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Select a Time Slot</h2>
          {isLoadingSlots ? (
             <p>Loading available slots...</p>
          ) : slotsError ? (
             <p className="text-red-600">Error loading slots: {slotsError}</p>
          ) : availableSlots.length === 0 ? (
             <p className="text-gray-600">No available slots for the selected date.</p>
          ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableSlots.map(slot => (
                   <button
                      key={slot}
                       className={`p-3 border rounded-md text-center transition-colors ${
                          selectedSlot === slot ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                       }`}
                      onClick={() => handleSlotSelect(slot)} // Call handler on click
                   >
                      {slot}
                   </button>
                ))}
             </div>
          )}
        </div>
      )}

      {/* Booking Button */}
      {selectedSlot && ( // Only show button if a slot is selected
         <div>
            {/* Call handleBookingSubmit when the button is clicked */}
            <button
               onClick={handleBookingSubmit} // Uncommented the onClick handler
               className={`bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-md ${
                  bookingStatus === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''
               }`}
               disabled={bookingStatus === 'submitting'}
            >
               {bookingStatus === 'submitting' ? 'Requesting...' : 'Request Appointment'}
            </button>
            {bookingStatus === 'success' && <p className="text-green-600 mt-2">Appointment requested successfully!</p>}
            {bookingStatus === 'error' && <p className="text-red-600 mt-2">Booking failed: {bookingError}</p>}
         </div>
      )}


      {/* Optional: Back to Home Link */}
      <div className="mt-8">
        <Link href="/" className="text-indigo-600 hover:text-indigo-900">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
