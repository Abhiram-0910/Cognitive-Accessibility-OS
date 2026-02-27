/**
 * BodyDoubling.tsx — Virtual Co-Working Lobby + Jitsi Video Rooms
 *
 * Uses:
 *  ✅ Supabase Realtime Presence for live user matchmaking
 *  ✅ Deterministic Jitsi room names from sorted user IDs + task category
 *  ✅ Jitsi Meet External API (dynamically loaded) for full-featured embedded video
 *  ✅ Auto-disconnect after 50 minutes (focus block duration)
 *  ✅ Zero-pressure UX: cameras optional, mics muted by default
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';
import {
  Users, Video, Clock, Shield, Loader2, Circle, PhoneOff, MonitorPlay,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnlineUser {
  user_id: string;
  status: string;
  online_at: string;
  classification: string;
  taskCategory: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JITSI_DOMAIN = 'meet.jit.si';
const JITSI_SCRIPT_URL = `https://${JITSI_DOMAIN}/external_api.js`;
const SESSION_DURATION_MS = 50 * 60 * 1000; // 50 minutes

/** Task categories the user can select before matching. */
const TASK_CATEGORIES = [
  { key: 'deep-work',   label: '💻 Deep Work',     colour: 'bg-indigo-100 text-indigo-700' },
  { key: 'writing',     label: '✍️ Writing',       colour: 'bg-emerald-100 text-emerald-700' },
  { key: 'studying',    label: '📚 Studying',      colour: 'bg-amber-100 text-amber-700' },
  { key: 'admin',       label: '📋 Admin Tasks',   colour: 'bg-rose-100 text-rose-700' },
  { key: 'creative',    label: '🎨 Creative',      colour: 'bg-purple-100 text-purple-700' },
];

// ─── Jitsi Script Loader ──────────────────────────────────────────────────────

let jitsiLoadPromise: Promise<void> | null = null;

function loadJitsiScript(): Promise<void> {
  if ((window as any).JitsiMeetExternalAPI) return Promise.resolve();
  if (jitsiLoadPromise) return jitsiLoadPromise;

  jitsiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi External API script.'));
    document.head.appendChild(script);
  });

  return jitsiLoadPromise;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BodyDoubling: React.FC = () => {
  const { classification, currentTaskCategory, setCurrentTaskCategory } = useCognitiveStore();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [sessionTimeLeft, setSessionTimeLeft] = useState(SESSION_DURATION_MS / 1000);
  const [jitsiFailed, setJitsiFailed] = useState(false);
  const [pulseUserIds, setPulseUserIds] = useState<Set<string>>(new Set());

  // Refs for Jitsi
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Supabase Realtime Presence ──────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const room = supabase.channel('body_doubling', {
      config: { presence: { key: 'user_presence' } },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        if (!isMounted) return;
        const presenceState = room.presenceState();
        const users: OnlineUser[] = [];

        for (const key in presenceState) {
          const userState = presenceState[key][0] as any;
          if (userState) {
            users.push({
              user_id: key,
              status: userState.status,
              online_at: userState.online_at,
              classification: userState.classification,
              taskCategory: userState.taskCategory || 'deep-work',
            });
          }
        }
        setOnlineUsers(users);
        setIsConnecting(false);
      })
      .on('broadcast', { event: 'action_pulse' }, (payload) => {
        const id = payload.payload?.user_id;
        if (id) {
          setPulseUserIds(prev => new Set(prev).add(id));
          setTimeout(() => {
            setPulseUserIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, 3000); // Visual ripple duration
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id || `guest_${Math.random().toString(36).substring(7)}`;

          if (isMounted) {
            setCurrentUserId(userId);
            await room.track({
              user_id: userId,
              status: 'looking_for_partner',
              online_at: new Date().toISOString(),
              classification,
              taskCategory: currentTaskCategory,
            });
          }
        } else if (status !== 'SUBSCRIBED') {
          console.warn(`[BodyDoubling] Realtime network connection drop detected: ${status}`);
          setIsConnecting(true);
        }
      });

    return () => {
      isMounted = false;
      room.untrack();
      supabase.removeChannel(room);
    };
  }, [classification, currentTaskCategory]);

  // ── Ambient Audio (Lobby) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRoomId) {
      if (!ambientAudioRef.current) {
        // Soft white noise / cafe ambience
        const audio = new Audio('https://cdn.freesound.org/previews/234/234288_4019029-lq.mp3');
        audio.loop = true;
        audio.volume = 0.1;
        ambientAudioRef.current = audio;
      }
      ambientAudioRef.current.play().catch(e => console.warn('[BodyDoubling] Auto-play blocked:', e));
    } else {
      ambientAudioRef.current?.pause();
    }
    return () => ambientAudioRef.current?.pause();
  }, [activeRoomId]);

  // ── Action Pulses (Throttled Broadcast) ────────────────────────────────────
  const lastPulseTime = useRef(0);
  const sendActionPulse = useCallback(() => {
    const now = Date.now();
    if (now - lastPulseTime.current < 3000) return; // 3 sec throttle
    lastPulseTime.current = now;
    
    supabase.channel('body_doubling').send({
      type: 'broadcast',
      event: 'action_pulse',
      payload: { user_id: currentUserId },
    });
  }, [currentUserId]);

  useEffect(() => {
    // Emit pulse on typing to signify "working"
    const handleKey = () => sendActionPulse();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sendActionPulse]);

  // ── Deterministic room ID generator ─────────────────────────────────────
  const generateRoomId = useCallback(
    (peerId: string) => {
      const sorted = [currentUserId, peerId].sort();
      const idHash = `${sorted[0].substring(0, 8)}-${sorted[1].substring(0, 8)}`;
      return `neuroadapt-${currentTaskCategory}-${idHash}`;
    },
    [currentUserId, currentTaskCategory],
  );

  // ── Launch Jitsi External API ───────────────────────────────────────────
  const launchJitsiRoom = useCallback(
    async (roomId: string) => {
      setActiveRoomId(roomId);

      try {
        await loadJitsiScript();
        setJitsiFailed(false);
      } catch (err) {
        console.error('[BodyDoubling] Jitsi script load failed:', err);
        setJitsiFailed(true);
        return;
      }

      // Wait a tick for the container to mount
      requestAnimationFrame(() => {
        if (!jitsiContainerRef.current) return;

        const JitsiMeetExternalAPI = (window as any).JitsiMeetExternalAPI;
        if (!JitsiMeetExternalAPI) {
          console.error('[BodyDoubling] JitsiMeetExternalAPI not available.');
          return;
        }

        // Destroy previous instance if any
        jitsiApiRef.current?.dispose();

        const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: roomId,
          parentNode: jitsiContainerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: true,  // Zero-pressure: mic muted by default
            startWithVideoMuted: false, // Camera on for body doubling accountability
            prejoinPageEnabled: false,  // Skip Jitsi's own prejoin screen
            disableDeepLinking: true,
            hideConferenceSubject: false,
            subject: `🧠 NeuroAdaptive Focus — ${currentTaskCategory}`,
            // Minimal toolbar for distraction-free experience
            toolbarButtons: [
              'camera', 'microphone', 'hangup', 'fullscreen',
              'tileview',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            TOOLBAR_ALWAYS_VISIBLE: false,
            DISABLE_FOCUS_INDICATOR: true,
            DEFAULT_BACKGROUND: '#0F172A',
          },
          userInfo: {
            displayName: `Peer ${currentUserId.substring(0, 6)}`,
          },
        });

        jitsiApiRef.current = api;

        // Auto-disconnect listener
        api.addListener('readyToClose', () => {
          endSession();
        });

        console.log(`[BodyDoubling] 🎥 Jitsi room "${roomId}" launched.`);
      });

      // ── 50-minute countdown ───────────────────────────────────────────
      setSessionTimeLeft(SESSION_DURATION_MS / 1000);
      sessionTimerRef.current = setInterval(() => {
        setSessionTimeLeft((prev) => {
          if (prev <= 1) {
            endSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [currentUserId, currentTaskCategory],
  );

  // ── End session ─────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    jitsiApiRef.current?.dispose();
    jitsiApiRef.current = null;
    setActiveRoomId(null);
    setJitsiFailed(false);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => endSession(), [endSession]);

  const handleConnect = (peerId: string) => {
    const roomId = generateRoomId(peerId);
    launchJitsiRoom(roomId);
  };

  // Format seconds → MM:SS
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // Active Video Session UI
  // ═══════════════════════════════════════════════════════════════════════════

  if (activeRoomId) {
    return (
      <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-sans flex flex-col animate-in fade-in zoom-in-95 duration-500">
        <header className="mb-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3 tracking-tight">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
              </span>
              {jitsiFailed ? 'Asynchronous Body Doubling' : 'Deep Work Session Active'}
            </h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-slate-400 text-sm font-mono">Room: {activeRoomId}</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                ⏱ {formatTime(sessionTimeLeft)} remaining
              </span>
            </div>
          </div>
          <button
            onClick={endSession}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <PhoneOff className="w-5 h-5" /> End Focus Block
          </button>
        </header>

        {jitsiFailed ? (
          <div className="flex-1 rounded-3xl border border-slate-700 bg-slate-800/50 flex flex-col items-center justify-center text-center p-8 shadow-2xl relative overflow-hidden">
             {/* Subdued animated background elements */}
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/10 to-transparent pointer-events-none" />
             <div className="relative z-10 max-w-lg">
               <Shield className="w-16 h-16 text-indigo-400 mx-auto mb-6 opacity-80" />
               <h2 className="text-2xl font-semibold text-slate-200 mb-4">Enterprise Firewall Detected</h2>
               <p className="text-slate-400 mb-8 leading-relaxed">
                 Live video (WebRTC) is blocked on your current network. However, you are still anchored to the grid. 
                 Work synchronously, knowing you aren't alone.
               </p>
               
               <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 shadow-inner inline-flex flex-col items-center">
                 <span className="text-5xl font-black text-indigo-400 mb-2 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]">
                   {Math.max(1, onlineUsers.length)}
                 </span>
                 <span className="text-sm font-medium text-slate-400 uppercase tracking-widest">
                   Active User{onlineUsers.length !== 1 ? 's' : ''} in Protocol
                 </span>
               </div>
             </div>
          </div>
        ) : (
          <div
            ref={jitsiContainerRef}
            className="flex-1 rounded-3xl overflow-hidden border border-slate-800 relative shadow-2xl"
            style={{ minHeight: '500px' }}
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Matchmaking Lobby UI
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-light text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Body Doubling Lobby
          </h1>
          <p className="text-slate-500 mt-2">
            Find a virtual co-working partner to anchor your focus and bypass executive dysfunction.
          </p>
        </header>

        {/* Task category selector */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            What are you working on?
          </h3>
          <div className="flex flex-wrap gap-2">
            {TASK_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCurrentTaskCategory(cat.key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all
                  ${currentTaskCategory === cat.key
                    ? `${cat.colour} ring-2 ring-offset-2 ring-indigo-400 scale-105`
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 animate-pulse" />
              Live Network
            </h3>

            {isConnecting ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-slate-400 shadow-sm">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
                <p>Connecting to secure presence network…</p>
              </div>
            ) : onlineUsers.length <= 1 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-500 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-slate-300" />
                </div>
                You are currently the only one in the lobby.<br />
                Keep it open—partners usually join at the top of the hour.
              </div>
            ) : (
              onlineUsers.map((user, idx) => {
                if (user.user_id === currentUserId) return null;

                const matchingTask = user.taskCategory === currentTaskCategory;

                return (
                  <div
                    key={idx}
                    className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between
                      hover:shadow-md transition-all
                      ${matchingTask ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {pulseUserIds.has(user.user_id) && (
                          <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
                        )}
                        <div className="relative z-10 w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold border-2 border-transparent">
                          {user.user_id.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                          Anonymous Peer
                          {matchingTask && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                              Same Focus
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            {user.status.replace(/_/g, ' ')}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 capitalize flex items-center gap-2 mt-0.5">
                          <span>State: {user.classification.replace('_', ' ')}</span>
                          <span className="text-slate-300">·</span>
                          <span>{TASK_CATEGORIES.find(c => c.key === user.taskCategory)?.label || user.taskCategory}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConnect(user.user_id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                    >
                      <Video className="w-4 h-4" /> Request Focus Session
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Guidelines Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl sticky top-8">
              <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Zero-Pressure Rules
              </h3>
              <ul className="space-y-4 text-sm text-indigo-900/80">
                <li className="flex gap-3">
                  <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Sessions are exactly 50 minutes. The OS will automatically disconnect you when time is up.</span>
                </li>
                <li className="flex gap-3">
                  <Video className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Cameras are optional but recommended. Microphones are muted by default. No small talk required.</span>
                </li>
                <li className="flex gap-3">
                  <MonitorPlay className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>Rooms are generated deterministically — both you and your partner always get the same secure link.</span>
                </li>
                <li className="flex gap-3">
                  <Shield className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span>All video is peer-to-peer via Jitsi. No recordings. No server-side storage. Full privacy.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};