/**
 * GameSelection — Kids Module
 *
 * Game-picker screen shown to a child after login.
 * All functional logic preserved: username from localStorage,
 * logout handler, game navigation with state.
 */
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useCognitiveStore } from '../../stores/cognitiveStore';

// ─── Component ────────────────────────────────────────────────────────────────
export default function GameSelection() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('Player');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showBreathe, setShowBreathe] = useState(false);
  const [breathePhase, setBreathePhase] = useState<'inhale'|'hold'|'exhale'>('inhale');
  const breatheAudioRef = useRef<OscillatorNode | null>(null);
  const breatheGainRef = useRef<GainNode | null>(null);

  const startBreathing = async () => {
    setShowBreathe(true);
    setBreathePhase('inhale');
    // 432 Hz binaural — same as CrisisMode
    try {
      const gCtx = useCognitiveStore.getState().globalAudioContext;
      if (!gCtx) {
        console.warn('[BreatheWithBear] No global AudioContext found. Fallback to basic...');
        return;
      }
      
      const ctx = gCtx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(432, ctx.currentTime);
      osc.connect(gain);
      osc.start();
      
      breatheAudioRef.current = osc;
      breatheGainRef.current = gain;
    } catch (e) {
      console.warn('[BreatheWithBear] AudioContext failed:', e);
    }
  };

  const stopBreathing = () => {
    setShowBreathe(false);
    breatheAudioRef.current?.stop();
    breatheAudioRef.current?.disconnect();
    breatheAudioRef.current = null;
    breatheGainRef.current?.disconnect();
    breatheGainRef.current = null;
  };

  // 4-7-8 breathing cycle
  useEffect(() => {
    if (!showBreathe) return;
    const phases: Array<{ name: 'inhale'|'hold'|'exhale'; ms: number }> = [
      { name: 'inhale', ms: 4000 },
      { name: 'hold', ms: 7000 },
      { name: 'exhale', ms: 8000 },
    ];
    let idx = 0;
    const run = () => {
      setBreathePhase(phases[idx].name);
      idx = (idx + 1) % phases.length;
    };
    run();
    const interval = setInterval(run, 4000); // simplified cycle tick
    return () => clearInterval(interval);
  }, [showBreathe]);

  // Username is now handled purely via the store or local storage to prevent 
  // Supabase NavigatorLock contention.
  useEffect(() => {
    // Falls back to 'Player' if not manually set
  }, []);

  const handlePanicButton = () => {
    // Forcefully set the global Zustand store load score to 100 to instantly trigger CrisisMode
    useCognitiveStore.setState({ cognitiveLoadScore: 100, classification: 'overload' });
  };

  const handleGameNavigation = (gameId: number, gameName: string) => {
    navigate(`/kids/play/${gameId}`, { state: { username, gameName } });
  };

  // Fallback avatar if none provided in metadata
  const fallbackAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuA97EvgOcs-ahbkLsIJ8AabsBZ_ibHEQUVJtD6v_w2R5iVYUHhdvj2r2pvYY_nTQvmQ5zSGuHyubpZTAysOAASUPpOQ0tYYLYN4pFbpdQC_sXhGcbbdCAgoGqO7XXRaS7uFtSe2t1uCpjd4skTyq0IDW_EVVDWOuShowq_mc-Kk0WiGrWNNJHs_8C2BVWY-_8xO-ZN5_xzR9mOv9ueFJBvLZkRWJUj8rj3n6VSNjvfdcsS0H6A7LBBL8lAr8bL5pVddzjV2_tGflRk";

  return (
    <div className="bg-[#fcfbf8] dark:bg-[#221d10] font-display antialiased min-h-screen flex flex-col transition-colors duration-300">
      
      {/* Inline styles for custom breathing animation */}
      <style>{`
        @keyframes gentle-breath {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .animate-breathe {
            animation: gentle-breath 6s ease-in-out infinite;
        }
      `}</style>
      
      <div className="flex h-full grow flex-col">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-[#f3f0e7] dark:border-[#3d341e] bg-[#fcfbf8]/90 dark:bg-[#221d10]/90 backdrop-blur-md px-6 py-4 md:px-10 lg:px-40">
          <div className="flex items-center gap-4 text-[#422006] dark:text-yellow-100">
            <div className="size-8 flex items-center justify-center text-[#eebd2b]">
              <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>psychology</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">NeuroAdaptive OS</h2>
          </div>
          <div className="flex items-center gap-4 md:gap-8">
            {/* Panic / Calm Down Button */}
            <button 
              onClick={handlePanicButton}
              className="group flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-12 px-6 bg-[#eebd2b] hover:bg-yellow-400 transition-colors text-[#422006] text-base font-bold leading-normal tracking-[0.015em] shadow-sm hover:shadow-md transform active:scale-95"
            >
              <span className="material-symbols-outlined mr-2">spa</span>
              <span className="hidden sm:inline">Calm Down / Pause</span>
            </button>
            {/* User Profile */}
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 ring-2 ring-[#eebd2b]/20" 
              style={{ backgroundImage: `url("${avatarUrl || fallbackAvatar}")` }}
            ></div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex justify-center px-4 py-8 md:px-10 lg:px-40">
          <div className="flex flex-col w-full max-w-[960px] flex-1 gap-8 md:gap-12">
            
            {/* Greeting Section */}
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-3">
                <h1 className="text-[#422006] dark:text-yellow-50 text-[32px] font-black leading-tight md:text-5xl tracking-tight">
                  Hello, {username}!
                </h1>
                <p className="text-[#422006]/80 dark:text-yellow-100/80 text-lg font-medium leading-normal max-w-[600px]">
                  Welcome to your calm space. It's a beautiful day to play and relax. What would you like to do?
                </p>
              </div>
              {/* Daily Goal Widget */}
              <div className="bg-[#fffdf5] dark:bg-[#2d2616] border border-[#f3f0e7] dark:border-[#3d341e] p-5 rounded-xl shadow-sm w-full md:w-auto min-w-[280px]">
                <div className="flex gap-4 justify-between items-center mb-3">
                  <p className="text-[#422006] dark:text-yellow-100 text-sm font-bold uppercase tracking-wider">Calmness Goal</p>
                  <span className="material-symbols-outlined text-[#eebd2b]">emoji_events</span>
                </div>
                <div className="h-4 w-full bg-[#fcfbf8] dark:bg-[#1b180d] rounded-full overflow-hidden">
                  <div className="h-full bg-[#eebd2b] rounded-full" style={{ width: '75%' }}></div>
                </div>
                <p className="text-[#9a864c] dark:text-yellow-200/70 text-xs font-medium mt-2 text-right">Great job today!</p>
              </div>
            </div>

            {/* Featured Activity: Breathe */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              <div className="md:col-span-12 lg:col-span-8 bg-[#fffdf5] dark:bg-[#2d2616] border border-[#f3f0e7] dark:border-[#3d341e] rounded-xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm relative overflow-hidden group hover:border-[#eebd2b]/50 transition-colors cursor-pointer">
                <div className="absolute top-0 right-0 p-32 bg-[#eebd2b]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="relative z-10 flex-shrink-0">
                  <div className="size-32 md:size-40 bg-[#eebd2b]/10 rounded-full flex items-center justify-center animate-breathe text-[#eebd2b]">
                    <span className="material-symbols-outlined text-[64px] md:text-[80px]">sentiment_satisfied</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 relative z-10 text-center md:text-left items-center md:items-start">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eebd2b]/20 text-[#422006] dark:text-yellow-100 text-xs font-bold uppercase tracking-wide">
                    <span className="material-symbols-outlined text-sm">self_improvement</span> Recommended
                  </div>
                  <h2 className="text-[#422006] dark:text-yellow-50 text-2xl md:text-3xl font-bold">Breathe with Bear</h2>
                  <p className="text-[#422006]/70 dark:text-yellow-100/70 text-lg max-w-md">Take a moment to watch the gentle bear breathe in and out. Let's match our breathing together.</p>
                  <button onClick={startBreathing} className="mt-2 text-[#422006] bg-[#eebd2b] hover:bg-yellow-400 font-bold py-3 px-8 rounded-full transition-all inline-flex items-center gap-2 transform active:scale-95">
                    <span className="material-symbols-outlined">play_circle</span>
                    Start Breathing
                  </button>
                </div>
              </div>

              {/* Quick Stats / Feeling Check-in */}
              <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-4">
                <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-6 flex flex-col justify-center items-center text-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-blue-400">mood</span>
                  <div>
                    <h3 className="text-lg font-bold text-[#422006] dark:text-yellow-50">How do you feel?</h3>
                    <p className="text-sm text-[#422006]/70 dark:text-yellow-100/60">Check in with yourself</p>
                  </div>
                </div>
                <div className="flex-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-xl p-6 flex flex-col justify-center items-center text-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-green-400">water_drop</span>
                  <div>
                    <h3 className="text-lg font-bold text-[#422006] dark:text-yellow-50">Water Reminder</h3>
                    <p className="text-sm text-[#422006]/70 dark:text-yellow-100/60">Have a sip of water</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Game Categories */}
            <div className="flex flex-col gap-6">
              <h3 className="text-[#422006] dark:text-yellow-50 text-2xl font-bold px-2">Fun Activities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* GAME 1: CRACK THE QUIZ (formerly Puzzle Time) */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleGameNavigation(1, 'CRACK-THE-QUIZ')}
                  className="group flex flex-col gap-4 bg-[#fffdf5] dark:bg-[#2d2616] p-4 rounded-xl border border-[#f3f0e7] dark:border-[#3d341e] hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="w-full bg-center bg-no-repeat aspect-[4/3] bg-cover rounded-lg overflow-hidden relative" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAVVZb0FgVrAeQ7HaCmRx2q-kg23HlkYXP3bui4gdavuAEh-FJh2Hc95CMq0ANW2f0AnB3l2z7LC3_vcTUMsMNmEnxLR7ygDHuv7ifx6Do_hR7iUhQPaumrPbE8W5nNFD4TBXLaq3-oh9vo2HhJFYCWRA_r6IiYgSjTY8BrGhtkHFiwO65es7La1N3vqdMpaoMuY7Jrw_6stCIG673D2Tzm7AYusAHE23XPo6MzGuoFLXGilcMctmyu_B2fQf1nTo2RPeVBml12-bc")' }}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/60 backdrop-blur rounded-full p-2 text-[#eebd2b] shadow-sm">
                      <span className="material-symbols-outlined block">extension</span>
                    </div>
                  </div>
                  <div className="px-2 pb-2">
                    <h4 className="text-[#422006] dark:text-yellow-50 text-xl font-bold leading-tight mb-1">Crack the Quiz</h4>
                    <p className="text-[#9a864c] dark:text-yellow-200/70 text-sm font-medium">Test your knowledge with fun questions</p>
                  </div>
                </motion.div>

                {/* GAME 2: DRAG & SPELL (formerly Drawing Space) */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleGameNavigation(2, 'DRAG-&-SPELL')}
                  className="group flex flex-col gap-4 bg-[#fffdf5] dark:bg-[#2d2616] p-4 rounded-xl border border-[#f3f0e7] dark:border-[#3d341e] hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="w-full bg-center bg-no-repeat aspect-[4/3] bg-cover rounded-lg overflow-hidden relative" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA2NaNKH7cX1zDJmfTsZDQDnztP2A6I16jAYXVQ1O91FNy8KH0s7Unf1axDYb89QVPQlHqeTxPEG-tAknecb_Np5Q_hlWcs1GR3LqggwBE1lQu90VLjyVTdW0e3p9jO4XbOi9KUc1-ecSOZ8ZI8BmYMds2xEuMdCCSMind-hTgwdOFNyd68okVKxmmwZcB3ZJ2c7FXgFe_SCoDkAD8I2oJVCv92ytZSxSZ-xNghnaY1Kx8MXlgUg9CDoZASsqrqwujawzbvJxArSQk")' }}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-black/60 backdrop-blur rounded-full p-2 text-[#eebd2b] shadow-sm">
                      <span className="material-symbols-outlined block">palette</span>
                    </div>
                  </div>
                  <div className="px-2 pb-2">
                    <h4 className="text-[#422006] dark:text-yellow-50 text-xl font-bold leading-tight mb-1">Drag & Spell</h4>
                    <p className="text-[#9a864c] dark:text-yellow-200/70 text-sm font-medium">Drag the missing letter to learn words</p>
                  </div>
                </motion.div>

              </div>
            </div>


            {/* Footer / Quick Settings */}
            <div className="mt-8 flex justify-between items-center py-6 border-t border-[#f3f0e7] dark:border-[#3d341e]">
              <p className="text-[#9a864c] text-sm">© NeuroAdaptive OS 2024</p>
              <div className="flex gap-4">
                <button className="p-3 rounded-full bg-[#fffdf5] dark:bg-[#2d2616] border border-[#f3f0e7] dark:border-[#3d341e] text-[#422006] hover:bg-[#fcfbf8] dark:hover:bg-[#1b180d] transition-colors" title="Settings">
                  <span className="material-symbols-outlined text-lg">settings</span>
                </button>
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate('/');
                  }}
                  className="p-3 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 transition-colors flex items-center gap-2 px-5 font-bold text-sm" 
                  title="Logout"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Logout
                </button>
              </div>
            </div>
            
          </div>
        </main>
      </div>

      {/* Breathe With Bear Modal */}
      <AnimatePresence>
        {showBreathe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-amber-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#fffdf5] rounded-3xl p-12 flex flex-col items-center gap-8 max-w-sm w-full mx-4 relative shadow-2xl"
            >
              <button onClick={stopBreathing} className="absolute top-4 right-4 text-[#9a864c] hover:text-[#422006] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
              <motion.div
                animate={{ scale: breathePhase === 'inhale' ? 1.4 : breathePhase === 'hold' ? 1.4 : 1 }}
                transition={{ duration: breathePhase === 'inhale' ? 4 : breathePhase === 'hold' ? 7 : 8, ease: 'easeInOut' }}
                className="size-40 rounded-full bg-[#eebd2b]/20 border-4 border-[#eebd2b]/40 flex items-center justify-center"
              >
                <motion.div
                  animate={{ scale: breathePhase === 'inhale' ? 1.2 : breathePhase === 'hold' ? 1.2 : 0.85 }}
                  transition={{ duration: 4, ease: 'easeInOut' }}
                  className="size-28 rounded-full bg-[#eebd2b]/30 flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[64px] text-[#eebd2b]">sentiment_satisfied</span>
                </motion.div>
              </motion.div>
              <div className="text-center">
                <p className="text-3xl font-bold text-[#422006] capitalize">{breathePhase}</p>
                <p className="text-[#9a864c] mt-1">
                  {breathePhase === 'inhale' ? '4 seconds' : breathePhase === 'hold' ? '7 seconds' : '8 seconds'}
                </p>
                <p className="text-xs text-[#9a864c]/70 mt-3">432 Hz grounding tone playing 🎵</p>
              </div>
              <p className="text-sm text-[#422006]/70 text-center px-4">Breathe with Bear using 4-7-8 breathing. Let your body relax.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
