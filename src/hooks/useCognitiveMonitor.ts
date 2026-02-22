import { useEffect, useRef, useCallback } from 'react';
import { useCognitiveStore, CognitiveClassification } from '../stores/cognitiveStore';
import { BiometricVisionEngine } from '../lib/biometrics/faceMesh';
import { VoiceBiomarkerEngine } from '../lib/biometrics/voiceBiomarkers';
import { initCognitiveModel, predictLoadScore } from '../lib/ml/cognitiveModel';

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

  const visionEngine = useRef(new BiometricVisionEngine());
  const voiceEngine = useRef(new VoiceBiomarkerEngine());

  const modelInitialized = useRef(false);

  const calculateCognitiveLoad = useCallback(() => {
    if (!permissionsGranted) return;

    const currentMetrics = metrics.current;

    const errorRate =
      currentMetrics.totalKeystrokes > 0
        ? currentMetrics.backspaces / currentMetrics.totalKeystrokes
        : 0;

    const now = Date.now();
    keystrokeTimestamps.current = keystrokeTimestamps.current.filter(
      (timestamp) => now - timestamp <= ROLLING_WINDOW_MS
    );

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

    metrics.current.pauseFrequency = 0;
    metrics.current.contextSwitches = 0;
    metrics.current.totalKeystrokes = 0;
    metrics.current.backspaces = 0;
  }, [updateMetrics, permissionsGranted]);

  const startBiometrics = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!permissionsGranted) {
      console.warn("Biometric access denied: User has not granted permissions");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
      });

      videoElement.srcObject = stream;

      await visionEngine.current.startAnalysis(videoElement, (bioMetrics) => {
        metrics.current.facialTension = bioMetrics.tension;
      });

      await voiceEngine.current.startAnalysis((voiceMetrics) => {
        metrics.current.vocalEnergy = voiceMetrics.vocalEnergy;
      });

      return true;
    } catch (err) {
      console.warn("Biometric access denied", err);
      return false;
    }
  }, [permissionsGranted]);

  const stopBiometrics = useCallback(() => {
    // ✅ FIXED HERE
    if (typeof visionEngine.current.close === 'function') {
      visionEngine.current.close();
    }

    voiceEngine.current.stop();

    const videoElement = document.getElementById('biometric-video-feed') as HTMLVideoElement;
    if (videoElement?.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!permissionsGranted) {
      stopBiometrics();
      return;
    }

    if (!modelInitialized.current) {
      initCognitiveModel().catch(console.error);
      modelInitialized.current = true;
    }

    let ticking = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const now = Date.now();
          const timeSinceLastKey = now - lastKeystrokeTime.current;

          if (timeSinceLastKey > PAUSE_THRESHOLD_MS) {
            metrics.current.pauseFrequency += 1;
          }

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

    window.addEventListener('keydown', handleKeyDown, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('blur', handleWindowBlur, { passive: true });

    const intervalId = setInterval(
      calculateCognitiveLoad,
      EVALUATION_INTERVAL_MS
    );

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(intervalId);

      stopBiometrics();

      if (!permissionsGranted) {
        modelInitialized.current = false;
      }
    };
  }, [calculateCognitiveLoad, permissionsGranted, stopBiometrics]);

  return {
    startBiometrics,
    stopBiometrics,
  };
};