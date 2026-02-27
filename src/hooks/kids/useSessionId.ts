/**
 * useSessionId  — Kids Module
 *
 * Generates a stable UUID v4 session identifier on component mount and exposes
 * it for use in capture / expression-logging flows.
 *
 * This ID maps to `game_sessions.session_key` in the Supabase schema
 * (see: migrations/merge_kids_module.sql).
 */

import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Return type of the `useSessionId` hook. */
export interface UseSessionIdReturn {
  /**
   * A stable UUID v4 string created once on mount.
   * `null` during the brief synchronous render before the `useEffect` fires.
   */
  sessionId: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generates a single UUID v4 session ID per component lifecycle.
 *
 * Usage:
 * ```tsx
 * const { sessionId } = useSessionId();
 * ```
 */
const useSessionId = (): UseSessionIdReturn => {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const newSessionId: string = uuidv4();
    setSessionId(newSessionId);
  }, []);

  return { sessionId };
};

export default useSessionId;
