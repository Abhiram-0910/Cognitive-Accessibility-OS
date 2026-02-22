import { useEffect, useRef, useCallback } from 'react';
import { useCognitiveStore, CognitiveClassification } from '../stores/cognitiveStore';
import { initCognitiveModel, predictLoadScore } from '../lib/ml/cognitiveModel';
import { BiometricVisionEngine } from '../lib/biometrics/faceMesh';
import { VoiceBiomarkerEngine } from '../lib/biometrics/voiceBiomarkers';

const EVALUATION_INTERVAL_MS = 2000;
const PAUSE_THRESHOLD_MS = 3000;
const ROLLING_WINDOW_MS = 60000;

export const useCognitiveMonitor = () => {
  const { updateMetrics, permissionsGranted } = useCognitiveStore();

  const metrics = useRef({
    totalKeystrokes: 0,
    backspaces: 0,
    pauseFrequency: 0,
    contextSwitches: 0,
    facialTension: 0,
    vocalEnergy: 0
  });

  const lastKeystrokeTime = useRef<number>(Date.now());
  const keystrokeTimestamps = useRef<number[]>([]);
  
  // Use Refs to manage singleton instances of the hardware engines
  const visionEngine = useRef<BiometricVisionEngine | null>(null);
  const voiceEngine = useRef<VoiceBiomarkerEngine | null>(null);

  const calculateCognitiveLoad = useCallback(() => {
    const currentMetrics = metrics.current;
    const errorRate = currentMetrics.totalKeystrokes > 0 ? currentMetrics.backspaces / currentMetrics.totalKeystrokes : 0;
    
    const now = Date.now();
    keystrokeTimestamps.current = keystrokeTimestamps.current.filter((ts) => now - ts <= ROLLING_WINDOW_MS);
    const kpm = keystrokeTimestamps.current.length;

    const features = [
      kpm,
      errorRate,
      currentMetrics.pauseFrequency,
      currentMetrics.contextSwitches,
      currentMetrics.facialTension,
      currentMetrics.vocalEnergy
    ];

    const score = predictLoadScore(features);

    let classification: CognitiveClassification = 'normal';
    if (score <= 25) classification = 'hyperfocus';
    else if (score <= 65) classification = 'normal';
    else if (score <= 80) classification = 'approaching_overload';
    else classification = 'overload';

    updateMetrics({
      keystrokesPerMinute: kpm,
      errorRate,
      pauseFrequency: currentMetrics.pauseFrequency,
      contextSwitches: currentMetrics.contextSwitches,
    }, score, classification);

    metrics.current.pauseFrequency = 0;
    metrics.current.contextSwitches = 0;
    metrics.current.totalKeystrokes = 0;
    metrics.current.backspaces = 0;
  }, [updateMetrics]);

  useEffect(() => {
    if (!permissionsGranted) return;

    let ticking = false;
    let intervalId: NodeJS.Timeout;

    // Safely instantiate hardware engines only if they don't exist
    if (!visionEngine.current) visionEngine.current = new BiometricVisionEngine();
    if (!voiceEngine.current) voiceEngine.current = new VoiceBiomarkerEngine();

    // Initialize Edge ML Model
    initCognitiveModel().catch(console.error);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const now = Date.now();
          const timeSinceLastKey = now - lastKeystrokeTime.current;

          if (timeSinceLastKey > PAUSE_THRESHOLD_MS) metrics.current.pauseFrequency += 1;
          if (e.key === 'Backspace' || e.key === 'Delete') metrics.current.backspaces += 1;
          
          metrics.current.totalKeystrokes += 1;
          keystrokeTimestamps.current.push(now);
          lastKeystrokeTime.current = now;
          
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleVisibilityChange = () => { if (document.hidden) metrics.current.contextSwitches += 1; };
    const handleWindowBlur = () => { metrics.current.contextSwitches += 1; };

    // Bind Listeners
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('blur', handleWindowBlur, { passive: true });

    // Start Telemetry Loop
    intervalId = setInterval(calculateCognitiveLoad, EVALUATION_INTERVAL_MS);

    // 🛑 STRICT MODE CLEANUP
    // Guarantees all events, loops, and hardware requests are destroyed on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(intervalId);
      
      if (visionEngine.current) {
        visionEngine.current.close();
        visionEngine.current = null;
      }
      
      if (voiceEngine.current) {
        voiceEngine.current.stop();
        voiceEngine.current = null;
      }
    };
  }, [calculateCognitiveLoad, permissionsGranted]);
};