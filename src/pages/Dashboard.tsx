import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { useCognitiveMonitor } from '../hooks/useCognitiveMonitor';
import { useDemoSimulator } from '../hooks/useDemoSimulator';
import { EnergyTimeline } from '../components/dashboard/EnergyTimeline';
import { PermissionsRequest } from '../components/shared/PermissionsRequest';
import { OSFocusBridge } from '../components/shared/OSFocusBridge';
import { SensoryEqualizer } from '../components/shared/SensoryEqualizer';
import { supabase } from '../lib/supabase';

// ─── Debug Overlay: flickers green dot every processed frame ─────────────────
const BiometricDebugDot: React.FC<{ frameRef: React.MutableRefObject<number> }> = ({ frameRef }) => {
  const [visible, setVisible] = useState(false);
  const dotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let lastCount = 0;
    const poll = setInterval(() => {
      if (frameRef.current !== lastCount) {
        lastCount = frameRef.current;
        setVisible(true);
        if (dotTimeoutRef.current) clearTimeout(dotTimeoutRef.current);
        dotTimeoutRef.current = setTimeout(() => setVisible(false), 120);
      }
    }, 50);
    return () => {
      clearInterval(poll);
      if (dotTimeoutRef.current) clearTimeout(dotTimeoutRef.current);
    };
  }, [frameRef]);

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-sm border border-white/10 pointer-events-none">
      <div className={`w-2 h-2 rounded-full transition-colors duration-75 ${visible ? 'bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]' : 'bg-slate-600'}`} />
      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-widest">{visible ? 'FRAME' : 'IDLE'}</span>
    </div>
  );
};

export const Dashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const { 
    permissionsGranted, 
    setPermissionsGranted, 
    userRole, 
    metrics, 
    cognitiveLoadScore, 
    currentTaskCategory,
    classification,
    isAudioDucked,
    setAudioDucked,
    setCrisisActive,
    crisisActive
  } = useCognitiveStore();
  
  const frameCounter = useRef(0);
  const onBiometricFrame = useCallback(() => { frameCounter.current += 1; }, []);

  // Initialize biome engine
  useCognitiveMonitor();
  useDemoSimulator(userId);

  // States for Quick Actions
  const [showOSBridge, setShowOSBridge] = useState(false);

  // Real user profile from Supabase Auth
  const [userMeta, setUserMeta] = useState<{ fullName: string; avatarUrl: string | null } | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserMeta({
          fullName: session.user.user_metadata?.full_name ?? session.user.email ?? 'User',
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        });
      }
    });
  }, []);

  const displayName = userMeta?.fullName ?? 'Loading…';
  const avatarInitials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const handleDeclinePermissions = () => {
    console.warn('User declined required biometric telemetry.');
  };

  // Derive human readable stats
  const tensionLevel = metrics.facialTension > 60 ? 'High' : metrics.facialTension > 30 ? 'Moderate' : 'Low';
  const tensionColorText = metrics.facialTension > 60 ? 'text-red-700' : metrics.facialTension > 30 ? 'text-amber-700' : 'text-green-700';
  const tensionColorBg = metrics.facialTension > 60 ? 'bg-red-100' : metrics.facialTension > 30 ? 'bg-amber-100' : 'bg-green-100';
  
  // Calculate focus intensity based on actual classifications and metrics (0-100)
  const calculatedFocus = Math.max(0, 100 - (metrics.gazeWander * 1.5 + metrics.pauseFrequency * 2));
  const focusLevel = calculatedFocus > 80 ? 'High' : calculatedFocus > 40 ? 'Moderate' : 'Low';
  const focusColorText = calculatedFocus > 80 ? 'text-blue-700' : calculatedFocus > 40 ? 'text-indigo-700' : 'text-slate-700';
  const focusColorBg = calculatedFocus > 80 ? 'bg-blue-100' : calculatedFocus > 40 ? 'bg-indigo-100' : 'bg-slate-100';

  const recoveryScore = Math.max(0, 100 - cognitiveLoadScore).toFixed(0);
  const focusScore = (calculatedFocus / 10).toFixed(1);

  return (
    <div className="bg-[#f6f7f8] font-display text-slate-800 antialiased h-screen overflow-hidden flex selection:bg-teal-100 selection:text-teal-900">
      
      {permissionsGranted && <BiometricDebugDot frameRef={frameCounter} />}
      {!permissionsGranted && (
        <PermissionsRequest
          onAccept={() => setPermissionsGranted(true)}
          onDecline={handleDeclinePermissions}
        />
      )}

      {showOSBridge && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl">
            <button onClick={() => setShowOSBridge(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800">
              <span className="material-symbols-outlined">close</span>
            </button>
            <OSFocusBridge />
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 h-full bg-white border-r border-slate-100 flex flex-col justify-between p-6 shrink-0 z-20">
        <div className="flex flex-col gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-[#197fe6] to-blue-400 aspect-square rounded-xl size-10 flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="material-symbols-outlined text-white text-2xl">neurology</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-slate-900 text-base font-bold leading-none tracking-tight">NeuroAdaptive</h1>
              <p className="text-slate-400 text-xs font-medium mt-1">OS v2.4.1</p>
            </div>
          </div>
          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            <a className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 text-[#197fe6] font-medium transition-colors" href="#">
              <span className="material-symbols-outlined font-[FILL]">grid_view</span>
              <span className="text-sm">Dashboard</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">monitoring</span>
              <span className="text-sm">Cognitive Stats</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">headphones</span>
              <span className="text-sm">Focus Tools</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors" href="#">
              <span className="material-symbols-outlined">schedule</span>
              <span className="text-sm">Sessions</span>
            </a>
          </nav>
        </div>
        {/* Bottom Links */}
        <div className="flex flex-col gap-2">
          <a className="flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span className="text-sm">Settings</span>
          </a>
          <div className="pt-4 mt-2 border-t border-slate-100 flex items-center gap-3">
            {userMeta?.avatarUrl ? (
              <img alt="User Profile" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" src={userMeta.avatarUrl} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#197fe6] to-indigo-400 flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-sm shrink-0">
                {avatarInitials || '?'}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-900 truncate">{displayName}</span>
              <span className="text-xs text-slate-400 capitalize">{userRole || 'Pro Plan'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 h-full overflow-y-auto overflow-x-hidden p-8 transition-all ${!permissionsGranted ? 'blur-sm pointer-events-none' : ''} custom-scrollbar`}>
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Enterprise Dashboard</h2>
            <p className="text-slate-500 mt-1">
              Your cognitive load is {cognitiveLoadScore < 40 ? 'optimal' : cognitiveLoadScore < 75 ? 'elevated' : 'high'} for work today.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="size-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-[#197fe6] hover:border-[#197fe6] transition-all shadow-sm">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button onClick={() => setCrisisActive(true)} className="h-12 px-6 rounded-full bg-slate-900 text-white font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">play_arrow</span>
              Start Focus Session
            </button>
          </div>
        </header>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)] pb-10">
          
          {/* 1. Live Cognitive Stress (Large Card) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md col-span-1 md:col-span-2 lg:col-span-2 row-span-2 p-6 flex flex-col justify-between relative group">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="text-slate-400 hover:text-[#197fe6]"><span className="material-symbols-outlined">more_horiz</span></button>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="size-12 rounded-2xl bg-blue-50 text-[#197fe6] flex items-center justify-center">
                <span className="material-symbols-outlined">ecg_heart</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Live Cognitive Stress</h3>
                <p className="text-slate-500 text-sm">Real-time biofeedback analysis</p>
              </div>
            </div>

            {/* Recharts Component Instead of Fake HTML Bars */}
            <div className="flex-1 w-full relative -mx-4 -mt-4 mb-4">
              <EnergyTimeline />
            </div>

            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-700">Mental Tension</span>
                  <span className={`text-xs font-bold ${tensionColorBg} ${tensionColorText} px-2 py-0.5 rounded-full`}>{tensionLevel}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: `${Math.min(100, Math.max(0, metrics.facialTension))}%` }}
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.4)]" 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-700">Focus Intensity</span>
                  <span className={`text-xs font-bold ${focusColorBg} ${focusColorText} px-2 py-0.5 rounded-full`}>{focusLevel}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: `${calculatedFocus}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-[#197fe6] rounded-full shadow-[0_0_10px_rgba(25,127,230,0.4)]" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Sensory Equalizer (Replaced HTML with real Component) */}
          <div className="bg-slate-900 border border-slate-800 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md col-span-1 md:col-span-1 row-span-2 flex flex-col relative w-full h-full min-h-[400px]">
             <SensoryEqualizer />
          </div>

          {/* 3. Task Momentum */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md col-span-1 md:col-span-3 lg:col-span-1 row-span-2 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Momentum</h3>
              <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-sm">calendar_today</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100 -z-10"></div>
              
              {/* Item 1 (Active) */}
              <div className="flex gap-4 mb-6">
                <div className="mt-1 size-10 rounded-full border-4 border-white bg-[#197fe6] shadow-md shrink-0 flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-white text-xs">play_arrow</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#197fe6] mb-1 block">NOW</span>
                  <h4 className="text-sm font-semibold text-slate-900 capitalize text-wrap break-words">{currentTaskCategory.replace(/-/g, ' ')}</h4>
                  <p className="text-xs text-slate-500 mt-1">Deep focus block</p>
                </div>
              </div>
              
              {/* Item 2 */}
              <div className="flex gap-4 mb-6 opacity-60">
                <div className="mt-1 size-10 rounded-full border-4 border-white bg-slate-200 shrink-0 flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-slate-500 text-xs">coffee</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 mb-1 block">+1.5 hrs</span>
                  <h4 className="text-sm font-semibold text-slate-900">Neuro-Recovery Break</h4>
                  <p className="text-xs text-slate-500 mt-1">Binaural beats session</p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex gap-4 opacity-40">
                <div className="mt-1 size-10 rounded-full border-4 border-white bg-slate-200 shrink-0 flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-slate-500 text-xs">group</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 mb-1 block">+2.0 hrs</span>
                  <h4 className="text-sm font-semibold text-slate-900">Team Sync</h4>
                  <p className="text-xs text-slate-500 mt-1">Weekly alignment</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Environment Widget (Small) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md p-5 flex items-center justify-between group cursor-pointer hover:border-[#197fe6]/30">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Environment</span>
              <span className="text-xl font-bold text-slate-900">{isAudioDucked ? 'Quiet' : 'Optimal'}</span>
            </div>
            <div className="size-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">wb_sunny</span>
            </div>
          </div>

          {/* 5. Brainwaves Widget (Small) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md p-5 flex items-center justify-between group cursor-pointer hover:border-[#197fe6]/30">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Alpha Waves</span>
              <span className="text-xl font-bold text-slate-900">12 Hz</span>
            </div>
            <div className="size-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">waves</span>
            </div>
          </div>

          {/* 6. Recovery Widget (Small) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md p-5 flex items-center justify-between group cursor-pointer hover:border-[#197fe6]/30">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Recovery</span>
              <span className="text-xl font-bold text-slate-900">{recoveryScore}%</span>
            </div>
            <div className="size-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">battery_charging_full</span>
            </div>
          </div>

          {/* 7. Focus Score Widget (Small) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md p-5 flex items-center justify-between group cursor-pointer hover:border-[#197fe6]/30">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Focus Score</span>
              <span className="text-xl font-bold text-slate-900">{focusScore}/10</span>
            </div>
            <div className="size-12 rounded-full bg-blue-50 text-[#197fe6] flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">center_focus_strong</span>
            </div>
          </div>

          {/* 8. Music / Audio Player (Wide) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md col-span-1 md:col-span-2 lg:col-span-2 p-4 flex items-center gap-4">
            <div className="size-16 rounded-xl overflow-hidden shrink-0 relative">
              <img alt="Abstract sound wave art" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbDYkotDnHhrfXKYW540_iYPZf_3a0ewWNM76nJzPqzzzkwSljgKix16_-SpLnp7IjDaImAAOVYA6Re-jjCJ_ckv4i-GVoqOmjnH5py00hFMvUG_Tg3JqolDliBfhzF02sTPriRq4g9st8Az9489ePyYxgWiq6iqd9Z5b0HstXImtkx86TYwqRSGuuAs8fpcLfrkkP6hdaE9CDY88YVZlHjX9kWwE-HGEydRhaElUFeevY3E2IBZbdAcM7HSKzkCGUN06dXfu0SlA" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-white">play_circle</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">Deep Focus: Alpha Binaural 40Hz</h4>
              <p className="text-xs text-slate-500 truncate">NeuroAdaptive Audio Engine</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-slate-400 font-mono">12:40</span>
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="w-1/3 h-full bg-[#197fe6] rounded-full"></div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">-45:20</span>
              </div>
            </div>
            <div className="flex items-center gap-1 pr-2">
              <button className="size-8 flex items-center justify-center text-slate-400 hover:text-slate-900"><span className="material-symbols-outlined text-lg">skip_previous</span></button>
              <button className="size-10 flex items-center justify-center bg-slate-900 text-white rounded-full shadow-md hover:bg-[#197fe6] transition-colors"><span className="material-symbols-outlined">pause</span></button>
              <button className="size-8 flex items-center justify-center text-slate-400 hover:text-slate-900"><span className="material-symbols-outlined text-lg">skip_next</span></button>
            </div>
          </div>

          {/* 9. Quick Actions (Wide) */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md col-span-1 md:col-span-2 p-6 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Adjustments</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              <button 
                onClick={() => setAudioDucked(!isAudioDucked)}
                className={`flex items-center gap-2 px-4 py-2 hover:bg-white border hover:border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-sm whitespace-nowrap ${isAudioDucked ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                <span className="material-symbols-outlined text-base">{isAudioDucked ? 'volume_off' : 'volume_up'}</span>
                {isAudioDucked ? 'Unmute Env' : 'Mute Env'}
              </button>
              <button 
                onClick={() => setShowOSBridge(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-all shadow-sm transform active:scale-95 whitespace-nowrap">
                <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
                DND Mode
              </button>
              <Link 
                to="/acoustic-sandbox"
                className="flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-100 hover:border-teal-200 rounded-xl text-xs font-semibold text-teal-700 transition-all shadow-sm whitespace-nowrap">
                <span className="material-symbols-outlined text-base">graphic_eq</span>
                Acoustic Sandbox
              </Link>
              <Link 
                to="/rsd-shield"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 rounded-xl text-xs font-semibold text-indigo-700 transition-all shadow-sm whitespace-nowrap">
                <span className="material-symbols-outlined text-base">shield</span>
                RSD Shield
              </Link>
              <Link 
                to="/reading"
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-100 hover:border-amber-200 rounded-xl text-xs font-semibold text-amber-700 transition-all shadow-sm whitespace-nowrap">
                <span className="material-symbols-outlined text-base">chrome_reader_mode</span>
                Reading Mode
              </Link>
            </div>
          </div>
        </div>

        {/* Demo Mode Indicator */}
        <AnimatePresence>
          {!permissionsGranted && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50"
            >
              Demo mode — press <kbd className="mx-1 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-xs font-mono">Ctrl+Shift+D</kbd> to enable telemetry
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Inline style for the custom scrollbar on this specific component */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
      `}</style>
    </div>
  );
};
