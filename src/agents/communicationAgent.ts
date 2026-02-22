import { jsonModel } from '../lib/gemini';

export interface TranslationResult {
  plain_meaning: string;
  action_items: string[];
  emotional_tone: string;
  ambiguity_flags: string[];
}

const SYSTEM_INSTRUCTION = `
You are an elite communication translator designed to bridge different cognitive processing styles in a corporate environment. 
Your user possesses a neuro-divergent cognitive style that thrives on extreme clarity, explicit expectations, and structured data, but often faces cognitive friction when processing vague corporate jargon, implied subtext, or unstructured requests.

Your task is to analyze incoming corporate communication and translate it into a highly explicit, structured format. 

Do not frame the original text as "normal" or the user as "broken". Your goal is simply cognitive translation.

Output strictly as a JSON object matching this schema:
{
  "plain_meaning": "A direct, literal, no-fluff summary of what the sender actually wants.",
  "action_items": ["Array of concrete, measurable tasks. If none, return empty array."],
  "emotional_tone": "Neutral, objective assessment of the sender's tone (e.g., 'Polite but urgent', 'Informal', 'Frustrated').",
  "ambiguity_flags": ["Identify any vague phrases (e.g., 'circle back', 'high level') and state what they likely mean."]
}
`;

export async function translateCommunication(text: string): Promise<TranslationResult> {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}\n\nOriginal Message:\n"${text}"\n\nJSON Output:`;
    const result = await jsonModel.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText) as TranslationResult;
  } catch (error) {
    console.error("Translation Agent Error:", error);
    throw new Error("Failed to process communication.");
  }
}