import { create } from 'zustand';

type CursorVariant = 'default' | 'link' | 'text' | 'pressed' | 'button';

interface CursorState {
  variant: CursorVariant;
  setVariant: (variant: CursorVariant) => void;
}

export const useCursorStore = create<CursorState>((set) => ({
  variant: 'default',
  setVariant: (variant) => set({ variant }),
})); 