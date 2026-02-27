import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateMicroTasks, MicroTask } from '../../agents/taskAgent';
import { calculatePaddingMultiplier, recordTaskCompletion } from '../../lib/algorithms/timeCorrection';
import { useCognitiveStore } from '../../stores/cognitiveStore';
import { Loader2, Zap, Clock, Check, Target } from 'lucide-react';

export const MicroTasker: React.FC = () => {
  const [input, setInput] = useState('');
  const [estimatedTime, setEstimatedTime] = useState<string>('30');
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

  const triggerConfetti = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { x, y },
      colors: ['#14B8A6', '#3B82F6', '#10B981', '#FCD34D'],
      disableForReducedMotion: true,
      zIndex: 9999,
    });
  };

  const toggleTask = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
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

  const progressColor = useMemo(() => {
    if (progress < 25) return '#94A3B8';
    if (progress < 50) return '#60A5FA';
    if (progress < 100) return '#2DD4BF';
    return '#10B981';
  }, [progress]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 w-full mt-8 overflow-hidden relative">
      <h3 className="text-xl font-light text-slate-800 mb-6 flex items-center gap-3">
        <div className="p-2 bg-amber-100 text-amber-500 rounded-xl">
          <Zap className="w-5 h-5" />
        </div>
        Momentum Architect
        {isOfflineMode && (
          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto flex items-center gap-1">
            ⚡ Offline
          </span>
        )}
      </h3>

      <div className="flex gap-3 relative z-10">
        <div className="flex-1 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            className="flex-[3] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-700 transition-all"
            placeholder="What massive task is paralyzing you right now?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDeconstruct()}
          />
          <div className="flex-1 relative">
            <input
              type="number"
              min="1"
              max="480"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-700 transition-all pl-12"
              placeholder="Est. min"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDeconstruct()}
            />
            <Clock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <button
          onClick={handleDeconstruct}
          disabled={loading || !input}
          className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Bypass Friction"
          )}
        </button>
      </div>

      <AnimatePresence>
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-8"
          >
            <div className="mb-6">
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Momentum</span>
                <span style={{ color: progressColor }}>
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${progress}%`,
                    backgroundColor: progressColor
                  }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
              </div>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {tasks.map((task, index) => {
                const isDone = completed.has(task.id);
                const isFirst = index === 0;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    variants={itemVariants as any}
                    whileHover={!isAnimating ? { scale: 1.01 } : {}}
                    whileTap={!isAnimating ? { scale: 0.99 } : {}}
                    className={`p-4 rounded-2xl border-2 transition-colors flex gap-4 items-center group ${
                      isAnimating ? 'cursor-wait pointer-events-none' : 'cursor-pointer'
                    } ${
                      isDone
                        ? 'bg-slate-50 border-slate-100 opacity-60'
                        : isFirst && !isDone
                        ? 'bg-teal-50/30 border-teal-200 shadow-sm'
                        : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                    onClick={(e) => toggleTask(task.id, e)}
                  >
                    <motion.div
                      layout
                      initial={false}
                      animate={{
                        backgroundColor: isDone ? progressColor : '#ffffff',
                        borderColor: isDone ? progressColor : '#CBD5E1',
                      }}
                      className="w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
                    >
                      <motion.div
                        initial={false}
                        animate={{
                          scale: isDone ? 1 : 0,
                          opacity: isDone ? 1 : 0
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25
                        }}
                      >
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      </motion.div>
                    </motion.div>

                    <div className="flex-1">
                      <p
                        className={`font-medium transition-all ${
                          isDone
                            ? 'text-slate-400 line-through'
                            : 'text-slate-800'
                        }`}
                      >
                        {task.step}
                      </p>

                      <AnimatePresence>
                        {!isDone && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-3 mt-2 overflow-hidden"
                          >
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                              <Clock className="w-3 h-3" /> Est: {task.estimated_minutes}m
                            </span>

                            {(!isDone && taskElapsedSeconds[task.id] !== undefined) && (
                              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                                taskElapsedSeconds[task.id] > (task.estimated_minutes * 60)
                                  ? 'bg-rose-100 text-rose-600 animate-pulse'
                                  : 'bg-teal-50 text-teal-600'
                              }`}>
                                Act: {Math.floor(taskElapsedSeconds[task.id] / 60)}m {taskElapsedSeconds[task.id] % 60}s
                              </span>
                            )}

                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium ml-2">
                              <Target className="w-3 h-3" /> Friction: {task.friction_point}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};