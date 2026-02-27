-- ==============================================================================
-- GDPR/COPPA COMPLIANCE: 24-Hour Telemetry Retention Policy
-- ==============================================================================
-- This migration creates a pg_cron scheduled job that automatically hard-deletes
-- all biometric captures from the 'kids-captures' bucket that are older than
-- 24 hours. The application frontend has zero responsibility for enforcing this.
--
-- IMPORTANT SETUP INSTRUCTIONS:
-- 1. Log into the Supabase Dashboard.
-- 2. Go to Database -> Extensions.
-- 3. Search for "pg_cron" and enable it.
-- 4. Execute this script in the SQL Editor.
-- ==============================================================================

-- 1. Ensure the pg_cron extension exists
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- 2. Create the secure cleanup function
-- SECURITY DEFINER ensures it runs with superuser privileges to bypass RLS
CREATE OR REPLACE FUNCTION public.delete_old_kids_captures()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Deleting rows from storage.objects automatically triggers a Supabase 
    -- background worker to delete the physical objects from the S3 backend.
    DELETE FROM storage.objects
    WHERE bucket_id = 'kids-captures'
      AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- 3. Unschedule any existing cron job with the same name to prevent duplicates
SELECT cron.unschedule('kids_captures_24h_retention') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'kids_captures_24h_retention'
);

-- 4. Schedule the new job to run every hour on the hour (cron format: '0 * * * *')
SELECT cron.schedule(
    'kids_captures_24h_retention',
    '0 * * * *',
    $$SELECT public.delete_old_kids_captures();$$
);
