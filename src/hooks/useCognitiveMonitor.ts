import { useEffect, useRef, useCallback } from 'react';
import { useCognitiveStore, CognitiveClassification } from '../stores/cognitiveStore';
import { BiometricVisionEngine } from '../lib/biometrics/faceMesh';
import { VoiceBiomarkerEngine } from '../lib/biometrics/voiceBiomarkers';
import { initCognitiveModel, predictLoadScore } from '../lib/ml/cognitiveModel';

// Configuration for the monitoring window
const EVALUATION_INTERVAL_MS = 2000; // Evaluate and debounce updates every 2 seconds
const PAUSE_THRESHOLD_MS = 3000; // >3s between keystrokes counts as a cognitive pause
const ROLLING_WINDOW_MS = 60000; // Calculate KPM over a 1-minute rolling window

export const useCognitiveMonitor = () => {
  const updateMetrics = useCognitiveStore((state) => state.updateMetrics);

  // Initialize the TF.js model on mount
  useEffect(() => {
    initCognitiveModel().catch(console.error);
  }, []);

  // Mutable refs for high-frequency tracking (prevents React render flooding)
  const metrics = useRef({
    totalKeystrokes: 0,
    backspaces: 0,
    pauseFrequency: 0,
    contextSwitches: 0,
    // Biometric metrics (continuously updated by engines)
    facialTension: 0,
    vocalEnergy: 0
  });

  const lastKeystrokeTime = useRef<number>(Date.now());
  const keystrokeTimestamps = useRef<number[]>([]);

  // Biometric engine refs
  const visionEngine = useRef(new BiometricVisionEngine());
  const voiceEngine = useRef(new VoiceBiomarkerEngine());

  const calculateCognitiveLoad = useCallback(() => {
    const currentMetrics = metrics.current;

    // 1. Calculate Error Rate (Ratio of backspaces to total keystrokes)
    const errorRate =
      currentMetrics.totalKeystrokes > 0
        ? currentMetrics.backspaces / currentMetrics.totalKeystrokes
        : 0;

    // 2. Calculate Keystrokes Per Minute (KPM)
    const now = Date.now();
    // Prune timestamps older than 60 seconds
    keystrokeTimestamps.current = keystrokeTimestamps.current.filter(
      (timestamp) => now - timestamp <= ROLLING_WINDOW_MS
    );
    const kpm = keystrokeTimestamps.current.length;

    // 3. Use TensorFlow.js Edge Model instead of hardcoded math
    const features = [
      kpm,
      errorRate,
      currentMetrics.pauseFrequency,
      currentMetrics.contextSwitches,
      currentMetrics.facialTension,
      currentMetrics.vocalEnergy
    ];

    const score = predictLoadScore(features);

    // 4. Map to Classifications
    let classification: CognitiveClassification = 'normal';
    if (score <= 25) classification = 'hyperfocus';
    else if (score <= 65) classification = 'normal';
    else if (score <= 80) classification = 'approaching_overload';
    else classification = 'overload';

    // 5. Dispatch to Zustand (Debounced by the interval)
    updateMetrics(
      {
        keystrokesPerMinute: kpm,
        errorRate,
        pauseFrequency: currentMetrics.pauseFrequency,
        contextSwitches: currentMetrics.contextSwitches,
        facialTension: currentMetrics.facialTension,
        vocalEnergy: currentMetrics.vocalEnergy,
      },
      score,
      classification
    );

    // 6. Reset cumulative counters for the next evaluation window
    // Note: Biometric metrics are continuously updated by engines, so we don't reset them here
    metrics.current.pauseFrequency = 0;
    metrics.current.contextSwitches = 0;
    metrics.current.totalKeystrokes = 0;
    metrics.current.backspaces = 0;
  }, [updateMetrics]);

  // Method to start biometric tracking during meetings
  const startBiometrics = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
        audio: true 
      });
      videoElement.srcObject = stream;
      
      // Start Face Tracking
      await visionEngine.current.startAnalysis(videoElement, (bioMetrics) => {
        metrics.current.facialTension = bioMetrics.tension;
      });

      // Start Voice Tracking
      await voiceEngine.current.startAnalysis((voiceMetrics) => {
        metrics.current.vocalEnergy = voiceMetrics.vocalEnergy;
      });
      
      return true;
    } catch (err) {
      console.warn("Biometric access denied", err);
      return false;
    }
  }, []);

  // Method to stop biometric tracking
  const stopBiometrics = useCallback(() => {
    visionEngine.current.stop();
    voiceEngine.current.stop();
    
    // Stop all media tracks to release camera/mic
    const videoElement = document.getElementById('biometric-video-feed') as HTMLVideoElement;
    if (videoElement?.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let ticking = false;

    // High-performance throttling for DOM events to prevent JS main thread lockup
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const now = Date.now();
          const timeSinceLastKey = now - lastKeystrokeTime.current;

          // Track Pause Frequency
          if (timeSinceLastKey > PAUSE_THRESHOLD_MS) {
            metrics.current.pauseFrequency += 1;
          }

          // Track Error Rate & Volume (Privacy-first: only checking if it's a Backspace/Delete)
          if (e.key === 'Backspace' || e.key === 'Delete') {
            metrics.current.backspaces += 1;
          }
          
          metrics.current.totalKeystrokes += 1;
          keystrokeTimestamps.current.push(now);
          lastKeystrokeTime.current = now;
          
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        metrics.current.contextSwitches += 1;
      }
    };

    const handleWindowBlur = () => {
      metrics.current.contextSwitches += 1;
    };

    // Attach Listeners
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('blur', handleWindowBlur, { passive: true });

    // Start Evaluation Loop
    const intervalId = setInterval(calculateCognitiveLoad, EVALUATION_INTERVAL_MS);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(intervalId);
      // Also stop biometrics on unmount to release media devices
      stopBiometrics();
    };
  }, [calculateCognitiveLoad, stopBiometrics]);

  // Expose biometric control methods for external use
  return {
    startBiometrics,
    stopBiometrics,
  };
};