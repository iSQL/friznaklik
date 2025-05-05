// src/app/book/page.tsx
'use client'; // This directive marks this as a Client Component

import { useBookingStore } from '@/store/bookingStore'; // Import the Zustand booking store
import { useState, useEffect } from 'react'; // Import React hooks
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import Link from 'next/link'; // Import Link for navigation (e.g., back to home)

// Import react-datepicker and its CSS
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// *** Import format function from date-fns ***
import { format } from 'date-fns';

// Define the base URL for your API.
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
           // *** Use date-fns format for the date string ***
           const formattedDate = format(selectedDate, 'yyyy-MM-dd');
           console.log(`Fetching slots for service ${selectedServiceId} on date ${formattedDate}`); // Debug log

           // Fetch available slots from the backend API route
           const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedServiceId}&date=${formattedDate}`); // Pass serviceId and formatted date

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
          // *** Use date-fns format for the date string ***
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');

          // Call the backend API to submit the booking request
          const response = await fetch(`${SITE_URL}/api/appointments`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  serviceId: selectedServiceId,
                  date: formattedDate, // Send formatted date string
                  slot: selectedSlot, // Send selected time slot string (HH:mm)
              }),
          });

          if (!response.ok) {
              let errorMsg = `Booking failed with status ${response.status}`;
              try {
                 const errorData = await response.json(); // Try parsing JSON error
                 errorMsg = errorData.message || errorMsg;
              } catch {
                 // If response is not JSON, use text
                 const errorText = await response.text();
                 errorMsg = errorText || errorMsg;
              }
              throw new Error(errorMsg);
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
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Book an Appointment</h1>

      {/* Step 1: Service Selection */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 dark:text-gray-200">1. Select a Service</h2>
        {isLoadingServices ? (
          <p className="dark:text-gray-400">Loading services...</p>
        ) : servicesError ? (
          <p className="text-red-600">Error loading services: {servicesError}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                // Apply Tailwind classes for styling and selection state
                className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-all duration-200 dark:border-gray-700 ${
                  selectedServiceId === service.id
                    ? 'border-blue-500 ring-2 ring-blue-500/50 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-300 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600'
                }`}
                onClick={() => handleServiceSelect(service.id)} // Call handler on click
              >
                <h3 className="text-lg font-bold dark:text-white">{service.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">{service.description}</p>
                <p className="text-gray-800 dark:text-gray-200 font-semibold">${service.price.toFixed(2)} - {service.duration} min</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Date Selection */}
      {selectedServiceId && ( // Only show date selection if a service is selected
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 dark:text-gray-200">2. Select a Date</h2>
          {/* Apply some basic styling to the datepicker container */}
          <div className="p-4 border rounded-lg inline-block bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
             {/* React DatePicker Component */}
             <DatePicker
               selected={selectedDate} // Currently selected date from store
               onChange={handleDateSelect} // Call handler when date is selected
               dateFormat="yyyy/MM/dd" // Date format
               minDate={new Date()} // Prevent selecting past dates
               inline // Display the calendar inline
               className="react-datepicker-override" // Add a class for potential CSS overrides
             />
          </div>
          {/* Basic CSS override example (add to your global CSS or component style) */}
          <style jsx global>{`
            .react-datepicker {
              font-family: inherit; /* Use website font */
              border-color: #e5e7eb; /* Match border color */
            }
            .react-datepicker__header {
              background-color: #f3f4f6; /* Light gray header */
            }
            /* Add more overrides as needed */
          `}</style>
        </div>
      )}

      {/* Step 3: Time Slot Selection */}
      {selectedDate && ( // Only show time slot selection if a date is selected
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 dark:text-gray-200">3. Select a Time Slot</h2>
          {isLoadingSlots ? (
             <p className="dark:text-gray-400">Loading available slots...</p>
          ) : slotsError ? (
             <p className="text-red-600">Error loading slots: {slotsError}</p>
          ) : availableSlots.length === 0 ? (
             <p className="text-gray-600 dark:text-gray-400">No available slots for the selected date.</p>
          ) : (
             <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
               {availableSlots.map(slot => (
                  <button
                    key={slot}
                     className={`p-3 border rounded-md text-center transition-colors duration-150 font-medium ${
                       selectedSlot === slot
                         ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/50'
                         : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-white'
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
         <div className="mt-6">
           {/* Call handleBookingSubmit when the button is clicked */}
           <button
             onClick={handleBookingSubmit}
             className={`bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-md transition-colors duration-200 shadow-md ${
               bookingStatus === 'submitting' ? 'opacity-60 cursor-not-allowed' : ''
             }`}
             disabled={bookingStatus === 'submitting'}
           >
             {bookingStatus === 'submitting' ? 'Requesting...' : 'Request Appointment'}
           </button>
           {bookingStatus === 'success' && <p className="text-green-600 dark:text-green-400 mt-3 font-medium">Appointment requested successfully! You will receive confirmation once approved.</p>}
           {bookingStatus === 'error' && <p className="text-red-600 dark:text-red-400 mt-3 font-medium">Booking failed: {bookingError}</p>}
         </div>
      )}


      {/* Optional: Back to Home Link */}
      <div className="mt-10">
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}

