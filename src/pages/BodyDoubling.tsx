import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { Users, Video, Clock, Shield, Loader2, Circle } from 'lucide-react';

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
          // Supabase presence groups by key, we take the first instance of each user
          const userState = newState[key][0] as any;
          if (userState) {
            users.push({
              user_id: key, // Using the presence key as a mock ID for display
              status: userState.status,
              online_at: userState.online_at,
              classification: userState.classification
            });
          }
        }
        setOnlineUsers(users);
        setIsConnecting(false);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[Realtime] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[Realtime] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Broadcast our own status to the room once connected
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id || `guest_${Math.random().toString(36).substring(7)}`;
          
          await room.track({
            user_id: userId,
            status: 'looking_for_partner',
            online_at: new Date().toISOString(),
            classification: classification // Share cognitive state to find matching energy
          });
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(room);
    };
  }, [classification]);

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
          {/* Active Lobby List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 animate-pulse" /> 
              Live Network
            </h3>

            {isConnecting ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
                <p>Connecting to secure presence network...</p>
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-500">
                You are currently the only one in the lobby. Keep it open, partners usually join at the top of the hour.
              </div>
            ) : (
              onlineUsers.map((user, idx) => (
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
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 shadow-sm">
                    <Video className="w-4 h-4" /> Request Focus Session
                  </button>
                </div>
              ))
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