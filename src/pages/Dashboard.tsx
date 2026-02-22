import React from 'react';
import { SensoryEqualizer } from '../components/shared/SensoryEqualizer';
import { CognitiveStateOrb } from '../components/dashboard/CognitiveStateOrb';
import { EnergyTimeline } from '../components/dashboard/EnergyTimeline';
import { useCognitiveStore } from '../stores/cognitiveStore';

export const Dashboard: React.FC = () => {
  const metrics = useCognitiveStore((state) => state.metrics);

  return (
    <SensoryEqualizer>
      <div className="min-h-screen p-8 md:p-16 lg:px-24 xl:px-32 font-sans selection:bg-teal-100 selection:text-teal-900">
        
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
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Telemetry Active
            </span>
          </div>
        </header>

        {/* Main Grid */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Visual Indicator */}
          <section className="lg:col-span-5 flex flex-col items-center bg-white/50 backdrop-blur-md rounded-3xl py-12 border border-slate-100 shadow-sm">
            <CognitiveStateOrb />
          </section>

          {/* Right Column: Analytics & Micro-Metrics */}
          <section className="lg:col-span-7 flex flex-col gap-8">
            <EnergyTimeline />

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-6">
              <MetricCard 
                title="Keystrokes / Min" 
                value={metrics.keystrokesPerMinute.toString()} 
                subtitle="Current velocity"
              />
              <MetricCard 
                title="Cognitive Pauses" 
                value={metrics.pauseFrequency.toString()} 
                subtitle="Delays > 3s"
              />
              <MetricCard 
                title="Context Switches" 
                value={metrics.contextSwitches.toString()} 
                subtitle="Tab/Window changes"
              />
              <MetricCard 
                title="Error Rate" 
                value={`${(metrics.errorRate * 100).toFixed(1)}%`} 
                subtitle="Backspace ratio"
              />
            </div>
          </section>

        </main>
      </div>
    </SensoryEqualizer>
  );
};

// Helper Component for Metrics
const MetricCard: React.FC<{ title: string; value: string; subtitle: string }> = ({ title, value, subtitle }) => (
  <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
    <div className="text-2xl font-light text-slate-800 mb-1">{value}</div>
    <div className="text-xs font-medium text-slate-400">{subtitle}</div>
  </div>
);