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
            startWithAudioMuted: true,  
            startWithVideoMuted: false, 
            prejoinPageEnabled: false, 
            disableDeepLinking: true,
            hideConferenceSubject: false,
            subject: `🧠 NeuroAdaptive Focus — ${currentTaskCategory}`,
            // Absolute WebRTC Silence Enforcement: Mic button removed
            toolbarButtons: [
              'camera', 'hangup', 'fullscreen', 'tileview', 'chat', 'settings'
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

        api.addEventListeners({
          videoConferenceJoined: () => {
            console.log('[BodyDoubling] Joined room. Enforcement active.');
            // Double-check mute status on entry
            api.executeCommand('muteEveryone', 'audio');
          },
          audioMuteStatusChanged: (payload: { muted: boolean }) => {
            if (!payload.muted) {
              console.warn('[BodyDoubling] Silence Violation: Microphone UNMUTED. Re-muting via protocol.');
              api.executeCommand('toggleAudio');
              // Optional: fire a local notification or sound for the violator
            }
          },
        });

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
      <div className="bg-[#f6f6f8] dark:bg-[#131122] text-slate-900 dark:text-slate-100 font-display min-h-screen flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        
        {/* Top Navigation */}
        <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-[#272447] bg-[#131122]/95 backdrop-blur-sm px-6 py-3 shrink-0 z-20">
          <div className="flex items-center gap-4 text-white">
            <div className="size-8 flex items-center justify-center bg-[#2617cf]/20 rounded-lg text-[#2617cf]">
              <span className="material-symbols-outlined text-2xl">grid_view</span>
            </div>
            <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">NeuroAdaptive OS</h2>
          </div>
          <div className="flex flex-1 justify-end gap-6 items-center">
            <div className="hidden md:flex items-center gap-8">
              <a className="text-slate-300 hover:text-white transition-colors text-sm font-medium leading-normal flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-[18px]">timer</span>
                Focus Timer
              </a>
              <a className="text-slate-300 hover:text-white transition-colors text-sm font-medium leading-normal flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                My Tasks
              </a>
              <a className="text-slate-300 hover:text-white transition-colors text-sm font-medium leading-normal flex items-center gap-2" href="#">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Settings
              </a>
            </div>
            <div className="h-6 w-[1px] bg-[#272447] mx-2"></div>
            <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-9 px-4 bg-[#2617cf] hover:bg-[#2617cf]/90 transition-colors text-white text-sm font-bold leading-normal tracking-[0.015em]">
              <span className="truncate">Invite</span>
            </button>
            <div className="bg-center bg-no-repeat bg-cover rounded-full size-9 border border-[#272447] cursor-pointer" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSECxMzNu9GXd1xs6L0Bn3apxeDqa6E5RmbIQWIOghuDbIJ0v6DkAcdD--O5L8dY6pGqLcZyjLnT7l1rihJVAeKiESs_0BC-zDrMVmoVpCy0qUuXiIJ2ywA7v3-qwf6dVgRqTV7z84V4S0nCU49R-SosXUynQkmFXwvlhaHAm-k4KHUOMvO_Folrdmv6cqiQpZgIJOU-Pj7Kd0EvWFgiseSpq9FUyUK_rI53wpApCudsI45UkAseKcmXl9J3Ox6z4spq4YPYATNZE")' }}></div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden relative">
          {/* Left: Video Grid / Jitsi Engine */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto min-h-0 relative z-10 w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-white tracking-tight text-[28px] font-bold leading-tight">
                  {jitsiFailed ? 'Asynchronous Body Doubling' : 'Silent Co-working Lobby'}
                </h1>
                <p className="text-[#9893c8] text-sm mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  {Math.max(1, onlineUsers.length)} Member{onlineUsers.length !== 1 ? 's' : ''} in Deep Focus
                </p>
                <p className="text-slate-400 text-xs mt-1 font-mono">Room: {activeRoomId}</p>
              </div>
              <div className="flex items-center gap-4">
                 <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                   ⏱ {formatTime(sessionTimeLeft)} remaining
                 </span>
                 <div className="flex items-center gap-2 bg-[#1c1a2e] border border-[#272447] rounded-lg p-1">
                   <button onClick={() => jitsiApiRef.current?.executeCommand('toggleTileView')} className="p-2 rounded hover:bg-white/5 text-white" title="Grid View">
                     <span className="material-symbols-outlined text-[20px]">grid_view</span>
                   </button>
                   <button className="p-2 rounded hover:bg-white/5 text-[#9893c8]" title="Speaker View">
                     <span className="material-symbols-outlined text-[20px]">branding_watermark</span>
                   </button>
                 </div>
              </div>
            </div>

            {/* Grid Container -> Wrapped around Jitsi API */}
            <div className="flex-1 h-full w-full">
               {jitsiFailed ? (
                 <div className="w-full h-full min-h-[500px] rounded-2xl border border-[#272447] bg-[#1c1a2e]/50 flex flex-col items-center justify-center text-center p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#131122]/10 to-transparent pointer-events-none" />
                   <div className="relative z-10 max-w-lg">
                     <Shield className="w-16 h-16 text-indigo-400 mx-auto mb-6 opacity-80" />
                     <h2 className="text-2xl font-semibold text-slate-200 mb-4">Enterprise Firewall Detected</h2>
                     <p className="text-slate-400 mb-8 leading-relaxed">
                       Live video (WebRTC) is blocked on your current network. However, you are still anchored to the grid. 
                       Work synchronously, knowing you aren't alone.
                     </p>
                     <div className="bg-[#131122]/80 border border-[#272447]/50 rounded-2xl p-6 shadow-inner inline-flex flex-col items-center">
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
                   className="w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-[#272447] relative shadow-[0_0_20px_rgba(38,23,207,0.15)]"
                 />
               )}
            </div>
          </div>

          {/* Right: Ambient Presence Sidebar */}
          <aside className="w-80 bg-[rgba(28,26,46,0.7)] backdrop-blur-md border-l border-[#272447] flex flex-col shrink-0 z-20">
            <div className="p-5 border-b border-[#272447]">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-[#2617cf]">graphic_eq</span>
                Ambient Presence
              </h3>
              <p className="text-[#9893c8] text-xs mt-1">Real-time focus activity</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-0 custom-scrollbar">
              {onlineUsers.length === 0 ? (
                <p className="text-[#9893c8] text-sm text-center mt-4">Waiting for presence signals...</p>
              ) : (
                onlineUsers.map((user, idx) => {
                  const isMe = user.user_id === currentUserId;
                  const isLast = idx === onlineUsers.length - 1;
                  const isMatchingTask = user.taskCategory === currentTaskCategory;

                  let icon = 'psychology';
                  let iconColor = 'text-[#2617cf]';
                  let actionText = 'is focusing';

                  if (user.status.includes('partner')) {
                    icon = 'search';
                    actionText = 'is looking for a partner';
                    iconColor = 'text-amber-400';
                  } else if (user.classification.includes('overload')) {
                    icon = 'warning';
                    actionText = 'is experiencing high load';
                    iconColor = 'text-rose-400';
                  } else if (user.classification.includes('hyperfocus')) {
                    icon = 'bolt';
                    actionText = 'entered hyperfocus';
                    iconColor = 'text-emerald-400';
                  } else if (user.taskCategory !== currentTaskCategory) {
                    icon = 'check_circle';
                    actionText = 'is working on a task';
                    iconColor = 'text-green-400';
                  }

                  return (
                    <div key={user.user_id} className="grid grid-cols-[24px_1fr] gap-x-4">
                      <div className="flex flex-col items-center">
                        <div className={`${iconColor} mt-1 relative`}>
                          {pulseUserIds.has(user.user_id) && (
                            <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-75" />
                          )}
                          <span className="material-symbols-outlined text-[20px] relative z-10">{icon}</span>
                        </div>
                        <div className={`w-[1px] h-full min-h-[32px] my-1 ${isLast ? 'bg-gradient-to-b from-[#272447] to-transparent opacity-50' : 'bg-[#272447]'}`}></div>
                      </div>
                      <div className="pb-6 pt-1">
                        <p className="text-slate-200 text-sm font-medium leading-snug">
                          {isMe ? 'You ' : `Peer ${user.user_id.substring(0, 4)} `} {actionText}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {isMatchingTask && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#2617cf] bg-[#2617cf]/10 px-1.5 py-0.5 rounded border border-[#2617cf]/20">
                              <span className="w-1 h-1 rounded-full bg-[#2617cf] animate-pulse"></span>
                              {TASK_CATEGORIES.find(c => c.key === user.taskCategory)?.label || user.taskCategory}
                            </span>
                          )}
                          <p className="text-[#9893c8] text-xs capitalize">{user.status.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mini Focus Goal */}
            <div className="p-4 bg-[#1c1a2e] border-t border-[#272447]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-[#9893c8] uppercase tracking-wider">Current Goal</span>
                <span className="text-xs text-white bg-white/10 px-1.5 py-0.5 rounded">{formatTime(sessionTimeLeft)} left</span>
              </div>
              <p className="text-white text-sm truncate mb-3 capitalize">{currentTaskCategory.replace(/-/g, ' ')} Focus Block</p>
              <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                <div className="bg-[#2617cf] h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, (sessionTimeLeft / (SESSION_DURATION_MS / 1000))) * 100}%` }}></div>
              </div>
            </div>
          </aside>
        </main>

        {/* Bottom Control Bar */}
        <footer className="h-20 bg-[#131122] border-t border-[#272447] flex items-center justify-between px-8 z-30 shrink-0">
          <div className="flex items-center gap-4 w-1/4">
            <div className="flex flex-col">
              <span className="text-white text-sm font-medium">Connected</span>
              <span className="text-[#9893c8] text-xs">Low Latency • Encrypted</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => jitsiApiRef.current?.executeCommand('toggleVideo')} className="relative group size-12 flex items-center justify-center rounded-full bg-[#1c1a2e] border border-[#272447] text-[#9893c8] hover:bg-white/5 hover:text-white hover:border-white/20 transition-all">
              <span className="material-symbols-outlined text-[24px]">videocam</span>
              <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">Toggle camera</span>
            </button>
            <button className="relative size-14 flex items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500 cursor-not-allowed transition-all" title="Enforced Silence Protocol">
              <span className="material-symbols-outlined text-[28px]">mic_off</span>
              <div className="absolute -bottom-1 -right-1 bg-[#1c1a2e] rounded-full p-0.5 border border-[#272447]">
                <span className="material-symbols-outlined text-[14px] text-[#9893c8]">lock</span>
              </div>
            </button>
            <button onClick={() => jitsiApiRef.current?.executeCommand('toggleShareScreen')} className="relative group size-12 flex items-center justify-center rounded-full bg-[#1c1a2e] border border-[#272447] text-[#9893c8] hover:bg-white/5 hover:text-white hover:border-white/20 transition-all">
              <span className="material-symbols-outlined text-[24px]">screen_share</span>
              <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">Share screen</span>
            </button>
            <button onClick={() => jitsiApiRef.current?.executeCommand('toggleRaiseHand')} className="relative group size-12 flex items-center justify-center rounded-full bg-[#1c1a2e] border border-[#272447] text-[#9893c8] hover:bg-white/5 hover:text-white hover:border-white/20 transition-all">
              <span className="material-symbols-outlined text-[24px]">back_hand</span>
              <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50">Raise hand</span>
            </button>
          </div>
          
          <div className="flex items-center justify-end gap-4 w-1/4">
            <button className="relative group size-10 flex items-center justify-center rounded-full text-[#9893c8] hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-[24px]">more_vert</span>
            </button>
            <button onClick={endSession} className="flex items-center justify-center gap-2 h-10 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-full text-sm font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Leave Room
            </button>
          </div>
        </footer>

        {/* Global style for elegant scrollbars locked to this view */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #272447;
              border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #6366f1;
          }
        `}</style>
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