// src/store/bookingStore.ts

import { create } from 'zustand';

// Definišemo oblik stanja u booking store-u
interface BookingState {
  selectedVendorId: string | null; // NOVO: ID odabranog salona (vendora)
  selectedServiceId: string | null; // ID odabrane usluge
  selectedDate: Date | null;       // Odabrani datum za termin
  availableSlots: string[];      // Niz dostupnih termina (npr., ["10:00", "10:30"])
  selectedSlot: string | null;     // Odabrani termin

  // Stanje za praćenje procesa zahteva za rezervaciju
  bookingStatus: 'idle' | 'submitting' | 'success' | 'error';
  bookingError: string | null;     // Poruka o grešci ako rezervacija ne uspe

  // Akcije za ažuriranje stanja
  selectVendor: (vendorId: string | null) => void; // NOVO: Akcija za odabir salona
  selectService: (serviceId: string | null) => void;
  selectDate: (date: Date | null) => void;
  setAvailableSlots: (slots: string[]) => void;
  selectSlot: (slot: string | null) => void;
  setBookingStatus: (status: 'idle' | 'submitting' | 'success' | 'error') => void;
  setBookingError: (error: string | null) => void;
  resetBookingState: () => void; // Akcija za resetovanje celokupnog stanja rezervacije
  resetServiceAndBelow: () => void; // Pomoćna akcija za resetovanje usluge i svega ispod nje
  resetDateAndSlots: () => void; // Pomoćna akcija za resetovanje datuma i slotova
}

// Inicijalno stanje
const initialState = {
  selectedVendorId: null,
  selectedServiceId: null,
  selectedDate: null,
  availableSlots: [],
  selectedSlot: null,
  bookingStatus: 'idle' as 'idle' | 'submitting' | 'success' | 'error', // Eksplicitan tip za inicijalno stanje
  bookingError: null,
};

// Kreiramo Zustand store
export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,

  // Implementacije akcija
  selectVendor: (vendorId) => set((state) => {
    // Ako se menja salon, resetuj sve ostale odabire vezane za uslugu, datum i slot
    if (state.selectedVendorId !== vendorId) {
      return {
        selectedVendorId: vendorId,
        selectedServiceId: null,
        selectedDate: null,
        availableSlots: [],
        selectedSlot: null,
        bookingStatus: 'idle', // Resetuj i status rezervacije
        bookingError: null,
      };
    }
    return { selectedVendorId: vendorId };
  }),

  selectService: (serviceId) => set((state) => {
    // Ako se menja usluga, resetuj datum, dostupne slotove i odabrani slot
    if (state.selectedServiceId !== serviceId) {
      return {
        selectedServiceId: serviceId,
        selectedDate: null,
        availableSlots: [],
        selectedSlot: null,
      };
    }
    return { selectedServiceId: serviceId };
  }),

  selectDate: (date) => set({ 
    selectedDate: date, 
    availableSlots: [], // Resetuj slotove kada se datum promeni
    selectedSlot: null,  // Resetuj odabrani slot
  }),

  setAvailableSlots: (slots) => set({ availableSlots: slots }),

  selectSlot: (slot) => set({ selectedSlot: slot }),

  setBookingStatus: (status) => set({ bookingStatus: status }),

  setBookingError: (error) => set({ bookingError: error }),
  
  resetBookingState: () => set(initialState), // Vraća na kompletno inicijalno stanje

  // Pomoćne akcije za finiju kontrolu resetovanja ako zatreba
  resetServiceAndBelow: () => set({
    selectedServiceId: null,
    selectedDate: null,
    availableSlots: [],
    selectedSlot: null,
  }),

  resetDateAndSlots: () => set({
    selectedDate: null,
    availableSlots: [],
    selectedSlot: null,
  }),
}));
