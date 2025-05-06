// src/app/book/page.tsx
'use client'; // This directive marks this as a Client Component

import { useBookingStore } from '@/store/bookingStore'; // Import the Zustand booking store
import { useState, useEffect, Suspense } from 'react'; // Import React hooks, added Suspense
import { Service } from '@prisma/client'; // Import the Service type from Prisma
import Link from 'next/link'; // Import Link for navigation
import { useSearchParams } from 'next/navigation'; // Import for reading URL query params

// Import react-datepicker and its CSS
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Import format function from date-fns
import { format } from 'date-fns';

// Define the base URL for your API.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// New component to handle search param logic, because useSearchParams needs to be under Suspense
function BookingForm() {
  const searchParams = useSearchParams(); // Hook to access URL query parameters

  // Access state and actions from the Zustand store
  const {
    selectedServiceId,
    selectedDate,
    availableSlots,
    selectedSlot,
    bookingStatus,
    bookingError,
    selectService,
    selectDate,
    setAvailableSlots,
    selectSlot: setStoreSelectedSlot, // Renamed to avoid conflict with local selectedSlot if any
    setBookingStatus,
    setBookingError,
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
        // If this API route also needs authentication, you'll need to forward headers
        // similar to how it was done in the services page.
        // For now, assuming /api/services is public or auth is handled differently for client-side fetch.
        const response = await fetch(`${SITE_URL}/api/services`);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch services: ${response.status} ${errorText}`);
        }
        const data: Service[] = await response.json();
        setServices(data);
      } catch (err: any) {
        console.error('Error fetching services:', err);
        setServicesError(err.message || 'Failed to load services.');
      } finally {
        setIsLoadingServices(false);
      }
    };

    fetchServices();
  }, []);

  // Effect to pre-select service if serviceId is in URL and services are loaded
  useEffect(() => {
    const serviceIdFromUrl = searchParams.get('serviceId');
    if (serviceIdFromUrl && services.length > 0) {
      // Check if the serviceIdFromUrl is a valid service
      const serviceExists = services.some(s => s.id === serviceIdFromUrl);
      if (serviceExists) {
        console.log(`Pre-selecting service from URL: ${serviceIdFromUrl}`);
        selectService(serviceIdFromUrl);
      } else {
        console.warn(`Service ID ${serviceIdFromUrl} from URL not found in fetched services.`);
      }
    }
  }, [searchParams, services, selectService]); // Rerun when searchParams or services change


  // Fetch available slots when selectedServiceId or selectedDate changes
  useEffect(() => {
    if (selectedServiceId && selectedDate) {
      const fetchAvailableSlots = async () => {
        setIsLoadingSlots(true);
        setSlotsError(null);
        setAvailableSlots([]);

        try {
          const formattedDate = format(selectedDate, 'yyyy-MM-dd');
          console.log(`Fetching slots for service ${selectedServiceId} on date ${formattedDate}`);

          const response = await fetch(`${SITE_URL}/api/appointments/available?serviceId=${selectedServiceId}&date=${formattedDate}`);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch available slots: ${response.status} ${errorText}`);
          }
          const data: string[] = await response.json();
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
      setAvailableSlots([]);
      setStoreSelectedSlot(null);
    }
  }, [selectedServiceId, selectedDate, setAvailableSlots, setStoreSelectedSlot]);


  const handleServiceSelect = (serviceId: string) => {
    selectService(serviceId);
  };

  const handleDateSelect = (date: Date | null) => {
    selectDate(date);
  };

  const handleSlotSelect = (slot: string) => {
    setStoreSelectedSlot(slot);
  };

  const handleBookingSubmit = async () => {
    if (!selectedServiceId || !selectedDate || !selectedSlot) {
      console.error("Attempted booking without all required selections.");
      return;
    }

    setBookingStatus('submitting');
    setBookingError(null);

    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`${SITE_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          date: formattedDate,
          slot: selectedSlot,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Booking failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch {
          const errorText = await response.text();
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      setBookingStatus('success');
      console.log('Appointment requested successfully!');
    } catch (err: any) {
      setBookingStatus('error');
      setBookingError(err.message || 'An unknown error occurred during booking.');
      console.error('Booking submission error:', err);
    }
  };

  // Get the name of the selected service for display
  const selectedServiceName = services.find(s => s.id === selectedServiceId)?.name || 'Service';


  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8"> {/* DaisyUI: container, p-4 etc. are fine */}
      <h1 className="text-3xl font-bold mb-8 text-center text-neutral-content"> {/* DaisyUI: text-3xl, font-bold, mb-8, text-center */}
        Book an Appointment
      </h1>

      {/* Step 1: Service Selection */}
      <div className="mb-8 p-6 card bg-base-200 shadow-lg"> {/* DaisyUI: card, bg-base-200, shadow-lg */}
        <h2 className="text-2xl font-semibold mb-4 card-title">1. Select a Service</h2> {/* DaisyUI: card-title */}
        {isLoadingServices ? (
          <div className="flex justify-center items-center h-24">
            <span className="loading loading-spinner loading-lg text-primary"></span> {/* DaisyUI: loading */}
          </div>
        ) : servicesError ? (
          <div role="alert" className="alert alert-error"> {/* DaisyUI: alert, alert-error */}
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Error loading services: {servicesError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={`card bordered cursor-pointer transition-all duration-200 ease-in-out hover:shadow-md ${ /* DaisyUI: card, bordered */
                  selectedServiceId === service.id
                    ? 'border-primary ring-2 ring-primary bg-primary/10' // DaisyUI: border-primary, ring-primary, bg-primary/10
                    : 'bg-base-100 border-base-300 hover:border-primary/70' // DaisyUI: bg-base-100, border-base-300
                }`}
                onClick={() => handleServiceSelect(service.id)}
              >
                <div className="card-body p-4"> {/* DaisyUI: card-body */}
                  <h3 className="card-title text-lg">{service.name}</h3> {/* DaisyUI: card-title */}
                  <p className="text-sm text-base-content/70 mb-1 line-clamp-2">{service.description || "No description"}</p> {/* DaisyUI: text-base-content/70, line-clamp */}
                  <p className="font-semibold text-base-content/90">${service.price.toFixed(2)} - {service.duration} min</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Date Selection */}
      {selectedServiceId && (
        <div className="mb-8 p-6 card bg-base-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 card-title">2. Select a Date for {selectedServiceName}</h2>
          <div className="p-4 border rounded-lg inline-block bg-base-100 border-base-300 shadow-sm"> {/* DaisyUI: bg-base-100, border-base-300 */}
            <DatePicker
              selected={selectedDate}
              onChange={handleDateSelect}
              dateFormat="yyyy/MM/dd"
              minDate={new Date()}
              inline
              className="react-datepicker-override"
            />
          </div>
          {/* Minimal styling for react-datepicker to blend with DaisyUI */}
          <style jsx global>{`
            .react-datepicker {
              font-family: inherit;
              border-color: hsl(var(--b3)); /* DaisyUI border color */
              background-color: hsl(var(--b1)); /* DaisyUI base-100 */
            }
            .react-datepicker__header {
              background-color: hsl(var(--b2)); /* DaisyUI base-200 */
              border-bottom-color: hsl(var(--b3));
            }
            .react-datepicker__day-name, .react-datepicker__day, .react-datepicker__time-name {
              color: hsl(var(--bc)); /* DaisyUI base-content */
            }
            .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header {
                color: hsl(var(--bc));
            }
            .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
              background-color: hsl(var(--p)); /* DaisyUI primary */
              color: hsl(var(--pc)); /* DaisyUI primary-content */
            }
            .react-datepicker__day:hover {
              background-color: hsl(var(--p)/0.1); /* DaisyUI primary with opacity */
            }
            .react-datepicker__navigation-icon::before {
                border-color: hsl(var(--bc)); /* DaisyUI base-content */
            }
          `}</style>
        </div>
      )}

      {/* Step 3: Time Slot Selection */}
      {selectedDate && selectedServiceId && (
        <div className="mb-8 p-6 card bg-base-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 card-title">3. Select a Time Slot for {selectedServiceName} on {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}</h2>
          {isLoadingSlots ? (
            <div className="flex justify-center items-center h-24">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          ) : slotsError ? (
            <div role="alert" className="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>Error loading slots: {slotsError}</span>
            </div>
          ) : availableSlots.length === 0 ? (
            <p className="text-base-content/70">No available slots for the selected date. Please try another date.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  className={`btn ${ /* DaisyUI: btn */
                    selectedSlot === slot
                      ? 'btn-primary' // DaisyUI: btn-primary
                      : 'btn-outline btn-ghost' // DaisyUI: btn-outline, btn-ghost
                  }`}
                  onClick={() => handleSlotSelect(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Button & Status */}
      {selectedSlot && (
        <div className="mt-6 p-6 card bg-base-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 card-title">4. Confirm Your Booking</h2>
          <div className="mb-4 space-y-1">
            <p><span className="font-semibold">Service:</span> {selectedServiceName}</p>
            <p><span className="font-semibold">Date:</span> {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'N/A'}</p>
            <p><span className="font-semibold">Time:</span> {selectedSlot}</p>
          </div>
          <button
            onClick={handleBookingSubmit}
            className={`btn btn-success btn-lg w-full sm:w-auto ${ /* DaisyUI: btn-success, btn-lg */
              bookingStatus === 'submitting' ? 'btn-disabled' : '' // DaisyUI: btn-disabled
            }`}
            disabled={bookingStatus === 'submitting'}
          >
            {bookingStatus === 'submitting' ? (
              <>
                <span className="loading loading-spinner loading-sm"></span> {/* DaisyUI: loading */}
                Requesting...
              </>
            ) : (
              'Request Appointment'
            )}
          </button>
          {bookingStatus === 'success' && (
            <div role="alert" className="alert alert-success mt-4"> {/* DaisyUI: alert, alert-success */}
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                    <h3 className="font-bold">Success!</h3>
                    <div className="text-xs">Appointment requested! You'll receive confirmation once approved.</div>
                </div>
            </div>
          )}
          {bookingStatus === 'error' && (
             <div role="alert" className="alert alert-error mt-4"> {/* DaisyUI: alert, alert-error */}
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                    <h3 className="font-bold">Booking Failed!</h3>
                    <div className="text-xs">{bookingError}</div>
                </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="btn btn-ghost"> {/* DaisyUI: btn, btn-ghost */}
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}

// This is the main page component that Next.js will render.
// It wraps BookingForm in Suspense because useSearchParams must be used in a client component wrapped in Suspense.
export default function BookingPage() {
  return (
    <Suspense fallback={<BookingPageSkeleton />}> {/* Added Suspense wrapper */}
      <BookingForm />
    </Suspense>
  );
}

// Skeleton component for loading state while Suspense resolves
function BookingPageSkeleton() {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="h-10 bg-base-300 rounded w-1/2 mx-auto mb-8"></div>

            {/* Service Selection Skeleton */}
            <div className="mb-8 p-6 card bg-base-200 shadow-lg">
                <div className="h-8 bg-base-300 rounded w-1/3 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card bordered bg-base-100">
                            <div className="card-body p-4">
                                <div className="h-6 bg-base-300 rounded w-3/4 mb-2"></div>
                                <div className="h-4 bg-base-300 rounded w-full mb-1"></div>
                                <div className="h-4 bg-base-300 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
             {/* Further skeleton sections can be added for date and time slots if desired */}
        </div>
    );
}
