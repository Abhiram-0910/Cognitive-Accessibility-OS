import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import crypto from 'crypto';

export class VectorStore {
  private supabase: SupabaseClient;
  private redis: RedisClientType;
  private isRedisConnected = false;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.redis = createRedisClient({
      url: process.env.REDIS_URI || 'redis://localhost:6379'
    });

    this.redis.on('error', (err) => console.error('[Redis] Client Error', err));
    this.redis.on('connect', () => {
      this.isRedisConnected = true;
      console.log('[Redis] Connected for semantic caching.');
    });

    this.redis.connect().catch(console.error);
  }

  /**
   * Generates a deterministic SHA-256 hash to use as a Redis key.
   */
  private generateCacheKey(prompt: string, context: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${prompt}:${context}`);
    return `llm_cache:${hash.digest('hex')}`;
  }

  /**
   * Retrieves a cached translation or returns null on a cache miss.
   */
  public async getCachedResponse(prompt: string, context: string): Promise<string | null> {
    if (!this.isRedisConnected) return null;
    
    const key = this.generateCacheKey(prompt, context);
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[Redis] Cache read failed', error);
      return null;
    }
  }

  /**
   * Stores a successful LLM response in Redis with a 7-day TTL.
   */
  public async cacheResponse(prompt: string, context: string, response: string): Promise<void> {
    if (!this.isRedisConnected) return;

    const key = this.generateCacheKey(prompt, context);
    try {
      // Set expiration to 604800 seconds (7 days)
      await this.redis.setEx(key, 604800, JSON.stringify(response));
    } catch (error) {
      console.error('[Redis] Cache write failed', error);
    }
  }

  /**
   * Embeds and stores a new memory chunk into Supabase pgvector.
   */
  public async storeMemory(userId: string, content: string, summary: string, embedding: number[]) {
    const { error } = await this.supabase.from('memory_entries').insert({
      user_id: userId,
      content,
      summary,
      embedding
    });

    if (error) throw new Error(`[VectorStore] Failed to insert memory: ${error.message}`);
  }
}

export const vectorStore = new VectorStore();