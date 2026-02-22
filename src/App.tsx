import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { useCognitiveStore } from './stores/cognitiveStore';

// Pages & Components
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Memory } from './pages/Memory';
import { BodyDoubling } from './pages/BodyDoubling';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { CrisisMode } from './components/crisis/CrisisMode';

// --- AUTH GUARD COMPONENT ---
// Protects routes and ensures onboarding is complete before accessing the OS
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  const checkAuthAndProfile = useCallback(async (currentSession: any) => {
    if (!currentSession) {
      setAuthenticated(false);
      setOnboardingComplete(false);
      setUserId(null);
      setLoading(false);
      // Broadcast logout to extension
      window.postMessage({ type: 'NEUROADAPT_AUTH', status: 'unauthenticated' }, '*');
      return;
    }

    setAuthenticated(true);
    setUserId(currentSession.user.id);

    // Securely tell the content scripts that the user is verified
    window.postMessage({ 
      type: 'NEUROADAPT_AUTH', 
      status: 'authenticated', 
      userId: currentSession.user.id,
    }, '*');

    try {
      // Check if the user has completed onboarding
      const { data: profile } = await supabase
        .from('profiles')
        .select('cognitive_profile')
        .eq('id', currentSession.user.id)
        .single();

      const isComplete = profile?.cognitive_profile && Object.keys(profile.cognitive_profile).length > 0;
      setOnboardingComplete(!!isComplete);
    } catch (error) {
      console.error("[AuthGuard] Session verification failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load check
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndProfile(session);
    });

    // Listen for real-time auth changes gracefully (No window.reload!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      checkAuthAndProfile(session);
    });

    return () => subscription.unsubscribe();
  }, [checkAuthAndProfile]);

  // Calm loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Routing Logic
  if (!authenticated && location.pathname !== '/auth') {
    return <Navigate to="/auth" replace />;
  }

  if (authenticated && !onboardingComplete && location.pathname !== '/onboarding' && location.pathname !== '/auth') {
    return <Navigate to="/onboarding" replace />;
  }

  if (authenticated && onboardingComplete && (location.pathname === '/auth' || location.pathname === '/onboarding')) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { userId });
        }
        return child;
      })}
    </>
  );
};

// --- MAIN ROUTER ---
export default function App() {
  const cognitiveLoadScore = useCognitiveStore((state) => state.cognitiveLoadScore);

  return (
    <Router>
      
      {/* GLOBAL CRISIS MODE TAKEOVER */}
      {/* If the score hits 90, this completely eclipses the UI across all routes */}
      {cognitiveLoadScore >= 90 && <CrisisMode />}

      <AuthGuard>
        <Routes>
          {/* Public / Un-onboarded Routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* Protected OS Routes */}
          <Route path="/" element={<Dashboard userId={session?.user?.id || ''} />} />
          <Route path="/memory" element={<Memory userId="" />} />
          <Route path="/body-doubling" element={<BodyDoubling />} />
          
          {/* B2B Enterprise Route */}
          <Route path="/manager" element={<ManagerDashboard />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </Router>
  );
}