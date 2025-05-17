// src/store/bookingStore.ts
import { create } from 'zustand';

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
  bookingNotes: string | null; // New: For customer notes

  bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
  bookingError: string | null;

  selectVendor: (vendorId: string | null) => void;
  selectService: (serviceId: string | null) => void;
  selectDate: (date: Date | null) => void;
  setAvailableSlotsData: (slotsData: SlotWithWorkers[]) => void;
  selectSlotTime: (slotTime: string | null) => void;
  selectWorkerForBooking: (workerId: string | null) => void;
  setBookingNotes: (notes: string | null) => void; // New action
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBookingState: () => void;
  resetServiceAndBelow: () => void;
  resetDateAndSlots: () => void;
}

const initialState: Omit<BookingState, 'selectVendor' | 'selectService' | 'selectDate' | 'setAvailableSlotsData' | 'selectSlotTime' | 'selectWorkerForBooking' | 'setBookingNotes' | 'setBookingStatus' | 'setBookingError' | 'resetBookingState' | 'resetServiceAndBelow' | 'resetDateAndSlots'> = {
  selectedVendorId: null,
  selectedServiceId: null,
  selectedDate: null,
  availableSlotsData: [],
  selectedSlotTime: null,
  selectedWorkerForBookingId: null,
  bookingNotes: null, // Initialize notes as null
  bookingStatus: 'idle' as 'idle' | 'submitting' | 'success' | 'error',
  bookingError: null,
};

export const useBookingStore = create<BookingState>((set, get) => ({
  ...initialState,

  selectVendor: (vendorId) => set((state) => {
    if (state.selectedVendorId !== vendorId) {
      return {
        ...initialState,
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
        bookingNotes: null, // Reset notes if service changes
      };
    }
    return { selectedServiceId: serviceId };
  }),

  selectDate: (date) => set({
    selectedDate: date,
    availableSlotsData: [],
    selectedSlotTime: null,
    selectedWorkerForBookingId: null,
    bookingNotes: null, // Reset notes if date changes
  }),

  setAvailableSlotsData: (slotsData) => set({ availableSlotsData: slotsData }),

  selectSlotTime: (slotTime) => set((state) => {
    let workerIdToSet: string | null = null;
    if (slotTime) {
      const slotData = state.availableSlotsData.find(s => s.time === slotTime);
      if (slotData && slotData.availableWorkers.length > 0) {
        workerIdToSet = slotData.availableWorkers[0].id; // Default to first available
      }
    }
    return {
        selectedSlotTime: slotTime,
        selectedWorkerForBookingId: workerIdToSet,
        bookingNotes: state.bookingNotes, // Keep existing notes when slot time changes
    };
  }),

  selectWorkerForBooking: (workerId) => set({ selectedWorkerForBookingId: workerId }),

  setBookingNotes: (notes) => set({ bookingNotes: notes }), // New action implementation

  setBookingStatus: (status) => set({ bookingStatus: status }),
  setBookingError: (error) => set({ bookingError: error }),
  resetBookingState: () => set(initialState),

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
    bookingNotes: null,
  }),
}));
