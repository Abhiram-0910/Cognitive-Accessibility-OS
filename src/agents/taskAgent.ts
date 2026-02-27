import { callAgent } from '../lib/api';

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

export async function generateMicroTasks(taskDescription: string, estimatedTimeMinutes: number = 30): Promise<MicroTask[]> {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';
  
  try {
    // Use the dedicated /chunk-task endpoint for explicit semantic routing.
    // That route has the full neurodivergent-optimised prompt built into the backend.
    const res = await fetch(`${BACKEND_URL}/api/agents/chunk-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: taskDescription, estimatedMinutes: estimatedTimeMinutes }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.steps)) throw new Error('Invalid response shape');
    return json.steps as MicroTask[];
  } catch (error) {
    // Fallback: route through the generic /generate endpoint
    console.warn('[taskAgent] /chunk-task failed, falling back to /generate:', error);
    const prompt = `${SYSTEM_INSTRUCTION}\n\nOverwhelming Task:\n"${taskDescription}"\n\nJSON Output:`;
    const result = await callAgent<MicroTask[]>({
      prompt,
      model: 'gemini-2.0-flash',
      jsonMode: true,
    });
    return result;
  }
}
