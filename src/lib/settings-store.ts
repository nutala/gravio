import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SoundProfile = 1 | 2 | 3 | 4;

export type AccentTheme =
  | "default"
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "sky"
  | "orange"
  | "fuchsia"
  | "cyan"
  | "lime";

export type WeightUnit = "kg" | "lb";

interface SettingsStore {
  soundProfile: SoundProfile;
  setSoundProfile: (p: SoundProfile) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (t: AccentTheme) => void;
  weightUnit: WeightUnit;
  setWeightUnit: (u: WeightUnit) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      soundProfile: 1,
      setSoundProfile: (p) => set({ soundProfile: p }),
      accentTheme: "default",
      setAccentTheme: (t) => set({ accentTheme: t }),
      weightUnit: "kg",
      setWeightUnit: (u) => set({ weightUnit: u }),
    }),
    {
      name: "calitrack-settings",
      partialize: (state) => ({
        soundProfile: state.soundProfile,
        accentTheme: state.accentTheme,
        weightUnit: state.weightUnit,
      }),
    },
  ),
);
