/**
 * GameSelection — Kids Module
 * Ported from: _legacy_repo_to_port/Frontend/src/components/GameSelection.js
 *
 * Game-picker screen shown to a child after login.
 * All functional logic preserved: username from localStorage,
 * logout handler, game navigation with state.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Gamepad2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameCard {
  id: number;
  title: string;
  description: string;
  /** Path relative to public/kids-assets/ */
  image: string;
  /** Emoji badge shown on the card */
  badge: string;
  onClick: () => void;
}

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 200, damping: 18 } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function GameSelection() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('Player');

  // Derive username from Supabase auth session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? '';
      setUsername(email.split('@')[0] || 'Player');
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const games: GameCard[] = [
    {
      id: 1,
      title: 'CRACK-THE-QUIZ',
      description: 'Test your knowledge by answering simple quiz questions.',
      image: '/kids-assets/quiz.png',
      badge: '🧠',
      onClick: () => navigate('/kids/play/1', { state: { username, gameName: 'CRACK-THE-QUIZ' } }),
    },
    {
      id: 2,
      title: 'DRAG-&-SPELL',
      description: 'Drag the missing letter to its correct position to complete the word.',
      image: '/kids-assets/drag.png',
      badge: '✏️',
      onClick: () => navigate('/kids/play/2', { state: { username, gameName: 'DRAG-&-SPELL' } }),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/10 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-6 h-6 text-yellow-300" />
          <span className="text-lg font-bold tracking-wide">Joy with Learning</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/70">
            Hi, <span className="text-yellow-300 font-semibold">{username}</span>!
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex flex-col items-center px-6 py-16 gap-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            Select a Game 🎮
          </h1>
          <p className="mt-3 text-white/60 text-lg">Choose your challenge and let's go!</p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl"
        >
          {games.map(game => (
            <motion.button
              key={game.id}
              variants={cardVariants}
              whileHover={{ scale: 1.04, y: -6 }}
              whileTap={{ scale: 0.97 }}
              onClick={game.onClick}
              className="group relative flex flex-col items-center gap-4 p-8 rounded-3xl
                         bg-white/10 backdrop-blur-md border border-white/20
                         shadow-xl hover:shadow-purple-500/30 hover:border-white/40
                         transition-all text-left cursor-pointer"
            >
              {/* Badge */}
              <span className="absolute top-4 right-4 text-2xl">{game.badge}</span>

              <img
                src={game.image}
                alt={game.title}
                className="w-36 h-36 object-contain drop-shadow-lg group-hover:scale-105 transition-transform"
              />
              <div className="text-center">
                <h2 className="text-xl font-black tracking-wide text-yellow-300">
                  {game.title}
                </h2>
                <p className="mt-2 text-white/70 text-sm leading-relaxed">
                  {game.description}
                </p>
              </div>

              {/* Play arrow */}
              <div className="mt-2 flex items-center gap-1 text-sm font-semibold text-white/50 group-hover:text-yellow-300 transition-colors">
                <span>Play now</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
