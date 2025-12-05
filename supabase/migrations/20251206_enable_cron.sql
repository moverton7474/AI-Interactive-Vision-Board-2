-- Enable pg_cron and pg_net extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Schedule the nightly YouTube feed ingestion
-- Note: You must replace YOUR_SERVICE_ROLE_KEY with the actual key when running manually.
-- In a real migration, we might use a secure way or assume the key is injected, 
-- but pg_cron requires the key in the header string.

-- Uncomment and run this block manually in Supabase Dashboard if needed, 
-- replacing the key.
/*
select
  cron.schedule(
    'ingest-youtube-feed-nightly',
    '0 3 * * *',
    $$
    select
      net.http_post(
          url:='https://edaigbnnofyxcfbpcvct.supabase.co/functions/v1/ingest-youtube-feed',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );
*/
