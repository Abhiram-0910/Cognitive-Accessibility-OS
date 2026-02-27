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
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.questions) && json.questions.length > 0) {
        console.info(
          `[gameContentAgent] ✅ Gemini generated ${json.questions.length} quiz questions` +
          ` (theme: ${theme}, age: ${age})`
        );
        return json.questions as QuizQuestion[];
      }
    }
  } catch (err) {
    console.warn('[gameContentAgent] Gemini quiz fetch failed, falling back to Supabase.', err);
  }

  return fetchQuizQuestionsFromSupabase();
}

export async function fetchQuizQuestionsFromSupabase(): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('games')
    .select('questions')
    .eq('game_key', 'crack-the-quiz')
    .single();

  if (error || !data) {
    console.error('[gameContentAgent] Supabase fallback also failed.', error);
    return [];
  }
  return (data.questions as QuizQuestion[]) ?? [];
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
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.questions) && json.questions.length > 0) {
        console.info(
          `[gameContentAgent] ✅ Gemini generated ${json.questions.length} spelling questions` +
          ` (theme: ${theme}, age: ${age})`
        );
        return json.questions as SpellingQuestion[];
      }
    }
  } catch (err) {
    console.warn('[gameContentAgent] Gemini spelling fetch failed, falling back to Supabase.', err);
  }

  return fetchSpellingQuestionsFromSupabase();
}

export async function fetchSpellingQuestionsFromSupabase(): Promise<SpellingQuestion[]> {
  const { data, error } = await supabase
    .from('games')
    .select('questions')
    .eq('game_key', 'drag-and-spell')
    .single();

  if (error || !data) {
    console.error('[gameContentAgent] Supabase fallback also failed.', error);
    return [];
  }
  return (data.questions as SpellingQuestion[]) ?? [];
}
