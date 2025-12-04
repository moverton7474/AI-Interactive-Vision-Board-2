-- Create analytics_events table
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  metadata jsonb default '{}'::jsonb,
  session_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.analytics_events enable row level security;

-- Policies
create policy "Users can insert their own events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

-- Only admins/analysts should view events (omitted for now, or strictly scoped)
create policy "Users can view their own events"
  on public.analytics_events for select
  using (auth.uid() = user_id);

-- Create index for faster querying
create index idx_analytics_event_name on public.analytics_events(event_name);
create index idx_analytics_created_at on public.analytics_events(created_at);
