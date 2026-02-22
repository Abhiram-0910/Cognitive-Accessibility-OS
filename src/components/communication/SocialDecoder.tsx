import React, { useState } from 'react';
import { decodeSocialInteraction, SocialAnalysis } from '../../agents/communicationAgents';
import { Loader2, Ear, ShieldAlert, Lightbulb, MessageCircle } from 'lucide-react';

export const SocialDecoder: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialAnalysis | null>(null);

  const handleDecode = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const data = await decodeSocialInteraction(input);
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Ear className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Social Subtext Decoder</h3>
          <p className="text-xs text-slate-500">Logical interpretations for ambiguous interactions.</p>
        </div>
      </div>

      <textarea
        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 resize-none text-sm mb-4"
        rows={3}
        placeholder="e.g., My manager replied 'Fine' to my detailed proposal with no other context."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleDecode}
        disabled={loading || !input}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mb-8"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Decode Subtext'}
      </button>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
          
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Likely Meanings
              </h4>
              <ul className="space-y-2 text-sm text-slate-700">
                {result.likely_interpretations.map((item, idx) => (
                  <li key={idx} className="flex gap-2"><span className="text-indigo-400">•</span> {item}</li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2">Subtext Analysis</h4>
              <p className="text-sm text-slate-700">{result.subtext_analysis}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100">
              <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> What NOT to Assume
              </h4>
              <ul className="space-y-2 text-sm text-slate-700">
                {result.what_not_to_assume.map((item, idx) => (
                  <li key={idx} className="flex gap-2 items-start">
                    <span className="text-rose-500 font-bold">×</span> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-500" /> Recommended Replies
              </h4>
              <div className="space-y-2">
                {result.recommended_responses.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
                    "{item}"
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};