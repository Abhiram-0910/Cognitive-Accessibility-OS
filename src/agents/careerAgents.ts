import { callAgent } from '../lib/api';

export interface ReframedTrait {
  traditional_view: string;
  reframed_strength: string;
  resume_bullet: string;
  interview_talking_point: string;
}

export interface RoleAnalysis {
  green_flags: string[];
  cognitive_friction_points: string[];
  clarifying_questions_to_ask: string[];
}

export const reframeTraitForResume = async (trait: string): Promise<ReframedTrait> => {
  const prompt = `
    You are an elite executive coach specializing in neurodivergent talent. 
    Your client has provided a cognitive trait or work habit that is often misunderstood in traditional corporate settings.
    Translate this trait into a high-value professional strength.

    Output strictly as a JSON object matching this schema:
    {
      "traditional_view": "How this is normally (and often negatively) perceived",
      "reframed_strength": "The actual underlying superpower or value",
      "resume_bullet": "A powerful, action-oriented resume bullet point utilizing this strength",
      "interview_talking_point": "A 2-sentence script on how to pitch this authentically in an interview without apologizing for it"
    }

    Trait to reframe: "${trait}"
  `;

  const result = await callAgent<ReframedTrait>({ prompt, jsonMode: true });
  return result as ReframedTrait;
};

export const analyzeJobDescription = async (jd: string): Promise<RoleAnalysis> => {
  const prompt = `
    You are an advocate for neurodivergent professionals. Analyze the following job description.
    Look past the marketing fluff and identify the actual cognitive demands of the role.
    
    Output strictly as a JSON object matching this schema:
    {
      "green_flags": ["Elements that suggest high autonomy, clear expectations, or deep-focus opportunities"],
      "cognitive_friction_points": ["Hidden demands for high context-switching, vague social navigation, or ambiguous metrics"],
      "clarifying_questions_to_ask": ["Questions the candidate should ask to uncover the true sensory or cognitive load of the environment"]
    }

    Job Description: "${jd}"
  `;

  const result = await callAgent<RoleAnalysis>({ prompt, jsonMode: true });
  return result as RoleAnalysis;
};