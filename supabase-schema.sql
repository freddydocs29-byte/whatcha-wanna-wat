-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─── Profiles ────────────────────────────────────────────────────────────────
-- One row per anonymous user (keyed by localStorage UUID). No auth required.
-- Persists preferences and learned weights across sessions on the same device,
-- and enables week-over-week improvement for each user.

create table if not exists profiles (
  user_id                text        primary key,
  display_name           text,
  dietary_restrictions   jsonb       not null default '[]',  -- dislikedFoods e.g. ["Seafood","Dairy"]
  hard_no_foods          jsonb       not null default '[]',  -- strict never-show list (same as above for MVP)
  favorite_cuisines      jsonb       not null default '[]',  -- preferred cuisines e.g. ["Italian","Asian"]
  learned_weights        jsonb,                              -- TasteProfile: likedTags/dislikedTags/likedCategories/interactionCount
  recently_seen_meal_ids jsonb       not null default '[]',  -- flat list of recently shown meal IDs (recency penalty)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- RLS: open access for MVP (tighten when real auth is added)
alter table profiles enable row level security;
create policy "MVP open access" on profiles for all using (true) with check (true);

create table sessions (
  id             uuid        default gen_random_uuid() primary key,
  host_user_id   text        not null,
  guest_user_id  text,
  status         text        not null default 'waiting' check (status in ('waiting', 'active', 'matched')),
  locked_meal_id text,
  deck_meal_ids  jsonb,                                 -- ordered array of meal IDs for the shared deck
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  expires_at     timestamptz default (now() + interval '24 hours')
);

-- RLS: open access for MVP (tighten when real auth is added)
alter table sessions enable row level security;
create policy "MVP open access" on sessions for all using (true) with check (true);

-- To apply deck_meal_ids to an existing sessions table run:
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deck_meal_ids jsonb;

-- ─── Swipes ──────────────────────────────────────────────────────────────────
-- Stores each user's yes/no decision per meal within a shared session.
-- Unique constraint prevents a user from swiping the same meal twice.

create table swipes (
  id          uuid        default gen_random_uuid() primary key,
  session_id  uuid        not null references sessions(id) on delete cascade,
  user_id     text        not null,
  meal_id     text        not null,
  decision    text        not null check (decision in ('yes', 'no')),
  created_at  timestamptz default now(),
  unique (session_id, user_id, meal_id)
);

create index swipes_session_meal on swipes (session_id, meal_id);

alter table swipes enable row level security;
create policy "MVP open access" on swipes for all using (true) with check (true);

-- ─── Analytics Events ─────────────────────────────────────────────────────────
-- Lightweight event log. session_id is nullable (solo sessions have none).
-- properties is free-form JSONB — includes timestamp, mealId, swipeIndex, etc.
-- Do NOT store personal/sensitive info in properties.

create table if not exists analytics_events (
  id           uuid        default gen_random_uuid() primary key,
  user_id      text,
  session_id   text,
  event_name   text        not null,
  properties   jsonb       not null default '{}',
  created_at   timestamptz not null default now()
);

create index analytics_events_event_name on analytics_events (event_name);
create index analytics_events_user_id    on analytics_events (user_id);
create index analytics_events_created_at on analytics_events (created_at desc);

-- RLS: open write for MVP (anonymous users insert their own events).
-- Reads are locked down — only service-role queries should read analytics.
alter table analytics_events enable row level security;
create policy "MVP analytics insert" on analytics_events for insert using (true) with check (true);

-- ─── User Sessions ────────────────────────────────────────────────────────────
-- One row per user × deck interaction (solo or group).
-- Tracks engagement: swipe count, time-to-decision, resolution, and whether the
-- user returned within 10 minutes (a strong "regret / second-thoughts" signal).
-- Note: "user_sessions" is distinct from the group pairing "sessions" table above.
-- group_session_id links to the shared sessions table when is_group_session=true.

create table if not exists user_sessions (
  id                       uuid        default gen_random_uuid() primary key,
  user_id                  text        not null,
  opened_at                timestamptz not null default now(),
  closed_at                timestamptz,
  meal_period              text        not null check (meal_period in ('breakfast','lunch','dinner','latenight')),
  day_type                 text        not null check (day_type in ('weekday','friday','weekend','sunday')),
  resolved                 boolean     not null default false,
  swipe_count              integer     not null default 0,
  time_to_decision_seconds integer,
  returned_within_10min    boolean,
  is_group_session         boolean     not null default false,
  group_session_id         uuid        references sessions(id) on delete set null
);

alter table user_sessions enable row level security;
create policy "MVP open access" on user_sessions for all using (true) with check (true);

create index user_sessions_user_id    on user_sessions (user_id);
create index user_sessions_opened_at  on user_sessions (opened_at desc);

-- ─── Decisions ────────────────────────────────────────────────────────────────
-- One row per meal outcome within a user_session.
-- Currently written only for accepted outcomes; schema supports rejected/abandoned
-- for future per-pass tracking without requiring a migration.

create table if not exists decisions (
  id               uuid        default gen_random_uuid() primary key,
  session_id       uuid        not null references user_sessions(id) on delete cascade,
  user_id          text        not null,
  meal_id          text        not null,
  meal_name        text        not null,
  meal_period      text        not null check (meal_period in ('breakfast','lunch','dinner','latenight')),
  day_type         text        not null check (day_type in ('weekday','friday','weekend','sunday')),
  outcome          text        not null check (outcome in ('accepted','rejected','abandoned')),
  rejection_reason text,
  position_in_deck integer     not null,
  decided_at       timestamptz not null default now(),
  is_ai_generated  boolean     not null default false
);

alter table decisions enable row level security;
create policy "MVP open access" on decisions for all using (true) with check (true);

create index decisions_session_id  on decisions (session_id);
create index decisions_user_id     on decisions (user_id);
create index decisions_decided_at  on decisions (decided_at desc);
