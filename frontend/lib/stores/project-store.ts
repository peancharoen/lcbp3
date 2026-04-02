// File: lib/stores/project-store.ts
// Change Log:
// - Created store for managing currently selected project context

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectState {
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      setSelectedProjectId: (projectId) => set({ selectedProjectId: projectId }),
    }),
    {
      name: 'project-storage',
    }
  )
);
