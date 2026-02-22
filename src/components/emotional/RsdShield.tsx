import React, { useState, useEffect } from 'react';
import { analyzeRsdRisk, RsdAnalysis } from '../../agents/flowAgents';
import { ShieldCheck, ShieldAlert, User } from 'lucide-react';

interface RsdShieldProps {
  senderName: string;
  senderContext: string;
  messageText: string;
}

export const RsdShield: React.FC<RsdShieldProps> = ({ senderName, senderContext, messageText }) => {
  const [analysis, setAnalysis] = useState<RsdAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scanMessage = async () => {
      try {
        const result = await analyzeRsdRisk(messageText, senderContext);
        setAnalysis(result);
      } catch (error) {
        console.error("RSD Scan Failed", error);
      } finally {
        setLoading(false);
      }
    };
    scanMessage();
  }, [messageText, senderContext]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 animate-pulse flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
        <div className="flex-1 h-4 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl border transition-colors ${
      analysis?.is_high_risk ? 'bg-white border-amber-200 shadow-sm' : 'bg-white border-slate-100'
    }`}>
      
      {/* RSD Reframing Buffer (Renders before the message) */}
      {analysis?.is_high_risk && (
        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">Context Buffer</span>
            <p className="text-sm text-amber-900">{analysis.reframed_context}</p>
          </div>
        </div>
      )}

      {/* Actual Message */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
          <User className="w-5 h-5 text-slate-500" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800 text-sm">{senderName}</span>
            {!analysis?.is_high_risk && (
              <div title="Low RSD Risk">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">{messageText}</p>
        </div>
      </div>

    </div>
  );
};