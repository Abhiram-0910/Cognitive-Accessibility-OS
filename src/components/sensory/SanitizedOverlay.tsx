import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeWebpage } from '../../agents/sensoryAgent';
import { X, Type, Search, Loader2, Maximize2, MoveVertical } from 'lucide-react';

interface OverlayProps {
  rawText: string;
  onClose: () => void;
}

export const SanitizedOverlay: React.FC<OverlayProps> = ({ rawText, onClose }) => {
  const [cleanContent, setCleanContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Accessibility Toggles
  const [useDyslexicFont, setUseDyslexicFont] = useState(false);
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>('relaxed');

  useEffect(() => {
    const processContent = async () => {
      try {
        const result = await sanitizeWebpage(rawText);
        setCleanContent(result);
      } catch (error) {
        console.error('Sanitization error:', error);
        setCleanContent("# Error\nFailed to sanitize the page. It might be too large or complex.");
      } finally {
        setLoading(false);
      }
    };
    processContent();
  }, [rawText]);

  // Lock background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { 
      document.body.style.overflow = 'auto';
      document.body.style.scrollBehavior = 'smooth';
    };
  }, []);

  const getLineHeightClass = () => {
    switch (lineHeight) {
      case 'normal': return 'leading-normal';
      case 'loose': return 'leading-loose';
      case 'relaxed': default: return 'leading-relaxed';
    }
  };

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 md:p-12 font-sans">
      <div className="bg-[#FAFAFA] w-full max-w-4xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
        
        {/* Header & Accessibility Controls */}
        <header className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-teal-600">
            <Maximize2 className="w-5 h-5" />
            <span className="font-semibold tracking-wide">Sensory Equalizer</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setUseDyslexicFont(!useDyslexicFont)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${useDyslexicFont ? 'bg-white shadow-sm text-teal-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="Toggle OpenDyslexic Font"
              >
                <Type className="w-3.5 h-3.5" /> Dyslexia Mode
              </button>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {(['normal', 'relaxed', 'loose'] as const).map((lh) => (
                <button
                  key={lh}
                  onClick={() => setLineHeight(lh)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${lineHeight === lh ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {lh === 'loose' && <MoveVertical className="w-3.5 h-3.5 inline mr-1" />}
                  {lh}
                </button>
              ))}
            </div>

            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-teal-500" />
              <p className="font-medium">Sanitizing layout and removing visual noise...</p>
            </div>
          ) : (
            <div className={`max-w-3xl mx-auto text-slate-800 ${getLineHeightClass()} ${useDyslexicFont ? 'font-[OpenDyslexic,sans-serif]' : 'font-sans'}`}>
              <div className="prose prose-lg prose-slate max-w-none prose-headings:font-light prose-headings:tracking-tight prose-a:text-teal-600 prose-strong:text-slate-900 prose-strong:font-semibold">
                <ReactMarkdown 
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    // Custom component overrides for additional security
                    a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                    img: () => null, // Block images completely for security
                    script: () => null,
                    style: () => null,
                    iframe: () => null
                  }}
                >
                  {cleanContent || ''}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};