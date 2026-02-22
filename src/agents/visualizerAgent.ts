import { genAI } from '../lib/gemini';

// Using the standard model for raw text/code output
const textModel = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0.1, // Very low temperature for strict syntax adherence
  },
});

const SYSTEM_INSTRUCTION = `
You are an expert cognitive translator. Your task is to take chaotic, unstructured workplace chat threads and convert them into a highly structured, visual mind map using Mermaid.js Flowchart syntax.

Rules for the Mermaid code:
1. ALWAYS start with "graph TD".
2. Create a central root node representing the main topic.
3. Branch out into Subtopics, Context, Decisions, and Action Items.
4. Keep node text extremely concise (3-5 words max per node).
5. Define this exact class for Action Items: \`classDef actionItem fill:#14B8A6,stroke:#0D9488,color:#ffffff,stroke-width:2px,rx:8px,ry:8px;\`
6. Apply the actionItem class to ANY node that requires a human to do work (e.g., \`NodeId[Fix the database]:::actionItem\`).
7. Define a class for standard nodes: \`classDef standard fill:#F8FAFC,stroke:#CBD5E1,color:#334155,stroke-width:1px,rx:8px,ry:8px;\`
8. Apply the standard class to all other nodes.
9. Output ONLY valid Mermaid syntax. Do not include markdown code blocks, backticks, or explanatory text.
`;

export async function generateMermaidGraph(threadText: string): Promise<string> {
  try {
    const prompt = `${SYSTEM_INSTRUCTION}\n\nThread to visualize:\n"${threadText}"`;
    const result = await textModel.generateContent(prompt);
    let code = result.response.text();

    // Safety layer: Strip markdown code blocks if the LLM ignores instructions
    code = code.replace(/```mermaid\n?/g, '');
    code = code.replace(/```\n?/g, '');
    
    return code.trim();
  } catch (error) {
    console.error("Visualizer Agent Error:", error);
    throw new Error("Failed to generate visual graph.");
  }
}