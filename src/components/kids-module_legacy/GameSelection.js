import React from "react";
import Navbar from "./Logout_bar";
import { useNavigate } from "react-router-dom";
import { useCognitiveStore } from "../../stores/cognitiveStore";
import { Brain, Sparkles, LogOut, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { motion } from "framer-motion";

const GameSelection = () => {
  const navigate = useNavigate();
  // Get the username (or fallback) right from the active session profile
  const [profile, setProfile] = React.useState(null);
  
  React.useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  const games = [
    {
      id: 1,
      title: "CRACK-THE-QUIZ",
      description: "Test your knowledge by answering fun visual questions!",
      icon: <Brain className="w-8 h-8 text-teal-500" />,
      color: "from-teal-400 to-emerald-500",
      path: "/kids/play/1",
      gameName: "CRACK-THE-QUIZ"
    },
    {
      id: 2,
      title: "DRAG-&-SPELL",
      description: "Drag the missing letter to complete the object's name!",
      icon: <Sparkles className="w-8 h-8 text-amber-500" />,
      color: "from-amber-400 to-orange-500",
      path: "/kids/play/2",
      gameName: "DRAG-&-SPELL"
    },
  ];

  if (!profile) return <div className="text-center mt-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-12 max-w-5xl mx-auto bg-white p-4 px-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-xl font-bold text-slate-800">Hi, {profile.full_name || 'Explorer'}! 🚀</h1>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-semibold text-sm">Exit</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto space-y-8 text-center">
        <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">Choose Your Adventure</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          {games.map((game, i) => (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={game.id}
              onClick={() => navigate(game.path, { state: { username: profile.full_name, gameName: game.gameName } })}
              className="bg-white group cursor-pointer rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 relative overflow-hidden text-left"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${game.color} opacity-10 rounded-bl-[100px] transition-transform group-hover:scale-110`} />
              
              <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 shadow-sm">
                {game.icon}
              </div>
              
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{game.title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{game.description}</p>
              
              <div className="mt-8">
                <span className={`inline-flex items-center font-bold text-sm bg-gradient-to-r ${game.color} bg-clip-text text-transparent`}>
                  Play Now →
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameSelection;
