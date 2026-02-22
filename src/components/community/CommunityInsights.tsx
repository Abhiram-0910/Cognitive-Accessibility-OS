import React from 'react';
import { Activity, Users, Clock, BrainCircuit } from 'lucide-react';

export const CommunityInsights: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <Activity className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Macro Rhythms</h3>
          <p className="text-xs text-slate-500">Anonymized telemetry from the NeuroAdaptive network.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Stat 1 */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collective Focus</span>
          </div>
          <p className="text-2xl font-light text-slate-800">10:30 AM</p>
          <p className="text-xs text-slate-500 mt-1">Peak flow state for "Hyperfocus" profiles globally.</p>
        </div>

        {/* Stat 2 */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Friction Point</span>
          </div>
          <p className="text-2xl font-light text-slate-800">Context Switching</p>
          <p className="text-xs text-slate-500 mt-1">Accounts for 62% of all overload spikes reported today.</p>
        </div>

      </div>

      <div className="mt-4 p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl flex items-start gap-3">
        <Users className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800 leading-relaxed">
          <strong>You are not broken; you are in the minority.</strong> The friction you experience is a system mismatch, not a personal deficit. 
          Currently, 4,201 users are actively reshaping their digital environments alongside you.
        </p>
      </div>
    </div>
  );
};