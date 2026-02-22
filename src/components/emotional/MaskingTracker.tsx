import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Clock, CheckCircle2, Loader2 } from 'lucide-react';

export const MaskingTracker: React.FC<{ userId: string }> = ({ userId }) => {
  const [duration, setDuration] = useState<number>(30);
  const [context, setContext] = useState<string>('Heavy Social Navigation');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const maskingContexts = [
    'Heavy Social Navigation',
    'Suppressing Stims',
    'Forced Eye Contact',
    'Vocal Tone Modulation',
    'Sensory Endurance (Loud/Bright Environment)'
  ];

  const handleLogEvent = async () => {
    setStatus('loading');
    try {
      const { error } = await supabase.from('masking_events').insert({
        user_id: userId,
        context,
        duration_minutes: duration,
      });

      if (error) throw error;
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error("Error logging masking event:", err);
      setStatus('idle');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Shield className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Masking Log</h3>
          <p className="text-xs text-slate-500">Track emotional labor and cognitive suppression.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Context Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Primary Friction
          </label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          >
            {maskingContexts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Duration Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Duration
            </label>
            <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {duration} min
            </span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="120" 
            step="5"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full accent-indigo-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
            <span>5m</span>
            <span>2h+</span>
          </div>
        </div>

        {/* Submit Action */}
        <button
          onClick={handleLogEvent}
          disabled={status !== 'idle'}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            status === 'success' 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {status === 'idle' ? 'Log Energy Drain' : status === 'success' ? 'Logged Successfully' : 'Saving...'}
        </button>
      </div>
    </div>
  );
};