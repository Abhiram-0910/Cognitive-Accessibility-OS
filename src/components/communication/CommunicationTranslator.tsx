import React, { useState } from 'react';
import { callAgent } from '../../lib/api';
import {
  Loader2,
  ArrowRight,
  ArrowLeftRight,
  BatteryCharging,
  ShieldCheck
} from 'lucide-react';

interface OutboundResult {
  translated_text: string;
  tone_adjustments: string[];
  masking_energy_saved_minutes: number;
}

export const CommunicationTranslator: React.FC = () => {
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [outboundResult, setOutboundResult] = useState<OutboundResult | null>(null);

  const handleTranslate = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      // 🔐 Secure backend proxy call
      // @ts-ignore - Bypassing strict signature for the hackathon build
      const result = await callAgent('communication', {
        text: input,
        direction: direction
      });

      // Safe parsing
      const parsed =
        typeof result === 'string' ? JSON.parse(result) : result;

      setOutboundResult(parsed);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full max-w-2xl mx-auto mt-8">

      {/* Direction Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
            Translation Proxy
          </h3>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setDirection('inbound');
              setOutboundResult(null);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              direction === 'inbound'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Decode Incoming
          </button>

          <button
            onClick={() => {
              setDirection('outbound');
              setOutboundResult(null);
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              direction === 'outbound'
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Draft Outbound (Unmask)
          </button>
        </div>
      </div>

      {/* Outbound Mode */}
      {direction === 'outbound' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
          <textarea
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 resize-none text-sm"
            rows={4}
            placeholder="Type exactly what you mean, as bluntly as you want (e.g., 'This meeting is a waste of time. I need to code.')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleTranslate}
              disabled={loading || !input}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              Apply Corporate Mask
            </button>
          </div>

          {outboundResult && (
            <div className="mt-6 space-y-4">
              {/* Safe to Send */}
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 relative">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Safe to Send
                </h4>

                <p className="text-sm font-medium text-slate-800">
                  {outboundResult.translated_text}
                </p>

                <button
                  className="absolute top-4 right-4 text-xs font-semibold bg-white border border-indigo-200 text-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-50"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      outboundResult.translated_text
                    )
                  }
                >
                  Copy
                </button>
              </div>

              {/* Adjustments + Energy Saved */}
              <div className="flex gap-4">
                <div className="flex-1 p-4 border border-slate-100 rounded-xl">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Adjustments Made
                  </h4>

                  <ul className="text-xs text-slate-600 space-y-1">
                    {outboundResult.tone_adjustments?.map((adj, i) => (
                      <li key={i}>• {adj}</li>
                    ))}
                  </ul>
                </div>

                <div className="shrink-0 p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl flex flex-col items-center justify-center min-w-[120px]">
                  <BatteryCharging className="w-6 h-6 text-emerald-500 mb-1" />
                  <span className="text-2xl font-light text-emerald-700">
                    {outboundResult.masking_energy_saved_minutes}m
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center mt-1">
                    Energy
                    <br />
                    Saved
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};