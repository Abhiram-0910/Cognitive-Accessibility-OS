/**
 * TimerBar — Kids Module
 * Ported from: _legacy_repo_to_port/Frontend/src/components/TimerBar.js
 *
 * A visual progress bar driven by a live countdown.
 * The bar changes colour as time runs out:
 *   > 50%  → green gradient
 *   > 25%  → amber gradient
 *   ≤ 25%  → red gradient (pulses)
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TimerBarProps {
  /** Total seconds to count down from. Defaults to 120. */
  totalSeconds?: number;
  /** External time remaining — if provided, the bar becomes *controlled*. */
  timeRemaining?: number;
}

export default function TimerBar({ totalSeconds = 120, timeRemaining }: TimerBarProps) {
  // If timeRemaining is controlled from outside (Game.tsx passes it),
  // use that; otherwise maintain internal state.
  const [seconds, setSeconds] = useState(timeRemaining ?? totalSeconds);

  useEffect(() => {
    if (timeRemaining !== undefined) {
      setSeconds(timeRemaining);
      return; // controlled mode — parent owns the clock
    }
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev > 0) return prev - 1;
        clearInterval(timer);
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  const pct = (seconds / totalSeconds) * 100;

  const barColour =
    pct > 50
      ? 'from-emerald-400 to-green-500'
      : pct > 25
      ? 'from-amber-400 to-yellow-500'
      : 'from-rose-500 to-red-600';

  return (
    <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${barColour}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
