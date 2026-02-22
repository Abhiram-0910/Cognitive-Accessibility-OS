import React, { useState } from 'react';
import { Camera, Mic, Shield, Lock, CheckCircle2 } from 'lucide-react';

interface PermissionsProps {
  onAccept: () => void;
  onDecline: () => void;
}

export const PermissionsRequest: React.FC<PermissionsProps> = ({ onAccept, onDecline }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      // Trigger the browser's native permission prompts
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      onAccept();
    } catch (err) {
      console.warn("User denied device permissions.");
      onDecline();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-indigo-50 p-6 flex flex-col items-center text-center border-b border-indigo-100">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <Shield className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Zero-Trust Biometrics</h2>
          <p className="text-sm text-indigo-600/80 mt-1 font-medium">Your data stays on your machine.</p>
        </div>

        <div className="p-6">
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            To provide real-time cognitive assistance, the OS requests access to your camera and microphone. 
            We use these to detect signs of sensory overload (like vocal tension and gaze wandering).
          </p>

          <ul className="space-y-3 mb-8">
            <li className="flex gap-3 text-sm text-slate-700 items-center">
              <Camera className="w-4 h-4 text-slate-400" /> Processed via local TensorFlow.js.
            </li>
            <li className="flex gap-3 text-sm text-slate-700 items-center">
              <Mic className="w-4 h-4 text-slate-400" /> Audio feeds are never recorded or saved.
            </li>
            <li className="flex gap-3 text-sm text-slate-700 items-center">
              <Lock className="w-4 h-4 text-slate-400" /> Cloud transmission is mathematically impossible.
            </li>
          </ul>

          <div className="flex gap-3">
            <button
              onClick={onDecline}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Not Now
            </button>
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? "Verifying..." : <><CheckCircle2 className="w-4 h-4" /> Enable Sensors</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};