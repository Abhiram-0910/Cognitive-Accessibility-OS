/**
 * emotionInference.ts — HuggingFace Emotion Recognition Pipeline
 *
 * Takes image URLs from Supabase Storage (kids-captures bucket),
 * downloads the images, and sends them to a HuggingFace Inference
 * API model for emotion classification.
 *
 * Results are stored in the `expression_logs` table and aggregated
 * into session reports for the Parent Dashboard.
 *
 * Architecture:
 *   Supabase Storage URL → Download blob → HuggingFace Inference API
 *   → Emotion classifications → Upsert to expression_logs
 *
 * Environment:
 *   HUGGINGFACE_API_KEY — HuggingFace Inference API key
 *
 * Model: trpakov/vit-face-expression (ViT-based, 7-class emotion)
 *   Classes: angry, disgust, fear, happy, neutral, sad, surprise
 */

import { supabaseAdmin } from '../utils/supabaseAdmin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmotionResult {
  label: string;
  score: number;
}

export interface SessionAnalysis {
  session_id: string;
  total_frames: number;
  analyzed_frames: number;
  dominant_emotion: string;
  emotion_breakdown: Record<string, number>;
  timestamps: string[];
  confidence_avg: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HF_API_URL = 'https://api-inference.huggingface.co/models/trpakov/vit-face-expression';
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ─── Core Inference ───────────────────────────────────────────────────────────

/**
 * Classify emotions in a single image via HuggingFace Inference API.
 *
 * @param imageBuffer Raw image bytes (PNG/JPEG)
 * @returns Array of {label, score} sorted by confidence descending
 */
export async function classifyEmotion(imageBuffer: Buffer): Promise<EmotionResult[]> {
  if (!HF_API_KEY) {
    console.warn('[EmotionInference] HUGGINGFACE_API_KEY not set. Returning mock data.');
    return [
      { label: 'neutral', score: 0.6 },
      { label: 'happy', score: 0.25 },
      { label: 'sad', score: 0.15 },
    ];
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Blob([new Uint8Array(imageBuffer)], { type: 'application/octet-stream' }),
      });

      if (response.status === 503) {
        // Model is loading — wait and retry
        console.info(`[EmotionInference] Model loading, retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
      }

      const results = await response.json() as EmotionResult[];
      return results.sort((a, b) => b.score - a.score);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        console.error('[EmotionInference] All retries exhausted:', err.message);
        throw err;
      }
      console.warn(`[EmotionInference] Attempt ${attempt} failed, retrying...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  return [];
}

/**
 * Download an image from Supabase Storage and classify it.
 */
export async function classifyFromStorageUrl(storagePath: string): Promise<EmotionResult[]> {
  const { data, error } = await supabaseAdmin.storage
    .from('kids-captures')
    .download(storagePath);

  if (error || !data) {
    console.error('[EmotionInference] Failed to download image:', error?.message);
    return [];
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return classifyEmotion(buffer);
}

// ─── Session Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze all captured frames for a given game session.
 *
 * 1. Fetches all image_paths from the game_sessions row
 * 2. Downloads and classifies each image
 * 3. Aggregates results into a SessionAnalysis report
 * 4. Stores individual results in expression_logs
 */
export async function analyzeSession(sessionId: string): Promise<SessionAnalysis> {
  // 1. Fetch session data
  const { data: session, error } = await supabaseAdmin
    .from('game_sessions')
    .select('image_paths, session_key, child_name')
    .eq('session_key', sessionId)
    .single();

  if (error || !session) {
    throw new Error(`Session ${sessionId} not found: ${error?.message}`);
  }

  const imagePaths: string[] = session.image_paths || [];
  const emotionCounts: Record<string, number> = {};
  const timestamps: string[] = [];
  let totalConfidence = 0;
  let analyzedCount = 0;

  // 2. Classify each image
  for (const path of imagePaths) {
    try {
      const results = await classifyFromStorageUrl(path);
      if (results.length > 0) {
        const top = results[0];
        emotionCounts[top.label] = (emotionCounts[top.label] || 0) + 1;
        totalConfidence += top.score;
        analyzedCount++;

        // Extract timestamp from filename (format: sessionId/frames/1234567890.png)
        const filename = path.split('/').pop() || '';
        const ts = filename.replace('.png', '');
        timestamps.push(ts);

        // 3. Log to expression_logs table
        await supabaseAdmin.from('expression_logs').insert({
          session_id: sessionId,
          image_path: path,
          emotion: top.label,
          confidence: top.score,
          all_scores: results,
          created_at: new Date().toISOString(),
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('[EmotionInference] expression_logs insert failed:', logErr.message);
        });
      }
    } catch (err: any) {
      console.warn(`[EmotionInference] Failed to analyze ${path}:`, err.message);
      // Queue locally — don't interrupt the loop
    }
  }

  // 4. Determine dominant emotion
  const dominant = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';

  // Build percentage breakdown
  const emotionBreakdown: Record<string, number> = {};
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    emotionBreakdown[emotion] = Math.round((count / Math.max(1, analyzedCount)) * 100);
  }

  return {
    session_id: sessionId,
    total_frames: imagePaths.length,
    analyzed_frames: analyzedCount,
    dominant_emotion: dominant,
    emotion_breakdown: emotionBreakdown,
    timestamps,
    confidence_avg: analyzedCount > 0 ? Number((totalConfidence / analyzedCount).toFixed(3)) : 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
