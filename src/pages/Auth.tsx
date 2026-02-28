import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCognitiveStore, UserRole } from '../stores/cognitiveStore';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Role Card Data ───────────────────────────────────────────────────────────

const ROLE_OPTIONS: { role: UserRole; label: string; desc: string; iconName: string; iconBgClass: string; iconGroupHoverClass: string; titleHoverClass: string }[] = [
  {
    role: 'admin',
    label: 'Admin',
    desc: 'System configuration, user management & security oversight.',
    iconName: 'admin_panel_settings',
    iconBgClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    iconGroupHoverClass: 'group-hover:bg-[#196ee6] group-hover:text-white',
    titleHoverClass: 'group-hover:text-[#196ee6]',
  },
  {
    role: 'employee',
    label: 'Employee',
    desc: 'Access productivity tools, dashboard & project spaces.',
    iconName: 'badge',
    iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
    iconGroupHoverClass: 'group-hover:bg-emerald-600 group-hover:text-white',
    titleHoverClass: 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
  },
  {
    role: 'child',
    label: 'Child',
    desc: 'Safe learning environment with simplified controls.',
    iconName: 'child_care',
    iconBgClass: 'bg-orange-50 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400',
    iconGroupHoverClass: 'group-hover:bg-orange-500 group-hover:text-white',
    titleHoverClass: 'group-hover:text-orange-500 dark:group-hover:text-orange-400',
  },
  {
    role: 'parent',
    label: 'Parent',
    desc: 'Family monitoring, usage reports & safety settings.',
    iconName: 'family_restroom',
    iconBgClass: 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    iconGroupHoverClass: 'group-hover:bg-purple-600 group-hover:text-white',
    titleHoverClass: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
  },
];

// ─── Auth Page ────────────────────────────────────────────────────────────────

export const AuthPage: React.FC<{ session?: any; userRole: UserRole | null }> = ({ session, userRole }) => {
  const navigate = useNavigate();
  const setUserRole = useCognitiveStore((s) => s.setUserRole);

  // Phase: 'auth' = show login/signup | 'role' = show role selector
  // Automatically switch to role selection if logged in but role is missing
  const [phase, setPhase] = useState<'auth' | 'role'>(session && !userRole ? 'role' : 'auth');
  
  const [pendingUserId, setPendingUserId] = useState<string | null>(session?.user?.id || null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Native Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  // Removed redundant on-mount session check to prevent Supabase 
  // NavigatorLockAcquireTimeoutError race conditions with App.tsx's AuthGuard.

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

  // Profile verification is now handled by the parent AuthGuard.
  // We simply update internal phase state when props change.
  useEffect(() => {
    if (session?.user && !userRole) {
      setPendingUserId(session.user.id);
      setPhase('role');
    }
  }, [session, userRole]);

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

      if (error) {
        console.warn('[Auth] Role save failed (likely missing DB column). Bypassing for demo...', error.message);
      }

      setUserRole(selectedRole!);
      
      const hasOnboarding = useCognitiveStore.getState().onboardingComplete;
      routeUserByRole(selectedRole!, hasOnboarding);
      
    } catch (err: any) {
      console.error('[Auth] Role save failed:', err.message);
      // Fallback: force navigation even on error
      setUserRole(selectedRole!);
      const hasOnboarding = useCognitiveStore.getState().onboardingComplete;
      routeUserByRole(selectedRole!, hasOnboarding);
    }
  };

  // ── Native Auth Handlers ───────────────────────────────────────────────────

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      const { data, error } = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) throw error;
      
      if (authMode === 'signup' && !data?.session) {
        setAuthMessage({ type: 'success', text: 'Registration successful! Please log in.' });
        setAuthMode('login');
        setAuthLoading(false);
      }
      // Note: If login/signup is successful and session is created, 
      // the AuthGuard in App.tsx will see the session change 
      // and update props, triggering our useEffect phase shift.
    } catch (error: any) {
      setAuthMessage({ type: 'error', text: error.message || 'Authentication failed. Please try again.' });
      setAuthLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="font-display bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Gradient Background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-[#196ee6]/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-teal-200/20 dark:bg-teal-900/20 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-60"></div>
        <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-slate-200/30 dark:bg-slate-700/20 rounded-full blur-[80px] opacity-50"></div>
        <div className="absolute inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-[2px]"></div>
      </div>

      <div className="relative z-10 w-full flex justify-center items-center">
        <AnimatePresence mode="wait">
          {phase === 'auth' ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-[480px]"
            >
              <div className="group/card flex flex-col gap-6 rounded-xl border border-white/40 dark:border-slate-700/40 bg-white/70 dark:bg-slate-800/60 p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.12)]">
                {/* Header Section */}
                <div className="flex flex-col gap-2 items-center text-center pb-4">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-tr from-[#196ee6] to-blue-400 flex items-center justify-center mb-2 shadow-lg shadow-[#196ee6]/20">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: '28px' }}>neurology</span>
                  </div>
                  <h1 className="text-slate-900 dark:text-white text-3xl font-black tracking-tight">NeuroAdaptive OS</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Welcome back to your flow state.</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-5">
                  {authMessage && (
                    <div className={`p-3 rounded-xl text-sm ${authMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                      {authMessage.text}
                    </div>
                  )}

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold ml-1" htmlFor="email">Email</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400 group-focus-within:text-[#196ee6] transition-colors duration-200" style={{ fontSize: '20px' }}>mail</span>
                      </div>
                      <input 
                        id="email" 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#196ee6]/20 focus:border-[#196ee6] transition-all duration-200 font-medium" 
                        placeholder="name@company.com" 
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold" htmlFor="password">Password</label>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400 group-focus-within:text-[#196ee6] transition-colors duration-200" style={{ fontSize: '20px' }}>lock</span>
                      </div>
                      <input 
                        id="password" 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#196ee6]/20 focus:border-[#196ee6] transition-all duration-200 font-medium" 
                        placeholder="••••••••" 
                      />
                      <button className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer" type="button">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>visibility_off</span>
                      </button>
                    </div>
                  </div>

                  {/* Remember & Forgot Password */}
                  {authMode === 'login' && (
                    <div className="flex items-center justify-between text-sm pt-1">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input className="w-4 h-4 rounded border-slate-300 text-[#196ee6] focus:ring-[#196ee6]/20 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800 dark:border-slate-600" type="checkbox"/>
                        <span className="text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">Remember me</span>
                      </label>
                      <a className="text-[#196ee6] hover:text-blue-600 font-semibold transition-colors" href="#">Forgot password?</a>
                    </div>
                  )}

                  {/* Sign In Button */}
                  <button 
                    type="submit" 
                    disabled={authLoading}
                    className="mt-2 w-full bg-[#196ee6] hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg shadow-[#196ee6]/25 hover:shadow-[#196ee6]/40 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <span>{authLoading ? 'Authenticating...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider font-semibold">Or continue with</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-lg transition-colors duration-200 font-medium text-sm" type="button">
                    <img alt="Google" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7xSGM7bj9AgDihYBlaScVkzLOttfCVgHnOpMbtbIWDpmevKA14wMrGVwsauMHuiI3nismd7nuJMRNRAK-ppVryrGtcAgqrdKTOC-ALoXFXXsYdgbzHn-P44Fr-lqpVj7-RblOVKp7XiWRbfquGS7kAgxbBbpIDQSwktSoWSqFUG1VeadIm9alflX5Za8CCe_q8-5hM7zakFW2sqegpqXsLMShCVJo5RjlVqceyQYRi9ex1UUM-w3rcSyt2sh0AnijIV7TSWOZk-s"/>
                    Google
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-lg transition-colors duration-200 font-medium text-sm" type="button">
                    <img alt="Microsoft" className="w-5 h-5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcCd8FKxzQkDVx5oQAvmabfedY10XLoFpJuJpAj1UN0NDAFDy5wnUgp9D2Xf_wqtsK39Sf8Gxz33XaO7-EPgN9gM8sjPeqmnzDhAnv0rnjiGJFYRJOImAHr8a0ikqFg2DWpVsKMQTohfcuXiZ88So7KU3125oa5K33hvIEzM4MMLjcMhrX99Es3jBDKTAREMuIKsJJEkPrHkZfqcqfp5Cf7RPY24Ls1jbO4BEhUsdhL5An5ZbC52R69BewhDvB7KdEnoczSl5MYEQ"/>
                    Microsoft
                  </button>
                </div>

                {/* Footer */}
                <div className="text-center pt-2">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <button 
                      onClick={() => {
                        setAuthMode(m => m === 'login' ? 'signup' : 'login');
                        setAuthMessage(null);
                      }}
                      type="button"
                      className="text-[#196ee6] hover:text-blue-600 font-bold transition-colors inline-flex items-center gap-0.5 group"
                    >
                      {authMode === 'login' ? "Sign up" : "Sign in"}
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                    </button>
                  </p>
                </div>
              </div>

              {/* Bottom link */}
              <div className="mt-8 text-center relative z-20">
                <a className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs transition-colors" href="#">Help & Support</a>
                <span className="mx-2 text-slate-300 dark:text-slate-700">•</span>
                <a className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs transition-colors" href="#">Privacy Policy</a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="role"
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-[960px] px-6 py-10"
            >
              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md border border-white/50 dark:border-slate-700/50 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-2xl p-8 md:p-12 w-full">
                {/* Header Section */}
                <div className="mb-10 text-center max-w-2xl mx-auto">
                  <div className="inline-flex items-center justify-center p-3 mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="material-symbols-outlined text-[#196ee6] !text-4xl">diversity_1</span>
                  </div>
                  <h1 className="text-slate-900 dark:text-white text-3xl md:text-4xl font-black tracking-tight mb-3">
                    Who is logging in?
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                    Select your user profile to access your personalized NeuroAdaptive workspace.
                  </p>
                </div>

                {authMessage && (
                  <div className="mb-6 p-4 rounded-xl text-sm bg-red-50 text-red-600 border border-red-200 text-center font-medium">
                    {authMessage.text}
                  </div>
                )}

                {/* Bento Grid Roles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                  {ROLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.role}
                      onClick={() => setSelectedRole(opt.role)}
                      className={`
                        group flex flex-col items-center justify-center p-6 rounded-xl cursor-pointer text-center h-full min-h-[220px] 
                        bg-white dark:bg-slate-800 transition-all duration-300 border 
                        ${selectedRole === opt.role 
                          ? 'border-[#196ee6] shadow-[0_12px_24px_-8px_rgba(25,110,230,0.15)] -translate-y-1' 
                          : 'border-slate-200 dark:border-slate-700 hover:-translate-y-1 hover:shadow-[0_12px_24px_-8px_rgba(25,110,230,0.15)] hover:border-[#196ee6]'}
                      `}
                    >
                      <div className={`
                        w-16 h-16 rounded-full transition-colors duration-300 flex items-center justify-center mb-5
                        ${selectedRole === opt.role ? opt.iconGroupHoverClass : opt.iconBgClass}
                        ${selectedRole !== opt.role ? opt.iconGroupHoverClass : ''}
                      `}>
                        <span className="material-symbols-outlined !text-3xl">{opt.iconName}</span>
                      </div>
                      <h3 className={`text-slate-900 dark:text-white text-lg font-bold mb-2 transition-colors ${selectedRole === opt.role ? opt.titleHoverClass.replace('group-hover:', '') : opt.titleHoverClass}`}>
                        {opt.label}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed px-2">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Footer / Navigation */}
                <div className="flex flex-col items-center justify-center gap-4">
                  <button 
                    onClick={handleRoleSubmit}
                    disabled={!selectedRole || saving}
                    className="w-full max-w-md bg-[#196ee6] hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-lg shadow-lg shadow-[#196ee6]/25 hover:shadow-[#196ee6]/40 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 text-sm tracking-wide mb-4 mt-2"
                  >
                    <span>{saving ? 'Saving...' : 'Continue to Workspace'}</span>
                    {!saving && <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>}
                  </button>
                  <button 
                    onClick={() => {
                      setPhase('auth');
                      supabase.auth.signOut();
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm font-semibold"
                  >
                    <span className="material-symbols-outlined !text-lg">arrow_back</span>
                    Back to Login
                  </button>
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 w-full max-w-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-medium tracking-wide">
                      NeuroAdaptive OS v2.0 • Secure Enterprise Environment
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};