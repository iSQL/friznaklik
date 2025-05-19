// src/store/bookingStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import Cookies from 'js-cookie'; // For cookie handling
import type { Vendor } from '@prisma/client';

// Define WorkerInfo structure as returned by the API
export interface WorkerInfo {
  id: string;
  name: string | null;
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
  selectedDate: Date | null;
  availableSlotsData: SlotWithWorkers[];
  selectedSlotTime: string | null;
  selectedWorkerForBookingId: string | null;
  bookingNotes: string | null;

  bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
  bookingError: string | null;

  allVendors: Vendor[];
  isLoadingAllVendors: boolean;
  isHydrated: boolean; // To track if persistence has rehydrated

  // Actions to update the state
  selectVendor: (vendorId: string | null) => void;
  selectService: (serviceId: string | null) => void;
  selectDate: (date: Date | null) => void;
  setAvailableSlotsData: (slotsData: SlotWithWorkers[]) => void;
  selectSlotTime: (slotTime: string | null) => void;
  selectWorkerForBooking: (workerId: string | null) => void;
  setBookingNotes: (notes: string | null) => void;
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBookingState: () => void;
  resetServiceAndBelow: () => void;
  resetDateAndSlots: () => void;

  setAllVendors: (vendors: Vendor[]) => void;
  setIsLoadingAllVendors: (loading: boolean) => void;
  fetchAndSetAllVendors: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

const initialStateValues: Omit<BookingState,
  // Exclude all functions from initial values
  | 'selectVendor' | 'selectService' | 'selectDate' | 'setAvailableSlotsData'
  | 'selectSlotTime' | 'selectWorkerForBooking' | 'setBookingNotes'
  | 'setBookingStatus' | 'setBookingError' | 'resetBookingState'
  | 'resetServiceAndBelow' | 'resetDateAndSlots' | 'setAllVendors'
  | 'setIsLoadingAllVendors' | 'fetchAndSetAllVendors' | 'setHydrated'
> = {
  selectedVendorId: null,
  selectedServiceId: null,
  selectedDate: null,
  availableSlotsData: [],
  selectedSlotTime: null,
  selectedWorkerForBookingId: null,
  bookingNotes: null,
  bookingStatus: 'idle',
  bookingError: null,
  allVendors: [],
  isLoadingAllVendors: true, // Start as true, fetchAndSetAllVendors will set to false
  isHydrated: false, // Will be set to true after rehydration
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Custom storage adapter for js-cookie
const cookieStorage: StateStorage = {
  getItem: (name: string): string | null | Promise<string | null> => {
    const value = Cookies.get(name);
    return value === undefined ? null : value;
  },
  setItem: (name: string, value: string): void | Promise<void> => {
    Cookies.set(name, value, { expires: 7, path: '/' }); // Cookie expires in 7 days
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
            allVendors: state.allVendors, // Preserve fetched vendors
            isLoadingAllVendors: state.isLoadingAllVendors,
            isHydrated: state.isHydrated, // Preserve hydration status
            selectedVendorId: vendorId,
          };
        }
        return { selectedVendorId: vendorId };
      }),

      selectService: (serviceId) => set((state) => {
        if (state.selectedServiceId !== serviceId) {
          return {
            selectedServiceId: serviceId,
            selectedDate: null,
            availableSlotsData: [],
            selectedSlotTime: null,
            selectedWorkerForBookingId: null,
            bookingNotes: null,
          };
        }
        return { selectedServiceId: serviceId };
      }),

      selectDate: (date) => set({
        selectedDate: date,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
      }),

      setAvailableSlotsData: (slotsData) => set({ availableSlotsData: slotsData }),

      selectSlotTime: (slotTime) => set((state) => {
        let workerIdToSet: string | null = null;
        if (slotTime) {
          const slotData = state.availableSlotsData.find(s => s.time === slotTime);
          if (slotData && slotData.availableWorkers.length > 0) {
            workerIdToSet = state.selectedWorkerForBookingId && slotData.availableWorkers.some(w => w.id === state.selectedWorkerForBookingId)
              ? state.selectedWorkerForBookingId
              : slotData.availableWorkers[0].id;
          } else if (!slotData) {
            workerIdToSet = null;
          }
        } else {
            workerIdToSet = null;
        }
        return {
            selectedSlotTime: slotTime,
            selectedWorkerForBookingId: workerIdToSet,
        };
      }),

      selectWorkerForBooking: (workerId) => set({ selectedWorkerForBookingId: workerId }),
      setBookingNotes: (notes) => set({ bookingNotes: notes }),
      setBookingStatus: (status) => set({ bookingStatus: status }),
      setBookingError: (error) => set({ bookingError: error }),

      resetBookingState: () => set((state) => ({ // Preserve hydration status and allVendors on full reset
        ...initialStateValues,
        allVendors: state.allVendors,
        isLoadingAllVendors: state.isLoadingAllVendors,
        isHydrated: state.isHydrated,
      })),

      resetServiceAndBelow: () => set({
        selectedServiceId: null,
        selectedDate: null,
        availableSlotsData: [],
        selectedSlotTime: null,
        selectedWorkerForBookingId: null,
        bookingNotes: null,
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
        // Avoid refetch if already loaded unless forced
        if (get().allVendors.length > 0 && !get().isLoadingAllVendors && !get().isHydrated) { // Check isHydrated here too
             // If not hydrated, it means this might be the first load after rehydration,
             // and we might want to ensure data is fresh or rely on persisted data.
             // For now, if allVendors has data, we assume it's either fresh or rehydrated.
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
          set({ isLoadingAllVendors: false, allVendors: [] });
        }
      },
    }),
    {
      name: 'friznaklik-selected-vendor-storage', // Name of the item in storage (cookie name)
      storage: createJSONStorage(() => cookieStorage), // Use our custom cookie storage
      partialize: (state) => ({
        selectedVendorId: state.selectedVendorId, // Only persist selectedVendorId
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHydrated(true);
        console.log('Booking store rehydrated, selectedVendorId:', state?.selectedVendorId);
      },
      // Optional: versioning for migrations if your stored state shape changes
      // version: 1,
      // migrate: (persistedState, version) => {
      //   if (version === 0) {
      //     // example migration
      //     // (persistedState as any).newField = defaultValue;
      //   }
      //   return persistedState as BookingState;
      // },
    }
  )
);
