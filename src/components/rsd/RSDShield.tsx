/**
 * @provenance https://github.com/ybaddam8-png/Neutro-OS
 * @file src/components/rsd/RSDShield.tsx
 * @rationale Entirely unique feature: intercepts GitHub PR review comments and uses
 *   Gemini (GEMINI_API_KEY_2) to remove sarcasm/condescension while preserving all
 *   technical content. Directly addresses Rejection Sensitive Dysphoria (RSD) — a
 *   core ADHD symptom. No equivalent exists in the main project.
 *   Fully refactored from raw inline styles to Tailwind "Calm Tech" palette.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizePRComment } from '../../lib/gemini';
import type { PRComment, PullRequest, ReviewSentiment } from '../../types/rsd';

// ─── Sentiment colours ────────────────────────────────────────────────────────

const SENTIMENT_CONFIG: Record<ReviewSentiment, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-rose-500/15',    text: 'text-rose-300',    label: 'Critical' },
  neutral:  { bg: 'bg-slate-500/15',   text: 'text-slate-300',   label: 'Neutral' },
  positive: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Positive' },
  mixed:    { bg: 'bg-amber-500/15',   text: 'text-amber-300',   label: 'Mixed' },
};

// ─── Demo data (shown when no webhook is configured) ─────────────────────────

const DEMO_PRS: PullRequest[] = [
  {
    id: 'pr-1', number: 47, title: 'feat: add cognitive load threshold alerts',
    repo: 'NeuroAdaptive/neuro-adaptive-os', state: 'open',
    commentCount: 3, unreadCount: 2, lastActivity: '2h ago', safetyScore: 62,
  },
  {
    id: 'pr-2', number: 43, title: 'fix: resolve AudioContext suspension on iOS',
    repo: 'NeuroAdaptive/neuro-adaptive-os', state: 'open',
    commentCount: 1, unreadCount: 1, lastActivity: '1d ago', safetyScore: 78,
  },
];

const DEMO_COMMENTS: PRComment[] = [
  {
    id: 'c-1', prId: 'pr-1', prTitle: 'feat: add cognitive load threshold alerts',
    originalText: "Obviously this is wrong. Why would you even do this? You clearly don't understand how React re-renders work. Move the business logic out of the component.",
    sanitizedText: 'This implementation has a concern worth addressing: the business logic would benefit from being moved out of the component. Consider extracting it into a hook or utility function.',
    author: 'pr-reviewer', avatarUrl: '',
    filePath: 'src/components/crisis/CrisisMode.tsx', lineNumber: 172,
    sentiment: 'critical',
    actionItems: ['Move business logic out of UI components', 'Review React re-render patterns'],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isRead: false, githubCommentId: 1001,
  },
  {
    id: 'c-2', prId: 'pr-1', prTitle: 'feat: add cognitive load threshold alerts',
    originalText: 'Looks solid, but double-check the async handling — there might be a race condition if the interval fires after unmount.',
    sanitizedText: 'Looks solid! One thing to verify: the async handling could have a race condition if the interval fires after the component unmounts. Adding a cleanup ref would address this.',
    author: 'teammate', avatarUrl: '',
    filePath: 'src/hooks/useCognitiveMonitor.ts', lineNumber: 44,
    sentiment: 'mixed',
    actionItems: ['Address race condition in async/await handling', 'Add cleanup ref for interval'],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    isRead: true, githubCommentId: 1002,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RSDShield() {
  const [prs] = useState<PullRequest[]>(DEMO_PRS);
  const [comments, setComments] = useState<PRComment[]>(DEMO_COMMENTS);
  const [selectedPRId, setSelectedPRId] = useState<string | null>(DEMO_PRS[0].id);
  const [sandboxText, setSandboxText] = useState('');
  const [sandboxResult, setSandboxResult] = useState<Awaited<ReturnType<typeof sanitizePRComment>> | null>(null);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState<string | null>(null);

  const selectedPR = prs.find((p) => p.id === selectedPRId);
  const visibleComments = comments.filter((c) => c.prId === selectedPRId);
  const unreadCount = comments.filter((c) => !c.isRead).length;

  const markRead = useCallback((id: string) => {
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, isRead: true } : c));
  }, []);

  const runSandbox = useCallback(async () => {
    if (!sandboxText.trim()) return;
    setIsSandboxLoading(true);
    setSandboxResult(null);
    const result = await sanitizePRComment(sandboxText);
    setSandboxResult(result);
    setIsSandboxLoading(false);
  }, [sandboxText]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-display">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-5 border-b border-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-400 text-lg">shield</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">RSD Shield</h1>
            <p className="text-xs text-slate-500">PR review comment de-weaponizer</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              {unreadCount} unread
            </span>
          )}
          <span className="text-xs bg-amber-500/15 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full">
            Demo mode
          </span>
        </div>
      </motion.header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* PR List */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-72 border-r border-white/5 flex flex-col"
        >
          <div className="px-4 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pull Requests</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {prs.map((pr) => {
              const isSelected = pr.id === selectedPRId;
              const prUnread = comments.filter((c) => c.prId === pr.id && !c.isRead).length;
              return (
                <button
                  key={pr.id}
                  onClick={() => setSelectedPRId(pr.id)}
                  className={`w-full text-left px-4 py-4 border-b border-white/5 transition-all ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-400' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-200 leading-snug line-clamp-2">{pr.title}</span>
                    {prUnread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {prUnread}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600">#{pr.number}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-600">{pr.lastActivity}</span>
                  </div>
                  {/* Safety score bar */}
                  <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pr.safetyScore > 70 ? 'bg-emerald-500' : pr.safetyScore > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${pr.safetyScore}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-600 mt-1 block">Safety: {pr.safetyScore}%</span>
                </button>
              );
            })}
          </div>
        </motion.aside>

        {/* Comments View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPR ? (
            <>
              <div className="px-6 py-4 border-b border-white/5 shrink-0">
                <h2 className="text-sm font-semibold text-slate-200">{selectedPR.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedPR.repo} · #{selectedPR.number}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <AnimatePresence>
                  {visibleComments.map((comment) => {
                    const sConfig = SENTIMENT_CONFIG[comment.sentiment];
                    return (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border border-white/5 overflow-hidden ${!comment.isRead ? 'border-indigo-500/30' : ''}`}
                        onClick={() => markRead(comment.id)}
                      >
                        {/* Comment header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {comment.author[0]?.toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-300">{comment.author}</span>
                            {comment.filePath && (
                              <span className="text-xs text-slate-500 font-mono truncate max-w-[140px]">
                                {comment.filePath}:{comment.lineNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sConfig.bg} ${sConfig.text}`}>
                              {sConfig.label}
                            </span>
                            {!comment.isRead && (
                              <span className="w-2 h-2 rounded-full bg-indigo-400" />
                            )}
                          </div>
                        </div>

                        {/* Sanitized text */}
                        <div className="px-4 py-4">
                          <p className="text-sm text-slate-200 leading-relaxed">{comment.sanitizedText}</p>

                          {/* Action items */}
                          {comment.actionItems.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Action Items</span>
                              {comment.actionItems.map((item, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="material-symbols-outlined text-indigo-400 text-sm mt-0.5">check_circle</span>
                                  <span className="text-xs text-slate-300">{item}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Toggle original */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOriginal(showOriginal === comment.id ? null : comment.id);
                            }}
                            className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {showOriginal === comment.id ? 'visibility_off' : 'visibility'}
                            </span>
                            {showOriginal === comment.id ? 'Hide original' : 'View original comment'}
                          </button>

                          <AnimatePresence>
                            {showOriginal === comment.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl"
                              >
                                <p className="text-xs text-slate-500 italic leading-relaxed">{comment.originalText}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl block mb-2">shield</span>
                <p className="text-sm">Select a pull request</p>
              </div>
            </div>
          )}
        </div>

        {/* Sandbox Panel */}
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="w-80 border-l border-white/5 flex flex-col"
        >
          <div className="px-4 py-3 border-b border-white/5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sanitization Sandbox</span>
          </div>
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
            <textarea
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              placeholder="Paste a raw PR review comment here to sanitize it…"
              className="flex-1 min-h-[140px] bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-indigo-400/50 transition-colors"
            />
            <button
              onClick={() => void runSandbox()}
              disabled={isSandboxLoading || !sandboxText.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSandboxLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  Sanitizing…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">auto_fix_high</span>
                  Sanitize with Gemini
                </>
              )}
            </button>

            <AnimatePresence>
              {sandboxResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Sanitized</span>
                    <p className="text-sm text-slate-200 leading-relaxed">{sandboxResult.sanitized}</p>
                  </div>
                  {sandboxResult.actionItems.length > 0 && (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-2">Action Items</span>
                      {sandboxResult.actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5">
                          <span className="material-symbols-outlined text-indigo-400 text-sm mt-0.5">task_alt</span>
                          <span className="text-xs text-slate-300">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${SENTIMENT_CONFIG[sandboxResult.sentiment as ReviewSentiment]?.bg ?? 'bg-slate-500/15'} ${SENTIMENT_CONFIG[sandboxResult.sentiment as ReviewSentiment]?.text ?? 'text-slate-300'}`}>
                    Sentiment: {sandboxResult.sentiment}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
