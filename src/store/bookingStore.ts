// src/store/bookingStore.ts

import { create } from 'zustand'; // Import the create function from Zustand
import { Service } from '@prisma/client'; // Import the Service type from Prisma

// Define the shape of the state in the booking store
interface BookingState {
  selectedServiceId: string | null; // ID of the selected service
  selectedDate: Date | null;       // Selected date for the appointment
  availableSlots: string[];      // Array of available time slots (e.g., ["10:00", "10:30"])
  selectedSlot: string | null;     // Selected time slot

  // State to track the booking request process
  bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
  bookingError: string | null;     // Error message if booking fails

  // Actions to update the state
  selectService: (serviceId: string | null) => void;
  selectDate: (date: Date | null) => void;
  setAvailableSlots: (slots: string[]) => void;
  selectSlot: (slot: string | null) => void;
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBooking: () => void; // Action to reset the entire booking state
}

// Create the Zustand store
export const useBookingStore = create<BookingState>((set) => ({
  // Initial state values
  selectedServiceId: null,
  selectedDate: null,
  availableSlots: [],
  selectedSlot: null,
  bookingStatus: 'idle',
  bookingError: null,

  // Action implementations
  selectService: (serviceId) => set({ selectedServiceId: serviceId, selectedDate: null, availableSlots: [], selectedSlot: null }), // Reset date/slots when service changes
  selectDate: (date) => set({ selectedDate: date, availableSlots: [], selectedSlot: null }), // Reset slots when date changes
  setAvailableSlots: (slots) => set({ availableSlots: slots }),
  selectSlot: (slot) => set({ selectedSlot: slot }),
  setBookingStatus: (status) => set({ bookingStatus: status }),
  setBookingError: (error) => set({ bookingError: error }),
  resetBooking: () => set({ selectedServiceId: null, selectedDate: null, availableSlots: [], selectedSlot: null, bookingStatus: 'idle', bookingError: null }),
}));

