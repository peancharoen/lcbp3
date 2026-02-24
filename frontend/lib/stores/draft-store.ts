// File: lib/stores/draft-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** A draft can hold any serializable form data — typed as unknown for strictness */
type DraftValue = Record<string, unknown>;

interface DraftState {
  drafts: Record<string, DraftValue>;
  saveDraft: (key: string, data: DraftValue) => void;
  getDraft: (key: string) => DraftValue | undefined;
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
