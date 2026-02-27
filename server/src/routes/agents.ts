import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// ─── Model helper ─────────────────────────────────────────────────────────────

const getModel = (modelName: string) => {
  // NOTE: We rely on prompt-level JSON instructions + sanitizeGeminiJson()
  // instead of responseMimeType, which causes 500s on some model versions.
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.2 },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROBUST JSON SANITIZER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Gemini (especially 2.0-flash) frequently wraps output in markdown code
// fences, comments, trailing commas, or random pre/post text even when the
// prompt explicitly says "JSON only". This utility surgically extracts valid
// JSON from a messy LLM response string.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Strip markdown code fences, comments, trailing commas, and any surrounding
 * prose from a raw Gemini response, then JSON.parse() the result.
 *
 * Returns `null` if parsing still fails after all sanitisation passes.
 */
function sanitizeGeminiJson<T = unknown>(raw: string): T | null {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw;

  try {
    // Pass 1: Strip markdown code fence wrappers (```json ... ``` or ``` ... ```)
    //         Handles any language tag after the opening triple backticks.
    cleaned = cleaned.replace(/^[\s\S]*?```(?:json|JSON|js|javascript)?\s*\n?/m, '');
    cleaned = cleaned.replace(/```[\s\S]*?$/m, '');

    // Pass 2: If still contains backticks (e.g. ` ``` ` inside), remove all
    cleaned = cleaned.replace(/`/g, '');

    // Pass 3: Trim leading/trailing whitespace and stray prose
    cleaned = cleaned.trim();

    // Pass 4: Extract the JSON array/object — find the first [ or { and
    //         the corresponding last ] or }
    const firstBracket = cleaned.search(/[\[{]/);
    const lastBracket = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));

    if (firstBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    }

    // Pass 5: Remove trailing commas before closing brackets/braces
    //         e.g. { "a": 1, } → { "a": 1 }
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // Pass 6: Remove JS-style single-line comments ( // ... )
    cleaned = cleaned.replace(/\/\/.*$/gm, '');

    // Pass 7: Remove control characters except \n, \r, \t
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    return JSON.parse(cleaned) as T;
  } catch {
    // Final desperate attempt: try to find JSON array inside the messy string
    try {
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const withoutTrailing = arrayMatch[0].replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(withoutTrailing) as T;
      }
    } catch { /* give up */ }

    console.error('[sanitizeGeminiJson] All parsing attempts failed. Raw (first 500 chars):', raw.substring(0, 500));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HARDCODED FALLBACK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const FALLBACK_QUIZ = [
  {
    question: 'What sound does a cat make?',
    image: null,
    answers: [
      { text: 'Meow', correct: true },
      { text: 'Woof', correct: false },
      { text: 'Moo', correct: false },
      { text: 'Oink', correct: false },
    ],
  },
  {
    question: 'What colour is the sky on a sunny day?',
    image: null,
    answers: [
      { text: 'Blue', correct: true },
      { text: 'Green', correct: false },
      { text: 'Red', correct: false },
      { text: 'Purple', correct: false },
    ],
  },
  {
    question: 'Which animal has a long trunk?',
    image: null,
    answers: [
      { text: 'Elephant', correct: true },
      { text: 'Rabbit', correct: false },
      { text: 'Dog', correct: false },
      { text: 'Fish', correct: false },
    ],
  },
  {
    question: 'How many legs does a spider have?',
    image: null,
    answers: [
      { text: '8', correct: true },
      { text: '4', correct: false },
      { text: '6', correct: false },
      { text: '10', correct: false },
    ],
  },
  {
    question: 'What do bees make?',
    image: null,
    answers: [
      { text: 'Honey', correct: true },
      { text: 'Milk', correct: false },
      { text: 'Juice', correct: false },
      { text: 'Cheese', correct: false },
    ],
  },
];

const FALLBACK_SPELLING = [
  { word: 'Ca_', correctLetter: 't', image: null, options: ['t', 'r', 'n', 's'] },
  { word: 'Do_', correctLetter: 'g', image: null, options: ['g', 'p', 'k', 't'] },
  { word: '_un', correctLetter: 's', image: null, options: ['s', 'r', 'f', 'b'] },
  { word: 'B_rd', correctLetter: 'i', image: null, options: ['i', 'a', 'o', 'u'] },
  { word: 'Fi_h', correctLetter: 's', image: null, options: ['s', 'r', 'n', 't'] },
];

const FALLBACK_STEPS = [
  { id: 'step-1', step: 'Open a blank document or workspace.', estimated_minutes: 1, friction_point: 'Starting feels hard' },
  { id: 'step-2', step: 'Write a single-sentence summary of what you need to do.', estimated_minutes: 2, friction_point: 'Clarity paralysis' },
  { id: 'step-3', step: 'List the 3 most obvious sub-tasks.', estimated_minutes: 3, friction_point: 'Overwhelming scope' },
  { id: 'step-4', step: 'Complete sub-task #1 only.', estimated_minutes: 5, friction_point: 'Perfectionism trap' },
  { id: 'step-5', step: 'Take a 30-second stretch break, then start sub-task #2.', estimated_minutes: 5, friction_point: 'Momentum loss' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/agents/generate
 * General-purpose Gemini generation endpoint.
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, model = 'gemini-2.0-flash', jsonMode = true } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Prompt is required.' });
      return;
    }

    const aiModel = getModel(model);
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    res.status(200).json({
      success: true,
      data: text,
      model,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Agents API Error]:', error);
    res.status(500).json({
      success: false,
      error: 'The neural network is experiencing high latency. Please take a deep breath and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/agents/stream
 * SSE streaming endpoint for RAG.
 */
router.post('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const { prompt, model = 'gemini-2.0-flash' } = req.body;

    if (!prompt) {
      res.write(`data: ${JSON.stringify({ error: 'Prompt is required' })}\n\n`);
      res.end();
      return;
    }

    const aiModel = genAI.getGenerativeModel({
      model,
      generationConfig: { temperature: 0.2 },
    });

    const result = await aiModel.generateContentStream(prompt);
    let fullResponse = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      res.write(`data: ${JSON.stringify({ text: chunkText, partial: fullResponse })}\n\n`);
      res.flushHeaders();
    }

    res.write(`data: ${JSON.stringify({ status: 'complete', fullResponse })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[Stream Error]:', error);
    res.write(`data: ${JSON.stringify({
      error: 'Stream failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * POST /api/agents/generate-game-content
 * Generates therapeutic quiz or spelling questions for the Kids Module.
 *
 * NEVER returns a 500 — always falls back to hardcoded questions.
 */
router.post('/generate-game-content', async (req: Request, res: Response): Promise<void> => {
  const { gameType = 'quiz', theme = 'everyday objects', count = 5, age = 7 } = req.body;

  if (!['quiz', 'spelling'].includes(gameType)) {
    res.status(400).json({ success: false, error: 'gameType must be "quiz" or "spelling".' });
    return;
  }

  try {
    const quizPrompt = `
You are a compassionate educational AI creating therapeutic quiz content for a dyslexic child aged ${age}.
Generate exactly ${count} multiple-choice questions based on the theme: "${theme}".
Calibrate vocabulary and complexity for a ${age}-year-old: short sentences, familiar words, encouraging tone.

Return ONLY raw JSON — NO markdown, NO code fences, NO explanation.
The response must start with [ and end with ].

[
  {
    "question": "Simple question text",
    "image": null,
    "answers": [
      { "text": "Option A", "correct": true },
      { "text": "Option B", "correct": false },
      { "text": "Option C", "correct": false },
      { "text": "Option D", "correct": false }
    ]
  }
]

Rules:
- Exactly one answer must have "correct": true per question.
- Each question must have exactly 4 answer options.
- image must always be null.
    `.trim();

    const spellingPrompt = `
You are a compassionate educational AI creating therapeutic spelling content for a dyslexic child aged ${age}.
Generate exactly ${count} drag-the-missing-letter spelling puzzles based on the theme: "${theme}".
Calibrate word length and difficulty for a ${age}-year-old.

Return ONLY raw JSON — NO markdown, NO code fences, NO explanation.
The response must start with [ and end with ].

[
  {
    "word": "Ca_",
    "correctLetter": "t",
    "image": null,
    "options": ["t", "r", "n", "s"]
  }
]

Rules:
- Use short, simple 3–6 letter words appropriate for age ${age}.
- Replace exactly ONE letter with underscore '_'.
- "correctLetter" is the missing letter (lowercase).
- "options" must contain exactly 4 single letters — correctLetter must be among them.
- "image" must be null.
    `.trim();

    const prompt = gameType === 'quiz' ? quizPrompt : spellingPrompt;

    const aiModel = getModel('gemini-2.0-flash');
    const result = await aiModel.generateContent(prompt);
    const rawText = result.response.text();

    // ── Sanitize & parse ──────────────────────────────────────────────────
    const questions = sanitizeGeminiJson<unknown[]>(rawText);

    if (questions && Array.isArray(questions) && questions.length > 0) {
      console.info(`[generate-game-content] ✅ Gemini returned ${questions.length} ${gameType} questions.`);
      res.status(200).json({ success: true, questions, gameType, theme, age, count: questions.length });
      return;
    }

    // Parsing failed but API didn't throw — fall through to fallback
    console.warn('[generate-game-content] Sanitised parse returned null. Raw:', rawText.substring(0, 300));
  } catch (error: any) {
    console.error('[generate-game-content] Gemini API error:', error.message);
  }

  // ── FALLBACK — always returns valid data, NEVER a 500 ───────────────────
  const fallback = gameType === 'quiz' ? FALLBACK_QUIZ : FALLBACK_SPELLING;
  console.info(`[generate-game-content] ⚠ Returning ${fallback.length} hardcoded ${gameType} fallback questions.`);
  res.status(200).json({
    success: true,
    questions: fallback,
    gameType,
    theme,
    age,
    count: fallback.length,
    fallback: true,
  });
});

/**
 * POST /api/agents/chunk-task
 * Breaks a long task description into 5-minute actionable steps.
 *
 * NEVER returns a 500 — always falls back to hardcoded steps.
 */
router.post('/chunk-task', async (req: Request, res: Response): Promise<void> => {
  const { task } = req.body;
  if (!task?.trim()) {
    res.status(400).json({ success: false, error: 'task is required.' });
    return;
  }

  try {
    const prompt = `
You are an executive function augmentation engine designed to bypass task paralysis for neurodivergent users.

Break the following task into exactly 5–7 sequential micro-steps. Each step MUST be completable in 5 minutes or less.
The FIRST step must be trivially easy — no cognitive friction at all (e.g., "Open a blank document").

Return ONLY a raw JSON array — NO markdown, NO code fences, NO explanation.
The response must start with [ and end with ].

[
  {
    "id": "unique-slug-id",
    "step": "The precise, physical micro-action",
    "estimated_minutes": 3,
    "friction_point": "3-word reason this feels hard"
  }
]

Task: "${task}"
    `.trim();

    const aiModel = getModel('gemini-2.0-flash');
    const result = await aiModel.generateContent(prompt);
    const rawText = result.response.text();

    const steps = sanitizeGeminiJson<unknown[]>(rawText);

    if (steps && Array.isArray(steps) && steps.length > 0) {
      console.info(`[chunk-task] ✅ Gemini returned ${steps.length} micro-steps.`);
      res.status(200).json({ success: true, steps });
      return;
    }

    console.warn('[chunk-task] Sanitised parse returned null. Raw:', rawText.substring(0, 300));
  } catch (error: any) {
    console.error('[chunk-task] Gemini API error:', error.message);
  }

  // ── FALLBACK ────────────────────────────────────────────────────────────
  console.info('[chunk-task] ⚠ Returning hardcoded fallback steps.');
  res.status(200).json({ success: true, steps: FALLBACK_STEPS, fallback: true });
});

// ─── HuggingFace Emotion Inference ────────────────────────────────────────────

// NOTE: Remote emotion inference (HuggingFace) has been DELETED to comply with 
// GDPR/COPPA zero-trust privacy requirements. All facial telemetry and emotional
// analysis is now performed strictly on-device using local WebAssembly (MediaPipe).

export const agentRoutes = router;
