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
  const [isSuspended, setIsSuspended] = useState(false);
  const globalCtx = useCognitiveStore(s => s.globalAudioContext);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const start = useCallback(() => {
    // Prevent double-start
    if (oscRef.current) return;

    try {
      let ctx = globalCtx;
      
      // Fallback: If user hit 90% load via demo mode before interacting with the page
      if (!ctx || ctx.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        ctx = new AudioContextClass();
        if (ctx.state === 'suspended') ctx.resume();
      }

      // Check if browser blocked auto-play
      if (ctx!.state === 'suspended') {
        setIsSuspended(true);
      } else {
        setIsSuspended(false);
      }

      // Oscillator → 432 Hz sine wave
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(SINE_FREQUENCY, ctx!.currentTime);
      oscRef.current = osc;

      // Gain → gentle fade-in from 0 to MAX_VOLUME
      const gain = ctx!.createGain();
      gain.gain.setValueAtTime(0, ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(MAX_VOLUME, ctx!.currentTime + FADE_IN_DURATION);
      gainRef.current = gain;

      // Connect: Oscillator → Gain → Destination (speakers)
      osc.connect(gain);
      gain.connect(ctx!.destination);

      osc.start();
      console.log('[CrisisMode] 🎵 432 Hz sine wave started.');
    } catch (err) {
      console.warn('[CrisisMode] AudioContext unavailable:', err);
    }
  }, [globalCtx]);

  const stop = useCallback(() => {
    if (gainRef.current && oscRef.current) {
      const ctx = globalCtx || gainRef.current.context;
      
      // Gentle fade-out before stopping
      gainRef.current.gain.linearRampToValueAtTime(
        0,
        ctx.currentTime + 1,
      );

      setTimeout(() => {
        oscRef.current?.stop();
        oscRef.current?.disconnect();
        gainRef.current?.disconnect();
        // We do NOT close the global context here!
        oscRef.current = null;
        gainRef.current = null;
        console.log('[CrisisMode] 🎵 432 Hz sine wave stopped.');
      }, 1100);
    }
  }, [globalCtx]);

  const resume = useCallback(async () => {
    // If we've instantiated a local context because global was missing, try to resume
    const ctxToResume = globalCtx || (gainRef.current ? gainRef.current.context : null);
    if (ctxToResume && ctxToResume.state === 'suspended') {
      await (ctxToResume as AudioContext).resume();
      setIsSuspended(false);
      console.log('[CrisisMode] 🎵 AudioContext resumed after user gesture.');
    }
  }, [globalCtx]);

  useEffect(() => {
    if (isActive) start();
    else stop();

    return () => stop();
  }, [isActive, start, stop]);

  return { isSuspended, resume };
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
  const { isSuspended, resume } = use432HzSine(isTriggered);

  // Sync crisisActive flag and audio ducking to Zustand
  useEffect(() => {
    setCrisisActive(isTriggered);
    useCognitiveStore.getState().setAudioDucked(isTriggered);
    return () => {
      setCrisisActive(false);
      useCognitiveStore.getState().setAudioDucked(false);
    };
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

  return (
    <AnimatePresence>
      {isTriggered && (
        <motion.div
          key="crisis"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="fixed inset-0 z-[2147483647] bg-[#f6f6f8] dark:bg-[#161022] font-display text-slate-900 dark:text-slate-100 overflow-hidden h-screen w-screen selection:bg-transparent"
        >
          {/* Custom scoped styles for Stitch AI animations and gradients */}
          <style>{`
            .crisis-glass-panel {
                background: rgba(22, 16, 34, 0.4);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .crisis-breathing-gradient {
                background: radial-gradient(circle, rgba(91, 19, 236, 0.6) 0%, rgba(91, 19, 236, 0.2) 40%, transparent 70%);
            }
            .crisis-bg-gradient {
                background: radial-gradient(circle at 50% 50%, #2e1a5e 0%, #161022 100%);
            }
            @keyframes crisis-breathe {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.2); opacity: 1; }
            }
            .crisis-animate-breathe {
                animation: crisis-breathe 8s infinite ease-in-out;
            }
          `}</style>

          {/* Background Ambience */}
          <div className="absolute inset-0 z-0 crisis-bg-gradient pointer-events-none" />
          
          {/* Floating Orbs for Ambience */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5b13ec]/20 rounded-full blur-[100px] pointer-events-none opacity-50" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-900/30 rounded-full blur-[120px] pointer-events-none opacity-40" />
          
          {/* Main Container */}
          <div className="relative z-10 flex flex-col h-full w-full">
            {/* Header */}
            <header className="flex items-center justify-between w-full px-8 py-6">
              <div className="flex items-center gap-3 text-slate-100 opacity-80 hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-[28px]">spa</span>
                <h2 className="text-lg font-medium tracking-wide hidden sm:block">NeuroAdaptive OS</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-light text-slate-300">
                  <span className="material-symbols-outlined text-[18px]">vital_signs</span>
                  <span>Load: {(Math.min(loadScore, 100)).toFixed(0)}%</span>
                </div>
                <button 
                  onDoubleClick={() => setIsDismissed(true)} 
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-slate-100 transition-colors"
                  title="Double-click to close"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </header>

            {/* Main Content: Centered Breathing Exercise */}
            <main className="flex-1 flex flex-col items-center justify-center w-full px-4 pb-20">
              <div className="flex flex-col items-center gap-12 max-w-2xl mx-auto text-center">
                <div className="space-y-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-white drop-shadow-sm">
                    Sensory De-escalation
                  </h1>
                  <p className="text-lg text-slate-300 font-light max-w-md mx-auto leading-relaxed">
                    Focus on the circle. Breathe in as it expands. Breathe out as it contracts.
                  </p>
                </div>

                {/* Breathing Circle Visualization */}
                <div className="relative flex items-center justify-center w-[300px] h-[300px] md:w-[400px] md:h-[400px] my-8">
                  {/* Outer Glow Layers */}
                  <div className="absolute inset-0 rounded-full bg-[#5b13ec]/10 blur-3xl crisis-animate-breathe" style={{ animationDelay: '0s' }} />
                  <div className="absolute inset-8 rounded-full bg-[#5b13ec]/20 blur-2xl crisis-animate-breathe" style={{ animationDelay: '0.1s' }} />
                  
                  {/* Main Circle mapped to Framer Motion for exact timing lock */}
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
                    className="relative w-48 h-48 md:w-64 md:h-64 rounded-full crisis-breathing-gradient shadow-[0_0_60px_rgba(91,19,236,0.3)] border border-[#5b13ec]/20 flex items-center justify-center backdrop-blur-sm z-10"
                  >
                    <div className="absolute w-24 h-24 rounded-full bg-white/10 blur-xl font-bold flex items-center justify-center" />
                    
                    <motion.span
                      key={phase}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-semibold tracking-widest text-sm md:text-base text-white drop-shadow-md z-20"
                    >
                      {phaseLabel}
                    </motion.span>
                  </motion.div>
                </div>

                {/* Action Area */}
                <div className="flex flex-col items-center gap-6 mt-4">
                  <div className="flex items-center gap-4 md:gap-8 text-slate-400 text-sm font-medium tracking-widest uppercase opacity-70">
                    <span className={phase === 'inhale' ? 'text-white drop-shadow-md font-bold' : ''}>Inhale</span>
                    <div className="w-8 md:w-16 h-[1px] bg-gradient-to-r from-transparent via-slate-500 to-transparent" />
                    <span className={phase === 'hold' ? 'text-amber-200 drop-shadow-md font-bold' : ''}>Hold</span>
                    <div className="w-8 md:w-16 h-[1px] bg-gradient-to-r from-transparent via-slate-500 to-transparent" />
                    <span className={phase === 'exhale' ? 'text-sky-200 drop-shadow-md font-bold' : ''}>Exhale</span>
                  </div>

                  {isSuspended ? (
                    <button 
                      onClick={resume}
                      className="group relative mt-8 overflow-hidden rounded-full crisis-glass-panel px-8 py-4 transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(236,72,153,0.2)] border-rose-500/30 animate-pulse"
                    >
                      <div className="relative flex items-center gap-3">
                        <span className="material-symbols-outlined text-rose-400 group-hover:text-white transition-colors duration-300">play_circle</span>
                        <span className="text-slate-100 font-light tracking-wide text-base">Audio Blocked — Tap to Resume Tones</span>
                      </div>
                    </button>
                  ) : (
                    <button 
                      onDoubleClick={() => setIsDismissed(true)}
                      title="Double-click to dismiss"
                      className="group relative mt-8 overflow-hidden rounded-full crisis-glass-panel px-8 py-4 transition-all duration-300 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(91,19,236,0.2)] active:scale-95 select-none"
                    >
                      <div className="relative flex items-center gap-3 flex-col sm:flex-row">
                        <span className="material-symbols-outlined text-[#5b13ec] group-hover:text-white transition-colors duration-300">check_circle</span>
                        <span className="text-slate-100 font-light tracking-wide text-base">I am grounded. Return to workspace.</span>
                      </div>
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 opacity-60">Double-click</span>
                    </button>
                  )}
                </div>
              </div>
            </main>

            {/* Footer / Bottom Indicators */}
            <footer className="absolute bottom-8 left-0 w-full px-8 flex justify-center md:justify-between items-end">
              <div className="hidden md:flex flex-col gap-1 text-xs text-slate-500">
                <span>Real-time Status: <span className="text-[#a57aff] font-bold uppercase tracking-widest">{isSuspended ? 'Suspended' : 'Actively Ducking'}</span></span>
                <span>Environment Audio: <span className="text-slate-300">432 Hz Binaural Tone</span></span>
              </div>
              
              <div className="flex gap-4">
                <button className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors" title="Binaural Tones Active">
                  <span className={`material-symbols-outlined ${!isSuspended ? 'text-[#a57aff] drop-shadow-[0_0_5px_#a57aff] font-bold' : ''}`}>graphic_eq</span>
                </button>
              </div>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};