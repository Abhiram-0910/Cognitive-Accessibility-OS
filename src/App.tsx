import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { useCognitiveStore } from './stores/cognitiveStore';

// Pages & Components (Removed .tsx extensions)
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Memory } from './pages/Memory';
import { BodyDoubling } from './pages/BodyDoubling';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { CrisisMode } from './components/crisis/CrisisMode';

// --- RENDER PROP AUTH GUARD ---
// Safely manages state and injects the session down to the router
interface AuthGuardProps {
  children: (session: any, onboardingComplete: boolean) => React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const checkAuthAndProfile = useCallback(async (currentSession: any) => {
    if (!currentSession) {
      setSession(null);
      setOnboardingComplete(false);
      setLoading(false);
      window.postMessage({ type: 'NEUROADAPT_AUTH', status: 'unauthenticated' }, '*');
      return;
    }

    setSession(currentSession);
    window.postMessage({ 
      type: 'NEUROADAPT_AUTH', 
      status: 'authenticated', 
      userId: currentSession.user.id,
    }, '*');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cognitive_profile')
        .eq('id', currentSession.user.id)
        .single();

      const isComplete = profile?.cognitive_profile && Object.keys(profile.cognitive_profile).length > 0;
      setOnboardingComplete(!!isComplete);
    } catch (error) {
      console.error("[AuthGuard] Profile check failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial Load
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndProfile(session);
    });

    // Subscriptions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // 🛑 THE SOFT KICK-OUT FIX
      if (event === 'SIGNED_OUT') {
        alert("⚠️ Session expired. Please save your work and refresh the page to log in again.");
        return; // Halt execution. Do NOT update state or kick them out of the current route.
      }
      
      // Quietly update tokens in the background without triggering loading screens
      if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        return;
      }

      setLoading(true);
      checkAuthAndProfile(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [checkAuthAndProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Pass state safely to children
  return <>{children(session, onboardingComplete)}</>;
};

// --- MAIN ROUTER ---
export default function App() {
  const cognitiveLoadScore = useCognitiveStore((state) => state.cognitiveLoadScore);

  return (
    <Router>
      {/* Global Crisis Mode Takeover */}
      {cognitiveLoadScore >= 90 && <CrisisMode />}

      <AuthGuard>
        {(session, onboardingComplete) => (
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" replace />} />
            
            {/* Onboarding Route */}
            <Route path="/onboarding" element={
              session ? (!onboardingComplete ? <Onboarding /> : <Navigate to="/" replace />) : <Navigate to="/auth" replace />
            } />

            {/* Protected OS Routes */}
            <Route path="/" element={
              session ? (onboardingComplete ? <Dashboard userId={session.user.id} /> : <Navigate to="/onboarding" replace />) : <Navigate to="/auth" replace />
            } />
            
            <Route path="/memory" element={
              session ? (onboardingComplete ? <Memory userId={session.user.id} /> : <Navigate to="/onboarding" replace />) : <Navigate to="/auth" replace />
            } />
            
            <Route path="/body-doubling" element={
              session ? (onboardingComplete ? <BodyDoubling /> : <Navigate to="/onboarding" replace />) : <Navigate to="/auth" replace />
            } />
            
            <Route path="/manager" element={
              session ? <ManagerDashboard /> : <Navigate to="/auth" replace />
            } />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </AuthGuard>
    </Router>
  );
}