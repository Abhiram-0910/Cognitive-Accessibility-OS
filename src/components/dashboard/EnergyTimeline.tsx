import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useCognitiveStore } from '../../stores/cognitiveStore';

interface HistoryDataPoint {
  time: string;
  score: number;
}

export const EnergyTimeline: React.FC = () => {
  const loadScore = useCognitiveStore((state) => state.cognitiveLoadScore);
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);

  useEffect(() => {
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    setHistory((prev) => {
      const newHistory = [...prev, { time: timeString, score: loadScore }];
      // Keep only the last 20 data points for a clean visualization
      return newHistory.length > 20 ? newHistory.slice(newHistory.length - 20) : newHistory;
    });
  }, [loadScore]);

  return (
    <div className="w-full h-64 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      <h3 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Cognitive Load Trajectory
      </h3>
      <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#94A3B8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94A3B8' }} 
              dy={10}
            />
            <YAxis 
              domain={[0, 100]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94A3B8' }} 
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#475569' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#64748B" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorScore)" 
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};