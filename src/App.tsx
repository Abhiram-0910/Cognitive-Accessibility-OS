import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { useCognitiveStore, UserRole } from './stores/cognitiveStore';

// Pages & Components
import { AuthPage as Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Memory } from './pages/Memory';
import { BodyDoubling } from './pages/BodyDoubling';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { CrisisMode } from './components/crisis/CrisisMode';
import { Unauthorized } from './pages/Unauthorized';

// Kids Module
import ParentDashboard from './pages/ParentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import GameSelection from './components/kids-module/GameSelection';
import Game from './components/kids-module/Game';
import GameTwo from './components/kids-module/GameTwo';

// ─── Role-Based Route Guard ──────────────────────────────────────────────────

/**
 * RoleGuard — wraps a route to enforce RBAC.
 * If the user's role is NOT in the `allowed` array, redirect to /unauthorized.
 */
const RoleGuard: React.FC<{
  userRole: UserRole | null;
  allowed: UserRole[];
  children: React.ReactNode;
}> = ({ userRole, allowed, children }) => {
  if (!userRole || !allowed.includes(userRole)) {
    console.warn(`[RBAC] Blocked: role "${userRole}" attempted to access route restricted to [${allowed.join(', ')}]`);
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
};

// ─── Auth Guard ──────────────────────────────────────────────────────────────

interface AuthGuardProps {
  children: (session: any, onboardingComplete: boolean, userRole: UserRole | null) => React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const storeOnboardingComplete = useCognitiveStore(s => s.onboardingComplete);
  const setStoreOnboardingComplete = useCognitiveStore(s => s.setOnboardingComplete);
  const userRole = useCognitiveStore(s => s.userRole);
  const setUserRole = useCognitiveStore(s => s.setUserRole);

  const isOnboardingComplete = onboardingComplete || storeOnboardingComplete;

  const stopLoopRef = React.useRef(false);

  const checkAuthAndProfile = useCallback(async (currentSession: any) => {
    if (stopLoopRef.current) return;
    stopLoopRef.current = true; // Prevent rapid re-firing
    
    // REMOVED: setLoading(true) to prevent destroying the <Router> mid-session!

    if (!currentSession) {
      setSession(null);
      setOnboardingComplete(false);
      setUserRole(null);
      setLoading(false);
      window.postMessage({ type: 'NEUROADAPT_AUTH', status: 'unauthenticated' }, '*');
      setTimeout(() => { stopLoopRef.current = false; }, 2000); // Release lock
      return;
    }

    setSession(currentSession);
    window.postMessage({
      type: 'NEUROADAPT_AUTH',
      status: 'authenticated',
      userId: currentSession.user.id,
    }, '*');

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('cognitive_profile, user_role')
        .eq('id', currentSession.user.id)
        .single();
      
      let finalProfile: any = profile;

      if (error) {
        // If the user_role column doesn't exist, it throws a 400 error.
        console.warn("[AuthGuard] Profile check failed, attempting fallback:", error.message);
        const { data: fallbackData } = await supabase
          .from('profiles')
          .select('cognitive_profile')
          .eq('id', currentSession.user.id)
          .single();
        finalProfile = fallbackData;
      }

      const isComplete = finalProfile?.cognitive_profile && Object.keys(finalProfile.cognitive_profile).length > 0;
      setOnboardingComplete(!!isComplete);
      setStoreOnboardingComplete(!!isComplete);

      // Sync role from DB into Zustand
      if (finalProfile?.user_role) {
        setUserRole(finalProfile.user_role as UserRole);
      }
    } catch (error) {
      console.error("[AuthGuard] Profile check crashed:", error);
    } finally {
      setLoading(false);
      // Allow re-checking after 2 seconds to prevent rapid loop
      setTimeout(() => { stopLoopRef.current = false; }, 2000);
    }
  }, [setStoreOnboardingComplete, setUserRole]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAuthAndProfile(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        alert("⚠️ Session expired. Please save your work and refresh the page to log in again.");
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession);
        return;
      }

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

  return <>{children(session, isOnboardingComplete, userRole)}</>;
};

// ─── Role-Aware Home Redirect ─────────────────────────────────────────────────

/**
 * Redirects authenticated users to the correct home dashboard based on their role.
 */
const RoleHomeRedirect: React.FC<{
  userRole: UserRole | null;
  onboardingComplete: boolean;
  userId: string;
}> = ({ userRole, onboardingComplete, userId }) => {
  switch (userRole) {
    case 'admin':
      return <ManagerDashboard />;
    case 'employee':
      return onboardingComplete ? <Dashboard userId={userId} /> : <Navigate to="/onboarding" replace />;
    case 'child':
      return <Navigate to="/kids/games" replace />;
    case 'parent':
      return <Navigate to="/kids/parent" replace />;
    default:
      return <Navigate to="/auth" replace />;
  }
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const cognitiveLoadScore = useCognitiveStore((state) => state.cognitiveLoadScore);

  return (
    <Router>
      {/* Global Crisis Mode Takeover */}
      {cognitiveLoadScore >= 90 && <CrisisMode />}

      <AuthGuard>
        {(session, onboardingComplete, userRole) => (
          <Routes>
            {/* ── Public Routes ────────────────────────────────────────── */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* ── Onboarding (Employee/Admin only) ─────────────────────── */}
            <Route path="/onboarding" element={
              session ? (
                !userRole ? <Navigate to="/auth" replace /> :
                (!onboardingComplete ? <Onboarding /> : <Navigate to="/" replace />)
              ) : <Navigate to="/auth" replace />
            } />

            {/* ── Home Route (Role-aware redirect) ──────────────────── */}
            <Route path="/" element={
              session
                ? (userRole ? <RoleHomeRedirect userRole={userRole} onboardingComplete={onboardingComplete} userId={session.user.id} /> : <Navigate to="/auth" replace />)
                : <Navigate to="/auth" replace />
            } />

            {/* ── Employee/Admin Routes ────────────────────────────── */}
            <Route path="/dashboard" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['employee', 'admin']}>
                  {onboardingComplete ? <Dashboard userId={session.user.id} /> : <Navigate to="/onboarding" replace />}
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/memory" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['employee', 'admin']}>
                  {onboardingComplete ? <Memory userId={session.user.id} /> : <Navigate to="/onboarding" replace />}
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/body-doubling" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['employee', 'admin']}>
                  {onboardingComplete ? <BodyDoubling /> : <Navigate to="/onboarding" replace />}
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            {/* ── Admin-Only Routes ───────────────────────────────── */}
            <Route path="/manager" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['admin']}>
                  <ManagerDashboard />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            {/* ── Kids Module Routes (Parent, Child, Teacher, Admin) ─ */}
            <Route path="/kids/parent" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['parent', 'admin']}>
                  <ParentDashboard />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/kids/teacher" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['parent', 'admin']}>
                  <TeacherDashboard />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/kids/games" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['child', 'parent', 'admin']}>
                  <GameSelection />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/kids/play/1" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['child', 'parent', 'admin']}>
                  <Game />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            <Route path="/kids/play/2" element={
              session ? (
                <RoleGuard userRole={userRole} allowed={['child', 'parent', 'admin']}>
                  <GameTwo />
                </RoleGuard>
              ) : <Navigate to="/auth" replace />
            } />

            {/* ── Fallback ────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </AuthGuard>
    </Router>
  );
}