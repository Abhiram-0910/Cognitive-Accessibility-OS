-- =========================================================
-- Migration: Add ai_report column to game_sessions
-- Required by: server/src/routes/api.ts /agents/session-report endpoint
-- Description: Stores cached HuggingFace ViT emotion analysis results
--              so subsequent requests return instantly (no re-inference).
-- =========================================================

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS ai_report JSONB DEFAULT NULL;

-- Optional index for quick non-null checks (e.g. "sessions with report ready")
CREATE INDEX IF NOT EXISTS idx_game_sessions_ai_report_not_null
  ON public.game_sessions ((ai_report IS NOT NULL));

COMMENT ON COLUMN public.game_sessions.ai_report IS
  'Cached HuggingFace ViT emotion analysis. Shape: { dominant_emotion, emotion_breakdown, analyzed_frames, generated_at, inference_source }';
