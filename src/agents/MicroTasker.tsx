import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { generateMicroTasks, MicroTask } from '../../agents/taskAgent';
import { Loader2, Zap, Clock, Check, Target } from 'lucide-react';

export const MicroTasker: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<MicroTask[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const handleDeconstruct = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const data = await generateMicroTasks(input);
      setTasks(data);
      setCompleted(new Set());
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
      particleCount: 40,
      spread: 60,
      origin: { x, y },
      colors: ['#14B8A6', '#3B82F6', '#10B981', '#FCD34D'],
      disableForReducedMotion: true,
      zIndex: 9999,
    });
  };

  const toggleTask = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        triggerConfetti(e); // Only trigger dopamine burst on completion, not un-checking
      }
      return next;
    });
  };

  // Dopamine Progress Bar Calculations
  const progress = tasks.length === 0 ? 0 : (completed.size / tasks.length) * 100;
  
  const progressColor = useMemo(() => {
    if (progress < 25) return '#94A3B8'; // Slate
    if (progress < 50) return '#60A5FA'; // Blue
    if (progress < 100) return '#2DD4BF'; // Teal
    return '#10B981'; // Emerald (Done)
  }, [progress]);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 w-full mt-8 overflow-hidden relative">
      <h3 className="text-xl font-light text-slate-800 mb-6 flex items-center gap-3">
        <div className="p-2 bg-amber-100 text-amber-500 rounded-xl"><Zap className="w-5 h-5" /></div>
        Momentum Architect
      </h3>
      
      {/* Input Area */}
      <div className="flex gap-3 relative z-10">
        <input
          type="text"
          className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-700 transition-all"
          placeholder="What massive task is paralyzing you right now?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleDeconstruct()}
        />
        <button
          onClick={handleDeconstruct}
          disabled={loading || !input}
          className="bg-slate-800 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Bypass Friction"}
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
            {/* Dopamine Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Momentum</span>
                <span style={{ color: progressColor }}>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%`, backgroundColor: progressColor }}
                  transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                />
              </div>
            </div>

            {/* Task List */}
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
                    variants={itemVariants}
                    key={task.id}
                    layout
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-4 rounded-2xl border-2 transition-colors cursor-pointer flex gap-4 items-center group ${
                      isDone ? 'bg-slate-50 border-slate-100 opacity-60' : 
                      isFirst && !isDone ? 'bg-teal-50/30 border-teal-200 shadow-sm' : 
                      'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                    onClick={(e) => toggleTask(task.id, e)}
                  >
                    {/* Animated Checkbox */}
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
                        animate={{ scale: isDone ? 1 : 0, opacity: isDone ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      </motion.div>
                    </motion.div>
                    
                    <div className="flex-1">
                      <p className={`font-medium transition-all ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
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
                              <Clock className="w-3 h-3" /> {task.estimated_minutes} min
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
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