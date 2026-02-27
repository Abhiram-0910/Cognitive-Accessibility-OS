import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';

export const useDemoSimulator = (userId: string | null) => {
  const { updateMetrics } = useCognitiveStore();

  useEffect(() => {
    if (!userId) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Trigger: Ctrl + Shift + D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        console.log("🚀 [GOD MODE] Initializing Hackathon Demo Sequence...");
        
        try {
          // 1. Generate 7 Days of realistic mock cognitive snapshots
          const mockSnapshots = [];
          const now = new Date();
          
          for (let i = 7; i >= 0; i--) {
            for (let hour = 9; hour <= 17; hour += 2) {
              const timestamp = new Date(now);
              timestamp.setDate(now.getDate() - i);
              timestamp.setHours(hour, 0, 0, 0);

              // Simulate a realistic workday curve (higher load mid-day)
              let baseLoad = hour === 9 ? 30 : hour === 13 ? 85 : hour === 17 ? 60 : 50;
              // Add randomness
              const randomizedLoad = Math.min(100, Math.max(0, baseLoad + (Math.random() * 20 - 10)));
              
              let classification = 'normal';
              if (randomizedLoad <= 25) classification = 'hyperfocus';
              else if (randomizedLoad > 65 && randomizedLoad <= 80) classification = 'approaching_overload';
              else if (randomizedLoad > 80) classification = 'overload';

              mockSnapshots.push({
                user_id: userId,
                score: Math.round(randomizedLoad),
                classification,
                created_at: timestamp.toISOString(),
              });
            }
          }

          // 2. Try to bulk insert into Supabase — but don't crash if the table doesn't exist.
          // The cognitive_snapshots table is optional; the demo still works via the
          // real-time Zustand store spike below even without it.
          const { error } = await supabase.from('cognitive_snapshots').insert(mockSnapshots);
          if (error) {
            console.warn('[Demo Simulator] DB insert skipped (table may not exist):', error.message);
          }

          // 3. Immediately spike the real-time store to trigger the 'Approaching Overload' UI
          updateMetrics({
            keystrokesPerMinute: 140,
            errorRate: 0.15,
            pauseFrequency: 8,
            contextSwitches: 12,
            facialTension: 85,
            gazeWander: 60,
          }, 82, 'approaching_overload');

          alert("✅ Demo Mode Activated: 7 days of telemetry injected. Charts will now populate.");
          // Soft reload to fetch the new database entries into the Recharts components
          window.dispatchEvent(new Event('neuro_demo_injected')); 

        } catch (err) {
          console.error("[Demo Simulator] Injection failed:", err);
          alert("❌ Demo injection failed. Check console.");
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userId, updateMetrics]);
};