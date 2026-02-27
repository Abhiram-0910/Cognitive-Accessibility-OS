/**
 * LiveStressPanel.tsx
 * Real-time biometric output panel for the main Dashboard.
 * Shows Stress Level, Focus State, BPM estimate, and raw metric bars.
 * Subscribes to Zustand cognitiveStore — updates every 2 seconds via the monitor.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Brain, Heart, Zap, Eye } from 'lucide-react';
import { useCognitiveStore } from '../../stores/cognitiveStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stressLabel(score: number): { text: string; colour: string; bg: string } {
  if (score <= 25) return { text: 'Low',      colour: 'text-emerald-600', bg: 'bg-emerald-400' };
  if (score <= 55) return { text: 'Moderate', colour: 'text-teal-600',    bg: 'bg-teal-400'    };
  if (score <= 75) return { text: 'Elevated', colour: 'text-amber-600',   bg: 'bg-amber-400'   };
  return              { text: 'High',      colour: 'text-rose-600',   bg: 'bg-rose-500'    };
}

function focusLabel(cls: string): { text: string; colour: string } {
  switch (cls) {
    case 'hyperfocus':         return { text: 'Hyperfocus',  colour: 'text-indigo-600' };
    case 'normal':             return { text: 'Nominal',     colour: 'text-emerald-600' };
    case 'approaching_overload': return { text: 'Drifting',  colour: 'text-amber-600' };
    default:                   return { text: 'Overloaded',  colour: 'text-rose-600' };
  }
}

// BPM is derived heuristically from keystroke cadence + vocal energy
function estimateBPM(kpm: number, vocalEnergy: number, stress: number): number {
  const base = 65;
  const fromStress = stress * 0.6;
  const fromKPM    = Math.min(kpm / 5, 20);
  const fromVoice  = vocalEnergy * 0.15;
  return Math.round(Math.min(160, base + fromStress + fromKPM + fromVoice));
}

// ─── Mini metric bar ──────────────────────────────────────────────────────────
const MetricBar: React.FC<{
  label: string;
  value: number;       // 0–100
  colour: string;      // Tailwind bg class
  icon: React.ReactNode;
}> = ({ label, value, colour, icon }) => (
  <div className="flex items-center gap-3">
    <div className="w-5 h-5 flex-shrink-0 text-slate-400">{icon}</div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-bold text-slate-600">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${colour}`}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const LiveStressPanel: React.FC = () => {
  const {
    cognitiveLoadScore,
    classification,
    metrics,
    permissionsGranted,
  } = useCognitiveStore();

  const stress  = stressLabel(cognitiveLoadScore);
  const focus   = focusLabel(classification);
  const bpm     = estimateBPM(
    metrics.keystrokesPerMinute,
    metrics.vocalEnergy,
    cognitiveLoadScore
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <Activity className="w-3.5 h-3.5 text-teal-500 animate-pulse" />
        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Live Biometrics</span>
        {!permissionsGranted && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 font-bold">
            Demo
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Top KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {/* Stress */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Zap className={`w-4 h-4 ${stress.colour}`} />
            <span className={`text-sm font-black ${stress.colour}`}>{stress.text}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Stress</span>
          </div>

          {/* Focus */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Brain className={`w-4 h-4 ${focus.colour}`} />
            <span className={`text-xs font-black ${focus.colour}`}>{focus.text}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Focus</span>
          </div>

          {/* BPM */}
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-black text-rose-500">{permissionsGranted ? bpm : '—'}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">Est. BPM</span>
          </div>
        </div>

        {/* Raw metric bars */}
        <div className="flex flex-col gap-3 pt-1 border-t border-slate-100">
          <MetricBar
            label="Facial Tension"
            value={metrics.facialTension}
            colour={stress.bg}
            icon={<Eye className="w-3.5 h-3.5" />}
          />
          <MetricBar
            label="Gaze Wander"
            value={metrics.gazeWander}
            colour="bg-violet-400"
            icon={<Eye className="w-3.5 h-3.5" />}
          />
          <MetricBar
            label="Voice Energy"
            value={metrics.vocalEnergy}
            colour="bg-sky-400"
            icon={<Activity className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Cognitive load bar */}
        <div className="pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              Cognitive Load Score
            </span>
            <span className="text-xs font-bold text-slate-700">
              {permissionsGranted ? `${Math.round(cognitiveLoadScore)} / 100` : '—'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${stress.bg}`}
              animate={{ width: permissionsGranted ? `${cognitiveLoadScore}%` : '0%' }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
