-- =================================================================================
-- NeuroAdaptive OS — Supabase Storage & RLS
-- File:    supabase/fix_storage_bucket.sql
-- Purpose: Create the 'kids-captures' storage bucket and set RLS policies so
--          authenticated users can upload and view captured images/screenshots.
--
-- HOW TO RUN:
--   Paste into Supabase Dashboard → SQL Editor → Run
--   Idempotent — safe to re-run at any time.
-- =================================================================================


-- =================================================================================
-- PART 1 — Create the 'kids-captures' bucket (if not already created via UI)
-- =================================================================================
-- NOTE: If you already created this bucket through the Supabase Dashboard UI,
--       this INSERT will be silently skipped by the ON CONFLICT clause.
--       Either way, the RLS policies below will be applied correctly.
-- =================================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-captures',
  'kids-captures',
  FALSE,                            -- Private bucket — requires auth to access
  5242880,                          -- 5 MB per file limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public              = FALSE,
  file_size_limit     = 5242880,
  allowed_mime_types  = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- =================================================================================
-- PART 2 — Enable RLS on storage.objects (required for per-row policies)
-- =================================================================================
-- storage.objects already has RLS enabled by default in Supabase,
-- but we add an explicit statement for robustness.
-- =================================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;


-- =================================================================================
-- PART 3 — RLS Policies for 'kids-captures' bucket
-- =================================================================================

-- ── INSERT (authenticated users can upload their captures) ────────────────────
DROP POLICY IF EXISTS "kids-captures: authenticated insert" ON storage.objects;
CREATE POLICY "kids-captures: authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'kids-captures');


-- ── SELECT (authenticated users can read all captures — teachers need to see all) ──
DROP POLICY IF EXISTS "kids-captures: authenticated select" ON storage.objects;
CREATE POLICY "kids-captures: authenticated select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'kids-captures');


-- ── UPDATE (allow overwriting own captures only) ──────────────────────────────
DROP POLICY IF EXISTS "kids-captures: owner update" ON storage.objects;
CREATE POLICY "kids-captures: owner update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'kids-captures' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'kids-captures');


-- ── DELETE (owner or teacher/superadmin can delete) ───────────────────────────
DROP POLICY IF EXISTS "kids-captures: owner delete" ON storage.objects;
CREATE POLICY "kids-captures: owner delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'kids-captures' AND owner = auth.uid());


-- =================================================================================
-- PART 4 — Verify
-- =================================================================================
SELECT
  id              AS bucket_id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'kids-captures';
