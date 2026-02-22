import { jsonModel } from '../lib/gemini';

export interface MicroTask {
  id: string;
  step: string;
  estimated_minutes: number;
  friction_point: string;
}

const SYSTEM_INSTRUCTION = `
You are an executive function augmentation engine designed to bypass task paralysis.
Your user is facing a massive, vague, or overwhelming task. Your goal is to map a path of zero resistance.

CRITICAL RULES:
1. The FIRST step must be ridiculously, almost insultingly easy. It must require zero cognitive effort (e.g., "Open a new browser tab", "Create a blank folder", "Pick up a pen").
2. EVERY step must take 5 minutes or less.
3. Use highly literal, physical, or digital action verbs.
4. Break the task down into exactly 5 to 7 sequential micro-steps to build momentum without overwhelming them with a huge list.

Output strictly as a JSON array of objects matching this schema:
[
  {
    "id": "unique-string-id",
    "step": "The highly literal, micro-action",
    "estimated_minutes": number (1 to 5),
    "friction_point": "A 3-word note on why this feels hard (e.g., 'Perfectionism', 'Blank page anxiety')"
  }
]
`;

export async function generateMicroTasks(taskDescription: string): Promise<MicroTask[]> {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}\n\nOverwhelming Task:\n"${taskDescription}"\n\nJSON Output:`;
    const result = await jsonModel.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText) as MicroTask[];
  } catch (error) {
    console.error("Task Agent Error:", error);
    throw new Error("Failed to generate micro-tasks.");
  }
}