import React, { useRef, useEffect, useCallback } from 'react';
import { Dashboard } from './pages/Dashboard';
import { CrisisMode } from './components/crisis/CrisisMode';
import { MaskingTracker } from './components/emotional/MaskingTracker';
import { useCognitiveMonitor } from './hooks/useCognitiveMonitor';

export const App: React.FC = () => {
  // Assuming user authentication is handled and you have a userId
  const mockUserId = "123e4567-e89b-12d3-a456-426614174000";
  
  // Ref for the hidden biometric video element
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Initialize cognitive monitor hook
  const { startBiometrics, stopBiometrics } = useCognitiveMonitor();

  // Optional: Expose biometric controls globally for meeting integrations
  // e.g., window.startMeetingBiometrics = () => startBiometrics(videoRef.current!)
  useEffect(() => {
    // Expose safe, typed methods for external triggers (e.g., calendar/meeting hooks)
    (window as any).neuroAdaptive = {
      startBiometrics: () => videoRef.current && startBiometrics(videoRef.current),
      stopBiometrics: stopBiometrics,
    };

    return () => {
      delete (window as any).neuroAdaptive;
    };
  }, [startBiometrics, stopBiometrics]);

  // Optional auto-start for demo/testing (remove in production)
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     if (videoRef.current) {
  //       startBiometrics(videoRef.current).catch(console.warn);
  //     }
  //   }, 3000);
  //   return () => clearTimeout(timer);
  // }, [startBiometrics]);

  return (
    <>
      {/* Hidden video element for biometric processing (required for face/voice analysis) */}
      <video 
        id="biometric-video-feed" 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted
        style={{ display: 'none' }} 
        aria-hidden="true"
      />

      {/* Global Safety Interceptor */}
      <CrisisMode />
      
      {/* Main Application Routes */}
      <div className="min-h-screen bg-slate-50">
        <Dashboard />
        
        {/* Example placement of the Masking Tracker within a sidebar or grid */}
        <div className="max-w-sm mx-auto p-8">
           <MaskingTracker userId={mockUserId} />
        </div>
      </div>
    </>
  );
};