-- =================================================================================
-- NEUROADAPTIVE OS: Kids Module Migration
-- Script:  merge_kids_module.sql
-- Author:  Antigravity (Principal Database Architect)
-- Date:    2026-02-27
-- Purpose: Port the legacy MongoDB "Joy with Learning" MERN backend into the
--          Supabase PostgreSQL architecture. Creates a unified RBAC model and
--          all tables required by the kids-module feature set.
--
-- Run AFTER: supabase/migrations/init.sql
-- =================================================================================


-- =================================================================================
-- SECTION 1 — RBAC: Unified Role-Based Access Control
-- =================================================================================
-- The legacy MongoDB app had 3 informal roles embedded in documents:
--   "super_admin" | "admin" | "child"
-- We unify these into a proper PostgreSQL ENUM that covers the full platform.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'SuperAdmin',   -- Platform owner; can approve/reject admin registrations
            'Teacher',      -- Maps to legacy admin_profession = 'therapist'
            'Parent',       -- Maps to legacy admin_profession = 'game_developer' (caregiver role)
            'Adult_User',   -- Standard neuro-adaptive-os user (no kids-module access)
            'Child_User'    -- Managed account; no direct auth.users entry in legacy design
        );
        RAISE NOTICE 'Created app_role enum type.';
    ELSE
        RAISE NOTICE 'app_role enum already exists, skipping.';
    END IF;
END $$;


-- Extend the existing `profiles` table with RBAC + contact fields.
-- Using IF NOT EXISTS guards so this script is idempotent.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'profiles'
          AND column_name  = 'app_role'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN app_role      public.app_role DEFAULT 'Adult_User',
            ADD COLUMN phone_number  TEXT,
            ADD COLUMN account_status TEXT DEFAULT 'Active'
                CHECK (account_status IN ('Active', 'Pending', 'Approved', 'Rejected', 'Suspended'));
        RAISE NOTICE 'Extended profiles table with app_role, phone_number, account_status.';
    ELSE
        RAISE NOTICE 'profiles columns already exist, skipping ALTER.';
    END IF;
END $$;


-- =================================================================================
-- SECTION 2 — `admin_profiles` Table
-- =================================================================================
-- Maps to the legacy MongoDB AdminSchema.
-- Every admin/teacher/parent is ALSO a Supabase auth.users entry, so we link via
-- the existing `profiles` table (which itself links to auth.users).
--
-- Legacy fields mapped:
--   admin_name        → profiles.full_name  (already on profiles)
--   phone_number      → profiles.phone_number (added above)
--   admin_email       → auth.users.email   (Supabase Auth owns this)
--   role              → profiles.app_role   (added above)
--   admin_profession  → admin_profiles.profession
--   status            → profiles.account_status (added above)
--   password          → auth.users (Supabase Auth owns this — NOT stored here)

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    -- PK is the same UUID as auth.users and profiles (1-to-1 extension)
    id              UUID PRIMARY KEY
                        REFERENCES auth.users(id)   ON DELETE CASCADE,

    -- Redundant FK to profiles to make joins explicit and enforce profile exists
    profile_id      UUID NOT NULL UNIQUE
                        REFERENCES public.profiles(id) ON DELETE CASCADE,

    profession      TEXT NOT NULL
                        CHECK (profession IN ('therapist', 'game_developer', 'other')),

    -- ISO 8601 timestamp when SuperAdmin approved this account
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES auth.users(id), -- SuperAdmin who clicked "Approve"

    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.admin_profiles IS
    'Extended profile for Teacher/Parent/SuperAdmin users. One-to-one with auth.users and public.profiles.';
COMMENT ON COLUMN public.admin_profiles.profession IS
    'Legacy admin_profession field: therapist | game_developer | other.';
COMMENT ON COLUMN public.admin_profiles.approved_at IS
    'Set when account_status transitions to Approved. Null while Pending.';

CREATE TRIGGER update_admin_profiles_modtime
    BEFORE UPDATE ON public.admin_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- =================================================================================
-- SECTION 3 — `child_profiles` Table
-- =================================================================================
-- Normalises the embedded `children_accounts[]` sub-document from AdminSchema.
-- In the legacy MongoDB design, children lived inside the parent admin document:
--   { children_accounts: [{ name, age, password }] }
-- This is a 1-to-many relationship best expressed as a separate table.
--
-- Child accounts do NOT have Supabase Auth logins (PIN-based auth only).
-- The parent_id links to the profiles row of the Teacher/Parent who owns them.

CREATE TABLE IF NOT EXISTS public.child_profiles (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- The owning Teacher/Parent
    parent_id       UUID NOT NULL
                        REFERENCES public.profiles(id) ON DELETE CASCADE,

    child_name      TEXT NOT NULL,
    age             SMALLINT NOT NULL CHECK (age BETWEEN 1 AND 18),

    -- PIN stored as a bcrypt hash. Never store plaintext.
    -- Legacy stored plaintext — this column enforces discipline going forward.
    pin_hash        TEXT,   -- nullable: allow creation before PIN is set

    -- Mirrors the neuro-adaptive OS cognitive profile pattern
    cognitive_profile JSONB DEFAULT '{}'::jsonb,

    -- Optional: track the profile picture / avatar URL stored in Supabase Storage
    avatar_url      TEXT,

    is_active       BOOLEAN DEFAULT TRUE NOT NULL,

    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.child_profiles IS
    'Managed child accounts. Not linked to auth.users; authenticated via PIN by their parent/teacher.';
COMMENT ON COLUMN public.child_profiles.pin_hash IS
    'bcrypt hash of the child PIN. Upgrade path: use Supabase Auth child accounts in future.';

CREATE INDEX IF NOT EXISTS idx_child_profiles_parent ON public.child_profiles(parent_id);

CREATE TRIGGER update_child_profiles_modtime
    BEFORE UPDATE ON public.child_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- =================================================================================
-- SECTION 4 — `games` Table
-- =================================================================================
-- Maps to the legacy MongoDB gameSchema.
-- `questions` is stored as JSONB to preserve the polymorphic Mixed[] structure.
-- The legacy `gameId` string becomes `game_key` (slug / external ID).

CREATE TABLE IF NOT EXISTS public.games (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Legacy gameId field — unique string identifier (e.g. "emotion-match-v1")
    game_key        TEXT NOT NULL UNIQUE,

    name            TEXT NOT NULL,

    -- Polymorphic question objects stored as a JSONB array.
    -- Legacy schema used mongoose.Schema.Types.Mixed — JSONB is the PG equivalent.
    -- Each element can be either question type 1 or type 2 (validated at app level).
    questions       JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Metadata
    description     TEXT,
    thumbnail_url   TEXT,
    is_published    BOOLEAN DEFAULT FALSE NOT NULL,

    -- Which admin/teacher created this game
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.games IS
    'Therapeutic/educational games. Maps from legacy MongoDB gameSchema. Questions are stored as JSONB to support polymorphic types.';
COMMENT ON COLUMN public.games.game_key IS
    'Human-readable slug / external ID. Equivalent to legacy gameId field.';
COMMENT ON COLUMN public.games.questions IS
    'JSONB array of polymorphic question objects. Schema validated at the application layer.';

CREATE INDEX IF NOT EXISTS idx_games_published ON public.games(is_published);

CREATE TRIGGER update_games_modtime
    BEFORE UPDATE ON public.games
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- =================================================================================
-- SECTION 5 — `game_sessions` Table
-- =================================================================================
-- Maps to the legacy MongoDB sessionSchema.
-- A session is one recorded play-through of a game by a child.
--
-- Legacy fields mapped:
--   sessionId       → session_key  (external reference string)
--   sessionName     → session_name (player's display name — often the child name)
--   gameName        → resolved via game_id FK (or session_game_name for snapshots)
--   imagePaths[]    → image_paths TEXT[]
--   screenshotPaths → screenshot_paths TEXT[]
--   timestamp       → played_at TIMESTAMPTZ
--   modelResponse[] → stored in expression_logs table (Section 6)

CREATE TABLE IF NOT EXISTS public.game_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- External session identifier (matches legacy sessionId string)
    session_key     TEXT NOT NULL UNIQUE,

    -- The child who played this session
    child_id        UUID NOT NULL
                        REFERENCES public.child_profiles(id) ON DELETE CASCADE,

    -- Which game was played
    game_id         UUID REFERENCES public.games(id) ON DELETE SET NULL,

    -- Snapshot of game name at session creation time (in case game is later deleted)
    session_game_name   TEXT,

    -- The "sessionName" in the legacy schema was actually the player's name
    session_name    TEXT NOT NULL,

    -- Arrays of relative file paths / Supabase Storage object paths
    image_paths     TEXT[] DEFAULT ARRAY[]::TEXT[],
    screenshot_paths TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Raw aggregated AI response blob (preserved for backward compat).
    -- Individual expression log rows are also created in expression_logs (Section 6).
    ai_model_response   JSONB DEFAULT '[]'::jsonb,

    -- Replaces legacy timestamp[] (which was [date, time] strings).
    played_at       TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Session duration in seconds (not in legacy schema — add for analytics)
    duration_seconds INTEGER,

    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.game_sessions IS
    'A single recorded play-through of a game by a child. Maps from legacy sessionSchema.';
COMMENT ON COLUMN public.game_sessions.session_key IS
    'Equivalent to legacy sessionId. Unique external reference string.';
COMMENT ON COLUMN public.game_sessions.ai_model_response IS
    'Raw JSONB blob of the full HuggingFace model response array. For analytics, use expression_logs instead.';

CREATE INDEX IF NOT EXISTS idx_game_sessions_child  ON public.game_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game   ON public.game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_played ON public.game_sessions(played_at DESC);

CREATE TRIGGER update_game_sessions_modtime
    BEFORE UPDATE ON public.game_sessions
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- =================================================================================
-- SECTION 6 — `expression_logs` Table
-- =================================================================================
-- Normalises the `modelResponse[]` field from sessionSchema.
-- The legacy admin_helper.js sent captured images to:
--   https://api-inference.huggingface.co/models/trpakov/vit-face-expression
-- The response was an array of [{ label: "happy", score: 0.92 }, ...] objects.
--
-- Storing each label+score as a row enables proper SQL aggregation and time-series
-- queries (e.g., "show emotion distribution for this child over the last month").

CREATE TABLE IF NOT EXISTS public.expression_logs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Which session this log entry belongs to
    session_id      UUID NOT NULL
                        REFERENCES public.game_sessions(id) ON DELETE CASCADE,

    -- HuggingFace vit-face-expression output labels:
    -- 'angry' | 'disgust' | 'fear' | 'happy' | 'neutral' | 'sad' | 'surprise'
    expression_label TEXT NOT NULL,

    -- Confidence score 0.0 → 1.0
    confidence_score NUMERIC(5, 4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),

    -- The source image path that produced this result (links back to imagePaths[])
    source_image_path TEXT,

    -- Timestamp when the frame was captured (sub-session granularity)
    captured_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.expression_logs IS
    'Normalised per-frame emotion analysis results from the HuggingFace vit-face-expression model. One row per (session, label) observation.';
COMMENT ON COLUMN public.expression_logs.expression_label IS
    'Emotion label from HuggingFace: angry | disgust | fear | happy | neutral | sad | surprise.';
COMMENT ON COLUMN public.expression_logs.confidence_score IS
    'Model confidence 0.0000 to 1.0000 (4 decimal precision).';

CREATE INDEX IF NOT EXISTS idx_expression_logs_session ON public.expression_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_expression_logs_label   ON public.expression_logs(expression_label);
CREATE INDEX IF NOT EXISTS idx_expression_logs_time    ON public.expression_logs(captured_at DESC);


-- =================================================================================
-- SECTION 7 — ROW LEVEL SECURITY (RLS)
-- =================================================================================

ALTER TABLE public.admin_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expression_logs  ENABLE ROW LEVEL SECURITY;


-- ── Helper function ──────────────────────────────────────────────────────────────
-- Returns the app_role of the currently authenticated user.
-- Used inside RLS policy USING expressions.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT app_role FROM public.profiles WHERE id = auth.uid();
$$;


-- ── admin_profiles ────────────────────────────────────────────────────────────────
-- A user can read/edit their own admin profile.
-- SuperAdmin can read all (for the approval dashboard).

CREATE POLICY "admin_profiles: owner access"
    ON public.admin_profiles
    FOR ALL
    USING (id = auth.uid());

CREATE POLICY "admin_profiles: superadmin read all"
    ON public.admin_profiles
    FOR SELECT
    USING (public.current_user_role() = 'SuperAdmin');


-- ── child_profiles ────────────────────────────────────────────────────────────────
-- A parent/teacher can manage (CRUD) their own children.
-- SuperAdmin and Teacher can read all children (for oversight dashboards).

CREATE POLICY "child_profiles: parent manages own"
    ON public.child_profiles
    FOR ALL
    USING (parent_id = auth.uid());

CREATE POLICY "child_profiles: superadmin read all"
    ON public.child_profiles
    FOR SELECT
    USING (public.current_user_role() IN ('SuperAdmin', 'Teacher'));


-- ── games ─────────────────────────────────────────────────────────────────────────
-- All authenticated users can READ games (so children can see the game catalogue).
-- Only Teachers and SuperAdmins can INSERT/UPDATE/DELETE games.

CREATE POLICY "games: authenticated users read"
    ON public.games
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "games: teachers and superadmin write"
    ON public.games
    FOR ALL
    USING (public.current_user_role() IN ('Teacher', 'SuperAdmin'));


-- ── game_sessions ─────────────────────────────────────────────────────────────────
-- A parent/teacher sees sessions belonging to their OWN children.
-- SuperAdmin sees all sessions.
-- Insertion is done server-side by the backend service role, so client RLS
-- only needs to cover SELECT for the dashboard.

CREATE POLICY "game_sessions: parent reads own children sessions"
    ON public.game_sessions
    FOR SELECT
    USING (
        child_id IN (
            SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "game_sessions: superadmin reads all"
    ON public.game_sessions
    FOR SELECT
    USING (public.current_user_role() = 'SuperAdmin');

CREATE POLICY "game_sessions: teacher reads all"
    ON public.game_sessions
    FOR SELECT
    USING (public.current_user_role() = 'Teacher');

CREATE POLICY "game_sessions: backend upsert"
    ON public.game_sessions
    FOR INSERT
    WITH CHECK (TRUE); -- service_role bypasses RLS; this covers anon edge cases


-- ── expression_logs ───────────────────────────────────────────────────────────────
-- Follow the same visibility rules as game_sessions (via the session → child → parent chain).

CREATE POLICY "expression_logs: parent reads own"
    ON public.expression_logs
    FOR SELECT
    USING (
        session_id IN (
            SELECT gs.id FROM public.game_sessions gs
            JOIN public.child_profiles cp ON cp.id = gs.child_id
            WHERE cp.parent_id = auth.uid()
        )
    );

CREATE POLICY "expression_logs: superadmin reads all"
    ON public.expression_logs
    FOR SELECT
    USING (public.current_user_role() = 'SuperAdmin');

CREATE POLICY "expression_logs: teacher reads all"
    ON public.expression_logs
    FOR SELECT
    USING (public.current_user_role() = 'Teacher');

CREATE POLICY "expression_logs: backend insert"
    ON public.expression_logs
    FOR INSERT
    WITH CHECK (TRUE);


-- =================================================================================
-- SECTION 8 — CONVENIENCE VIEWS
-- =================================================================================
-- These views de-normalise the most common query patterns used by the legacy
-- admin_helper.js controller (aggregated session data for the analysis dashboard).

-- View: Full session summary with child name, game name, and parent info.
CREATE OR REPLACE VIEW public.v_session_summary AS
SELECT
    gs.id                       AS session_id,
    gs.session_key,
    gs.session_name,
    gs.played_at,
    gs.duration_seconds,
    gs.image_paths,
    gs.screenshot_paths,

    -- Child info
    cp.id                       AS child_id,
    cp.child_name,
    cp.age                      AS child_age,

    -- Parent/Teacher info
    p.id                        AS parent_id,
    p.full_name                 AS parent_name,
    p.app_role                  AS parent_role,

    -- Game info
    g.id                        AS game_id,
    COALESCE(g.name, gs.session_game_name) AS game_name

FROM public.game_sessions       gs
JOIN public.child_profiles      cp ON cp.id = gs.child_id
JOIN public.profiles            p  ON p.id  = cp.parent_id
LEFT JOIN public.games          g  ON g.id  = gs.game_id;

COMMENT ON VIEW public.v_session_summary IS
    'Denormalised session view for the analysis dashboard. Joins sessions → children → parents → games.';


-- View: Aggregated emotion scores per session (replaces iterating modelResponse[]).
CREATE OR REPLACE VIEW public.v_session_emotions AS
SELECT
    el.session_id,
    gs.session_key,
    cp.child_name,
    el.expression_label,
    COUNT(*)                            AS observation_count,
    ROUND(AVG(el.confidence_score), 4) AS avg_confidence,
    ROUND(MAX(el.confidence_score), 4) AS peak_confidence,
    MIN(el.captured_at)                AS first_seen_at,
    MAX(el.captured_at)                AS last_seen_at
FROM public.expression_logs     el
JOIN public.game_sessions       gs ON gs.id = el.session_id
JOIN public.child_profiles      cp ON cp.id = gs.child_id
GROUP BY el.session_id, gs.session_key, cp.child_name, el.expression_label;

COMMENT ON VIEW public.v_session_emotions IS
    'Aggregated emotion statistics per session. Use for the emotion heatmap / trend charts.';


-- =================================================================================
-- SECTION 9 — SEED: SuperAdmin Role Marker
-- =================================================================================
-- The legacy server.js hard-coded a SuperAdmin document directly in MongoDB.
-- In Supabase, the SuperAdmin is CREATED through Auth (invite / sign-up) and then
-- their profile row's app_role is elevated. The query below is a template —
-- replace the email with the actual SuperAdmin email after first sign-in.
--
-- USAGE (run manually after SuperAdmin signs up):
--
--   UPDATE public.profiles
--   SET app_role = 'SuperAdmin', account_status = 'Approved'
--   WHERE id = (
--       SELECT id FROM auth.users WHERE email = 'superadmin@example.com'
--   );
--
-- This is intentionally left as a comment — do NOT seed automatically.


-- =================================================================================
-- MIGRATION COMPLETE
-- =================================================================================
-- Tables created:
--   public.admin_profiles   (1-to-1 with auth.users for Teacher/Parent/SuperAdmin)
--   public.child_profiles   (1-to-many under a parent profile)
--   public.games            (game catalogue with JSONB questions)
--   public.game_sessions    (per-session play records)
--   public.expression_logs  (normalised AI emotion analysis results)
--
-- Altered:
--   public.profiles         (+app_role, +phone_number, +account_status)
--
-- Views created:
--   public.v_session_summary
--   public.v_session_emotions
-- =================================================================================
