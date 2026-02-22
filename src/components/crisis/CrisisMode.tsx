import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const CrisisMode: React.FC = () => {
  const loadScore = useCognitiveStore((state) => state.cognitiveLoadScore);
  const [isDismissed, setIsDismissed] = useState(false);

  // Re-arm the crisis takeover only after the user returns to a safe baseline
  useEffect(() => {
    if (loadScore < 80 && isDismissed) {
      setIsDismissed(false);
    }
  }, [loadScore, isDismissed]);

  // Lock body scroll when active
  useEffect(() => {
    if (loadScore >= 91 && !isDismissed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [loadScore, isDismissed]);

  // Only render if threshold is breached and it hasn't been manually dismissed
  if (loadScore < 91 || isDismissed) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 text-slate-50 selection:bg-transparent">
      
      {/* Calming Header */}
      <div className="absolute top-24 text-center animate-in fade-in slide-in-from-top-8 duration-1000">
        <h1 className="text-3xl font-light tracking-wide text-white mb-2">
          You're safe.
        </h1>
        <p className="text-lg text-slate-400 font-medium">
          Let's slow things down.
        </p>
      </div>

      {/* 4-7-8 Breathing Visualizer */}
      <div className="relative flex items-center justify-center w-64 h-64 mt-12">
        <motion.div
          animate={{
            scale: [1, 1.8, 1.8, 1],
            opacity: [0.3, 0.7, 0.7, 0.3],
          }}
          transition={{
            duration: 19, // 4 + 7 + 8 = 19 seconds total
            times: [0, 0.21, 0.58, 1], // Normalized timing for 4s, 11s, 19s
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute w-32 h-32 bg-teal-500 rounded-full blur-2xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.8, 1.8, 1],
          }}
          transition={{
            duration: 19,
            times: [0, 0.21, 0.58, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative z-10 w-32 h-32 bg-teal-400 rounded-full shadow-2xl flex items-center justify-center opacity-90"
        >
          <motion.span 
            animate={{ opacity: [1, 0, 1, 0, 1] }}
            transition={{ duration: 19, times: [0, 0.2, 0.21, 0.57, 0.58], repeat: Infinity }}
            className="text-teal-900 font-semibold tracking-widest text-sm"
          >
            BREATHE
          </motion.span>
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-48 text-center text-slate-500 text-sm animate-in fade-in duration-1000 delay-500">
        <p>Inhale for 4s. Hold for 7s. Exhale for 8s.</p>
      </div>

      {/* Foolproof Dismissal (Requires Double Click) */}
      <div className="absolute bottom-24 flex flex-col items-center">
        <button
          onDoubleClick={() => setIsDismissed(true)}
          className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white font-medium transition-colors select-none"
        >
          I'm okay
        </button>
        <span className="text-xs text-slate-500 mt-3 select-none">
          Double-click to dismiss
        </span>
      </div>
    </div>
  );
};