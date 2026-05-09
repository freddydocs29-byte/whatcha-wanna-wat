-- ─── Auth migration — run in Supabase Dashboard → SQL Editor ─────────────────
-- Safe to run on an existing database. All statements are idempotent.
-- Does NOT drop or alter existing columns. Does NOT change RLS on profiles.

-- 1. Add auth_user_id and avatar_url to profiles
--    auth_user_id: links an authenticated Supabase user to their anonymous profile
--    avatar_url:   public URL of the avatar stored in the `avatars` Storage bucket
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_user_id  uuid  UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url    text;

-- 2. Partial index — only rows that have been claimed by an auth user
CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx
  ON profiles (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 3. Avatars storage bucket
--    public=true  → signed URLs not required; avatar URLs are stable and shareable
--    5 MB limit, JPEG / PNG / WebP only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS for the avatars bucket
--    Keeping the same permissive posture as the rest of the MVP schema.
--    Tighten to auth.uid()-scoped policies once anonymous usage is deprecated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_public_read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "avatars_public_read"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars')
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_open_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "avatars_open_insert"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'avatars')
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_open_update'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "avatars_open_update"
        ON storage.objects FOR UPDATE
        USING (bucket_id = 'avatars')
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_open_delete'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "avatars_open_delete"
        ON storage.objects FOR DELETE
        USING (bucket_id = 'avatars')
    $pol$;
  END IF;
END $$;
