/**
 * @provenance https://github.com/ybaddam8-png/Neutro-OS
 * @file src/components/acoustic/AcousticSandbox.tsx
 * @rationale Unique sensory regulation feature: drag-and-drop noise sources onto a
 *   soundstage, each applying a BiquadFilter notch node to cancel that frequency from
 *   live mic input. Architecturally distinct from SensoryEqualizer (output gain) —
 *   this controls *input* notch filtering. Fully refactored to Tailwind + Calm Tech palette.
 */

import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useAcousticEngine } from '../../hooks/useAcousticEngine';
import type { SoundSource } from '../../types/rsd';

// ─── Presets ─────────────────────────────────────────────────────────────────

type SourcePreset = Omit<SoundSource, 'id' | 'x' | 'y' | 'isActive'>;

const SOURCE_PRESETS: SourcePreset[] = [
  { type: 'ac',       label: 'Humming AC',       frequency: 120,  gain: 0.7, icon: '❄️',  color: '#60a5fa' },
  { type: 'chatter',  label: 'Coworkers',         frequency: 800,  gain: 0.6, icon: '💬',  color: '#f59e0b' },
  { type: 'traffic',  label: 'Traffic',           frequency: 250,  gain: 0.5, icon: '🚗',  color: '#94a3b8' },
  { type: 'keyboard', label: 'Keyboards',         frequency: 1200, gain: 0.4, icon: '⌨️',  color: '#a78bfa' },
  { type: 'music',    label: 'Background Music',  frequency: 440,  gain: 0.45,icon: '🎵',  color: '#34d399' },
  { type: 'custom',   label: 'Custom Noise',      frequency: 500,  gain: 0.5, icon: '〰️', color: '#f9a8d4' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AcousticSandbox() {
  const [sources, setSources] = useState<SoundSource[]>([]);
  const [masterGain, setMasterGain] = useState(0.8);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { initAudio, stopAudio, isProcessing, audioContextReady, demoMode } =
    useAcousticEngine({ sources, masterGain });

  const addSource = useCallback((preset: SourcePreset, x: number, y: number) => {
    setSources((prev) => [
      ...prev,
      { ...preset, id: uuidv4(), x, y, isActive: true },
    ]);
  }, []);

  const updateSource = useCallback((id: string, patch: Partial<SoundSource>) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  // ─── Drag-and-drop soundstage handlers ─────────────────────────────────────

  const handleStageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const presetType = e.dataTransfer.getData('preset');
    const preset = SOURCE_PRESETS.find((p) => p.type === presetType);
    if (preset) addSource(preset, x, y);
  };

  const handleSourceMouseDown = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const stage = document.getElementById('acoustic-soundstage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      updateSource(id, { x, y });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const editingSource = sources.find((s) => s.id === editingId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-display p-6 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Acoustic Phase-Inversion Sandbox</h1>
          <p className="text-slate-400 text-sm mt-1">
            Drag noise sources onto the soundstage. Each source applies a BiquadFilter notch to cancel it from your mic.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {demoMode && (
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full">
              Visual-only demo mode
            </span>
          )}
          {isProcessing ? (
            <button
              onClick={stopAudio}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-2xl text-sm font-medium transition-all"
            >
              <span className="material-symbols-outlined text-base">stop_circle</span>
              Stop Engine
            </button>
          ) : (
            <button
              onClick={() => void initAudio()}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 rounded-2xl text-sm font-medium transition-all"
            >
              <span className="material-symbols-outlined text-base">mic</span>
              Start Engine
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Preset Palette */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 flex flex-col gap-3"
        >
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Noise Sources</h2>
          {SOURCE_PRESETS.map((preset) => (
            <motion.div
              key={preset.type}
              draggable
              onDragStart={(e) => {
                (e as unknown as DragEvent).dataTransfer!.setData('preset', preset.type);
              }}
              className="flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 rounded-2xl cursor-grab active:cursor-grabbing transition-all select-none"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-xl">{preset.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-200 block truncate">{preset.label}</span>
                <span className="text-xs text-slate-500">{preset.frequency} Hz</span>
              </div>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: preset.color }}
              />
            </motion.div>
          ))}

          {/* Master Gain */}
          <div className="mt-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Master Gain</span>
              <span className="text-xs text-teal-400 font-mono">{Math.round(masterGain * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.01} value={masterGain}
              onChange={(e) => setMasterGain(parseFloat(e.target.value))}
              className="w-full accent-teal-400"
            />
          </div>
        </motion.div>

        {/* Soundstage */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-3"
        >
          <div
            id="acoustic-soundstage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleStageDrop}
            className="relative w-full aspect-[16/9] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)' }}
          >
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 40px)',
              }}
            />

            {/* Empty state */}
            {sources.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-3 pointer-events-none">
                <span className="material-symbols-outlined text-5xl">drag_pan</span>
                <span className="text-sm">Drag noise sources here to cancel them</span>
              </div>
            )}

            {/* Placed sources */}
            <AnimatePresence>
              {sources.map((src) => (
                <motion.div
                  key={src.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  style={{ left: `${src.x * 100}%`, top: `${src.y * 100}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move"
                  onMouseDown={(e) => handleSourceMouseDown(src.id, e)}
                >
                  <div
                    className={`relative flex items-center justify-center w-12 h-12 rounded-full text-xl shadow-lg border-2 select-none transition-opacity ${src.isActive ? 'opacity-100' : 'opacity-40'}`}
                    style={{ background: `${src.color}22`, borderColor: src.color }}
                    onClick={() => setEditingId(src.id === editingId ? null : src.id)}
                  >
                    {src.icon}
                    <div
                      className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none"
                      style={{ background: src.color }}
                    />
                  </div>
                  <span className="block text-center text-[10px] text-slate-400 mt-1 whitespace-nowrap select-none">
                    {src.label}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Status badge */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? (audioContextReady ? 'bg-teal-400 animate-pulse' : 'bg-amber-400 animate-pulse') : 'bg-slate-600'}`} />
              <span className="text-[10px] text-slate-400 font-mono">
                {isProcessing ? (audioContextReady ? 'PROCESSING' : 'DEMO') : 'IDLE'}
              </span>
            </div>
          </div>

          {/* Edit panel */}
          <AnimatePresence>
            {editingSource && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center"
              >
                <span className="text-2xl">{editingSource.icon}</span>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Frequency (Hz)</label>
                    <input
                      type="number" min={20} max={20000}
                      value={editingSource.frequency}
                      onChange={(e) => updateSource(editingSource.id, { frequency: Number(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-teal-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Gain (0–1)</label>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={editingSource.gain}
                      onChange={(e) => updateSource(editingSource.id, { gain: parseFloat(e.target.value) })}
                      className="w-full accent-teal-400 mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox" className="sr-only peer"
                        checked={editingSource.isActive}
                        onChange={(e) => updateSource(editingSource.id, { isActive: e.target.checked })}
                      />
                      <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-teal-500 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                    </label>
                    <span className="text-xs text-slate-400">Active</span>
                    <button
                      onClick={() => removeSource(editingSource.id)}
                      className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Remove
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
