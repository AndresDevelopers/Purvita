-- Setup Cron Job for Development Environment
-- Execute this in Supabase SQL Editor for the development project

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists
SELECT cron.unschedule('generate-weekly-registration-code-dev');

-- Schedule the weekly code generation for development environment
-- Runs every Monday at 00:00 UTC
SELECT cron.schedule(
  'generate-weekly-registration-code-dev',
  '0 0 * * 1', -- Every Monday at 00:00 UTC
  $$
  SELECT
    net.http_post(
      url := 'https://zqpfsdlfxvensqevzeco.supabase.co/functions/v1/registration-access-code',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify the job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'generate-weekly-registration-code-dev';

-- Create monitoring view for development
CREATE OR REPLACE VIEW dev_registration_code_cron_status AS
SELECT 
  j.jobname,
  j.schedule,
  j.active,
  jrd.status AS last_status,
  jrd.return_message AS last_message,
  jrd.start_time AS last_run,
  jrd.end_time AS last_completed,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) AS duration_seconds
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT *
  FROM cron.job_run_details
  WHERE jobid = j.jobid
  ORDER BY start_time DESC
  LIMIT 1
) jrd ON true
WHERE j.jobname = 'generate-weekly-registration-code-dev';

-- Query the monitoring view
SELECT * FROM dev_registration_code_cron_status;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Development cron job configured successfully!';
  RAISE NOTICE 'Job will run every Monday at 00:00 UTC';
  RAISE NOTICE 'Use: SELECT * FROM dev_registration_code_cron_status; to monitor';
END $$;