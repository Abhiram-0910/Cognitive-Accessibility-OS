import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Search, BrainCircuit, CheckSquare } from 'lucide-react';

export const Memory: React.FC<{ userId: string }> = ({ userId }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setAnswer('');
    setStreamError(null);
    
    // Clear any previous abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // 1. Embed the user's query
      const embeddingResponse = await fetch('http://localhost:3000/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query }),
        signal: abortControllerRef.current.signal
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Embedding failed: ${embeddingResponse.status}`);
      }

      const { embedding } = await embeddingResponse.json();
      const queryEmbedding = embedding;

      // 2. Intent Routing: Is this an action item request?
      const isActionItemQuery = query.toLowerCase().includes('action item') || 
                                query.toLowerCase().includes('do i need to do') ||
                                query.toLowerCase().includes('task');

      // 3. Call the appropriate Supabase RPC
      const rpcName = isActionItemQuery ? 'match_action_items' : 'match_memories';
      const { data: matches, error } = await supabase.rpc(rpcName, {
        query_embedding: queryEmbedding,
        p_user_id: userId,
        match_threshold: 0.65,
        match_count: 5,
      });

      if (error) throw error;

      if (!matches || matches.length === 0) {
        setAnswer("I couldn't find any relevant context in your digital memory.");
        setLoading(false);
        return;
      }

      const contextStr = matches.map((m: any) => m.content).join('\n\n');

      // 4. Prepare prompt based on intent
      let prompt = '';
      if (isActionItemQuery) {
        prompt = `
          You are a Prosthetic Working Memory assistant. Review the provided retrieved context.
          Identify the single most pressing action item or commitment for the user based on their query.
          Return ONLY a single, bolded, highly concrete bullet point. No introductory or concluding text.
          If no action item is found, say "No clear action items found in recent memory."

          Context: ${contextStr}
          Query: "${query}"
        `;
      } else {
        prompt = `
          You are a Prosthetic Working Memory assistant. Answer the user's query explicitly and directly using ONLY the provided context.
          Context: ${contextStr}
          Query: "${query}"
        `;
      }

      // 5. Consume the HTTP Stream from our backend
      const streamResponse = await fetch('http://localhost:3000/api/agents/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          model: 'gemini-2.0-flash' 
        }),
        signal: abortControllerRef.current.signal
      });

      if (!streamResponse.body) {
        throw new Error("ReadableStream not supported in this browser.");
      }

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process all complete SSE messages in the buffer
        let position = 0;
        let boundary = '\n\n';
        
        while ((position = buffer.indexOf(boundary)) !== -1) {
          const message = buffer.slice(0, position);
          buffer = buffer.slice(position + boundary.length);
          
          if (message.startsWith('data: ')) {
            const dataStr = message.replace('data: ', '').trim();
            
            if (dataStr === '[DONE]') {
              setLoading(false);
              return;
            }
            
            try {
              const parsed = JSON.parse(dataStr);
              
              if (parsed.error) {
                setStreamError(parsed.error);
                setLoading(false);
                return;
              }
              
              if (parsed.text) {
                // Append chunk to the UI state instantly
                setAnswer(prev => prev + parsed.text);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
              continue;
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Search request aborted');
      } else {
        console.error("Memory Retrieval Error:", error);
        setStreamError(error.message || "Failed to access memory architecture.");
      }
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-light text-slate-800 tracking-tight flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-teal-500" /> Prosthetic Memory
        </h1>
        <p className="text-slate-500 mt-2">Semantic retrieval for degraded working memory.</p>
      </header>

      <div className="relative mb-8">
        <input
          type="text"
          className="w-full p-5 pl-14 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 text-slate-800 text-lg transition-all"
          placeholder="e.g., What was my action item from the sync with Sarah?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Search className="absolute left-5 top-5 w-6 h-6 text-slate-400" />
        
        <button
          onClick={handleSearch}
          disabled={loading || !query}
          className="absolute right-3 top-3 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Recall"}
          {loading && <span className="text-xs opacity-70">Streaming...</span>}
        </button>
      </div>

      {streamError && (
        <div className="p-4 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-700">
          {streamError}
        </div>
      )}

      {answer && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className={`p-6 rounded-2xl border ${query.toLowerCase().includes('action item') ? 'bg-teal-50/50 border-teal-100' : 'bg-white border-slate-200 shadow-sm'}`}>
            {query.toLowerCase().includes('action item') && (
              <h4 className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Extracted Commitment
              </h4>
            )}
            
            {/* Render the bolded markdown response safely */}
            <div 
              className="text-slate-800 text-lg leading-relaxed prose prose-slate prose-strong:text-teal-900"
              dangerouslySetInnerHTML={{ 
                __html: answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
              }} 
            />
          </div>
        </div>
      )}
      
      {loading && !answer && (
        <div className="text-center py-8 text-slate-500">
          <p>Streaming response from neural memory network...</p>
        </div>
      )}
    </div>
  );
};

// Add a helper endpoint for embedding if needed (optional)
// This would go in your API routes, not in this component
/*
// In server/src/routes/embed.ts
import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const embeddingResult = await embeddingModel.embedContent(text);
    res.json({ embedding: embeddingResult.embedding.values });
  } catch (error) {
    console.error('Embedding error:', error);
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
});

export const embedRoutes = router;
*/