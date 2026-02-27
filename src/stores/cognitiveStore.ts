/**
 * cognitiveStore.ts — Global Zustand Store
 *
 * Central nervous system of the NeuroAdaptive OS. All biometric telemetry,
 * cognitive load scoring, and UI state flags flow through this store.
 *
 * Consumers:
 *  - useCognitiveMonitor.ts  → writes metrics/score/classification
 *  - CrisisMode.tsx          → reads loadScore, writes crisisActive
 *  - Dashboard.tsx           → reads everything
 *  - BodyDoubling.tsx        → reads classification
 *  - AuthGuard / App.tsx     → reads onboardingComplete
 *  - useDemoSimulator.ts     → writes metrics via updateMetrics
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CognitiveClassification =
  | 'hyperfocus'
  | 'normal'
  | 'approaching_overload'
  | 'overload';

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
  // ── Telemetry ─────────────────────────────────────────────────────────────
  metrics: CognitiveMetrics;
  cognitiveLoadScore: number;
  classification: CognitiveClassification;

  // ── UI flags ──────────────────────────────────────────────────────────────
  permissionsGranted: boolean;
  onboardingComplete: boolean;

  /** True while the Crisis Mode full-screen takeover is mounted.
   *  Prevents other UI layers from rendering modals on top. */
  crisisActive: boolean;

  /** Current task category label — used by BodyDoubling to generate
   *  deterministic Jitsi room names. */
  currentTaskCategory: string;

  // ── Actions ───────────────────────────────────────────────────────────────
  updateMetrics: (
    metrics: Partial<CognitiveMetrics>,
    score: number,
    classification: CognitiveClassification,
  ) => void;
  setPermissionsGranted: (granted: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setCrisisActive: (active: boolean) => void;
  setCurrentTaskCategory: (category: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

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
  crisisActive: false,
  currentTaskCategory: 'deep-work',

  updateMetrics: (newMetrics, score, classification) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
      cognitiveLoadScore: score,
      classification,
    })),

  setPermissionsGranted: (granted) => set({ permissionsGranted: granted }),
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
  setCrisisActive: (active) => set({ crisisActive: active }),
  setCurrentTaskCategory: (category) => set({ currentTaskCategory: category }),
}));