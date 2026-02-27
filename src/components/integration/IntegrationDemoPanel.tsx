/**
 * IntegrationDemoPanel
 * 
 * Shows a live simulation of the Slack / Jira AI simplification pipeline.
 * When Demo Mode is ON, clicking "Simplify" calls Gemini via the backend
 * to rewrite the raw notification into plain, neurodivergent-friendly language.
 *
 * Used on the Dashboard to demonstrate the integration to judges without
 * requiring real Slack/Jira API keys.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, Radio,
  AlertCircle, AlertTriangle, Info, Zap,
} from 'lucide-react';
import {
  MOCK_SLACK_NOTIFICATIONS,
  MOCK_JIRA_TICKETS,
  simplifyNotification,
  IntegrationNotification,
  IntegrationSource,
} from '../../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<IntegrationSource, { label: string; colour: string; bg: string }> = {
  slack: { label: 'Slack',  colour: 'text-[#4A154B]', bg: 'bg-[#4A154B]/10 border-[#4A154B]/20' },
  jira:  { label: 'Jira',   colour: 'text-[#0052CC]', bg: 'bg-[#0052CC]/10 border-[#0052CC]/20' },
};

const PRIORITY_CONFIG = {
  critical: { icon: <AlertCircle className="w-3 h-3" />, colour: 'text-rose-500',   label: 'Critical' },
  high:     { icon: <AlertTriangle className="w-3 h-3" />, colour: 'text-amber-500', label: 'High' },
  medium:   { icon: <Zap className="w-3 h-3" />,           colour: 'text-sky-500',   label: 'Medium' },
  low:      { icon: <Info className="w-3 h-3" />,           colour: 'text-slate-400', label: 'Low' },
};

// ─── Single notification card ─────────────────────────────────────────────────
const NotificationCard: React.FC<{ notification: IntegrationNotification }> = ({ notification }) => {
  const [expanded, setExpanded]       = useState(false);
  const [simplified, setSimplified]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);

  const src  = SOURCE_CONFIG[notification.source];
  const pri  = PRIORITY_CONFIG[notification.priority];

  const handleSimplify = async () => {
    if (simplified) { setExpanded(e => !e); return; }
    setLoading(true);
    setExpanded(true);
    const result = await simplifyNotification(notification);
    setSimplified(result);
    setLoading(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${src.bg} transition-all`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center
                        text-[10px] font-bold text-slate-600 shrink-0">
          {notification.avatarInitials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5
                              rounded border ${src.colour} ${src.bg}`}>
              {src.label}
            </span>
            {notification.channel && (
              <span className="text-[10px] font-semibold text-slate-500">
                {notification.channel}
              </span>
            )}
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${pri.colour}`}>
              {pri.icon}{pri.label}
            </span>
            <span className="text-[10px] text-slate-400 ml-auto">{notification.timestamp}</span>
          </div>

          {/* Sender + raw content */}
          <p className="text-xs font-semibold text-slate-700 mb-0.5">{notification.sender}</p>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {notification.rawContent}
          </p>
        </div>
      </div>

      {/* Simplified output */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/30">
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Simplifying with Gemini…
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3 h-3 text-teal-500" />
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">
                      AI Plain-Language Summary
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {simplified}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Simplify / toggle button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSimplify}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                     bg-teal-500 hover:bg-teal-600 text-white transition disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : simplified ? (
            expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {loading ? 'Thinking…' : simplified ? (expanded ? 'Hide' : 'Show Summary') : 'Simplify with AI'}
        </button>
      </div>
    </motion.div>
  );
};

// ─── Tab selector ─────────────────────────────────────────────────────────────
type Tab = 'slack' | 'jira';

// ─── Main panel ───────────────────────────────────────────────────────────────
export const IntegrationDemoPanel: React.FC = () => {
  const [tab, setTab]               = useState<Tab>('slack');
  const [demoMode, setDemoMode]     = useState(true);

  const items = tab === 'slack' ? MOCK_SLACK_NOTIFICATIONS : MOCK_JIRA_TICKETS;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-teal-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-700">Integration Hub</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-600 font-bold uppercase tracking-wider">
            Demo Mode
          </span>
        </div>

        {/* Demo mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Demo
          </span>
          <button
            onClick={() => setDemoMode(d => !d)}
            className={`relative w-9 h-5 rounded-full transition-colors ${demoMode ? 'bg-teal-500' : 'bg-slate-200'}`}
            aria-label="Toggle demo mode"
          >
            <motion.div
              animate={{ x: demoMode ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
            />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-100">
        {(['slack', 'jira'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition
                        ${tab === t
                          ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                          : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t === 'slack' ? '💬 Slack' : '📋 Jira'}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="p-4 flex flex-col gap-3 max-h-[480px] overflow-y-auto">
        {!demoMode ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center gap-2">
            <Radio className="w-8 h-8 opacity-30" />
            <p className="text-sm font-semibold">Demo mode is off</p>
            <p className="text-xs">Enable the toggle to see the AI simplification demo</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {items.map(n => (
              <NotificationCard key={n.id} notification={n} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer hint */}
      {demoMode && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-[10px] text-slate-400 text-center">
            Click <strong className="text-teal-600">Simplify with AI</strong> on any notification to see Gemini rewrite it in plain language optimised for neurodivergent users.
          </p>
        </div>
      )}
    </div>
  );
};
