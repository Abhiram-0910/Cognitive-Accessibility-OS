import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useCognitiveStore } from '../../stores/cognitiveStore';

interface DataPoint {
  time: string;
  load: number;
  frustration: number;
}

export const EnergyTimeline: React.FC = () => {
  const isHeuristic = useCognitiveStore((state) => state.isHeuristic);
  const [history, setHistory] = useState<DataPoint[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useCognitiveStore.getState();
      const now = new Date();
      const t = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      setHistory(prev => {
        const next = [...prev, {
          time: t,
          load: Math.round(state.cognitiveLoadScore),
          frustration: Math.round(state.metrics.facialTension),
        }];
        return next.length > 20 ? next.slice(next.length - 20) : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-64 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase flex items-center justify-between">
        <span>Live Cognitive Load</span>
        {isHeuristic && (
          <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200 normal-case shadow-sm">
            [Heuristic Proxy]
          </span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={200} minWidth={0}>
        <AreaChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#197fe6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#197fe6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFrust" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94A3B8' }} dy={8} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94A3B8' }} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 11 }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          <Area type="monotone" dataKey="load" name="Load" stroke="#197fe6" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" animationDuration={300} dot={false} />
          <Area type="monotone" dataKey="frustration" name="Frustration" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorFrust)" animationDuration={300} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};