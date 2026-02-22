import { callAgent } from '../lib/api';

export interface CognitiveExercise {
  title: string;
  focus_area: string;
  scenario: string;
  steps: string[];
  success_metric: string;
}

export const generateSkillExercise = async (cognitiveStyle: string, focusArea: string): Promise<CognitiveExercise> => {
  const prompt = `
    You are a cognitive enhancement coach. Your user wants to train a specific executive function or leverage their unique cognitive style (e.g., hyperfocus, pattern recognition, systematic thinking) into a professional superpower.
    
    Generate a 5-minute practical, professional mini-game or exercise for them based on the requested focus area.
    DO NOT use medical or deficit-based language. Frame this as elite professional training.

    Output strictly as a JSON object matching this schema:
    {
      "title": "Catchy, empowering title of the exercise",
      "focus_area": "The specific skill being trained",
      "scenario": "A 2-sentence corporate or creative scenario where this skill is needed",
      "steps": ["Step 1...", "Step 2...", "Step 3..."],
      "success_metric": "How the user knows they won the game/completed the exercise"
    }

    User Cognitive Profile / Preference: "${cognitiveStyle}"
    Desired Training Area: "${focusArea}"
  `;

  const result = await callAgent<CognitiveExercise>({ prompt, jsonMode: true });
  return result as CognitiveExercise;
};