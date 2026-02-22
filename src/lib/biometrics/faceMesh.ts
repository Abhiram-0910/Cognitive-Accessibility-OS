import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class BiometricVisionEngine {
  private landmarker: FaceLandmarker | null = null;
  private isRunning = false;
  private videoElement: HTMLVideoElement | null = null;
  
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
          
          const leftBrowInner = landmarks[107];
          const rightBrowInner = landmarks[336];
          const browDistance = Math.abs(leftBrowInner.x - rightBrowInner.x);

          if (this.calibrationFrames < 30) {
            this.baselineBrowDistance += browDistance;
            this.calibrationFrames++;
          }
          
          const avgBaseline = this.baselineBrowDistance / Math.max(1, this.calibrationFrames);
          const tensionScore = Math.max(0, (avgBaseline - browDistance) / avgBaseline);

          const blendshapes = results.faceBlendshapes?.[0]?.categories || [];
          const eyeLookOut = blendshapes.find(b => b.categoryName === 'eyeLookOutLeft')?.score || 0;
          const eyeLookIn = blendshapes.find(b => b.categoryName === 'eyeLookInLeft')?.score || 0;
          
          const gazeWanderScore = (eyeLookOut + eyeLookIn) / 2;

          onTick({
            tension: Math.min(100, tensionScore * 1000), 
            gazeWander: Math.min(100, gazeWanderScore * 100),
          });
        }
      }
      // Only request the next frame if we are still running
      if (this.isRunning) {
        requestAnimationFrame(analyzeFrame);
      }
    };

    analyzeFrame();
  }

  // --- CRITICAL FIX: Explicit GPU & Camera Cleanup ---
  close() {
    this.isRunning = false;
    
    // 1. Kill the hardware camera tracks
    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }

    // 2. Free up WebGL/GPU memory allocated by MediaPipe
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}