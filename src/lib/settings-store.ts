import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SoundProfile = 1 | 2 | 3;

interface SettingsStore {
  soundProfile: SoundProfile;
  setSoundProfile: (p: SoundProfile) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundProfile: 1,
      setSoundProfile: (p) => set({ soundProfile: p }),
    }),
    {
      name: "calitrack-settings",
      partialize: (state) => ({ soundProfile: state.soundProfile }),
    },
  ),
);
