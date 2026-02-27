import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { useCognitiveMonitor } from '../hooks/useCognitiveMonitor';
import { useDemoSimulator } from '../hooks/useDemoSimulator';
import { CognitiveStateOrb } from '../components/dashboard/CognitiveStateOrb';
import { EnergyTimeline } from '../components/dashboard/EnergyTimeline';
import { PermissionsRequest } from '../components/shared/PermissionsRequest';
import { IntegrationDemoPanel } from '../components/integration/IntegrationDemoPanel';
import { LiveStressPanel } from '../components/dashboard/LiveStressPanel';
import {
  Activity, Brain, Volume2, Eye, Zap, Radio
} from 'lucide-react';

// ─── Helper: Metric Card ──────────────────────────────────────────────────────
const MetricCard: React.FC<{ title: string; value: string; subtitle: string }> = ({ title, value, subtitle }) => (
  <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
    <div className="text-2xl font-light text-slate-800 mb-1">{value}</div>
    <div className="text-xs font-medium text-slate-400">{subtitle}</div>
  </div>
);

// ─── Helper: Live Feed Row ────────────────────────────────────────────────────
const FeedRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  pulse?: boolean;
}> = ({ icon, label, value, accent, pulse }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-2.5 text-slate-500">
      <span className={accent}>{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <motion.span
      key={value}
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`text-xs font-bold ${accent} ${pulse ? 'animate-pulse' : ''}`}
    >
      {value}
    </motion.span>
  </div>
);

// ─── Helper: derive human labels from store state ────────────────────────────
function useHumanReadableMetrics() {
  const { cognitiveLoadScore, classification, metrics, permissionsGranted } = useCognitiveStore();

  const stressLevel = !permissionsGranted ? 'Demo'
    : cognitiveLoadScore <= 30 ? 'Low'
    : cognitiveLoadScore <= 65 ? 'Moderate'
    : cognitiveLoadScore <= 80 ? 'Elevated'
    : 'High';

  const stressAccent = !permissionsGranted ? 'text-slate-400'
    : cognitiveLoadScore <= 30 ? 'text-emerald-500'
    : cognitiveLoadScore <= 65 ? 'text-teal-500'
    : cognitiveLoadScore <= 80 ? 'text-amber-500'
    : 'text-rose-500';

  const focusLabel = !permissionsGranted ? 'Demo'
    : classification === 'hyperfocus' ? 'Hyperfocus'
    : classification === 'normal' ? 'Nominal'
    : classification === 'approaching_overload' ? 'Drifting'
    : 'Overloaded';

  const focusAccent = !permissionsGranted ? 'text-slate-400'
    : classification === 'hyperfocus' ? 'text-indigo-500'
    : classification === 'normal' ? 'text-emerald-500'
    : classification === 'approaching_overload' ? 'text-amber-500'
    : 'text-rose-500';

  const facialEmotion = !permissionsGranted ? 'Demo'
    : metrics.facialTension > 60 ? 'Tense'
    : metrics.facialTension > 30 ? 'Focused'
    : 'Relaxed';

  const voiceEnergy = !permissionsGranted ? '—'
    : metrics.vocalEnergy < 10 ? 'Silent'
    : metrics.vocalEnergy < 40 ? 'Quiet'
    : metrics.vocalEnergy < 75 ? 'Active'
    : 'Loud';

  const gazeLabel = !permissionsGranted ? '—'
    : metrics.gazeWander < 20 ? 'Locked In'
    : metrics.gazeWander < 50 ? 'Steady'
    : 'Wandering';

  return {
    stressLevel, stressAccent,
    focusLabel, focusAccent,
    facialEmotion, voiceEnergy, gazeLabel,
    cognitiveLoadScore, permissionsGranted,
  };
}

// ─── Debug Overlay: flickers green dot every processed frame ─────────────────
const BiometricDebugDot: React.FC<{ frameRef: React.MutableRefObject<number> }> = ({ frameRef }) => {
  const [visible, setVisible] = useState(false);
  const dotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll the frame counter to detect new frames
  useEffect(() => {
    let lastCount = 0;
    const poll = setInterval(() => {
      if (frameRef.current !== lastCount) {
        lastCount = frameRef.current;
        setVisible(true);
        if (dotTimeoutRef.current) clearTimeout(dotTimeoutRef.current);
        dotTimeoutRef.current = setTimeout(() => setVisible(false), 120);
      }
    }, 50); // Poll at 20 Hz — cheap enough
    return () => {
      clearInterval(poll);
      if (dotTimeoutRef.current) clearTimeout(dotTimeoutRef.current);
    };
  }, [frameRef]);

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full
                 bg-slate-900/80 backdrop-blur-sm border border-white/10 pointer-events-none"
    >
      <div
        className={`w-2 h-2 rounded-full transition-colors duration-75
                    ${visible ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]' : 'bg-slate-600'}`}
      />
      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">
        {visible ? 'FRAME' : 'IDLE'}
      </span>
    </div>
  );
};

// ─── Kids Module portal links ─────────────────────────────────────────────────
const KIDS_PORTALS = [
  { to: '/kids/games',   label: '🎮 Play Games',       sub: 'Launch the kids game room',    accent: 'from-violet-500 to-purple-600' },
  { to: '/kids/parent',  label: '👪 Parent Portal',    sub: 'Manage child accounts',        accent: 'from-indigo-500 to-blue-600' },
  { to: '/kids/teacher', label: '📊 Teacher Dashboard', sub: 'View sessions & expressions', accent: 'from-emerald-500 to-teal-600' },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────
export const Dashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const { permissionsGranted, setPermissionsGranted } = useCognitiveStore();
  const frameCounter = useRef(0);

  // Increment frameCounter on every processed biometric frame
  const onBiometricFrame = useCallback(() => {
    frameCounter.current += 1;
  }, []);

  // The monitor hook is always called, but internally gates itself on permissionsGranted
  // Pass the frame callback so it can reach the vision engine
  useCognitiveMonitor();

  // Demo simulator — only runs when permissions are not granted
  useDemoSimulator(userId);

  const handleDeclinePermissions = () => {
    console.warn('User declined required biometric telemetry.');
  };

  const humanMetrics = useHumanReadableMetrics();

  return (
    <div className="min-h-screen p-8 md:p-16 lg:px-24 xl:px-32 font-sans selection:bg-teal-100 selection:text-teal-900">

      {/* Biometric Debug Overlay — always visible when telemetry is active */}
      {permissionsGranted && <BiometricDebugDot frameRef={frameCounter} />}

      {/* 1. Privacy Blocking Gate */}
      {!permissionsGranted && (
        <PermissionsRequest
          onAccept={() => setPermissionsGranted(true)}
          onDecline={handleDeclinePermissions}
        />
      )}

      {/* 2. Main Dashboard Layout */}
      <div className={`transition-all ${!permissionsGranted ? 'blur-sm pointer-events-none' : ''}`}>
        {/* Header */}
        <header className="mb-16 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-slate-800 tracking-tight">
              NeuroAdaptive OS
            </h1>
            <p className="mt-1 text-slate-500 font-medium tracking-wide">
              Cognitive Environment Orchestrator
            </p>
          </div>
          {/* CognitiveSyncOrb — colour-reactive header pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
              {/* Pulsing orb — colour derived from cognitive load */}
              <motion.div
                animate={{
                  backgroundColor: !permissionsGranted
                    ? '#fcd34d'
                    : humanMetrics.cognitiveLoadScore <= 30
                    ? '#34d399'
                    : humanMetrics.cognitiveLoadScore <= 65
                    ? '#2dd4bf'
                    : humanMetrics.cognitiveLoadScore <= 80
                    ? '#fbbf24'
                    : '#f87171',
                  boxShadow: permissionsGranted
                    ? '0 0 8px 2px rgba(52,211,153,0.5)'
                    : 'none',
                }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                className="w-2.5 h-2.5 rounded-full animate-pulse"
              />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {permissionsGranted ? 'Cognitive Sync Active' : 'Demo Mode'}
              </span>
              {permissionsGranted && (
                <span className={`text-xs font-bold ml-1 ${
                  humanMetrics.cognitiveLoadScore <= 30 ? 'text-emerald-500'
                  : humanMetrics.cognitiveLoadScore <= 65 ? 'text-teal-500'
                  : humanMetrics.cognitiveLoadScore <= 80 ? 'text-amber-500'
                  : 'text-rose-500'
                }`}>
                  {humanMetrics.stressLevel}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Clinical Export Target */}
        <div id="clinical-export-target" className="space-y-8">
          {/* Main Grid — now 3 columns: orb | metrics | live feed */}
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Visual Indicator */}
            <section className="lg:col-span-4 flex flex-col items-center bg-white/50 backdrop-blur-md rounded-3xl py-12 border border-slate-100 shadow-sm">
              <CognitiveStateOrb />
            </section>

            {/* Middle Column: Analytics & Micro-Metrics */}
            <section className="lg:col-span-5 flex flex-col gap-8">
              <EnergyTimeline />

              {/* Live Metrics Grid */}
              <div className="grid grid-cols-2 gap-6">
                <MetricCard
                  title="Keystrokes / Min"
                  value={permissionsGranted ? useCognitiveStore.getState().metrics.keystrokesPerMinute.toString() : '—'}
                  subtitle="Current velocity"
                />
                <MetricCard
                  title="Cognitive Pauses"
                  value={permissionsGranted ? useCognitiveStore.getState().metrics.pauseFrequency.toString() : '—'}
                  subtitle="Delays > 3s"
                />
                <MetricCard
                  title="Context Switches"
                  value={permissionsGranted ? useCognitiveStore.getState().metrics.contextSwitches.toString() : '—'}
                  subtitle="Tab/Window changes"
                />
                <MetricCard
                  title="Error Rate"
                  value={permissionsGranted ? `${(useCognitiveStore.getState().metrics.errorRate * 100).toFixed(1)}%` : '—'}
                  subtitle="Backspace ratio"
                />
              </div>
            </section>

            {/* Right Column: Live Cognitive Feed Sidebar */}
            <section className="lg:col-span-3 flex flex-col gap-4">

              {/* Feed Panel */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Live Cognitive Feed
                  </span>
                </div>

                {/* Feed rows */}
                <div className="px-4 py-1 divide-y divide-slate-50">
                  <FeedRow
                    icon={<Zap className="w-3.5 h-3.5" />}
                    label="Stress Level"
                    value={humanMetrics.stressLevel}
                    accent={humanMetrics.stressAccent}
                    pulse={humanMetrics.cognitiveLoadScore > 80}
                  />
                  <FeedRow
                    icon={<Brain className="w-3.5 h-3.5" />}
                    label="Focus"
                    value={humanMetrics.focusLabel}
                    accent={humanMetrics.focusAccent}
                  />
                  <FeedRow
                    icon={<Eye className="w-3.5 h-3.5" />}
                    label="Detected Emotion"
                    value={humanMetrics.facialEmotion}
                    accent="text-indigo-500"
                  />
                  <FeedRow
                    icon={<Activity className="w-3.5 h-3.5" />}
                    label="Gaze"
                    value={humanMetrics.gazeLabel}
                    accent="text-teal-500"
                  />
                  <FeedRow
                    icon={<Volume2 className="w-3.5 h-3.5" />}
                    label="Voice Energy"
                    value={humanMetrics.voiceEnergy}
                    accent="text-violet-500"
                  />
                </div>

                {/* Cognitive Load bar */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      Cognitive Load
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {humanMetrics.permissionsGranted ? `${Math.round(humanMetrics.cognitiveLoadScore)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        humanMetrics.cognitiveLoadScore <= 30 ? 'bg-emerald-400'
                        : humanMetrics.cognitiveLoadScore <= 65 ? 'bg-teal-400'
                        : humanMetrics.cognitiveLoadScore <= 80 ? 'bg-amber-400'
                        : 'bg-rose-500'
                      }`}
                      animate={{ width: `${humanMetrics.cognitiveLoadScore}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>

              {/* Hotkey hint */}
              <p className="text-[10px] text-slate-400 text-center font-mono tracking-wider">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">
                  Ctrl+Shift+D
                </kbd> to toggle telemetry
              </p>

              {/* LiveStressPanel — BPM / Focus / Stress KPIs + metric bars */}
              <LiveStressPanel />

            </section>

          </main>

          {/* ── Nexus Kids Module Entry Point ─────────────────────────────────── */}
          <section className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🧩</span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                Nexus Kids Module
              </h2>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {KIDS_PORTALS.map((portal, i) => (
                <motion.div
                  key={portal.to}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group"
                >
                  <Link
                    to={portal.to}
                    className={`flex flex-col gap-2 p-5 rounded-2xl bg-gradient-to-br ${portal.accent}
                                text-white shadow-lg hover:shadow-xl transition-shadow`}
                  >
                    <span className="text-lg font-bold leading-snug">{portal.label}</span>
                    <span className="text-white/70 text-xs">{portal.sub}</span>
                    <span className="mt-1 text-white/50 text-xs group-hover:text-white/80 transition-colors">
                      Open →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Integration Hub — Slack / Jira Demo ───────────────────────── */}
          <section className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">🔗</span>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
                Workspace Integrations
              </h2>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <IntegrationDemoPanel />
          </section>

        </div>

        {/* Demo Mode Indicator */}
        <AnimatePresence>
          {!permissionsGranted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
            >
              Demo mode — press <kbd className="mx-1 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">Ctrl+Shift+D</kbd> to enable telemetry
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
