-- =================================================================================
-- NEUROADAPTIVE OS: Master Initialization Script
-- =================================================================================

-- 1. Enable pgvector for Prosthetic Working Memory
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Utility: Auto-updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    cognitive_profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.memory_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    embedding vector(768), -- Gemini 1.5 embedding dimension
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.community_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cluster_name TEXT NOT NULL,
    aggregated_insights JSONB DEFAULT '{}'::jsonb,
    minimum_k_anonymity_count INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.user_integrations (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    slack_access_token TEXT,
    google_refresh_token TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Apply timestamp triggers
CREATE TRIGGER update_profiles_modtime BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_community_patterns_modtime BEFORE UPDATE ON public.community_patterns FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER update_user_integrations_modtime BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Standard isolation: Users can only see/edit their own data
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users isolate memory" ON public.memory_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users isolate tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);
-- user_integrations is strictly managed by the backend service role, no public RLS needed for client reads.

-- B2B Aggregation: Allow authenticated read access if K-Anonymity rules apply
CREATE POLICY "Managers read community patterns" ON public.community_patterns FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- VECTOR SEARCH RPC (Prosthetic Memory)
-- ==========================================

CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(768),
  p_user_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (id uuid, content text, summary text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, content, summary,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.memory_entries
  WHERE user_id = p_user_id AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Action-Weighted Hybrid Search (Boosts semantic hits containing commitment verbs)
CREATE OR REPLACE FUNCTION match_action_items(
  query_embedding vector(768),
  p_user_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (id uuid, content text, summary text, similarity float)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, content, summary,
    (1 - (embedding <=> query_embedding)) + 
    (CASE WHEN content ~* '\y(will|need to|must|assigned to|action|deadline)\y' THEN 0.15 ELSE 0 END) AS similarity
  FROM public.memory_entries
  WHERE user_id = p_user_id AND (1 - (embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- ==========================================
-- MISSING TABLES FOR DEMO & FULL FUNCTIONALITY
-- ==========================================

CREATE TABLE public.cognitive_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    score INTEGER NOT NULL,
    classification TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.communications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    original_text TEXT,
    translated_text TEXT,
    saved_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.masking_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    trigger TEXT,
    intensity INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.crisis_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==========================================
-- RLS POLICIES FOR NEW TABLES
-- ==========================================

ALTER TABLE public.cognitive_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crisis_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own snapshots" ON public.cognitive_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own snapshots" ON public.cognitive_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users isolate communications" ON public.communications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users isolate masking_events" ON public.masking_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users isolate crisis_plans" ON public.crisis_plans FOR ALL USING (auth.uid() = user_id);