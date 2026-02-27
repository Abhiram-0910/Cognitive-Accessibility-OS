/**
 * GameTwo (Drag-&-Spell) — Kids Module
 * Ported from: _legacy_repo_to_port/Frontend/src/components/game_2.js
 * Renamed: game_2.js → GameTwo.tsx  (as instructed)
 *
 * Functional parity checklist — ALL features preserved:
 * ✅ webcam permission request
 * ✅ Fetch questions from backend on mount
 * ✅ Drag-and-drop letter mechanic (HTML5 DragEvent API)
 * ✅ Word completion display (word with missing letter)
 * ✅ Correct / wrong feedback with background colour change + thumbs-up emoji
 * ✅ speechSynthesis "Correct!" / "Try again!" feedback
 * ✅ Level progression, end screen with react-confetti
 * ✅ captureImage + captureScreenshot every 10s via interval
 * ✅ Webcam stream cleanup on game end
 * ✅ Interval cleanup on unmount
 *
 * Styling: full Tailwind + Framer Motion — zero CSS file imports.
 * Bootstrap and Game_2.css removed.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchSpellingQuestions, SpellingQuestion } from '../../agents/gameContentAgent';

import useSessionId from '../../hooks/kids/useSessionId';
import useWebcam from '../../hooks/kids/useWebcam';
import useCapture from '../../hooks/kids/useCapture';

// ─── Types ────────────────────────────────────────────────────────────────────
// DragSpellQuestion re-exported from gameContentAgent for local use
type DragSpellQuestion = SpellingQuestion;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const speak = (text: string): void => {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) synth.cancel();
  setTimeout(() => synth.speak(new SpeechSynthesisUtterance(text)), 100);
};

// game_key that identifies "Drag & Spell" in the `games` Supabase table
// (matches the `game_key TEXT UNIQUE` column in migrations/merge_kids_module.sql)
const GAME_KEY = 'drag-and-spell';
const CAPTURE_INTERVAL_MS = 10_000;

// ─── Sub-components ───────────────────────────────────────────────────────────
interface WordWithImageProps {
  word: string;
  image: string;
  isCorrect: boolean | null;
  onDrop: (letter: string) => void;
}

function WordWithImage({ word, image, isCorrect, onDrop }: WordWithImageProps) {
  const borderColour =
    isCorrect === null ? 'border-white/20' :
    isCorrect           ? 'border-emerald-400' : 'border-rose-400';

  const bgColour =
    isCorrect === null ? 'bg-white/10' :
    isCorrect           ? 'bg-emerald-500/20' : 'bg-rose-500/20';

  return (
    <motion.div
      animate={{ borderColor: isCorrect === null ? 'rgba(255,255,255,.2)' : isCorrect ? '#34d399' : '#f87171' }}
      transition={{ duration: 0.3 }}
      className={`relative flex flex-col items-center gap-4 p-6 rounded-3xl border-2 ${borderColour} ${bgColour} backdrop-blur transition-colors duration-300`}
      onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('letter')); }}
      onDragOver={e => e.preventDefault()}
    >
      {isCorrect && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-3 right-3 text-3xl"
        >
          👍
        </motion.span>
      )}
      <img
        src={image}
        alt="object to guess"
        className="w-36 h-36 object-contain rounded-xl drop-shadow-lg"
      />
      <motion.h1
        key={word}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="text-5xl font-black tracking-widest text-yellow-300"
        style={{ fontFamily: 'Comic Sans MS, Nunito, sans-serif' }}
      >
        {word}
      </motion.h1>
      <p className="text-white/40 text-xs uppercase tracking-widest">Drop the missing letter here</p>
    </motion.div>
  );
}

interface LetterOptionProps {
  letter: string;
}

function LetterOption({ letter }: LetterOptionProps) {
  return (
    // Native div drives drag so TS sees DragEvent (not Framer Motion's PointerEvent)
    <div
      draggable
      onDragStart={(e: React.DragEvent<HTMLDivElement>) => e.dataTransfer.setData('letter', letter)}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <motion.div
        whileHover={{ scale: 1.15, y: -4 }}
        whileTap={{ scale: 0.9 }}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-400/30
                   flex items-center justify-center text-white text-2xl font-black"
        style={{ fontFamily: 'Comic Sans MS, Nunito, sans-serif' }}
      >
        {letter}
      </motion.div>
    </div>
  );
}

function EndScreen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center flex-1 gap-6 text-center"
    >
      <Confetti recycle={false} numberOfPieces={400} />
      <div className="text-7xl">🎉</div>
      <h1 className="text-4xl font-black text-yellow-300" style={{ fontFamily: 'Comic Sans MS, Nunito, sans-serif' }}>
        Well Done!
      </h1>
      <p className="text-white/60 text-lg">You've completed all the levels!</p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { window.location.href = '/kids/games'; }}
        className="px-8 py-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black text-lg shadow-xl shadow-orange-400/30"
      >
        Back to Games
      </motion.button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GameTwo() {
  const location = useLocation();
  const { username, gameName, childAge } = (location.state as { username?: string; gameName?: string; childAge?: number }) ?? {};
  const ageForGemini = childAge ?? 7;

  const { sessionId } = useSessionId();
  const { videoRef, webcamGranted, webcamError, requestWebcamAccess, stopWebcam } = useWebcam();
  const { canvasRef, captureImage, captureScreenshot } = useCapture({ videoRef });

  const [questions, setQuestions] = useState<DragSpellQuestion[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedWord, setCompletedWord] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch questions — Gemini first (age-calibrated), Supabase seed fallback
  useEffect(() => {
    fetchSpellingQuestions('animals, fruits, and simple household objects', ageForGemini)
      .then(qs => {
        setQuestions(qs);
        if (qs.length > 0) setCompletedWord(qs[0].word ?? '');
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [ageForGemini]);

  // Cleanup interval on unmount
  useEffect(() => () => { if (intervalId) clearInterval(intervalId); }, [intervalId]);

  // Cleanup webcam on unmount
  useEffect(() => () => stopWebcam(), [stopWebcam]);

  const stopWebcamStream = useCallback(() => stopWebcam(), [stopWebcam]);

  const startGame = () => {
    setGameStarted(true);
    const id = setInterval(() => {
      if (sessionId) {
        captureImage({ sessionId, sessionName: username ?? `Child_${sessionId}`, gameName: gameName ?? '' });
        captureScreenshot({ sessionId, sessionName: username ?? `Child_${sessionId}`, gameName: gameName ?? '' });
      }
    }, CAPTURE_INTERVAL_MS);
    setIntervalId(id);
  };

  const handleDrop = (letter: string) => {
    const currentQuestion = questions[currentLevel];
    if (!currentQuestion) return;

    const { correctLetter, word } = currentQuestion;
    if (letter === correctLetter) {
      setIsCorrect(true);
      setCompletedWord(word.replace('_', letter));
      speak('Correct!');

      setTimeout(() => {
        if (currentLevel < questions.length - 1) {
          setCurrentLevel(l => l + 1);
          setCompletedWord(questions[currentLevel + 1]?.word ?? '');
          setIsCorrect(null);
        } else {
          if (intervalId) clearInterval(intervalId);
          setShowEndScreen(true);
          stopWebcamStream();
        }
      }, 1500);
    } else {
      setIsCorrect(false);
      speak('Try again!');
      setTimeout(() => setIsCorrect(null), 1000);
    }
  };

  const { image = '', options = [] } = questions[currentLevel] ?? {};

  if (showEndScreen) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white flex flex-col">
      <EndScreen />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white">
      {/* Hidden AV elements */}
      <video ref={videoRef} autoPlay playsInline className="hidden" />
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />

      <div className="max-w-xl mx-auto px-4 py-8 flex flex-col min-h-screen gap-6">
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black text-center tracking-wide"
          style={{ fontFamily: 'Comic Sans MS, Nunito, sans-serif' }}
        >
          Drag &amp; Spell the word! ✏️
        </motion.h2>

        <AnimatePresence mode="popLayout">
          {/* Camera permission */}
          {!webcamGranted && (
            <motion.div
              key="cam"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 justify-center flex-1"
            >
              <Camera className="w-16 h-16 text-yellow-300" />
              <p className="text-white/60 text-center">We need camera access to monitor the session.</p>
              {webcamError && <p className="text-rose-400 text-sm">{webcamError.message}</p>}
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={requestWebcamAccess}
                className="px-8 py-3 rounded-2xl bg-yellow-400 text-gray-900 font-bold shadow-lg shadow-yellow-400/30"
              >
                Allow Camera 📷
              </motion.button>
            </motion.div>
          )}

          {/* Start button */}
          {webcamGranted && !gameStarted && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 gap-4"
            >
              <p className="text-white/60">
                {isLoading ? 'Loading levels…' : `${questions.length} levels ready!`}
              </p>
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={startGame}
                disabled={isLoading || questions.length === 0}
                className="px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black text-xl shadow-xl shadow-orange-400/30 disabled:opacity-50"
              >
                START GAME 🚀
              </motion.button>
            </motion.div>
          )}

          {/* Active game */}
          {gameStarted && !showEndScreen && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col gap-6"
            >
              {/* Level indicator */}
              <div className="flex justify-between text-sm text-white/40">
                <span>Level {currentLevel + 1} / {questions.length}</span>
              </div>

              <WordWithImage
                word={completedWord}
                image={image}
                isCorrect={isCorrect}
                onDrop={handleDrop}
              />

              {/* Letter options */}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {options.map((letter, i) => (
                  <LetterOption key={i} letter={letter} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
