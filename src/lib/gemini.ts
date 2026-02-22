import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the SDK. 
// Note: In production, do not expose API keys in the Vite client. Use a backend/Edge Function.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.warn("Missing VITE_GEMINI_API_KEY in environment variables.");
}

export const genAI = new GoogleGenerativeAI(apiKey || "");

// Pre-configured model instance for fast, JSON-formatted responses
export const jsonModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2, // Low temperature for highly deterministic, analytical outputs
  },
});