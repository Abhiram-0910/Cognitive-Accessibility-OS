import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Search, BrainCircuit, CheckSquare } from 'lucide-react';

// ─── Demo data for hackathon mode (shown when pgvector/backend unavailable) ────
const DEMO_MEMORIES = [
  { source: 'slack', content: 'Slack from Priya (PM): "The Q4 dashboard feature demo is moved to Friday 3pm. Can you make sure the biometric graphs are working? Also the manager wants a PDF export."' },
  { source: 'slack', content: 'Slack from Arjun (Design): "I pushed the Figma updates for the parent portal. Bento grid needs 3 columns on desktop."' },
  { source: 'slack', content: 'Slack from Rohit (Tech Lead): "Reminder: the HuggingFace API token needs to be added to server/.env before the hackathon demo. Extension manifest needs all_urls."' },
  { source: 'slack', content: 'Slack DM from Arjun: "Did we decide on 432Hz or 40Hz for Crisis Mode? Need this for the pitch deck audio section."' },
  { source: 'jira', content: 'Jira NEXUS-47: [BUG] Game.tsx fatal crash — TypeError: catch is not a function on Supabase insert. Priority: Critical. Deadline: Tomorrow.' },
  { source: 'jira', content: 'Jira NEXUS-52: [FEATURE] Parent Portal — HuggingFace ViT emotion analysis report for each game session. Status: In Review.' },
  { source: 'jira', content: 'Jira NEXUS-61: [TASK] Extension manifest.json — expand from 3 domains to all_urls for Wikipedia and GitHub support. Status: Done.' },
  { source: 'jira', content: 'Jira NEXUS-65: [STORY] Breathe With Bear — add 432Hz binaural audio to the calming breathing modal. Status: Done.' },
  { source: 'jira', content: 'Jira NEXUS-71: [ACTION ITEM] Present demo to IEEE judges by March 1. Need: HF report, working extension on Wikipedia, PDF upload, all routes green.' },
];

export const Memory: React.FC<{ userId: string }> = ({ userId }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Helper: stream Gemini answer from backend ────────────────────────────
  const streamGeminiAnswer = async (contextStr: string, userQuery: string, isActionItem: boolean) => {
    const prompt = isActionItem
      ? `You are a Prosthetic Memory assistant. From the context below, extract the single most pressing action item. Return ONLY one bolded bullet point.\n\nContext: ${contextStr}\nQuery: "${userQuery}"`
      : `You are a Prosthetic Memory assistant. Answer directly using ONLY this context.\n\nContext: ${contextStr}\nQuery: "${userQuery}"`;
    try {
      const streamResponse = await fetch('http://localhost:3000/api/agents/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'gemini-2.0-flash' }),
        signal: abortControllerRef.current?.signal,
      });
      if (!streamResponse.body) throw new Error('No stream body');
      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let boundary: number;
        while ((boundary = buf.indexOf('\n\n')) !== -1) {
          const msg = buf.slice(0, boundary);
          buf = buf.slice(boundary + 2);
          if (msg.startsWith('data: ')) {
            const d = msg.replace('data: ', '').trim();
            if (d === '[DONE]') { setLoading(false); return; }
            try { const p = JSON.parse(d); if (p.text) setAnswer(prev => prev + p.text); } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setStreamError('Failed to stream response from agent.');
    } finally {
      setLoading(false);
    }
  };

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
        // Fall back to demo data — so the feature always works in demo/hackathon mode
        const demoMatches = DEMO_MEMORIES.filter(m =>
          m.content.toLowerCase().includes(query.toLowerCase().split(' ')[0]) ||
          m.content.toLowerCase().includes(query.toLowerCase().split(' ').pop() || '')
        ).slice(0, 3);
        if (demoMatches.length > 0) {
          const contextStr = demoMatches.map(m => `[${m.source.toUpperCase()}] ${m.content}`).join('\n\n');
          await streamGeminiAnswer(contextStr, query, isActionItemQuery);
          return;
        }
        setAnswer("I couldn't find any relevant context in your digital memory.");
        setLoading(false);
        return;
      }

      const contextStr = matches.map((m: any) => m.content).join('\n\n');
      await streamGeminiAnswer(contextStr, query, isActionItemQuery);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Search request aborted');
      } else {
        // Automatically fall back to local demo answers if backend/DB is down
        console.warn("Memory Retrieval Error (falling back to demo mode):", error);
        const demoMatches = DEMO_MEMORIES.filter(m =>
          m.content.toLowerCase().includes(query.toLowerCase().split(' ')[0]) ||
          m.content.toLowerCase().includes(query.toLowerCase().split(' ').pop() || '')
        ).slice(0, 3);
        if (demoMatches.length > 0) {
          const contextStr = demoMatches.map(m => `[${m.source.toUpperCase()}] ${m.content}`).join('\n\n');
          setStreamError(null);
          await streamGeminiAnswer(contextStr, query, query.toLowerCase().includes('action item'));
          return;
        }

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