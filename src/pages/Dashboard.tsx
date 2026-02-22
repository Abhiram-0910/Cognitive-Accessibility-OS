import React, { useEffect } from 'react';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { useCognitiveMonitor } from '../hooks/useCognitiveMonitor';
import { useDemoSimulator } from '../hooks/useDemoSimulator';
import { CognitiveStateOrb } from '../components/dashboard/CognitiveStateOrb';
import { EnergyTimeline } from '../components/dashboard/EnergyTimeline';
import { PermissionsRequest } from '../components/shared/PermissionsRequest';

// Helper Component for Metrics
const MetricCard: React.FC<{ title: string; value: string; subtitle: string }> = ({ title, value, subtitle }) => (
  <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
    <div className="text-2xl font-light text-slate-800 mb-1">{value}</div>
    <div className="text-xs font-medium text-slate-400">{subtitle}</div>
  </div>
);

export const Dashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const { permissionsGranted, setPermissionsGranted } = useCognitiveStore();
  
  // The monitor hook is always called, but internally gates itself based on permissionsGranted
  useCognitiveMonitor();
  
  // Initialize the demo simulator with the user ID
  // This will only run the simulator if permissions are not granted
  useDemoSimulator(userId);

  const handleDeclinePermissions = () => {
    // Provide a fallback experience or gracefully exit the user
    console.warn("User declined required biometric telemetry.");
  };

  return (
    <div className="min-h-screen p-8 md:p-16 lg:px-24 xl:px-32 font-sans selection:bg-teal-100 selection:text-teal-900">
      
      {/* 1. Privacy Blocking Gate */}
      {!permissionsGranted && (
        <PermissionsRequest 
          onAccept={() => setPermissionsGranted(true)} 
          onDecline={handleDeclinePermissions} 
        />
      )}

      {/* 2. Main Dashboard Layout (Only truly active when permissionsGranted is true) */}
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
          <div className={`flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100 ${permissionsGranted ? 'opacity-100' : 'opacity-50'}`}>
            <div className={`w-2 h-2 rounded-full ${permissionsGranted ? 'bg-emerald-400 animate-pulse' : 'bg-amber-300'}`} />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {permissionsGranted ? 'Telemetry Active' : 'Demo Mode'}
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

        </main>
        
        {/* Demo Mode Indicator */}
        {!permissionsGranted && (
          <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            Demo mode active - grant permissions for real-time biometric monitoring
          </div>
        )}
      </div>
    </div>
  );
};