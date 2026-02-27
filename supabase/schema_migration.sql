-- =================================================================================
-- LEGACY MIGRATION SCRIPT (MongoDB -> PostgreSQL / Supabase)
-- Phase 1: Porting Kids Module legacy tables into structured Postgres with RLS
-- =================================================================================

-- 1. GAMES TABLE (Ports gameModel.js)
-- Holds game templates containing questions/assets. (Read-only for most users, Admin writable)
CREATE TABLE IF NOT EXISTS public.kids_games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id_legacy TEXT UNIQUE, -- To map to the old gameId string
    name TEXT NOT NULL,
    questions JSONB DEFAULT '[]'::jsonb, -- Array of mixed question schemas
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. GAME SESSIONS TABLE (Ports sessionModel.js)
-- Individual attempt records by a child. Must be strictly RLS secured.
CREATE TABLE IF NOT EXISTS public.kids_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Links to the Child's auth token
    session_id_legacy TEXT, -- Maps to legacy sessionId
    session_name TEXT NOT NULL, -- Player Name
    game_name TEXT,
    image_paths TEXT[], -- Array of strings mapping to Supabase Storage
    screenshot_paths TEXT[],
    model_response JSONB DEFAULT '[]'::jsonb, -- Stores the legacy Array
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    telemetry_events JSONB DEFAULT '[]'::jsonb -- Holds face loss events, etc
);

-- Note: authModel.js and adminModel.js are fully superseded by Supabase Auth (`auth.users`)
-- and our existing `public.profiles` table which already has a `user_role` and `cognitive_profile`.
-- Instead of separate Admin/Child collections, everything is unified under public.profiles.

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.kids_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kids_sessions ENABLE ROW LEVEL SECURITY;

-- Games: Anyone authenticated can read games.
CREATE POLICY "Authenticated users can read games" 
    ON public.kids_games FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Games: Only admins can manage games.
CREATE POLICY "Admins manage games" 
    ON public.kids_games FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.user_role = 'admin'
      )
    );

-- Sessions: A child can insert/select their own sessions.
CREATE POLICY "Children manage own sessions" 
    ON public.kids_sessions FOR ALL 
    USING (auth.uid() = user_id);

-- Sessions: Parents can view sessions if they are linked (Future expansion).
-- For now, allow Admins and Parents broad view access to generate reports.
CREATE POLICY "Admins and Parents can read all sessions" 
    ON public.kids_sessions FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.user_role = 'admin' OR profiles.user_role = 'parent' OR profiles.user_role = 'teacher')
      )
    );

-- Trigger for updated_at on kids_games
CREATE TRIGGER update_kids_games_modtime 
    BEFORE UPDATE ON public.kids_games 
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
