import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import Cookies from 'js-cookie'; // For cookie handling
import type { Vendor } from '@prisma/client';

export interface WorkerInfo {
  id: string;
  name: string | null;
}

export interface SlotWithWorkers {
  time: string; // "HH:mm"
  availableWorkers: WorkerInfo[];
}

// Definišemo oblik stanja u booking store-u
interface BookingState {
  selectedVendorId: string | null;
  selectedServiceId: string | null;
  preferredWorkerIdForFilter: string | null; // User's preferred worker for filtering slots
  selectedDate: Date | null; // Storing as ISO string for persistence, converting on use
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
  selectPreferredWorkerForFilter: (workerId: string | null) => void;
  selectDate: (date: Date | null) => void;
  setAvailableSlotsData: (slotsData: SlotWithWorkers[]) => void;
  selectSlotTime: (slotTime: string | null) => void;
  setBookingNotes: (notes: string | null) => void;
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBookingState: () => void;
  resetServiceAndBelow: () => void;
  resetWorkerAndBelow: () => void;
  resetDateAndSlots: () => void;

  setAllVendors: (vendors: Vendor[]) => void;
  setIsLoadingAllVendors: (loading: boolean) => void;
  fetchAndSetAllVendors: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
  clearTransientBookingDetails: () => void; // New action to clear sensitive parts after booking
}

const initialStateValues: Omit<BookingState,
  // Exclude all functions from initial values
  | 'selectVendor' | 'selectService' | 'selectPreferredWorkerForFilter' | 'selectDate' | 'setAvailableSlotsData'
  | 'selectSlotTime' | 'setBookingNotes'
  | 'setBookingStatus' | 'setBookingError' | 'resetBookingState'
  | 'resetServiceAndBelow' | 'resetWorkerAndBelow' | 'resetDateAndSlots' | 'setAllVendors'
  | 'setIsLoadingAllVendors' | 'fetchAndSetAllVendors' | 'setHydrated' | 'clearTransientBookingDetails'
> = {
  selectedVendorId: null,
  selectedServiceId: null,
  preferredWorkerIdForFilter: null,
  selectedDate: null, // Will be stored as ISO string
  availableSlotsData: [],
  selectedSlotTime: null,
  selectedWorkerForBookingId: null,
  bookingNotes: null,
  bookingStatus: 'idle',
  bookingError: null,
  allVendors: [],
  isLoadingAllVendors: true, // Start with true to indicate initial loading
  isHydrated: false,
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const cookieStorage: StateStorage = {
  getItem: (name: string): string | null | Promise<string | null> => {
    const value = Cookies.get(name);
    return value === undefined ? null : value;
  },
  setItem: (name: string, value: string): void | Promise<void> => {
    // Expires in 1 day for guest booking flow persistence
    Cookies.set(name, value, { expires: 1, path: '/' });
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
            // Reset only fields dependent on vendor, keep allVendors and loading state
            selectedVendorId: vendorId,
            selectedServiceId: null,
            preferredWorkerIdForFilter: null,
            selectedDate: null,
            availableSlotsData: [],
            selectedSlotTime: null,
            selectedWorkerForBookingId: null,
            bookingNotes: null, // Or decide to keep notes
            bookingStatus: 'idle',
            bookingError: null,
            // Keep: allVendors, isLoadingAllVendors, isHydrated
          };
        }
        return { selectedVendorId: vendorId };
      }),

      selectService: (serviceId) => set((state) => {
        if (state.selectedServiceId !== serviceId) {
          return {
            selectedServiceId: serviceId,
            preferredWorkerIdForFilter: null,
            selectedDate: null,
            availableSlotsData: [],
            selectedSlotTime: null,
            selectedWorkerForBookingId: null,
          };
        }
        return { selectedServiceId: serviceId };
      }),
      
      selectPreferredWorkerForFilter: (workerId) => set({
        preferredWorkerIdForFilter: workerId,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      selectDate: (date) => set({
        selectedDate: date, // Store as Date object in memory
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      setAvailableSlotsData: (slotsData) => set({ availableSlotsData: slotsData }),

      selectSlotTime: (slotTime) => set((state) => {
        let workerForBooking: string | null = null;
        if (slotTime) {
          const slotData = state.availableSlotsData.find(s => s.time === slotTime);
          if (slotData && slotData.availableWorkers.length > 0) {
            if (state.preferredWorkerIdForFilter && slotData.availableWorkers.some(w => w.id === state.preferredWorkerIdForFilter)) {
              workerForBooking = state.preferredWorkerIdForFilter;
            } else {
              workerForBooking = slotData.availableWorkers[0].id;
            }
          }
        }
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
        allVendors: state.allVendors, // Keep fetched vendors
        isLoadingAllVendors: state.allVendors.length === 0, // Recalculate loading state
        isHydrated: state.isHydrated,
      })),

      resetServiceAndBelow: () => set({
        selectedServiceId: null,
        preferredWorkerIdForFilter: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        bookingNotes: null, // Or decide to keep notes
      }),
      
      resetWorkerAndBelow: () => set({
        preferredWorkerIdForFilter: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      resetDateAndSlots: () => set({
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),
      
      // Action to clear sensitive/transient booking details after successful booking or if user navigates away
      clearTransientBookingDetails: () => set({
        preferredWorkerIdForFilter: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        bookingNotes: null,
        bookingStatus: 'idle',
        bookingError: null,
      }),

      setAllVendors: (vendors) => set({ allVendors: vendors, isLoadingAllVendors: false }),
      setIsLoadingAllVendors: (loading) => set({ isLoadingAllVendors: loading }),

      fetchAndSetAllVendors: async () => {
        // Only fetch if vendors are not loaded or if not hydrated (to ensure data on first load after rehydration)
        if (get().allVendors.length > 0 && get().isHydrated && !get().isLoadingAllVendors) {
             // If hydrated and vendors are present, and not currently loading, assume data is fine.
            return;
        }
        // If not hydrated, it means this might be the first load after rehydration,
        // or initial load. Proceed to fetch.

        set({ isLoadingAllVendors: true });
        try {
          const response = await fetch(`${SITE_URL}/api/vendors`);
          if (!response.ok) {
            // Consider logging the actual status: response.status
            throw new Error('Neuspešno preuzimanje liste salona za prodavnicu.');
          }
          const data: Vendor[] = await response.json();
          set({ allVendors: data, isLoadingAllVendors: false });
        } catch (error) {
          console.error("Greška pri preuzimanju salona za prodavnicu:", error);
          set({ isLoadingAllVendors: false, allVendors: [] });
        }
      },
    }),
    {
      name: 'friznaklik-booking-storage-v2', // Consider versioning if schema changes significantly
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => {
        // Persist more details for guest booking flow
        return {
          selectedVendorId: state.selectedVendorId,
          selectedServiceId: state.selectedServiceId,
          preferredWorkerIdForFilter: state.preferredWorkerIdForFilter,
          // Persist selectedDate as ISO string if it's a Date object, otherwise null
          selectedDate: state.selectedDate ? state.selectedDate.toISOString() : null,
          selectedSlotTime: state.selectedSlotTime,
          // Do not persist selectedWorkerForBookingId or availableSlotsData as they are transient/large
          bookingNotes: state.bookingNotes,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Greška pri rehidrataciji booking prodavnice:", error);
          // Fallback: set hydrated to true and potentially reset to initial values
          // to avoid inconsistent state or loops.
          useBookingStore.setState({ 
            ...initialStateValues, // Reset to initial values on error
            isHydrated: true, 
            isLoadingAllVendors: initialStateValues.allVendors.length === 0 
          });
          return;
        }
        if (state) {
          // Convert selectedDate back to Date object if it was stored as ISO string
          const rehydratedDate = state.selectedDate;
          if (typeof rehydratedDate === 'string') {
            state.selectedDate = new Date(rehydratedDate);
          } else {
             state.selectedDate = null; // Or keep as is if already null/Date
          }
          state.setHydrated(true);
          console.log('Booking prodavnica rehidratisana:', {
            selectedVendorId: state.selectedVendorId,
            selectedServiceId: state.selectedServiceId,
            selectedDate: state.selectedDate,
          });
          // Trigger fetching all vendors if not already loaded, to ensure vendor list is available
          // This is important if the user lands directly on /book page after rehydration
          if (state.allVendors.length === 0) {
            state.fetchAndSetAllVendors();
          }
        } else {
          // If state is null/undefined after rehydration attempt (e.g. no cookie)
          useBookingStore.setState({ 
            isHydrated: true, 
            isLoadingAllVendors: useBookingStore.getState().allVendors.length === 0 
          });
          console.log('Booking prodavnica rehidratacija: Nema sačuvanog stanja.');
           // Fetch vendors if none are loaded, as this might be the first visit
          if (useBookingStore.getState().allVendors.length === 0) {
            useBookingStore.getState().fetchAndSetAllVendors();
          }
        }
      },
      version: 2, // Increment version if you change persisted state structure
    }
  )
);
