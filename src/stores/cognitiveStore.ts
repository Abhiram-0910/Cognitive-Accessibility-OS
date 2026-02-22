import { create } from 'zustand';

export type CognitiveClassification = 'hyperfocus' | 'normal' | 'approaching_overload' | 'overload';

export interface CognitiveMetrics {
  keystrokesPerMinute: number;
  errorRate: number;
  pauseFrequency: number;
  contextSwitches: number;
  facialTension: number; 
  gazeWander: number;
  speechRate: number;
  vocalEnergy: number;
}

interface CognitiveState {
  metrics: CognitiveMetrics;
  cognitiveLoadScore: number;
  classification: CognitiveClassification;
  permissionsGranted: boolean; // <--- NEW STATE
  updateMetrics: (
    metrics: Partial<CognitiveMetrics>,
    score: number,
    classification: CognitiveClassification
  ) => void;
  setPermissionsGranted: (granted: boolean) => void; // <--- NEW ACTION
}

export const useCognitiveStore = create<CognitiveState>((set) => ({
  metrics: {
    keystrokesPerMinute: 0,
    errorRate: 0,
    pauseFrequency: 0,
    contextSwitches: 0,
    facialTension: 0,
    gazeWander: 0,
    speechRate: 0,
    vocalEnergy: 0,
  },
  cognitiveLoadScore: 0,
  classification: 'normal',
  permissionsGranted: false, // Default to false (Zero-Trust)
  updateMetrics: (newMetrics, score, classification) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
      cognitiveLoadScore: score,
      classification,
    })),
  setPermissionsGranted: (granted) => set({ permissionsGranted: granted }),
}));