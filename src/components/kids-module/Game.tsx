/**
 * Game (Quiz Game) — Kids Module
 *
 * Features:
 * ✅ Age gate — asks age if not passed from ParentDashboard
 * ✅ Webcam permission → start game → 2 min timer
 * ✅ Gemini AI–generated age-calibrated questions (fallback: Supabase seed)
 * ✅ Per-answer correct/wrong state colouring + speech feedback
 * ✅ canvas-confetti celebration on game end
 * ✅ captureImage + captureScreenshot every 10s via interval
 * ✅ BiometricVisionEngine multi-class emotion tracking (joy / frustration / confusion)
 * ✅ Automated Intervention: if frustration OR confusion > 80 for 5s:
 *      • Timer pauses
 *      • Questions blur
 *      • Calming breathing overlay with pulsing animation
 *      • Event logged to Supabase `intervention_events` table
 * ✅ Webcam + GPU cleanup on unmount
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Camera, Play, Trophy, ArrowLeft, Clock, Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchQuizQuestions } from '../../agents/gameContentAgent';
import { BiometricVisionEngine, type EmotionMetrics } from '../../lib/biometrics/faceMesh';

import TimerBar from './TimerBar';
import useSessionId from '../../hooks/kids/useSessionId';
import useWebcam from '../../hooks/kids/useWebcam';
import useCapture from '../../hooks/kids/useCapture';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Answer { text: string; correct: boolean; }
interface Question { question: string; image?: string; answers: Answer[]; }
type AnswerState = 'correct' | 'wrong' | '';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_SECONDS = 2 * 60;
const CAPTURE_INTERVAL_MS = 10_000;
const GAME_KEY = 'crack-the-quiz';
/** Threshold above which an emotion triggers intervention checks. */
const DISTRESS_THRESHOLD = 80;
/** Duration (ms) the child must be distressed before intervention fires. */
const DISTRESS_HOLD_MS = 5_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const speak = (text: string): void => {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) synth.cancel();
  setTimeout(() => synth.speak(new SpeechSynthesisUtterance(text)), 100);
};

const triggerConfetti = (): void => {
  let particles = 500;
  const colours = ['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff'];
  const id = setInterval(() => {
    confetti({
      particleCount: 10, spread: 360,
      startVelocity: Math.random() * 15 + 15,
      ticks: 300, gravity: 0.6,
      colors: [colours[Math.floor(Math.random() * colours.length)]],
      origin: { x: Math.random(), y: -0.1 },
    });
    particles -= 10;
    if (particles <= 0) clearInterval(id);
  }, 30);
  setTimeout(() => clearInterval(id), 10_000);
};

// ─── Calming Breathing Overlay ────────────────────────────────────────────────
function BreathingOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center
                 bg-gradient-to-br from-sky-900/95 via-indigo-900/95 to-purple-900/95
                 backdrop-blur-xl"
    >
      {/* Breathing circle */}
      <motion.div
        animate={{
          scale: [1, 1.5, 1.5, 1],
          opacity: [0.6, 1, 1, 0.6],
        }}
        transition={{
          duration: 8,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
        className="w-40 h-40 rounded-full bg-gradient-to-br from-sky-400/60 to-teal-400/60
                   shadow-[0_0_80px_rgba(56,189,248,0.4)] flex items-center justify-center"
      >
        <Heart className="w-12 h-12 text-white/80" />
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-10 text-3xl font-bold text-white tracking-tight text-center"
      >
        Let's take a breath together 🌊
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-3 text-white/60 text-center max-w-xs"
      >
        Breathe in as the circle grows… breathe out as it shrinks.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        <p className="text-white/40 text-xs">Take your time. Press when you're ready.</p>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDismiss}
          className="px-8 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20
                     font-bold text-white text-sm transition"
        >
          I'm Ready to Continue ✨
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, gameName, childAge } = (location.state as {
    username?: string; gameName?: string; childAge?: number;
  }) ?? {};
  const sessionName = username ?? 'Player';

  // Age gate state
  const [localAge, setLocalAge] = useState<number | null>(childAge ?? null);
  const [ageInput, setAgeInput] = useState('');
  const ageForGemini = localAge ?? 7;

  // Kids module hooks
  const { sessionId } = useSessionId();
  const { videoRef, webcamGranted, webcamError, requestWebcamAccess, stopWebcam } = useWebcam();
  const { canvasRef, captureImage, captureScreenshot } = useCapture({ videoRef });

  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Game state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_SECONDS);
  const [hasStarted, setHasStarted] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answerStates, setAnswerStates] = useState<AnswerState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flashClass, setFlashClass] = useState<'correct' | 'wrong' | null>(null);

  // ── Emotion + Intervention state ──────────────────────────────────────────
  const [emotions, setEmotions] = useState<EmotionMetrics>({
    tension: 0, gazeWander: 0, joy: 0, frustration: 0, confusion: 0,
  });
  const [interventionActive, setInterventionActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);

  // Track distress duration — ref to avoid stale closure inside rAF
  const distressStartRef = useRef<number | null>(null);
  const interventionLoggedRef = useRef(false);

  // Singleton engine ref
  const visionEngineRef = useRef<BiometricVisionEngine | null>(null);

  // ── Fetch questions (Gemini first, Supabase fallback) ─────────────────────
  useEffect(() => {
    if (!localAge) return;
    fetchQuizQuestions('emotions, animals, and everyday life', ageForGemini)
      .then(qs => { setQuestions(qs); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [localAge, ageForGemini]);

  // ── Countdown timer (pause-aware) ─────────────────────────────────────────
  useEffect(() => {
    if (!hasStarted || timerPaused) return;
    if (timeRemaining <= 0) { endGame(); return; }
    const t = setInterval(() => setTimeRemaining(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [hasStarted, timeRemaining, timerPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start BiometricVisionEngine when game starts ──────────────────────────
  useEffect(() => {
    if (!hasStarted || !webcamGranted || !videoRef.current) return;

    const engine = new BiometricVisionEngine();
    visionEngineRef.current = engine;

    engine.startAnalysis(videoRef.current, (metrics) => {
      setEmotions(metrics);

      // ── Distress threshold tracking ─────────────────────────────────
      const isDistressed =
        metrics.frustration >= DISTRESS_THRESHOLD ||
        metrics.confusion >= DISTRESS_THRESHOLD;

      if (isDistressed) {
        if (!distressStartRef.current) {
          distressStartRef.current = Date.now();
        } else if (
          Date.now() - distressStartRef.current >= DISTRESS_HOLD_MS &&
          !interventionLoggedRef.current
        ) {
          // 5 seconds of sustained distress → trigger intervention
          interventionLoggedRef.current = true;
          setInterventionActive(true);
          setTimerPaused(true);

          // Log to Supabase (non-blocking, non-fatal)
          supabase.from('intervention_events').insert({
            session_id: sessionId ?? 'unknown',
            child_name: sessionName,
            frustration_score: Math.round(metrics.frustration),
            confusion_score: Math.round(metrics.confusion),
            trigger_reason:
              metrics.frustration >= DISTRESS_THRESHOLD
                ? 'sustained_frustration'
                : 'sustained_confusion',
            question_index: currentIdx,
          }).then(({ error }) => {
            if (error) console.warn('[Game] Intervention log skipped:', error.message);
            else console.info('[Game] ✅ Intervention event logged to Supabase.');
          });
        }
      } else {
        // Child recovered — reset the timer
        distressStartRef.current = null;
      }
    });

    return () => {
      engine.close();
      visionEngineRef.current = null;
    };
  }, [hasStarted, webcamGranted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup webcam on unmount
  useEffect(() => () => stopWebcam(), [stopWebcam]);

  // ── Game lifecycle ────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    setShowEndScreen(true);
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    visionEngineRef.current?.close();
    stopWebcam();
    triggerConfetti();
  }, [stopWebcam]);

  const startCapture = () => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentIdx(0);
    setScore(0);
    setTimeRemaining(TOTAL_SECONDS);
    setShowEndScreen(false);
    setSelectedIdx(null);
    setAnswerStates([]);
    setHasStarted(true);
    setFlashClass(null);
    setInterventionActive(false);
    setTimerPaused(false);
    distressStartRef.current = null;
    interventionLoggedRef.current = false;

    if (webcamGranted && sessionId) {
      captureIntervalRef.current = setInterval(() => {
        captureImage({ sessionId, sessionName, gameName: gameName ?? '' });
        captureScreenshot({ sessionId, sessionName, gameName: gameName ?? '' });
      }, CAPTURE_INTERVAL_MS);
    }
  };

  const dismissIntervention = () => {
    setInterventionActive(false);
    setTimerPaused(false);
    distressStartRef.current = null;
    // Allow re-triggering if emotions spike again
    interventionLoggedRef.current = false;
  };

  const selectAnswer = (index: number, correct: boolean) => {
    if (selectedIdx !== null) return;
    const correctIdx = questions[currentIdx].answers.findIndex(a => a.correct);
    const states: AnswerState[] = questions[currentIdx].answers.map((_, i) =>
      i === correctIdx ? 'correct' : i === index ? (correct ? 'correct' : 'wrong') : 'wrong',
    );
    setSelectedIdx(index);
    setAnswerStates(states);
    setFlashClass(correct ? 'correct' : 'wrong');
    if (correct) { setScore(p => p + 1); speak('Correct!'); }
    else speak('Wrong!');

    setTimeout(() => {
      setFlashClass(null);
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(p => p + 1);
        setSelectedIdx(null);
        setAnswerStates([]);
      } else {
        endGame();
      }
    }, 1000);
  };

  // ── Derived UI states ─────────────────────────────────────────────────────
  const bgFlash =
    flashClass === 'correct' ? 'bg-green-500/20' :
    flashClass === 'wrong'   ? 'bg-red-500/20'   : '';

  const answerBg = (state: AnswerState) =>
    state === 'correct' ? 'bg-emerald-500 border-emerald-400 text-white scale-105' :
    state === 'wrong'   ? 'bg-rose-500 border-rose-400 text-white' :
    'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40';

  // Colour for the emotion indicator pill
  const emotionPillColour =
    emotions.frustration >= 80 || emotions.confusion >= 80
      ? 'bg-rose-500/80 text-white'
      : emotions.joy >= 50
      ? 'bg-emerald-500/80 text-white'
      : 'bg-white/10 text-white/60';

  const dominantEmotion =
    emotions.frustration >= 80 ? '😤 Frustrated'
    : emotions.confusion >= 80 ? '🤔 Confused'
    : emotions.joy >= 50 ? '😊 Happy'
    : '😐 Neutral';

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Age Gate ───────────────────────────────────────────────────────────────
  if (!localAge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white flex items-center justify-center p-6">
      <video ref={videoRef} autoPlay playsInline className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" />
      <canvas ref={canvasRef} width={640} height={480} className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm flex flex-col items-center gap-6 text-center"
        >
          <div className="text-6xl animate-bounce">🧠</div>
          <h1 className="text-3xl font-black tracking-tight">How old are you?</h1>
          <p className="text-white/60 text-sm">We'll make the questions just right for you!</p>
          <form
            onSubmit={e => {
              e.preventDefault();
              const parsed = parseInt(ageInput, 10);
              if (parsed >= 3 && parsed <= 18) setLocalAge(parsed);
            }}
            className="w-full flex flex-col gap-4"
          >
            <input
              type="number" min={3} max={18} value={ageInput}
              onChange={e => setAgeInput(e.target.value)}
              placeholder="My age is…" autoFocus
              className="w-full text-center text-2xl font-bold px-6 py-4 rounded-2xl
                         bg-white/10 border-2 border-white/20 text-white placeholder:text-white/30
                         focus:outline-none focus:border-yellow-400 transition"
            />
            <motion.button
              type="submit" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl bg-yellow-400 text-gray-900 font-black text-xl
                         shadow-lg shadow-yellow-400/30 disabled:opacity-40 transition"
              disabled={!ageInput || parseInt(ageInput, 10) < 3 || parseInt(ageInput, 10) > 18}
            >
              Let's Play! 🚀
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className={`min-h-screen transition-colors duration-500 bg-gradient-to-br from-indigo-900 via-violet-900 to-purple-900 text-white ${bgFlash}`}
    >
      {/* Offscreen AV elements — must render in DOM for ref attachment */}
      <video ref={videoRef} autoPlay playsInline className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" />
      <canvas ref={canvasRef} width={640} height={480} className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none" />

      {/* ── Breathing intervention overlay ── */}
      <AnimatePresence>
        {interventionActive && (
          <BreathingOverlay onDismiss={dismissIntervention} />
        )}
      </AnimatePresence>

      <div className={`max-w-2xl mx-auto px-4 py-8 flex flex-col min-h-screen
                       transition-all duration-500 ${interventionActive ? 'blur-md pointer-events-none' : ''}`}>

        {/* ── Camera permission screen ── */}
        <AnimatePresence mode="popLayout">
          {!webcamGranted && (
            <motion.div
              key="cam"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center flex-1 gap-6"
            >
              <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                <Camera className="w-12 h-12 text-yellow-300" />
              </div>
              <h2 className="text-2xl font-bold text-center">Camera Access Required</h2>
              <p className="text-white/60 text-center max-w-sm">
                We need your camera to track your learning journey. Your data stays private.
              </p>
              {webcamError && (
                <p className="text-rose-400 text-sm text-center">{webcamError.message}</p>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                onClick={requestWebcamAccess}
                className="px-8 py-3 rounded-2xl bg-yellow-400 text-gray-900 font-bold text-lg shadow-lg shadow-yellow-400/30"
              >
                Allow Camera 📷
              </motion.button>
            </motion.div>
          )}

          {/* ── Start screen ── */}
          {webcamGranted && !hasStarted && !showEndScreen && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center flex-1 gap-6"
            >
              <div className="text-7xl">🧠</div>
              <h1 className="text-3xl font-black">Crack the Quiz!</h1>
              <p className="text-white/60 text-lg">
                {isLoading ? 'Loading questions…' : `${questions.length} questions · 2 minutes`}
              </p>
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
                onClick={startCapture}
                disabled={isLoading || questions.length === 0}
                className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 font-black text-xl shadow-xl shadow-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-6 h-6" /> Start Game
              </motion.button>
            </motion.div>
          )}

          {/* ── Active game screen ── */}
          {hasStarted && !showEndScreen && (
            <motion.div
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5 flex-1"
            >
              {/* Timer + emotion pill */}
              <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3 backdrop-blur">
                <Clock className="w-5 h-5 text-yellow-300 shrink-0" />
                <span className="font-mono font-bold text-lg w-14">
                  {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </span>
                <div className="flex-1">
                  <TimerBar totalSeconds={TOTAL_SECONDS} timeRemaining={timeRemaining} />
                </div>
                {/* Emotion indicator */}
                <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 transition-colors ${emotionPillColour}`}>
                  {dominantEmotion}
                </span>
                <span className="text-white/50 text-sm shrink-0">
                  {currentIdx + 1}/{questions.length}
                </span>
              </div>

              {timerPaused && (
                <div className="text-center text-amber-300 text-xs font-semibold animate-pulse">
                  ⏸ Timer paused — intervention active
                </div>
              )}

              {/* Question card */}
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentIdx}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  className="bg-white/10 backdrop-blur rounded-3xl p-6 border border-white/15 shadow-xl flex flex-col gap-4"
                >
                  <p className="text-xl font-bold leading-snug">
                    {questions[currentIdx]?.question}
                  </p>
                  {questions[currentIdx]?.image && (
                    <img
                      src={questions[currentIdx].image}
                      alt="Question visual"
                      className="rounded-xl max-h-48 object-contain mx-auto"
                    />
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {questions[currentIdx]?.answers.map((ans, i) => (
                      <motion.button
                        key={i}
                        whileHover={selectedIdx === null ? { scale: 1.03 } : {}}
                        whileTap={selectedIdx === null ? { scale: 0.97 } : {}}
                        onClick={() => selectAnswer(i, ans.correct)}
                        disabled={selectedIdx !== null}
                        className={`px-4 py-3 rounded-xl border font-semibold text-sm transition-all duration-300 ${answerBg(answerStates[i] ?? '')}`}
                      >
                        {ans.text}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Score chip */}
              <div className="text-center text-white/50 text-sm">
                Score: <span className="text-yellow-300 font-bold">{score}</span>
              </div>
            </motion.div>
          )}

          {/* ── End screen ── */}
          {showEndScreen && (
            <motion.div
              key="end"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="flex flex-col items-center justify-center flex-1 gap-6 text-center"
            >
              <Trophy className="w-20 h-20 text-yellow-300" />
              <h2 className="text-3xl font-black">
                {score === questions.length ? '🌟 Full Marks! You\'re a genius!' : '🎉 Quiz Complete!'}
              </h2>
              <div className="text-6xl font-black text-yellow-300">
                {score}<span className="text-white/40 text-3xl">/{questions.length}</span>
              </div>
              <p className="text-white/60">
                {score === questions.length
                  ? 'Perfect score — incredible work!'
                  : `Great effort, ${sessionName}! Keep practising.`}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/kids/games', { state: { username, gameName } })}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 font-bold transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Games
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
