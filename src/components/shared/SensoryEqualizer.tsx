import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings2, 
  Volume2, 
  VolumeX, 
  Music, 
  Zap, 
  AlertTriangle,
  X 
} from 'lucide-react';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const SensoryEqualizer: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [calibrationStep, setCalibrationStep] = React.useState<'idle' | 'testing' | 'prompt'>('idle');
  const [showHelper, setShowHelper] = React.useState(false);
  const { 
    audioSettings, 
    updateAudioSettings, 
    isAudioDucked,
  } = useCognitiveStore();

  const [isCalibrated, setIsCalibrated] = React.useState(() => {
    return localStorage.getItem('neuroadapt_calibration_completed') === 'true';
  });

  const handleToggleMute = () => {
    updateAudioSettings({ isMuted: !audioSettings.isMuted });
  };

  const handleSliderChange = (key: keyof typeof audioSettings, value: string) => {
    updateAudioSettings({ [key]: parseFloat(value) });
  };

  const runCalibration = () => {
    setCalibrationStep('testing');
    setShowHelper(false);
    
    const audio = new Audio('https://cdn.freesound.org/previews/339/339822_5121236-lq.mp3'); // Gentle bell
    audio.volume = 1.0;
    
    audio.play().then(() => {
      setTimeout(() => setCalibrationStep('prompt'), 1500);
    }).catch(() => {
      // AudioContext might be blocked
      setCalibrationStep('idle');
      alert('Please click anywhere on the page first to enable audio.');
    });
  };

  const confirmCalibration = (heard: boolean) => {
    if (heard) {
      setIsCalibrated(true);
      localStorage.setItem('neuroadapt_calibration_completed', 'true');
      setCalibrationStep('idle');
    } else {
      setShowHelper(true);
      setCalibrationStep('idle');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-72 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl text-white"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Sensory Equalizer</h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            {/* Calibration Status */}
            {!isCalibrated && calibrationStep === 'idle' && !showHelper && (
              <div className="mb-6 p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl">
                <p className="text-[10px] text-indigo-200 font-medium mb-3">Audio environment not calibrated.</p>
                <button 
                  onClick={runCalibration}
                  className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold transition-all"
                >
                  Calibrate Environment
                </button>
              </div>
            )}

            {calibrationStep === 'testing' && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <p className="text-[10px] text-indigo-200 animate-pulse font-bold uppercase tracking-widest">Playing Chime...</p>
              </div>
            )}

            {calibrationStep === 'prompt' && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                <p className="text-xs font-bold mb-4">Did you hear the bell?</p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => confirmCalibration(true)}
                    className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-300"
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => confirmCalibration(false)}
                    className="flex-1 py-2 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg text-xs font-bold text-rose-300"
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {showHelper && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Audio Blocked</span>
                </div>
                <p className="text-[10px] text-rose-200/70 leading-relaxed mb-3">
                  Check your physical volume keys or OS master output. Ensure browser tab isn't muted.
                </p>
                <button 
                  onClick={runCalibration}
                  className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/40 rounded-lg text-[10px] font-bold transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {isAudioDucked && (
              <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center gap-3">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] text-amber-100 font-medium">Auto-Ducking Active (Crisis Mode)</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Binaural Intervention */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                  <span className="flex items-center gap-1.5"><Zap className="w-3 h-3" /> Binaural Intervention</span>
                  <span>{Math.round(audioSettings.binauralVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioSettings.binauralVolume}
                  onChange={(e) => handleSliderChange('binauralVolume', e.target.value)}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Ambient Presence */}
              <div className={`space-y-2 transition-opacity ${isAudioDucked ? 'opacity-40' : 'opacity-100'}`}>
                <div className="flex justify-between text-xs text-white/60">
                  <span className="flex items-center gap-1.5"><Music className="w-3 h-3" /> Ambient Presence</span>
                  <span>{Math.round(audioSettings.ambientVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioSettings.ambientVolume}
                  disabled={isAudioDucked}
                  onChange={(e) => handleSliderChange('ambientVolume', e.target.value)}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>

              {/* UI Feedback */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                  <span className="flex items-center gap-1.5"><Volume2 className="w-3 h-3" /> UI Feedback</span>
                  <span>{Math.round(audioSettings.uiFeedbackVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={audioSettings.uiFeedbackVolume}
                  onChange={(e) => handleSliderChange('uiFeedbackVolume', e.target.value)}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>

            <button
              onClick={handleToggleMute}
              className={`mt-8 w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-lg
                ${audioSettings.isMuted 
                  ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' 
                  : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'}`}
            >
              {audioSettings.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {audioSettings.isMuted ? 'All Interventions Muted' : 'Equalizer Active'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl border 
          ${isOpen 
            ? 'bg-indigo-500 border-white/20 rotate-90 scale-90' 
            : 'bg-slate-900 border-white/10 hover:border-indigo-500/50 hover:scale-105'}`}
      >
        <Settings2 className={`w-6 h-6 ${isOpen ? 'text-white' : 'text-indigo-400'}`} />
      </button>
    </div>
  );
};
