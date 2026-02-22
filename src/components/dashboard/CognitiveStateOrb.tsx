import React from 'react';
import { motion } from 'framer-motion';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const CognitiveStateOrb: React.FC = () => {
  const { cognitiveLoadScore, classification } = useCognitiveStore();

  // Map classification to visually soothing colors
  const stateColors = {
    hyperfocus: '#60A5FA', // Blue-400
    normal: '#2DD4BF',     // Teal-400
    approaching_overload: '#FBBF24', // Amber-400
    overload: '#F87171',   // Red-400
  };

  const currentColor = stateColors[classification as keyof typeof stateColors] || stateColors.normal;

  // Breathing animation speed scales subtly with cognitive load
  const breathDuration = classification === 'overload' ? 2 : classification === 'hyperfocus' ? 6 : 4;

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Ambient Glow */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
            backgroundColor: currentColor,
          }}
          transition={{
            duration: breathDuration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute inset-0 rounded-full blur-3xl"
        />
        
        {/* Solid Core */}
        <motion.div
          animate={{
            backgroundColor: currentColor,
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="relative z-10 flex items-center justify-center w-40 h-40 rounded-full shadow-lg backdrop-blur-sm bg-opacity-90"
        >
          <div className="text-center text-white mix-blend-overlay">
            <span className="block text-4xl font-light tracking-tighter">
              {cognitiveLoadScore}
            </span>
            <span className="block text-xs font-medium tracking-widest uppercase opacity-80">
              Load
            </span>
          </div>
        </motion.div>
      </div>
      
      <div className="mt-8 text-center">
        <h2 className="text-xl font-medium text-slate-700 capitalize tracking-wide">
          {classification.replace('_', ' ')}
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xs">
          {classification === 'hyperfocus' && "Deep concentration detected. Notifications are paused."}
          {classification === 'normal' && "Optimal cognitive rhythm. Processing incoming tasks normally."}
          {classification === 'approaching_overload' && "Cognitive friction rising. Preparing to simplify UI."}
          {classification === 'overload' && "High cognitive load. Entering sensory reduction mode."}
        </p>
      </div>
    </div>
  );
};