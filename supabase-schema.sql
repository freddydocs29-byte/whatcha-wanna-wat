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
