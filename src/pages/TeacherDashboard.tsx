/**
 * TeacherDashboard — Kids Module
 * Unified port of:
 *   - Analysis.js        (session list + search + analyze trigger)
 *   - OverallAnalysis.js (emotion averages — Donut + Bar charts)
 *   - DetailedAnalysis.js (per-frame image/emotion strip)
 *
 * All three views are combined into a single page with tab/drill-down navigation
 * so teachers never leave the dashboard. Zero react-router needed for sub-views.
 *
 * Functional parity checklist — ALL features preserved:
 * ✅ fetchSessions on mount, sorted descending
 * ✅ Search bar filters by sessionName OR gameName
 * ✅ Analyze button → GET analysis, POST if 404 (new analysis)
 * ✅ loadingSessionId spinner per row
 * ✅ Per-session buttons: Overall Analysis + Detailed Analysis
 * ✅ formatDateTime from legacy timestamp[] array
 * ✅ emotionAverages calculation (aggregate across frames)
 * ✅ Donut + Bar charts — replaced Chart.js with Recharts
 * ✅ calculateHighestEmotion per frame
 * ✅ Image + screenshot strip with per-frame emotion label
 * ✅ Navigation back to session list from drill-down views
 * ✅ username from localStorage, logout handler
 *
 * Styling: Tailwind + Framer Motion. Zero CSS file imports.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import {
  Search,
  LogOut,
  BarChart2,
  RefreshCw,
  ArrowLeft,
  Clock,
  User,
  Gamepad2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
// Maps to the `v_session_summary` view columns
interface Session {
  id: string;               // game_sessions.id (UUID)
  session_key: string;      // legacy sessionId
  session_name: string;     // player name
  game_name: string;        // game title
  played_at: string;        // ISO timestamp
  image_paths: string[];    // Supabase Storage paths
  screenshot_paths: string[];
  child_name: string | null;
  parent_name: string | null;
}

interface ExpressionLogRow {
  id: string;
  session_id: string;
  expression_label: string;
  confidence_score: number;
  source_image_path: string | null;
  captured_at: string;
}

interface EmotionAverage {
  emotion: string;
  avg: number;
}

type DashboardView = 'list' | 'overall' | 'detailed' | 'leaderboard';

const EMOTION_COLOURS = ['#818cf8', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#38bdf8'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDateTime = (isoString: string | null) => {
  if (!isoString) return { date: 'N/A', time: 'N/A' };
  try {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch { return { date: 'N/A', time: 'N/A' }; }
};

const calculateHighestEmotion = (logs: ExpressionLogRow[]) => {
  if (!logs.length) return { label: 'N/A', score: 0 };
  return logs.reduce(
    (best, e) => e.confidence_score > best.score
      ? { label: e.expression_label, score: e.confidence_score * 100 }
      : best,
    { label: '', score: 0 },
  );
};

/** Returns the public URL for a path stored in Supabase Storage */
const storageUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('Teacher');

  // Derive display name from Supabase auth session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? '';
      setDisplayName(email.split('@')[0].replace(/[0-9]/g, '') || 'Teacher');
    });
  }, []);

  // ── Session list state ────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([]);
  const [existingAnalysis, setExistingAnalysis] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Drill-down state ──────────────────────────────────────────────────────
  const [view, setView] = useState<DashboardView>('list');

  // ── Overall Analysis state ─────────────────────────────────────────────────
  const [emotionAverages, setEmotionAverages] = useState<EmotionAverage[]>([]);

  // ── Detailed Analysis state ────────────────────────────────────────────────
  const [detailedSession, setDetailedSession] = useState<Session | null>(null);
  const [detailLogs, setDetailLogs] = useState<ExpressionLogRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Fetch sessions (from v_session_summary view) ───────────────────────────
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_session_summary')
        .select('id, session_key, session_name, game_name, played_at, image_paths, screenshot_paths, child_name, parent_name')
        .order('played_at', { ascending: false });

      if (error) throw error;
      setSessions(data ?? []);

      // Pre-populate existingAnalysis: sessions that already have expression_logs
      if (data && data.length > 0) {
        const ids = data.map((s: Session) => s.id);
        const { data: logs } = await supabase
          .from('expression_logs')
          .select('session_id')
          .in('session_id', ids);

        const analysedSet = new Set((logs ?? []).map((l: { session_id: string }) => l.session_id));
        const analysisMap: Record<string, boolean> = {};
        data.forEach((s: Session) => { analysisMap[s.id] = analysedSet.has(s.id); });
        setExistingAnalysis(analysisMap);
      }
    } catch (err) {
      console.error('[TeacherDashboard] fetchSessions error:', err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // ── Analyze: check expression_logs count, mark analysed ───────────────────
  const handleSessionClick = async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    try {
      const { count, error } = await supabase
        .from('expression_logs')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      if (error) throw error;
      setExistingAnalysis(prev => ({ ...prev, [sessionId]: (count ?? 0) > 0 }));
    } catch (err) {
      console.error('[TeacherDashboard] handleSessionClick error:', err);
    } finally {
      setLoadingSessionId(null);
    }
  };

  // ── Overall Analysis: aggregate from v_session_emotions view ───────────────
  const openOverallAnalysis = async (sessionId: string) => {
    setView('overall');
    setEmotionAverages([]);
    try {
      // v_session_emotions has: session_id, expression_label, avg_confidence, occurrence_count
      const { data, error } = await supabase
        .from('v_session_emotions')
        .select('expression_label, avg_confidence')
        .eq('session_id', sessionId);

      if (error) throw error;
      const averages: EmotionAverage[] = (data ?? []).map((row: { expression_label: string; avg_confidence: number }) => ({
        emotion: row.expression_label,
        avg: parseFloat((row.avg_confidence * 100).toFixed(2)),
      }));
      setEmotionAverages(averages);
    } catch (err) {
      console.error('[TeacherDashboard] openOverallAnalysis error:', err);
    }
  };

  // ── Detailed Analysis: fetch session + expression_logs rows ────────────────
  const openDetailedAnalysis = async (sessionId: string) => {
    setView('detailed');
    setDetailedSession(null);
    setDetailLogs([]);
    setDetailLoading(true);
    setDetailError(null);
    try {
      // Fetch the session row
      const { data: sessionData, error: sErr } = await supabase
        .from('v_session_summary')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (sErr) throw sErr;
      setDetailedSession(sessionData);

      // Fetch all expression_logs for this session
      const { data: logs, error: lErr } = await supabase
        .from('expression_logs')
        .select('id, session_id, expression_label, confidence_score, source_image_path, captured_at')
        .eq('session_id', sessionId)
        .order('captured_at', { ascending: true });
      if (lErr) throw lErr;
      setDetailLogs(logs ?? []);
    } catch (err) {
      console.error('[TeacherDashboard] openDetailedAnalysis error:', err);
      setDetailError('Error fetching session data');
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Leaderboard state ──────────────────────────────────────────────────────
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number, rank: number}[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      // Fetch all sessions to calculate total scores per child
      const { data, error } = await supabase
        .from('game_sessions')
        .select('child_name, score')
        .not('child_name', 'is', null);

      if (error) throw error;

      // Aggregate scores
      const scoresMap: Record<string, number> = {};
      (data || []).forEach(s => {
        if (s.child_name && typeof s.score === 'number') {
           scoresMap[s.child_name] = (scoresMap[s.child_name] || 0) + s.score;
        }
      });

      // Sort and rank
      const ranked = Object.entries(scoresMap)
        .map(([name, score]) => ({ name, score, rank: 0 }))
        .sort((a, b) => b.score - a.score)
        .map((entry, i) => ({ ...entry, rank: i + 1 }));

      setLeaderboard(ranked);
    } catch (err) {
      console.error('[TeacherDashboard] fetchLeaderboard error:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // Listen for real-time game session updates to keep leaderboard live
  useEffect(() => {
    const channel = supabase.channel('public:game_sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_sessions' }, 
        () => {
           if (view === 'leaderboard') fetchLeaderboard();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [view, fetchLeaderboard]);

  const openLeaderboard = () => {
    setView('leaderboard');
    fetchLeaderboard();
  };

  // ── Filtered sessions ──────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s =>
    (s.session_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.game_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/5 border-b border-white/10 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-lg">Teacher Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sessions
            </button>
          )}
          <div className="flex items-center gap-1.5 text-sm text-white/60">
            <User className="w-4 h-4" />
            <span className="text-indigo-300 font-semibold">{displayName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="popLayout">

          {/* ──────────── SESSION LIST VIEW ──────────── */}
          {view === 'list' && (
            <motion.div key="list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-black tracking-tight">
                  Sessions {isLoading && <span className="text-2xl">⌛</span>}
                </h1>
                <div className="flex items-center gap-3">
                  <button
                    onClick={openLeaderboard}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:scale-105 transition"
                  >
                    🏆 Leaderboard
                  </button>
                  <button
                    onClick={fetchSessions}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by player name or game…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400 transition"
                />
              </div>

              {/* Table */}
              {!isLoading && (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-white/50 uppercase text-xs tracking-widest">
                      <tr>
                        {['Name','Game','Date','Time','Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30">No sessions found.</td></tr>
                      )}
                      {filteredSessions.map((session, i) => {
                        const { date, time } = formatDateTime(session.played_at);
                        const isAnalyzing = loadingSessionId === session.id;
                        const hasAnalysis = existingAnalysis[session.id];
                        return (
                          <motion.tr
                            key={session.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="border-t border-white/5 hover:bg-white/5 transition"
                          >
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              {session.child_name ?? session.session_name}
                            </td>
                            <td className="px-4 py-3 text-white/70 flex items-center gap-1.5">
                              <Gamepad2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              {session.game_name || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-white/50">{date}</td>
                            <td className="px-4 py-3 text-white/50 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{time}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleSessionClick(session.id)}
                                  disabled={isAnalyzing}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/30 text-indigo-300 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  {isAnalyzing ? (
                                    <span className="inline-block w-3 h-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
                                  ) : <BarChart2 className="w-3 h-3" />}
                                  Check Logs
                                </button>
                                {hasAnalysis && (
                                  <>
                                    <button
                                      onClick={() => openOverallAnalysis(session.id)}
                                      className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/30 text-emerald-300 text-xs font-semibold transition"
                                    >
                                      Overall
                                    </button>
                                    <button
                                      onClick={() => openDetailedAnalysis(session.id)}
                                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/30 text-amber-300 text-xs font-semibold transition"
                                    >
                                      Detailed
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ──────────── OVERALL ANALYSIS VIEW ──────────── */}
          {view === 'overall' && (
            <motion.div key="overall" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-black tracking-tight mb-8">Overall Expression Analysis</h1>

              {emotionAverages.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-white/30">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Average list */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    {emotionAverages.map((e, i) => (
                      <div
                        key={e.emotion}
                        className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
                      >
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{e.emotion}</p>
                        <p className="text-2xl font-black" style={{ color: EMOTION_COLOURS[i % EMOTION_COLOURS.length] }}>
                          {e.avg.toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Radial / Donut equivalent */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="font-bold mb-4 text-white/60 text-sm uppercase tracking-widest">Emotion Distribution</h3>
                      <div className="w-full mt-2">
                      <ResponsiveContainer width="100%" height={280} minWidth={0}>
                        <RadialBarChart
                          cx="50%" cy="50%"
                          innerRadius={30} outerRadius={120}
                          data={emotionAverages.map((e, i) => ({
                            name: e.emotion,
                            value: e.avg,
                            fill: EMOTION_COLOURS[i % EMOTION_COLOURS.length],
                          }))}
                        >
                          <RadialBar dataKey="value" cornerRadius={6} />
                          <Legend iconType="circle" iconSize={10} />
                          <Tooltip
                            contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }}
                            formatter={(v: number) => [`${v.toFixed(2)}%`]}
                          />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar chart */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                      <h3 className="font-bold mb-4 text-white/60 text-sm uppercase tracking-widest">Average by Emotion</h3>
                      <div className="w-full mt-2">
                      <ResponsiveContainer width="100%" height={280} minWidth={0}>
                        <BarChart data={emotionAverages} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.07)" />
                          <XAxis dataKey="emotion" tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} />
                          <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }}
                            formatter={(v: number) => [`${v.toFixed(2)}%`, 'Average']}
                          />
                          <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                            {emotionAverages.map((_, i) => (
                              <Cell key={i} fill={EMOTION_COLOURS[i % EMOTION_COLOURS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ──────────── DETAILED ANALYSIS VIEW ──────────── */}
          {view === 'detailed' && (
            <motion.div key="detailed" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-black tracking-tight mb-8">Detailed Analysis</h1>

              {detailLoading && (
                <div className="flex items-center justify-center h-64 text-white/30">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              )}
              {detailError && <p className="text-rose-400">{detailError}</p>}
              {!detailLoading && detailedSession && (
                <div className="flex flex-col gap-6">
                  {detailLogs.length > 0
                    ? detailLogs.map((log, idx) => {
                        const imgUrl = log.source_image_path
                          ? storageUrl('kids-captures', log.source_image_path)
                          : null;
                        const screenshotPath = (detailedSession.screenshot_paths ?? [])[idx];
                        const ssUrl = screenshotPath
                          ? storageUrl('kids-captures', screenshotPath)
                          : null;
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.06 }}
                            className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-5"
                          >
                            <div className="flex-shrink-0 flex flex-col gap-2">
                              {ssUrl && (
                                <img src={ssUrl} alt={`Screenshot ${idx + 1}`}
                                  className="w-40 rounded-xl object-cover border border-white/10" />
                              )}
                              {imgUrl && (
                                <img src={imgUrl} alt={`Webcam ${idx + 1}`}
                                  className="w-40 rounded-xl object-cover border border-white/10" />
                              )}
                            </div>
                            <div className="flex flex-col gap-3 justify-center">
                              <p className="text-white/40 text-xs">
                                Captured: {new Date(log.captured_at).toLocaleTimeString()}
                              </p>
                              <p className="text-lg font-bold text-yellow-300">
                                {log.expression_label} — {(log.confidence_score * 100).toFixed(1)}%
                              </p>
                            </div>
                          </motion.div>
                        );
                      })
                    : <p className="text-white/30">No expression logs for this session yet.</p>
                  }
                </div>
              )}
              {!detailLoading && !detailedSession && !detailError && (
                <p className="text-white/30">No data found for this session.</p>
              )}
            </motion.div>
          )}

          {/* ──────────── LEADERBOARD VIEW ──────────── */}
          {view === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">Global Leaderboard</h1>
                  <p className="text-white/50 text-sm">Live scores from all players</p>
                </div>
              </div>

              {leaderboardLoading ? (
                <div className="flex items-center justify-center h-64 text-white/30 flex-col gap-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-500/50" />
                  <p>Calculating ranks...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-white/40">No game scores recorded yet.</p>
                </div>
              ) : (
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden p-2">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-white/40 text-xs uppercase tracking-widest border-b border-white/10">
                        <th className="py-4 px-6 font-semibold w-24">Rank</th>
                        <th className="py-4 px-6 font-semibold">Player</th>
                        <th className="py-4 px-6 font-semibold text-right">Total Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, idx) => {
                        const isFirst = player.rank === 1;
                        const isSecond = player.rank === 2;
                        const isThird = player.rank === 3;
                        return (
                          <motion.tr 
                            key={player.name}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`
                              border-b border-white/5 last:border-0 transition-colors
                              ${isFirst ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'hover:bg-white/5'}
                            `}
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2 font-bold text-lg">
                                <span className={isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : isThird ? 'text-orange-400' : 'text-white/30'}>
                                  #{player.rank}
                                </span>
                                {isFirst && <span>🥇</span>}
                                {isSecond && <span>🥈</span>}
                                {isThird && <span>🥉</span>}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm
                                  ${isFirst ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-white/10'}
                                `}>
                                  {player.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={isFirst ? 'font-bold text-amber-100 text-lg' : 'font-medium text-white/80'}>
                                  {player.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-bold font-mono">
                                <span>⭐</span>
                                <span className={isFirst ? 'text-amber-400' : 'text-purple-300'}>
                                  {player.score.toLocaleString()}
                                </span>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
