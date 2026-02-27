/**
 * VectorStore.ts — Prosthetic Memory Vector Database
 *
 * Combines Google Generative AI Embeddings (via LangChain) with Supabase
 * pgvector for semantic similarity search. This is the backbone of the
 * "Prosthetic Memory Agent" — it answers questions like:
 *    "What did I promise in last week's standup?"
 *
 * Architecture:
 *   Text → GoogleGenerativeAIEmbeddings → 768-dim vector → Supabase pgvector
 *   Query → Embed query → rpc('match_documents') → Top-K ranked results
 *
 * Required Supabase SQL (run once):
 *
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *
 *   CREATE TABLE public.memory_entries (
 *     id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
 *     content    TEXT NOT NULL,
 *     summary    TEXT,
 *     metadata   JSONB DEFAULT '{}'::jsonb,
 *     embedding  vector(768),
 *     created_at TIMESTAMPTZ DEFAULT now() NOT NULL
 *   );
 *
 *   CREATE INDEX ON public.memory_entries
 *     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 *
 *   CREATE OR REPLACE FUNCTION match_documents(
 *     query_embedding vector(768),
 *     match_threshold float DEFAULT 0.72,
 *     match_count     int   DEFAULT 5,
 *     filter_user_id  uuid  DEFAULT NULL
 *   )
 *   RETURNS TABLE (
 *     id         uuid,
 *     content    text,
 *     summary    text,
 *     metadata   jsonb,
 *     similarity float
 *   )
 *   LANGUAGE plpgsql
 *   AS $$
 *   BEGIN
 *     RETURN QUERY
 *     SELECT
 *       me.id,
 *       me.content,
 *       me.summary,
 *       me.metadata,
 *       1 - (me.embedding <=> query_embedding) AS similarity
 *     FROM public.memory_entries me
 *     WHERE (filter_user_id IS NULL OR me.user_id = filter_user_id)
 *       AND 1 - (me.embedding <=> query_embedding) > match_threshold
 *     ORDER BY me.embedding <=> query_embedding
 *     LIMIT match_count;
 *   END;
 *   $$;
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { supabaseAdmin } from '../utils/supabaseAdmin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id?: string;
  user_id: string;
  content: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  created_at?: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  summary: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// ─── VectorStore Class ────────────────────────────────────────────────────────

export class VectorStore {
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[VectorStore] ⚠ GEMINI_API_KEY not set. Embeddings will fail.');
    }

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey || '',
      modelName: 'text-embedding-004',  // Google's latest text embedding model
    });
  }

  // ── Embedding ─────────────────────────────────────────────────────────────

  /**
   * Convert a single text string into a 768-dimensional vector.
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('[VectorStore] Cannot embed empty text.');
    }

    try {
      const vector = await this.embeddings.embedQuery(text);
      return vector;
    } catch (err: any) {
      console.error('[VectorStore] Embedding failed:', err.message);
      throw new Error(`Embedding generation failed: ${err.message}`);
    }
  }

  /**
   * Batch-embed multiple texts. Returns vectors in the same order.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    try {
      const vectors = await this.embeddings.embedDocuments(texts);
      return vectors;
    } catch (err: any) {
      console.error('[VectorStore] Batch embedding failed:', err.message);
      throw new Error(`Batch embedding failed: ${err.message}`);
    }
  }

  // ── Upsert ────────────────────────────────────────────────────────────────

  /**
   * Store a new memory entry with its embedding in Supabase pgvector.
   *
   * If `embedding` is not provided in the entry, the content will be
   * automatically embedded via the Gemini text-embedding model.
   */
  async upsertMemory(entry: MemoryEntry): Promise<string> {
    // Auto-embed if no embedding provided
    const embedding = entry.embedding || await this.embed(entry.content);

    const row = {
      user_id: entry.user_id,
      content: entry.content,
      summary: entry.summary || entry.content.substring(0, 200),
      metadata: entry.metadata || {},
      embedding,
    };

    // If an ID is provided, upsert (update or insert). Otherwise, insert new.
    if (entry.id) {
      const { error } = await supabaseAdmin
        .from('memory_entries')
        .upsert({ id: entry.id, ...row }, { onConflict: 'id' });

      if (error) throw new Error(`[VectorStore] Upsert failed: ${error.message}`);
      return entry.id;
    }

    const { data, error } = await supabaseAdmin
      .from('memory_entries')
      .insert(row)
      .select('id')
      .single();

    if (error) throw new Error(`[VectorStore] Insert failed: ${error.message}`);
    return data.id;
  }

  /**
   * Batch-upsert multiple memory entries.
   * Auto-embeds any entries missing an embedding vector.
   */
  async upsertMemories(entries: MemoryEntry[]): Promise<string[]> {
    if (!entries.length) return [];

    // Separate entries that need embedding from those that already have one
    const needsEmbedding = entries.filter(e => !e.embedding);
    const hasEmbedding = entries.filter(e => !!e.embedding);

    // Batch-embed the ones that need it
    if (needsEmbedding.length > 0) {
      const texts = needsEmbedding.map(e => e.content);
      const vectors = await this.embedBatch(texts);
      needsEmbedding.forEach((entry, i) => {
        entry.embedding = vectors[i];
      });
    }

    const allEntries = [...hasEmbedding, ...needsEmbedding];
    const ids: string[] = [];

    // Upsert one at a time to capture individual IDs
    // (Supabase batch insert with .select() returns all rows)
    for (const entry of allEntries) {
      const id = await this.upsertMemory(entry);
      ids.push(id);
    }

    return ids;
  }

  // ── Semantic Search ───────────────────────────────────────────────────────

  /**
   * Perform a semantic similarity search against the memory_entries table.
   *
   * Uses the Supabase RPC function `match_documents` which computes
   * cosine similarity between the query embedding and stored vectors.
   *
   * @param query       Natural language search query
   * @param userId      Optional — filter results to a specific user
   * @param threshold   Minimum cosine similarity (0.0–1.0). Default: 0.72
   * @param topK        Maximum number of results. Default: 5
   */
  async search(
    query: string,
    userId?: string,
    threshold = 0.72,
    topK = 5,
  ): Promise<MemorySearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // 1. Embed the query
      const queryEmbedding = await this.embed(query);

      // 2. Call the Supabase RPC function
      const { data, error } = await supabaseAdmin.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: topK,
        filter_user_id: userId || null,
      });

      if (error) {
        console.error('[VectorStore] Similarity search RPC failed:', error.message);
        throw new Error(`Semantic search failed: ${error.message}`);
      }

      return (data as MemorySearchResult[]) || [];
    } catch (err: any) {
      console.error('[VectorStore] Search error:', err.message);
      throw err;
    }
  }

  /**
   * Convenience method: search and return just the content strings.
   * Used by the Prosthetic Memory Agent for RAG context injection.
   */
  async searchContentOnly(
    query: string,
    userId?: string,
    topK = 5,
  ): Promise<string[]> {
    const results = await this.search(query, userId, 0.70, topK);
    return results.map(r => r.content);
  }

  // ── Deletion ──────────────────────────────────────────────────────────────

  /**
   * Delete a specific memory entry by ID.
   */
  async deleteMemory(memoryId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('memory_entries')
      .delete()
      .eq('id', memoryId);

    if (error) throw new Error(`[VectorStore] Delete failed: ${error.message}`);
  }

  /**
   * Delete all memory entries for a user (e.g., account deletion).
   */
  async deleteAllUserMemories(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('memory_entries')
      .delete()
      .eq('user_id', userId);

    if (error) throw new Error(`[VectorStore] Bulk delete failed: ${error.message}`);
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const vectorStore = new VectorStore();