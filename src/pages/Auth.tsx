import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Check if onboarding is complete
        checkOnboardingStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkOnboardingStatus = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('cognitive_preferences')
      .eq('id', userId)
      .single();

    // If preferences are empty or missing, route to onboarding
    if (!data || Object.keys(data.cognitive_preferences || {}).length === 0) {
      navigate('/onboarding');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 selection:bg-teal-100">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-slate-800 tracking-tight">NeuroAdaptive OS</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Your cognitive environment awaits.</p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#14B8A6', // Teal-500
                  brandAccent: '#0D9488', // Teal-600
                },
                radii: {
                  borderRadiusButton: '0.75rem',
                  buttonBorderRadius: '0.75rem',
                  inputBorderRadius: '0.75rem',
                }
              },
            },
            className: {
              button: 'font-medium tracking-wide',
              input: 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-teal-500',
            }
          }}
          providers={['github', 'google']}
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  );
};