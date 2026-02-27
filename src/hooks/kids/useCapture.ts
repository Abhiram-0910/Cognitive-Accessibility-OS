/**
 * useCapture  — Kids Module
 *
 * Ported from: _legacy_repo_to_port/Frontend/src/hooks/useCapture.js
 *
 * Captures frames from a live video element and DOM screenshots, then uploads
 * them to Supabase Storage for expression analysis.
 *
 * ─── STORAGE LAYOUT ─────────────────────────────────────────────────────────
 *   Bucket: kids-captures     → webcam frame PNGs
 *     Path: {sessionId}/frames/{timestamp}.png
 *
 *   Bucket: kids-captures     → DOM screenshot PNGs
 *     Path: {sessionId}/screenshots/{timestamp}.png
 *
 * After each upload the public URL is appended to the matching
 * `game_sessions` row via `array_append` on `image_paths` / `screenshot_paths`.
 *
 * TODO: Integrate with local MediaPipe faceMesh.ts pipeline before upload
 *       to generate expression_logs rows in-process.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../../lib/supabase';

// Rate-limit canvas-ref warnings so they don't flood the console
let _canvasWarnedOnce = false;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Metadata attached to every capture — maps to `game_sessions` columns. */
export interface CaptureMetadata {
  /** Maps to `game_sessions.session_key` */
  sessionId: string;
  /** Maps to `game_sessions.session_name` (player display name) */
  sessionName: string;
  /** Maps to `game_sessions.session_game_name` */
  gameName: string;
}

/**
 * Injectable transport interface for uploading capture blobs.
 *
 * Implement this to swap between:
 *  - Supabase Storage (production)
 *  - Local Express server (legacy)
 *  - Mock/no-op (tests)
 */
export interface CaptureUploader {
  /**
   * Upload a raw image frame captured from the video element.
   * @param blob   - PNG blob from `canvas.toBlob`
   * @param meta   - Session metadata for the upload
   */
  uploadFrame(blob: Blob, meta: CaptureMetadata): Promise<void>;

  /**
   * Upload a full-page DOM screenshot.
   * @param blob   - PNG blob from `html2canvas`
   * @param meta   - Session metadata for the upload
   */
  uploadScreenshot(blob: Blob, meta: CaptureMetadata): Promise<void>;
}

/** Configuration passed to `useCapture`. */
export interface UseCaptureOptions {
  /** Ref pointing to the `<video>` element to capture frames from. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /**
   * Injectable uploader. Defaults to the legacy Express uploader.
   * Pass `supabaseUploader` (see TODO below) for production.
   */
  uploader?: CaptureUploader;
}

/** Return type of the `useCapture` hook. */
export interface UseCaptureReturn {
  /** Attach this ref to a hidden `<canvas>` element in the component tree. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /**
   * Capture a single video frame and upload it.
   * @param meta - Session metadata for the upload.
   */
  captureImage: (meta: CaptureMetadata) => void;
  /**
   * Capture a full DOM screenshot and upload it.
   * @param meta - Session metadata for the upload.
   */
  captureScreenshot: (meta: CaptureMetadata) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Default legacy uploader (calls old Express endpoints — preserved for compat)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Supabase Storage uploader (production default)
// ---------------------------------------------------------------------------

/**
 * Uploads captured blobs to Supabase Storage (`kids-captures` bucket).
 *
 * Storage paths:
 *   - Webcam frames:  {sessionId}/frames/{timestamp}.png
 *   - DOM screenshots: {sessionId}/screenshots/{timestamp}.png
 *
 * After each upload, the storage path is appended to the corresponding
 * `game_sessions` row via the `image_paths` / `screenshot_paths` array column.
 *
 * Bucket: `kids-captures` — must be created in the Supabase Dashboard with
 * RLS policies allowing authenticated inserts.
 *
 * TODO: Integrate with local MediaPipe faceMesh.ts pipeline before upload
 *       to populate `expression_logs` rows in-process.
 */
const supabaseUploader: CaptureUploader = {
  async uploadFrame(blob: Blob, meta: CaptureMetadata): Promise<void> {
    // TODO: Integrate with local MediaPipe faceMesh.ts pipeline
    // Pass the blob through BiometricVisionEngine.detectForVideo() before
    // uploading so expression_logs rows can be created in-process.
    const ts = Date.now();
    const path = `${meta.sessionId}/frames/${ts}.png`;

    const { error: uploadErr } = await supabase.storage
      .from('kids-captures')
      .upload(path, blob, { contentType: 'image/png', upsert: false });

    if (uploadErr) {
      throw new Error(`[useCapture/kids] Frame upload failed: ${uploadErr.message}`);
    }

    // Append path to game_sessions.image_paths[] by matching session_key
    await supabase
      .from('game_sessions')
      .update({
        image_paths: supabase.rpc('array_append_text', { arr_col: 'image_paths', new_val: path }),
      })
      .eq('session_key', meta.sessionId);
  },

  async uploadScreenshot(blob: Blob, meta: CaptureMetadata): Promise<void> {
    // TODO: Integrate with local MediaPipe faceMesh.ts pipeline
    // Consider passing screenshots through expression analysis before persisting.
    const ts = Date.now();
    const path = `${meta.sessionId}/screenshots/${ts}.png`;

    const { error: uploadErr } = await supabase.storage
      .from('kids-captures')
      .upload(path, blob, { contentType: 'image/png', upsert: false });

    if (uploadErr) {
      throw new Error(`[useCapture/kids] Screenshot upload failed: ${uploadErr.message}`);
    }

    // Append path to game_sessions.screenshot_paths[]
    await supabase
      .from('game_sessions')
      .update({
        screenshot_paths: supabase.rpc('array_append_text', { arr_col: 'screenshot_paths', new_val: path }),
      })
      .eq('session_key', meta.sessionId);
  },
};

// Legacy Express uploader — preserved for local dev fallback.
// Swap `uploader` prop in useCapture({ uploader: legacyExpressUploader }) to use.
const legacyExpressUploader: CaptureUploader = {
  async uploadFrame(blob: Blob, meta: CaptureMetadata): Promise<void> {
    const formData = new FormData();
    formData.append('image', blob, 'capture.png');
    formData.append('newSessionId', meta.sessionId);
    formData.append('sessionName', meta.sessionName);
    formData.append('gameName', meta.gameName);
    const response = await fetch('http://localhost:5000/child/uploads', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`[useCapture/kids] Frame upload failed: ${response.statusText}`);
  },
  async uploadScreenshot(blob: Blob, meta: CaptureMetadata): Promise<void> {
    const formData = new FormData();
    formData.append('screenshot', blob, 'screenshot.png');
    formData.append('newSessionId', meta.sessionId);
    formData.append('sessionName', meta.sessionName);
    formData.append('gameName', meta.gameName);
    const response = await fetch('http://localhost:5000/child/screenshots', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`[useCapture/kids] Screenshot upload failed: ${response.statusText}`);
  },
};

// Suppress lint warning — exported so callers can opt in
export { legacyExpressUploader };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides frame-capture and DOM-screenshot utilities for the Kids Module.
 *
 * The hook requires a `<canvas>` element in the DOM for intermediate frame
 * rendering. Attach `canvasRef` to a hidden canvas:
 * ```tsx
 * <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
 * ```
 *
 * Usage:
 * ```tsx
 * const { videoRef } = useWebcam();
 * const { sessionId } = useSessionId();
 * const { canvasRef, captureImage, captureScreenshot } = useCapture({ videoRef });
 *
 * // On an interval or user gesture:
 * captureImage({ sessionId: sessionId!, sessionName: 'Alice', gameName: 'emotion-match' });
 * ```
 */
const useCapture = ({
  videoRef,
  uploader = supabaseUploader,
}: UseCaptureOptions): UseCaptureReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Draws the current video frame to the canvas and uploads the resulting PNG blob. */
  const captureImage = useCallback(
    (meta: CaptureMetadata): void => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!canvas) {
        if (!_canvasWarnedOnce) {
          console.warn('[useCapture/kids] Canvas ref is not attached yet — will retry on next interval.');
          _canvasWarnedOnce = true;
        }
        return;
      }
      if (!video) {
        console.error('[useCapture/kids] Video ref is not attached.');
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        console.error('[useCapture/kids] Could not get 2D canvas context.');
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('[useCapture/kids] Failed to create Blob from canvas frame.');
          return;
        }
        try {
          // TODO: Integrate with local MediaPipe faceMesh.ts pipeline
          // Pass the blob through BiometricVisionEngine.detectForVideo() before
          // uploading, so expression_logs rows can be created in-process.
          await uploader.uploadFrame(blob, meta);
        } catch (err) {
          console.error('[useCapture/kids] captureImage upload error:', err);
        }
      }, 'image/png');
    },
    [videoRef, uploader],
  );

  /** Renders the full document.body to a canvas via html2canvas, then uploads. */
  const captureScreenshot = useCallback(
    async (meta: CaptureMetadata): Promise<void> => {
      try {
        const screenshotCanvas = await html2canvas(document.body, {
          allowTaint: true,
          useCORS: true,
          // Skip video elements — they're always cross-origin tainted and
          // generate "Unable to clone video as it is tainted" warnings.
          ignoreElements: (el: Element) => el.tagName === 'VIDEO',
        });
        screenshotCanvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('[useCapture/kids] Failed to create Blob from screenshot.');
            return;
          }
          try {
            // TODO: Integrate with local MediaPipe faceMesh.ts pipeline
            // Consider whether screenshots should also be passed through
            // expression analysis before being persisted to Storage.
            await uploader.uploadScreenshot(blob, meta);
          } catch (err) {
            console.error('[useCapture/kids] captureScreenshot upload error:', err);
          }
        }, 'image/png');
      } catch (err) {
        console.error('[useCapture/kids] html2canvas error:', err);
      }
    },
    [uploader],
  );

  return { canvasRef, captureImage, captureScreenshot };
};

export default useCapture;
