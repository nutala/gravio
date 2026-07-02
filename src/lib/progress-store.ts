import { create } from "zustand";
import { persist } from "zustand/middleware";

export const ALL_VARIANTS = "__all__";

interface ProgressSettings {
  ex1Id: string;
  ex1VariantId: string;
  ex2Id: string;
  ex2VariantId: string;
  setEx1Id: (id: string) => void;
  setEx1VariantId: (id: string) => void;
  setEx2Id: (id: string) => void;
  setEx2VariantId: (id: string) => void;
}

export const useProgressStore = create<ProgressSettings>()(
  persist(
    (set) => ({
      ex1Id: "",
      ex1VariantId: ALL_VARIANTS,
      ex2Id: "",
      ex2VariantId: ALL_VARIANTS,
      setEx1Id: (id) => set({ ex1Id: id, ex1VariantId: ALL_VARIANTS }),
      setEx2Id: (id) => set({ ex2Id: id, ex2VariantId: ALL_VARIANTS }),
      setEx1VariantId: (id) => set({ ex1VariantId: id }),
      setEx2VariantId: (id) => set({ ex2VariantId: id }),
    }),
    { name: "calitrack-progress-settings" },
  ),
);
