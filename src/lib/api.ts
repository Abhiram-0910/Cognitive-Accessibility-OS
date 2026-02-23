/// <reference types="vite/client" />
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface AgentRequest {
  prompt: string;
  model?: 'gemini-1.5-flash' | 'gemini-1.5-pro';
  jsonMode?: boolean;
}

/**
 * Securely proxies LLM requests through our Node.js backend.
 * Automatically parses JSON outputs if jsonMode is true, with strict LLM hallucination armor.
 */
export const callAgent = async <T>(request: AgentRequest): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE_URL}/agents/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'gemini-1.5-flash',
        jsonMode: request.jsonMode ?? true,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    // Parse the stringified JSON returned by Gemini if jsonMode was enabled
    if (request.jsonMode !== false) {
      try {
        // LLM Hallucination Armor: Strip markdown formatting blocks if present
        let cleanData = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        cleanData = cleanData.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanData) as T;
      } catch (parseError) {
        console.error('Failed to parse Agent JSON response:', result.data);
        throw new Error("Received malformed data from the cognitive engine.");
      }
    }
    
    return result.data as unknown as T;
  } catch (error) {
    console.error('Agent API Call Failed:', error);
    throw error;
  }
};