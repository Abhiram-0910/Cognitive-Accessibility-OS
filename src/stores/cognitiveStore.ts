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
  permissionsGranted: boolean;
  // ── Onboarding gate ──────────────────────────────────────────────────────
  // Stored in Zustand so Onboarding.tsx can set it to true immediately before
  // navigate(), bypassing the async AuthGuard re-check race condition.
  onboardingComplete: boolean;
  updateMetrics: (
    metrics: Partial<CognitiveMetrics>,
    score: number,
    classification: CognitiveClassification
  ) => void;
  setPermissionsGranted: (granted: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
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
  permissionsGranted: false,
  onboardingComplete: false,
  updateMetrics: (newMetrics, score, classification) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
      cognitiveLoadScore: score,
      classification,
    })),
  setPermissionsGranted: (granted) => set({ permissionsGranted: granted }),
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
}));