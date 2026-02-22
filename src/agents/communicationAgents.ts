import { callAgent } from '../lib/api';

export interface ThreadAnalysis {
  summary: string;
  decisions_made: string[];
  action_items: { owner: string; task: string }[];
  emotional_temperature: string;
}

export interface SocialAnalysis {
  likely_interpretations: string[];
  subtext_analysis: string;
  what_not_to_assume: string[];
  recommended_responses: string[];
}

export const analyzeThread = async (threadText: string): Promise<ThreadAnalysis> => {
  const prompt = `
    You are an elite cognitive translator. Your user struggles with processing dense, unstructured, or emotionally charged corporate Slack threads.
    Take the following thread and extract the core signal from the noise. 
    
    Output strictly as a JSON object matching this schema:
    {
      "summary": "A 2-sentence objective summary of the thread.",
      "decisions_made": ["Array of finalized decisions. Empty if none."],
      "action_items": [{"owner": "Name or 'Unassigned'", "task": "Explicit task description"}],
      "emotional_temperature": "Neutral assessment of the thread's tone (e.g., 'Collaborative', 'Tense', 'Urgent')."}
    }

    Thread to analyze:
    "${threadText}"
  `;

  const result = await callAgent<ThreadAnalysis>({ prompt, jsonMode: true });
  return result as ThreadAnalysis;
};

export const decodeSocialInteraction = async (interactionText: string): Promise<SocialAnalysis> => {
  const prompt = `
    You are a workplace communication decoder. Your user has a neurodivergent cognitive style and sometimes struggles to parse ambiguous subtext, implied meanings, or neurotypical social signaling.
    Analyze the following interaction. Be objective, compassionate, and logical. Do not pathologize the user.
    
    Output strictly as a JSON object matching this schema:
    {
      "likely_interpretations": ["2-3 most probable, logical meanings behind what was said"],
      "subtext_analysis": "A brief explanation of any underlying corporate or social dynamics at play",
      "what_not_to_assume": ["1-2 catastrophic or overly negative assumptions the user should actively avoid making"],
      "recommended_responses": ["2 highly professional, low-friction ways to reply"]
    }

    Interaction to decode:
    "${interactionText}"
  `;

  const result = await callAgent<SocialAnalysis>({ prompt, jsonMode: true });
  return result as SocialAnalysis;
};