import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCognitiveStore, UserRole } from '../stores/cognitiveStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Baby, GraduationCap, Shield } from 'lucide-react';

// ─── Role Card Data ───────────────────────────────────────────────────────────

const ROLE_OPTIONS: { role: UserRole; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    role: 'employee',
    label: 'Employee',
    desc: 'Enterprise workspace with cognitive support, Slack/Jira integration.',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'from-blue-500/20 to-indigo-500/20 border-blue-400/30 hover:border-blue-400/60',
  },
  {
    role: 'parent',
    label: 'Parent',
    desc: 'Manage child profiles, view session reports, access the Kids Module.',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'from-teal-500/20 to-emerald-500/20 border-teal-400/30 hover:border-teal-400/60',
  },
  {
    role: 'child',
    label: 'Child',
    desc: 'Play therapeutic games designed for fun learning and self-expression.',
    icon: <Baby className="w-6 h-6" />,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-400/30 hover:border-amber-400/60',
  },
  {
    role: 'admin',
    label: 'Admin',
    desc: 'System configuration, user management, global dashboards.',
    icon: <Shield className="w-6 h-6" />,
    color: 'from-purple-500/20 to-fuchsia-500/20 border-purple-400/30 hover:border-purple-400/60',
  },
];

// ─── Auth Page ────────────────────────────────────────────────────────────────

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const setUserRole = useCognitiveStore((s) => s.setUserRole);

  // Phase: 'auth' = show login/signup | 'role' = show role selector
  const [phase, setPhase] = useState<'auth' | 'role'>('auth');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Native Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  useEffect(() => {
    // Initial active session check on mount
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        verifyUserRole(session.user.id);
      }
    };
    checkSession();
  }, []);

  const routeUserByRole = (role: UserRole, hasOnboarding: boolean) => {
    // Explicitly trigger a React Router redirect using navigate()
    switch (role) {
      case 'admin':
        navigate('/manager', { replace: true });
        break;
      case 'employee':
        navigate(hasOnboarding ? '/' : '/onboarding', { replace: true });
        break;
      case 'child':
        navigate('/kids/games', { replace: true });
        break;
      case 'parent':
        navigate('/kids/parent', { replace: true });
        break;
      default:
        navigate('/onboarding', { replace: true });
    }
  };

  const verifyUserRole = async (userId: string) => {
    try {
      // 1. Fetch role immediately from the session/metadata/database
      let profile = null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role, cognitive_profile')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.warn('[Auth] user_role select failed. Fallback...', error.message);
        const { data: fallbackData } = await supabase
           .from('profiles')
           .select('cognitive_profile')
           .eq('id', userId)
           .single();
        profile = fallbackData;
      } else {
        profile = data;
      }

      // 2. Fetch onboarding status and populate store
      const hasOnboarding = profile?.cognitive_profile && Object.keys(profile.cognitive_profile).length > 0;
      if (hasOnboarding) {
        useCognitiveStore.getState().setOnboardingComplete(true);
      }
      
      // HACKATHON DEMO MODE: Bypass auto-routing to force role selection every login
      setPendingUserId(userId);
      setPhase('role');
    } catch (err) {
      console.error('[Auth] verifyUserRole failed:', err);
      setAuthMessage({ type: 'error', text: 'Failed to verify user profile.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRoleSubmit = async () => {
    if (!selectedRole || !pendingUserId) return;
    setSaving(true);
    setAuthMessage(null);

    try {
      // Save role selection
      const { error } = await supabase
        .from('profiles')
        .update({ user_role: selectedRole })
        .eq('id', pendingUserId);

      if (error) throw error;

      setUserRole(selectedRole);
      
      // Navigate explicitly after role assignment
      // Use the actual onboarding state from the store rather than hardcoding false
      const hasOnboarding = useCognitiveStore.getState().onboardingComplete;
      routeUserByRole(selectedRole, hasOnboarding);
      
    } catch (err: any) {
      console.error('[Auth] Role save failed:', err.message);
      setAuthMessage({ type: 'error', text: `Failed to save role: ${err.message}` });
      setSaving(false);
    }
  };

  // ── Native Auth Handlers ───────────────────────────────────────────────────

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      // Robust Error Handling for signIn/signUp
      const { data, error } = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      } 
      
      if (authMode === 'signup') {
        setAuthMessage({ type: 'success', text: 'Registration successful! Check your email to confirm if required, or log in.' });
        if (data?.session) {
          // Supabase auto-logged us in, bypass explicit login click
          await verifyUserRole(data.user!.id);
        } else {
          setAuthMode('login');
          setAuthLoading(false);
        }
      } else if (authMode === 'login' && data?.user) {
        // Successful signInWithPassword
        // Explicitly fetch role & trigger redirect
        await verifyUserRole(data.user.id);
      }
    } catch (error: any) {
      // Catch network or invalid credential errors and display in UI
      setAuthMessage({ type: 'error', text: error.message || 'Authentication failed. Please try again.' });
      setAuthLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6 selection:bg-teal-100">
      <AnimatePresence mode="wait">
        {phase === 'auth' ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-light text-slate-800 tracking-tight">NeuroAdaptive OS</h1>
              <p className="text-sm text-slate-500 mt-2 font-medium">Your cognitive environment awaits.</p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMessage && (
                <div className={`p-3 rounded-xl text-sm ${authMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                  {authMessage.text}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-shadow"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-shadow"
                  placeholder="••••••••"
                />
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-sm shadow-teal-500/20"
              >
                {authLoading ? 'Authenticating...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => {
                  setAuthMode(m => m === 'login' ? 'signup' : 'login');
                  setAuthMessage(null);
                }}
                className="text-sm font-medium text-slate-500 hover:text-teal-600 transition-colors"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-lg border border-slate-100"
          >
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Choose Your Role</h2>
              <p className="text-sm text-slate-500 mt-1">This determines which dashboard and features you'll access.</p>
            </div>

            {authMessage && (
               <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200">
                 {authMessage.text}
               </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-8">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.role}
                  onClick={() => setSelectedRole(opt.role)}
                  className={`
                    relative p-4 rounded-2xl border text-left transition-all duration-200
                    bg-gradient-to-br ${opt.color}
                    ${selectedRole === opt.role
                      ? 'ring-2 ring-teal-400 scale-[1.02] shadow-md'
                      : 'opacity-80 hover:opacity-100'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-2 text-slate-700">
                    {opt.icon}
                    <span className="font-semibold text-sm">{opt.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleRoleSubmit}
              disabled={!selectedRole || saving}
              className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed
                text-white font-medium rounded-xl transition-colors text-sm tracking-wide"
            >
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};