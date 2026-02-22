import React, { useState, useEffect } from 'react';
import { useCognitiveStore } from '../../stores/cognitiveStore';
import { summarizeHyperfocus, HyperfocusSummary } from '../../agents/flowAgents';
import { Brain, X, Loader2, Sparkles } from 'lucide-react';

export const HyperfocusCapsule: React.FC = () => {
  const { classification } = useCognitiveStore();
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<HyperfocusSummary | null>(null);

  // Auto-suggest capsule when in hyperfocus, or keep it active if user accepted
  useEffect(() => {
    if (classification === 'hyperfocus' && !isActive && !summary) {
      setIsActive(true);
    }
  }, [classification, isActive, summary]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleExit = async () => {
    if (!notes.trim()) {
      setIsActive(false);
      setSeconds(0);
      return;
    }
    
    setLoading(true);
    try {
      const result = await summarizeHyperfocus(notes);
      setSummary(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsActive(false);
    }
  };

  if (!isActive && !summary) return null;

  return (
    <div className="fixed inset-0 z-[9000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-700">
      
      {isActive && (
        <div className="w-full max-w-3xl flex flex-col h-[80vh]">
          <header className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Brain className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-light text-white tracking-wide">Deep Flow Active</h2>
                <p className="text-sm text-blue-300">All notifications are currently suppressed.</p>
              </div>
            </div>
            <div className="text-4xl font-light tracking-tighter text-blue-100 tabular-nums">
              {formatTime(seconds)}
            </div>
          </header>

          <textarea
            className="flex-1 w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-slate-200 text-lg placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
            placeholder="Scratchpad: Dump intrusive thoughts, ideas, or tangential tasks here so you don't lose your current context..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleExit}
              className="px-8 py-4 bg-white text-slate-900 rounded-full font-semibold flex items-center gap-2 hover:bg-blue-50 transition-colors"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><X className="w-5 h-5" /> Exit Flow & Summarize</>}
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="w-full max-w-xl bg-slate-800 rounded-3xl p-8 border border-slate-700 animate-in zoom-in-95">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-light text-white">Capsule Summary</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Core Insight</h4>
              <p className="text-slate-200 leading-relaxed">{summary.core_insight}</p>
            </div>
            
            {summary.action_items.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Captured Actions</h4>
                <ul className="space-y-2">
                  {summary.action_items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-slate-300 bg-slate-700/50 p-3 rounded-lg">
                      <span className="text-blue-400">•</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={() => { setSummary(null); setNotes(''); setSeconds(0); }}
            className="mt-8 w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            Save to Memory & Return to OS
          </button>
        </div>
      )}
    </div>
  );
};