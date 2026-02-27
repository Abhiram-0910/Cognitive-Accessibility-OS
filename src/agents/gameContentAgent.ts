/**
 * gameContentAgent.ts
 * Frontend helper to fetch AI-generated game questions from the backend,
 * with automatic fallback to Supabase seed data if the request fails.
 * 
 * Age is now threaded through to the backend so Gemini calibrates
 * vocabulary and complexity to the child's developmental level.
 */
import { supabase } from '../lib/supabase';

// ─── Types (shared with Game.tsx and GameTwo.tsx) ─────────────────────────────

export interface QuizAnswer {
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  question: string;
  image?: string | null;
  answers: QuizAnswer[];
}

export interface SpellingQuestion {
  word: string;
  correctLetter: string;
  image: string | null;
  options: string[];
}

// ─── Backend URL ──────────────────────────────────────────────────────────────
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

// ─── Hardcoded Fallbacks (Failover 2) ─────────────────────────────────────────

const CLIENT_FALLBACK_QUIZ: QuizQuestion[] = [
  {
    question: 'How do you feel when you lose a game?',
    answers: [
      { text: 'Frustrated', correct: true },
      { text: 'Happy', correct: false },
      { text: 'Sleepy', correct: false },
      { text: 'Hungry', correct: false },
    ],
  },
  {
    question: 'What should you do if you feel overwhelmed?',
    answers: [
      { text: 'Take deep breaths', correct: true },
      { text: 'Yell', correct: false },
      { text: 'Run away', correct: false },
      { text: 'Throw things', correct: false },
    ],
  },
  {
    question: 'Which of these is a calm activity?',
    answers: [
      { text: 'Drawing', correct: true },
      { text: 'Screaming', correct: false },
      { text: 'Jumping on bed', correct: false },
      { text: 'Kicking a ball', correct: false },
    ],
  },
  {
    question: 'How do you feel when someone shares with you?',
    answers: [
      { text: 'Happy', correct: true },
      { text: 'Sad', correct: false },
      { text: 'Angry', correct: false },
      { text: 'Scared', correct: false },
    ],
  },
  {
    question: 'What is a good way to ask for help?',
    answers: [
      { text: 'Say "Can you help me please?"', correct: true },
      { text: 'Cry loudly', correct: false },
      { text: 'Say nothing', correct: false },
      { text: 'Demand it', correct: false },
    ],
  }
];

const CLIENT_FALLBACK_SPELLING: SpellingQuestion[] = [
  { word: 'C_lm', correctLetter: 'a', image: null, options: ['a', 'e', 'i', 'o'] },
  { word: 'H_ppy', correctLetter: 'a', image: null, options: ['a', 'o', 'u', 'y'] },
  { word: 'K_nd', correctLetter: 'i', image: null, options: ['i', 'e', 'a', 'o'] },
  { word: 'S_fe', correctLetter: 'a', image: null, options: ['a', 'i', 'u', 'e'] },
  { word: 'B_ave', correctLetter: 'r', image: null, options: ['r', 'l', 't', 'p'] },
];

/**
 * Silently logs AI or DB failures to the telemetry pipeline so admins know the system is running degraded.
 */
async function logDegradedState(context: string, errorDetails: any) {
  try {
    await supabase.from('telemetry_events').insert({
      event_type: 'ai_degraded',
      source: 'gameContentAgent',
      metadata: { context, error: errorDetails?.message || String(errorDetails) },
      // Minimal dummy cognitive_load to satisfy the schema if required
      cognitive_load: 0 
    });
  } catch {
    // Ignore telemetry logging failures to avoid crash loops
  }
}

// ─── Quiz Questions (Game.tsx — crack-the-quiz) ────────────────────────────────
/**
 * Tries to fetch Gemini-generated quiz questions calibrated to `age`.
 * Falls back to the Supabase `games` table seed data on any failure.
 *
 * @param theme  Topic/theme for question generation (default: emotions and everyday life)
 * @param age    Child's age in years — used to calibrate language complexity (default: 7)
 */
export async function fetchQuizQuestions(
  theme = 'emotions and everyday life',
  age = 7,
): Promise<QuizQuestion[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/agents/generate-game-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'quiz', theme, count: 5, age }),
      signal: AbortSignal.timeout(4_000), // Strict 4s timeout prevents kids waiting on LLM
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.questions) && json.questions.length > 0) {
        console.info(
          `[gameContentAgent] ✅ Gemini generated ${json.questions.length} quiz questions` +
          ` (theme: ${theme}, age: ${age})` + (json.fallback ? ' [BACKEND FALLBACK USED]' : '')
        );
        return json.questions as QuizQuestion[];
      }
    }
  } catch (err) {
    console.warn('[gameContentAgent] Gemini quiz fetch failed (Likely Timeout), falling back to Supabase.', err);
  }

  return fetchQuizQuestionsFromSupabase();
}

export async function fetchQuizQuestionsFromSupabase(): Promise<QuizQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('questions')
      .eq('game_key', 'crack-the-quiz')
      .single();

    if (error || !data || !Array.isArray(data.questions)) {
      throw error || new Error('No questions found in Supabase');
    }
    return data.questions as QuizQuestion[];
  } catch (err) {
    console.error('[gameContentAgent] Supabase fallback also failed. Using hardcoded array.', err);
    await logDegradedState('fetchQuizQuestionsFromSupabase', err);
    return CLIENT_FALLBACK_QUIZ;
  }
}

// ─── Spelling Questions (GameTwo.tsx — drag-and-spell) ────────────────────────
/**
 * Tries to fetch Gemini-generated spelling questions calibrated to `age`.
 * Falls back to the Supabase `games` table seed data on any failure.
 *
 * @param theme  Topic/theme for question generation
 * @param age    Child's age in years — used to calibrate word length/difficulty
 */
export async function fetchSpellingQuestions(
  theme = 'animals and simple objects',
  age = 7,
): Promise<SpellingQuestion[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/agents/generate-game-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameType: 'spelling', theme, count: 5, age }),
      signal: AbortSignal.timeout(4_000), // Strict 4s timeout prevents kids waiting on LLM
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.questions) && json.questions.length > 0) {
        console.info(
          `[gameContentAgent] ✅ Gemini generated ${json.questions.length} spelling questions` +
          ` (theme: ${theme}, age: ${age})` + (json.fallback ? ' [BACKEND FALLBACK USED]' : '')
        );
        return json.questions as SpellingQuestion[];
      }
    }
  } catch (err) {
    console.warn('[gameContentAgent] Gemini spelling fetch failed (Likely Timeout), falling back to Supabase.', err);
  }

  return fetchSpellingQuestionsFromSupabase();
}

export async function fetchSpellingQuestionsFromSupabase(): Promise<SpellingQuestion[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('questions')
      .eq('game_key', 'drag-and-spell')
      .single();

    if (error || !data || !Array.isArray(data.questions)) {
      throw error || new Error('No questions found in Supabase');
    }
    return data.questions as SpellingQuestion[];
  } catch (err) {
    console.error('[gameContentAgent] Supabase fallback also failed. Using hardcoded array.', err);
    await logDegradedState('fetchSpellingQuestionsFromSupabase', err);
    return CLIENT_FALLBACK_SPELLING;
  }
}
