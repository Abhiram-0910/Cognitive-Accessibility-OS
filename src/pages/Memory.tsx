import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { genAI } from '../lib/gemini';
import { Loader2, Search, BrainCircuit, CheckSquare } from 'lucide-react';

const textModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

export const Memory: React.FC<{ userId: string }> = ({ userId }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setAnswer(null);

    try {
      // 1. Embed the user's query
      const embeddingResult = await embeddingModel.embedContent(query);
      const queryEmbedding = embeddingResult.embedding.values;

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

      // 4. Synthesize with Gemini based on intent
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

      const synthesisResult = await textModel.generateContent(prompt);
      setAnswer(synthesisResult.response.text().trim());

    } catch (error) {
      console.error("Memory Retrieval Error:", error);
      setAnswer("Failed to access memory architecture.");
    } finally {
      setLoading(false);
    }
  };

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
          className="absolute right-3 top-3 bg-slate-800 hover:bg-slate-900 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Recall"}
        </button>
      </div>

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
              dangerouslySetInnerHTML={{ __html: answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};