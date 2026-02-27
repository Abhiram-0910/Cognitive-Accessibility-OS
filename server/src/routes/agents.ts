import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Helper to configure the model dynamically
const getModel = (modelName: string, _jsonMode?: boolean) => {
  // NOTE: We rely on prompt-level JSON instructions + post-response regex cleanup
  // instead of responseMimeType, which causes 500 errors on some model versions.
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.2 },
  });
};

/**
 * POST /api/agents/generate
 * Generates a complete response from the Gemini API.
 * 
 * Request body:
 * {
 *   prompt: string,       // Required: The prompt to send to the model
 *   model?: string,       // Optional: Model name (default: 'gemini-1.5-flash')
 *   jsonMode?: boolean    // Optional: Whether to request JSON response (default: true)
 * }
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, model = 'gemini-2.0-flash', jsonMode = true } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Prompt is required.' });
      return;
    }

    const aiModel = getModel(model, jsonMode);
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    res.status(200).json({ 
      success: true, 
      data: text,
      model: model,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Agents API Error]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'The neural network is experiencing high latency. Please take a deep breath and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/agents/stream
 * Streams LLM responses to the client using Server-Sent Events (SSE).
 * Ideal for RAG (Retrieval-Augmented Generation) where users need immediate feedback.
 * 
 * Request body:
 * {
 *   prompt: string,       // Required: The prompt to send to the model
 *   model?: string        // Optional: Model name (default: 'gemini-1.5-flash')
 * }
 * 
 * Response format (SSE):
 * data: {"text": "chunk of text"}
 * 
 * data: [DONE]
 */
router.post('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    const { prompt, model = 'gemini-2.0-flash' } = req.body;
    
    if (!prompt) {
      res.write(`data: ${JSON.stringify({ 
        error: 'Prompt is required' 
      })}\n\n`);
      res.end();
      return;
    }

    // Standard text model, no JSON enforcement for streaming
    const aiModel = genAI.getGenerativeModel({ 
      model: model,
      generationConfig: { temperature: 0.2 }
    });
    
    const result = await aiModel.generateContentStream(prompt);
    let fullResponse = '';

    // Process the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // Send SSE formatted payload
      res.write(`data: ${JSON.stringify({ 
        text: chunkText,
        partial: fullResponse 
      })}\n\n`);
      
      // Ensure data is sent immediately
      res.flushHeaders();
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({ 
      status: 'complete',
      fullResponse: fullResponse 
    })}\n\n`);
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[Stream Error]:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Stream failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * POST /api/agents/generate-game-content
 * Generates therapeutic quiz or spelling questions for the Kids Module using Gemini.
 *
 * Request body:
 * {
 *   gameType: 'quiz' | 'spelling',   // which game shape to generate for
 *   theme?: string,                  // e.g. "animals", "fruits", "emotions"
 *   count?: number                   // number of questions (default: 5)
 * }
 *
 * Response JSON shapes:
 *   quiz     → [{ question, image, answers: [{ text, correct }] }]
 *   spelling → [{ word, correctLetter, image, options: string[] }]
 */
router.post('/generate-game-content', async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameType = 'quiz', theme = 'everyday objects', count = 5, age = 7 } = req.body;

    if (!['quiz', 'spelling'].includes(gameType)) {
      res.status(400).json({ success: false, error: 'gameType must be "quiz" or "spelling".' });
      return;
    }

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
- Replace exactly ONE letter with underscore \'_\'.
- "correctLetter" is the missing letter (lowercase).
- "options" must contain exactly 4 single letters — correctLetter must be among them.
- "image" must be null.
    `.trim();

    const prompt = gameType === 'quiz' ? quizPrompt : spellingPrompt;

    const aiModel = getModel('gemini-2.0-flash', true);
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    let questions: unknown[];
    try {
      // CRITICAL: Strip markdown fences before parsing — Gemini sometimes wraps
      // output in ```json blocks even when instructed not to. This is the root
      // cause of the 500 error: JSON.parse fails on fenced strings.
      const cleanJson = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      questions = JSON.parse(cleanJson);
      if (!Array.isArray(questions)) throw new Error('Response was not a JSON array.');
    } catch (parseErr) {
      console.error('[generate-game-content] Parse error. Raw text:', text);
      res.status(500).json({
        success: false,
        error: 'Gemini returned malformed JSON. Frontend will fall back to Supabase seed data.',
        raw: text.substring(0, 500), // truncate so logs stay readable
      });
      return;
    }

    res.status(200).json({ success: true, questions, gameType, theme, age, count: questions.length });
  } catch (error: any) {
    console.error('[generate-game-content] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Gemini content generation failed. Frontend should fall back to Supabase seed data.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/agents/chunk-task
 * Breaks a long task description into 5-minute actionable steps.
 * Used by the Micro-Tasker / Momentum Architect component.
 * (Thin wrapper around /generate for explicit semantic routing.)
 *
 * Request body: { task: string }
 */
router.post('/chunk-task', async (req: Request, res: Response): Promise<void> => {
  try {
    const { task } = req.body;
    if (!task?.trim()) {
      res.status(400).json({ success: false, error: 'task is required.' });
      return;
    }

    const prompt = `
You are an executive function augmentation engine designed to bypass task paralysis for neurodivergent users.

Break the following task into exactly 5–7 sequential micro-steps. Each step MUST be completable in 5 minutes or less.
The FIRST step must be trivially easy — no cognitive friction at all (e.g., "Open a blank document").

STRICT JSON output only:
[
  {
    "id": "unique-slug-id",
    "step": "The precise, physical micro-action",
    "estimated_minutes": <number 1–5>,
    "friction_point": "<3-word reason this feels hard>"
  }
]

Task: "${task}"
    `.trim();

    const aiModel = getModel('gemini-2.0-flash', true);
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    let steps: unknown[];
    try {
      steps = JSON.parse(text);
      if (!Array.isArray(steps)) throw new Error('Not a JSON array.');
    } catch {
      res.status(500).json({ success: false, error: 'Malformed response from Gemini.', raw: text });
      return;
    }

    res.status(200).json({ success: true, steps });
  } catch (error: any) {
    console.error('[chunk-task] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Task chunking failed.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export const agentRoutes = router;
