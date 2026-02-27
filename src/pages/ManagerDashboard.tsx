import React, { useState, useMemo } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { 
  Users, AlertTriangle, MessageSquare, Calendar, ShieldCheck, 
  TrendingUp, DollarSign, HeartHandshake, BatteryCharging 
} from 'lucide-react';

// --- MOCK DATA ---
const mockAggregatedData = {
  clusterName: "Engineering Team Alpha",
  activeUsers: 142,
  kAnonymityThreshold: 5,
  baselineTurnoverRate: 0.15, // 15% annual turnover baseline
  costPerTurnover: 50000, // $50k cost to replace
  burnoutRiskReduction: 0.22, // 22% reduction in burnout risk via NeuroAdaptive OS
  
  burnoutRiskTrend: [
    { day: 'Mon', riskScore: 45 },
    { day: 'Tue', riskScore: 52 },
    { day: 'Wed', riskScore: 68 },
    { day: 'Thu', riskScore: 82 }, 
    { day: 'Fri', riskScore: 75 },
  ],
  
  deiAccommodations: [
    { metric: 'Communication Proxy', usage: 88 },
    { metric: 'Sensory Equalizer', usage: 65 },
    { metric: 'Time Blindness Buffer', usage: 45 },
    { metric: 'Executive Task Bypass', usage: 72 },
    { metric: 'Body Doubling Lobby', usage: 50 },
  ],
  
  maskingHoursSaved: 1240 // Total hours saved this month team-wide
};

export const ManagerDashboard: React.FC = () => {
  const [data] = useState(mockAggregatedData);
  const [activeTab, setActiveTab] = useState<'insights' | 'roi' | 'dei'>('roi');

  // --- CALCULATIONS ---
  const isPrivacyCompliant = data.activeUsers >= data.kAnonymityThreshold;

  // ROI Math
  const expectedAnnualDepartures = data.activeUsers * data.baselineTurnoverRate;
  const preventedDepartures = expectedAnnualDepartures * data.burnoutRiskReduction;
  const annualSavings = preventedDepartures * data.costPerTurnover;

  const roiChartData = [
    { quarter: 'Q1', savings: Math.round(annualSavings * 0.15) },
    { quarter: 'Q2', savings: Math.round(annualSavings * 0.25) },
    { quarter: 'Q3', savings: Math.round(annualSavings * 0.30) },
    { quarter: 'Q4', savings: Math.round(annualSavings * 0.30) },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-8 lg:p-12 font-sans text-slate-800">
      
      {/* Dashboard Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Enterprise Intelligence</h1>
          <p className="text-slate-500 mt-1 font-medium">{data.clusterName} • B2B Analytics</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            k-Anonymity Active (n={data.activeUsers})
          </span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-slate-200 mb-8">
        <button 
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'insights' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          onClick={() => setActiveTab('insights')}
        >
          Team Insights
        </button>
        <button 
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'roi' ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          onClick={() => setActiveTab('roi')}
        >
          Financial ROI
        </button>
        <button 
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'dei' ? 'text-purple-600 border-purple-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
          onClick={() => setActiveTab('dei')}
        >
          DEI Compliance
        </button>
      </div>

      {!isPrivacyCompliant ? (
        <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center">
          <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-700">Insufficient Data for Anonymity</h2>
          <p className="text-slate-500 mt-2">Insights are locked to protect employee medical privacy.</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          
          {/* ==================== ROI TAB ==================== */}
          {activeTab === 'roi' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* ROI Calculator Settings */}
              <div className="xl:col-span-1 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-emerald-500" /> Retention Calculator
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Team Size</label>
                    <div className="text-2xl font-light text-slate-800">{data.activeUsers} Employees</div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Turnover Replacement Cost</label>
                    <div className="text-2xl font-light text-slate-800">${data.costPerTurnover.toLocaleString()} <span className="text-sm text-slate-400">/ per head</span></div>
                    <p className="text-xs text-slate-400 mt-1">Industry standard for recruitment, onboarding, and lost productivity.</p>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-2">OS Burnout Mitigation</label>
                    <div className="text-3xl font-light text-emerald-600">{(data.burnoutRiskReduction * 100).toFixed(1)}%</div>
                    <p className="text-xs text-emerald-700/70 mt-1">Reduction in critical cognitive load spikes.</p>
                  </div>
                </div>
              </div>

              {/* ROI Graph & Bottom Line */}
              <div className="xl:col-span-2 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
                    <h4 className="text-sm font-semibold text-emerald-800 mb-1">Prevented Turnover</h4>
                    <span className="text-4xl font-light text-emerald-600">{preventedDepartures.toFixed(1)} <span className="text-lg">employees</span></span>
                  </div>
                  <div className="p-6 bg-slate-800 rounded-3xl shadow-lg">
                    <h4 className="text-sm font-semibold text-slate-300 mb-1">Estimated Annual Savings</h4>
                    <span className="text-4xl font-light text-white">${Math.round(annualSavings).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100" style={{ height: '300px' }}>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Cumulative Savings Trajectory</h4>
                  <div className="w-full mt-2">
                    <ResponsiveContainer width="100%" height={220} minWidth={0}>
                    <BarChart data={roiChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                      <YAxis tickFormatter={(val) => `$${val / 1000}k`} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Savings']}
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="savings" radius={[6, 6, 6, 6]} barSize={40}>
                        {roiChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="#10B981" />
                        ))}
                      </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== DEI TAB ==================== */}
          {activeTab === 'dei' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              <div className="xl:col-span-1 flex flex-col gap-6">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex-1">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-6 text-slate-800">
                    <HeartHandshake className="w-5 h-5 text-purple-500" /> Accommodation Health
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    This report validates your organization's commitment to neurodiversity. By providing universally accessible cognitive tools, you remain ADA/EEO compliant without forcing employees to disclose medical diagnoses.
                  </p>
                  
                  <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <BatteryCharging className="w-5 h-5 text-purple-600" />
                      <h4 className="text-sm font-bold text-purple-800 uppercase tracking-wider">Masking Energy Saved</h4>
                    </div>
                    <span className="text-3xl font-light text-purple-900">{data.maskingHoursSaved.toLocaleString()} <span className="text-base font-medium opacity-70">hours / mo</span></span>
                    <p className="text-xs text-purple-700 mt-2">Cognitive labor reallocated from social navigation back into deep work.</p>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-2 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Digital Prosthetic Utilization</h3>
                <p className="text-sm text-slate-500 mb-6">Anonymous breakdown of active structural accommodations.</p>
                
                <div className="w-full mt-2">
                  <ResponsiveContainer width="100%" height={320} minWidth={0}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.deiAccommodations}>
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar 
                        name="Active Users (%)" 
                        dataKey="usage" 
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        fill="#8B5CF6" 
                        fillOpacity={0.4} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`${value}% of Team`, 'Utilization']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* Fallback for Insights Tab from previous iteration */}
          {activeTab === 'insights' && (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-slate-700">Team Insights Active</h2>
              <p className="text-slate-500 mt-2">Switch to Financial ROI or DEI Compliance for executive reporting.</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
};