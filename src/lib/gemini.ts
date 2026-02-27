/**
 * @provenance https://github.com/ybaddam8-png/Neutro-OS
 * @file src/lib/gemini.ts  
 * @rationale RSD Shield's sanitizePRComment is unique functionality. Uses GEMINI_API_KEY_2
 *   per integration spec so load is isolated from primary cognitive analysis API calls.
 *   Fallback pattern-matching preserved to handle API timeouts gracefully.
 */

const GEMINI_API_KEY_2 = import.meta.env.VITE_GEMINI_API_KEY_2 as string | undefined;

const GEMINI_ENDPOINT = 
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * RSD Shield: De-weaponize a PR review comment.
 * Uses GEMINI_API_KEY_2 to isolate from primary cognitive analysis budget.
 */
export async function sanitizePRComment(
  rawComment: string
): Promise<{ sanitized: string; actionItems: string[]; sentiment: string }> {
  if (!GEMINI_API_KEY_2) {
    console.warn('[RSD Shield] VITE_GEMINI_API_KEY_2 not set — using fallback sanitization.');
    return buildFallbackSanitization(rawComment);
  }

  const PROMPT = `You are the RSD Shield, an AI that helps neurodivergent software engineers by rewriting code review comments.

Your task:
1. Remove ALL sarcasm, passive-aggressiveness, condescension, and bluntness
2. Preserve 100% of the technical content and required changes
3. Reframe criticism as collaborative problem-solving
4. Extract specific actionable items as a bulleted list
5. Classify sentiment: "critical" | "neutral" | "positive" | "mixed"

INPUT COMMENT:
${rawComment}

Respond ONLY with valid JSON, no markdown fences:
{
  "sanitized": "rewritten comment text here",
  "actionItems": ["action 1", "action 2"],
  "sentiment": "critical"
}`;

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY_2}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());

    return {
      sanitized: result.sanitized || rawComment,
      actionItems: result.actionItems || [],
      sentiment: result.sentiment || 'neutral',
    };
  } catch (err) {
    console.warn('[RSD Shield] Gemini API failed — using fallback:', err);
    return buildFallbackSanitization(rawComment);
  }
}

/** Intelligent fallback when API is unavailable */
function buildFallbackSanitization(raw: string): {
  sanitized: string;
  actionItems: string[];
  sentiment: string;
} {
  const aggressiveWords = [
    'obviously', 'rookie', "can't believe", 'never', 'wrong',
    "didn't you", 'why would you', 'completely', 'seriously',
  ];
  const isAggressive = aggressiveWords.some((w) => raw.toLowerCase().includes(w));

  const technicalPatterns = [
    { pattern: /race condition|async|await|thread/i, action: 'Address race condition in async/await handling' },
    { pattern: /mobile|responsive|screen size/i, action: 'Test and fix mobile/responsive behavior' },
    { pattern: /business logic|component|separation/i, action: 'Move business logic out of UI components' },
    { pattern: /performance|slow|memory leak/i, action: 'Investigate and optimize performance issue' },
    { pattern: /duplicate|DRY|repeated/i, action: 'Refactor to eliminate duplicate code' },
    { pattern: /variable name|naming|unclear/i, action: 'Improve variable naming for clarity' },
    { pattern: /error handling|try.*catch|exception/i, action: 'Add proper error handling' },
    { pattern: /authentication|auth|login/i, action: 'Review authentication flow implementation' },
    { pattern: /database|db|query|connection/i, action: 'Optimize database connection/query logic' },
    { pattern: /websocket|socket|realtime/i, action: 'Fix WebSocket/real-time connection issue' },
  ];

  const actionItems: string[] = [];
  technicalPatterns.forEach(({ pattern, action }) => {
    if (pattern.test(raw) && !actionItems.includes(action)) {
      actionItems.push(action);
    }
  });

  const sanitized = isAggressive
    ? raw
        .replace(/obviously|rookie|can't believe/gi, '')
        .replace(/why would you/gi, 'Please consider why')
        .replace(/you (missed|failed|forgot)/gi, 'This needs attention:')
        .trim()
    : raw;

  return {
    sanitized: sanitized || raw,
    actionItems: actionItems.length > 0 ? actionItems : ['Review and address the mentioned concerns'],
    sentiment: isAggressive ? 'critical' : 'neutral',
  };
}
