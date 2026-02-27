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
 *  - AuthGuard / App.tsx     → reads onboardingComplete, userRole
 *  - useDemoSimulator.ts     → writes metrics via updateMetrics
 *  - RoleGuard (App.tsx)     → reads userRole for RBAC routing
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'employee' | 'child' | 'parent';

export type CognitiveClassification =
  | 'hyperfocus'
  | 'normal'
  | 'approaching_overload'
  | 'overload';

export interface AudioSettings {
  binauralVolume: number;
  ambientVolume: number;
  uiFeedbackVolume: number;
  isMuted: boolean;
}

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
  isHeuristic: boolean;

  // ── Global Audio ──────────────────────────────────────────────────────────
  globalAudioContext: AudioContext | null;
  audioSettings: AudioSettings;
  isAudioDucked: boolean;
  isHardwareMuted: boolean;

  // ── UI flags ──────────────────────────────────────────────────────────────
  userRole: UserRole | null;
  permissionsGranted: boolean;
  onboardingComplete: boolean;
  isOfflineMode: boolean;

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
    isHeuristic?: boolean
  ) => void;
  setPermissionsGranted: (granted: boolean) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setCrisisActive: (active: boolean) => void;
  setCurrentTaskCategory: (category: string) => void;
  setUserRole: (role: UserRole | null) => void;
  setOfflineMode: (offline: boolean) => void;
  setGlobalAudioContext: (ctx: AudioContext | null) => void;
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  setAudioDucked: (ducked: boolean) => void;
  setHardwareMuted: (muted: boolean) => void;
  juggleAudioContext: () => void;
  activeHeavyCompute: boolean;
  setActiveHeavyCompute: (active: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCognitiveStore = create<CognitiveState>((set, get) => ({
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
  isHeuristic: false,
  userRole: null,
  permissionsGranted: false,
  onboardingComplete: false,
  crisisActive: false,
  isOfflineMode: !navigator.onLine,
  globalAudioContext: null,
  audioSettings: {
    binauralVolume: 0.5,
    ambientVolume: 0.3,
    uiFeedbackVolume: 0.5,
    isMuted: false,
  },
  isAudioDucked: false,
  isHardwareMuted: false,
  activeHeavyCompute: false,
  currentTaskCategory: 'deep-work',

  updateMetrics: (newMetrics, score, classification, isHeuristic = false) =>
    set((state) => ({
      metrics: { ...state.metrics, ...newMetrics },
      cognitiveLoadScore: score,
      classification,
      isHeuristic,
    })),

  setPermissionsGranted: (granted) => set({ permissionsGranted: granted }),
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
  setCrisisActive: (active) => set({ crisisActive: active }),
  setCurrentTaskCategory: (category) => set({ currentTaskCategory: category }),
  setUserRole: (role) => set({ userRole: role }),
  setOfflineMode: (offline) => set({ isOfflineMode: offline }),
  setGlobalAudioContext: (ctx) => set({ globalAudioContext: ctx }),
  updateAudioSettings: (newSettings) =>
    set((state) => {
      const updated = { ...state.audioSettings, ...newSettings };
      localStorage.setItem('neuroadapt_audio_prefs', JSON.stringify(updated));
      return { audioSettings: updated };
    }),
  setAudioDucked: (ducked) => set({ isAudioDucked: ducked }),
  setHardwareMuted: (muted) => set({ isHardwareMuted: muted }),
  juggleAudioContext: () => {
    const ctx = get().globalAudioContext;
    if (ctx && ctx.state === 'suspended') {
      try {
        ctx.resume().then(() => {
          if (ctx.state === 'running') {
            ctx.suspend().catch(() => {});
          }
        }).catch(() => {});
      } catch (err) {
        // Suppress errors to prevent console spam if browser blocks state change
      }
    }
  },
  setActiveHeavyCompute: (active) => set({ activeHeavyCompute: active }),
}));
