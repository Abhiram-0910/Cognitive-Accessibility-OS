import { callAgent } from '../lib/api';

export interface HyperfocusSummary {
  core_insight: string;
  action_items: string[];
}

export interface ReentryBrief {
  what_you_were_doing: string;
  where_you_left_off: string;
  immediate_next_step: string;
}

export interface RsdAnalysis {
  is_high_risk: boolean;
  reframed_context: string;
}

export const summarizeHyperfocus = async (notes: string): Promise<HyperfocusSummary> => {
  const prompt = `
    You are a cognitive capture agent. The user has just exited a 'Hyperfocus' state.
    Review their raw, unstructured scratchpad notes and distill the core value.

    Output strictly as a JSON object matching this schema:
    {
      "core_insight": "A 1-2 sentence summary of the main breakthrough or work accomplished.",
      "action_items": ["Concrete next steps extracted from the notes"]
    }

    Raw Notes: "${notes}"
  `;
  const result = await callAgent<HyperfocusSummary>({ prompt, jsonMode: true });
  return result as HyperfocusSummary;
};

export const generateReentryBrief = async (taskName: string, contextNotes: string): Promise<ReentryBrief> => {
  const prompt = `
    You are a Prosthetic Working Memory agent. The user is returning to a paused task and is experiencing context-switching friction.
    Using the provided task name and historical context, generate a "Re-entry Brief" to instantly restore their working memory.

    Output strictly as a JSON object matching this schema:
    {
      "what_you_were_doing": "1 sentence summarizing the overall goal.",
      "where_you_left_off": "1 sentence detailing the exact last state.",
      "immediate_next_step": "The single, highly concrete physical/digital action to take right now to resume momentum."
    }

    Task: "${taskName}"
    Historical Context: "${contextNotes}"
  `;
  const result = await callAgent<ReentryBrief>({ prompt, jsonMode: true });
  return result as ReentryBrief;
};

export const analyzeRsdRisk = async (message: string, senderContext: string): Promise<RsdAnalysis> => {
  const prompt = `
    You are an emotional regulation shield. Your user experiences Rejection Sensitive Dysphoria (RSD).
    Analyze the incoming message for brevity, bluntness, or lack of emojis/warmth that might trigger an RSD spiral.
    
    If the message is brief but likely benign (e.g., "ok", "fine", "approved"), flag it and provide a logical, reassuring reframe based on the sender context.

    Output strictly as a JSON object matching this schema:
    {
      "is_high_risk": boolean (true if the message is brief, blunt, or ambiguous enough to trigger anxiety),
      "reframed_context": "A gentle, logical explanation for the brevity (e.g., 'They are likely busy, not angry.')"
    }

    Sender Context: "${senderContext}"
    Incoming Message: "${message}"
  `;
  const result = await callAgent<RsdAnalysis>({ prompt, jsonMode: true });
  return result as RsdAnalysis;
};