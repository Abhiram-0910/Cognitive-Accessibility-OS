import { useEffect } from 'react';
import { useCognitiveStore } from '../../stores/cognitiveStore';

export const SensoryEqualizer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadScore = useCognitiveStore((state) => state.cognitiveLoadScore);

  useEffect(() => {
    const body = document.body;
    
    // Base classes for a calming environment
    body.classList.add('bg-slate-50', 'text-slate-800', 'transition-all', 'duration-1000', 'ease-in-out');

    if (loadScore > 80) {
      // Digital Noise-Canceling Mode: Mute colors, soften contrast, disable animations
      body.classList.add('grayscale-[0.5]', 'contrast-[0.90]', 'opacity-95');
      // Adding a global class to target borders in child components if needed
      body.classList.add('sensory-overload-mode'); 
    } else {
      // Restore normal calming state
      body.classList.remove('grayscale-[0.5]', 'contrast-[0.90]', 'opacity-95', 'sensory-overload-mode');
    }

    return () => {
      body.classList.remove('grayscale-[0.5]', 'contrast-[0.90]', 'opacity-95', 'sensory-overload-mode');
    };
  }, [loadScore]);

  return <>{children}</>;
};