// src/store/bookingStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import Cookies from 'js-cookie'; // For cookie handling
import type { Vendor } from '@prisma/client';

// Define WorkerInfo structure as returned by the API
export interface WorkerInfo {
  id: string;
  name: string | null;
  // Add other relevant worker details if needed for display, e.g., photoUrl
}

// Define SlotWithWorkers structure as returned by the API
export interface SlotWithWorkers {
  time: string; // "HH:mm"
  availableWorkers: WorkerInfo[];
}

// Definišemo oblik stanja u booking store-u
interface BookingState {
  selectedVendorId: string | null;
  selectedServiceId: string | null;
  preferredWorkerIdForFilter: string | null; // User's preferred worker for filtering slots
  selectedDate: Date | null;
  availableSlotsData: SlotWithWorkers[]; // Slots available based on vendor, service, date, AND preferredWorkerIdForFilter
  selectedSlotTime: string | null;
  selectedWorkerForBookingId: string | null; // The actual worker assigned to the booking for this slot
  bookingNotes: string | null;

  bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
  bookingError: string | null;

  allVendors: Vendor[];
  isLoadingAllVendors: boolean;
  isHydrated: boolean; // To track if persistence has rehydrated

  // Actions to update the state
  selectVendor: (vendorId: string | null) => void;
  selectService: (serviceId: string | null) => void;
  selectPreferredWorkerForFilter: (workerId: string | null) => void; // New action
  selectDate: (date: Date | null) => void;
  setAvailableSlotsData: (slotsData: SlotWithWorkers[]) => void;
  selectSlotTime: (slotTime: string | null) => void; // Will also handle setting selectedWorkerForBookingId
  setBookingNotes: (notes: string | null) => void;
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBookingState: () => void;
  resetServiceAndBelow: () => void; // Resets from service selection downwards
  resetWorkerAndBelow: () => void; // Resets from worker filter selection downwards
  resetDateAndSlots: () => void; // Resets from date selection downwards

  setAllVendors: (vendors: Vendor[]) => void;
  setIsLoadingAllVendors: (loading: boolean) => void;
  fetchAndSetAllVendors: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

const initialStateValues: Omit<BookingState,
  // Exclude all functions from initial values
  | 'selectVendor' | 'selectService' | 'selectPreferredWorkerForFilter' | 'selectDate' | 'setAvailableSlotsData'
  | 'selectSlotTime' | 'setBookingNotes'
  | 'setBookingStatus' | 'setBookingError' | 'resetBookingState'
  | 'resetServiceAndBelow' | 'resetWorkerAndBelow' | 'resetDateAndSlots' | 'setAllVendors'
  | 'setIsLoadingAllVendors' | 'fetchAndSetAllVendors' | 'setHydrated'
> = {
  selectedVendorId: null,
  selectedServiceId: null,
  preferredWorkerIdForFilter: null, // Initialize new state
  selectedDate: null,
  availableSlotsData: [],
  selectedSlotTime: null,
  selectedWorkerForBookingId: null,
  bookingNotes: null,
  bookingStatus: 'idle',
  bookingError: null,
  allVendors: [],
  isLoadingAllVendors: true,
  isHydrated: false,
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const cookieStorage: StateStorage = {
  getItem: (name: string): string | null | Promise<string | null> => {
    const value = Cookies.get(name);
    return value === undefined ? null : value;
  },
  setItem: (name: string, value: string): void | Promise<void> => {
    Cookies.set(name, value, { expires: 7, path: '/' });
  },
  removeItem: (name: string): void | Promise<void> => {
    Cookies.remove(name, { path: '/' });
  },
};

export const useBookingStore = create<BookingState>()(
  persist(
    (set, get) => ({
      ...initialStateValues,

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),

      selectVendor: (vendorId) => set((state) => {
        if (state.selectedVendorId !== vendorId) {
          return {
            ...initialStateValues, // Reset most fields
            allVendors: state.allVendors,
            isLoadingAllVendors: state.isLoadingAllVendors,
            isHydrated: state.isHydrated,
            selectedVendorId: vendorId,
          };
        }
        return { selectedVendorId: vendorId };
      }),

      selectService: (serviceId) => set((state) => {
        if (state.selectedServiceId !== serviceId) {
          return { // Reset states from worker filter downwards
            selectedServiceId: serviceId,
            preferredWorkerIdForFilter: null,
            selectedDate: null,
            availableSlotsData: [],
            selectedSlotTime: null,
            selectedWorkerForBookingId: null,
            bookingNotes: null,
          };
        }
        return { selectedServiceId: serviceId };
      }),
      
      selectPreferredWorkerForFilter: (workerId) => set({ // New action
        preferredWorkerIdForFilter: workerId,
        // Reset subsequent selections as changing worker filter invalidates them
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        // bookingNotes can be kept or reset based on preference
      }),

      selectDate: (date) => set({
        selectedDate: date,
        availableSlotsData: [], // Reset slots when date changes
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      setAvailableSlotsData: (slotsData) => set({ availableSlotsData: slotsData }),

      selectSlotTime: (slotTime) => set((state) => {
        let workerForBooking: string | null = null;
        if (slotTime) {
          const slotData = state.availableSlotsData.find(s => s.time === slotTime);
          if (slotData && slotData.availableWorkers.length > 0) {
            // If a preferred worker was used for filtering AND they are available in this specific slot, select them.
            if (state.preferredWorkerIdForFilter && slotData.availableWorkers.some(w => w.id === state.preferredWorkerIdForFilter)) {
              workerForBooking = state.preferredWorkerIdForFilter;
            } else {
              // Otherwise, (no preference or preferred not in slot), pick the first available worker for this slot.
              workerForBooking = slotData.availableWorkers[0].id;
            }
          }
          // If slotData is found but availableWorkers is empty, workerForBooking remains null.
          // If slotTime is provided but slotData is not found (shouldn't happen), workerForBooking remains null.
        }
        // If slotTime is null (deselecting a slot), workerForBooking will be null.
        return {
            selectedSlotTime: slotTime,
            selectedWorkerForBookingId: workerForBooking,
        };
      }),

      setBookingNotes: (notes) => set({ bookingNotes: notes }),
      setBookingStatus: (status) => set({ bookingStatus: status }),
      setBookingError: (error) => set({ bookingError: error }),

      resetBookingState: () => set((state) => ({
        ...initialStateValues,
        allVendors: state.allVendors,
        isLoadingAllVendors: state.isLoadingAllVendors,
        isHydrated: state.isHydrated,
      })),

      resetServiceAndBelow: () => set({
        selectedServiceId: null,
        preferredWorkerIdForFilter: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        bookingNotes: null,
      }),
      
      resetWorkerAndBelow: () => set({ // New reset function
        preferredWorkerIdForFilter: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        // bookingNotes can be kept or reset
      }),

      resetDateAndSlots: () => set({
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      setAllVendors: (vendors) => set({ allVendors: vendors, isLoadingAllVendors: false }),
      setIsLoadingAllVendors: (loading) => set({ isLoadingAllVendors: loading }),

      fetchAndSetAllVendors: async () => {
        if (get().allVendors.length > 0 && !get().isLoadingAllVendors && get().isHydrated) { // Check isHydrated
            // Data already loaded and store is hydrated, no need to refetch unless forced.
            // If not hydrated, it means this might be the first load after rehydration,
            // and we might want to ensure data is fresh or rely on persisted data.
            // For now, if allVendors has data and store is hydrated, we assume it's okay.
            // If not hydrated, it will proceed to fetch.
            if(get().isHydrated) return;
        }

        set({ isLoadingAllVendors: true });
        try {
          const response = await fetch(`${SITE_URL}/api/vendors`);
          if (!response.ok) {
            throw new Error('Neuspešno preuzimanje liste salona za prodavnicu');
          }
          const data: Vendor[] = await response.json();
          set({ allVendors: data, isLoadingAllVendors: false });
        } catch (error) {
          console.error("Greška pri preuzimanju salona za prodavnicu:", error);
          set({ isLoadingAllVendors: false, allVendors: [] }); // Set to empty on error
        }
      },
    }),
    {
      name: 'friznaklik-booking-storage', // Updated name to reflect more general booking state
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({
        selectedVendorId: state.selectedVendorId,
        // Persist other relevant fields if needed, e.g., preferredWorkerIdForFilter
        // For now, only selectedVendorId is persisted.
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
            state.setHydrated(true);
            console.log('Booking store rehydrated, selectedVendorId:', state.selectedVendorId);
            // After rehydration, if selectedVendorId exists, other dependent states are reset by selectVendor
            // or subsequent actions. We might want to trigger a fetch for services if a vendor is rehydrated.
            // This is handled by the useEffect in the /book page now.
        } else {
            // If state is null/undefined after rehydration attempt, ensure hydrated is true to prevent loops
            useBookingStore.setState({ isHydrated: true, isLoadingAllVendors: false });
            console.log('Booking store rehydration: No persisted state found or error during rehydration.');
        }
      },
    }
  )
);

