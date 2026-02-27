/**
 * Kids Module Hooks — Barrel Export
 *
 * Import from this file to use any kids-module hook:
 *
 * ```tsx
 * import { useCapture, useSessionId, useWebcam } from '@/hooks/kids';
 * import type { CaptureMetadata, UseWebcamReturn } from '@/hooks/kids';
 * ```
 */

// Hooks (default exports re-exported as named)
export { default as useCapture }   from './useCapture';
export { default as useSessionId } from './useSessionId';
export { default as useWebcam }    from './useWebcam';

// Types — each file owns its own interfaces; all surfaced here for convenience
export type {
  CaptureMetadata,
  CaptureUploader,
  UseCaptureOptions,
  UseCaptureReturn,
} from './useCapture';

export type { UseSessionIdReturn } from './useSessionId';

export type {
  UseWebcamOptions,
  UseWebcamReturn,
} from './useWebcam';
