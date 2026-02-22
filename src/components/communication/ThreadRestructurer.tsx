import React, { useState } from 'react';
import { analyzeThread, ThreadAnalysis } from '../../agents/communicationAgents';
import { Loader2, MessageSquare, CheckSquare, Users, Thermometer } from 'lucide-react';

export const ThreadRestructurer: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ThreadAnalysis | null>(null);

  const handleProcess = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const data = await analyzeThread(input);
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg">
          <MessageSquare className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Thread Restructurer</h3>
          <p className="text-xs text-slate-500">Convert noisy threads into pure signal.</p>
        </div>
      </div>

      <textarea
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700 resize-none text-sm mb-4"
        rows={5}
        placeholder="Paste a chaotic Slack or email thread here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleProcess}
        disabled={loading || !input}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mb-8"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Extract Signal'}
      </button>

      {result && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <Thermometer className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Summary & Tone</h4>
              <p className="text-slate-800 text-sm mb-2">{result.summary}</p>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-600">
                Tone: {result.emotional_temperature}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-100 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Decisions Made
              </h4>
              {result.decisions_made.length > 0 ? (
                <ul className="space-y-2 text-sm text-slate-700">
                  {result.decisions_made.map((decision, idx) => (
                    <li key={idx} className="flex gap-2"><span className="text-blue-500">•</span> {decision}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No clear decisions found.</p>
              )}
            </div>

            <div className="p-4 border border-slate-100 rounded-xl">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Action Items
              </h4>
              {result.action_items.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {result.action_items.map((item, idx) => (
                    <li key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="font-semibold text-slate-800 block mb-1">{item.owner}</span>
                      <span className="text-slate-600">{item.task}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No action items assigned.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};