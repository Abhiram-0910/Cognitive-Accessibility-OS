import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateMicroTasks, MicroTask } from '../../agents/taskAgent';
import { calculatePaddingMultiplier, recordTaskCompletion } from '../../lib/algorithms/timeCorrection';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const MicroTasker: React.FC = () => {
  const [input, setInput] = useState('');
  // Set default estimate to empty so the placeholder shows instead of '30'
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<MicroTask[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const isOfflineMode = useCognitiveStore(s => s.isOfflineMode);
  
  // Time Blindness Tracking
  const [taskElapsedSeconds, setTaskElapsedSeconds] = useState<Record<string, number>>({});
  const startTimes = useRef<Record<string, number>>({});
  
  // STATE LOCK: Prevents double-click race conditions
  const [isAnimating, setIsAnimating] = useState(false);

  // Background timer for actual time
  React.useEffect(() => {
    if (tasks.length === 0 || completed.size === tasks.length) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setTaskElapsedSeconds(prev => {
        const next = { ...prev };
        let hasChanges = false;
        
        tasks.forEach(t => {
          // Only track the first incomplete task (the active one)
          const isDone = completed.has(t.id);
          const isFirstIncomplete = !isDone && tasks.find(x => !completed.has(x.id))?.id === t.id;
          
          if (isFirstIncomplete) {
            if (!startTimes.current[t.id]) {
              startTimes.current[t.id] = now;
            }
            next[t.id] = Math.floor((now - startTimes.current[t.id]) / 1000);
            hasChanges = true;
          }
        });
        
        return hasChanges ? next : prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tasks, completed]);

  const handleDeconstruct = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const multiplier = calculatePaddingMultiplier();
      const baseEstimate = parseInt(estimatedTime) || 30;
      const paddedEstimate = Math.ceil(baseEstimate * multiplier);
      
      console.log(`[TimeBlindness] Base: ${baseEstimate}m * ${multiplier}x = ${paddedEstimate}m`);
      
      const data = await generateMicroTasks(input, paddedEstimate);
      setTasks(data);
      setCompleted(new Set());
      setTaskElapsedSeconds({});
      startTimes.current = {};
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement | HTMLInputElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { x, y },
      colors: ['#2b8cee', '#6366f1', '#10B981', '#FCD34D'],
      disableForReducedMotion: true,
      zIndex: 9999,
    });
  };

  const toggleTask = (id: string, e: React.MouseEvent<HTMLDivElement | HTMLInputElement>) => {
    // 🛑 If currently firing confetti/animating, ignore rapid clicks
    if (isAnimating) return;

    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        
        // Record the time it took to complete this task for the algorithm
        const task = tasks.find(t => t.id === id);
        if (task && taskElapsedSeconds[id] !== undefined) {
          recordTaskCompletion(id, task.estimated_minutes, taskElapsedSeconds[id]);
        }
        
        triggerConfetti(e);
        
        // Lock the UI for 1.5s to let animations resolve gracefully
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1500);
      }
      return next;
    });
  };

  const progress =
    tasks.length === 0 ? 0 : (completed.size / tasks.length) * 100;

  return (
    <div className="bg-[#f8fafc] dark:bg-[#101922] font-display text-[#0f172a] antialiased min-h-screen flex flex-col selection:bg-[#2b8cee] selection:text-white rounded-3xl w-full border border-[#e2e8f0] dark:border-gray-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      
      {/* Top Navigation */}
      <header className="flex items-center justify-between border-b border-[#e2e8f0] bg-white/80 px-6 py-4 backdrop-blur-md dark:border-gray-800 dark:bg-[#101922]/80 lg:px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2b8cee]/10 text-[#2b8cee]">
            <span className="material-symbols-outlined text-[24px]">psychology</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#0f172a] dark:text-white flex items-center gap-2">
            Momentum Architect
            {isOfflineMode && (
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider h-fit">
                ⚡ Offline
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden h-10 items-center justify-center rounded-full bg-[#eef6ff] px-6 text-sm font-semibold text-[#2b8cee] transition-colors hover:bg-[#2b8cee]/20 dark:bg-gray-800 dark:text-gray-200 sm:flex">
            Profile
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e2e8f0] text-[#64748b] hover:bg-white dark:border-gray-700 dark:hover:bg-gray-800">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-8 lg:px-8 overflow-y-auto">
        <div className="w-full max-w-3xl space-y-12">
          
          {/* Progress Section: Calm Tech Aesthetic */}
          {tasks.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-6 pt-4"
            >
              <div className="relative flex h-48 w-48 items-center justify-center">
                {/* CSS Conic Gradient Ring Simulation */}
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(var(--tw-gradient-stops))] from-[#2b8cee] via-[#2b8cee] to-transparent opacity-20 blur-xl"></div>
                {/* Progress Circle Background */}
                <div className="absolute h-40 w-40 rounded-full border-8 border-gray-100 dark:border-gray-800"></div>
                {/* Active Progress Arc */}
                <svg className="absolute h-40 w-40 -rotate-90 transform overflow-visible">
                  <motion.circle 
                    className="text-[#2b8cee] transition-all duration-1000 ease-out" 
                    cx="80" cy="80" fill="none" r="76" stroke="currentColor" strokeLinecap="round" strokeWidth="8"
                    initial={{ strokeDashoffset: 477 }}
                    animate={{ strokeDashoffset: 477 - (477 * (progress / 100)) }}
                    style={{ strokeDasharray: 477 }}
                  ></motion.circle>
                </svg>
                <div className="flex flex-col items-center justify-center z-10">
                  <span className="text-4xl font-bold text-[#0f172a] dark:text-white">{Math.round(progress)}%</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Momentum</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-[#0f172a] dark:text-white">
                  {progress === 100 ? "Task complete! Great job." : progress > 50 ? "Keep going, you're in the flow." : "You've got this. Take it one step at a time."}
                </p>
                <p className="text-sm text-[#64748b]">{completed.size} tasks completed so far.</p>
              </div>
            </motion.div>
          )}

          {/* AI Input Section */}
          <div className="group relative w-full rounded-2xl bg-white p-2 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-all focus-within:ring-2 focus-within:ring-[#2b8cee]/20 dark:bg-gray-800/50">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-lg">
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              </div>
              <input 
                className="flex-1 w-full border-none bg-transparent py-3 sm:py-4 text-base sm:text-lg font-medium text-[#0f172a] placeholder:text-[#64748b]/60 focus:ring-0 dark:text-white outline-none" 
                placeholder="Brain dump your overwhelming task here..." 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDeconstruct()}
              />
              <div className="w-full sm:w-auto flex items-center gap-2">
                 {/* Estimated Time Input */}
                 <div className="relative w-full sm:w-28 flex-shrink-0">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#64748b]">timer</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full h-10 border border-gray-200 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-900 py-2 pl-9 pr-3 text-sm font-medium focus:ring-2 focus:ring-[#2b8cee] outline-none"
                      placeholder="Est. min"
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDeconstruct()}
                    />
                 </div>
                 
                 <button 
                  onClick={handleDeconstruct}
                  disabled={loading || !input}
                  className="flex h-10 w-full sm:w-auto items-center justify-center shrink-0 gap-2 rounded-full bg-[#2b8cee] px-5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95 hover:bg-blue-600 disabled:opacity-70 disabled:active:scale-100"
                 >
                  {loading ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  ) : (
                    <>
                      <span>Breakdown</span>
                      <span className="material-symbols-outlined text-[16px]">subdirectory_arrow_left</span>
                    </>
                  )}
                 </button>
              </div>
            </div>
          </div>

          {/* Decomposed Tasks Section */}
          <AnimatePresence>
            {tasks.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">Decomposed Tasks</h2>
                  <button 
                    onClick={() => { setTasks([]); setCompleted(new Set()); setInput(""); }}
                    className="text-sm font-medium text-[#2b8cee] hover:underline"
                  >
                    Clear all
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  {tasks.map((task, index) => {
                     const isDone = completed.has(task.id);
                     const isFirstIncomplete = !isDone && tasks.find(x => !completed.has(x.id))?.id === task.id;

                     return (
                       <motion.div 
                         key={task.id}
                         layout
                         initial={{ opacity: 0, scale: 0.98 }}
                         animate={{ opacity: 1, scale: 1 }}
                         transition={{ duration: 0.2 }}
                         onClick={(e) => toggleTask(task.id, e as any)}
                         className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-white p-4 transition-all cursor-pointer dark:bg-gray-800 ${
                           isAnimating ? 'pointer-events-none' : ''
                         } ${
                           isDone 
                             ? 'border-transparent bg-gray-50 opacity-60 hover:opacity-100 dark:bg-gray-800/50' 
                             : isFirstIncomplete
                               ? 'border-[#2b8cee]/30 shadow-md ring-1 ring-[#2b8cee]/10 dark:border-blue-900'
                               : 'border-[#e2e8f0] shadow-sm hover:border-[#2b8cee]/30 hover:shadow-md dark:border-gray-700'
                         }`}
                       >
                         <div className="flex items-start sm:items-center gap-4">
                           <div className="mt-0.5 sm:mt-0 relative flex cursor-pointer items-center justify-center shrink-0">
                             <input 
                               type="checkbox" 
                               checked={isDone}
                               onChange={(e) => e.stopPropagation()} // Prevent double firing since parent div has onClick
                               className="peer h-6 w-6 appearance-none rounded-full border-2 border-[#e2e8f0] bg-transparent checked:border-[#2b8cee] checked:bg-[#2b8cee] hover:border-[#2b8cee] transition-all cursor-pointer outline-none focus:ring-0 focus:ring-offset-0 dark:border-gray-600"
                             />
                             <span className="material-symbols-outlined pointer-events-none absolute text-[16px] font-bold text-white opacity-0 transition-opacity peer-checked:opacity-100">check</span>
                           </div>
                           
                           <div className="flex flex-col gap-1 sm:gap-0">
                             <span className={`text-base font-medium transition-colors ${
                               isDone ? 'text-[#64748b] line-through dark:text-gray-500' : 'text-[#0f172a] dark:text-white'
                             }`}>
                               {task.step}
                             </span>
                             <span className={`text-xs ${isDone ? 'text-[#64748b]/60' : 'text-[#64748b]'}`}>
                               {task.friction_point}
                             </span>
                           </div>
                         </div>
                         
                         <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pl-10 sm:pl-0">
                           <div className="flex items-center gap-2">
                             {/* Timer (Actual) - Only shows for incomplete tasks once they've started */}
                             {(!isDone && taskElapsedSeconds[task.id] !== undefined) && (
                               <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                 taskElapsedSeconds[task.id] > (task.estimated_minutes * 60)
                                   ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
                                   : 'bg-[#eef6ff] text-[#2b8cee] border border-[#2b8cee]/20'
                               }`}>
                                 Act: {Math.floor(taskElapsedSeconds[task.id] / 60)}m {taskElapsedSeconds[task.id] % 60}s
                               </span>
                             )}
                             
                             {/* Time Estimate Badge */}
                             <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                               isDone 
                                 ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' 
                                 : isFirstIncomplete
                                   ? 'bg-[#eef6ff] text-[#2b8cee] dark:bg-[#2b8cee]/20 border border-[#2b8cee]/20'
                                   : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100'
                             }`}>
                               Est: {task.estimated_minutes}m
                             </span>
                           </div>
                           <span className="material-symbols-outlined text-[#64748b] hover:text-[#2b8cee] opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">drag_indicator</span>
                         </div>
                       </motion.div>
                     );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-sm text-[#64748b] dark:text-gray-600 border-t border-[#e2e8f0] dark:border-gray-800 bg-white/50 dark:bg-[#101922]/50 shrink-0">
        <p>Momentum Architect v2.0 • NeuroAdaptive OS</p>
      </footer>
    </div>
  );
};