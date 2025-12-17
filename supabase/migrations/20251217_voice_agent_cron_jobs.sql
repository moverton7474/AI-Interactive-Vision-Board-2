-- ============================================
-- VOICE AGENT PROACTIVE SCHEDULING
-- Migration: 20251217_voice_agent_cron_jobs
-- Description: Sets up pg_cron jobs for voice agent proactive outreach
-- ============================================

-- NOTE: This migration only enables extensions.
-- Cron jobs must be scheduled manually in Supabase Dashboard SQL Editor
-- using the SQL below (replace YOUR_SERVICE_ROLE_KEY with actual key).

-- Ensure extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions for cron jobs
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================
-- View to check cron job status
-- ============================================
CREATE OR REPLACE VIEW public.cron_job_status AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job;

-- Grant access to the view
GRANT SELECT ON public.cron_job_status TO authenticated;

-- ============================================
-- MANUAL SETUP REQUIRED:
-- Run the following SQL in Supabase Dashboard > SQL Editor
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
-- ============================================

/*
-- STEP 1: Schedule cron jobs (run in SQL Editor)

-- Process due notifications every 15 minutes
SELECT cron.schedule(
  'process-due-notifications',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/schedule-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"action": "process_due"}'::jsonb
  ) AS request_id;
  $$
);

-- Check habit reminders every 15 minutes
SELECT cron.schedule(
  'check-habit-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/schedule-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"action": "check_habits"}'::jsonb
  ) AS request_id;
  $$
);

-- Check streak milestones daily at 10am UTC
SELECT cron.schedule(
  'check-streak-milestones',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/schedule-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"action": "check_streaks"}'::jsonb
  ) AS request_id;
  $$
);

-- Check pace warnings daily at 9am UTC
SELECT cron.schedule(
  'check-pace-warnings',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/schedule-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"action": "check_pace"}'::jsonb
  ) AS request_id;
  $$
);

-- Generate weekly reviews every Sunday at 8am UTC
SELECT cron.schedule(
  'generate-weekly-reviews',
  '0 8 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/generate-weekly-review',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{"action": "generate_all"}'::jsonb
  ) AS request_id;
  $$
);

-- STEP 2: Verify jobs were created
SELECT * FROM cron.job;

-- STEP 3: To unschedule a job, use:
-- SELECT cron.unschedule('job-name-here');

*/
