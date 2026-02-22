import { create } from 'zustand';

export type CognitiveClassification = 'hyperfocus' | 'normal' | 'approaching_overload' | 'overload';

export interface CognitiveMetrics {
  keystrokesPerMinute: number;
  errorRate: number;
  pauseFrequency: number;
  contextSwitches: number;
  // New Biometric Signals
  facialTension: number; 
  gazeWander: number;
  speechRate: number;
  vocalEnergy: number;
}

interface CognitiveState {
  metrics: CognitiveMetrics;
  cognitiveLoadScore: number;
  classification: CognitiveClassification;
  updateMetrics: (
    metrics: Partial<CognitiveMetrics>,
    score: number,
    classification: CognitiveClassification
  ) => void;
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
  updateMetrics: (newMetrics, score, classification) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
      cognitiveLoadScore: score,
      classification,
    })),
}));