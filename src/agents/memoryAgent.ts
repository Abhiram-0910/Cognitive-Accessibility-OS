import { callAgent } from '../lib/api';
import { supabase } from '../lib/supabase'; // Assumes standard Supabase client initialization

export interface MemoryIngestResult {
  success: boolean;
  summary: string;
}

/**
 * Step 1: Ingest, Summarize, Embed, and Store
 */
export async function ingestMemory(text: string, userId: string): Promise<MemoryIngestResult> {
  try {
    // 1. Generate a concise summary and action items
    const summaryPrompt = `
      Analyze this text (e.g., transcript, notes, email thread). 
      Provide a highly concise summary and extract any concrete commitments or action items.
      Format strictly as JSON: { "summary": "...", "action_items": ["..."] }
      
      Text: "${text}"
    `;
    const parsedSummary = await callAgent<{ summary: string, action_items: string[] }>({ prompt: summaryPrompt, jsonMode: true });
    
    // Combine for storage
    const richSummary = `${parsedSummary.summary} Actions: ${parsedSummary.action_items.join(', ')}`;

    // 2. Generate vector embeddings for the raw content
    // (This would be handled by a backend API endpoint)
    const embeddingResponse = await fetch('http://localhost:3000/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    
    if (!embeddingResponse.ok) {
      throw new Error(`Embedding failed: ${embeddingResponse.status}`);
    }
    
    const { embedding } = await embeddingResponse.json();

    // 3. Store in Supabase pgvector
    const { error } = await supabase.from('memory_entries').insert({
      user_id: userId,
      content: text,
      summary: richSummary,
      embedding: embedding,
    });

    if (error) throw error;

    return { success: true, summary: richSummary };
  } catch (error) {
    console.error("Memory Ingestion Error:", error);
    throw new Error("Failed to process and store memory.");
  }
}

/**
 * Step 2: Retrieve, Augment, and Synthesize (RAG)
 */
export async function recallMemory(query: string, userId: string): Promise<string> {
  try {
    // 1. Embed the natural language query
    const embeddingResponse = await fetch('http://localhost:3000/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query })
    });
    
    if (!embeddingResponse.ok) {
      throw new Error(`Embedding failed: ${embeddingResponse.status}`);
    }
    
    const { embedding } = await embeddingResponse.json();
    const queryEmbedding = embedding;

    // 2. Perform Vector Similarity Search via Supabase RPC
    const { data: matches, error } = await supabase.rpc('match_memories', {
      query_embedding: queryEmbedding,
      match_threshold: 0.65, // Adjust for strictness
      match_count: 5,
      p_user_id: userId,
    });

    if (error) throw error;
    if (!matches || matches.length === 0) {
      return "I couldn't find any relevant context in your digital memory.";
    }

    // 3. Construct Context for the LLM
    const contextStr = matches.map((m: any) => `Memory: ${m.content}\nSummary: ${m.summary}`).join('\n\n');

    // 4. Synthesize the final answer
    const synthesisPrompt = `
      You are a Prosthetic Working Memory assistant. 
      Answer the user's query using ONLY the provided context retrieved from their digital memory.
      If the answer is not in the context, state that clearly. Do not invent information.
      Be direct, highly explicit, and supportive.

      Context:
      ${contextStr}

      User Query: "${query}"
    `;

    const result = await callAgent<{ text: string }>({ prompt: synthesisPrompt, jsonMode: false });
    return result.text;
  } catch (error) {
    console.error("Memory Recall Error:", error);
    throw new Error("Failed to retrieve information.");
  }
}