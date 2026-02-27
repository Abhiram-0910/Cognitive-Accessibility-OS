import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useCognitiveStore } from '../../stores/cognitiveStore';
import { TrendingUp, AlertCircle } from 'lucide-react';

interface ForecastData {
  day: string;
  fatigueRisk: number;
}

export const BurnoutForecast: React.FC = () => {
  const currentLoad = useCognitiveStore((state) => state.cognitiveLoadScore);

  // Generate a predictive rolling 7-day forecast.
  // In a production environment, this would pull historical moving averages from Supabase pgvector/telemetry.
  const forecastData = useMemo<ForecastData[]>(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; 
    
    return days.map((day, index) => {
      let baseRisk = 40 + Math.random() * 20; // Baseline friction
      
      // Project higher risk if current load is continuously high
      if (index >= todayIndex) {
         baseRisk += (currentLoad * 0.3) * (index - todayIndex);
      }
      
      return {
        day,
        fatigueRisk: Math.min(100, Math.max(0, Math.round(baseRisk)))
      };
    });
  }, [currentLoad]);

  // Color mapping logic based on severity
  const getBarColor = (risk: number) => {
    if (risk < 50) return '#2DD4BF'; // Teal (Safe)
    if (risk < 75) return '#FBBF24'; // Amber (Warning)
    return '#F87171'; // Red (High Risk)
  };

  const peakRisk = Math.max(...forecastData.map(d => d.fatigueRisk));
  const requiresIntervention = peakRisk > 80;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            7-Day Burnout Forecast
          </h3>
          <p className="text-xs text-slate-500 mt-1">Predictive cognitive fatigue based on current momentum.</p>
        </div>
        
        {requiresIntervention && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold border border-red-100 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" /> High Risk Detected
          </div>
        )}
      </div>

      <div style={{ width: '100%', height: '200px', minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecastData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: '#64748B' }} 
              dy={10}
            />
            <YAxis 
              hide 
              domain={[0, 100]} 
            />
            <Tooltip
              cursor={{ fill: '#F1F5F9' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#0F172A', fontWeight: 600 }}
            />
            <Bar 
              dataKey="fatigueRisk" 
              radius={[6, 6, 6, 6]}
              barSize={32}
              animationDuration={1500}
            >
              {forecastData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.fatigueRisk)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};