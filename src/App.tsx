import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

// Pages
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Memory } from './pages/Memory';
import { BodyDoubling } from './pages/BodyDoubling';
import { ManagerDashboard } from './pages/ManagerDashboard';

// --- AUTH GUARD COMPONENT ---
// Protects routes and ensures onboarding is complete before accessing the OS
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setAuthenticated(false);
          setUserId(null);
          setLoading(false);
          
          // Broadcast logout to extension
          window.postMessage({ type: 'NEUROADAPT_AUTH', status: 'unauthenticated' }, '*');
          return;
        }

        setAuthenticated(true);
        const currentUserId = session.user.id;
        setUserId(currentUserId);

        // --- THE EXTENSION BRIDGE ---
        // Securely tell the content scripts that the user is verified and they can begin intercepting Jira/Slack
        window.postMessage({ 
          type: 'NEUROADAPT_AUTH', 
          status: 'authenticated', 
          userId: currentUserId,
        }, '*');

        // Check if the user has completed onboarding by checking their profile data
        const { data: profile } = await supabase
          .from('profiles')
          .select('cognitive_profile')
          .eq('id', currentUserId)
          .single();

        // If the JSONB column has keys, we consider onboarding complete
        const isComplete = profile?.cognitive_profile && Object.keys(profile.cognitive_profile).length > 0;
        setOnboardingComplete(!!isComplete);
      } catch (error) {
        console.error("[AuthGuard] Session verification failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndProfile();

    // Listen for real-time auth changes (e.g., login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setAuthenticated(false);
        setUserId(null);
        
        // Broadcast logout to extension
        window.postMessage({ type: 'NEUROADAPT_AUTH', status: 'unauthenticated' }, '*');
      } else {
        setAuthenticated(true);
        const currentUserId = session.user.id;
        setUserId(currentUserId);
        
        // Broadcast login to extension
        window.postMessage({ 
          type: 'NEUROADAPT_AUTH', 
          status: 'authenticated', 
          userId: currentUserId,
        }, '*');
        
        // Soft reload to re-verify onboarding status on new logins
        if (event === 'SIGNED_IN') window.location.reload(); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Calm loading state while verifying credentials
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

  // Prevent authenticated users from going back to login/onboarding unnecessarily
  if (authenticated && onboardingComplete && (location.pathname === '/auth' || location.pathname === '/onboarding')) {
    return <Navigate to="/" replace />;
  }

  // Pass userId to children if needed via cloning, or let components fetch it themselves
  // For this architecture, components like <Memory /> can receive it directly.
  return (
    <>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          // Inject userId into routes that explicitly require it (like Memory)
          return React.cloneElement(child as React.ReactElement<any>, { userId });
        }
        return child;
      })}
    </>
  );
};

// --- MAIN ROUTER ---
export default function App() {
  return (
    <Router>
      <AuthGuard>
        <Routes>
          {/* Public / Un-onboarded Routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* Protected OS Routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/memory" element={<Memory userId="" />} /> {/* userId injected by AuthGuard */}
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