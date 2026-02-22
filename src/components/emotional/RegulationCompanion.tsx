import React, { useState, useEffect, useRef } from 'react';
import { Wind, X } from 'lucide-react';

export const RegulationCompanion: React.FC = () => {
  const [text, setText] = useState('');
  const [isFlooded, setIsFlooded] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  
  // Heuristic Trackers
  const lastKeyTime = useRef<number>(Date.now());
  const rapidKeystrokes = useRef<number>(0);
  
  useEffect(() => {
    // Basic local heuristics for emotional flooding:
    // 1. High density of exclamation/question marks
    const punctuationDensity = (text.match(/[!?]{2,}/g) || []).length;
    // 2. All caps phrases
    const capsDensity = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
    // 3. Absolute words often used in distress
    const absoluteWords = (text.match(/\b(always|never|impossible|ruined|hate)\b/gi) || []).length;

    if (punctuationDensity > 1 || capsDensity > 2 || absoluteWords > 1 || rapidKeystrokes.current > 30) {
      if (!isFlooded) setIsFlooded(true);
    } else {
      setIsFlooded(false);
    }
  }, [text, isFlooded]);

  const handleKeyDown = () => {
    const now = Date.now();
    if (now - lastKeyTime.current < 100) { // Extremely fast typing (often anger/panic)
      rapidKeystrokes.current += 1;
    } else {
      rapidKeystrokes.current = Math.max(0, rapidKeystrokes.current - 1); // Decay
    }
    lastKeyTime.current = now;
  };

  return (
    <div className="relative w-full mt-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-800 tracking-wide mb-4">Draft Important Message</h3>
      
      <div className="relative">
        <textarea
          className={`w-full p-4 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 text-slate-700 resize-none text-sm transition-colors ${
            isFlooded ? 'border-amber-300 focus:ring-amber-400' : 'border-slate-200 focus:ring-teal-400'
          }`}
          rows={6}
          placeholder="Draft your reply here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Passive Intervention Overlay */}
        {isFlooded && !showGrounding && (
          <div className="absolute bottom-4 right-4 animate-in fade-in slide-in-from-bottom-2">
            <button
              onClick={() => setShowGrounding(true)}
              className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <Wind className="w-4 h-4" /> High emotion detected. Pause?
            </button>
          </div>
        )}
      </div>

      {/* 5-4-3-2-1 Grounding Modal */}
      {showGrounding && (
        <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-sm rounded-3xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
          <button 
            onClick={() => { setShowGrounding(false); rapidKeystrokes.current = 0; setIsFlooded(false); }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <Wind className="w-10 h-10 text-teal-500 mb-4 animate-pulse" />
          <h4 className="text-lg font-medium text-slate-800 mb-6">Let's step back for a moment.</h4>
          
          <div className="space-y-3 w-full max-w-sm text-sm text-slate-600">
            <div className="flex gap-3 items-center"><span className="text-teal-500 font-bold text-lg">5</span> things you can see around you.</div>
            <div className="flex gap-3 items-center"><span className="text-teal-500 font-bold text-lg">4</span> things you can physically feel.</div>
            <div className="flex gap-3 items-center"><span className="text-teal-500 font-bold text-lg">3</span> things you can hear right now.</div>
            <div className="flex gap-3 items-center"><span className="text-teal-500 font-bold text-lg">2</span> things you can smell.</div>
            <div className="flex gap-3 items-center"><span className="text-teal-500 font-bold text-lg">1</span> slow, deep breath.</div>
          </div>
        </div>
      )}
    </div>
  );
};