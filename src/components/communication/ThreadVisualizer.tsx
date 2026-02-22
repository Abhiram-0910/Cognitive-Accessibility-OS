import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { generateMermaidGraph } from '../../agents/visualizerAgent';
import { Loader2, Network, ArrowRight, AlertCircle } from 'lucide-react';

export const ThreadVisualizer: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphCode, setGraphCode] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  const mermaidRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid configuration
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
        primaryColor: '#F8FAFC',
        primaryTextColor: '#334155',
        primaryBorderColor: '#CBD5E1',
        lineColor: '#94A3B8',
        secondaryColor: '#14B8A6',
        tertiaryColor: '#fff',
      },
      flowchart: {
        htmlLabels: true,
        curve: 'basis', // Smooth, calming lines
      },
    });
  }, []);

  // Dynamically render the graph when code updates
  useEffect(() => {
    const renderGraph = async () => {
      if (graphCode && mermaidRef.current) {
        setRenderError(null);
        try {
          // Clear previous render
          mermaidRef.current.innerHTML = '';
          // Generate new SVG
          const { svg } = await mermaid.render('mermaid-dynamic-graph', graphCode);
          mermaidRef.current.innerHTML = svg;
        } catch (err: any) {
          console.error("Mermaid rendering error:", err);
          setRenderError("Failed to render the visual map. The thread might be too complex.");
        }
      }
    };
    renderGraph();
  }, [graphCode]);

  const handleVisualize = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setGraphCode(null);
    setRenderError(null);
    
    try {
      const code = await generateMermaidGraph(input);
      setGraphCode(code);
    } catch (error) {
      setRenderError("Failed to communicate with the translation agent.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Network className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Spatial Translator</h3>
          <p className="text-xs text-slate-500">Convert dense linear text into a scannable mind map.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-[400px]">
        
        {/* Left Side: Input Area */}
        <div className="flex flex-col h-full">
          <textarea
            className="flex-1 w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700 resize-none text-sm leading-relaxed mb-4 min-h-[300px]"
            placeholder="Paste a chaotic, multi-participant Slack thread or dense email chain here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            onClick={handleVisualize}
            disabled={loading || !input}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-medium transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Map Cognitive Relationships'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Side: Visualization Canvas */}
        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden relative min-h-[300px]">
          
          {!graphCode && !loading && !renderError && (
            <div className="text-center text-slate-400">
              <Network className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Awaiting spatial translation</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">Action items will be highlighted in teal for immediate recognition.</p>
            </div>
          )}

          {loading && (
            <div className="text-center text-indigo-400 animate-pulse">
              <Network className="w-8 h-8 mx-auto mb-3 animate-spin-slow" />
              <p className="text-sm font-medium">Generating neural map...</p>
            </div>
          )}

          {renderError && (
            <div className="text-center text-rose-500 p-4 bg-rose-50 rounded-xl border border-rose-100">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">{renderError}</p>
            </div>
          )}

          {/* Mermaid Injection Container */}
          <div 
            className={`w-full overflow-auto flex justify-center ${loading || renderError ? 'hidden' : 'block'}`}
            ref={mermaidRef} 
          />
          
        </div>
      </div>
    </div>
  );
};