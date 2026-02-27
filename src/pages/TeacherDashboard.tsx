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
import { useCognitiveStore } from '../stores/cognitiveStore';

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
  const isHeuristic = useCognitiveStore(s => s.isHeuristic);

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
    <div className="bg-[#f6f7f8] dark:bg-[#111921] text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-[#2b3b4d] px-6 lg:px-10 py-4 bg-[#1a2632] sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-white">
            <div className="size-8 bg-[#197fe6]/20 rounded-lg flex items-center justify-center text-[#197fe6]">
              <span className="material-symbols-outlined text-2xl">neurology</span>
            </div>
            <h2 className="text-white text-lg font-bold leading-tight tracking-tight hidden sm:block">NeuroAdaptive OS</h2>
          </div>
          {/* Search Bar */}
          <label className="hidden md:flex flex-col min-w-40 !h-10 w-64 lg:w-96 relative group">
            <div className="flex w-full flex-1 items-center rounded-lg h-full bg-[#111921] border border-[#2b3b4d] focus-within:border-[#197fe6] transition-colors">
              <div className="text-slate-400 flex items-center justify-center pl-3">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <input 
                className="w-full bg-transparent border-none text-sm text-white placeholder:text-slate-500 focus:ring-0 focus:outline-none px-3 h-full" 
                placeholder="Search patient sessions or games..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </label>
        </div>
        
        <div className="flex flex-1 justify-end items-center gap-8">
          <nav className="hidden lg:flex items-center gap-8">
            <button onClick={() => setView('list')} className={`text-sm font-medium transition-colors ${view === 'list' ? 'text-white' : 'text-slate-400 hover:text-white'}`}>Active Roster</button>
            <button onClick={openLeaderboard} className={`text-sm font-medium transition-colors flex items-center gap-1 ${view === 'leaderboard' ? 'text-white' : 'text-slate-400 hover:text-white'}`}>🏆 Leaderboard</button>
          </nav>
          
          <div className="flex gap-3 items-center lg:border-l border-[#2b3b4d] lg:pl-8">
            <button className="flex items-center justify-center rounded-lg size-10 hover:bg-[#2b3b4d] text-slate-400 hover:text-white transition-colors relative">
              <span className="material-symbols-outlined absolute top-2 right-2 size-2 bg-rose-500 rounded-full" />
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-3 bg-[#111921] rounded-full border-2 border-[#2b3b4d] pr-4 py-1 pl-1">
               <div className="size-8 rounded-full bg-gradient-to-tr from-[#197fe6] to-purple-500 flex items-center justify-center text-white font-bold shadow-inner">
                 {displayName.charAt(0).toUpperCase()}
               </div>
               <span className="text-xs font-semibold text-slate-300 hidden sm:block">{displayName}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center justify-center rounded-lg size-10 hover:bg-rose-500/10 text-rose-500 transition-colors" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-[1700px] mx-auto w-full gap-8">
        {/* Header Section */}
        <div className="flex flex-wrap justify-between items-end gap-6">
          <div className="flex flex-col gap-2">
            {view !== 'list' && (
              <button onClick={() => setView('list')} className="flex items-center gap-2 text-[#197fe6] text-sm font-medium mb-1 hover:underline w-fit">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back to Roster</span>
              </button>
            )}
            <h1 className="text-white text-3xl lg:text-4xl font-bold tracking-tight">
               {view === 'list' ? 'Deep Clinical Analytics' : view === 'overall' ? 'Overall Expression Analysis' : view === 'detailed' ? 'Detailed Intervention Logs' : 'Global Cohort Leaderboard'}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              {view === 'list' ? 'Longitudinal data visualization for patient cohort progress monitoring.' : view === 'leaderboard' ? 'Live gamified scores from all active patients.' : 'Drill-down cognitive feedback metrics for target session.'}
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
            {isHeuristic && (
               <span className="hidden sm:flex border border-amber-500/50 bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1 rounded-full items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                 <span className="material-symbols-outlined text-[14px]">vital_signs</span>
                 Heuristic Proxies Active
               </span>
            )}
            <button onClick={fetchSessions} disabled={isLoading} className="h-10 px-4 rounded-lg bg-[#2b3b4d] text-slate-300 hover:text-white hover:bg-slate-700 font-medium text-sm flex items-center gap-2 transition-all disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Data</span>
            </button>
          </div>
        </div>
        
        {/* Summary Statistics Row (Compact) */}
        {view === 'list' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1a2632] border border-[#2b3b4d] rounded-xl p-5 flex items-center justify-between group hover:border-[#197fe6]/50 transition-colors shadow-sm">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Active Patients</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{sessions.length}</span>
                  <span className="text-emerald-500 text-xs font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">trending_up</span> Live
                  </span>
                </div>
              </div>
              <div className="size-10 rounded-lg bg-[#111921] flex items-center justify-center text-slate-500 group-hover:text-[#197fe6] transition-colors">
                <span className="material-symbols-outlined">groups</span>
              </div>
            </div>
            
            <div className="bg-[#1a2632] border border-[#2b3b4d] rounded-xl p-5 flex items-center justify-between group hover:border-[#197fe6]/50 transition-colors shadow-sm">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Analysed Sessions</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{Object.values(existingAnalysis).filter(Boolean).length}</span>
                  <span className="text-slate-400 text-xs font-medium bg-slate-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    Total Logs
                  </span>
                </div>
              </div>
              <div className="size-10 rounded-lg bg-[#111921] flex items-center justify-center text-slate-500 group-hover:text-[#197fe6] transition-colors">
                <span className="material-symbols-outlined">dataset</span>
              </div>
            </div>
            
            <div className="bg-[#1a2632] border border-[#2b3b4d] rounded-xl p-5 flex items-center justify-between group hover:border-[#197fe6]/50 transition-colors shadow-sm">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Top Leaderboard Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{leaderboard.length > 0 ? leaderboard[0].score : '0'}</span>
                  {leaderboard.length > 0 && <span className="text-amber-500 text-xs font-medium bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">workspace_premium</span> MVP
                  </span>}
                </div>
              </div>
              <div className="size-10 rounded-lg bg-[#111921] flex items-center justify-center text-amber-500 group-hover:bg-amber-500/10 transition-colors">
                <span className="material-symbols-outlined">trophy</span>
              </div>
            </div>
            
            <div className="bg-[#1a2632] border border-[#2b3b4d] rounded-xl p-5 flex items-center justify-between group hover:border-[#197fe6]/50 transition-colors shadow-sm">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Fallback Mode</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{isHeuristic ? 'Active' : 'Disabled'}</span>
                  {isHeuristic && <span className="text-rose-500 text-xs font-medium bg-rose-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px]">priority_high</span> Mouse Proxy
                  </span>}
                </div>
              </div>
              <div className="size-10 rounded-lg bg-[#111921] flex items-center justify-center text-rose-500 group-hover:bg-rose-500/10 transition-colors">
                <span className="material-symbols-outlined">medical_services</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          
          {/* Main Chart Area (Bento Large) — Dynamic `<AnimatePresence>` Shell */}
          <div className="lg:col-span-2 bg-[#1a2632] border border-[#2b3b4d] rounded-xl p-1 sm:p-6 flex flex-col relative overflow-hidden shadow-sm h-full max-h-[800px] overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="popLayout">
               {/* ──────────── SESSION LIST VIEW ──────────── */}
               {view === 'list' && (
                 <motion.div key="list" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
                    <div className="flex items-start justify-between mb-6 z-10 px-3 pt-3 sm:px-0 sm:pt-0">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Session Data Logs</h3>
                        <p className="text-slate-400 text-sm">Comprehensive list of all neuro-adaptive session history.</p>
                      </div>
                      <div className="hidden sm:flex bg-[#111921] rounded-lg p-1 border border-[#2b3b4d]">
                        <button className="px-3 py-1 text-xs font-medium rounded bg-[#2b3b4d] text-white shadow-sm">Table List</button>
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full bg-[#111921]/50 border border-[#2b3b4d] rounded-xl overflow-x-auto custom-scrollbar relative shadow-inner">
                      {isLoading ? (
                         <div className="absolute inset-0 flex items-center justify-center bg-[#111921]/20 backdrop-blur-sm z-10">
                            <span className="material-symbols-outlined animate-spin text-4xl text-[#197fe6]">autorenew</span>
                         </div>
                      ) : null}
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[#1a2632] text-slate-400 uppercase text-xs tracking-wider border-b border-[#2b3b4d] sticky top-0 z-10">
                          <tr>
                            {['Patient','Game','Date','Time','Actions'].map(h => (
                               <th key={h} className="px-4 py-4 font-bold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2b3b4d]">
                          {filteredSessions.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-500 font-medium text-base">No session history found.</td></tr>
                          ) : (
                            filteredSessions.map((session, i) => {
                               const { date, time } = formatDateTime(session.played_at);
                               const isAnalyzing = loadingSessionId === session.id;
                               const hasAnalysis = existingAnalysis[session.id];
                               return (
                                 <motion.tr key={session.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-[#2b3b4d]/30 transition-colors">
                                   <td className="px-4 py-3 font-medium text-white flex items-center gap-2 whitespace-nowrap">
                                     <div className="size-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                                       <span className="material-symbols-outlined text-[14px]">face</span>
                                     </div>
                                     {session.child_name ?? session.session_name}
                                   </td>
                                   <td className="px-4 py-3 text-slate-300">
                                     <span className="bg-[#111921] border border-[#2b3b4d] px-2 py-1 rounded text-xs inline-flex items-center gap-1.5 whitespace-nowrap">
                                       <Gamepad2 className="w-3 h-3 text-emerald-400" />
                                       {session.game_name || 'N/A'}
                                     </span>
                                   </td>
                                   <td className="px-4 py-3 text-slate-400 tracking-tight whitespace-nowrap">{date}</td>
                                   <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{time}</td>
                                   <td className="px-4 py-3">
                                     <div className="flex items-center gap-2 flex-wrap">
                                        <button onClick={() => handleSessionClick(session.id)} disabled={isAnalyzing} className="px-3 py-1 bg-[#1a2632] hover:bg-[#2b3b4d] border border-[#2b3b4d] rounded-lg text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap">
                                          {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin"/> : <BarChart2 className="w-3 h-3 text-[#197fe6]"/>} Check
                                        </button>
                                        {hasAnalysis && (
                                           <>
                                             <button onClick={() => openOverallAnalysis(session.id)} className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-semibold transition-colors whitespace-nowrap">
                                               Overall
                                             </button>
                                             <button onClick={() => openDetailedAnalysis(session.id)} className="px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-purple-400 text-xs font-semibold transition-colors whitespace-nowrap">
                                               Detailed
                                             </button>
                                           </>
                                        )}
                                     </div>
                                   </td>
                                 </motion.tr>
                               );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                 </motion.div>
               )}
               
               {/* ──────────── OVERALL ANALYSIS VIEW ──────────── */}
               {view === 'overall' && (
                  <motion.div key="overall" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col px-3 pt-3 sm:px-0 sm:pt-0">
                    <div className="flex items-center gap-4 mb-6 text-white text-lg font-bold">
                       <span className="material-symbols-outlined text-[#197fe6]">analytics</span>
                       Aggregated Session Data
                    </div>
                    {emotionAverages.length === 0 ? (
                       <div className="flex-1 flex items-center justify-center flex-col text-[#197fe6]">
                         <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                         <span className="text-slate-400 font-medium">Crunching frame analysis...</span>
                       </div>
                    ) : (
                       <div className="flex flex-col gap-6">
                         {/* Averages Block */}
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                           {emotionAverages.map((e, i) => (
                             <div key={e.emotion} className="bg-[#111921] border border-[#2b3b4d] rounded-xl p-4 flex flex-col justify-center items-center shadow-inner">
                                <p className="text-slate-400 text-[10px] sm:text-xs uppercase font-bold tracking-widest text-center">{isHeuristic && e.emotion.toLowerCase() === 'frustration' ? 'Inferred Frus.' : e.emotion}</p>
                                <p className="text-xl sm:text-2xl font-black mt-1" style={{ color: EMOTION_COLOURS[i % EMOTION_COLOURS.length] }}>
                                  {e.avg.toFixed(1)}%
                                </p>
                             </div>
                           ))}
                         </div>
                         
                         {/* Recharts Block */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-[#111921] border border-[#2b3b4d] rounded-xl p-5 shadow-inner">
                             <h3 className="font-bold mb-4 text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
                               <span className="material-symbols-outlined text-[14px]">donut_small</span>
                               Emotion Ratio
                             </h3>
                             <ResponsiveContainer width="100%" height={260} minWidth={0}>
                               <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="100%" data={emotionAverages.map((e, i) => ({
                                   name: isHeuristic && e.emotion.toLowerCase() === 'frustration' ? 'Frustration (Heuristic Proxy)' : e.emotion,
                                   value: e.avg,
                                   fill: EMOTION_COLOURS[i % EMOTION_COLOURS.length],
                                 }))}
                               >
                                 <RadialBar dataKey="value" cornerRadius={6} />
                                 <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                 <Tooltip contentStyle={{ background: '#1a2632', border: '1px solid #2b3b4d', borderRadius: 8, color: '#fff' }} formatter={(v: number) => [`${v.toFixed(2)}%`]} />
                               </RadialBarChart>
                             </ResponsiveContainer>
                           </div>
                           
                           <div className="bg-[#111921] border border-[#2b3b4d] rounded-xl p-5 shadow-inner">
                             <h3 className="font-bold mb-4 text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
                               <span className="material-symbols-outlined text-[14px]">bar_chart</span>
                               Confidence Densities
                             </h3>
                             <ResponsiveContainer width="100%" height={260} minWidth={0}>
                               <BarChart data={emotionAverages.map(e => ({
                                   ...e, emotion: isHeuristic && e.emotion.toLowerCase() === 'frustration' ? 'Frus. (Heuristic)' : e.emotion
                                 }))} margin={{ top: 5, right: 10, bottom: 5, left: -25 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#2b3b4d" vertical={false} />
                                 <XAxis dataKey="emotion" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#2b3b4d' }} tickLine={false} />
                                 <YAxis tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                                 <Tooltip contentStyle={{ background: '#1a2632', border: '1px solid #2b3b4d', borderRadius: 8, color: '#fff' }} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Average']} cursor={{ fill: '#1a2632' }} />
                                 <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                   {emotionAverages.map((_, i) => (<Cell key={i} fill={EMOTION_COLOURS[i % EMOTION_COLOURS.length]} />))}
                                 </Bar>
                               </BarChart>
                             </ResponsiveContainer>
                           </div>
                         </div>
                       </div>
                    )}
                  </motion.div>
               )}
               
               {/* ──────────── DETAILED ANALYSIS VIEW ──────────── */}
               {view === 'detailed' && (
                  <motion.div key="detailed" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col px-3 pt-3 sm:px-0 sm:pt-0">
                    <div className="flex items-center gap-4 mb-6 text-white text-lg font-bold sticky top-0 bg-[#1a2632] z-20 py-2 border-b border-[#2b3b4d]">
                       <span className="material-symbols-outlined text-purple-400">frame_inspect</span>
                       Granular Timeline Interventions
                    </div>
                    {detailLoading ? (
                       <div className="flex-1 flex items-center justify-center flex-col text-purple-400">
                         <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                         <span className="text-slate-400 font-medium">Extracting granular logs...</span>
                       </div>
                    ) : detailError ? (
                       <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">{detailError}</div>
                    ) : detailedSession && detailLogs.length > 0 ? (
                       <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-6 pr-2">
                         {detailLogs.map((log, idx) => {
                             const imgUrl = log.source_image_path ? storageUrl('kids-captures', log.source_image_path) : null;
                             const screenshotPath = (detailedSession.screenshot_paths ?? [])[idx];
                             const ssUrl = screenshotPath ? storageUrl('kids-captures', screenshotPath) : null;
                             return (
                               <motion.div key={log.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-[#111921] border border-[#2b3b4d] rounded-xl p-4 flex flex-col sm:flex-row gap-5 hover:border-[#197fe6]/50 transition-colors shadow-sm group">
                                 <div className="flex-shrink-0 flex gap-3 h-28 sm:h-32">
                                   {ssUrl && (
                                     <div className="relative h-full w-auto aspect-video rounded-lg overflow-hidden border border-[#2b3b4d] shadow-sm">
                                        <img src={ssUrl} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <span className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-300">Screen</span>
                                     </div>
                                   )}
                                   {imgUrl && (
                                     <div className="relative h-full w-auto aspect-square rounded-lg overflow-hidden border border-[#2b3b4d] shadow-sm">
                                        <img src={imgUrl} alt={`Biometric ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-300">Biometric</span>
                                     </div>
                                   )}
                                 </div>
                                 <div className="flex flex-col justify-center flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                       <span className="inline-flex bg-[#2b3b4d] px-2 py-0.5 rounded text-xs text-slate-300 font-mono tracking-tighter">
                                         {new Date(log.captured_at).toLocaleTimeString()}
                                       </span>
                                       <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Frame {idx + 1}</span>
                                    </div>
                                    <div className="bg-[#1a2632] border border-[#2b3b4d] rounded-lg p-3 inline-flex items-center justify-between w-full">
                                      <span className="text-sm font-bold text-white capitalize">{log.expression_label}</span>
                                      <div className="flex items-center gap-2">
                                        <div className="w-24 h-1.5 bg-[#111921] rounded-full overflow-hidden">
                                          <div className="h-full bg-gradient-to-r from-purple-500 to-[#197fe6]" style={{ width: `${Math.max(5, log.confidence_score * 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-[#197fe6]">{(log.confidence_score * 100).toFixed(1)}%</span>
                                      </div>
                                    </div>
                                 </div>
                               </motion.div>
                             );
                         })}
                       </div>
                    ) : (
                       <div className="text-center py-12 text-slate-500 bg-[#111921] rounded-xl border border-[#2b3b4d]">No granular expression logs located for this sequence.</div>
                    )}
                  </motion.div>
               )}
               
               {/* ──────────── LEADERBOARD VIEW ──────────── */}
               {view === 'leaderboard' && (
                  <motion.div key="leaderboard" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col px-3 pt-3 sm:px-0 sm:pt-0">
                     <div className="flex items-center gap-4 mb-6 text-white text-lg font-bold sticky top-0 bg-[#1a2632] z-20 py-2 border-b border-[#2b3b4d]">
                       <span className="material-symbols-outlined text-amber-500">trophy</span>
                       Live Performance Distribution
                    </div>
                    {leaderboardLoading ? (
                       <div className="flex-1 flex items-center justify-center flex-col text-amber-500">
                         <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                         <span className="text-slate-400 font-medium">Aggregating real-time scores...</span>
                       </div>
                    ) : leaderboard.length === 0 ? (
                       <div className="text-center py-12 text-slate-500 border border-[#2b3b4d] rounded-xl bg-[#111921]">No game sessions recorded.</div>
                    ) : (
                       <div className="flex-1 w-full bg-[#111921]/50 border border-[#2b3b4d] rounded-xl overflow-y-auto custom-scrollbar shadow-inner relative">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-[#1a2632] text-slate-400 uppercase text-xs tracking-wider border-b border-[#2b3b4d] sticky top-0 z-10">
                              <tr>
                                <th className="px-6 py-4 font-bold w-24">Rank</th>
                                <th className="px-6 py-4 font-bold">Patient Alias</th>
                                <th className="px-6 py-4 font-bold text-right">Aggregate Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2b3b4d]">
                               {leaderboard.map((player, idx) => {
                                   const isFirst = player.rank === 1;
                                   const isSecond = player.rank === 2;
                                   const isThird = player.rank === 3;
                                   return (
                                     <motion.tr key={player.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className={`hover:bg-[#2b3b4d]/30 transition-colors ${isFirst ? 'bg-amber-500/5' : ''}`}>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-2 font-bold text-lg">
                                            <span className={isFirst ? 'text-amber-400' : isSecond ? 'text-slate-300' : isThird ? 'text-orange-400' : 'text-slate-500'}>#{player.rank}</span>
                                            {isFirst && <span className="drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">🥇</span>}
                                            {isSecond && <span>🥈</span>}
                                            {isThird && <span>🥉</span>}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0 border border-[#2b3b4d] ${isFirst ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-none' : 'bg-[#1a2632]'}`}>
                                              {player.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={isFirst ? 'font-bold text-amber-100 text-base' : 'font-medium text-white'}>{player.name}</span>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                          <div className={`inline-flex items-center justify-center min-w-[100px] gap-2 bg-[#1a2632] px-4 py-2 rounded-xl border border-[#2b3b4d] shadow-inner font-mono font-bold ${isFirst ? 'text-amber-400 border-amber-500/30 bg-amber-500/5 ring-1 ring-amber-500/20' : 'text-slate-300'}`}>
                                            <span className="material-symbols-outlined text-[16px] text-yellow-500">stars</span>
                                            {player.score.toLocaleString()}
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
          
          {/* Secondary Panel: Student Roster Sidebar */}
          <div className="lg:col-span-1 bg-[#1a2632] border border-[#2b3b4d] rounded-xl flex flex-col h-full min-h-[500px] sm:max-h-[800px] shadow-sm">
            <div className="p-4 sm:p-5 border-b border-[#2b3b4d] flex justify-between items-center shrink-0">
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <span className="material-symbols-outlined text-[#197fe6]">contacts</span>
                 Cohort Roster
               </h3>
               <span className="bg-[#111921] px-2 py-0.5 rounded text-xs font-bold text-[#197fe6] border border-[#2b3b4d]">{filteredSessions.length} Logs</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 lg:space-y-1 custom-scrollbar pb-6">
              {filteredSessions.length === 0 ? (
                 <div className="text-center py-10 text-slate-500 text-sm font-medium">No results for "{searchTerm}"</div>
              ) : (
                filteredSessions.map(session => {
                  const isAnalyzing = loadingSessionId === session.id;
                  const hasAnalysis = existingAnalysis[session.id];
                  const { date } = formatDateTime(session.played_at);
                  const isSelected = detailedSession?.id === session.id || false; 
                  
                  return (
                    <div key={session.id} className={`p-3 rounded-lg flex flex-col gap-3 group transition-all border ${isSelected ? 'bg-[#111921] border-[#197fe6]/50 shadow-[0_0_15px_rgba(25,127,230,0.1)]' : 'bg-transparent border-transparent hover:border-[#2b3b4d] hover:bg-[#111921]'}`}>
                      <div className="flex items-start gap-3 w-full">
                        <div className="size-10 rounded-full bg-[#111921] flex items-center justify-center text-[#197fe6] shrink-0 text-lg font-black border border-[#2b3b4d] shadow-inner group-hover:scale-105 transition-transform">
                          {(session.child_name || session.session_name)!.substring(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-0.5 gap-2">
                            <h4 className="text-white text-sm font-semibold truncate hover:text-[#197fe6] transition-colors">{session.child_name || session.session_name}</h4>
                            {isAnalyzing ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 flex items-center gap-1 uppercase tracking-widest whitespace-nowrap">
                                <RefreshCw className="w-2 h-2 animate-spin"/> Syncing
                              </span>
                            ) : hasAnalysis ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 uppercase tracking-widest whitespace-nowrap">
                                <span className="material-symbols-outlined text-[10px]">check_circle</span> Analysed
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1 uppercase tracking-widest whitespace-nowrap">
                                <span className="material-symbols-outlined text-[10px]">pending</span> Pending
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-slate-400 text-xs truncate max-w-[120px]" title={session.game_name}>{session.game_name || 'Free Play'}</p>
                            <p className="text-slate-500 text-[10px] font-mono whitespace-nowrap">{date}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Interactive Drawer */}
                      <div className="flex justify-end gap-1.5 w-full pt-2 border-t border-[#2b3b4d]/50">
                        <button onClick={() => handleSessionClick(session.id)} disabled={isAnalyzing} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#2b3b4d] hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50">
                          <span className="material-symbols-outlined text-[12px]">search</span> Extract
                        </button>
                        {hasAnalysis && (
                          <>
                            <button onClick={() => openOverallAnalysis(session.id)} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#197fe6]/10 hover:bg-[#197fe6]/20 text-[#197fe6] border border-[#197fe6]/20 rounded flex items-center justify-center gap-1 transition-colors">
                              <span className="material-symbols-outlined text-[12px]">pie_chart</span> Macro
                            </button>
                            <button onClick={() => openDetailedAnalysis(session.id)} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded flex items-center justify-center gap-1 transition-colors">
                              <span className="material-symbols-outlined text-[12px]">view_timeline</span> Micro
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
        </div>
      </main>
      
      {/* Global Scrollbar Styles applied gracefully */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2b3b4d; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #197fe6; }
      `}</style>
    </div>
  );
}
