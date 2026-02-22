import { supabase } from '../supabase';

interface TimeData {
  estimated_minutes: number;
  actual_minutes: number;
}

/**
 * Calculates the user's historical time estimation accuracy.
 * Returns a multiplier to apply to future micro-task estimates.
 */
export const calculateTimeCorrectionFactor = async (userId: string): Promise<number> => {
  try {
    // Fetch completed tasks with recorded times
    const { data, error } = await supabase
      .from('tasks')
      .select('estimated_minutes, actual_minutes')
      .eq('user_id', userId)
      .not('actual_minutes', 'is', null)
      .limit(50); // Analyze the last 50 tasks for a rolling baseline

    if (error) throw error;
    if (!data || data.length < 5) return 1.0; // Not enough data, default to 1x

    let totalEstimated = 0;
    let totalActual = 0;

    data.forEach((task: TimeData) => {
      // Filter out extreme anomalies (e.g., left the timer running overnight)
      if (task.actual_minutes < task.estimated_minutes * 10) {
        totalEstimated += task.estimated_minutes;
        totalActual += task.actual_minutes;
      }
    });

    if (totalEstimated === 0) return 1.0;

    const ratio = totalActual / totalEstimated;

    // If they chronically underestimate by more than 20%, apply a 1.5x buffer.
    // Otherwise, gently scale it based on their exact ratio.
    if (ratio >= 1.2) {
      return 1.5; // Aggressive buffer for chronic time blindness
    } else if (ratio > 1.0) {
      return Number(ratio.toFixed(2)); // Minor correction
    }

    return 1.0; // Accurate or over-estimator
  } catch (error) {
    console.error("Time Correction Algorithm Error:", error);
    return 1.0; // Fallback to raw estimates on error
  }
};

/**
 * Utility to apply the buffer to raw Gemini outputs
 */
export const applyTimeBuffer = (rawMinutes: number, correctionFactor: number): number => {
  return Math.ceil(rawMinutes * correctionFactor);
};