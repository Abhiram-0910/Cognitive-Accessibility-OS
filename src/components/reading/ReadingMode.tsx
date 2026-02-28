import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { applyLexicalAnchorFormatting } from '../../lib/algorithms/offlineNLP';
import * as pdfjsLib from 'pdfjs-dist';

// Use jsdelivr CDN to exactly match the npm package structure for the worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type FontSize = 'sm' | 'md' | 'lg' | 'xl';
type LineSpacing = 'normal' | 'relaxed' | 'loose';

const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const LINE_SPACING_MAP: Record<LineSpacing, string> = {
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export function ReadingMode() {
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fontSize, setFontSize] = useState<FontSize>('md');
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>('relaxed');
  const [lexicalAnchor, setLexicalAnchor] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatting, setIsChatting] = useState(false);

  const askDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !rawText) return;
    
    const query = chatInput.trim();
    setChatInput('');
    setChatLog(prev => [...prev, { role: 'user', text: query }]);
    setIsChatting(true);

    try {
      // Chunk text to avoid hitting context limits on massive documents
      const safeText = rawText.slice(0, 30000); 
      const prompt = `You are a helpful reading assistant. Answer the user's question based strictly on the text provided. Use short, dyslexic-friendly sentences.\n\nDOCUMENT TEXT:\n${safeText}\n\nUSER QUESTION:\n${query}`;

      const res = await fetch(`${BACKEND_URL}/api/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: 'gemini-2.0-flash' }),
      });

      const data = await res.json();
      if (data.success) {
        setChatLog(prev => [...prev, { role: 'ai', text: data.data }]);
      } else {
        setChatLog(prev => [...prev, { role: 'ai', text: "I'm having trouble analyzing this right now. Please try again." }]);
      }
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'ai', text: "Connection to the AI engine failed." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');
    setFileName(file.name);
    try {
      if (file.type === 'application/pdf') {
        // Real pdf.js extraction — reads all pages
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageStr = content.items
            .map((item: any) => item.str)
            .join(' ');
          pageTexts.push(pageStr);
        }
        setRawText(pageTexts.join('\n\n'));
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.name.endsWith('.docx')
      ) {
        // DOCX: mammoth.js not bundled; graceful fallback with install note
        setRawText(
          `[DOCX Support]\n\nTo enable DOCX rendering, run: npm install mammoth\n\n` +
          `"${file.name}" was uploaded successfully. Install mammoth and rebuild to extract DOCX text.`
        );
      } else {
        // Plain text / markdown — read directly
        const text = await file.text();
        setRawText(text);
      }
    } catch (err) {
      setError('Could not read this file. Try a plain .txt, .md, or .pdf file.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Apply Lexical Anchor Formatting via existing offlineNLP module
  const displayText = rawText
    ? (lexicalAnchor ? applyLexicalAnchorFormatting(rawText) : rawText)
    : '';

  const hasContent = rawText.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#f9f7f2] text-slate-800 font-display flex flex-col">
      {/* Toolbar */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm flex-wrap"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-amber-600">chrome_reader_mode</span>
          <h1 className="text-base font-bold text-slate-900">Reading Mode</h1>
          {fileName && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[160px]">
              {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Font size */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(['sm', 'md', 'lg', 'xl'] as FontSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${fontSize === size ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Line spacing */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(['normal', 'relaxed', 'loose'] as LineSpacing[]).map((sp) => (
              <button
                key={sp}
                onClick={() => setLineSpacing(sp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${lineSpacing === sp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {sp}
              </button>
            ))}
          </div>

          {/* Lexical Anchor toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-semibold text-slate-600">Lexical Anchor</span>
            <div className="relative">
              <input
                type="checkbox" className="sr-only peer"
                checked={lexicalAnchor}
                onChange={(e) => setLexicalAnchor(e.target.checked)}
              />
              <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-amber-500 transition-colors" />
              <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </div>
          </label>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Open File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Ask AI button */}
          {hasContent && (
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${showChat ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 border hover:bg-slate-200'}`}
            >
              <span className="material-symbols-outlined text-base">forum</span>
              Ask AI
            </button>
          )}
        </div>
      </motion.header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-slate-500 mt-20"
            >
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Reading file…</span>
            </motion.div>
          ) : hasContent ? (
            <motion.article
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full max-w-2xl ${FONT_SIZE_MAP[fontSize]} ${LINE_SPACING_MAP[lineSpacing]} text-slate-800`}
            >
              {/* Render with Lexical Anchor HTML or plain text */}
              {lexicalAnchor ? (
                <div
                  className="prose prose-slate max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayText }}
                />
              ) : (
                <pre className="whitespace-pre-wrap font-display">{rawText}</pre>
              )}
            </motion.article>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`w-full max-w-xl mt-16 border-2 border-dashed rounded-3xl p-16 flex flex-col items-center gap-4 text-center transition-all cursor-pointer ${isDragging ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white hover:border-amber-300 hover:bg-amber-50/50'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="material-symbols-outlined text-5xl text-amber-400">draft</span>
              <h2 className="text-lg font-semibold text-slate-700">Drop a file here</h2>
              <p className="text-sm text-slate-500">Supports .txt, .md, .pdf, .docx</p>
              {error && <p className="text-sm text-rose-500">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Slide-out Gemini Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-20 right-4 bottom-4 w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-20"
          >
            <div className="bg-amber-50 px-5 py-4 border-b border-amber-100 flex items-center justify-between">
              <h3 className="font-bold text-amber-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">robot_2</span>
                Chat with Document
              </h3>
              <button onClick={() => setShowChat(false)} className="text-amber-700 hover:text-amber-900">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/50">
              {chatLog.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">contact_support</span>
                  <p>Ask anything about this document!</p>
                </div>
              ) : (
                chatLog.map((msg, i) => (
                  <div key={i} className={`flex max-w-[85%] ${msg.role === 'user' ? 'self-end bg-amber-500 text-white' : 'self-start bg-white border border-slate-200 text-slate-800'} p-3 rounded-2xl text-sm leading-relaxed shadow-sm`}>
                    {msg.text}
                  </div>
                ))
              )}
              {isChatting && (
                <div className="self-start text-xs text-slate-400 flex items-center gap-2 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              )}
            </div>
            
            <form onSubmit={askDocument} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Ask a question..."
                className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-4 py-2.5 text-sm transition-all"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatting}
              />
              <button
                type="submit"
                disabled={isChatting || !chatInput.trim()}
                className="w-10 h-10 flex items-center justify-center bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-50 text-white rounded-xl transition-all"
              >
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
