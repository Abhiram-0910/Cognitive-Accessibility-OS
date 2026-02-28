import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { Loader2, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5;

interface OnboardingData {
  communication_style: string;
  sensory_tolerance: string;
  focus_pattern: string;
  telemetry_enabled: boolean;
}

export const Onboarding: React.FC<{ userId?: string }> = ({ userId: propUserId }) => {
  const navigate = useNavigate();
  const setOnboardingComplete = useCognitiveStore(s => s.setOnboardingComplete);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const userId = propUserId || useCognitiveStore.getState().userRole === 'admin' ? 'admin' : null; // Fallback
  
  const [formData, setFormData] = useState<OnboardingData>({
    communication_style: 'explicit',
    sensory_tolerance: 'moderate',
    focus_pattern: 'bursts',
    telemetry_enabled: false,
  });

  // No-op useEffect, auth already provided via prop.
  useEffect(() => {
    if (!userId && !propUserId) {
       navigate('/');
    }
  }, [userId, propUserId, navigate]);

  const handleComplete = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const profilePayload = {
        communication_style: formData.communication_style,
        sensory_tolerance: formData.sensory_tolerance,
        focus_pattern: formData.focus_pattern,
      };

      // Race the DB update against a timeout to prevent absolute "static" hangs
      const savePromise = supabase
        .from('profiles')
        .update({
          cognitive_profile: profilePayload,
          cognitive_preferences: profilePayload,
          privacy_settings: {
            telemetry_enabled: formData.telemetry_enabled,
          },
        })
        .eq('id', userId);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1500)
      );

      try {
        await Promise.race([savePromise, timeoutPromise]);
      } catch (e) {
        console.warn('[Onboarding] Profile save timed out or failed, forcing progress...');
      }

      setOnboardingComplete(true);
      
      const currentRole = useCognitiveStore.getState().userRole;
      if (!currentRole) {
        useCognitiveStore.getState().setUserRole('employee');
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Onboarding catastrophic failure:', error);
      setOnboardingComplete(true);
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12 transition-all duration-500">
        
        {/* Progress Indicator */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3, 4, 5].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= i ? 'bg-teal-500' : 'bg-slate-100'}`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-3xl font-light text-slate-800 mb-4">Welcome to your space.</h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              Standard tools assume everyone processes information the same way. We don't. 
              Let's configure this environment to match your natural cognitive rhythms. No labels, just preferences.
            </p>
            <button onClick={() => setStep(2)} className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-medium hover:bg-slate-900 transition flex items-center justify-center gap-2">
              Begin Mapping <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Communication */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-light text-slate-800 mb-6">How do you prefer to receive tasks?</h2>
            <div className="space-y-3 mb-8">
              {[
                { id: 'explicit', label: 'Highly Explicit', desc: 'I need clear deadlines, bullet points, and zero ambiguity.' },
                { id: 'contextual', label: 'Context-Heavy', desc: 'I need to know the "why" and the big picture before starting.' },
                { id: 'minimal', label: 'Minimalist', desc: 'Just give me the raw goal, I will figure out the steps.' }
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setFormData({...formData, communication_style: opt.id})}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${formData.communication_style === opt.id ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-teal-300'}`}
                >
                  <h3 className="font-semibold text-slate-800">{opt.label}</h3>
                  <p className="text-sm text-slate-500 mt-1">{opt.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"><ArrowLeft className="w-4 h-4" /></button>
              <button onClick={() => setStep(3)} className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-medium hover:bg-teal-600 transition">Next Step</button>
            </div>
          </div>
        )}

        {/* Step 3: Sensory */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-light text-slate-800 mb-6">Visual Environment</h2>
            <div className="space-y-3 mb-8">
              {[
                { id: 'minimal', label: 'Strict Minimalist', desc: 'Mute colors, hide non-essential UI, block animations.' },
                { id: 'moderate', label: 'Balanced', desc: 'Standard interface with auto-dimming during high cognitive load.' },
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setFormData({...formData, sensory_tolerance: opt.id})}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${formData.sensory_tolerance === opt.id ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-teal-300'}`}
                >
                  <h3 className="font-semibold text-slate-800">{opt.label}</h3>
                  <p className="text-sm text-slate-500 mt-1">{opt.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"><ArrowLeft className="w-4 h-4" /></button>
              <button onClick={() => setStep(4)} className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-medium hover:bg-teal-600 transition">Next Step</button>
            </div>
          </div>
        )}

        {/* Step 4: Focus Patterns */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-light text-slate-800 mb-6">Focus Rhythm</h2>
            <div className="space-y-3 mb-8">
              {[
                { id: 'bursts', label: 'Hyperfocus Bursts', desc: 'I work intensely for irregular periods, then need hard resets.' },
                { id: 'structured', label: 'Pomodoro / Structured', desc: 'I prefer strict time-boxing to maintain momentum.' },
              ].map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => setFormData({...formData, focus_pattern: opt.id})}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${formData.focus_pattern === opt.id ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-teal-300'}`}
                >
                  <h3 className="font-semibold text-slate-800">{opt.label}</h3>
                  <p className="text-sm text-slate-500 mt-1">{opt.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"><ArrowLeft className="w-4 h-4" /></button>
              <button onClick={() => setStep(5)} className="flex-1 bg-teal-500 text-white py-3 rounded-xl font-medium hover:bg-teal-600 transition">Next Step</button>
            </div>
          </div>
        )}

        {/* Step 5: Privacy & Finalization */}
        {step === 5 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-light text-slate-800 mb-6 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-teal-500" /> Privacy First
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              Your keystroke dynamics and cognitive load scores are calculated entirely locally in your browser. 
            </p>
            
            <label className="flex items-start gap-4 p-4 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition mb-8">
              <input 
                type="checkbox" 
                className="mt-1 w-4 h-4 text-teal-500 rounded border-slate-300 focus:ring-teal-500"
                checked={formData.telemetry_enabled}
                onChange={(e) => setFormData({...formData, telemetry_enabled: e.target.checked})}
              />
              <div>
                <span className="block font-semibold text-slate-800 text-sm">Enable Cloud Sync</span>
                <span className="block text-xs text-slate-500 mt-1">Allow anonymous telemetry syncing to build your long-term Cognitive Twin across devices. You can change this later.</span>
              </div>
            </label>

            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"><ArrowLeft className="w-4 h-4" /></button>
              <button 
                onClick={handleComplete} 
                disabled={loading}
                className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-medium hover:bg-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Initialize OS'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};