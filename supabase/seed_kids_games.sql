-- =================================================================================
-- NeuroAdaptive OS — Kids Module
-- File:    supabase/seed_kids_games.sql
-- Purpose: Seed the `games` table with the two built-in therapeutic games so
--          Game.tsx and GameTwo.tsx can fetch their questions on mount.
--
-- COLUMN NOTE:
--   The `games` table uses  game_key TEXT UNIQUE  (see migrations/merge_kids_module.sql).
--   The frontend components query: .eq('game_key', '...').single()
--
-- HOW TO RUN:
--   Paste this entire script into the Supabase Dashboard → SQL Editor → Run
--   It is idempotent (uses ON CONFLICT DO UPDATE) so safe to re-run.
--
-- QUESTION JSON SCHEMAS (must match component interfaces exactly):
--
--   Game.tsx  (crack-the-quiz):
--     { "question": string, "image": string|null, "answers": [{ "text": string, "correct": boolean }] }
--
--   GameTwo.tsx  (drag-and-spell):
--     { "word": string (with '_' placeholder), "correctLetter": string, "image": string, "options": string[] }
--     `image` is a path under /kids-assets/ served from the Vite public/ folder.
-- =================================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- GAME 1: Crack the Quiz
-- 5 emotion / social-awareness questions with optional images.
-- Images reference /kids-assets/ paths served from public/.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.games (game_key, name, description, is_published, questions)
VALUES (
  'crack-the-quiz',
  'Crack the Quiz',
  'Test your knowledge by answering simple quiz questions. 5 questions · 2 minutes',
  TRUE,
  '[
    {
      "question": "Which face shows a HAPPY emotion?",
      "image": "/kids-assets/happy.png",
      "answers": [
        { "text": "😊 Happy",   "correct": true  },
        { "text": "😢 Sad",     "correct": false },
        { "text": "😠 Angry",   "correct": false },
        { "text": "😱 Scared",  "correct": false }
      ]
    },
    {
      "question": "What do you say when someone gives you a gift?",
      "image": null,
      "answers": [
        { "text": "Thank you!",     "correct": true  },
        { "text": "Go away!",       "correct": false },
        { "text": "I don''t care.", "correct": false },
        { "text": "Give me more!",  "correct": false }
      ]
    },
    {
      "question": "Which animal says ''Woof''?",
      "image": "/kids-assets/dog.jpg",
      "answers": [
        { "text": "Dog",  "correct": true  },
        { "text": "Cat",  "correct": false },
        { "text": "Bat",  "correct": false },
        { "text": "Fish", "correct": false }
      ]
    },
    {
      "question": "How many fingers are on ONE hand?",
      "image": null,
      "answers": [
        { "text": "5",  "correct": true  },
        { "text": "4",  "correct": false },
        { "text": "6",  "correct": false },
        { "text": "10", "correct": false }
      ]
    },
    {
      "question": "Which fruit is red and grows on trees?",
      "image": "/kids-assets/apple.png",
      "answers": [
        { "text": "Apple",  "correct": true  },
        { "text": "Banana", "correct": false },
        { "text": "Grape",  "correct": false },
        { "text": "Mango",  "correct": false }
      ]
    }
  ]'::jsonb
)
ON CONFLICT (game_key) DO UPDATE
  SET
    name         = EXCLUDED.name,
    description  = EXCLUDED.description,
    is_published = EXCLUDED.is_published,
    questions    = EXCLUDED.questions,
    updated_at   = now();


-- ─────────────────────────────────────────────────────────────────────────────
-- GAME 2: Drag & Spell
-- 5 drag-the-missing-letter puzzles.
-- `word`          — the word with '_' as the blank (shown as-is on screen).
-- `correctLetter` — the letter that fills the blank (must be in `options`).
-- `image`         — /kids-assets/ path; uses the legacy images that were
--                   migrated to public/kids-assets/.
-- `options`       — 4 letter choices presented as draggable tiles.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.games (game_key, name, description, is_published, questions)
VALUES (
  'drag-and-spell',
  'Drag & Spell',
  'Drag the missing letter to complete the word. 5 levels.',
  TRUE,
  '[
    {
      "word": "_pple",
      "correctLetter": "A",
      "image": "/kids-assets/apple.png",
      "options": ["A", "E", "O", "I"]
    },
    {
      "word": "Do_",
      "correctLetter": "g",
      "image": "/kids-assets/dog.jpg",
      "options": ["g", "b", "t", "p"]
    },
    {
      "word": "Ca_",
      "correctLetter": "t",
      "image": "/kids-assets/cat.jpeg",
      "options": ["t", "r", "n", "s"]
    },
    {
      "word": "Ba_",
      "correctLetter": "t",
      "image": "/kids-assets/bat.avif",
      "options": ["t", "d", "g", "p"]
    },
    {
      "word": "_un",
      "correctLetter": "S",
      "image": null,
      "options": ["S", "G", "R", "M"]
    }
  ]'::jsonb
)
ON CONFLICT (game_key) DO UPDATE
  SET
    name         = EXCLUDED.name,
    description  = EXCLUDED.description,
    is_published = EXCLUDED.is_published,
    questions    = EXCLUDED.questions,
    updated_at   = now();


-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  game_key,
  name,
  is_published,
  jsonb_array_length(questions) AS question_count
FROM public.games
WHERE game_key IN ('crack-the-quiz', 'drag-and-spell');
