import { callAgent } from '../lib/api';

const SYSTEM_INSTRUCTION = `
You are an elite Digital Accessibility Synthesizer. 
Your user experiences severe sensory overload and cognitive friction from chaotic web layouts (e.g., ad-heavy articles, messy Jira boards, dense documentation).

I will provide you with the raw, scraped text/structure of a webpage. 
Your task is to strip away all navigation fluff, ads, cookie notices, and sidebar noise. 
Extract ONLY the core content and restructure it into clean, highly readable Markdown.

Rules:
1. Use clear Markdown headings (H1, H2, H3) to create a logical hierarchy.
2. Break up dense paragraphs into shorter, digestible chunks.
3. Use bullet points for lists of features, steps, or requirements.
4. Bold **key concepts** to guide the reader's eye.
5. DO NOT summarize or delete the actual core information—just restructure it for cognitive ease.
6. Output ONLY the raw Markdown. Do not wrap it in JSON or add conversational filler.
`;

export async function sanitizeWebpage(rawContent: string): Promise<string> {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}\n\nRaw Webpage Data:\n"${rawContent}"`;
    const result = await callAgent<string>({ prompt, jsonMode: false });
    return result as string;
  } catch (error) {
    console.error("Sensory Agent Error:", error);
    throw new Error("Failed to sanitize the webpage structure.");
  }
}