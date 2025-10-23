import { create } from 'zustand';

type GradientParams = {
  zoom: number;
  speed: number;
  grainAmount: number;
  grainSpeed: number;
};

type GradientStore = {
  params: GradientParams;
  setParams: (params: GradientParams) => void;
};

export const useGradientStore = create<GradientStore>((set) => ({
  params: {
    zoom: 0.3,
    speed: 0.05,
    grainAmount: 0.018,
    grainSpeed: 5.0
  },
  setParams: (params) => set({ params })
}));
