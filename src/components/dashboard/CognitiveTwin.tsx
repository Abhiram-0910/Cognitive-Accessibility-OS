import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Brain, Clock, Zap, AlertTriangle } from 'lucide-react';

interface TwinInsights {
  peakFocusHour: string;
  overloadTrigger: string;
  averageLoad: number;
}

export const CognitiveTwin: React.FC<{ userId: string }> = ({ userId }) => {
  const [insights, setInsights] = useState<TwinInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCognitiveData = async () => {
      try {
        // Fetch the last 7 days of snapshots (limit for hackathon demo purposes)
        const { data, error } = await supabase
          .from('cognitive_snapshots')
          .select('timestamp, load_score, context_type')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1000);

        if (error) throw error;

        if (data && data.length > 0) {
          calculateInsights(data);
        } else {
          setLoading(false); // No data yet
        }
      } catch (err) {
        console.error("Error fetching cognitive twin data:", err);
        setLoading(false);
      }
    };

    fetchCognitiveData();
  }, [userId]);

  const calculateInsights = (data: any[]) => {
    // 1. Find Peak Focus Window (Lowest average load score per hour)
    const hourlyLoads: Record<number, number[]> = {};
    const contextLoads: Record<string, number[]> = {};
    let totalLoad = 0;

    data.forEach(snapshot => {
      const hour = new Date(snapshot.timestamp).getHours();
      if (!hourlyLoads[hour]) hourlyLoads[hour] = [];
      hourlyLoads[hour].push(snapshot.load_score);

      const ctx = snapshot.context_type;
      if (!contextLoads[ctx]) contextLoads[ctx] = [];
      contextLoads[ctx].push(snapshot.load_score);

      totalLoad += snapshot.load_score;
    });

    let bestHour = 0;
    let lowestAvgLoad = Infinity;
    Object.keys(hourlyLoads).forEach(hourStr => {
      const hour = parseInt(hourStr);
      const avg = hourlyLoads[hour].reduce((a, b) => a + b, 0) / hourlyLoads[hour].length;
      if (avg < lowestAvgLoad) {
        lowestAvgLoad = avg;
        bestHour = hour;
      }
    });

    // Format hour nicely (e.g., "10:00 AM")
    const formattedHour = new Date(0, 0, 0, bestHour, 0, 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // 2. Find Overload Triggers (Highest average load by context)
    let worstContext = 'Unknown';
    let highestAvgLoad = 0;
    Object.keys(contextLoads).forEach(ctx => {
      const avg = contextLoads[ctx].reduce((a, b) => a + b, 0) / contextLoads[ctx].length;
      if (avg > highestAvgLoad) {
        highestAvgLoad = avg;
        worstContext = ctx;
      }
    });

    setInsights({
      peakFocusHour: formattedHour,
      overloadTrigger: worstContext,
      averageLoad: Math.round(totalLoad / data.length)
    });
    
    setLoading(false);
  };

  if (loading) {
    return <div className="animate-pulse h-48 bg-slate-100 rounded-2xl w-full"></div>;
  }

  if (!insights) {
    return (
      <div className="p-8 bg-white border border-slate-100 rounded-2xl shadow-sm text-center text-slate-500">
        <Brain className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p>Gathering telemetry to map your Cognitive Twin.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <Brain className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-xl font-medium text-slate-800 tracking-tight">Cognitive Digital Twin</h2>
          <p className="text-sm text-slate-500">Your biological workflow patterns mapped over 7 days.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Insight Card: Peak Focus */}
        <div className="p-5 bg-teal-50/50 rounded-2xl border border-teal-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-semibold text-teal-800 uppercase tracking-wider">Peak Flow State</h3>
          </div>
          <p className="text-2xl font-light text-teal-900 mt-2">{insights.peakFocusHour}</p>
          <p className="text-xs text-teal-700 mt-1 opacity-80">Ideal time for deep work</p>
        </div>

        {/* Insight Card: Baseline Load */}
        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Baseline Friction</h3>
          </div>
          <p className="text-2xl font-light text-blue-900 mt-2">{insights.averageLoad} <span className="text-sm font-medium opacity-60">/ 100</span></p>
          <p className="text-xs text-blue-700 mt-1 opacity-80">Average daily cognitive load</p>
        </div>

        {/* Insight Card: Overload Trigger */}
        <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Primary Friction Point</h3>
          </div>
          <p className="text-2xl font-light text-amber-900 mt-2 capitalize">{insights.overloadTrigger.replace('_', ' ')}</p>
          <p className="text-xs text-amber-700 mt-1 opacity-80">Routinely causes load spikes</p>
        </div>

      </div>
    </div>
  );
};