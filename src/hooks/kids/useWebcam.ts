/**
 * useWebcam  — Kids Module
 *
 * Ported from: _legacy_repo_to_port/Frontend/src/hooks/useWebcam.js
 *
 * ─── ARCHITECTURE NOTE ──────────────────────────────────────────────────────
 * The main neuro-adaptive OS already uses `BiometricVisionEngine` (see
 * src/lib/biometrics/faceMesh.ts) which owns a MediaPipe FaceLandmarker
 * and drives its own camera stream via `startAnalysis(videoElement, onTick)`.
 *
 * This hook is STRICTLY ISOLATED to the Kids Module and must NOT be used
 * alongside `useCognitiveMonitor` on the same page — two concurrent
 * `getUserMedia` streams will compete for the same camera hardware and can
 * cause device conflicts on lower-end machines.
 *
 * Isolation contract:
 *  • Only mount this hook inside `<KidsModuleProvider>` / kids-module routes.
 *  • Call `stopWebcam()` on unmount to release the hardware track before
 *    the main OS's BiometricVisionEngine is re-initialized.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Configuration options for the `useWebcam` hook. */
export interface UseWebcamOptions {
  /**
   * Passed directly to `getUserMedia`. Defaults to `{ video: true }`.
   * Override to constrain resolution, frame rate, or select a specific
   * device (e.g. `{ video: { deviceId: { exact: myDeviceId } } }`).
   */
  constraints?: MediaStreamConstraints;
}

/** Return type of the `useWebcam` hook. */
export interface UseWebcamReturn {
  /** Ref to attach to a `<video>` element: `<video ref={videoRef} autoPlay muted />` */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** True once the user has granted camera permission and the stream is active. */
  webcamGranted: boolean;
  /** Error thrown by `getUserMedia`, if any. `null` when no error has occurred. */
  webcamError: Error | null;
  /** Call this to request camera access (place behind a user-gesture if needed). */
  requestWebcamAccess: () => Promise<void>;
  /** Call this on unmount to stop all hardware camera tracks. */
  stopWebcam: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides a lightweight, self-contained webcam stream for the Kids Module.
 *
 * Strictly isolated from the main OS `BiometricVisionEngine` — do not use
 * both simultaneously on the same page.
 *
 * Usage:
 * ```tsx
 * const { videoRef, webcamGranted, requestWebcamAccess, stopWebcam } = useWebcam();
 *
 * useEffect(() => { return () => stopWebcam(); }, [stopWebcam]);
 * ```
 */
const useWebcam = (options: UseWebcamOptions = {}): UseWebcamReturn => {
  const { constraints = { video: true } } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [webcamGranted, setWebcamGranted] = useState<boolean>(false);
  const [webcamError, setWebcamError] = useState<Error | null>(null);

  const requestWebcamAccess = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setWebcamGranted(true);
      setWebcamError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[useWebcam/kids] Error accessing webcam:', error);
      setWebcamGranted(false);
      setWebcamError(error);
    }
  }, [constraints]);

  /** Stops all hardware tracks and resets state. Call explicitly on unmount. */
  const stopWebcam = useCallback((): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setWebcamGranted(false);
  }, []);

  return { videoRef, webcamGranted, webcamError, requestWebcamAccess, stopWebcam };
};

export default useWebcam;
