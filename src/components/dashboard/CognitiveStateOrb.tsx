import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useCognitiveStore } from '../../stores/cognitiveStore';

const STATE_CONFIG = {
  hyperfocus: { color: 'from-purple-500 to-indigo-600', shadow: 'shadow-indigo-500/50', label: 'Hyperfocus' },
  normal: { color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/40', label: 'Optimal Flow' },
  approaching_overload: { color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-500/50', label: 'Approaching Overload' },
  overload: { color: 'from-rose-500 to-red-600', shadow: 'shadow-rose-500/50', label: 'Overload Detected' },
};

export const CognitiveStateOrb: React.FC = () => {
  const { cognitiveLoadScore, classification } = useCognitiveStore();
  const config = STATE_CONFIG[classification];
  const containerRef = useRef<HTMLDivElement>(null);

  // Framer Motion 3D Tilt Values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth the raw mouse values with a spring physics configuration
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  // Map mouse position to rotation degrees (max 15 degrees of tilt)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate mouse position relative to center of the container (-0.5 to 0.5)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    // Smoothly return to center resting state
    x.set(0);
    y.set(0);
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col items-center justify-center relative overflow-hidden">
      
      <div className="absolute top-6 left-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Cognitive State</h3>
      </div>

      {/* Interactive 3D Container */}
      <motion.div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: 1000 }} // Enables 3D space
        className="relative flex flex-col items-center justify-center p-8 w-full h-full mt-4"
      >
        <motion.div
          style={{ rotateX, rotateY }}
          className="relative flex items-center justify-center"
        >
          {/* Outer Pulsing Glow */}
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: classification === 'overload' ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute w-56 h-56 rounded-full bg-gradient-to-tr ${config.color} blur-2xl opacity-40`}
          />

          {/* Core Physical Orb */}
          <div className={`relative w-48 h-48 rounded-full bg-gradient-to-tr ${config.color} shadow-2xl ${config.shadow} flex items-center justify-center border-4 border-white/10 backdrop-blur-md`}>
            {/* Inner Glass Highlight for 3D realism */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
            
            <div className="text-center z-10 text-white">
              <span className="text-6xl font-light tracking-tighter drop-shadow-md">
                {cognitiveLoadScore}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <div className="mt-8 text-center z-10">
        <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">{config.label}</h2>
        <p className="text-slate-500 mt-1 text-sm">
          {classification === 'hyperfocus' && "Deep work engaged. Notifications shielded."}
          {classification === 'normal' && "Nominal cognitive load. Ready for tasks."}
          {classification === 'approaching_overload' && "Friction detected. Pre-computing micro-tasks."}
          {classification === 'overload' && "Overload critical. Sensory buffers activated."}
        </p>
      </div>
    </div>
  );
};