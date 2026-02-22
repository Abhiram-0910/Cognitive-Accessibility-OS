import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useCognitiveStore } from '../stores/cognitiveStore';
import { Users, Radio, Video, Play } from 'lucide-react';

interface ActivePeer {
  user_id: string;
  display_name: string;
  task_type: string;
  load_state: string;
}

export const BodyDoubling: React.FC = () => {
  const { cognitiveLoadScore, classification } = useCognitiveStore();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [taskType, setTaskType] = useState('Deep Work');
  const [activePeers, setActivePeers] = useState<ActivePeer[]>([]);

  useEffect(() => {
    // Initialize Supabase Realtime Channel
    const channel = supabase.channel('body-doubling-lobby', {
      config: {
        presence: { key: 'user_state' },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const peers: ActivePeer[] = [];
        
        for (const id in state) {
          // Flatten presence arrays
          state[id].forEach((pres: any) => peers.push(pres as ActivePeer));
        }
        
        // Remove self from the list for UI display purposes
        supabase.auth.getUser().then(({ data }) => {
           if (data.user) {
             setActivePeers(peers.filter(p => p.user_id !== data.user.id));
           }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleBroadcast = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase.channel('body-doubling-lobby');

    if (!isBroadcasting) {
      // Fetch profile name (mocked here for simplicity, ideally fetched from context)
      const displayName = `User-${user.id.substring(0,4)}`; 

      await channel.track({
        user_id: user.id,
        display_name: displayName,
        task_type: taskType,
        load_state: classification,
      });
      setIsBroadcasting(true);
    } else {
      await channel.untrack();
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="mb-12">
        <h1 className="text-3xl font-light text-slate-800 tracking-tight flex items-center gap-3">
          <Users className="w-8 h-8 text-teal-500" /> Focus Partnerships
        </h1>
        <p className="text-slate-500 mt-2">Bypass task paralysis through silent virtual co-working.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Broadcast Controls */}
        <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-teal-500" /> Your Signal
          </h3>
          
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Current Focus</label>
          <select 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 mb-6"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            disabled={isBroadcasting}
          >
            <option value="Deep Work">Deep Work (Silent)</option>
            <option value="Admin/Emails">Admin & Emails</option>
            <option value="Creative Synthesis">Creative Synthesis</option>
            <option value="Executive Function Bypass">Executive Function Bypass (High Friction)</option>
          </select>

          <button
            onClick={toggleBroadcast}
            className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
              isBroadcasting 
                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                : 'bg-teal-500 hover:bg-teal-600 text-white shadow-md'
            }`}
          >
            {isBroadcasting ? 'Stop Broadcasting' : <><Play className="w-4 h-4" /> Enter Lobby</>}
          </button>
        </div>

        {/* Active Lobby */}
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide mb-4">Available Partners</h3>
          
          {activePeers.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
              No one is currently broadcasting. Start your signal to invite others.
            </div>
          ) : (
            <div className="space-y-3">
              {activePeers.map((peer, idx) => (
                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-semibold text-slate-800">{peer.display_name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{peer.task_type} • Load: {peer.load_state.replace('_', ' ')}</p>
                  </div>
                  <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-slate-200">
                    <Video className="w-4 h-4" /> Request Sync
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};