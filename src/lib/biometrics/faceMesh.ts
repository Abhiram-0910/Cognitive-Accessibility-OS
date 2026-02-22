import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class BiometricVisionEngine {
  private landmarker: FaceLandmarker | null = null;
  private isRunning = false;
  private videoElement: HTMLVideoElement | null = null;
  
  // Baselines for the specific user to calculate delta
  private baselineBrowDistance = 0;
  private calibrationFrames = 0;

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU" // Offloads to GPU to save main thread CPU
      },
      runningMode: "VIDEO",
      outputFaceBlendshapes: true,
    });
  }

  async startAnalysis(videoElement: HTMLVideoElement, onTick: (metrics: { tension: number, gazeWander: number }) => void) {
    if (!this.landmarker) await this.initialize();
    this.videoElement = videoElement;
    this.isRunning = true;

    let lastVideoTime = -1;

    const analyzeFrame = async () => {
      if (!this.isRunning || !this.videoElement) return;

      if (this.videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = this.videoElement.currentTime;
        const results = this.landmarker!.detectForVideo(this.videoElement, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          
          // Heuristic 1: Brow Tension (Distance between inner eyebrows: indices 107 and 336)
          const leftBrowInner = landmarks[107];
          const rightBrowInner = landmarks[336];
          const browDistance = Math.abs(leftBrowInner.x - rightBrowInner.x);

          // Calibrate baseline dynamically
          if (this.calibrationFrames < 30) {
            this.baselineBrowDistance += browDistance;
            this.calibrationFrames++;
          }
          
          const avgBaseline = this.baselineBrowDistance / Math.max(1, this.calibrationFrames);
          // If distance shrinks below baseline, tension is high (furrowed brow)
          const tensionScore = Math.max(0, (avgBaseline - browDistance) / avgBaseline);

          // Heuristic 2: Gaze Wander (Simplified tracking of iris center relative to eye corners)
          // In a full implementation, you'd calculate the iris bounding box delta over time
          // Here we use the blendshapes if available, or simulate it
          const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
          const eyeLookOut = blendshapes.find(b => b.categoryName === 'eyeLookOutLeft')?.score || 0;
          const eyeLookIn = blendshapes.find(b => b.categoryName === 'eyeLookInLeft')?.score || 0;
          
          const gazeWanderScore = (eyeLookOut + eyeLookIn) / 2;

          onTick({
            tension: Math.min(100, tensionScore * 1000), // Scaled for 0-100 UI
            gazeWander: Math.min(100, gazeWanderScore * 100),
          });
        }
      }
      requestAnimationFrame(analyzeFrame);
    };

    analyzeFrame();
  }

  stop() {
    this.isRunning = false;
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }
}