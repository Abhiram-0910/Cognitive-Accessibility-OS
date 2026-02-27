/**
 * @provenance https://github.com/ybaddam8-png/Neutro-OS
 * @file src/hooks/useAcousticEngine.ts
 * @rationale Merged because this hook handles mic-capture → BiquadFilter notch arrays for
 *   real-time environmental noise cancellation. This is entirely unique from our
 *   existing SensoryEqualizer (which controls output gain), and complementary to it.
 *   Adapted to receive sources as a prop and expose state via useState instead of a
 *   separate Zustand store slice, keeping integration clean.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { SoundSource } from '../types/rsd';

interface FilterNode {
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface UseAcousticEngineProps {
  sources: SoundSource[];
  masterGain: number;
}

export function useAcousticEngine({ sources, masterGain }: UseAcousticEngineProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterMapRef = useRef<Map<string, FilterNode>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioContextReady, setAudioContextReady] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  const initAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const micSource = ctx.createMediaStreamSource(stream);
      const masterGainNode = ctx.createGain();
      masterGainNode.gain.value = masterGain;
      micSource.connect(masterGainNode);
      masterGainNode.connect(ctx.destination);

      audioCtxRef.current = ctx;
      streamRef.current = stream;
      sourceRef.current = micSource;
      masterGainRef.current = masterGainNode;

      setAudioContextReady(true);
      setIsProcessing(true);
      setDemoMode(false);
      console.log('[AcousticEngine] Mic capture started.');
    } catch (err) {
      console.warn('[AcousticEngine] Mic access denied — running in visual-only demo mode.', err);
      setAudioContextReady(false);
      setIsProcessing(true);
      setDemoMode(true);
    }
  }, [masterGain]);

  // Sync BiquadFilter nodes whenever sources change
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const activeIds = new Set(sources.map((s) => s.id));

    // Remove stale filters
    filterMapRef.current.forEach((nodes, id) => {
      if (!activeIds.has(id)) {
        nodes.filter.disconnect();
        nodes.gain.disconnect();
        filterMapRef.current.delete(id);
      }
    });

    // Add / update filters for active sources
    sources.forEach((src) => {
      if (!src.isActive) {
        // Bypass: remove if exists
        if (filterMapRef.current.has(src.id)) {
          const n = filterMapRef.current.get(src.id)!;
          n.filter.disconnect();
          n.gain.disconnect();
          filterMapRef.current.delete(src.id);
        }
        return;
      }

      if (!filterMapRef.current.has(src.id)) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'notch';
        filter.Q.value = 1.5;
        filter.frequency.value = src.frequency;
        filter.gain.value = -24 * src.gain;

        const gainNode = ctx.createGain();
        gainNode.gain.value = 1 - src.gain * 0.4;

        sourceRef.current?.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(master);
        filterMapRef.current.set(src.id, { filter, gain: gainNode });
      } else {
        const n = filterMapRef.current.get(src.id)!;
        n.filter.frequency.setTargetAtTime(src.frequency, ctx.currentTime, 0.05);
        n.gain.gain.setTargetAtTime(1 - src.gain * 0.4, ctx.currentTime, 0.05);
      }
    });
  }, [sources]);

  // Sync master gain
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        masterGain,
        audioCtxRef.current.currentTime,
        0.1
      );
    }
  }, [masterGain]);

  const stopAudio = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    filterMapRef.current.clear();
    setIsProcessing(false);
    setAudioContextReady(false);
    setDemoMode(false);
    console.log('[AcousticEngine] Stopped.');
  }, []);

  return { initAudio, stopAudio, isProcessing, audioContextReady, demoMode };
}
