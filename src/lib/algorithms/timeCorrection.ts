/**
 * timeCorrection.ts — Personal Time-Blindness Correction Algorithm
 *
 * Neurodivergent people (especially ADHD) chronically underestimate how
 * long tasks will take. This module calculates a personal `timeMultiplier`
 * from historical task data and applies it to new Gemini-generated estimates.
 *
 * Algorithm:
 *  1. Fetch the last N completed tasks (estimated vs actual minutes).
 *  2. Filter extreme outliers (>10x deviation = left timer running overnight).
 *  3. Apply recency weighting — recent tasks matter more than old ones.
 *  4. Calculate a weighted ratio: sum(weight * actual) / sum(weight * estimated).
 *  5. Clamp the multiplier to a safe range [0.8, 2.5].
 *  6. If fewer than 5 data points exist, return 1.35x (safe ADHD default).
 *
 * Exports:
 *  - calculateTimeCorrectionFactor(userId)  → personal multiplier
 *  - applyTimeBuffer(rawMinutes, factor)    → corrected minutes
 *  - correctGeminiEstimates(tasks, userId)  → batch-correct array of tasks
 */

import { supabase } from '../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoricalTask {
  estimated_minutes: number;
  actual_minutes: number;
  completed_at?: string;
}

export interface GeminiTask {
  title: string;
  description?: string;
  estimated_minutes: number;
  [key: string]: unknown;
}

export interface CorrectedTask extends GeminiTask {
  /** Original Gemini estimate (before correction). */
  raw_estimated_minutes: number;
  /** Corrected estimate (after applying the personal multiplier). */
  corrected_minutes: number;
  /** The multiplier that was applied. */
  multiplier: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of historical tasks to analyse. */
const MAX_HISTORY = 50;
/** Minimum data points required for a personalised multiplier. */
const MIN_DATA_POINTS = 5;
/** Default multiplier when insufficient data exists.
 *  1.35x is the clinical average for ADHD time-blindness. */
const DEFAULT_MULTIPLIER = 1.35;
/** Outlier threshold: any task where actual > estimated * this is discarded. */
const OUTLIER_THRESHOLD = 10;
/** Minimum allowed multiplier (prevents pathological over-correction). */
const MIN_MULTIPLIER = 0.8;
/** Maximum allowed multiplier (prevents absurd inflation). */
const MAX_MULTIPLIER = 2.5;
/** Decay factor for recency weighting. Higher = more emphasis on recent tasks. */
const RECENCY_DECAY = 0.85;

// ─── Core Algorithm ───────────────────────────────────────────────────────────

/**
 * Calculate a personal time correction multiplier from historical task data.
 *
 * @param userId  Supabase auth user ID
 * @returns       A multiplier in the range [0.8, 2.5]
 */
export async function calculateTimeCorrectionFactor(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('estimated_minutes, actual_minutes, completed_at')
      .eq('user_id', userId)
      .not('actual_minutes', 'is', null)
      .not('estimated_minutes', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(MAX_HISTORY);

    if (error) {
      console.error('[TimeCorrection] DB query failed:', error.message);
      return DEFAULT_MULTIPLIER;
    }

    if (!data || data.length < MIN_DATA_POINTS) {
      return DEFAULT_MULTIPLIER;
    }

    return computeMultiplier(data as HistoricalTask[]);
  } catch (err) {
    console.error('[TimeCorrection] Unexpected error:', err);
    return DEFAULT_MULTIPLIER;
  }
}

/**
 * Pure computation — no I/O. Testable in isolation.
 *
 * Uses exponential recency weighting so recent tasks dominate:
 *   weight[i] = RECENCY_DECAY ^ i  (i=0 is most recent)
 *
 * Multiplier = sum(weight * actual) / sum(weight * estimated)
 */
export function computeMultiplier(tasks: HistoricalTask[]): number {
  let weightedActual = 0;
  let weightedEstimated = 0;
  let validCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const { estimated_minutes, actual_minutes } = tasks[i];

    // Guard: skip incomplete or zero-value entries
    if (!estimated_minutes || estimated_minutes <= 0) continue;
    if (!actual_minutes || actual_minutes <= 0) continue;

    // Guard: discard extreme outliers (left timer running overnight, etc.)
    if (actual_minutes > estimated_minutes * OUTLIER_THRESHOLD) continue;

    // Exponential recency weight: most recent task (i=0) has weight 1.0
    const weight = Math.pow(RECENCY_DECAY, i);

    weightedActual += weight * actual_minutes;
    weightedEstimated += weight * estimated_minutes;
    validCount++;
  }

  // Not enough clean data after filtering
  if (validCount < MIN_DATA_POINTS || weightedEstimated === 0) {
    return DEFAULT_MULTIPLIER;
  }

  const rawRatio = weightedActual / weightedEstimated;

  // Clamp to safe range
  const clamped = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, rawRatio));

  // Round to 2 decimal places for clean display
  return Number(clamped.toFixed(2));
}

// ─── Application Functions ────────────────────────────────────────────────────

/**
 * Apply the personal time correction multiplier to a raw minute estimate.
 *
 * @param rawMinutes       Original Gemini-generated estimate
 * @param correctionFactor Personal multiplier from calculateTimeCorrectionFactor()
 * @returns                Corrected minutes (rounded up to nearest integer)
 */
export function applyTimeBuffer(rawMinutes: number, correctionFactor: number): number {
  if (rawMinutes <= 0) return 0;
  if (correctionFactor <= 0) return rawMinutes;
  return Math.ceil(rawMinutes * correctionFactor);
}

/**
 * Batch-correct an array of Gemini-generated tasks using the user's
 * personal time multiplier. Fetches the multiplier from historical data.
 *
 * @param tasks   Array of tasks from the Gemini micro-tasker
 * @param userId  Supabase auth user ID
 * @returns       Array of tasks with corrected_minutes and raw_estimated_minutes
 */
export async function correctGeminiEstimates(
  tasks: GeminiTask[],
  userId: string,
): Promise<CorrectedTask[]> {
  const multiplier = await calculateTimeCorrectionFactor(userId);

  return tasks.map(task => ({
    ...task,
    raw_estimated_minutes: task.estimated_minutes,
    corrected_minutes: applyTimeBuffer(task.estimated_minutes, multiplier),
    multiplier,
  }));
}

/**
 * Synchronous version that accepts a pre-computed multiplier.
 * Useful when you've already fetched the factor and want to avoid
 * a redundant DB call.
 */
export function correctGeminiEstimatesSync(
  tasks: GeminiTask[],
  multiplier: number,
): CorrectedTask[] {
  return tasks.map(task => ({
    ...task,
    raw_estimated_minutes: task.estimated_minutes,
    corrected_minutes: applyTimeBuffer(task.estimated_minutes, multiplier),
    multiplier,
  }));
}