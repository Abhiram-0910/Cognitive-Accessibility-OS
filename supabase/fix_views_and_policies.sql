-- =================================================================================
-- NeuroAdaptive OS — Kids Module
-- File:    supabase/fix_views_and_policies.sql
-- Purpose: (1) Create/replace v_session_summary and v_session_emotions views
--          (2) Fix child_profiles RLS to allow any authenticated user to INSERT
--              their own children (not just users with app_role = 'Parent')
--
-- HOW TO RUN:
--   Paste this entire script into Supabase Dashboard → SQL Editor → Run
--   It is fully idempotent (CREATE OR REPLACE / DROP IF EXISTS / DO $$ guards).
-- =================================================================================


-- =================================================================================
-- PART 1 — v_session_summary
-- =================================================================================
-- Used by TeacherDashboard.tsx fetchSessions():
--   supabase.from('v_session_summary').select('*').order('played_at', { ascending: false })
--
-- Columns mapped to the Session interface in TeacherDashboard.tsx:
--   id              → game_sessions.id
--   session_key     → game_sessions.session_key
--   session_name    → game_sessions.session_name
--   game_name       → games.name  (or session_game_name snapshot if game deleted)
--   played_at       → game_sessions.played_at
--   image_paths     → game_sessions.image_paths
--   screenshot_paths→ game_sessions.screenshot_paths
--   child_name      → child_profiles.child_name
--   parent_name     → profiles.full_name (the parent's display name)
-- =================================================================================

CREATE OR REPLACE VIEW public.v_session_summary AS
SELECT
    gs.id,
    gs.session_key,
    gs.session_name,

    -- Prefer the live game name; fall back to the snapshot if the game was deleted
    COALESCE(g.name, gs.session_game_name, 'Unknown Game')  AS game_name,

    gs.played_at,
    gs.image_paths,
    gs.screenshot_paths,

    cp.child_name,

    -- The parent's human-readable name from profiles (full_name or email prefix)
    COALESCE(p.full_name, split_part(p.email, '@', 1)) AS parent_name

FROM public.game_sessions  gs
LEFT JOIN public.games         g  ON g.id  = gs.game_id
LEFT JOIN public.child_profiles cp ON cp.id = gs.child_id
LEFT JOIN public.profiles      p  ON p.id  = cp.parent_id
ORDER BY gs.played_at DESC;

COMMENT ON VIEW public.v_session_summary IS
    'Denormalised session list used by the Teacher Dashboard. Joins game_sessions → games, child_profiles, profiles.';


-- =================================================================================
-- PART 2 — v_session_emotions
-- =================================================================================
-- Used by TeacherDashboard.tsx openOverallAnalysis():
--   supabase.from('v_session_emotions').select('emotion, avg').eq('session_id', id)
--
-- Columns:
--   session_id      → FK back to game_sessions
--   emotion         → expression_label
--   avg             → avg confidence × 100  (percentage, matches frontend expectation)
--   frame_count     → number of frames where this emotion appeared
-- =================================================================================

CREATE OR REPLACE VIEW public.v_session_emotions AS
SELECT
    el.session_id,
    el.expression_label                           AS emotion,
    ROUND((AVG(el.confidence_score) * 100)::numeric, 2)  AS avg,
    COUNT(*)                                      AS frame_count
FROM public.expression_logs el
GROUP BY el.session_id, el.expression_label;

COMMENT ON VIEW public.v_session_emotions IS
    'Per-session emotion averages (confidence × 100) for the Teacher Dashboard overall analysis chart.';


-- =================================================================================
-- PART 3 — Fix child_profiles RLS for INSERT
-- =================================================================================
-- Problem: The existing INSERT policy only exists for game_sessions (service_role).
-- child_profiles has no INSERT policy, so any authenticated user trying to create
-- a child account gets a 400 / RLS error.
--
-- Fix: Allow any authenticated user to insert rows where parent_id = auth.uid()
-- (the parent can only create children linked to themselves).
-- =================================================================================

-- Drop if a stale version exists, then recreate cleanly
DROP POLICY IF EXISTS "child_profiles: authenticated insert own" ON public.child_profiles;

CREATE POLICY "child_profiles: authenticated insert own"
    ON public.child_profiles
    FOR INSERT
    WITH CHECK (parent_id = auth.uid());


-- Also allow the owner to UPDATE their own children's profiles (e.g., toggle is_active)
DROP POLICY IF EXISTS "child_profiles: owner update" ON public.child_profiles;

CREATE POLICY "child_profiles: owner update"
    ON public.child_profiles
    FOR UPDATE
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());


-- =================================================================================
-- PART 4 — Grant SELECT on views to authenticated role
-- =================================================================================
-- Views are not automatically accessible to the `authenticated` role in Supabase.
-- These grants allow the Supabase JS client (anon/authenticated JWT) to query them.
-- =================================================================================

GRANT SELECT ON public.v_session_summary  TO authenticated;
GRANT SELECT ON public.v_session_emotions TO authenticated;


-- =================================================================================
-- Verify
-- =================================================================================
SELECT 'v_session_summary'  AS view_name, COUNT(*) AS row_count FROM public.v_session_summary
UNION ALL
SELECT 'v_session_emotions' AS view_name, COUNT(*) AS row_count FROM public.v_session_emotions;
