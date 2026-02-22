import React, { useState, useEffect, useRef } from 'react';
import { Wind, Play, Square } from 'lucide-react';

export const RegulationCompanion: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState(5);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // Procedural Binaural Audio Generation
  const startAudioHum = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Master Gain (Volume control)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2); // Soft fade-in
    masterGain.connect(ctx.destination);

    // Left Ear (428 Hz)
    const oscLeft = ctx.createOscillator();
    const panLeft = ctx.createStereoPanner();
    panLeft.pan.value = -1;
    oscLeft.type = 'sine';
    oscLeft.frequency.value = 428;
    oscLeft.connect(panLeft);
    panLeft.connect(masterGain);

    // Right Ear (436 Hz) - Creates an 8Hz Alpha Brainwave Binaural Beat
    const oscRight = ctx.createOscillator();
    const panRight = ctx.createStereoPanner();
    panRight.pan.value = 1;
    oscRight.type = 'sine';
    oscRight.frequency.value = 436;
    oscRight.connect(panRight);
    panRight.connect(masterGain);

    oscLeft.start();
    oscRight.start();
    oscillatorsRef.current = [oscLeft, oscRight];
  };

  const stopAudioHum = () => {
    if (audioCtxRef.current) {
      // Soft fade-out
      const masterGain = audioCtxRef.current.createGain();
      masterGain.gain.setValueAtTime(0.15, audioCtxRef.current.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1);
      
      setTimeout(() => {
        oscillatorsRef.current.forEach(osc => osc.stop());
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
      }, 1000);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && step > 0) {
      interval = setInterval(() => setStep(s => s - 1), 12000); // 12 seconds per sense
    } else if (step === 0) {
      setIsActive(false);
      stopAudioHum();
      setStep(5);
    }
    return () => clearInterval(interval);
  }, [isActive, step]);

  const toggleExercise = () => {
    if (isActive) {
      setIsActive(false);
      stopAudioHum();
      setStep(5);
    } else {
      setIsActive(true);
      startAudioHum();
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Wind className="w-4 h-4 text-teal-500" /> Grounding Protocol
        </h3>
        <button onClick={toggleExercise} className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
          {isActive ? <><Square className="w-3 h-3"/> Stop</> : <><Play className="w-3 h-3"/> Start</>}
        </button>
      </div>

      {isActive ? (
        <div className="text-center py-6 animate-in fade-in zoom-in-95 duration-700">
          <div className="text-5xl font-light text-teal-500 mb-2 tabular-nums">{step}</div>
          <p className="text-sm text-slate-600 font-medium">
            {step === 5 && "Things you can see around you."}
            {step === 4 && "Things you can physically feel."}
            {step === 3 && "Things you can hear right now."}
            {step === 2 && "Things you can smell."}
            {step === 1 && "Thing you can taste."}
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-6">Binaural 432Hz Active</p>
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">Trigger the 5-4-3-2-1 sensory countdown to interrupt an overload spiral.</p>
      )}
    </div>
  );
};