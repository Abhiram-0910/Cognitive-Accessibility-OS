import { callAgent } from '../lib/api';

export interface OutboundResult {
  translated_text: string;
  tone_adjustments: string[];
  masking_energy_saved_minutes: number;
}

export const translateOutboundCommunication = async (bluntInput: string): Promise<OutboundResult> => {
  try {
    const prompt = `
      You are an Unmasking Proxy for a neurodivergent professional. 
      Your user prefers highly literal, blunt, and direct communication, but this often causes friction in neurotypical corporate environments.
      Take their blunt input and translate it into warm, polite, "neurotypical-compliant" corporate communication.
      
      Output strictly as JSON:
      {
        "translated_text": "The polite, ready-to-send corporate version",
        "tone_adjustments": ["Briefly list what you softened (e.g., 'Replaced direct command with a collaborative question')"],
        "masking_energy_saved_minutes": integer (Estimate how many minutes of stressful overthinking this saved, usually 5-15)
      }
      
      Blunt Input: "${bluntInput}"
    `;
    
    // Route securely through the Node.js backend proxy
    const result = await callAgent<OutboundResult>({
      prompt: prompt,
      model: 'gemini-2.0-flash',
      jsonMode: true
    });
    
    return result;
  } catch (error) {
    console.error("Communication Agent Error:", error);
    throw new Error("Failed to translate communication via secure proxy.");
  }
};