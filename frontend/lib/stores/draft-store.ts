// File: lib/stores/draft-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface DraftState {
  drafts: Record<string, any>;
  saveDraft: (key: string, data: any) => void;
  getDraft: (key: string) => any;
  clearDraft: (key: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (key, data) => set((state) => ({ drafts: { ...state.drafts, [key]: data } })),
      getDraft: (key) => get().drafts[key],
      clearDraft: (key) => set((state) => {
        const newDrafts = { ...state.drafts };
        delete newDrafts[key];
        return { drafts: newDrafts };
      }),
    }),
    {
      name: 'lcbp3-form-drafts',
      storage: createJSONStorage(() => localStorage),
    }
  )
);