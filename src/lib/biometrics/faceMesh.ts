/**
 * faceMesh.ts — Multi-Class Emotion Classifier
 *
 * Uses MediaPipe FaceLandmarker with GPU delegation to run real-time
 * blendshape-based emotion classification. Maps 52 ARKit-compatible
 * blendshapes to three composite emotion scores:
 *
 *   • Joy          (0–100) — derived from mouth/cheek smile shapes
 *   • Frustration  (0–100) — derived from brow tension, jaw clench, frown
 *   • Confusion    (0–100) — derived from asymmetric brow raise, squint, lip purse
 *
 * Also retains the original tension and gazeWander metrics for the
 * adult Dashboard pipeline.
 *
 * The onTick callback fires every processed frame with all 5 metrics.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EmotionMetrics {
  /** Composite facial tension score (brow + jaw) */
  tension: number;
  /** Lateral eye movement instability */
  gazeWander: number;
  /** Smile / cheek raise composite */
  joy: number;
  /** Brow furrow + jaw clench + mouth frown composite */
  frustration: number;
  /** Asymmetric brow raise + squint + lip purse composite */
  confusion: number;
}

// ─── Blendshape helpers ───────────────────────────────────────────────────────

type BlendshapeCategory = { categoryName: string; score: number };

/** Safe lookup — returns 0 if the blendshape doesn't exist in this frame. */
const bs = (shapes: BlendshapeCategory[], name: string): number =>
  shapes.find(b => b.categoryName === name)?.score ?? 0;

/** Clamp a value to the [0, 100] range. */
const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

// ─── Emotion scoring functions ────────────────────────────────────────────────

/**
 * Joy — weighted blend of smile-related blendshapes.
 *
 * Primary:   mouthSmileLeft + mouthSmileRight   (weight 0.45 each)
 * Secondary: cheekSquintLeft + cheekSquintRight  (weight 0.05 each)
 *
 * All blendshape values are 0.0–1.0 from MediaPipe; we multiply by 100.
 */
function computeJoy(s: BlendshapeCategory[]): number {
  const smileL  = bs(s, 'mouthSmileLeft');
  const smileR  = bs(s, 'mouthSmileRight');
  const cheekL  = bs(s, 'cheekSquintLeft');
  const cheekR  = bs(s, 'cheekSquintRight');

  const raw = (smileL * 0.45) + (smileR * 0.45) + (cheekL * 0.05) + (cheekR * 0.05);
  return clamp100(raw * 100);
}

/**
 * Frustration — weighted blend of tension-related blendshapes.
 *
 * Primary:   browDownLeft + browDownRight       (weight 0.25 each)
 * Secondary: jawOpen                             (weight 0.15)
 *            mouthFrownLeft + mouthFrownRight    (weight 0.10 each)
 *            noseSneerLeft + noseSneerRight       (weight 0.075 each)
 */
function computeFrustration(s: BlendshapeCategory[]): number {
  const browDL   = bs(s, 'browDownLeft');
  const browDR   = bs(s, 'browDownRight');
  const jaw      = bs(s, 'jawOpen');
  const frownL   = bs(s, 'mouthFrownLeft');
  const frownR   = bs(s, 'mouthFrownRight');
  const sneerL   = bs(s, 'noseSneerLeft');
  const sneerR   = bs(s, 'noseSneerRight');

  const raw =
    (browDL * 0.25) + (browDR * 0.25) +
    (jaw * 0.15) +
    (frownL * 0.10) + (frownR * 0.10) +
    (sneerL * 0.075) + (sneerR * 0.075);

  return clamp100(raw * 100);
}

/**
 * Confusion — weighted blend of puzzlement-related blendshapes.
 *
 * Primary:   |browInnerUp - browOuterUpLeft|  (asymmetric raise, weight 0.30)
 * Secondary: eyeSquintLeft + eyeSquintRight  (weight 0.15 each)
 *            browInnerUp                      (weight 0.20)
 *            mouthPucker                      (weight 0.10)
 *            mouthShrugUpper                  (weight 0.10)
 */
function computeConfusion(s: BlendshapeCategory[]): number {
  const browInner    = bs(s, 'browInnerUp');
  const browOuterL   = bs(s, 'browOuterUpLeft');
  const squintL      = bs(s, 'eyeSquintLeft');
  const squintR      = bs(s, 'eyeSquintRight');
  const pucker       = bs(s, 'mouthPucker');
  const shrugUpper   = bs(s, 'mouthShrugUpper');

  const asymmetry = Math.abs(browInner - browOuterL);

  const raw =
    (asymmetry * 0.30) +
    (browInner * 0.20) +
    (squintL * 0.15) + (squintR * 0.15) +
    (pucker * 0.10) +
    (shrugUpper * 0.10);

  return clamp100(raw * 100);
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class BiometricVisionEngine {
  private landmarker: FaceLandmarker | null = null;
  private isRunning = false;
  private videoElement: HTMLVideoElement | null = null;
  private isHeuristicFallback = false;
  
  // Heuristic variables
  private lastMousePos = { x: 0, y: 0 };
  private lastMouseTime = 0;
  private mouseVelocity = 0;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;

  // Calibration state for legacy tension metric
  private baselineBrowDistance = 0;
  private calibrationFrames = 0;

  // ── Face-lost tracking ────────────────────────────────────────────────────
  private faceLostStart: number | null = null;
  private isFaceLost = false;
  private readonly FACE_LOST_THRESHOLD_MS = 5000; // 5 seconds

  async initialize() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU', // Offloads to WebGL — keeps main thread free
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: true, // CRITICAL — enables all 52 ARKit blendshapes
      });
      console.log("[BiometricEngine] MediaPipe loaded successfully.");
    } catch (err) {
      console.error("[BiometricEngine] MediaPipe failed to load. Engaging Heuristic Fallback.", err);
      this.isHeuristicFallback = true;
    }
  }

  /**
   * Begin the real-time analysis loop.
   *
   * @param videoElement  Live webcam `<video>` element
   * @param onTick        Called every processed frame with all 5 metrics
   * @param onFrame       Optional ping for the debug overlay dot
   * @param onFaceLost    Called when no face detected for >5 seconds
   * @param onFaceRecovered Called when face returns after being lost
   */
  async startAnalysis(
    videoElement: HTMLVideoElement,
    onTick: (metrics: EmotionMetrics) => void,
    onFrame?: () => void,
    onFaceLost?: () => void,
    onFaceRecovered?: () => void,
  ) {
    if (!this.landmarker && !this.isHeuristicFallback) await this.initialize();
    
    this.videoElement = videoElement;
    this.isRunning = true;

    // ── Heuristic Fallback Mode ───────────────────────────────────────────────
    if (this.isHeuristicFallback) {
      console.warn("[BiometricEngine] Running in Heuristic Fallback mode (mouse tracking).");
      
      this.mouseMoveListener = (e: MouseEvent) => {
        const now = performance.now();
        if (this.lastMouseTime > 0) {
          const dx = e.clientX - this.lastMousePos.x;
          const dy = e.clientY - this.lastMousePos.y;
          const dt = now - this.lastMouseTime;
          
          if (dt > 0) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            // v is roughly pixels per millisecond
            const v = distance / dt;
            
            // smooth out velocity
            this.mouseVelocity = (this.mouseVelocity * 0.8) + (v * 0.2);
          }
        }
        
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        this.lastMouseTime = now;
      };
      
      window.addEventListener('mousemove', this.mouseMoveListener);
      
      // Heuristic synthesis loop masquerading as video frame ticks
      const heuristicLoop = () => {
        if (!this.isRunning) return;
        
        // Decay velocity if mouse stops
        if (performance.now() - this.lastMouseTime > 100) {
          this.mouseVelocity *= 0.9;
        }

        // Extremely rough mapping of mouse erraticism to cognitive components
        // High, erratic mouse movement loosely maps to frustration/wander.
        // Lack of movement is neutral.
        const v = Math.min(this.mouseVelocity, 10); // cap
        
        const pseudoFrustration = (v > 2) ? clamp100((v - 2) * 12) : 0;
        const pseudoGazeWander = clamp100(v * 15);
        const pseudoTension = clamp100(v * 8);

        onTick({
          tension: pseudoTension,
          gazeWander: pseudoGazeWander,
          joy: 0,
          frustration: pseudoFrustration,
          confusion: 0,
        });
        
        onFrame?.();
        
        setTimeout(heuristicLoop, 200); // 5Hz update rate
      };
      
      heuristicLoop();
      return;
    }

    // ── Standard MediaPipe Mode ───────────────────────────────────────────────
    let lastVideoTime = -1;

    const analyzeFrame = async () => {
      if (!this.isRunning || !this.videoElement) return;

      if (this.videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = this.videoElement.currentTime;
        const results = this.landmarker!.detectForVideo(
          this.videoElement,
          performance.now(),
        );

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          // ── Face recovered ──────────────────────────────────────────
          if (this.isFaceLost) {
            this.isFaceLost = false;
            this.faceLostStart = null;
            onFaceRecovered?.();
          } else {
            this.faceLostStart = null;
          }

          const landmarks = results.faceLandmarks[0];

          // ── Legacy tension (brow-distance based) ──────────────────────
          const leftBrowInner = landmarks[107];
          const rightBrowInner = landmarks[336];
          const browDistance = Math.abs(leftBrowInner.x - rightBrowInner.x);

          if (this.calibrationFrames < 30) {
            this.baselineBrowDistance += browDistance;
            this.calibrationFrames++;
          }
          const avgBaseline =
            this.baselineBrowDistance / Math.max(1, this.calibrationFrames);
          const tensionScore = Math.max(
            0,
            (avgBaseline - browDistance) / avgBaseline,
          );

          // ── Blendshape-derived metrics ────────────────────────────────
          const shapes: BlendshapeCategory[] =
            results.faceBlendshapes?.[0]?.categories ?? [];

          const eyeOutL = bs(shapes, 'eyeLookOutLeft');
          const eyeInL = bs(shapes, 'eyeLookInLeft');
          const gazeWanderScore = (eyeOutL + eyeInL) / 2;

          // ── Multi-class emotion scores ────────────────────────────────
          const joy = computeJoy(shapes);
          const frustration = computeFrustration(shapes);
          const confusion = computeConfusion(shapes);

          onTick({
            tension: clamp100(tensionScore * 1000),
            gazeWander: clamp100(gazeWanderScore * 100),
            joy,
            frustration,
            confusion,
          });
          onFrame?.();
        } else {
          // ── No face detected this frame ────────────────────────────────
          const now = performance.now();
          if (!this.faceLostStart) {
            this.faceLostStart = now;
          } else if (!this.isFaceLost && (now - this.faceLostStart) >= this.FACE_LOST_THRESHOLD_MS) {
            this.isFaceLost = true;
            console.warn('[BiometricVisionEngine] Face lost for >5 seconds — triggering telemetry loss.');
            onFaceLost?.();
          }
        }
      }

      if (this.isRunning) {
        requestAnimationFrame(analyzeFrame);
      }
    };

    analyzeFrame();
  }

  /** Clean up GPU + camera resources. */
  close() {
    this.isRunning = false;

    if (this.mouseMoveListener) {
      window.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = null;
    }

    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }

    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}