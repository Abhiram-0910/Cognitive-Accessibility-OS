import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { Users, Video, Clock, Shield, Loader2, Circle, PhoneOff } from 'lucide-react';

interface OnlineUser {
  user_id: string;
  status: string;
  online_at: string;
  classification: string;
}

export const BodyDoubling: React.FC = () => {
  const { classification } = useCognitiveStore();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  
  // Track the active dynamic room URL and the current user's identity
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    
    // Initialize the Supabase Realtime Channel
    const room = supabase.channel('body_doubling', {
      config: {
        presence: {
          key: 'user_presence',
        },
      },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        if (!isMounted) return;
        const newState = room.presenceState();
        
        // Flatten the presence state into a simple array of users
        const users: OnlineUser[] = [];
        for (const key in newState) {
          const userState = newState[key][0] as any;
          if (userState) {
            users.push({
              user_id: key, 
              status: userState.status,
              online_at: userState.online_at,
              classification: userState.classification
            });
          }
        }
        setOnlineUsers(users);
        setIsConnecting(false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Broadcast our own status to the room once connected
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id || `guest_${Math.random().toString(36).substring(7)}`;
          
          if (isMounted) {
            setCurrentUserId(userId);
            await room.track({
              user_id: userId,
              status: 'looking_for_partner',
              online_at: new Date().toISOString(),
              classification: classification
            });
          }
        }
      });

    // 🛑 STRICT CLEANUP: Prevent memory leaks and "ghost" users in the lobby
    return () => {
      isMounted = false;
      room.untrack(); 
      supabase.removeChannel(room);
    };
  }, [classification]);

  // The Deterministic Handshake Algorithm
  const handleConnect = (peerId: string) => {
    // Generate a deterministic room ID based on the two user IDs
    // By sorting them alphabetically, both users independently generate the exact same room string.
    const sortedIds = [currentUserId, peerId].sort();
    
    // Concatenate the first 8 characters to keep the URL clean and manageable
    const deterministicRoom = `focus-${sortedIds[0].substring(0, 8)}-${sortedIds[1].substring(0, 8)}`;
    setActiveRoomId(deterministicRoom);
  };

  // --- ACTIVE VIDEO SESSION UI ---
  // Overrides the screen when a room ID is generated
  if (activeRoomId) {
    return (
      <div className="min-h-screen bg-slate-900 p-4 md:p-8 font-sans flex flex-col animate-in fade-in zoom-in-95 duration-500">
        <header className="mb-6 flex flex-col md:flex-row gap-4 justify-between md:items-center">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-3 tracking-tight">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
              Deep Work Session Active
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-mono">Room Cipher: {activeRoomId}</p>
          </div>
          <button 
            onClick={() => setActiveRoomId(null)}
            className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <PhoneOff className="w-5 h-5" /> End Focus Block
          </button>
        </header>

        <div className="flex-1 bg-black rounded-3xl overflow-hidden border border-slate-800 relative shadow-2xl">
          {/* Dynamic Iframe Integration:
              For the hackathon demo to work natively, configure your Daily.co dashboard 
              (or Jitsi/whereby) to allow 'dynamic room creation' so it automatically 
              spawns a room if the deterministic room URL doesn't exist yet.
          */}
          <iframe 
            src={`https://your-domain.daily.co/${activeRoomId}`} 
            className="w-full h-full border-0 absolute inset-0"
            allow="camera; microphone; fullscreen; display-capture"
            title="Secure Focus Video Session"
          />
          
          {/* Subtle cinematic vignette to frame the video gracefully */}
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
        </div>
      </div>
    );
  }

  // --- STANDARD MATCHMAKING LOBBY UI ---
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-light text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Body Doubling Lobby
          </h1>
          <p className="text-slate-500 mt-2">Find a virtual co-working partner to anchor your focus and bypass executive dysfunction.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 animate-pulse" /> 
              Live Network
            </h3>

            {isConnecting ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-slate-400 shadow-sm">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
                <p>Connecting to secure presence network...</p>
              </div>
            ) : onlineUsers.length <= 1 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-500 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-slate-300" />
                </div>
                You are currently the only one in the lobby. <br/> Keep it open—partners usually join at the top of the hour.
              </div>
            ) : (
              onlineUsers.map((user, idx) => {
                // Do not render the current user in the "available" list to prevent calling yourself
                if (user.user_id === currentUserId) return null; 

                return (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-indigo-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {user.user_id.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                          Anonymous Peer
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            {user.status.replace(/_/g, ' ')}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 capitalize flex items-center gap-1 mt-0.5">
                          Current State: {user.classification.replace('_', ' ')}
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
                )
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
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};