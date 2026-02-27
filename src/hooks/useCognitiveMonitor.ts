import { useEffect, useRef, useCallback } from 'react';
import { useCognitiveStore, CognitiveClassification } from '../stores/cognitiveStore';
import { initCognitiveModel, predictLoadScore } from '../lib/ml/cognitiveModel';
import { BiometricVisionEngine } from '../lib/biometrics/faceMesh';
import { VoiceBiomarkerEngine } from '../lib/biometrics/voiceBiomarkers';

const EVALUATION_INTERVAL_MS = 2000;
const PAUSE_THRESHOLD_MS = 3000;
const ROLLING_WINDOW_MS = 60000;

export const useCognitiveMonitor = () => {
  const { updateMetrics, permissionsGranted, setPermissionsGranted } = useCognitiveStore();

  const metrics = useRef({
    totalKeystrokes: 0,
    backspaces: 0,
    pauseFrequency: 0,
    contextSwitches: 0,
    facialTension: 0,
    gazeWander: 0,
    vocalEnergy: 0,
    speechRate: 0
  });

  const lastKeystrokeTime = useRef<number>(Date.now());
  const keystrokeTimestamps = useRef<number[]>([]);
  const isHeuristicRef = useRef<boolean>(false);
  
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
    }, score, classification, isHeuristicRef.current);

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

    let stream: MediaStream | null = null;
    let videoEl: HTMLVideoElement | null = null;

    const setupSensors = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Setup hidden video element for FaceMesh
        videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.autoplay = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        
        await new Promise((resolve) => {
          videoEl!.onloadedmetadata = () => resolve(true);
        });

        visionEngine.current?.startAnalysis(
          videoEl,
          (m) => {
            metrics.current.facialTension = m.tension;
            metrics.current.gazeWander = m.gazeWander;
            isHeuristicRef.current = !!m.isHeuristic;
          },
          undefined,
          () => console.warn("Face lost"),
          () => console.log("Face recovered")
        );

        voiceEngine.current?.startAnalysis(
          (m) => {
            metrics.current.vocalEnergy = m.vocalEnergy;
            metrics.current.speechRate = m.speechRate;
          }
        );
      } catch (err) {
        console.error("[CognitiveMonitor] Sensor access failed:", err);
      }
    };

    setupSensors();

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Ctrl+Shift+D — Toggle telemetry / demo mode ───────────────────────
      // preventDefault stops the browser from opening DevTools on some configurations.
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        setPermissionsGranted(!permissionsGranted);
        return;
      }

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
    window.addEventListener('keydown', handleKeyDown, { passive: false });
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