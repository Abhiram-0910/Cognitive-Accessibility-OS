import React, { useState } from 'react';
import { generateReentryBrief, ReentryBrief } from '../../agents/flowAgents';
import { Loader2, ArrowRightCircle, Target, History, Play } from 'lucide-react';

interface TaskProps {
  taskId: string;
  taskName: string;
  historicalContext: string; // In production, this is fetched from Supabase pgvector using the taskId
}

export const ContextContinuity: React.FC<TaskProps> = ({ taskName, historicalContext }) => {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<ReentryBrief | null>(null);

  const handleGenerateBrief = async () => {
    setLoading(true);
    try {
      const data = await generateReentryBrief(taskName, historicalContext);
      setBrief(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Paused Task: <span className="text-indigo-600">{taskName}</span>
          </h3>
        </div>
        {!brief && (
          <button
            onClick={handleGenerateBrief}
            disabled={loading}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate Re-entry Brief"}
          </button>
        )}
      </div>

      {brief && (
        <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">The Goal</h4>
              <p className="text-sm text-slate-700">{brief.what_you_were_doing}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last State</h4>
              <p className="text-sm text-slate-700">{brief.where_you_left_off}</p>
            </div>
          </div>
          
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-start gap-3">
            <Target className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Next Concrete Action</h4>
              <p className="text-sm font-medium text-indigo-900">{brief.immediate_next_step}</p>
            </div>
            <button className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1">
              <Play className="w-3 h-3" /> Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
};