import React, { useState } from 'react';
import { generateSkillExercise, CognitiveExercise } from '../../agents/cognitiveTrainingAgent';
import { Loader2, Dumbbell, Target, Brain, Shield, ChevronRight } from 'lucide-react';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const SkillBuilder: React.FC = () => {
  // Pulling base preferences from the store (or mock it for the demo)
  const classification = useCognitiveStore((state) => state.classification); 
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState<CognitiveExercise | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const trainingCategories = [
    { id: 'distraction_resistance', name: 'Distraction Resistance', icon: Shield, color: 'text-rose-500', bg: 'bg-rose-100', border: 'border-rose-200' },
    { id: 'executive_initiation', name: 'Task Initiation', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-100', border: 'border-amber-200' },
    { id: 'pattern_recognition', name: 'Pattern Recognition', icon: Brain, color: 'text-indigo-500', bg: 'bg-indigo-100', border: 'border-indigo-200' },
    { id: 'working_memory', name: 'Working Memory Expansion', icon: Target, color: 'text-teal-500', bg: 'bg-teal-100', border: 'border-teal-200' },
  ];

  const handleGenerateExercise = async (categoryId: string, categoryName: string) => {
    setLoading(true);
    setActiveCategory(categoryId);
    setExercise(null);
    
    try {
      // Pass the current real-time classification as the "cognitive style" context
      const data = await generateSkillExercise(`Currently in ${classification} state`, categoryName);
      setExercise(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 w-full mt-8">
      <header className="mb-8">
        <h3 className="text-2xl font-light text-slate-800 flex items-center gap-3 tracking-tight">
          <div className="p-2 bg-slate-800 text-white rounded-xl"><Dumbbell className="w-6 h-6" /></div>
          Cognitive Superpower Builder
        </h3>
        <p className="text-slate-500 mt-2 text-sm">Gamified protocols to train your executive function and leverage your unique processing style.</p>
      </header>

      {/* Category Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {trainingCategories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          
          return (
            <button
              key={cat.id}
              onClick={() => handleGenerateExercise(cat.id, cat.name)}
              disabled={loading}
              className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-start text-left ${
                isActive ? `${cat.border} ${cat.bg} shadow-sm` : 'border-slate-100 bg-slate-50 hover:border-slate-300'
              } disabled:opacity-50`}
            >
              <div className={`p-2 rounded-lg mb-3 bg-white shadow-sm ${cat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="font-semibold text-slate-800 text-sm mb-1">{cat.name}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1 mt-auto">
                Train <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 font-medium">Generating dynamic training protocol...</p>
        </div>
      )}

      {/* Generated Exercise */}
      {exercise && !loading && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
          
          {/* Decorative background element */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-700 rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider mb-4 border border-white/10">
              <Target className="w-3.5 h-3.5" /> {exercise.focus_area}
            </span>
            
            <h4 className="text-3xl font-light mb-4 tracking-tight">{exercise.title}</h4>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 backdrop-blur-sm">
              <p className="text-slate-300 text-sm leading-relaxed">{exercise.scenario}</p>
            </div>

            <div className="space-y-4 mb-8">
              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Protocol Steps</h5>
              {exercise.steps.map((step, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-md">
                    {idx + 1}
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Success Metric</h5>
                <p className="text-sm font-medium text-emerald-100">{exercise.success_metric}</p>
              </div>
              <button 
                onClick={() => setExercise(null)}
                className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors shrink-0"
              >
                Complete Protocol
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Quick mock for the Zap icon if it wasn't imported from lucide-react above
const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);