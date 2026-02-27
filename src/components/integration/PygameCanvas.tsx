import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const PygameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<string>('Booting Worker...');
  const { activeHeavyCompute, setActiveHeavyCompute } = useCognitiveStore();
  const [mutexError, setMutexError] = useState<boolean>(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    // WASM Mutex Lock
    if (activeHeavyCompute) {
      console.warn("[PygameCanvas] WASM Mutex active. Yielding resources.");
      setMutexError(true);
      setStatus("Resources busy (Face Tracking Active)");
      return;
    }

    try {
      setActiveHeavyCompute(true);
      window.dispatchEvent(new CustomEvent('WASM_CLAIM_RESOURCES'));

      // Transfer DOM control of the canvas to the worker thread
      const offscreen = canvasRef.current.transferControlToOffscreen();
      
      const worker = new Worker(new URL('../../workers/pyodide.worker.ts', import.meta.url), {
        type: 'classic', // Use classic so importScripts works
      });
      
      workerRef.current = worker;
      
      worker.onmessage = (e) => {
        if (e.data.type === 'STATUS') {
          setStatus(e.data.status);
        }
      };

      worker.postMessage({ type: 'INIT', canvas: offscreen }, [offscreen]);
    } catch (err) {
      console.error("Failed to initialize Pyodide Web Worker:", err);
      setStatus("Failed to boot Python runtime.");
      setActiveHeavyCompute(false);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      setActiveHeavyCompute(false);
    };
  }, []);

  if (mutexError) {
    return (
      <div className="relative w-[400px] h-[300px] bg-slate-900 rounded-xl flex flex-col items-center justify-center p-8 text-center border border-slate-700">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-white font-bold mb-2">Resource Conflict</h3>
        <p className="text-slate-400 text-sm">Please close biometric tracking to launch the Pygame environment.</p>
      </div>
    );
  }

  return (
    <div className="relative w-[400px] h-[300px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-slate-900/80 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin mb-4" />
          <p className="text-teal-400 font-mono text-sm animate-pulse">{status}</p>
        </div>
      )}
      {/* 
        Must specify raw width/height so the OffscreenCanvas starts with right dimensions.
        CSS sizing is applied to the container.
      */}
      <canvas ref={canvasRef} id="canvas" width={400} height={300} className="w-full h-full block" />
    </div>
  );
};
