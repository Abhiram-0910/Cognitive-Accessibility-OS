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

export interface TimeBlindnessRecord {
  taskId: string;
  estimatedSeconds: number;
  actualSeconds: number;
  timestamp: number;
}

const STORAGE_KEY = 'neuroadaptive_time_blindness_history';
const MAX_HISTORY_LENGTH = 50;
const MIN_RECORDS_FOR_CALIB = 5;
const DEFAULT_MULTIPLIER = 1.35; // Default padding while calibrating
const MAX_MULTIPLIER = 3.0; // Cap to avoid absurd estimations
const MIN_MULTIPLIER = 1.0; 

/**
 * Calculate the user's current time blindness padding multiplier.
 * Uses a weighted average of recent tasks (more recent = higher weight).
 */
export function calculatePaddingMultiplier(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MULTIPLIER;

    const history: TimeBlindnessRecord[] = JSON.parse(raw);
    
    // Not enough data yet? Return the safe default.
    if (history.length < MIN_RECORDS_FOR_CALIB) {
      return DEFAULT_MULTIPLIER;
    }

    let weightedSum = 0;
    let weightTotal = 0;

    // Iterate backwards (most recent first) applying a decay factor
    history.slice().reverse().forEach((record, index) => {
      // ratio > 1 means they took longer than expected
      const ratio = record.actualSeconds / record.estimatedSeconds;
      
      // Decay weight: 1.0 for most recent, 0.9 for next, etc.
      const weight = Math.pow(0.9, index); 
      
      weightedSum += ratio * weight;
      weightTotal += weight;
    });

    if (weightTotal === 0) return DEFAULT_MULTIPLIER;

    let multiplier = weightedSum / weightTotal;

    // Apply bounds
    multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, multiplier));

    return Number(multiplier.toFixed(2));
  } catch (err) {
    console.warn("Time correction calculation failed, using default.", err);
    return DEFAULT_MULTIPLIER;
  }
}

/**
 * Record a completed task's time data to local storage.
 */
export function recordTaskCompletion(taskId: string, estimatedMinutes: number, actualSeconds: number) {
  if (!estimatedMinutes || !actualSeconds) return;

  try {
    const estimatedSeconds = estimatedMinutes * 60;
    
    // Ignore highly anomalous records (e.g., leaving a task open overnight)
    if (actualSeconds > estimatedSeconds * 10) return;

    const newRecord: TimeBlindnessRecord = {
      taskId,
      estimatedSeconds,
      actualSeconds,
      timestamp: Date.now()
    };

    const raw = localStorage.getItem(STORAGE_KEY);
    let history: TimeBlindnessRecord[] = raw ? JSON.parse(raw) : [];

    history.push(newRecord);

    // Keep only the most recent bounds
    if (history.length > MAX_HISTORY_LENGTH) {
      history = history.slice(-MAX_HISTORY_LENGTH);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    console.log(`[TimeBlindness] Recorded task. New Multiplier: ${calculatePaddingMultiplier()}x`);
  } catch (err) {
    console.error("Failed to record time data:", err);
  }
}

