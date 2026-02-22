import React, { useState } from 'react';
import { reframeTraitForResume, analyzeJobDescription, ReframedTrait, RoleAnalysis } from '../../agents/careerAgents';
import { Loader2, Briefcase, Sparkles, FileSearch, UserCheck, ShieldAlert, CheckCircle } from 'lucide-react';

export const RecruitmentAlly: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'resume' | 'role'>('resume');
  
  // Resume State
  const [traitInput, setTraitInput] = useState('');
  const [traitLoading, setTraitLoading] = useState(false);
  const [traitResult, setTraitResult] = useState<ReframedTrait | null>(null);

  // Role State
  const [jdInput, setJdInput] = useState('');
  const [jdLoading, setJdLoading] = useState(false);
  const [jdResult, setJdResult] = useState<RoleAnalysis | null>(null);

  const handleReframe = async () => {
    if (!traitInput) return;
    setTraitLoading(true);
    try {
      const data = await reframeTraitForResume(traitInput);
      setTraitResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setTraitLoading(false);
    }
  };

  const handleAnalyzeRole = async () => {
    if (!jdInput) return;
    setJdLoading(true);
    try {
      const data = await analyzeJobDescription(jdInput);
      setJdResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setJdLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Briefcase className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Recruitment Ally</h3>
          <p className="text-xs text-slate-500">Translate your cognitive style into market value.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-100 mb-6">
        <button 
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'resume' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('resume')}
        >
          <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Trait Reframer</span>
        </button>
        <button 
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'role' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          onClick={() => setActiveTab('role')}
        >
          <span className="flex items-center gap-2"><FileSearch className="w-4 h-4" /> Role Analyzer</span>
        </button>
      </div>

      {/* Tab: Resume Enhancer */}
      {activeTab === 'resume' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 text-sm"
              placeholder="e.g., I hyperfocus on details and forget the time, or I need strict routines."
              value={traitInput}
              onChange={(e) => setTraitInput(e.target.value)}
            />
            <button
              onClick={handleReframe}
              disabled={traitLoading || !traitInput}
              className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {traitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reframe'}
            </button>
          </div>

          {traitResult && (
            <div className="space-y-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
              <div>
                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">The Superpower</h4>
                <p className="text-sm text-slate-700">{traitResult.reframed_strength}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Resume Bullet</h4>
                <p className="text-sm font-medium text-slate-800 bg-white p-3 rounded-lg border border-indigo-100">
                  • {traitResult.resume_bullet}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" /> Interview Talking Point
                </h4>
                <p className="text-sm text-slate-600 italic">"{traitResult.interview_talking_point}"</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Role Fit Analyzer */}
      {activeTab === 'role' && (
        <div className="animate-in fade-in duration-300">
          <textarea
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 text-sm mb-4 resize-none"
            rows={4}
            placeholder="Paste the Job Description here to analyze hidden cognitive demands..."
            value={jdInput}
            onChange={(e) => setJdInput(e.target.value)}
          />
          <button
            onClick={handleAnalyzeRole}
            disabled={jdLoading || !jdInput}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2 mb-6"
          >
            {jdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze Environment'}
          </button>

          {jdResult && (
            <div className="space-y-4">
              <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Green Flags</h4>
                <ul className="text-sm text-slate-700 space-y-1">{jdResult.green_flags.map((f, i) => <li key={i}>• {f}</li>)}</ul>
              </div>
              <div className="p-4 border border-rose-100 bg-rose-50/30 rounded-xl">
                <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Friction Points</h4>
                <ul className="text-sm text-slate-700 space-y-1">{jdResult.cognitive_friction_points.map((f, i) => <li key={i}>• {f}</li>)}</ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};