/**
 * CrisisMode.tsx — Full-Screen Emergency Override
 *
 * Activates when cognitiveLoadScore > 90 (from any source: edge-ML, demo
 * simulator, or manual override).
 *
 * Features:
 *  ✅ Highest z-index full-screen DOM takeover with body scroll lock
 *  ✅ 432 Hz binaural sine wave via native AudioContext + gentle GainNode fade-in
 *  ✅ 4-7-8 breathing circle (Framer Motion) with phase labels
 *  ✅ Auto re-arms after dismissal once score drops below 80
 *  ✅ Foolproof double-click dismissal to prevent accidental exit
 *  ✅ Writes `crisisActive` flag to Zustand so other UI layers can yield
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveStore } from '../../stores/cognitiveStore';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Load score threshold that triggers the crisis takeover. */
const CRISIS_THRESHOLD = 90;
/** Load score below which the crisis re-arms after dismissal. */
const REARM_THRESHOLD = 80;
/** Frequency of the calming sine wave (Hz). 432 Hz is widely considered
 *  a soothing, "healing" frequency used in sound therapy. */
const SINE_FREQUENCY = 432;
/** Duration of the GainNode fade-in (seconds). */
const FADE_IN_DURATION = 3;
/** Maximum volume for the sine wave (0.0 – 1.0). Kept low to be ambient. */
const MAX_VOLUME = 0.12;
/** 4-7-8 breathing cycle = 19 seconds total. */
const BREATH_CYCLE_S = 19;

// ─── Breathing phase labels ──────────────────────────────────────────────────

type BreathPhase = 'inhale' | 'hold' | 'exhale';

function useBreathPhase(): BreathPhase {
  const [phase, setPhase] = useState<BreathPhase>('inhale');

  useEffect(() => {
    let isMounted = true;

    const cycle = () => {
      if (!isMounted) return;
      setPhase('inhale');
      setTimeout(() => { if (isMounted) setPhase('hold'); }, 4000);
      setTimeout(() => { if (isMounted) setPhase('exhale'); }, 11000);
      setTimeout(() => { if (isMounted) cycle(); }, 19000);
    };

    cycle();
    return () => { isMounted = false; };
  }, []);

  return phase;
}

// ─── 432 Hz Sine Wave Generator ──────────────────────────────────────────────

function use432HzSine(isActive: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const start = useCallback(() => {
    // Prevent double-start
    if (ctxRef.current) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctxRef.current = ctx;

      // Oscillator → 432 Hz sine wave
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(SINE_FREQUENCY, ctx.currentTime);
      oscRef.current = osc;

      // Gain → gentle fade-in from 0 to MAX_VOLUME
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(MAX_VOLUME, ctx.currentTime + FADE_IN_DURATION);
      gainRef.current = gain;

      // Connect: Oscillator → Gain → Destination (speakers)
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      console.log('[CrisisMode] 🎵 432 Hz sine wave started.');
    } catch (err) {
      console.warn('[CrisisMode] AudioContext unavailable:', err);
    }
  }, []);

  const stop = useCallback(() => {
    if (gainRef.current && ctxRef.current) {
      // Gentle fade-out before stopping
      gainRef.current.gain.linearRampToValueAtTime(
        0,
        ctxRef.current.currentTime + 1,
      );
    }

    setTimeout(() => {
      oscRef.current?.stop();
      oscRef.current?.disconnect();
      gainRef.current?.disconnect();
      ctxRef.current?.close();
      ctxRef.current = null;
      oscRef.current = null;
      gainRef.current = null;
      console.log('[CrisisMode] 🎵 432 Hz sine wave stopped.');
    }, 1100);
  }, []);

  useEffect(() => {
    if (isActive) start();
    else stop();

    return () => stop();
  }, [isActive, start, stop]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CrisisMode: React.FC = () => {
  const loadScore = useCognitiveStore((s) => s.cognitiveLoadScore);
  const setCrisisActive = useCognitiveStore((s) => s.setCrisisActive);

  const [isDismissed, setIsDismissed] = useState(false);

  const isTriggered = loadScore > CRISIS_THRESHOLD && !isDismissed;

  // Breath phase label
  const phase = useBreathPhase();

  // 432 Hz audio
  use432HzSine(isTriggered);

  // Sync crisisActive flag to Zustand
  useEffect(() => {
    setCrisisActive(isTriggered);
    return () => setCrisisActive(false);
  }, [isTriggered, setCrisisActive]);

  // Re-arm after load drops to safe levels
  useEffect(() => {
    if (loadScore < REARM_THRESHOLD && isDismissed) {
      setIsDismissed(false);
    }
  }, [loadScore, isDismissed]);

  // Lock body scroll
  useEffect(() => {
    if (isTriggered) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isTriggered]);

  // ─── Phase-dependent label + colour ─────────────────────────────────────
  const phaseLabel =
    phase === 'inhale' ? 'Breathe In…' :
    phase === 'hold'   ? 'Hold…' :
    'Breathe Out…';

  const phaseColour =
    phase === 'inhale' ? 'text-teal-300' :
    phase === 'hold'   ? 'text-amber-300' :
    'text-sky-300';

  return (
    <AnimatePresence>
      {isTriggered && (
        <motion.div
          key="crisis"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-50 selection:bg-transparent"
          style={{ zIndex: 2147483647 }}
        >
          {/* Ambient background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 pointer-events-none" />

          {/* Header */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="absolute top-20 text-center z-10"
          >
            <h1 className="text-3xl font-light tracking-wide text-white mb-2">
              You're safe.
            </h1>
            <p className="text-lg text-slate-400 font-medium">
              Let's slow things down.
            </p>
          </motion.div>

          {/* ── 4-7-8 Breathing Visualizer ─────────────────────────────────── */}
          <div className="relative flex items-center justify-center w-72 h-72 z-10">
            {/* Outer glow ring */}
            <motion.div
              animate={{
                scale: [1, 1.9, 1.9, 1],
                opacity: [0.15, 0.4, 0.4, 0.15],
              }}
              transition={{
                duration: BREATH_CYCLE_S,
                times: [0, 4 / 19, 11 / 19, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute w-40 h-40 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.6), transparent 70%)' }}
            />

            {/* Middle ring */}
            <motion.div
              animate={{
                scale: [1, 1.7, 1.7, 1],
                opacity: [0.3, 0.6, 0.6, 0.3],
              }}
              transition={{
                duration: BREATH_CYCLE_S,
                times: [0, 4 / 19, 11 / 19, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute w-36 h-36 bg-teal-500/30 rounded-full blur-xl"
            />

            {/* Core breathing circle */}
            <motion.div
              animate={{
                scale: [1, 1.8, 1.8, 1],
              }}
              transition={{
                duration: BREATH_CYCLE_S,
                times: [0, 4 / 19, 11 / 19, 1],
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative z-10 w-36 h-36 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full shadow-2xl
                         flex items-center justify-center"
              style={{ boxShadow: '0 0 60px rgba(45,212,191,0.4)' }}
            >
              <motion.span
                key={phase}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`font-semibold tracking-widest text-xs ${phaseColour === 'text-teal-300' ? 'text-teal-950' : 'text-white'}`}
              >
                {phaseLabel}
              </motion.span>
            </motion.div>
          </div>

          {/* Phase timing guide */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-48 z-10 flex gap-6 text-sm"
          >
            <span className={`transition-colors duration-500 ${phase === 'inhale' ? 'text-teal-300 font-bold' : 'text-slate-600'}`}>
              Inhale 4s
            </span>
            <span className={`transition-colors duration-500 ${phase === 'hold' ? 'text-amber-300 font-bold' : 'text-slate-600'}`}>
              Hold 7s
            </span>
            <span className={`transition-colors duration-500 ${phase === 'exhale' ? 'text-sky-300 font-bold' : 'text-slate-600'}`}>
              Exhale 8s
            </span>
          </motion.div>

          {/* 432 Hz indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-36 z-10 flex items-center gap-2 text-xs text-slate-500"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            432 Hz Binaural Tone Active
          </motion.div>

          {/* Dismiss button — double-click only */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
            className="absolute bottom-16 flex flex-col items-center z-10"
          >
            <button
              onDoubleClick={() => setIsDismissed(true)}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20
                         rounded-full text-white font-medium transition-colors select-none
                         active:scale-95"
            >
              I'm okay
            </button>
            <span className="text-xs text-slate-600 mt-3 select-none">
              Double-click to dismiss
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};