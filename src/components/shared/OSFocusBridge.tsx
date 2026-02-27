import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  MonitorOff, 
  MousePointer2, 
  BellOff,
  Wind,
  Apple,
  Info
} from 'lucide-react';

const STEPS = {
  windows: [
    {
      title: "Open Action Center",
      description: "Click the icons at the bottom-right corner of your taskbar (or press Win+N).",
      icon: <MousePointer2 className="w-8 h-8 text-sky-400" />,
    },
    {
      title: "Find Focus Assist",
      description: "Look for the moon icon or a button labeled 'Focus' / 'Quiet Hours'.",
      icon: <Wind className="w-8 h-8 text-sky-400" />,
    },
    {
      title: "Enable 'Priority Only'",
      description: "Right-click or click until it says 'Priority Only' to silence distractions.",
      icon: <BellOff className="w-8 h-8 text-sky-400" />,
    }
  ],
  mac: [
    {
      title: "Open Control Center",
      description: "Click the Control Center icon in the menu bar at the top-right.",
      icon: <MousePointer2 className="w-8 h-8 text-purple-400" />,
    },
    {
      title: "Click Focus",
      description: "Find the crescent moon icon labeled 'Focus'.",
      icon: <Apple className="w-8 h-8 text-purple-400" />,
    },
    {
      title: "Select 'Do Not Disturb'",
      description: "Click to engage 'Do Not Disturb' mode for your focus session.",
      icon: <BellOff className="w-8 h-8 text-purple-400" />,
    }
  ],
  generic: [
    {
      title: "Open System Settings",
      description: "Find your operating system's notification or focus settings.",
      icon: <Monitor className="w-8 h-8 text-slate-400" />,
    },
    {
      title: "Engage Focus Mode",
      description: "Manually toggle 'Do Not Disturb' or 'Focus Mode' to lock in.",
      icon: <BellOff className="w-8 h-8 text-slate-400" />,
    }
  ]
};

export const OSFocusBridge: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const userAgent = navigator.userAgent.toLowerCase();
  const osKey = userAgent.includes('win') ? 'windows' : userAgent.includes('mac') ? 'mac' : 'generic';
  const steps = STEPS[osKey as keyof typeof STEPS];

  const playChime = () => {
    const audio = new Audio('https://cdn.freesound.org/previews/352/352651_4019029-lq.mp3'); // Affirmative ping
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setIsComplete(true);
      playChime();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md shadow-2xl max-w-2xl mx-auto">
      <div className="flex items-start gap-6 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0">
          <MonitorOff className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Guided Focus Wizard</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Operating systems prevent browsers from silencing alerts directly. 
            Follow this calm guide to engage Do Not Disturb manually.
          </p>
        </div>
      </div>

      <div className="relative min-h-[300px] flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          {!isComplete ? (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                {steps[currentStep].icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                Step {currentStep + 1}: {steps[currentStep].title}
              </h3>
              <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
                {steps[currentStep].description}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Focus Protocol Engaged</h3>
              <p className="text-slate-400 mb-8">You are now anchored in deep work.</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsComplete(false); setCurrentStep(0); }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-widest"
              >
                Restart Guide
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isComplete && (
        <div className="flex items-center justify-between mt-8 pt-8 border-t border-white/10">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${currentStep === 0 ? 'opacity-20 cursor-not-allowed' : 'text-slate-400 hover:text-white'}`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'bg-indigo-400 w-4' : 'bg-white/20'}`} 
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-all"
          >
            {currentStep === steps.length - 1 ? 'I am focused' : 'Next'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
        <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-200/70 leading-relaxed">
          The "OS Focus Bridge" helps you bridge the gap between your browser focus and your physical operating system. 
          Manual silencing ensures that urgent system updates or native alerts do not break your flow.
        </p>
      </div>
    </div>
  );
};
