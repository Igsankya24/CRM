-- Initialize Supabase Migrations schema and table to prevent CLI errors
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  statements text[],
  name text
);

-- ==========================================
-- MIGRATION: 001_initial_schema.sql
-- ==========================================
-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/indexes and DROP IF EXISTS
-- for policies/triggers (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONTACT_TAGS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Users can manage contact tags" ON contact_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid()));

-- ============================================================
-- CUSTOM_FIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY "Users can manage own custom fields" ON custom_fields FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONTACT_CUSTOM_VALUES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_custom_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, custom_field_id)
);

ALTER TABLE contact_custom_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY "Users can manage custom values" ON contact_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid()));

-- ============================================================
-- CONTACT_NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY "Users can manage own notes" ON contact_notes FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_agent_id UUID,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ai_mode BOOLEAN NOT NULL DEFAULT true,
  ai_model TEXT,
  ai_system_prompt TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot')),
  sender_id UUID,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template')),
  content_text TEXT,
  media_url TEXT,
  template_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Service role can insert messages" ON messages FOR INSERT WITH CHECK (true);

-- ============================================================
-- WHATSAPP_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_only_free_models BOOLEAN NOT NULL DEFAULT true,
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash:free',
  ai_system_prompt TEXT,
  app_secret TEXT, -- AES-256-GCM encrypted
  openrouter_api_key TEXT -- AES-256-GCM encrypted
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY "Users can manage own config" ON whatsapp_config FOR ALL USING (auth.uid() = user_id);

-- Add AI configuration columns if not exists (for existing database environments)
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS ai_only_free_models BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS ai_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash:free';
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS app_secret TEXT; -- AES-256-GCM encrypted
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT; -- AES-256-GCM encrypted

-- ============================================================
-- MESSAGE_TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Marketing' CHECK (category IN ('Marketing', 'Utility', 'Authentication')),
  language TEXT DEFAULT 'en_US',
  header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document')),
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY "Users can manage own templates" ON message_templates FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PIPELINES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY "Users can manage own pipelines" ON pipelines FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PIPELINE_STAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can manage pipeline stages" ON pipeline_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid()));

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  expected_close_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY "Users can manage own deals" ON deals FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BROADCASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en_US',
  template_variables JSONB,
  audience_filter JSONB,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY "Users can manage own broadcasts" ON broadcasts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BROADCAST_RECIPIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);

ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Users can manage broadcast recipients" ON broadcast_recipients FOR ALL
  USING (EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at — drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
DROP TRIGGER IF EXISTS set_updated_at ON contacts;
DROP TRIGGER IF EXISTS set_updated_at ON conversations;
DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_config;
DROP TRIGGER IF EXISTS set_updated_at ON message_templates;
DROP TRIGGER IF EXISTS set_updated_at ON deals;
DROP TRIGGER IF EXISTS set_updated_at ON broadcasts;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON broadcasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- Uses SECURITY DEFINER with owner=postgres (bypasses RLS).
-- EXCEPTION block ensures signup still succeeds even if profile
-- insert fails — profile can be created later if needed.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ENABLE REALTIME for key tables (idempotent via DO block)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END $$;




-- ==========================================
-- MIGRATION: 002_pipelines_enhancements.sql
-- ==========================================
-- ============================================================
-- Pipeline enhancements:
--   * deals.assigned_to — optional FK to profiles.id
--   * deals.status — CHECK constraint ('open', 'won', 'lost')
--     (replaces the old default 'active' with spec-compliant values)
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Add assigned_to (nullable, FK to profiles)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);

-- Normalize status values: any existing 'active' row becomes 'open'
UPDATE deals SET status = 'open' WHERE status = 'active' OR status IS NULL;

-- Replace the old default and enforce allowed values
ALTER TABLE deals ALTER COLUMN status SET DEFAULT 'open';

-- Drop prior CHECK if any (none in 001, but be idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_status_check' AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals DROP CONSTRAINT deals_status_check;
  END IF;
END $$;

ALTER TABLE deals
  ADD CONSTRAINT deals_status_check CHECK (status IN ('open', 'won', 'lost'));




-- ==========================================
-- MIGRATION: 003_broadcast_recipient_wamid.sql
-- ==========================================
-- ============================================================
-- Broadcast recipient correlation + aggregate counts
--
-- Problem this solves:
--   * broadcast_recipients had no column to correlate with Meta's
--     message id, so webhook status updates (sent/delivered/read)
--     could not be mirrored into the recipient row and the broadcast
--     aggregate counts never advanced.
--   * aggregate counts on `broadcasts` (sent/delivered/read/replied/
--     failed) were updated ad-hoc by the sender, which drifted quickly
--     once webhooks arrived out of band.
--
-- This migration:
--   1. Adds whatsapp_message_id (+ unique index) so webhooks can find
--      a recipient given Meta's message id.
--   2. Adds a composite index on (broadcast_id, status) so the
--      aggregate trigger's COUNT(*) FILTER scans are fast.
--   3. Installs an AFTER INSERT/UPDATE/DELETE trigger on
--      broadcast_recipients that re-aggregates the parent broadcasts
--      row. Keeps writer code trivial — the webhook + hook only touch
--      the recipient row; counts stay consistent automatically.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- UNIQUE so webhook retries can't create duplicate correlations.
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_recipients_wamid
  ON broadcast_recipients (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- Fast path for the aggregate trigger's COUNT(*) FILTER subqueries.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_status
  ON broadcast_recipients (broadcast_id, status);

-- ============================================================
-- Aggregate trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_broadcast_counts(bid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    sent_count      = agg.sent_count,
    delivered_count = agg.delivered_count,
    read_count      = agg.read_count,
    replied_count   = agg.replied_count,
    failed_count    = agg.failed_count,
    updated_at      = NOW()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent_count,
      COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('read','replied'))                    AS read_count,
      COUNT(*) FILTER (WHERE status = 'replied')                              AS replied_count,
      COUNT(*) FILTER (WHERE status = 'failed')                               AS failed_count
    FROM broadcast_recipients
    WHERE broadcast_id = bid
  ) agg
  WHERE b.id = bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.broadcast_recipient_aggregate_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_broadcast_counts(OLD.broadcast_id);
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE — only recompute when status changed (or on fresh insert)
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recompute_broadcast_counts(NEW.broadcast_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS broadcast_recipients_aggregate ON broadcast_recipients;
CREATE TRIGGER broadcast_recipients_aggregate
AFTER INSERT OR UPDATE OR DELETE ON broadcast_recipients
FOR EACH ROW EXECUTE FUNCTION public.broadcast_recipient_aggregate_trigger();




-- ==========================================
-- MIGRATION: 004_contact_delete_set_null.sql
-- ==========================================
-- ============================================================
-- Allow contact deletion without wiping history.
--
-- broadcast_recipients.contact_id and deals.contact_id were declared
-- NOT NULL REFERENCES contacts(id) with no ON DELETE action, so
-- Postgres defaults to NO ACTION. The first time a user tried to
-- delete a contact that had ever received a broadcast or been
-- attached to a deal, the delete failed with:
--
--   ERROR 23503: update or delete on table "contacts" violates
--   foreign key constraint ... on table <other>
--
-- CASCADE is the wrong fix — it would silently wipe historical
-- broadcast recipient rows (breaking audit + retroactively moving
-- broadcasts.sent_count / delivered_count / read_count etc. via the
-- aggregate trigger) and deal rows.
--
-- SET NULL is the right fix: history rows survive with a NULL
-- contact_id. The UI is already null-safe (contact?.name ?? 'Unknown',
-- contact?.phone, etc.).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ── broadcast_recipients.contact_id ────────────────────────────
ALTER TABLE broadcast_recipients
  ALTER COLUMN contact_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcast_recipients_contact_id_fkey'
      AND conrelid = 'broadcast_recipients'::regclass
  ) THEN
    ALTER TABLE broadcast_recipients
      DROP CONSTRAINT broadcast_recipients_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE broadcast_recipients
  ADD CONSTRAINT broadcast_recipients_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE SET NULL;

-- ── deals.contact_id ───────────────────────────────────────────
ALTER TABLE deals
  ALTER COLUMN contact_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_contact_id_fkey'
      AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals
      DROP CONSTRAINT deals_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE deals
  ADD CONSTRAINT deals_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE SET NULL;




-- ==========================================
-- MIGRATION: 005_broadcast_counts_incremental.sql
-- ==========================================
-- ============================================================
-- Incremental broadcast aggregate trigger.
--
-- Migration 003 installed a trigger that recomputed every counter
-- (sent/delivered/read/replied/failed) via COUNT(*) FILTER on every
-- row change. For a 10k-recipient broadcast, the send loop produces
-- 10k INSERTs + 10k UPDATEs = 20k full aggregate scans, each walking
-- the (broadcast_id, status) index. Workable at small scale, but
-- O(n²) overall.
--
-- This migration replaces that with an incremental trigger that
-- adjusts the parent broadcast's counts by ±1 based on the OLD →
-- NEW.status delta. O(1) per recipient change; no scans at all.
--
-- Semantic model (same as the lib/broadcast-status.ts "forward-only
-- ladder" in the webhook):
--   sent_count       = recipients whose status is at or past 'sent'
--   delivered_count  = ... at or past 'delivered'
--   read_count       = ... at or past 'read'
--   replied_count    = status = 'replied'
--   failed_count     = status = 'failed'
--
-- A webhook that advances a recipient pending → sent → delivered →
-- read → replied bumps every rung it crosses by 1. Going to 'failed'
-- only bumps failed_count (and can only happen from pending / sent,
-- enforced in the webhook).
--
-- Keeps the safety net: a public recompute_broadcast_counts() SQL
-- function is retained so ops can run it manually if counts ever
-- drift (e.g. after bulk DB surgery).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Delta a single column by +1 / -1.
CREATE OR REPLACE FUNCTION public._bcast_bump(bid UUID, col TEXT, delta INT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE broadcasts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    col, col
  ) USING delta, bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Columns this recipient's status contributes to.
CREATE OR REPLACE FUNCTION public._bcast_cols_for_status(s TEXT)
RETURNS TEXT[] AS $$
BEGIN
  -- 'pending' contributes to nothing.
  IF s = 'pending' THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF s = 'sent'      THEN RETURN ARRAY['sent_count']; END IF;
  IF s = 'delivered' THEN RETURN ARRAY['sent_count','delivered_count']; END IF;
  IF s = 'read'      THEN RETURN ARRAY['sent_count','delivered_count','read_count']; END IF;
  IF s = 'replied'   THEN RETURN ARRAY['sent_count','delivered_count','read_count','replied_count']; END IF;
  IF s = 'failed'    THEN RETURN ARRAY['failed_count']; END IF;
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Replace the trigger body with the incremental version.
CREATE OR REPLACE FUNCTION public.broadcast_recipient_aggregate_trigger()
RETURNS TRIGGER AS $$
DECLARE
  old_cols TEXT[];
  new_cols TEXT[];
  c TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_cols := _bcast_cols_for_status(NEW.status);
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(OLD.broadcast_id, c, -1);
    END LOOP;
    RETURN OLD;
  END IF;

  -- UPDATE: only care if status changed.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    new_cols := _bcast_cols_for_status(NEW.status);
    -- Subtract the old contributions, add the new.
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, -1);
    END LOOP;
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger itself remains the same (INSERT/UPDATE/DELETE) — just its
-- body has been replaced.

-- Safety net — rebuild counts from scratch. Retained as-is so ops can
-- run it on demand if something ever drifts. Matches the incremental
-- trigger's semantic model exactly.
CREATE OR REPLACE FUNCTION public.recompute_broadcast_counts(bid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    sent_count      = agg.sent_count,
    delivered_count = agg.delivered_count,
    read_count      = agg.read_count,
    replied_count   = agg.replied_count,
    failed_count    = agg.failed_count,
    updated_at      = NOW()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent_count,
      COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('read','replied'))                    AS read_count,
      COUNT(*) FILTER (WHERE status = 'replied')                              AS replied_count,
      COUNT(*) FILTER (WHERE status = 'failed')                               AS failed_count
    FROM broadcast_recipients
    WHERE broadcast_id = bid
  ) agg
  WHERE b.id = bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;




-- ==========================================
-- MIGRATION: 006_automations.sql
-- ==========================================
-- ============================================================
-- 006_automations.sql — Automations feature
--
-- Idempotent migration — safe to run multiple times.
-- Follows the same conventions as 001_initial_schema.sql:
--   IF NOT EXISTS on tables/indexes, DROP IF EXISTS before
--   re-creating policies/triggers (Postgres has no
--   CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- AUTOMATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
-- Partial index tuned for the engine's hot path: find active automations
-- whose trigger_type matches the fired event. RLS then narrows by user_id.
CREATE INDEX IF NOT EXISTS idx_automations_active_trigger
  ON automations(trigger_type) WHERE is_active = TRUE;

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
CREATE POLICY "Users can manage own automations" ON automations FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON automations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTOMATION_STEPS
--
-- `position`       — order within parent scope (root scope or a branch).
-- `parent_step_id` — NULL for root-level steps; set to the Condition
--                    step's id for steps that live inside one of its
--                    branches.
-- `branch`         — NULL for root steps. For children of a Condition,
--                    'yes' or 'no' identifying which path.
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES automation_steps(id) ON DELETE CASCADE,
  branch TEXT CHECK (branch IN ('yes', 'no')),
  step_type TEXT NOT NULL,
  step_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation_id
  ON automation_steps(automation_id, position);
CREATE INDEX IF NOT EXISTS idx_automation_steps_parent
  ON automation_steps(parent_step_id) WHERE parent_step_id IS NOT NULL;

ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
CREATE POLICY "Users can manage steps of own automations" ON automation_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTOMATION_LOGS
--
-- user_id is denormalized for simple RLS; contact_id is nullable so
-- history survives contact deletion (mirrors migration 004's pattern
-- on broadcast_recipients / deals).
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  trigger_event TEXT NOT NULL,
  steps_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_automation
  ON automation_logs(automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user ON automation_logs(user_id);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
CREATE POLICY "Users can view own automation logs" ON automation_logs FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- AUTOMATION_PENDING_EXECUTIONS
--
-- Queue row created when a running automation hits a `wait` step.
-- The cron endpoint drains rows where run_at <= now() and status =
-- 'pending', flips them to 'running', and resumes the automation
-- from `next_step_position` with the saved `context` jsonb.
--
-- Service-role only — writes never originate from the browser, and
-- the engine uses the service-role client. No user policy exposed.
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  log_id UUID REFERENCES automation_logs(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  branch TEXT CHECK (branch IN ('yes', 'no')),
  next_step_position INTEGER NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  run_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_pending_due
  ON automation_pending_executions(run_at) WHERE status = 'pending';

ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policy for authenticated users — all
-- access is server-side via the service-role key.




-- ==========================================
-- MIGRATION: 007_automations_increment_counter.sql
-- ==========================================
-- ============================================================
-- 007_automations_increment_counter.sql
--
-- Atomic increment of automations.execution_count + refresh of
-- last_executed_at. Called via PostgREST RPC from the engine.
--
-- Before this, the engine did a read-modify-write:
--   UPDATE automations SET execution_count = <cached + 1> WHERE id = ...
-- so two concurrent dispatches (e.g. the same automation firing for
-- two different contacts in the same second) could both read N and
-- both write N+1, permanently losing one count.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_automation_execution_count(p_automation_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE automations
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW()
  WHERE id = p_automation_id;
$$;

-- Only the service role needs to call this (engine uses the
-- service-role client). Explicitly lock anon / authenticated out so
-- an authenticated user can't juice someone else's counter via RPC.
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_automation_execution_count(UUID) TO service_role;




-- ==========================================
-- MIGRATION: 008_profile_avatars_storage.sql
-- ==========================================
-- ============================================================
-- 008_profile_avatars_storage.sql
--
-- Creates the `avatars` Supabase Storage bucket and the RLS policies
-- that let each user manage only their own avatar file while letting
-- everyone read (so rendering <img> tags without signed URLs works).
--
-- File path convention used by the app:
--   avatars/{auth.uid()}/avatar-<timestamp>.<ext>
-- The policies rely on the first path segment matching auth.uid()::text.
--
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies live on storage.objects. Drop-if-exists because Postgres
-- has no CREATE POLICY IF NOT EXISTS, and we want this migration to
-- re-run cleanly.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );




-- ==========================================
-- MIGRATION: 009_message_actions.sql
-- ==========================================
-- ============================================================
-- Chat actions: reply linkage + reactions
--
-- Adds two things the chat UI now needs:
--
--   1. `messages.reply_to_message_id` — a self-FK so a message can
--      point at the message it replies to. We use the internal UUID
--      (not Meta's message_id text), because Meta IDs aren't unique
--      across phone numbers and can't be FK-constrained. The webhook
--      resolves `context.id` from Meta into our internal UUID before
--      writing. ON DELETE SET NULL — a deleted parent must not nuke
--      its replies (which today never happens, but the constraint
--      should match intent).
--
--   2. `message_reactions` table — one row per (message, actor).
--      Reactions arrive concurrently from agents (UI) and customers
--      (webhook). A row-level uniqueness constraint enforces "one
--      reaction per actor per message" without read-modify-write
--      games on a JSONB column.
--
--      `conversation_id` is denormalised purely so Supabase Realtime
--      can filter on it with a plain `eq`. Realtime can't join.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. Reply linkage on messages
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
  REFERENCES messages(id) ON DELETE SET NULL;

-- Partial index — most messages aren't replies, so skip nulls.
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- ============================================================
-- 2. message_reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('customer', 'agent')),
  actor_id UUID,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, actor_type, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_conversation
  ON message_reactions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
  ON message_reactions(message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see reactions on their conversations" ON message_reactions;
CREATE POLICY "Users see reactions on their conversations" ON message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = message_reactions.conversation_id
      AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON message_reactions;
CREATE POLICY "Users insert reactions on their conversations" ON message_reactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = message_reactions.conversation_id
      AND c.user_id = auth.uid()
  ));

-- Agents may remove their own reactions. Customer reactions are managed
-- by the webhook (service-role bypass), not the UI.
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON message_reactions;
CREATE POLICY "Users delete their own agent reactions" ON message_reactions FOR DELETE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Agents may swap their own reaction emoji (UPDATE path is also used by
-- the upsert in /api/whatsapp/react).
DROP POLICY IF EXISTS "Users update their own agent reactions" ON message_reactions;
CREATE POLICY "Users update their own agent reactions" ON message_reactions FOR UPDATE
  USING (
    actor_type = 'agent'
    AND actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = message_reactions.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- Realtime — let the thread subscribe filtered by conversation_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;




-- ==========================================
-- MIGRATION: 010_flows.sql
-- ==========================================
-- ============================================================
-- Conversational Flows: stateful, branching WhatsApp chatbot.
--
-- What this migration adds:
--
--   1. `flows` — the definition envelope (name, trigger config,
--      entry node, fallback policy, status). One row per authored bot.
--
--   2. `flow_nodes` — the graph rows. Edges live INSIDE each node's
--      `config` JSONB (e.g. each button row carries its own
--      `next_node_key`). Why edges-in-config rather than a separate
--      `flow_edges` table:
--        - The runner only ever asks "given current node X, where does
--          reply Y go?" — that's a single-row lookup with the JSON
--          already on the row. Splitting edges out forces a join per
--          inbound message.
--        - The builder's natural unit of edit is the node ("change this
--          button's label and target"); a side table would force
--          coordinated inserts/deletes on every save.
--      Cross-node integrity is enforced at save-time by the validator
--      (mirrors what `automation_steps`/`validate.ts` already does).
--
--      `node_key` is a STABLE STRING (e.g. "menu_existing"), not the
--      UUID. Edge targets reference node_key, which means:
--        - Cloning a flow doesn't require UUID rewriting in JSON edges.
--        - Templates ship with human-readable keys.
--        - Direct DB inspection is debuggable.
--      The (flow_id, node_key) UNIQUE constraint guarantees lookup
--      determinism.
--
--   3. `flow_runs` — per-contact runtime state machine. The linchpin
--      is the partial unique index `idx_one_active_run_per_contact`:
--      at most one ACTIVE run per (user_id, contact_id). Two concurrent
--      webhook deliveries trying to start a run both attempt INSERT;
--      the second fails with 23505 and the runner catches & exits.
--      No locking required.
--
--   4. `flow_run_events` — append-only audit. Used by the runner for
--      idempotency (refuses to advance twice on the same Meta
--      message_id) and by the future run-history viewer.
--
--   5. Widens `messages.content_type` CHECK to allow 'interactive', and
--      adds `messages.interactive_reply_id`. With this, button/list
--      taps become first-class message rows with a queryable reply id
--      instead of getting silently coerced into the "Unsupported
--      message type" fallback in parseMessageContent.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. Messages table — widen content_type, add interactive_reply_id
-- ============================================================

-- Drop & re-add the CHECK constraint to add 'interactive' as an allowed
-- value. Migration 001 named it `messages_content_type_check` (Postgres
-- default for an inline CHECK on a TEXT column).
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive'
  ));

-- Reply id of the button / list row the customer tapped. NULL for
-- everything that isn't an interactive reply. No FK — Meta button ids
-- are arbitrary user-chosen strings, not row references.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS interactive_reply_id TEXT;

-- ============================================================
-- 2. flows
-- ============================================================
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('keyword', 'first_inbound_message', 'manual')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- References `flow_nodes.node_key` (a string, not the UUID). NULL
  -- while the flow is being authored; required before activation
  -- (enforced by the validator, not at the DB level so drafts can save).
  entry_node_id TEXT,
  fallback_policy JSONB NOT NULL DEFAULT
    '{"on_unknown_reply":"reprompt","max_reprompts":2,"on_timeout_hours":24,"on_exhaust":"handoff"}'::jsonb,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active-only lookups dominate the runner's hot path. Partial index
-- keeps it small even when archived flows accumulate.
CREATE INDEX IF NOT EXISTS idx_flows_active_trigger
  ON flows(user_id, trigger_type)
  WHERE status = 'active';

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own flows" ON flows;
CREATE POLICY "Users can manage own flows" ON flows FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. flow_nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_key TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  )),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Reserved for the v2 react-flow canvas. v1 list editor leaves both
  -- at 0; carrying the columns now avoids a follow-up migration when
  -- the canvas ships.
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (flow_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow
  ON flow_nodes(flow_id);

ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage nodes on their flows" ON flow_nodes;
CREATE POLICY "Users manage nodes on their flows" ON flow_nodes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM flows f
    WHERE f.id = flow_nodes.flow_id
      AND f.user_id = auth.uid()
  ));

-- ============================================================
-- 4. flow_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS flow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- contact_id intentionally SET NULL on delete (matches the
  -- automation_logs / broadcast_recipients pattern in migration 004):
  -- deleting a contact must not erase the historical audit trail.
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',           -- currently awaiting customer input
    'completed',        -- reached an end node naturally
    'handed_off',       -- ended via a handoff node
    'timed_out',        -- swept by the cron after fallback_policy.on_timeout_hours
    'paused_by_agent',  -- an agent manually replied; flow yielded
    'failed'            -- runner hit an unrecoverable error
  )),
  current_node_key TEXT,
  last_prompt_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  -- Captured collect_input values + http_fetch responses. Interpolated
  -- into downstream node configs at advance time.
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  reprompt_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_advanced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  end_reason TEXT
);

-- Linchpin of idempotency / concurrency safety. At most one active run
-- per (user_id, contact_id). Two concurrent webhook deliveries each
-- trying to start a run will collide on this index; the second INSERT
-- fails with 23505 and the runner catches & returns consumed:true.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_contact
  ON flow_runs(user_id, contact_id)
  WHERE status = 'active';

-- Cron sweep query: "find active runs older than X hours" needs to be
-- index-supported so the sweeper stays cheap as flow volume grows.
CREATE INDEX IF NOT EXISTS idx_flow_runs_active_advanced
  ON flow_runs(last_advanced_at)
  WHERE status = 'active';

-- Detail / history page queries: "list runs for this flow, newest first".
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_started
  ON flow_runs(flow_id, started_at DESC);

ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own flow runs" ON flow_runs;
CREATE POLICY "Users see own flow runs" ON flow_runs FOR SELECT
  USING (auth.uid() = user_id);

-- The runner uses service_role for all writes; users never INSERT /
-- UPDATE / DELETE flow_runs from the client. Omitting those policies
-- keeps the surface tight (mirrors automation_pending_executions).

-- ============================================================
-- 5. flow_run_events
-- ============================================================
CREATE TABLE IF NOT EXISTS flow_run_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'started',
    'node_entered',
    'message_sent',
    'reply_received',
    'fallback_fired',
    'handoff',
    'timeout',
    'error',
    'completed'
  )),
  node_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency check in the runner needs fast lookup by
-- (flow_run_id, event_type, payload->>'meta_message_id'). The runner
-- does the JSONB extraction client-side; index just needs the first
-- two columns to narrow.
CREATE INDEX IF NOT EXISTS idx_flow_run_events_run_type
  ON flow_run_events(flow_run_id, event_type);

-- History viewer: reverse-chronological scan per run.
CREATE INDEX IF NOT EXISTS idx_flow_run_events_run_time
  ON flow_run_events(flow_run_id, created_at DESC);

ALTER TABLE flow_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see events on their runs" ON flow_run_events;
CREATE POLICY "Users see events on their runs" ON flow_run_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM flow_runs r
    WHERE r.id = flow_run_events.flow_run_id
      AND r.user_id = auth.uid()
  ));

-- ============================================================
-- 6. updated_at trigger on flows
-- ============================================================
-- Reuses update_updated_at_column() from migration 001. Trigger name
-- matches the convention used on every other table that has one
-- (see migration 001 lines 361-367).
DROP TRIGGER IF EXISTS set_updated_at ON flows;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. Realtime publication
-- ============================================================
-- Add flow_runs so the inbox can render "this contact is in flow X at
-- node Y" live as the runner advances. Other flow tables don't need
-- realtime — the builder reads on demand, the runner is server-side.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'flow_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE flow_runs;
  END IF;
END $$;




-- ==========================================
-- MIGRATION: 011_profile_beta_features.sql
-- ==========================================
-- ============================================================
-- Per-account beta feature flag column on `profiles`.
--
-- Adds an array of opted-in beta feature keys to each profile row.
-- Currently used to gate the Flows feature (`'flows'`); shape is
-- generic so subsequent betas (e.g. `'ai_replies'`, `'voice_notes'`)
-- can land in this column without another migration.
--
-- Why a per-account flag rather than a global env var:
--   - Self-hosted wacrm instances are multi-user (small teams, shared
--     workspaces). A global flag would force every account on the
--     instance to opt into a not-yet-stable feature simultaneously.
--   - The owner wanted to dogfood the feature on their own account
--     before exposing it to teammates. Flipping a column via
--     Supabase Studio (`UPDATE profiles SET beta_features = ...
--     WHERE user_id = '<theirs>'`) is the lowest-friction toggle.
--   - DB-managed flags survive env rotation, deploy-restart timing,
--     and (since beta_features is a TEXT[]) extend naturally to
--     additional features without further schema work.
--
-- Default is the empty array, so every existing profile row opts
-- out of every beta feature on apply. NOT NULL keeps callers from
-- having to defend against `beta_features == null` at every site.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS beta_features TEXT[]
    NOT NULL
    DEFAULT ARRAY[]::TEXT[];

-- No new RLS policy needed: the existing `Users can view own profile` /
-- `Users can update own profile` policies (migration 001) already gate
-- access to this column. Server-side reads via service_role bypass RLS
-- as they do for every other column.
--
-- No index needed: the column is read on the login codepath (one row
-- lookup by primary key / user_id, both already indexed) and very
-- rarely written.




-- ==========================================
-- MIGRATION: 012_flows_increment_counter.sql
-- ==========================================
-- ============================================================
-- 012_flows_increment_counter.sql
--
-- Atomic increment of flows.execution_count + refresh of
-- last_executed_at. Called via PostgREST RPC from the engine.
--
-- Before this, startNewRun did a read-modify-write:
--   UPDATE flows SET execution_count = <cached + 1> WHERE id = ...
-- so two concurrent dispatches (e.g. two webhooks for the same flow
-- starting runs for different contacts in the same second) could both
-- read N and both write N+1, permanently losing one count.
--
-- Mirrors migration 007 for automations — same shape, same security
-- posture. Idempotent: safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_flow_execution_count(p_flow_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE flows
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW()
  WHERE id = p_flow_id;
$$;

-- Only the service role needs to call this (engine uses the
-- service-role client). Explicitly lock anon / authenticated out so
-- an authenticated user can't juice someone else's counter via RPC.
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION increment_flow_execution_count(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_flow_execution_count(UUID) TO service_role;




-- ==========================================
-- MIGRATION: 013_whatsapp_config_phone_number_id_unique.sql
-- ==========================================
-- ============================================================
-- whatsapp_config: enforce one user per phone_number_id
--
-- The webhook routes inbound messages by `phone_number_id` and uses
-- `.single()` to find the owning config row. If two users have saved
-- the same `phone_number_id`, `.single()` errors PGRST116 ("multiple
-- rows returned") and the webhook silently drops every inbound
-- message — see issue #136.
--
-- wacrm is single-tenant per WhatsApp number by design (RLS on
-- conversations / messages is `auth.uid() = user_id`, so another user
-- physically cannot read a conversation routed to a different owner).
-- A UNIQUE constraint at the DB level makes that intent enforceable
-- and stops races between the app-level check and the insert.
--
-- ─── On existing data ───────────────────────────────────────────
-- If duplicates already exist in production, this migration FAILS
-- LOUDLY rather than silently dropping rows. Auto-deduping would
-- destroy user data (encrypted tokens, connection state) — the
-- operator has to choose which user keeps the number. To resolve:
--
--   SELECT phone_number_id, array_agg(user_id) AS owners
--   FROM whatsapp_config
--   GROUP BY phone_number_id
--   HAVING count(*) > 1;
--
-- Then DELETE the duplicate rows you don't want to keep and re-run
-- migrations.
--
-- Idempotent — safe to run multiple times once the constraint is in
-- place.
-- ============================================================

-- 1. Fail loudly if duplicates exist. Spelling out the conflicting
--    phone_number_id and the user_ids that own it gives the operator
--    a copy-pasteable starting point.
DO $$
DECLARE
  conflict_count INT;
  sample TEXT;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT phone_number_id
    FROM whatsapp_config
    GROUP BY phone_number_id
    HAVING count(*) > 1
  ) dupes;

  IF conflict_count > 0 THEN
    SELECT string_agg(
      phone_number_id || ' -> [' || array_to_string(owners, ', ') || ']',
      E'\n  '
    )
    INTO sample
    FROM (
      SELECT phone_number_id, array_agg(user_id::text) AS owners
      FROM whatsapp_config
      GROUP BY phone_number_id
      HAVING count(*) > 1
    ) dupe_detail;

    RAISE EXCEPTION
      E'Cannot add UNIQUE(phone_number_id) on whatsapp_config — % phone_number_id value(s) are claimed by more than one user:\n  %\nDelete the duplicate rows you do not want to keep (see migration comment), then re-run migrations.',
      conflict_count,
      sample;
  END IF;
END $$;

-- 2. Add the UNIQUE constraint. PostgreSQL has no "ADD CONSTRAINT IF
--    NOT EXISTS", so guard via pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_config_phone_number_id_key'
      AND conrelid = 'whatsapp_config'::regclass
  ) THEN
    ALTER TABLE whatsapp_config
      ADD CONSTRAINT whatsapp_config_phone_number_id_key
      UNIQUE (phone_number_id);
  END IF;
END $$;




-- ==========================================
-- MIGRATION: 014_message_templates_meta_integration.sql
-- ==========================================
-- ============================================================
-- message_templates: Meta-integration columns + raw-enum status
--
-- Why this exists:
--   The original schema (001) treated message_templates as a local
--   catalog with a TitleCase status ('Draft'|'Pending'|'Approved'|
--   'Rejected'). When the sync route imports from Meta, several of
--   Meta's real statuses (PAUSED, DISABLED, IN_APPEAL, PENDING_REVIEW)
--   got collapsed into the four-bucket TitleCase set — losing
--   information that the upcoming submit / edit / resubmit flows
--   need (e.g. a PAUSED template is recoverable; a DISABLED one is
--   gone for 30 days; an IN_APPEAL one shouldn't be edited).
--
--   This migration switches `status` to the raw Meta enum and adds
--   the columns the submit/webhook/edit flows need:
--
--     - sample_values    JSONB     {body: string[], header: string[]}
--                                  required by Meta for variable templates
--     - meta_template_id TEXT      Meta's id once the template is
--                                  submitted; used as hsm_id on edit/delete
--                                  so we scope to a single language
--     - rejection_reason TEXT      surfaced from webhook on REJECTED
--     - quality_score    TEXT      GREEN | YELLOW | RED, from webhook
--     - header_handle    TEXT      from Resumable Upload, for media headers
--     - header_media_url TEXT      URL fallback for media headers (v1 path)
--     - submission_error TEXT      last 4xx from Meta on submit, for retry
--     - last_submitted_at          rate-limit awareness (100 creates/hour)
--
--   Also adds a unique index on (user_id, name, language) so the sync
--   upsert can match on it instead of select-then-insert, and so users
--   can't create two local rows for the same Meta template variant.
--
--   Buttons CHECK enforces a shape guard (array of objects with a
--   recognised `type`) at the DB level — strict per-type validation
--   lives in the API layer so error messages can be specific.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- 1. New columns. ADD COLUMN IF NOT EXISTS is idempotent.
ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS sample_values JSONB,
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS quality_score TEXT,
  ADD COLUMN IF NOT EXISTS header_handle TEXT,
  ADD COLUMN IF NOT EXISTS header_media_url TEXT,
  ADD COLUMN IF NOT EXISTS submission_error TEXT,
  ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMPTZ;

-- 2. quality_score CHECK — GREEN / YELLOW / RED only (or NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_templates_quality_score_check'
      AND conrelid = 'message_templates'::regclass
  ) THEN
    ALTER TABLE message_templates
      ADD CONSTRAINT message_templates_quality_score_check
      CHECK (quality_score IS NULL OR quality_score IN ('GREEN', 'YELLOW', 'RED'));
  END IF;
END $$;

-- 3. status: swap TitleCase enum for raw Meta enum.
--    Order: drop old check → backfill data → add new check → update default.
--    Doing it in this order means rows are momentarily check-free, but
--    the backfill is a single UPDATE so the window is microseconds.
DO $$
BEGIN
  -- Drop the legacy check by introspecting pg_constraint (the original
  -- constraint name from migration 001 is auto-generated; match by
  -- column + table).
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'message_templates'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%Draft%Pending%Approved%Rejected%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE message_templates DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint c
      WHERE c.conrelid = 'message_templates'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%Draft%Pending%Approved%Rejected%'
      LIMIT 1
    );
  END IF;
END $$;

-- Backfill existing rows. Idempotent — already-uppercase rows are no-ops.
UPDATE message_templates SET status = 'DRAFT'    WHERE status = 'Draft';
UPDATE message_templates SET status = 'PENDING'  WHERE status = 'Pending';
UPDATE message_templates SET status = 'APPROVED' WHERE status = 'Approved';
UPDATE message_templates SET status = 'REJECTED' WHERE status = 'Rejected';

-- Add the raw-enum check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_templates_status_meta_check'
      AND conrelid = 'message_templates'::regclass
  ) THEN
    ALTER TABLE message_templates
      ADD CONSTRAINT message_templates_status_meta_check
      CHECK (status IN (
        'DRAFT',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'PAUSED',
        'DISABLED',
        'IN_APPEAL',
        'PENDING_DELETION'
      ));
  END IF;
END $$;

-- New default for fresh inserts.
ALTER TABLE message_templates ALTER COLUMN status SET DEFAULT 'DRAFT';

-- 4. buttons shape guard. Postgres disallows subqueries in CHECK
--    constraints, so we can only assert the outer shape here (is-array
--    + max length). Per-element type validation (recognised `type`
--    values, max counts per type, QUICK_REPLY-vs-CTA exclusivity, URL
--    example required when {{1}} is present) lives in the API
--    validators in src/lib/whatsapp/template-validators.ts — that's
--    where error messages can be specific to the offending button
--    anyway.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_templates_buttons_shape_check'
      AND conrelid = 'message_templates'::regclass
  ) THEN
    ALTER TABLE message_templates
      ADD CONSTRAINT message_templates_buttons_shape_check
      CHECK (
        buttons IS NULL
        OR (
          jsonb_typeof(buttons) = 'array'
          AND jsonb_array_length(buttons) <= 10
        )
      );
  END IF;
END $$;

-- 5. Unique index on (user_id, name, language). Fails loudly on
--    duplicates rather than dropping rows — the operator picks which
--    one to keep (same pattern as migration 013).
DO $$
DECLARE
  dupe_count INT;
  sample TEXT;
BEGIN
  SELECT count(*) INTO dupe_count
  FROM (
    SELECT user_id, name, language
    FROM message_templates
    GROUP BY user_id, name, language
    HAVING count(*) > 1
  ) dupes;

  IF dupe_count > 0 THEN
    SELECT string_agg(
      user_id::text || ' / ' || name || ' / ' || COALESCE(language, '(null)') ||
        ' (' || count || ' rows)',
      E'\n  '
    )
    INTO sample
    FROM (
      SELECT user_id, name, language, count(*) AS count
      FROM message_templates
      GROUP BY user_id, name, language
      HAVING count(*) > 1
    ) dupe_detail;

    RAISE EXCEPTION
      E'Cannot add UNIQUE(user_id, name, language) on message_templates — % duplicate combination(s):\n  %\nDelete the rows you do not want to keep, then re-run migrations.',
      dupe_count, sample;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS message_templates_user_name_language_key
  ON message_templates (user_id, name, language);

-- 6. Lookup index for the webhook handler — incoming events identify
--    templates by (waba_id, meta_template_id). meta_template_id is the
--    discriminator we'll match on.
CREATE INDEX IF NOT EXISTS idx_message_templates_meta_template_id
  ON message_templates (meta_template_id)
  WHERE meta_template_id IS NOT NULL;




-- ==========================================
-- MIGRATION: 015_whatsapp_config_registration.sql
-- ==========================================
-- ============================================================
-- whatsapp_config: track Meta Cloud API registration state
--
-- Why this exists:
--   Saving a row to whatsapp_config does NOT make a phone number
--   actually receive webhook events from Meta. Two extra Cloud API
--   calls are required:
--
--     POST /{phone_number_id}/register     — subscribes the number
--                                            with a 2FA PIN, makes
--                                            it routable to OUR app
--     POST /{waba_id}/subscribed_apps      — subscribes the WABA
--                                            (one-time per app, but
--                                            idempotent so we can
--                                            call on every save)
--
--   Until those two complete successfully, Meta routes inbound
--   events to whichever app last registered the number (often the
--   one that did Embedded Signup originally). Symptom: a second
--   wacrm user adds a second number under the same WABA, the UI
--   reports "Connected" because metadata verification succeeds,
--   but Meta's activity log shows zero events for that number.
--
--   These columns let the UI distinguish "credentials saved" from
--   "actually live" and let users retry registration without
--   re-entering everything.
--
-- Backfill: every column is nullable. Existing rows survive with
-- NULL values; the UI shows them as "registration status unknown —
-- click Verify Registration" and the diagnostic endpoint fills the
-- timestamps on the next probe.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscribed_apps_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_registration_error TEXT;

-- Index supports the "find all numbers awaiting registration"
-- query a future admin dashboard might want; cheap to maintain.
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_registered_at
  ON whatsapp_config (registered_at)
  WHERE registered_at IS NULL;




-- ==========================================
-- MIGRATION: 016_flow_media.sql
-- ==========================================
-- ============================================================
-- 016_flow_media.sql
--
-- Adds support for media nodes in conversational flows:
--
--   1. New 'send_media' value on `flow_nodes.node_type` CHECK
--      constraint. Mirrors the same drop-and-recreate pattern migration
--      010 used to land the original list. The node config lives in
--      JSONB and is shape-checked by the validator + TS types, not the
--      DB.
--
--   2. `flow-media` Supabase Storage bucket where the builder uploads
--      the file the customer will receive. Public bucket so Meta can
--      pull the URL without auth — same trade-off as the avatars
--      bucket (see migration 008). Per-user RLS on writes scopes the
--      bucket so one tenant can't read/overwrite another's media.
--
--      Path convention:
--        flow-media/{auth.uid()}/<timestamp>-<basename>.<ext>
--      First path segment must equal auth.uid()::text — same shape
--      migration 008 uses for avatars so the policy code reads the
--      same.
--
--      Size limit 16 MB — Meta's WhatsApp Cloud API caps documents at
--      100 MB but videos at 16 MB and images at 5 MB; we pick the
--      tightest universal cap that still works for the document case
--      that prompted this feature (PDF invoices / receipts).
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1. flow_nodes.node_type — add 'send_media'
-- ============================================================
ALTER TABLE flow_nodes
  DROP CONSTRAINT IF EXISTS flow_nodes_node_type_check;

ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_node_type_check
  CHECK (node_type IN (
    'start',
    'send_buttons',
    'send_list',
    'send_message',
    'send_media',
    'collect_input',
    'condition',
    'set_tag',
    'handoff',
    'http_fetch',
    'end'
  ));

-- ============================================================
-- 2. flow-media storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'flow-media',
  'flow-media',
  TRUE,
  16777216, -- 16 MB (Meta video cap; documents/images fit under this)
  ARRAY[
    -- Images
    'image/png', 'image/jpeg', 'image/webp',
    -- Videos
    'video/mp4', 'video/3gpp',
    -- Documents
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies live on storage.objects. Same drop-then-create pattern as
-- migration 008 (no CREATE POLICY IF NOT EXISTS in Postgres).
DROP POLICY IF EXISTS "Flow media is publicly readable" ON storage.objects;
CREATE POLICY "Flow media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'flow-media');

DROP POLICY IF EXISTS "Users can upload their own flow media" ON storage.objects;
CREATE POLICY "Users can upload their own flow media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flow-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own flow media" ON storage.objects;
CREATE POLICY "Users can update their own flow media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'flow-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own flow media" ON storage.objects;
CREATE POLICY "Users can delete their own flow media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'flow-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );




-- ==========================================
-- MIGRATION: 017_account_sharing.sql
-- ==========================================
-- ============================================================
-- 017_account_sharing.sql — Multi-user accounts (foundation)
--
-- Turns wacrm from single-tenant-per-user into multi-tenant-per-
-- account. Every existing user becomes the sole `owner` of a
-- freshly-created account; every existing row is backfilled with
-- that account's id. Post-apply behaviour is identical to before
-- *until* a teammate is invited (which lands in later PRs).
--
-- What this migration does
--   1. Introduces `account_role_enum` and tables `accounts` /
--      `account_invitations`.
--   2. Adds an `is_account_member(account_id, min_role)` SECURITY
--      DEFINER helper used by every policy below.
--   3. Adds `account_id` (+ `account_role` on `profiles`) to every
--      table that previously carried a `user_id` FK to auth.users.
--   4. Backfills one account per existing user and propagates
--      `account_id` to every domain row.
--   5. Drops the old `auth.uid() = user_id` policies and replaces
--      them with membership-checked equivalents. Viewers may read;
--      agents+ may write to operational data; admins+ may write to
--      settings-class tables.
--   6. Swaps `whatsapp_config.UNIQUE(user_id)` for
--      `UNIQUE(account_id)` — one WhatsApp number per account.
--   7. Swaps the `flow_runs` "one active run per (user_id, contact)"
--      unique index for `(account_id, contact_id)`.
--   8. Replaces `handle_new_user` so new signups receive a freshly-
--      created personal account *and* the `owner` role atomically.
--
-- What this migration does NOT touch
--   - `profiles.role TEXT` (legacy, unused) stays. Flag for removal
--     in a later cleanup.
--   - The `user_id` columns on domain tables stay too — they still
--     identify "the agent who owns this row" (assignment, audit).
--     They are *no longer* used for tenancy isolation.
--   - Storage buckets (avatars, flow-media) stay user-scoped. A
--     later migration will rescope flow-media to account paths.
--   - No user-facing UI changes — those are gated separately on
--     `profiles.beta_features` containing 'account_sharing' in the
--     follow-up PRs.
--
-- Idempotent — safe to run multiple times. New columns use
-- IF NOT EXISTS; policies / triggers / indexes are dropped before
-- recreate (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- TYPES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role_enum') THEN
    CREATE TYPE account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');
  END IF;
END $$;

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  -- owner_user_id is denormalised for fast "is this user the owner of
  -- their account" reads and for the one-account-per-user invariant
  -- below. The source of truth for membership is profiles.account_id.
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One account per user (the locked design decision — single
-- membership). Drops automatically if we ever relax to many-to-many.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_one_per_owner
  ON accounts(owner_user_id);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at ON accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ACCOUNT_INVITATIONS
--
-- One row per outstanding invite link. We store `token_hash` (SHA-
-- 256) rather than the raw token so a leaked DB snapshot doesn't
-- yield a usable invite. The plaintext token is returned exactly
-- once by the POST endpoint at creation time and never persisted.
-- ============================================================
CREATE TABLE IF NOT EXISTS account_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role account_role_enum NOT NULL CHECK (role <> 'owner'),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_account_invitations_account_pending
  ON account_invitations(account_id, expires_at)
  WHERE accepted_at IS NULL;

ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILE EXTENSION
--
-- account_role lives on profiles (not a separate memberships table)
-- because the design is one-account-per-user; this keeps reads cheap
-- (one row, already loaded by the auth hook).
--
-- Added BEFORE the is_account_member helper below because LANGUAGE
-- sql functions resolve column references at CREATE time (unlike
-- plpgsql, which defers to call time).
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS account_role account_role_enum;

CREATE INDEX IF NOT EXISTS idx_profiles_account_role
  ON profiles(account_id, account_role);

-- ============================================================
-- MEMBERSHIP HELPER
--
-- SECURITY DEFINER so the policy body can read `profiles` without
-- recursive RLS evaluation. Returns true iff `auth.uid()` is a
-- member of `target_account_id` with at least `min_role`.
--
-- Role hierarchy: owner > admin > agent > viewer.
-- ============================================================
CREATE OR REPLACE FUNCTION is_account_member(
  target_account_id UUID,
  min_role account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super Admin bypasses all checks
  IF EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Super Admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.account_id = target_account_id
      AND CASE p.account_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
        >=
          CASE min_role
            WHEN 'owner'  THEN 4
            WHEN 'admin'  THEN 3
            WHEN 'agent'  THEN 2
            WHEN 'viewer' THEN 1
          END
  );
END;
$$;

ALTER FUNCTION is_account_member(UUID, account_role_enum) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_account_member(UUID, account_role_enum) TO authenticated, service_role;

-- ============================================================
-- ADD account_id TO EVERY PARENT TENANT TABLE
--
-- Nullable for now — backfill runs below, then NOT NULL applied at
-- the end. Indexes too: every "list mine" query becomes "list my
-- account's", so account_id is the new hot lookup key.
-- ============================================================
ALTER TABLE contacts                       ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE tags                           ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE custom_fields                  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE contact_notes                  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE conversations                  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_config                ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE message_templates              ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE pipelines                      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE deals                          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE broadcasts                     ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE automations                    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE automation_logs                ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE automation_pending_executions  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE flows                          ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE flow_runs                      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- ============================================================
-- BACKFILL
--
-- Order is load-bearing:
--   1. Create one account per existing profile (the existing user
--      is the owner).
--   2. Stamp profile.account_id / account_role from the row above.
--   3. Propagate account_id to every domain table via the profile.
--   4. Apply NOT NULL on every account_id column.
--
-- Wrapped in a DO block so a partially-applied migration (e.g.
-- accounts already exist but propagation didn't finish) re-converges
-- on re-run rather than duplicating accounts.
-- ============================================================
DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts',
    'automations', 'automation_logs', 'automation_pending_executions',
    'flows', 'flow_runs'
  ];
BEGIN
  -- (1) Create one account per existing profile whose user does not
  -- yet own one. Idempotent: skips users that already have an account.
  INSERT INTO accounts (name, owner_user_id)
  SELECT COALESCE(NULLIF(p.full_name, ''), p.email, 'My account'),
         p.user_id
  FROM profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.owner_user_id = p.user_id
  );

  -- (2) Stamp profile.account_id / account_role for every profile that
  -- hasn't been linked yet.
  UPDATE profiles p
  SET account_id   = a.id,
      account_role = 'owner'
  FROM accounts a
  WHERE a.owner_user_id = p.user_id
    AND p.account_id IS NULL;

  -- (3) Propagate account_id to every domain table. Uses the row's
  -- existing user_id → profiles.user_id → profiles.account_id chain.
  -- Only updates rows where account_id IS NULL so a re-run is cheap.
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format($f$
      UPDATE %I t
      SET account_id = p.account_id
      FROM profiles p
      WHERE t.user_id = p.user_id
        AND t.account_id IS NULL
    $f$, v_table);
  END LOOP;
END $$;

-- (4) NOT NULL — split out from the DO block so DDL changes happen
-- at the top transactional level. Idempotent: NOT NULL on an
-- already-NOT NULL column is a no-op error-free.
ALTER TABLE profiles                       ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE profiles                       ALTER COLUMN account_role SET NOT NULL;
ALTER TABLE contacts                       ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE tags                           ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE custom_fields                  ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE contact_notes                  ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE conversations                  ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE whatsapp_config                ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE message_templates              ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE pipelines                      ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE deals                          ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE broadcasts                     ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE automations                    ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE automation_logs                ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE automation_pending_executions  ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE flows                          ALTER COLUMN account_id   SET NOT NULL;
ALTER TABLE flow_runs                      ALTER COLUMN account_id   SET NOT NULL;

-- ============================================================
-- INDEXES ON account_id (every parent — these are the new hot keys)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_account                ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_tags_account                    ON tags(account_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_account           ON custom_fields(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_account           ON contact_notes(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account           ON conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_account         ON whatsapp_config(account_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_account       ON message_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_account               ON pipelines(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_account                   ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_account              ON broadcasts(account_id);
CREATE INDEX IF NOT EXISTS idx_automations_account             ON automations(account_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_account         ON automation_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_automation_pending_account      ON automation_pending_executions(account_id);
CREATE INDEX IF NOT EXISTS idx_flows_account                   ON flows(account_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_account               ON flow_runs(account_id);

-- ============================================================
-- whatsapp_config: one WhatsApp number per ACCOUNT
--
-- Was UNIQUE(user_id). Same number cannot be configured by two
-- accounts; same account cannot register two numbers. If multi-
-- number-per-account is ever wanted, drop the unique and add a
-- "primary" boolean.
-- ============================================================
ALTER TABLE whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_config_account_id_key'
  ) THEN
    ALTER TABLE whatsapp_config ADD CONSTRAINT whatsapp_config_account_id_key UNIQUE (account_id);
  END IF;
END $$;

-- ============================================================
-- flow_runs: idempotency key swaps to (account_id, contact_id)
--
-- The "at most one active run per contact" invariant is per-account
-- now — two accounts that happen to share a contact phone number
-- must be able to run their own flows independently.
-- ============================================================
DROP INDEX IF EXISTS idx_one_active_run_per_contact;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_contact
  ON flow_runs(account_id, contact_id)
  WHERE status = 'active';

-- ============================================================
-- RLS REWRITE — PARENT TABLES
--
-- Replaces every `auth.uid() = user_id` policy with the membership
-- check. Three policy tiers:
--   - viewer    : SELECT  (read-only)
--   - agent+    : SELECT + INSERT/UPDATE/DELETE (operational data)
--   - admin+    : same  + write paths on settings-class tables
--
-- The legacy `user_id` column stays on every row (still useful for
-- assignment + audit) but is no longer consulted for isolation.
-- ============================================================

-- ---- contacts ---------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
DROP POLICY IF EXISTS contacts_select ON contacts;
DROP POLICY IF EXISTS contacts_insert ON contacts;
DROP POLICY IF EXISTS contacts_update ON contacts;
DROP POLICY IF EXISTS contacts_delete ON contacts;
CREATE POLICY contacts_select ON contacts FOR SELECT USING (is_account_member(account_id));
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- tags (settings-class) -------------------------------------
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS tags_select ON tags;
DROP POLICY IF EXISTS tags_insert ON tags;
DROP POLICY IF EXISTS tags_update ON tags;
DROP POLICY IF EXISTS tags_delete ON tags;
CREATE POLICY tags_select ON tags FOR SELECT USING (is_account_member(account_id));
CREATE POLICY tags_insert ON tags FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY tags_update ON tags FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY tags_delete ON tags FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- custom_fields (settings-class) ----------------------------
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
DROP POLICY IF EXISTS custom_fields_select ON custom_fields;
DROP POLICY IF EXISTS custom_fields_insert ON custom_fields;
DROP POLICY IF EXISTS custom_fields_update ON custom_fields;
DROP POLICY IF EXISTS custom_fields_delete ON custom_fields;
CREATE POLICY custom_fields_select ON custom_fields FOR SELECT USING (is_account_member(account_id));
CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- contact_notes ---------------------------------------------
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
DROP POLICY IF EXISTS contact_notes_select ON contact_notes;
DROP POLICY IF EXISTS contact_notes_insert ON contact_notes;
DROP POLICY IF EXISTS contact_notes_update ON contact_notes;
DROP POLICY IF EXISTS contact_notes_delete ON contact_notes;
CREATE POLICY contact_notes_select ON contact_notes FOR SELECT USING (is_account_member(account_id));
CREATE POLICY contact_notes_insert ON contact_notes FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY contact_notes_update ON contact_notes FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY contact_notes_delete ON contact_notes FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- conversations ---------------------------------------------
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS conversations_select ON conversations;
DROP POLICY IF EXISTS conversations_insert ON conversations;
DROP POLICY IF EXISTS conversations_update ON conversations;
DROP POLICY IF EXISTS conversations_delete ON conversations;
CREATE POLICY conversations_select ON conversations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY conversations_update ON conversations FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY conversations_delete ON conversations FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- whatsapp_config (settings-class) --------------------------
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_select ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_insert ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_update ON whatsapp_config;
DROP POLICY IF EXISTS whatsapp_config_delete ON whatsapp_config;
CREATE POLICY whatsapp_config_select ON whatsapp_config FOR SELECT USING (is_account_member(account_id));
CREATE POLICY whatsapp_config_insert ON whatsapp_config FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY whatsapp_config_update ON whatsapp_config FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY whatsapp_config_delete ON whatsapp_config FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- message_templates (settings-class) ------------------------
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
DROP POLICY IF EXISTS message_templates_select ON message_templates;
DROP POLICY IF EXISTS message_templates_insert ON message_templates;
DROP POLICY IF EXISTS message_templates_update ON message_templates;
DROP POLICY IF EXISTS message_templates_delete ON message_templates;
CREATE POLICY message_templates_select ON message_templates FOR SELECT USING (is_account_member(account_id));
CREATE POLICY message_templates_insert ON message_templates FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY message_templates_update ON message_templates FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY message_templates_delete ON message_templates FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- pipelines (settings-class) --------------------------------
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
DROP POLICY IF EXISTS pipelines_select ON pipelines;
DROP POLICY IF EXISTS pipelines_insert ON pipelines;
DROP POLICY IF EXISTS pipelines_update ON pipelines;
DROP POLICY IF EXISTS pipelines_delete ON pipelines;
CREATE POLICY pipelines_select ON pipelines FOR SELECT USING (is_account_member(account_id));
CREATE POLICY pipelines_insert ON pipelines FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY pipelines_update ON pipelines FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY pipelines_delete ON pipelines FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- deals ------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
DROP POLICY IF EXISTS deals_select ON deals;
DROP POLICY IF EXISTS deals_insert ON deals;
DROP POLICY IF EXISTS deals_update ON deals;
DROP POLICY IF EXISTS deals_delete ON deals;
CREATE POLICY deals_select ON deals FOR SELECT USING (is_account_member(account_id));
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY deals_update ON deals FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY deals_delete ON deals FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- broadcasts -------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
DROP POLICY IF EXISTS broadcasts_select ON broadcasts;
DROP POLICY IF EXISTS broadcasts_insert ON broadcasts;
DROP POLICY IF EXISTS broadcasts_update ON broadcasts;
DROP POLICY IF EXISTS broadcasts_delete ON broadcasts;
CREATE POLICY broadcasts_select ON broadcasts FOR SELECT USING (is_account_member(account_id));
CREATE POLICY broadcasts_insert ON broadcasts FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY broadcasts_update ON broadcasts FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY broadcasts_delete ON broadcasts FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- automations ------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
DROP POLICY IF EXISTS automations_select ON automations;
DROP POLICY IF EXISTS automations_insert ON automations;
DROP POLICY IF EXISTS automations_update ON automations;
DROP POLICY IF EXISTS automations_delete ON automations;
CREATE POLICY automations_select ON automations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY automations_insert ON automations FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY automations_update ON automations FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY automations_delete ON automations FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- automation_logs -------------------------------------------
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
DROP POLICY IF EXISTS automation_logs_select ON automation_logs;
CREATE POLICY automation_logs_select ON automation_logs FOR SELECT USING (is_account_member(account_id));
-- Service role inserts logs; no INSERT/UPDATE/DELETE policy for clients.

-- ---- automation_pending_executions -----------------------------
-- Service-role only (no client policies). Account_id is on the row
-- for consistency and so the cron can route account-scoped queries.

-- ---- flows ------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own flows" ON flows;
DROP POLICY IF EXISTS flows_select ON flows;
DROP POLICY IF EXISTS flows_insert ON flows;
DROP POLICY IF EXISTS flows_update ON flows;
DROP POLICY IF EXISTS flows_delete ON flows;
CREATE POLICY flows_select ON flows FOR SELECT USING (is_account_member(account_id));
CREATE POLICY flows_insert ON flows FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY flows_update ON flows FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY flows_delete ON flows FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ---- flow_runs --------------------------------------------------
DROP POLICY IF EXISTS "Users see own flow runs" ON flow_runs;
DROP POLICY IF EXISTS flow_runs_select ON flow_runs;
CREATE POLICY flow_runs_select ON flow_runs FOR SELECT USING (is_account_member(account_id));
-- Service-role driven; no client INSERT/UPDATE/DELETE.

-- ============================================================
-- RLS REWRITE — CHILD TABLES (parent-join semantics)
-- ============================================================

-- ---- contact_tags ----------------------------------------------
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
DROP POLICY IF EXISTS contact_tags_select ON contact_tags;
DROP POLICY IF EXISTS contact_tags_modify ON contact_tags;
CREATE POLICY contact_tags_select ON contact_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND is_account_member(c.account_id))
);
CREATE POLICY contact_tags_modify ON contact_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND is_account_member(c.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_tags.contact_id AND is_account_member(c.account_id, 'agent'))
);

-- ---- contact_custom_values -------------------------------------
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
DROP POLICY IF EXISTS contact_custom_values_select ON contact_custom_values;
DROP POLICY IF EXISTS contact_custom_values_modify ON contact_custom_values;
CREATE POLICY contact_custom_values_select ON contact_custom_values FOR SELECT USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND is_account_member(c.account_id))
);
CREATE POLICY contact_custom_values_modify ON contact_custom_values FOR ALL USING (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND is_account_member(c.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_custom_values.contact_id AND is_account_member(c.account_id, 'agent'))
);

-- ---- messages --------------------------------------------------
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_modify ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND is_account_member(c.account_id))
);
CREATE POLICY messages_modify ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND is_account_member(c.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND is_account_member(c.account_id, 'agent'))
);
-- Service-role webhook inserts (Meta deliveries) bypass RLS as before.

-- ---- pipeline_stages -------------------------------------------
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
DROP POLICY IF EXISTS pipeline_stages_select ON pipeline_stages;
DROP POLICY IF EXISTS pipeline_stages_modify ON pipeline_stages;
CREATE POLICY pipeline_stages_select ON pipeline_stages FOR SELECT USING (
  EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND is_account_member(p.account_id))
);
CREATE POLICY pipeline_stages_modify ON pipeline_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND is_account_member(p.account_id, 'admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM pipelines p WHERE p.id = pipeline_stages.pipeline_id AND is_account_member(p.account_id, 'admin'))
);

-- ---- broadcast_recipients --------------------------------------
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
DROP POLICY IF EXISTS broadcast_recipients_select ON broadcast_recipients;
DROP POLICY IF EXISTS broadcast_recipients_modify ON broadcast_recipients;
CREATE POLICY broadcast_recipients_select ON broadcast_recipients FOR SELECT USING (
  EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND is_account_member(b.account_id))
);
CREATE POLICY broadcast_recipients_modify ON broadcast_recipients FOR ALL USING (
  EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND is_account_member(b.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM broadcasts b WHERE b.id = broadcast_recipients.broadcast_id AND is_account_member(b.account_id, 'agent'))
);

-- ---- automation_steps ------------------------------------------
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
DROP POLICY IF EXISTS automation_steps_select ON automation_steps;
DROP POLICY IF EXISTS automation_steps_modify ON automation_steps;
CREATE POLICY automation_steps_select ON automation_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND is_account_member(a.account_id))
);
CREATE POLICY automation_steps_modify ON automation_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND is_account_member(a.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM automations a WHERE a.id = automation_steps.automation_id AND is_account_member(a.account_id, 'agent'))
);

-- ---- flow_nodes ------------------------------------------------
DROP POLICY IF EXISTS "Users manage nodes on their flows" ON flow_nodes;
DROP POLICY IF EXISTS flow_nodes_select ON flow_nodes;
DROP POLICY IF EXISTS flow_nodes_modify ON flow_nodes;
CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (
  EXISTS (SELECT 1 FROM flows f WHERE f.id = flow_nodes.flow_id AND is_account_member(f.account_id))
);
CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (
  EXISTS (SELECT 1 FROM flows f WHERE f.id = flow_nodes.flow_id AND is_account_member(f.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM flows f WHERE f.id = flow_nodes.flow_id AND is_account_member(f.account_id, 'agent'))
);

-- ---- flow_run_events -------------------------------------------
DROP POLICY IF EXISTS "Users see events on their runs" ON flow_run_events;
DROP POLICY IF EXISTS flow_run_events_select ON flow_run_events;
CREATE POLICY flow_run_events_select ON flow_run_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM flow_runs r WHERE r.id = flow_run_events.flow_run_id AND is_account_member(r.account_id))
);

-- ---- message_reactions -----------------------------------------
DROP POLICY IF EXISTS "Users see reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users update their own agent reactions" ON message_reactions;
DROP POLICY IF EXISTS message_reactions_select ON message_reactions;
DROP POLICY IF EXISTS message_reactions_modify ON message_reactions;
CREATE POLICY message_reactions_select ON message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND is_account_member(c.account_id)
  )
);
CREATE POLICY message_reactions_modify ON message_reactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND is_account_member(c.account_id, 'agent')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND is_account_member(c.account_id, 'agent')
  )
);

-- ============================================================
-- RLS — PROFILES (revised)
--
-- A profile row is readable by every member of its account so the
-- Members tab can render. It is only writable by the row's own
-- user (so an admin cannot edit a teammate's name/avatar — that's
-- the teammate's own settings). Role changes happen via the
-- separate /api/account/members endpoint (admin-only, server-side).
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_update ON profiles;
DROP POLICY IF EXISTS profiles_insert ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (auth.uid() = user_id OR is_account_member(account_id));
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RLS — ACCOUNTS & ACCOUNT_INVITATIONS
--
-- accounts: members read; admins+ update; nobody inserts via
-- client (the signup trigger / redeem RPC own creation).
-- invitations: admins+ full control; everyone else has no
-- visibility. The /api/invitations/[token]/peek endpoint uses the
-- service role to look up by token_hash anonymously.
-- ============================================================
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
CREATE POLICY accounts_select ON accounts FOR SELECT
  USING (is_account_member(id));
CREATE POLICY accounts_update ON accounts FOR UPDATE
  USING (is_account_member(id, 'admin'))
  WITH CHECK (is_account_member(id, 'admin'));

DROP POLICY IF EXISTS account_invitations_select ON account_invitations;
DROP POLICY IF EXISTS account_invitations_modify ON account_invitations;
CREATE POLICY account_invitations_select ON account_invitations FOR SELECT
  USING (is_account_member(account_id, 'admin'));
CREATE POLICY account_invitations_modify ON account_invitations FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

-- ============================================================
-- SIGNUP TRIGGER — replace to also create a personal account
--
-- Every new auth.users row now produces:
--   - a fresh `accounts` row owned by them
--   - a `profiles` row linked to that account with role = 'owner'
--
-- The invite-redemption RPC (later PR) will reassign profile.account_id
-- to the inviter's account and delete the orphan personal account if
-- it's still empty.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();




-- ==========================================
-- MIGRATION: 018_account_member_rpcs.sql
-- ==========================================
-- ============================================================
-- 018_account_member_rpcs.sql — RPCs for member management
--
-- Why RPCs and not direct UPDATEs from the client
--
--   The `profiles_update` RLS policy from migration 017 only
--   allows a user to update their *own* profile row. That is
--   correct for self-service edits (name, avatar) but it would
--   block an admin from changing a teammate's role or moving
--   a removed member to a fresh personal account.
--
--   These three SECURITY DEFINER functions are the supervised
--   escape hatches: they bypass RLS to do exactly the writes the
--   matching API route needs, but every function self-checks the
--   caller's authority via `auth.uid()` first, so the privilege
--   bypass is scoped tightly.
--
-- Error contract
--
--   All functions raise Postgres exceptions with these SQLSTATEs:
--     42501 ("insufficient_privilege") — forbidden
--     22023 ("invalid_parameter_value") — bad input / 400
--   The `toErrorResponse` helper on the API side maps each to
--   the right HTTP status, with the RAISE message surfaced to
--   the caller.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- set_member_role(p_user_id, p_new_role)
--
-- Admin+ changes another member's role within the caller's
-- account. Cannot promote to / demote from 'owner' (that is the
-- transfer endpoint). Cannot target self.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_member_role(
  p_user_id UUID,
  p_new_role account_role_enum
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_account_id UUID;
  v_caller_role account_role_enum;
  v_target_account_id UUID;
  v_target_role account_role_enum;
BEGIN
  -- Caller must be authenticated.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Resolve caller's account + role.
  SELECT account_id, account_role
  INTO v_caller_account_id, v_caller_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no account' USING ERRCODE = '42501';
  END IF;

  -- Caller must be admin+.
  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'This action requires the admin role or higher'
      USING ERRCODE = '42501';
  END IF;

  -- Can't change own role via this endpoint.
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role'
      USING ERRCODE = '22023';
  END IF;

  -- Resolve target.
  SELECT account_id, account_role
  INTO v_target_account_id, v_target_role
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_target_account_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = '22023';
  END IF;

  -- Target must be in caller's account.
  IF v_target_account_id <> v_caller_account_id THEN
    RAISE EXCEPTION 'Target user is not a member of your account'
      USING ERRCODE = '42501';
  END IF;

  -- Owner role changes go through transfer_account_ownership.
  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Use transfer_account_ownership to demote an owner'
      USING ERRCODE = '22023';
  END IF;
  IF p_new_role = 'owner' THEN
    RAISE EXCEPTION 'Use transfer_account_ownership to promote to owner'
      USING ERRCODE = '22023';
  END IF;

  UPDATE profiles
  SET account_role = p_new_role
  WHERE user_id = p_user_id;
END;
$$;

ALTER FUNCTION public.set_member_role(UUID, account_role_enum) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_member_role(UUID, account_role_enum) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_member_role(UUID, account_role_enum) TO authenticated;

-- ============================================================
-- remove_account_member(p_user_id)
--
-- Admin+ removes another member from the caller's account. The
-- removed user is NOT deleted from auth.users — they keep their
-- login. Instead, a fresh personal account is created on the fly
-- and their profile is reassigned to it as 'owner'. This is the
-- mirror image of the signup trigger: the user effectively
-- "starts over" with an empty account, free to invite their own
-- teammates if they want.
--
-- Cannot target the owner. Cannot target self.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_account_member(
  p_user_id UUID
) RETURNS UUID  -- the new personal account id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_account_id UUID;
  v_caller_role account_role_enum;
  v_target_account_id UUID;
  v_target_role account_role_enum;
  v_target_name TEXT;
  v_target_email TEXT;
  v_new_account_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id, account_role
  INTO v_caller_account_id, v_caller_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no account' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'This action requires the admin role or higher'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself; transfer ownership or leave the account instead'
      USING ERRCODE = '22023';
  END IF;

  SELECT account_id, account_role, full_name, email
  INTO v_target_account_id, v_target_role, v_target_name, v_target_email
  FROM profiles
  WHERE user_id = p_user_id;

  IF v_target_account_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = '22023';
  END IF;

  IF v_target_account_id <> v_caller_account_id THEN
    RAISE EXCEPTION 'Target user is not a member of your account'
      USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the account owner; transfer ownership first'
      USING ERRCODE = '22023';
  END IF;

  -- Spin up a fresh personal account for the removed user. Mirror
  -- of handle_new_user's logic — keep them whole, just relocated.
  INSERT INTO accounts (name, owner_user_id)
  VALUES (
    COALESCE(NULLIF(v_target_name, ''), v_target_email, 'My account'),
    p_user_id
  )
  RETURNING id INTO v_new_account_id;

  UPDATE profiles
  SET account_id = v_new_account_id,
      account_role = 'owner'
  WHERE user_id = p_user_id;

  RETURN v_new_account_id;
END;
$$;

ALTER FUNCTION public.remove_account_member(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.remove_account_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_account_member(UUID) TO authenticated;

-- ============================================================
-- transfer_account_ownership(p_new_owner_user_id)
--
-- Owner only. Atomically:
--   - demotes the current owner to 'admin'
--   - promotes the target to 'owner'
--   - updates accounts.owner_user_id
--
-- Both writes happen in the same statement-level transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.transfer_account_ownership(
  p_new_owner_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_account_id UUID;
  v_caller_role account_role_enum;
  v_target_account_id UUID;
  v_target_role account_role_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT account_id, account_role
  INTO v_caller_account_id, v_caller_role
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_caller_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no account' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the account owner can transfer ownership'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_owner_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You are already the owner'
      USING ERRCODE = '22023';
  END IF;

  SELECT account_id, account_role
  INTO v_target_account_id, v_target_role
  FROM profiles
  WHERE user_id = p_new_owner_user_id;

  IF v_target_account_id IS NULL THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = '22023';
  END IF;

  IF v_target_account_id <> v_caller_account_id THEN
    RAISE EXCEPTION 'Target user is not a member of your account'
      USING ERRCODE = '42501';
  END IF;

  -- Demote current owner first so the temporary state where the
  -- account has zero owners is never visible — both writes happen
  -- in the same function transaction.
  UPDATE profiles SET account_role = 'admin'
  WHERE user_id = auth.uid();

  UPDATE profiles SET account_role = 'owner'
  WHERE user_id = p_new_owner_user_id;

  UPDATE accounts SET owner_user_id = p_new_owner_user_id
  WHERE id = v_caller_account_id;
END;
$$;

ALTER FUNCTION public.transfer_account_ownership(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.transfer_account_ownership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_account_ownership(UUID) TO authenticated;




-- ==========================================
-- MIGRATION: 019_invitation_rpcs.sql
-- ==========================================
-- ============================================================
-- 019_invitation_rpcs.sql — peek + redeem invitation RPCs
--
-- The third and last server-side migration in the multi-user
-- accounts series. Both functions are SECURITY DEFINER for the
-- same reason as the member RPCs in 018: the writes they need to
-- do (or, for peek, the reads) cross RLS boundaries that the
-- regular client policies (correctly) deny.
--
-- peek_invitation   — anonymous read. The /join/<token> page
--   calls this to render "You're being invited to <Account> as
--   <Role>" before the visitor signs in. Returns a uniform
--   `{ ok, reason?, account_name?, role?, expires_at? }` JSON
--   so the API route doesn't have to interpret error rows.
--
-- redeem_invitation — authenticated. Atomically moves the caller
--   from their just-created personal account to the inviter's
--   account, cleans up the orphan personal account, and stamps
--   the invitation accepted. Refuses if the caller's current
--   account holds any domain data (to avoid silent data loss).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- peek_invitation(p_token_hash text)
--
-- Anonymous read by token hash. The plaintext token never
-- reaches the DB; the route handler hashes it first.
--
-- Returns a JSON object with one of two shapes:
--   { "ok": true,  "account_name": "...", "role": "...",
--     "expires_at": "2026-..." }
--   { "ok": false, "reason": "not_found" | "expired" | "used" }
--
-- We could collapse all three failure cases to "not_found" to
-- harden against enumeration, but the join page needs the
-- distinction for UX ("This invite has expired — ask <name>
-- for a new one"). Tokens carry 256 bits of entropy, so the
-- enumeration risk is theoretical; rate-limiting the route on
-- the IP layer adds belt-and-braces.
-- ============================================================
CREATE OR REPLACE FUNCTION public.peek_invitation(
  p_token_hash TEXT
) RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv account_invitations%ROWTYPE;
  v_account_name TEXT;
BEGIN
  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'used');
  END IF;

  IF v_inv.expires_at <= NOW() THEN
    RETURN json_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT name INTO v_account_name
  FROM accounts
  WHERE id = v_inv.account_id;

  RETURN json_build_object(
    'ok', true,
    'account_name', v_account_name,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at
  );
END;
$$;

ALTER FUNCTION public.peek_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.peek_invitation(TEXT) FROM PUBLIC;
-- `anon` so the /join/<token> page can call this before the user
-- signs in; `authenticated` so the same page works when already
-- signed in (e.g. existing user clicks a forwarded link).
GRANT EXECUTE ON FUNCTION public.peek_invitation(TEXT) TO anon, authenticated;

-- ============================================================
-- redeem_invitation(p_token_hash text)
--
-- Authenticated. The caller's auth.uid() is used both to scope
-- the move ("which profile am I editing?") and as the safety
-- check ("do you have any data we'd lose?").
--
-- Refusal codes (SQLSTATE):
--   22023 — invite invalid (not_found / used / expired)
--   42501 — caller not authenticated
--   23505 — caller's account has data (would be lost by joining)
--           NOTE: we reuse Postgres's "unique_violation" code here
--           rather than invent a custom SQLSTATE because there's
--           no proper standard SQLSTATE for "conflict"; the route
--           handler maps it to HTTP 409.
--
-- Order of operations
--   1. Lock the invite row (FOR UPDATE) so two concurrent redeems
--      of the same token can't both succeed.
--   2. Read caller's current account_id.
--   3. Verify caller is the sole owner of their current account
--      AND that the account has zero domain rows. (If the caller
--      already joined someone else's account once, their
--      profile.account_id points there, not to a personal account
--      they own — that case fails the "is owner" check and
--      surfaces as 23505.)
--   4. Move profile.account_id + account_role to invite's.
--   5. Mark invitation accepted (token_hash stays, so the same
--      token can't be re-used).
--   6. Delete the old personal account. The ON DELETE CASCADE on
--      `accounts(id) ← profiles.account_id` would normally try to
--      delete the caller's profile too, but step 4 already moved
--      them to the new account, so the cascade is a no-op.
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID  -- the joined account_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  -- Caller's current account + its owner.
  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id;

  IF v_old_account_id IS NULL THEN
    -- Defensive — every authenticated user has a profile post-017.
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  -- Edge case: the inviter sent themselves a link, or the
  -- caller is somehow already in the inviter's account.
  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'You are already a member of this account'
      USING ERRCODE = '23505';
  END IF;

  -- Safety: the caller must be the SOLE OWNER of their current
  -- account (i.e. their fresh personal account from signup or a
  -- prior removal). Any other state means they're either:
  --   - a member of another shared account (joining a second
  --     would silently orphan their access to the first), or
  --   - the owner of an account with teammates (they'd abandon
  --     their team to join the inviter's).
  -- Either way, the safe answer is "make a different login".
  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  -- Belt: even if they own their account, refuse if it has any
  -- domain data — joining would orphan their contacts, deals,
  -- broadcasts, automations, flows, templates, etc.
  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  -- Move the profile first so the cascade-on-delete of the old
  -- account doesn't try to nuke this user's profile too.
  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  -- Clean up the orphan personal account. Empty by the checks
  -- above, so this is purely housekeeping — no cascades fire
  -- because no other rows reference it.
  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;




-- ==========================================
-- MIGRATION: 020_account_sharing_followups.sql
-- ==========================================
-- ============================================================
-- 020_account_sharing_followups.sql — review-board fixes for
-- the multi-user accounts series (#167-#177).
--
-- Two concerns this migration addresses:
--
--   1. Engine dispatch indexes — the per-inbound automations and
--      flows lookups now scope by `account_id + trigger_type/status
--      + is_active/status='active'`. The pre-017 partial indexes
--      (`idx_automations_active_trigger`, no flows equivalent) were
--      account-blind. For shared accounts with 100+ teammates each
--      authoring rules, the planner ends up post-filtering by
--      account_id. Composite partial indexes drop the post-filter
--      cost to zero on the hot path.
--
--   2. Flow-media storage scoping — migration 016 created the
--      `flow-media` bucket with per-user RLS policies keyed on
--      `auth.uid() = path[0]`. After the multi-user move, flows
--      are account-scoped but the storage paths remained user-
--      scoped: an agent who left the account would orphan every
--      flow node referencing media they had uploaded. This
--      migration switches the write policies to account-scoped
--      paths (`account-<account_id>/...`) while leaving the
--      legacy `<auth.uid()>/...` paths writable by their original
--      uploader for backward compatibility. The bucket is public,
--      so reads are unchanged.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- COMPOSITE INDEXES — engine dispatch hot path
-- ============================================================

-- `runAutomationsForTrigger` queries
--   automations WHERE account_id = X AND trigger_type = Y AND is_active = TRUE
-- Migration 006 added a partial index on (trigger_type) WHERE is_active.
-- Composite + partial index lets the planner answer all three predicates
-- from one index lookup. The existing partial index can stay as belt-and-
-- braces for any code path that filters only by trigger_type.
CREATE INDEX IF NOT EXISTS idx_automations_account_active_trigger
  ON automations(account_id, trigger_type)
  WHERE is_active = TRUE;

-- `findEntryFlow` queries
--   flows WHERE account_id = X AND status = 'active'
-- Migration 017 only added `idx_flows_account`; this partial composite
-- is tuned for the engine's lookup and skips archived/draft rows.
CREATE INDEX IF NOT EXISTS idx_flows_account_active
  ON flows(account_id)
  WHERE status = 'active';

-- ============================================================
-- FLOW-MEDIA STORAGE — account-scoped writes
--
-- New path convention: `account-<uuid>/<timestamp>-<base>.<ext>`
-- Legacy path convention: `<uuid>/<timestamp>-<base>.<ext>` (where
-- the uuid is auth.uid() — preserved for back-compat).
--
-- Reads stay public (the bucket is public so Meta can fetch media
-- URLs without credentials). Only the write policies change.
--
-- Drop existing per-user policies and replace with account-aware
-- ones that accept either path convention.
-- ============================================================
DROP POLICY IF EXISTS "Users can upload their own flow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own flow media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own flow media" ON storage.objects;

DROP POLICY IF EXISTS "Members can upload flow media" ON storage.objects;
CREATE POLICY "Members can upload flow media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flow-media'
    AND (
      -- New: any account member uploading under their account's folder.
      -- `'account-' || account_id` is how we namespace the folder, so
      -- two accounts that happen to be in the same Supabase project
      -- can never accidentally collide.
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
      )
      -- Legacy: the original uploader keeps write access to files they
      -- already uploaded under the pre-020 path convention.
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can update flow media" ON storage.objects;
CREATE POLICY "Members can update flow media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'flow-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
      )
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete flow media" ON storage.objects;
CREATE POLICY "Members can delete flow media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'flow-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
      )
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- Public read policy from 016 stays as-is; reads cross both path
-- conventions without modification.




-- ==========================================
-- MIGRATION: 021_account_default_currency.sql
-- ==========================================
-- ============================================================
-- 021_account_default_currency
--
-- Make the default deal currency configurable per account.
--
-- Before this, the app hardcoded USD everywhere — deal-value
-- formatters, the new-deal form, and automation-created deals all
-- assumed USD. wacrm is self-hostable and used globally, so a fixed
-- USD default made deal tracking unhelpful for non-US businesses
-- (issue #218).
--
-- We add a single `default_currency` column to `accounts`. New deals
-- and all aggregated totals (pipeline/dashboard) format in this
-- currency; existing deals keep their own saved `deals.currency`.
-- We enforce one currency per account (no FX conversion) — the
-- issue's recommended first pass.
--
-- RLS: no change needed. The existing `accounts_update` policy
-- (017) already restricts writes to admins+, which is exactly who
-- should change an account-wide setting.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD';

-- Keep the value an ISO-4217-shaped 3-letter uppercase code without
-- pinning to a fixed enum — forks can use any currency Intl supports.
ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_default_currency_format;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_default_currency_format
  CHECK (default_currency ~ '^[A-Z]{3}$');




-- ==========================================
-- MIGRATION: 022_contact_phone_dedup.sql
-- ==========================================
-- ============================================================
-- 022_contact_phone_dedup
--
-- Prevent the same phone number from becoming multiple contacts
-- within one account (issue #212).
--
-- Until now `contacts.phone` had only a non-unique index, phone was
-- stored un-normalized ("+1 555-123-4567" vs "15551234567" are
-- distinct strings), and only the WhatsApp webhook de-duped. Manual
-- create and CSV import inserted freely, fragmenting conversations,
-- deals, and tags across duplicate rows.
--
-- This migration, in order:
--   1. adds a generated `phone_normalized` column (digits-only,
--      mirroring the app's normalizePhone) that can never drift;
--   2. merges existing duplicates into the oldest row, re-pointing
--      all child records first so nothing is lost;
--   3. adds a UNIQUE index on (account_id, phone_normalized) — the
--      authoritative guarantee that covers every write path.
--
-- Idempotent. **No data loss** — duplicate rows are merged, not
-- dropped: child rows (conversations, messages, deals, notes, tags,
-- custom values, broadcast recipients, automation/flow records) are
-- re-pointed to the surviving (oldest) contact before deletion.
-- ============================================================

-- 1) Normalized phone — STORED generated column, kept in lockstep
--    with `phone` by Postgres. Matches normalizePhone()
--    (src/lib/whatsapp/phone-utils.ts): strip every non-digit.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]', '', 'g')) STORED;

-- 2) One-time (re-runnable) merge of existing duplicates.
--    SECURITY DEFINER so it can re-point rows across tables
--    regardless of the caller's RLS; it only ever collapses exact
--    normalized duplicates within the same account.
CREATE OR REPLACE FUNCTION public.merge_duplicate_contacts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group   RECORD;
  v_survivor UUID;
  v_losers   UUID[];
  v_merged   INTEGER := 0;
BEGIN
  FOR v_group IN
    SELECT account_id,
           phone_normalized,
           array_agg(id ORDER BY created_at ASC, id ASC) AS ids
    FROM contacts
    WHERE phone_normalized <> ''
    GROUP BY account_id, phone_normalized
    HAVING count(*) > 1
  LOOP
    v_survivor := v_group.ids[1];
    v_losers   := v_group.ids[2:array_length(v_group.ids, 1)];

    -- Plain re-point: these tables have no contact-scoped unique
    -- constraint. `conversations` is ON DELETE CASCADE, so this
    -- re-point is what saves its rows (and their messages) from
    -- being deleted with the loser contact.
    UPDATE conversations                 SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);
    UPDATE contact_notes                 SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);
    UPDATE deals                         SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);
    UPDATE broadcast_recipients          SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);
    UPDATE automation_logs               SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);
    UPDATE automation_pending_executions SET contact_id = v_survivor WHERE contact_id = ANY(v_losers);

    -- Conflict-guarded re-point for UNIQUE(contact_id, tag_id):
    -- move only tags the survivor doesn't already have, drop the rest.
    UPDATE contact_tags ct SET contact_id = v_survivor
      WHERE ct.contact_id = ANY(v_losers)
        AND NOT EXISTS (
          SELECT 1 FROM contact_tags s
          WHERE s.contact_id = v_survivor AND s.tag_id = ct.tag_id
        );
    DELETE FROM contact_tags WHERE contact_id = ANY(v_losers);

    -- Same guard for UNIQUE(contact_id, custom_field_id). Survivor's
    -- own value wins on conflict.
    UPDATE contact_custom_values cv SET contact_id = v_survivor
      WHERE cv.contact_id = ANY(v_losers)
        AND NOT EXISTS (
          SELECT 1 FROM contact_custom_values s
          WHERE s.contact_id = v_survivor AND s.custom_field_id = cv.custom_field_id
        );
    DELETE FROM contact_custom_values WHERE contact_id = ANY(v_losers);

    -- flow_runs has a partial UNIQUE on active runs per contact.
    -- Re-point only NON-active runs (exempt from the partial index)
    -- to preserve history; any active loser run is left to be
    -- NULLed by its FK's ON DELETE SET NULL when the loser is
    -- removed below — avoids colliding with the survivor's active run.
    UPDATE flow_runs SET contact_id = v_survivor
      WHERE contact_id = ANY(v_losers) AND status <> 'active';

    DELETE FROM contacts WHERE id = ANY(v_losers);

    v_merged := v_merged + COALESCE(array_length(v_losers, 1), 0);
  END LOOP;

  RETURN v_merged;
END;
$$;

ALTER FUNCTION public.merge_duplicate_contacts() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.merge_duplicate_contacts() FROM PUBLIC;

-- Collapse whatever duplicates exist right now.
SELECT public.merge_duplicate_contacts();

-- 3) Authoritative guarantee. Partial index defends against any
--    empty normalized value (phone is NOT NULL, but belt-and-braces).
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_phone_normalized
  ON contacts (account_id, phone_normalized)
  WHERE phone_normalized <> '';




-- ==========================================
-- MIGRATION: 023_ai_agent.sql
-- ==========================================
-- ============================================================
-- Migration 023: AI Agent Integration
-- Adds ai_mode flag to conversations so the AI auto-reply agent
-- can be toggled per-conversation (replaces the standalone
-- "agent vs human" mode from Whatsapp-Agent-main).
-- ============================================================

-- Add ai_mode column to conversations
-- ai_mode = true  → AI agent automatically replies to inbound messages
-- ai_mode = false → Human agent handles replies (default)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_mode BOOLEAN NOT NULL DEFAULT true;

-- Optional: store which AI model/provider handles this conversation
-- Allows per-conversation model overrides (e.g. GPT-4 for VIP customers)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_model TEXT;

-- Optional: store a custom system prompt override per conversation
-- Falls back to the global AI_SYSTEM_PROMPT env var when NULL
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;

-- Add AI configuration columns to whatsapp_config (if not already present)
ALTER TABLE whatsapp_config 
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_only_free_models BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash:free',
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS app_secret TEXT;

-- Index for efficiently querying AI-enabled conversations
-- (used by the webhook to check if AI should respond)
CREATE INDEX IF NOT EXISTS idx_conversations_ai_mode
  ON conversations(ai_mode)
  WHERE ai_mode = true;

-- ============================================================
-- AI Conversations view
-- Provides a backward-compatible view matching the schema
-- expected by the original Whatsapp-Agent-main dashboard.
-- ============================================================
CREATE OR REPLACE VIEW ai_agent_conversations AS
SELECT
  c.id,
  co.phone,
  co.name,
  c.ai_mode AS mode,
  c.updated_at,
  c.created_at,
  c.last_message_text AS last_message
FROM conversations c
JOIN contacts co ON co.id = c.contact_id
WHERE c.ai_mode = true;

-- ============================================================
-- Enable Realtime for conversations (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END $$;




-- ============================================================
-- Seed master admin user (Sanket Admin)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  vuser_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  vemail CONSTANT TEXT := 'sanket@auto.com';
  vpassword CONSTANT TEXT := 'Sanket@15432';
  vfull_name CONSTANT TEXT := 'Sanket Admin';
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
  )
  VALUES (
    vuser_id,
    '00000000-0000-0000-0000-000000000000',
    vemail,
    crypt(vpassword, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', vfull_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- Self-heal all existing users by replacing NULL tokens with empty strings to avoid GoTrue 500 error
  UPDATE auth.users
  SET confirmation_token = COALESCE(confirmation_token, ''),
      email_change = COALESCE(email_change, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      recovery_token = COALESCE(recovery_token, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, '');

  -- Ensure GoTrue identity exists so login succeeds
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = vuser_id) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      vuser_id,
      vuser_id,
      jsonb_build_object('sub', vuser_id::text, 'email', vemail),
      'email',
      vuser_id::text,
      now(),
      now(),
      now()
    );
  END IF;
END $$;

-- ==========================================
-- MIGRATION: 024_openrouter_key.sql
-- ==========================================
-- Migration 024: OpenRouter API Key Integration
-- Add openrouter_api_key column to whatsapp_config
ALTER TABLE whatsapp_config 
  ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT; -- AES-256-GCM encrypted


-- ==========================================
-- MIGRATION: 025_nullable_whatsapp_credentials.sql
-- ==========================================
-- Migration 025: Nullable WhatsApp Credentials
-- Allow saving credentials first. Drops NOT NULL from phone_number_id and access_token.
ALTER TABLE whatsapp_config ALTER COLUMN phone_number_id DROP NOT NULL;
ALTER TABLE whatsapp_config ALTER COLUMN access_token DROP NOT NULL;


-- ==========================================
-- MIGRATION: 026_b2b_marketplace_integration.sql
-- ==========================================

-- B2B Integrations Settings Table
CREATE TABLE IF NOT EXISTS b2b_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  api_url TEXT,
  api_key TEXT, -- Encrypted AES-256-GCM
  client_id TEXT,
  client_secret TEXT, -- Encrypted AES-256-GCM
  username TEXT,
  password TEXT, -- Encrypted AES-256-GCM
  sync_interval TEXT NOT NULL DEFAULT '15m' CHECK (sync_interval IN ('5m', '15m', '30m', '1h')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_b2b_integrations_account ON b2b_integrations(account_id);

-- B2B Leads Table
CREATE TABLE IF NOT EXISTS b2b_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA')),
  external_lead_id TEXT NOT NULL,
  buyer_name TEXT,
  company_name TEXT,
  mobile TEXT,
  alternate_mobile TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  product_name TEXT,
  quantity TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'contacted', 'converted', 'rejected')),
  lead_source TEXT NOT NULL DEFAULT 'B2B_MARKETPLACE',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (platform, external_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_b2b_leads_account ON b2b_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_platform_external ON b2b_leads(platform, external_lead_id);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_assigned ON b2b_leads(assigned_to);

-- Raw Logs Table
CREATE TABLE IF NOT EXISTS b2b_raw_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA')),
  payload_json JSONB NOT NULL,
  response_json JSONB,
  status TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_raw_logs_account ON b2b_raw_logs(account_id);

-- WhatsApp Notification Recipients
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_account ON notification_recipients(account_id);

-- Lead Assignments History
CREATE TABLE IF NOT EXISTS lead_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES b2b_leads(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_assignments_account ON lead_assignments(account_id);

-- Enable RLS
ALTER TABLE b2b_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_raw_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at — DROP IF EXISTS first so this migration is idempotent
DROP TRIGGER IF EXISTS set_updated_at ON b2b_integrations;
DROP TRIGGER IF EXISTS set_updated_at ON b2b_leads;
DROP TRIGGER IF EXISTS set_updated_at ON notification_recipients;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON b2b_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON b2b_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notification_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Policies
DROP POLICY IF EXISTS b2b_integrations_select ON b2b_integrations;
DROP POLICY IF EXISTS b2b_integrations_modify ON b2b_integrations;
CREATE POLICY b2b_integrations_select ON b2b_integrations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY b2b_integrations_modify ON b2b_integrations FOR ALL USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS b2b_leads_select ON b2b_leads;
DROP POLICY IF EXISTS b2b_leads_modify ON b2b_leads;
CREATE POLICY b2b_leads_select ON b2b_leads FOR SELECT USING (is_account_member(account_id));
CREATE POLICY b2b_leads_modify ON b2b_leads FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS b2b_raw_logs_select ON b2b_raw_logs;
DROP POLICY IF EXISTS b2b_raw_logs_modify ON b2b_raw_logs;
CREATE POLICY b2b_raw_logs_select ON b2b_raw_logs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY b2b_raw_logs_modify ON b2b_raw_logs FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS notification_recipients_select ON notification_recipients;
DROP POLICY IF EXISTS notification_recipients_modify ON notification_recipients;
CREATE POLICY notification_recipients_select ON notification_recipients FOR SELECT USING (is_account_member(account_id));
CREATE POLICY notification_recipients_modify ON notification_recipients FOR ALL USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS lead_assignments_select ON lead_assignments;
DROP POLICY IF EXISTS lead_assignments_modify ON lead_assignments;
CREATE POLICY lead_assignments_select ON lead_assignments FOR SELECT USING (is_account_member(account_id));
CREATE POLICY lead_assignments_modify ON lead_assignments FOR ALL USING (is_account_member(account_id, 'agent'));



-- ==========================================
-- MIGRATION: 027_b2b_leads_enhancements.sql
-- ==========================================
-- Enhancements to the B2B leads integration:
--   1. Soft-delete support: deleted_at column on b2b_leads
--   2. Additional performance indexes: product_name, city, state
--   3. Enable Realtime for b2b_leads table
--   4. Additional index on received_at for chronological queries
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Soft-delete column (preserves historical leads, never truly deleted)
ALTER TABLE b2b_leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index: efficient WHERE deleted_at IS NULL queries
CREATE INDEX IF NOT EXISTS idx_b2b_leads_active ON b2b_leads(account_id, received_at DESC)
  WHERE deleted_at IS NULL;

-- 2. Additional indexes for filter performance
CREATE INDEX IF NOT EXISTS idx_b2b_leads_received_at ON b2b_leads(account_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_status ON b2b_leads(account_id, status);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_platform ON b2b_leads(account_id, platform);

-- 3. Enable Realtime publication for b2b_leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'b2b_leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE b2b_leads;
  END IF;
END $$;




-- ==========================================
-- MIGRATION: 028_conversation_soft_delete.sql
-- ==========================================
-- Support for deleting conversations:
--   1. Soft-delete support: deleted_at column on conversations
--   2. Partial index: idx_conversations_active for efficient non-deleted queries
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Soft-delete column
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Partial index: efficient queries for active (non-deleted) conversations
CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(account_id, last_message_at DESC)
  WHERE deleted_at IS NULL;




-- ==========================================
-- MIGRATION: 029_b2b_lead_integration_extensions.sql
-- ==========================================
-- Extension objects for B2B lead integrations:
--   1. New Tables: lead_conversations, followup_tasks, integration_logs
--   2. PostgreSQL Functions: upsert_b2b_lead, get_recent_b2b_leads, get_lead_statistics,
--                            assign_lead_to_staff, log_raw_api_response, search_leads,
--                            soft_delete_lead
--   3. Triggers: Automatically update updated_at on the new tables
--   4. Indexes: Optimizations on b2b_leads columns
--   5. RLS Policies: Security permissions for accounts and agents
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Tables

-- B2B Lead Conversations mapping table
CREATE TABLE IF NOT EXISTS lead_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES b2b_leads(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, lead_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_conversations_account ON lead_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead ON lead_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversations_conv ON lead_conversations(conversation_id);

-- B2B Follow-up Tasks table
CREATE TABLE IF NOT EXISTS followup_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES b2b_leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_tasks_account ON followup_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_lead ON followup_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_assignee ON followup_tasks(assigned_to);

-- B2B Integration Logs table
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA')),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_account ON integration_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_platform ON integration_logs(platform);

-- 2. PostgreSQL Functions

-- upsert_b2b_lead function
CREATE OR REPLACE FUNCTION upsert_b2b_lead(
  p_account_id UUID,
  p_platform TEXT,
  p_external_lead_id TEXT,
  p_buyer_name TEXT DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_alternate_mobile TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_quantity TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  INSERT INTO b2b_leads (
    account_id, platform, external_lead_id, buyer_name, company_name,
    mobile, alternate_mobile, email, city, state, country,
    product_name, quantity, message, status
  )
  VALUES (
    p_account_id, p_platform, p_external_lead_id, p_buyer_name, p_company_name,
    p_mobile, p_alternate_mobile, p_email, p_city, p_state, p_country,
    p_product_name, p_quantity, p_message, p_status
  )
  ON CONFLICT (platform, external_lead_id)
  DO UPDATE SET
    buyer_name = EXCLUDED.buyer_name,
    company_name = EXCLUDED.company_name,
    mobile = EXCLUDED.mobile,
    alternate_mobile = EXCLUDED.alternate_mobile,
    email = EXCLUDED.email,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    product_name = EXCLUDED.product_name,
    quantity = EXCLUDED.quantity,
    message = EXCLUDED.message,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- get_recent_b2b_leads function
CREATE OR REPLACE FUNCTION get_recent_b2b_leads(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS SETOF b2b_leads
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
  ORDER BY received_at DESC
  LIMIT p_limit;
$$;

-- get_lead_statistics function
CREATE OR REPLACE FUNCTION get_lead_statistics(p_account_id UUID)
RETURNS TABLE (
  total_leads BIGINT,
  today_leads BIGINT,
  indiamart_leads BIGINT,
  tradeindia_leads BIGINT,
  exportersindia_leads BIGINT,
  assigned_leads BIGINT,
  unassigned_leads BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(CASE WHEN received_at >= NOW() - INTERVAL '1 day' THEN 1 END)::BIGINT AS today_leads,
    COUNT(CASE WHEN platform = 'INDIAMART' THEN 1 END)::BIGINT AS indiamart_leads,
    COUNT(CASE WHEN platform = 'TRADEINDIA' THEN 1 END)::BIGINT AS tradeindia_leads,
    COUNT(CASE WHEN platform = 'EXPORTERSINDIA' THEN 1 END)::BIGINT AS exportersindia_leads,
    COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END)::BIGINT AS assigned_leads,
    COUNT(CASE WHEN assigned_to IS NULL THEN 1 END)::BIGINT AS unassigned_leads
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL;
END;
$$;

-- assign_lead_to_staff function
CREATE OR REPLACE FUNCTION assign_lead_to_staff(
  p_account_id UUID,
  p_lead_id UUID,
  p_staff_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the lead
  UPDATE b2b_leads
  SET assigned_to = p_staff_id,
      status = 'assigned',
      updated_at = NOW()
  WHERE id = p_lead_id AND account_id = p_account_id;

  -- Log the assignment
  INSERT INTO lead_assignments (account_id, lead_id, staff_id, assigned_at)
  VALUES (p_account_id, p_lead_id, p_staff_id, NOW());
END;
$$;

-- log_raw_api_response function
CREATE OR REPLACE FUNCTION log_raw_api_response(
  p_account_id UUID,
  p_platform TEXT,
  p_payload JSONB,
  p_response JSONB DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO b2b_raw_logs (account_id, platform, payload_json, response_json, status, received_at, created_at)
  VALUES (p_account_id, p_platform, p_payload, p_response, p_status, NOW(), NOW())
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- search_leads function
CREATE OR REPLACE FUNCTION search_leads(
  p_account_id UUID,
  p_platform TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF b2b_leads
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
    AND (p_platform IS NULL OR platform = p_platform)
    AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
    AND (p_state IS NULL OR state ILIKE '%' || p_state || '%')
    AND (p_status IS NULL OR status = p_status)
    AND (p_product_name IS NULL OR product_name ILIKE '%' || p_product_name || '%')
    AND (p_start_date IS NULL OR received_at >= p_start_date)
    AND (p_end_date IS NULL OR received_at <= p_end_date);
$$;

-- soft_delete_lead function
CREATE OR REPLACE FUNCTION soft_delete_lead(
  p_account_id UUID,
  p_lead_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE b2b_leads
  SET deleted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_lead_id AND account_id = p_account_id;
END;
$$;

-- 3. Triggers
DROP TRIGGER IF EXISTS set_updated_at ON lead_conversations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lead_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON followup_tasks;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON followup_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_b2b_leads_external_lead_id ON b2b_leads(external_lead_id);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_mobile ON b2b_leads(mobile);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_email ON b2b_leads(email);
CREATE INDEX IF NOT EXISTS idx_b2b_leads_received_at ON b2b_leads(received_at);

-- 5. RLS Policies
ALTER TABLE lead_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE followup_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_conversations_select ON lead_conversations;
DROP POLICY IF EXISTS lead_conversations_modify ON lead_conversations;
CREATE POLICY lead_conversations_select ON lead_conversations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY lead_conversations_modify ON lead_conversations FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS followup_tasks_select ON followup_tasks;
DROP POLICY IF EXISTS followup_tasks_modify ON followup_tasks;
CREATE POLICY followup_tasks_select ON followup_tasks FOR SELECT USING (is_account_member(account_id));
CREATE POLICY followup_tasks_modify ON followup_tasks FOR ALL USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS integration_logs_select ON integration_logs;
DROP POLICY IF EXISTS integration_logs_modify ON integration_logs;
CREATE POLICY integration_logs_select ON integration_logs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY integration_logs_modify ON integration_logs FOR ALL USING (is_account_member(account_id, 'agent'));




-- ==========================================
-- MIGRATION: 030_user_management_rbac.sql
-- ==========================================
-- Support for User Management and Role-Based Access Control (RBAC):
--   1. Extend profiles table with mobile, department, designation, and is_active columns
--   2. Create simple updatable view users_profile
--   3. Create tables: roles, permissions, user_roles, role_permissions, user_login_logs, audit_logs
--   4. Seed default roles, permissions, and mappings
--   5. Create functions: is_super_admin(), has_permission(), check_record_access(), log_audit_action()
--   6. Enable RLS and setup policies
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Extend profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Create users_profile view
DROP VIEW IF EXISTS users_profile CASCADE;
CREATE OR REPLACE VIEW users_profile AS
SELECT
  id,
  user_id,
  full_name,
  email,
  avatar_url,
  role,
  account_id,
  account_role,
  mobile,
  department,
  designation,
  is_active,
  created_at,
  updated_at
FROM profiles;

-- 3. Create tables
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  device TEXT,
  browser TEXT,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for logs
CREATE INDEX IF NOT EXISTS idx_user_login_logs_user ON user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action ON audit_logs(module, action);

-- 4. Create Helper Functions
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Super Admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION has_permission(
  p_module TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- If user is deactivated, block all permissions
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_active = false
  ) THEN
    RETURN FALSE;
  END IF;

  -- Super Admin bypasses all checks
  IF EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Super Admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.module = p_module
      AND p.action = p_action
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_record_access(p_record_department TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_dept TEXT;
BEGIN
  -- Super Admin bypass
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  -- Get current user's department and role
  SELECT p.department, r.name INTO v_dept, v_role
  FROM profiles p
  LEFT JOIN user_roles ur ON p.user_id = ur.user_id
  LEFT JOIN roles r ON ur.role_id = r.id
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  -- Admin has full access except super admin modules
  IF v_role = 'Admin' THEN
    RETURN TRUE;
  END IF;

  -- Management department sees everything
  IF v_dept = 'Management Department' THEN
    RETURN TRUE;
  END IF;

  -- Sales role sees Sales Department records
  IF v_role = 'Sales' AND p_record_department = 'Sales Department' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION log_audit_action(
  p_module TEXT,
  p_action TEXT,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, module, action, old_value, new_value, created_at)
  VALUES (auth.uid(), p_module, p_action, p_old_value, p_new_value, NOW());
END;
$$;

-- Seed Default Data
-- Seed Roles
INSERT INTO roles (name, description) VALUES
  ('Super Admin', 'Full control over the system, roles, permissions, integrations, and policies.'),
  ('Admin', 'Full operational control, manages users but cannot delete them or change Super Admin settings.'),
  ('Sales', 'Sales operations, leads, deals, and customers.')
ON CONFLICT (name) DO NOTHING;

-- Seed Permissions
INSERT INTO permissions (module, action, description) VALUES
  ('dashboard', 'view', 'View Dashboard metrics'),
  ('customers', 'view', 'View Customer records'),
  ('customers', 'create', 'Create Customer records'),
  ('customers', 'edit', 'Edit Customer records'),
  ('customers', 'delete', 'Delete Customer records'),
  ('leads', 'view', 'View B2B Leads'),
  ('leads', 'create', 'Create B2B Leads'),
  ('leads', 'edit', 'Edit B2B Leads'),
  ('leads', 'delete', 'Delete B2B Leads'),
  ('leads', 'assign', 'Assign B2B Leads to Sales staff'),
  ('indiamart', 'view', 'View IndiaMART Integrations'),
  ('tradeindia', 'view', 'View TradeIndia Integrations'),
  ('exportersindia', 'view', 'View ExportersIndia Integrations'),
  ('whatsapp', 'view', 'View WhatsApp chats'),
  ('whatsapp', 'manage', 'Manage WhatsApp Configurations'),
  ('sales', 'view', 'View Sales Pipelines and pipelines page'),
  ('reports', 'view', 'View Reports and Metrics'),
  ('analytics', 'view', 'View Analytics dashboards'),
  ('ai_assistant', 'view', 'Access AI Chatbot'),
  ('settings', 'view', 'View Settings page'),
  ('settings', 'edit', 'Edit general system settings'),
  ('user_management', 'view', 'View User Management panel'),
  ('user_management', 'create', 'Create new CRM users'),
  ('user_management', 'edit', 'Modify roles and permissions of users'),
  ('user_management', 'delete', 'Remove users from CRM'),
  ('notifications', 'view', 'View System Notifications'),
  ('integrations', 'view', 'View API Integrations'),
  ('integrations', 'manage', 'Manage external third-party integrations')
ON CONFLICT (module, action) DO NOTHING;

-- Seed Admin Role Permissions (All except user deletions/RLS/Super settings)
DO $$
DECLARE
  v_admin_role_id UUID;
  v_perm_rec RECORD;
BEGIN
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
  IF v_admin_role_id IS NOT NULL THEN
    FOR v_perm_rec IN 
      SELECT id FROM permissions 
      WHERE NOT (module = 'user_management' AND action = 'delete')
        AND NOT (module = 'integrations' AND action = 'manage')
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_admin_role_id, v_perm_rec.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 6. Enable RLS and setup policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Select policies (accessible by authenticated users to resolve roles/names)
DROP POLICY IF EXISTS roles_select ON roles;
CREATE POLICY roles_select ON roles FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS permissions_select ON permissions;
CREATE POLICY permissions_select ON permissions FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS role_permissions_select ON role_permissions;
CREATE POLICY role_permissions_select ON role_permissions FOR SELECT USING (auth.role() = 'authenticated');

-- Manage policies (restricted to Super Admin)
DROP POLICY IF EXISTS roles_manage ON roles;
CREATE POLICY roles_manage ON roles FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS permissions_manage ON permissions;
CREATE POLICY permissions_manage ON permissions FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS user_roles_manage ON user_roles;
CREATE POLICY user_roles_manage ON user_roles FOR ALL USING (is_super_admin() OR has_permission('user_management', 'edit'));

DROP POLICY IF EXISTS role_permissions_manage ON role_permissions;
CREATE POLICY role_permissions_manage ON role_permissions FOR ALL USING (is_super_admin());

-- User Login Logs Policies
DROP POLICY IF EXISTS login_logs_select ON user_login_logs;
CREATE POLICY login_logs_select ON user_login_logs FOR SELECT USING (is_super_admin() OR has_permission('user_management', 'view') OR auth.uid() = user_id);

DROP POLICY IF EXISTS login_logs_manage ON user_login_logs;
CREATE POLICY login_logs_manage ON user_login_logs FOR ALL USING (is_super_admin() OR has_permission('user_management', 'edit'));

-- Audit Logs Policies
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (is_super_admin() OR has_permission('user_management', 'view'));

DROP POLICY IF EXISTS audit_logs_manage ON audit_logs;
CREATE POLICY audit_logs_manage ON audit_logs FOR ALL USING (is_super_admin());

-- Update Profiles table policies to allow user management
DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id OR is_super_admin() OR has_permission('user_management', 'edit'));

-- Seeding / Mapping legacy owner to Super Admin
DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  -- Get user ID for sanket@auto.com if exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'sanket@auto.com';
  -- Get Super Admin role ID
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';

  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    -- Assign Super Admin role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Update legacy profile settings
    UPDATE profiles
    SET is_active = true,
        account_role = 'owner'
    WHERE user_id = v_user_id;

    -- Make sure they are the primary owner of the account
    UPDATE accounts
    SET owner_user_id = v_user_id
    WHERE id = (SELECT account_id FROM profiles WHERE user_id = v_user_id);
  END IF;
END $$;


-- ============================================================
-- APP BRANDING SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name TEXT NOT NULL DEFAULT 'CRM with AI',
  logo_url TEXT,
  favicon_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if any
DROP POLICY IF EXISTS "Allow select for everyone" ON public.app_settings;
DROP POLICY IF EXISTS "Allow all for admin/superadmin" ON public.app_settings;

-- RLS Policies
CREATE POLICY "Allow select for everyone" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow all for admin/superadmin" ON public.app_settings FOR ALL USING (
  is_super_admin() OR has_permission('settings', 'edit')
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.app_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default settings row if table is empty
INSERT INTO public.app_settings (app_name)
SELECT 'CRM with AI'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);


-- ============================================================
-- MIGRATION: 028_integration_sync_state.sql
-- ============================================================

-- Integration Sync State Table
CREATE TABLE IF NOT EXISTS public.integration_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA')),
  last_sync_at TIMESTAMPTZ,
  last_lead_timestamp TIMESTAMPTZ,
  current_page INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'IDLE' CHECK (sync_status IN ('IDLE', 'RUNNING', 'COMPLETED', 'FAILED')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_state_account ON public.integration_sync_state(account_id);

-- Enable RLS
ALTER TABLE public.integration_sync_state ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.integration_sync_state;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.integration_sync_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Policies
DROP POLICY IF EXISTS integration_sync_state_select ON public.integration_sync_state;
DROP POLICY IF EXISTS integration_sync_state_modify ON public.integration_sync_state;

CREATE POLICY integration_sync_state_select ON public.integration_sync_state
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY integration_sync_state_modify ON public.integration_sync_state
  FOR ALL USING (is_account_member(account_id, 'admin'));




-- ==========================================
-- MIGRATION: 031_customer_memory_and_lead_extensions.sql
-- ==========================================
-- ============================================================
-- Purpose:
--   1. customer_memory — per-contact AI fact store.
--      The AI agent reads this before composing a reply and
--      can upsert discovered facts (e.g. "wants bulk pricing",
--      "preferred language: Hindi"). Keyed by (account_id, phone)
--      so facts survive conversation deletion.
--
--   2. b2b_integrations — WA auto-reply columns.
--      Enables per-platform control over whether a WhatsApp
--      greeting is sent when a new lead is ingested.
--
--   3. b2b_leads — extra operational columns:
--        rejection_reason   TEXT   — why lead was rejected
--        notes              TEXT   — freeform agent notes
--        wa_greeting_sent_at TIMESTAMPTZ — idempotency guard
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. customer_memory
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_memory (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id   UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  -- Structured facts: { "preferred_language": "Hindi", "interest": "bulk_pricing", ... }
  -- Merged into AI system prompt at response time.
  facts        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Raw agent notes / summaries about this customer (unstructured)
  summary      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, phone)
);

-- Fast lookup by (account_id, phone) — the primary query path.
CREATE INDEX IF NOT EXISTS idx_customer_memory_account_phone
  ON public.customer_memory (account_id, phone);

ALTER TABLE public.customer_memory ENABLE ROW LEVEL SECURITY;

-- Agents+ may read and write memory; viewers are read-only.
DROP POLICY IF EXISTS customer_memory_select ON public.customer_memory;
DROP POLICY IF EXISTS customer_memory_insert ON public.customer_memory;
DROP POLICY IF EXISTS customer_memory_update ON public.customer_memory;
DROP POLICY IF EXISTS customer_memory_delete ON public.customer_memory;

CREATE POLICY customer_memory_select ON public.customer_memory
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY customer_memory_insert ON public.customer_memory
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY customer_memory_update ON public.customer_memory
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

CREATE POLICY customer_memory_delete ON public.customer_memory
  FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.customer_memory;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. b2b_integrations — WA auto-reply columns
-- ============================================================
-- wa_auto_reply_enabled: whether to send a WA greeting to the
--   buyer on lead ingestion. Default false (opt-in).
-- wa_auto_reply_template: message body template with variables:
--   {{name}}, {{product}}, {{company}}, {{city}}, {{platform}}
ALTER TABLE public.b2b_integrations
  ADD COLUMN IF NOT EXISTS wa_auto_reply_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_auto_reply_template  TEXT;

-- ============================================================
-- 3. b2b_leads — extra operational columns
-- ============================================================
-- rejection_reason: free-text why a lead was rejected
ALTER TABLE public.b2b_leads
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- notes: freeform agent notes on the lead
ALTER TABLE public.b2b_leads
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- wa_greeting_sent_at: set when a WA greeting is dispatched;
--   prevents duplicate greetings on retry/re-sync.
ALTER TABLE public.b2b_leads
  ADD COLUMN IF NOT EXISTS wa_greeting_sent_at TIMESTAMPTZ;


-- ============================================================
-- 4. b2b_leads — inquiry_at column, index, and function overrides
-- ============================================================
-- inquiry_at: original customer inquiry date and time from the marketplace platform
ALTER TABLE public.b2b_leads
  ADD COLUMN IF NOT EXISTS inquiry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_b2b_leads_inquiry_at ON public.b2b_leads(inquiry_at);

-- Recreate upsert_b2b_lead to support p_inquiry_at
CREATE OR REPLACE FUNCTION upsert_b2b_lead(
  p_account_id UUID,
  p_platform TEXT,
  p_external_lead_id TEXT,
  p_buyer_name TEXT DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_alternate_mobile TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_quantity TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_inquiry_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  INSERT INTO b2b_leads (
    account_id, platform, external_lead_id, buyer_name, company_name,
    mobile, alternate_mobile, email, city, state, country,
    product_name, quantity, message, status, inquiry_at
  )
  VALUES (
    p_account_id, p_platform, p_external_lead_id, p_buyer_name, p_company_name,
    p_mobile, p_alternate_mobile, p_email, p_city, p_state, p_country,
    p_product_name, p_quantity, p_message, p_status, p_inquiry_at
  )
  ON CONFLICT (platform, external_lead_id)
  DO UPDATE SET
    buyer_name = EXCLUDED.buyer_name,
    company_name = EXCLUDED.company_name,
    mobile = EXCLUDED.mobile,
    alternate_mobile = EXCLUDED.alternate_mobile,
    email = EXCLUDED.email,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    country = EXCLUDED.country,
    product_name = EXCLUDED.product_name,
    quantity = EXCLUDED.quantity,
    message = EXCLUDED.message,
    status = EXCLUDED.status,
    inquiry_at = COALESCE(EXCLUDED.inquiry_at, b2b_leads.inquiry_at),
    updated_at = NOW()
  RETURNING id INTO v_lead_id;

  RETURN v_lead_id;
END;
$$;

-- Recreate get_recent_b2b_leads to order by inquiry_at
CREATE OR REPLACE FUNCTION get_recent_b2b_leads(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS SETOF b2b_leads
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
  ORDER BY inquiry_at DESC NULLS LAST
  LIMIT p_limit;
$$;

-- Recreate get_lead_statistics to count today's leads using inquiry_at
CREATE OR REPLACE FUNCTION get_lead_statistics(p_account_id UUID)
RETURNS TABLE (
  total_leads BIGINT,
  today_leads BIGINT,
  indiamart_leads BIGINT,
  tradeindia_leads BIGINT,
  exportersindia_leads BIGINT,
  assigned_leads BIGINT,
  unassigned_leads BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(CASE WHEN inquiry_at >= NOW() - INTERVAL '1 day' THEN 1 END)::BIGINT AS today_leads,
    COUNT(CASE WHEN platform = 'INDIAMART' THEN 1 END)::BIGINT AS indiamart_leads,
    COUNT(CASE WHEN platform = 'TRADEINDIA' THEN 1 END)::BIGINT AS tradeindia_leads,
    COUNT(CASE WHEN platform = 'EXPORTERSINDIA' THEN 1 END)::BIGINT AS exportersindia_leads,
    COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END)::BIGINT AS assigned_leads,
    COUNT(CASE WHEN assigned_to IS NULL THEN 1 END)::BIGINT AS unassigned_leads
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL;
END;
$$;

-- Recreate search_leads to filter by inquiry_at
CREATE OR REPLACE FUNCTION search_leads(
  p_account_id UUID,
  p_platform TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF b2b_leads
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT *
  FROM b2b_leads
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
    AND (p_platform IS NULL OR platform = p_platform)
    AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
    AND (p_state IS NULL OR state ILIKE '%' || p_state || '%')
    AND (p_status IS NULL OR status = p_status)
    AND (p_product_name IS NULL OR product_name ILIKE '%' || p_product_name || '%')
    AND (p_start_date IS NULL OR inquiry_at >= p_start_date)
    AND (p_end_date IS NULL OR inquiry_at <= p_end_date);
$$;


-- ============================================================
-- 5. log_raw_api_response function
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_raw_api_response(
  p_account_id UUID,
  p_platform TEXT,
  p_payload JSONB,
  p_response JSONB DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO b2b_raw_logs (
    account_id, 
    platform, 
    payload_json, 
    response_json, 
    status, 
    received_at
  )
  VALUES (
    p_account_id, 
    p_platform, 
    p_payload, 
    p_response, 
    p_status, 
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ============================================================
-- REDESIGN: INBOX & CRM ADDITIONS
-- ============================================================

-- 1. CONVERSATION SETTINGS
CREATE TABLE IF NOT EXISTS conversation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  ai_replies_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_settings_conv ON conversation_settings(conversation_id);

ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own conversation settings" ON conversation_settings;
CREATE POLICY "Users can manage own conversation settings" ON conversation_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_settings.conversation_id AND conversations.user_id = auth.uid()));

-- Trigger to keep updated_at in sync
DROP TRIGGER IF EXISTS set_updated_at ON conversation_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversation_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add conversation_settings to realtime replication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_settings;
  END IF;
END $$;


-- 2. BLOCKED CONTACTS
CREATE TABLE IF NOT EXISTS blocked_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL,
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_contacts_contact ON blocked_contacts(contact_id);

ALTER TABLE blocked_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own blocked contacts" ON blocked_contacts;
CREATE POLICY "Users can manage own blocked contacts" ON blocked_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = blocked_contacts.contact_id AND contacts.user_id = auth.uid()));

-- Add blocked_contacts to realtime replication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE blocked_contacts;
  END IF;
END $$;


-- 3. CHAT NOTES
CREATE TABLE IF NOT EXISTS chat_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_notes_conv ON chat_notes(conversation_id);

ALTER TABLE chat_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat notes" ON chat_notes;
CREATE POLICY "Users can manage own chat notes" ON chat_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = chat_notes.conversation_id AND conversations.user_id = auth.uid()));

-- Trigger to keep updated_at in sync
DROP TRIGGER IF EXISTS set_updated_at ON chat_notes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON chat_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add chat_notes to realtime replication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_notes;
  END IF;
END $$;


-- 4. MESSAGE AUDIT LOGS
CREATE TABLE IF NOT EXISTS message_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'send', 'edit', 'delete', 'reply', 'forward', 'export'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_audit_logs_msg ON message_audit_logs(message_id);

ALTER TABLE message_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view message audit logs" ON message_audit_logs;
CREATE POLICY "Users can view message audit logs" ON message_audit_logs FOR SELECT
  USING (true);


-- 5. CONVERSATION AUDIT LOGS
CREATE TABLE IF NOT EXISTS conversation_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'status_change', 'assignment', 'transfer', 'ai_replies', 'archived', 'pinned', 'starred'
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_audit_logs_conv ON conversation_audit_logs(conversation_id);

ALTER TABLE conversation_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view conversation audit logs" ON conversation_audit_logs;
CREATE POLICY "Users can view conversation audit logs" ON conversation_audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_audit_logs.conversation_id AND conversations.user_id = auth.uid()));


-- ============================================================
-- CRM SALES LIFECYCLE — 17-stage pipeline
-- ============================================================
-- Creates the CRM lead lifecycle layer on top of the existing
-- b2b_leads capture layer. A crm_lead can optionally link back
-- to a b2b_lead (for marketplace sources) or stand alone (for
-- website, ads, WhatsApp, manual, referral sources).
--
-- Tables created:
--   crm_leads, crm_lead_history, crm_activities,
--   crm_requirements, crm_quotations, crm_quotation_items,
--   crm_negotiations, crm_samples, crm_orders, crm_payments,
--   crm_production, crm_deliveries, crm_support_tickets,
--   crm_appraisals, crm_assignment_rules
--
-- All tables use account_id scoping and is_account_member() RLS.
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. CRM_LEADS — Master lifecycle table
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Source linkage
  b2b_lead_id UUID REFERENCES b2b_leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Identity
  buyer_name TEXT,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  country TEXT,

  -- Source
  source TEXT NOT NULL CHECK (source IN (
    'INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA',
    'WEBSITE', 'ADS', 'WHATSAPP', 'MANUAL', 'REFERRAL'
  )),

  -- Lifecycle stage
  stage TEXT NOT NULL DEFAULT 'Customer' CHECK (stage IN (
    'Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material',
    'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual',
    'Dispatch', 'Payment', 'Appreciation'
  )),

  -- Qualification
  lead_category TEXT CHECK (lead_category IN ('HOT', 'WARM', 'COLD', 'LOST')),
  lead_score INTEGER DEFAULT 0,
  is_spam BOOLEAN DEFAULT false,
  urgency TEXT CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Assignment
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- AI
  ai_summary TEXT,
  ai_engagement_status TEXT CHECK (ai_engagement_status IN (
    'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'HANDED_OFF'
  )) DEFAULT 'NOT_STARTED',

  -- Close
  close_reason TEXT CHECK (close_reason IN (
    'WON', 'LOST', 'NO_RESPONSE', 'FAKE_INQUIRY',
    'COMPETITOR', 'BUDGET_ISSUE'
  )),
  closed_at TIMESTAMPTZ,

  -- Value
  expected_value NUMERIC(14,2),
  currency TEXT DEFAULT 'INR',

  -- Customer category (post-appraisal)
  customer_category TEXT CHECK (customer_category IN ('A', 'B', 'C')),

  -- Product info (quick reference)
  product_name TEXT,
  quantity TEXT,

  -- Follow-up
  next_followup_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,

  -- Timestamps
  inquiry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- soft delete, never truly deleted
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_leads_account ON crm_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads(account_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_category ON crm_leads(account_id, lead_category);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON crm_leads(account_id, source);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON crm_leads(account_id, phone);
CREATE INDEX IF NOT EXISTS idx_crm_leads_b2b ON crm_leads(b2b_lead_id) WHERE b2b_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_active ON crm_leads(account_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_followup ON crm_leads(next_followup_at) WHERE next_followup_at IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_leads_select ON crm_leads;
DROP POLICY IF EXISTS crm_leads_insert ON crm_leads;
DROP POLICY IF EXISTS crm_leads_update ON crm_leads;
DROP POLICY IF EXISTS crm_leads_delete ON crm_leads;
CREATE POLICY crm_leads_select ON crm_leads FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_leads_insert ON crm_leads FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY crm_leads_update ON crm_leads FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY crm_leads_delete ON crm_leads FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_leads;
  END IF;
END $$;

-- ============================================================
-- 2. CRM_LEAD_HISTORY — Stage transition audit
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_lead_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  change_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_history_lead ON crm_lead_history(crm_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_lead_history_account ON crm_lead_history(account_id);

ALTER TABLE crm_lead_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_lead_history_select ON crm_lead_history;
DROP POLICY IF EXISTS crm_lead_history_insert ON crm_lead_history;
CREATE POLICY crm_lead_history_select ON crm_lead_history FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_lead_history_insert ON crm_lead_history FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

-- ============================================================
-- 3. CRM_ACTIVITIES — Unified activity timeline
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'AI_MESSAGE', 'WHATSAPP_CHAT', 'CALL', 'EMAIL',
    'MEETING', 'VIDEO_CALL', 'NOTE', 'STAGE_CHANGE',
    'ASSIGNMENT', 'QUOTATION', 'PAYMENT', 'DELIVERY',
    'FEEDBACK', 'SYSTEM'
  )),

  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(crm_lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_account ON crm_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(crm_lead_id, activity_type);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_activities_select ON crm_activities;
DROP POLICY IF EXISTS crm_activities_insert ON crm_activities;
CREATE POLICY crm_activities_select ON crm_activities FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_activities_insert ON crm_activities FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

-- Realtime for live timeline updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'crm_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
  END IF;
END $$;

-- ============================================================
-- 4. CRM_REQUIREMENTS — Stage 6
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  product TEXT,
  quantity TEXT,
  budget NUMERIC(14,2),
  budget_currency TEXT DEFAULT 'INR',
  delivery_location TEXT,
  payment_terms TEXT,
  special_requirements TEXT,
  ai_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_requirements_lead ON crm_requirements(crm_lead_id);

ALTER TABLE crm_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_requirements_select ON crm_requirements;
DROP POLICY IF EXISTS crm_requirements_modify ON crm_requirements;
CREATE POLICY crm_requirements_select ON crm_requirements FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_requirements_modify ON crm_requirements FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_requirements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. CRM_QUOTATIONS — Stage 7
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  quotation_number TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'REVISED'
  )),
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(14,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  valid_until DATE,
  notes TEXT,
  terms_conditions TEXT,
  sent_via_whatsapp BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_quotations_lead ON crm_quotations(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_account ON crm_quotations(account_id);

ALTER TABLE crm_quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_quotations_select ON crm_quotations;
DROP POLICY IF EXISTS crm_quotations_modify ON crm_quotations;
CREATE POLICY crm_quotations_select ON crm_quotations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_quotations_modify ON crm_quotations FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_quotations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. CRM_QUOTATION_ITEMS — Line items
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES crm_quotations(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_quotation_items_quotation ON crm_quotation_items(quotation_id);

ALTER TABLE crm_quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_quotation_items_select ON crm_quotation_items;
DROP POLICY IF EXISTS crm_quotation_items_modify ON crm_quotation_items;
CREATE POLICY crm_quotation_items_select ON crm_quotation_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM crm_quotations q WHERE q.id = crm_quotation_items.quotation_id AND is_account_member(q.account_id))
);
CREATE POLICY crm_quotation_items_modify ON crm_quotation_items FOR ALL USING (
  EXISTS (SELECT 1 FROM crm_quotations q WHERE q.id = crm_quotation_items.quotation_id AND is_account_member(q.account_id, 'agent'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM crm_quotations q WHERE q.id = crm_quotation_items.quotation_id AND is_account_member(q.account_id, 'agent'))
);

-- ============================================================
-- 7. CRM_NEGOTIATIONS — Stage 8
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_negotiations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  negotiation_type TEXT NOT NULL CHECK (negotiation_type IN (
    'PRICE_CHANGE', 'COUNTER_OFFER', 'MESSAGE', 'REMARK', 'AI_SUGGESTION'
  )),
  original_value NUMERIC(14,2),
  proposed_value NUMERIC(14,2),
  message TEXT,
  proposed_by TEXT CHECK (proposed_by IN ('BUYER', 'SELLER', 'AI')),
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_negotiations_lead ON crm_negotiations(crm_lead_id, created_at DESC);

ALTER TABLE crm_negotiations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_negotiations_select ON crm_negotiations;
DROP POLICY IF EXISTS crm_negotiations_modify ON crm_negotiations;
CREATE POLICY crm_negotiations_select ON crm_negotiations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_negotiations_modify ON crm_negotiations FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- ============================================================
-- 8. CRM_SAMPLES — Stage 9 (Optional)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  product_name TEXT,
  quantity TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
    'REQUESTED', 'SENT', 'APPROVED', 'REJECTED'
  )),
  sent_at TIMESTAMPTZ,
  tracking_number TEXT,
  feedback TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_samples_lead ON crm_samples(crm_lead_id);

ALTER TABLE crm_samples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_samples_select ON crm_samples;
DROP POLICY IF EXISTS crm_samples_modify ON crm_samples;
CREATE POLICY crm_samples_select ON crm_samples FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_samples_modify ON crm_samples FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_samples;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_samples
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. CRM_ORDERS — Stage 10
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  po_number TEXT,
  order_value NUMERIC(14,2),
  currency TEXT DEFAULT 'INR',
  expected_dispatch DATE,
  payment_terms TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN (
    'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'
  )),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orders_lead ON crm_orders(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_orders_account ON crm_orders(account_id);

ALTER TABLE crm_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_orders_select ON crm_orders;
DROP POLICY IF EXISTS crm_orders_modify ON crm_orders;
CREATE POLICY crm_orders_select ON crm_orders FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_orders_modify ON crm_orders FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. CRM_PAYMENTS — Stage 11
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('ADVANCE', 'PARTIAL', 'FULL', 'REFUND')),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_payments_lead ON crm_payments(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_payments_order ON crm_payments(order_id);

ALTER TABLE crm_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_payments_select ON crm_payments;
DROP POLICY IF EXISTS crm_payments_modify ON crm_payments;
CREATE POLICY crm_payments_select ON crm_payments FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_payments_modify ON crm_payments FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- ============================================================
-- 11. CRM_PRODUCTION — Stage 12
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_production (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'MANUFACTURING' CHECK (status IN (
    'MANUFACTURING', 'PACKING', 'READY_FOR_DISPATCH'
  )),
  notes TEXT,
  estimated_completion DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_production_lead ON crm_production(crm_lead_id);

ALTER TABLE crm_production ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_production_select ON crm_production;
DROP POLICY IF EXISTS crm_production_modify ON crm_production;
CREATE POLICY crm_production_select ON crm_production FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_production_modify ON crm_production FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_production;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_production
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. CRM_DELIVERIES — Stage 13
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
  transport_details TEXT,
  courier TEXT,
  tracking_number TEXT,
  dispatch_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  delivery_proof_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN (
    'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_deliveries_lead ON crm_deliveries(crm_lead_id);

ALTER TABLE crm_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_deliveries_select ON crm_deliveries;
DROP POLICY IF EXISTS crm_deliveries_modify ON crm_deliveries;
CREATE POLICY crm_deliveries_select ON crm_deliveries FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_deliveries_modify ON crm_deliveries FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_deliveries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. CRM_SUPPORT_TICKETS — Stage 14
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN (
    'FEEDBACK', 'COMPLAINT', 'WARRANTY', 'REPLACEMENT', 'SERVICE'
  )),
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
  )),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_lead ON crm_support_tickets(crm_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_support_tickets_account ON crm_support_tickets(account_id);

ALTER TABLE crm_support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_support_tickets_select ON crm_support_tickets;
DROP POLICY IF EXISTS crm_support_tickets_modify ON crm_support_tickets;
CREATE POLICY crm_support_tickets_select ON crm_support_tickets FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_support_tickets_modify ON crm_support_tickets FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_support_tickets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 14. CRM_APPRAISALS — Stage 15
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_appraisals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  repeat_order_probability TEXT CHECK (repeat_order_probability IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  customer_category TEXT CHECK (customer_category IN ('A', 'B', 'C')),
  feedback_source TEXT CHECK (feedback_source IN ('WHATSAPP', 'CALL', 'EMAIL', 'IN_PERSON', 'FORM')),
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_appraisals_lead ON crm_appraisals(crm_lead_id);

ALTER TABLE crm_appraisals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_appraisals_select ON crm_appraisals;
DROP POLICY IF EXISTS crm_appraisals_modify ON crm_appraisals;
CREATE POLICY crm_appraisals_select ON crm_appraisals FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_appraisals_modify ON crm_appraisals FOR ALL USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

-- ============================================================
-- 15. CRM_ASSIGNMENT_RULES — Auto-assignment config
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_assignment_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'STATE', 'COUNTRY', 'DEPARTMENT', 'ROUND_ROBIN', 'SOURCE'
  )),
  -- Conditions as JSONB: { "states": ["Maharashtra", "Gujarat"], "countries": ["India"] }
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  assign_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_assignment_rules_account ON crm_assignment_rules(account_id);

ALTER TABLE crm_assignment_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_assignment_rules_select ON crm_assignment_rules;
DROP POLICY IF EXISTS crm_assignment_rules_modify ON crm_assignment_rules;
CREATE POLICY crm_assignment_rules_select ON crm_assignment_rules FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_assignment_rules_modify ON crm_assignment_rules FOR ALL USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON crm_assignment_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_assignment_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 16. PERMISSIONS — Add CRM permissions to existing RBAC
-- ============================================================
INSERT INTO permissions (module, action, description) VALUES
  ('crm', 'view', 'View CRM Pipeline and Leads'),
  ('crm', 'create', 'Create CRM Leads'),
  ('crm', 'edit', 'Edit CRM Leads and stage transitions'),
  ('crm', 'delete', 'Delete CRM Leads'),
  ('crm', 'assign', 'Assign CRM Leads to staff'),
  ('quotations', 'view', 'View Quotations'),
  ('quotations', 'create', 'Create Quotations'),
  ('quotations', 'edit', 'Edit Quotations')
ON CONFLICT (module, action) DO NOTHING;

-- Grant CRM/Quotations permissions to Admin role
DO $$
DECLARE
  v_admin_role_id UUID;
  v_perm_rec RECORD;
BEGIN
  SELECT id INTO v_admin_role_id FROM roles WHERE name = 'Admin';
  IF v_admin_role_id IS NOT NULL THEN
    FOR v_perm_rec IN
      SELECT id FROM permissions
      WHERE module IN ('crm', 'quotations')
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_admin_role_id, v_perm_rec.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Grant permissions to Sales role
DO $$
DECLARE
  v_sales_role_id UUID;
  v_perm_rec RECORD;
BEGIN
  SELECT id INTO v_sales_role_id FROM roles WHERE name = 'Sales';
  IF v_sales_role_id IS NOT NULL THEN
    FOR v_perm_rec IN
      SELECT id FROM permissions
      WHERE (module = 'leads' AND action IN ('view', 'edit'))
         OR (module = 'whatsapp' AND action = 'view')
         OR (module = 'customers' AND action IN ('view', 'create', 'edit'))
         OR (module = 'sales' AND action IN ('view', 'create', 'edit'))
         OR (module = 'crm' AND action IN ('view', 'edit'))
         OR (module = 'quotations' AND action IN ('view', 'create', 'edit'))
    LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_sales_role_id, v_perm_rec.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ============================================================
-- 17. HELPER FUNCTIONS
-- ============================================================

-- Get CRM pipeline statistics
CREATE OR REPLACE FUNCTION get_crm_pipeline_stats(p_account_id UUID)
RETURNS TABLE (
  stage TEXT,
  lead_count BIGINT,
  pipeline_value NUMERIC,
  hot_count BIGINT,
  overdue_followups BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.stage,
    COUNT(*)::BIGINT AS lead_count,
    COALESCE(SUM(cl.expected_value), 0) AS pipeline_value,
    COUNT(CASE WHEN cl.lead_category = 'HOT' THEN 1 END)::BIGINT AS hot_count,
    COUNT(CASE WHEN cl.next_followup_at < NOW() THEN 1 END)::BIGINT AS overdue_followups
  FROM crm_leads cl
  WHERE cl.account_id = p_account_id
    AND cl.deleted_at IS NULL
  GROUP BY cl.stage;
END;
$$;

-- Get CRM dashboard overview
CREATE OR REPLACE FUNCTION get_crm_overview(p_account_id UUID)
RETURNS TABLE (
  total_leads BIGINT,
  new_today BIGINT,
  hot_leads BIGINT,
  warm_leads BIGINT,
  cold_leads BIGINT,
  total_pipeline_value NUMERIC,
  conversion_rate NUMERIC,
  overdue_followups BIGINT,
  avg_lead_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_leads,
    COUNT(CASE WHEN cl.created_at >= NOW() - INTERVAL '1 day' THEN 1 END)::BIGINT AS new_today,
    COUNT(CASE WHEN cl.lead_category = 'HOT' THEN 1 END)::BIGINT AS hot_leads,
    COUNT(CASE WHEN cl.lead_category = 'WARM' THEN 1 END)::BIGINT AS warm_leads,
    COUNT(CASE WHEN cl.lead_category = 'COLD' THEN 1 END)::BIGINT AS cold_leads,
    COALESCE(SUM(cl.expected_value), 0) AS total_pipeline_value,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(CASE WHEN cl.stage = 'CLOSED' AND cl.close_reason = 'WON' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(CASE WHEN cl.stage = 'CLOSED' THEN 1 END), 0) * 100, 1
      )
      ELSE 0
    END AS conversion_rate,
    COUNT(CASE WHEN cl.next_followup_at < NOW() AND cl.stage NOT IN ('CLOSED', 'DELIVERED', 'CUSTOMER_REVIEW', 'REPEAT_CUSTOMER') THEN 1 END)::BIGINT AS overdue_followups,
    COALESCE(ROUND(AVG(cl.lead_score), 1), 0) AS avg_lead_score
  FROM crm_leads cl
  WHERE cl.account_id = p_account_id
    AND cl.deleted_at IS NULL;
END;
$$;


-- ============================================================
-- CENTRALIZED B2B SYNC STATE & LOGS UPDATE
-- ============================================================

-- 1. Alter integration_sync_state to add last_successful_sync
ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS last_successful_sync TIMESTAMPTZ;

-- 2. Drop old check constraints on platform to support ALIBABA
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop check constraints on integration_sync_state containing 'platform'
  FOR r IN 
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'integration_sync_state' AND column_name = 'platform' AND constraint_name LIKE '%check%'
  LOOP
    EXECUTE 'ALTER TABLE public.integration_sync_state DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;
  
  -- Drop check constraints on b2b_integrations containing 'platform'
  FOR r IN 
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'b2b_integrations' AND column_name = 'platform' AND constraint_name LIKE '%check%'
  LOOP
    EXECUTE 'ALTER TABLE public.b2b_integrations DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;

  -- Drop check constraints on b2b_leads containing 'platform'
  FOR r IN 
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'b2b_leads' AND column_name = 'platform' AND constraint_name LIKE '%check%'
  LOOP
    EXECUTE 'ALTER TABLE public.b2b_leads DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;
END $$;

-- 3. Add new constraints supporting ALIBABA
ALTER TABLE public.integration_sync_state ADD CONSTRAINT integration_sync_state_platform_check CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA', 'ALIBABA'));
ALTER TABLE public.b2b_integrations ADD CONSTRAINT b2b_integrations_platform_check CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA', 'ALIBABA'));
ALTER TABLE public.b2b_leads ADD CONSTRAINT b2b_leads_platform_check CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA', 'ALIBABA'));

-- 4. Create sync_logs table
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA', 'ALIBABA')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_imported INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'RUNNING')),
  error_message TEXT,
  duration INTEGER, -- duration in milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS and Policies for sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_logs_select ON public.sync_logs;
CREATE POLICY sync_logs_select ON public.sync_logs
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS sync_logs_modify ON public.sync_logs;
CREATE POLICY sync_logs_modify ON public.sync_logs
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS idx_sync_logs_account ON public.sync_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_platform ON public.sync_logs(platform);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);

-- 7. Ensure UNIQUE constraint on (platform, external_lead_id) exists on b2b_leads for upserts
ALTER TABLE public.b2b_leads DROP CONSTRAINT IF EXISTS b2b_leads_platform_external_lead_id_key;
ALTER TABLE public.b2b_leads ADD CONSTRAINT b2b_leads_platform_external_lead_id_key UNIQUE (platform, external_lead_id);


-- ==========================================
-- MIGRATION: 032_ai_workflow_knowledge_base.sql
-- ==========================================
-- AI-Driven Lead Workflow & Company Knowledge Base
-- New tables: company_settings, company_products, company_faq, ai_conversation_memory
-- Altered tables: crm_leads (ai_score), conversations (handoff tracking)

-- ============================================================
-- 1. COMPANY_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  company_name    TEXT,
  company_description TEXT,
  tagline         TEXT,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT,
  pincode         TEXT,
  phone           TEXT,
  alternate_phone TEXT,
  email           TEXT,
  website         TEXT,
  gst_number      TEXT,
  pan_number      TEXT,
  working_hours   TEXT,
  established_year INTEGER,
  logo_url        TEXT,
  catalog_pdf_url TEXT,
  terms_and_conditions TEXT,
  shipping_policy TEXT,
  return_policy   TEXT,
  payment_terms   TEXT,
  warranty_policy TEXT,
  social_media    JSONB DEFAULT '{}'::jsonb,
  footer_text     TEXT,
  seal_url        TEXT,
  logo_alignment  TEXT DEFAULT 'right',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS idx_company_settings_account ON public.company_settings (account_id);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_settings_select ON public.company_settings;
DROP POLICY IF EXISTS company_settings_insert ON public.company_settings;
DROP POLICY IF EXISTS company_settings_update ON public.company_settings;
DROP POLICY IF EXISTS company_settings_delete ON public.company_settings;
CREATE POLICY company_settings_select ON public.company_settings FOR SELECT USING (is_account_member(account_id));
CREATE POLICY company_settings_insert ON public.company_settings FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY company_settings_update ON public.company_settings FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY company_settings_delete ON public.company_settings FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.company_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. COMPANY_PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  product_name        TEXT NOT NULL,
  category            TEXT,
  description         TEXT,
  specification       TEXT,
  hsn_code            TEXT,
  price               NUMERIC(14,2),
  discount_percent    NUMERIC(5,2) DEFAULT 0,
  currency            TEXT DEFAULT 'INR',
  moq                 INTEGER DEFAULT 1,
  unit                TEXT DEFAULT 'pcs',
  available_quantity  INTEGER,
  delivery_time       TEXT,
  image_url           TEXT,
  catalog_url         TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_products_account ON public.company_products (account_id);
CREATE INDEX IF NOT EXISTS idx_company_products_active ON public.company_products (account_id) WHERE is_active = true;
ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_products_select ON public.company_products;
DROP POLICY IF EXISTS company_products_insert ON public.company_products;
DROP POLICY IF EXISTS company_products_update ON public.company_products;
DROP POLICY IF EXISTS company_products_delete ON public.company_products;
CREATE POLICY company_products_select ON public.company_products FOR SELECT USING (is_account_member(account_id));
CREATE POLICY company_products_insert ON public.company_products FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY company_products_update ON public.company_products FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY company_products_delete ON public.company_products FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.company_products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. COMPANY_FAQ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_faq (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id  UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT,
  priority    INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_faq_account ON public.company_faq (account_id);
CREATE INDEX IF NOT EXISTS idx_company_faq_priority ON public.company_faq (account_id, priority DESC);
ALTER TABLE public.company_faq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_faq_select ON public.company_faq;
DROP POLICY IF EXISTS company_faq_insert ON public.company_faq;
DROP POLICY IF EXISTS company_faq_update ON public.company_faq;
DROP POLICY IF EXISTS company_faq_delete ON public.company_faq;
CREATE POLICY company_faq_select ON public.company_faq FOR SELECT USING (is_account_member(account_id));
CREATE POLICY company_faq_insert ON public.company_faq FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY company_faq_update ON public.company_faq FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY company_faq_delete ON public.company_faq FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.company_faq;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_faq FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. AI_CONVERSATION_MEMORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversation_memory (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id        UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary           TEXT,
  customer_interest TEXT,
  budget            TEXT,
  product           TEXT,
  quantity          TEXT,
  urgency           TEXT,
  location          TEXT,
  need_date         TEXT,
  preferred_language TEXT,
  stage             TEXT DEFAULT 'greeting' CHECK (stage IN (
    'greeting', 'collecting_requirements', 'answering_queries',
    'clarifying', 'product_identified', 'serious_buyer',
    'ready_for_handoff', 'handed_off'
  )),
  message_count     INTEGER DEFAULT 0,
  customer_message_count INTEGER DEFAULT 0,
  ai_message_count  INTEGER DEFAULT 0,
  first_response_at TIMESTAMPTZ,
  last_customer_message_at TIMESTAMPTZ,
  extracted_facts   JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_memory_account ON public.ai_conversation_memory (account_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_memory_conversation ON public.ai_conversation_memory (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_memory_stage ON public.ai_conversation_memory (account_id, stage);
ALTER TABLE public.ai_conversation_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_conv_memory_select ON public.ai_conversation_memory;
DROP POLICY IF EXISTS ai_conv_memory_insert ON public.ai_conversation_memory;
DROP POLICY IF EXISTS ai_conv_memory_update ON public.ai_conversation_memory;
DROP POLICY IF EXISTS ai_conv_memory_delete ON public.ai_conversation_memory;
CREATE POLICY ai_conv_memory_select ON public.ai_conversation_memory FOR SELECT USING (is_account_member(account_id));
CREATE POLICY ai_conv_memory_insert ON public.ai_conversation_memory FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY ai_conv_memory_update ON public.ai_conversation_memory FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY ai_conv_memory_delete ON public.ai_conversation_memory FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_conversation_memory;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_conversation_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ai_conversation_memory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversation_memory;
  END IF;
END $$;

-- ============================================================
-- 5. CRM_LEADS — AI scoring columns
-- ============================================================
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS ai_score TEXT CHECK (ai_score IN ('HOT', 'WARM', 'COLD', 'SPAM'));
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS ai_score_reasons JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_crm_leads_ai_score ON public.crm_leads (account_id, ai_score) WHERE ai_score IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 6. CONVERSATIONS — Handoff tracking
-- ============================================================
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ai_handoff_reason TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS ai_handed_off_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_conversations_handoff ON public.conversations (account_id, ai_handed_off_at) WHERE ai_handed_off_at IS NOT NULL;

-- ============================================================
-- 7. RPC: Dashboard AI workflow stats
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ai_workflow_stats(p_account_id UUID)
RETURNS TABLE (
  ai_active_conversations BIGINT,
  ai_resolved_leads BIGINT,
  waiting_for_human BIGINT,
  assigned_leads BIGINT,
  hot_leads BIGINT,
  unread_messages BIGINT,
  todays_orders BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM conversations WHERE account_id = p_account_id AND ai_mode = true)::BIGINT,
    (SELECT COUNT(*) FROM crm_leads WHERE account_id = p_account_id AND ai_engagement_status = 'COMPLETED' AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM crm_leads WHERE account_id = p_account_id AND ai_engagement_status = 'HANDED_OFF' AND assigned_to IS NULL AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM crm_leads WHERE account_id = p_account_id AND assigned_to IS NOT NULL AND deleted_at IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM crm_leads WHERE account_id = p_account_id AND (ai_score = 'HOT' OR lead_category = 'HOT') AND deleted_at IS NULL)::BIGINT,
    (SELECT COALESCE(SUM(unread_count), 0) FROM conversations WHERE account_id = p_account_id)::BIGINT,
    (SELECT COUNT(*) FROM crm_leads WHERE account_id = p_account_id AND stage = 'PO / Advance' AND DATE(created_at) = CURRENT_DATE AND deleted_at IS NULL)::BIGINT,
    (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND(COUNT(*) FILTER (WHERE stage IN ('PO / Advance', 'Bill of Material', 'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual', 'Dispatch', 'Payment', 'Appreciation'))::NUMERIC / COUNT(*)::NUMERIC * 100, 1) END FROM crm_leads WHERE account_id = p_account_id AND deleted_at IS NULL)::NUMERIC;
END;
$$;

-- ============================================================
-- QUOTATION MODULE (merged into schema.sql — no separate file)
-- ============================================================

-- Bank detail columns on company_settings (used in PDF footer)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS bank_account_name    TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_type    TEXT DEFAULT 'Current',
  ADD COLUMN IF NOT EXISTS bank_account_number  TEXT,
  ADD COLUMN IF NOT EXISTS bank_name            TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc            TEXT;

-- Quotation-specific columns on company_settings (manager, signature, T&C, contact info)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS manager_name          TEXT,
  ADD COLUMN IF NOT EXISTS manager_designation   TEXT DEFAULT 'Manager',
  ADD COLUMN IF NOT EXISTS signature_url         TEXT,
  ADD COLUMN IF NOT EXISTS quotation_terms_text  TEXT,
  ADD COLUMN IF NOT EXISTS proforma_terms_text   TEXT,
  ADD COLUMN IF NOT EXISTS sales_register_terms_text TEXT,
  ADD COLUMN IF NOT EXISTS contact_numbers       TEXT,
  ADD COLUMN IF NOT EXISTS email_details         TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction          TEXT DEFAULT 'Belagavi Jurisdiction (Karnataka, India).';

-- Quotation status enum
DO $$ BEGIN
  CREATE TYPE public.quotation_status AS ENUM (
    'draft','sent','accepted','rejected','expired','converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tax type enum
DO $$ BEGIN
  CREATE TYPE public.quotation_tax_type AS ENUM (
    'none','gst_18','gst_12','gst_5',
    'igst_18','igst_12','igst_5',
    'cgst_sgst_18','cgst_sgst_12','cgst_sgst_5','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Master quotation table
CREATE TABLE IF NOT EXISTS public.quotations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  quotation_no          TEXT        NOT NULL,
  entry_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  company_name          TEXT        NOT NULL,
  kind_attention        TEXT,
  contact_person        TEXT,
  email                 TEXT,
  mobile                TEXT        NOT NULL,
  alt_mobile            TEXT,
  address               TEXT        NOT NULL,
  state                 TEXT,
  pincode               TEXT,
  gst_no                TEXT,
  source                TEXT,
  subject               TEXT,
  basic_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_type              public.quotation_tax_type NOT NULL DEFAULT 'none',
  custom_tax_rate       NUMERIC(5,2),
  tax_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_words          TEXT,
  status                public.quotation_status NOT NULL DEFAULT 'draft',
  bank_account_name     TEXT,
  bank_account_type     TEXT,
  bank_account_number   TEXT,
  bank_name             TEXT,
  bank_ifsc             TEXT,
  manager_name          TEXT,
  manager_designation   TEXT DEFAULT 'Manager',
  lead_id               UUID        REFERENCES public.b2b_leads(id) ON DELETE SET NULL,
  valid_until           DATE,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, quotation_no)
);

-- Quotation-specific manager columns for existing installations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS manager_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_designation TEXT DEFAULT 'Manager';

CREATE INDEX IF NOT EXISTS idx_quotations_account_id ON public.quotations(account_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status     ON public.quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_entry_date ON public.quotations(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_lead_id    ON public.quotations(lead_id);

-- Line items (products per quotation)
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID        NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  position        INTEGER     NOT NULL DEFAULT 0,
  product_name    TEXT        NOT NULL,
  description     TEXT,
  hsn_code        TEXT,
  uom             TEXT        DEFAULT 'Pcs',
  rate            NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  amount          NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(rate * quantity, 2)) STORED,
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_qid ON public.quotation_items(quotation_id, position);

-- Terms & Conditions snapshot
CREATE TABLE IF NOT EXISTS public.quotation_terms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID        NOT NULL UNIQUE REFERENCES public.quotations(id) ON DELETE CASCADE,
  terms_text      TEXT        NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Status history / audit trail
CREATE TABLE IF NOT EXISTS public.quotation_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID        NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  old_status      public.quotation_status,
  new_status      public.quotation_status NOT NULL,
  changed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qsh_quotation ON public.quotation_status_history(quotation_id, created_at DESC);

-- Attachments (PDF URLs, uploaded docs)
CREATE TABLE IF NOT EXISTS public.quotation_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID        NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  file_url        TEXT        NOT NULL,
  mime_type       TEXT,
  size_bytes      INTEGER,
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_quotation ON public.quotation_attachments(quotation_id);

-- Communication log (WhatsApp / Email sends)
CREATE TABLE IF NOT EXISTS public.quotation_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id    UUID        NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  recipient       TEXT,
  status          TEXT        NOT NULL DEFAULT 'sent',
  message_id      TEXT,
  error           TEXT,
  sent_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ql_quotation ON public.quotation_logs(quotation_id, sent_at DESC);

-- Row Level Security
ALTER TABLE public.quotations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_terms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_logs           ENABLE ROW LEVEL SECURITY;

-- RLS policies — members of the owning account have full access
DROP POLICY IF EXISTS quotations_account_policy ON public.quotations;
CREATE POLICY quotations_account_policy ON public.quotations
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS qi_account_policy ON public.quotation_items;
CREATE POLICY qi_account_policy ON public.quotation_items
  USING (quotation_id IN (
    SELECT id FROM public.quotations WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS qt_account_policy ON public.quotation_terms;
CREATE POLICY qt_account_policy ON public.quotation_terms
  USING (quotation_id IN (
    SELECT id FROM public.quotations WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS qsh_account_policy ON public.quotation_status_history;
CREATE POLICY qsh_account_policy ON public.quotation_status_history
  USING (quotation_id IN (
    SELECT id FROM public.quotations WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS qa_account_policy ON public.quotation_attachments;
CREATE POLICY qa_account_policy ON public.quotation_attachments
  USING (quotation_id IN (
    SELECT id FROM public.quotations WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS ql_account_policy ON public.quotation_logs;
CREATE POLICY ql_account_policy ON public.quotation_logs
  USING (quotation_id IN (
    SELECT id FROM public.quotations WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

-- auto-updated_at trigger
CREATE OR REPLACE FUNCTION public.set_quotation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_quotations_updated_at ON public.quotations;
CREATE TRIGGER trg_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.set_quotation_updated_at();

-- RPC: generate next quotation number for an account
CREATE OR REPLACE FUNCTION public.next_quotation_no(p_account_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_seq  BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    (REGEXP_MATCH(quotation_no, 'QT-\d{4}-(\d+)'))[1]::BIGINT
  ), 0) + 1
  INTO v_seq
  FROM public.quotations
  WHERE account_id = p_account_id
    AND quotation_no LIKE 'QT-' || v_year || '-%';
  RETURN 'QT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END $$;




-- ==========================================
-- MIGRATION: 033_permission_system_upgrade.sql
-- ==========================================
-- Enterprise Permission System Upgrade
--   1. Add updated_at to roles table
--   2. Create user_permissions table (direct per-user permission grants)
--   3. Remove stale unused roles (Purchase, Store, Accounts, Support, Viewer)
--   4. Upsert all new granular permissions using new naming convention
--   5. Assign Super Admin all permissions
--   6. Assign Admin CRM-only permissions (no settings/integrations)
--   7. Sales role has no default permissions (configurable per-user)
--   8. Update has_permission() to check user_permissions table as well
--   9. Add RLS policies for user_permissions
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- 1. Add updated_at to roles if missing
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DROP TRIGGER IF EXISTS set_updated_at ON roles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Create user_permissions table (direct per-user grants, overrides role-based)
CREATE TABLE IF NOT EXISTS user_permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_permissions_select ON user_permissions;
CREATE POLICY user_permissions_select ON user_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS user_permissions_manage ON user_permissions;
CREATE POLICY user_permissions_manage ON user_permissions
  FOR ALL USING (is_super_admin() OR has_permission('user_management', 'edit'));

-- 3. Remove stale/unused roles (keep only Super Admin, Admin, Sales)
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('Purchase','Store','Accounts','Support','Viewer')
);
DELETE FROM user_roles
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN ('Purchase','Store','Accounts','Support','Viewer')
);
DELETE FROM roles WHERE name IN ('Purchase','Store','Accounts','Support','Viewer');

-- Ensure the 3 canonical roles exist
INSERT INTO roles (name, description) VALUES
  ('Super Admin', 'Full control over the system, roles, permissions, integrations, and policies.'),
  ('Admin', 'Full operational CRM control. Manages users but cannot access Settings, Integrations, or System configuration.'),
  ('Sales', 'Configurable per-user access. No permissions assigned by default — grant specific modules as needed.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 4. Upsert all new granular permissions
-- New permission naming: module_action (flat key) stored as (module=key, action='view'/'create' etc.)
-- We use two-field (module, action) model to stay compatible with existing has_permission() function.
-- New modules use the full key as module name and 'view'/'create'/'edit'/'delete' etc. as action.

INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard', 'view', 'View Dashboard metrics and widgets'),

  -- Enquiries (formerly Leads)
  ('enquiries', 'view',   'View Enquiries list and detail'),
  ('enquiries', 'create', 'Create new Enquiries'),
  ('enquiries', 'edit',   'Edit existing Enquiries'),
  ('enquiries', 'delete', 'Delete Enquiries'),
  ('enquiries', 'assign', 'Assign Enquiries to Sales staff'),

  -- Quotation Register (formerly Quotations / Sales)
  ('quotation', 'view',   'View Quotation Register'),
  ('quotation', 'create', 'Create new Quotations'),
  ('quotation', 'edit',   'Edit existing Quotations'),
  ('quotation', 'delete', 'Delete Quotations'),
  ('quotation', 'export', 'Export / Download Quotations as PDF'),
  ('quotation', 'send',   'Send Quotations via WhatsApp or Email'),

  -- Inbox
  ('inbox', 'view',  'View WhatsApp Inbox and conversations'),
  ('inbox', 'reply', 'Reply to WhatsApp messages'),

  -- Contacts
  ('contacts', 'view',   'View Contacts list and details'),
  ('contacts', 'create', 'Create new Contacts'),
  ('contacts', 'edit',   'Edit existing Contacts'),
  ('contacts', 'delete', 'Delete Contacts'),

  -- Reports
  ('reports', 'view', 'View Reports and analytics'),

  -- Automations
  ('automations', 'view', 'View and manage Automations'),

  -- Broadcasts
  ('broadcasts', 'view', 'View and send Broadcasts'),

  -- CRM Pipeline
  ('crm_pipeline', 'view', 'View CRM Kanban Pipeline'),

  -- User Management
  ('user_management', 'view',   'View User Management panel'),
  ('user_management', 'create', 'Create new CRM users'),
  ('user_management', 'edit',   'Edit users, roles and permissions'),
  ('user_management', 'delete', 'Delete users from CRM'),

  -- Settings (Super Admin only)
  ('settings', 'view', 'View Settings page'),

  -- Integrations (Super Admin only)
  ('integrations', 'view', 'View Integrations panel'),

  -- Company Settings (Super Admin only)
  ('company_settings', 'view', 'View and edit Company Information'),

  -- WhatsApp Settings (Super Admin only)
  ('whatsapp_settings', 'view', 'View and configure WhatsApp Settings'),

  -- AI Settings (Super Admin only)
  ('ai_settings', 'view', 'View and configure AI Settings'),

  -- IndiaMART Settings (Super Admin only)
  ('indiamart_settings', 'view', 'View and configure IndiaMART Integration'),

  -- TradeIndia Settings (Super Admin only)
  ('tradeindia_settings', 'view', 'View and configure TradeIndia Integration'),

  -- ExportersIndia Settings (Super Admin only)
  ('exportersindia_settings', 'view', 'View and configure ExportersIndia Integration'),

  -- SMTP Settings (Super Admin only)
  ('smtp_settings', 'view', 'View and configure SMTP Email Settings'),

  -- Audit Logs (Super Admin only)
  ('audit_logs', 'view', 'View Audit Logs'),

  -- Role Management (Super Admin only)
  ('role_management', 'view', 'View and manage Roles & Permissions')

ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description;

-- 5. Assign ALL permissions to Super Admin role
DO $$
DECLARE
  v_role_id UUID;
  v_perm RECORD;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';
  IF v_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM permissions LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 6. Assign CRM-only permissions to Admin role (no settings/integrations/company/audit/system)
-- First, clear Admin role permissions and re-seed cleanly
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Admin';
  IF v_role_id IS NOT NULL THEN
    DELETE FROM role_permissions WHERE role_id = v_role_id;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE (p.module, p.action) IN (
      -- Dashboard
      ('dashboard', 'view'),
      -- Enquiries (all except cannot be configured per-system, they get full CRM access)
      ('enquiries', 'view'),
      ('enquiries', 'create'),
      ('enquiries', 'edit'),
      ('enquiries', 'delete'),
      ('enquiries', 'assign'),
      -- Legacy leads (keep for backward compat)
      ('leads', 'view'),
      ('leads', 'create'),
      ('leads', 'edit'),
      ('leads', 'delete'),
      ('leads', 'assign'),
      -- IndiaMART/TradeIndia/ExportersIndia view (to see lead sources)
      ('indiamart', 'view'),
      ('tradeindia', 'view'),
      ('exportersindia', 'view'),
      -- Quotation Register
      ('quotation', 'view'),
      ('quotation', 'create'),
      ('quotation', 'edit'),
      ('quotation', 'delete'),
      ('quotation', 'export'),
      ('quotation', 'send'),
      -- Legacy sales
      ('sales', 'view'),
      -- Inbox
      ('inbox', 'view'),
      ('inbox', 'reply'),
      -- Legacy whatsapp
      ('whatsapp', 'view'),
      ('whatsapp', 'manage'),
      -- Contacts
      ('contacts', 'view'),
      ('contacts', 'create'),
      ('contacts', 'edit'),
      ('contacts', 'delete'),
      -- Legacy customers
      ('customers', 'view'),
      ('customers', 'create'),
      ('customers', 'edit'),
      ('customers', 'delete'),
      -- Reports
      ('reports', 'view'),
      ('analytics', 'view'),
      -- Automations
      ('automations', 'view'),
      -- Broadcasts
      ('broadcasts', 'view'),
      -- CRM Pipeline
      ('crm_pipeline', 'view'),
      ('crm', 'view'),
      -- User Management (Admin can create/edit Sales users, but NOT delete)
      ('user_management', 'view'),
      ('user_management', 'create'),
      ('user_management', 'edit'),
      -- Notifications
      ('notifications', 'view')
      -- NOTE: Admin does NOT get: settings, integrations, company_settings,
      --       whatsapp_settings, ai_settings, indiamart_settings, tradeindia_settings,
      --       exportersindia_settings, smtp_settings, audit_logs, role_management,
      --       user_management.delete
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 7. Sales role — NO default permissions (all access must be explicitly granted per-user)
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Sales';
  IF v_role_id IS NOT NULL THEN
    -- Sales only gets dashboard view by default, everything else is configurable
    DELETE FROM role_permissions WHERE role_id = v_role_id;
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE (p.module, p.action) = ('dashboard', 'view')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 8. Update has_permission() to ALSO check user_permissions table
CREATE OR REPLACE FUNCTION has_permission(
  p_module TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Deactivated users have no permissions
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND is_active = false
  ) THEN
    RETURN FALSE;
  END IF;

  -- Super Admin bypasses all permission checks
  IF EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Super Admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check role-based permissions
  IF EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.module = p_module
      AND p.action = p_action
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check direct user_permissions grants (per-user overrides)
  IF EXISTS (
    SELECT 1
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = auth.uid()
      AND p.module = p_module
      AND p.action = p_action
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 9. Enable Realtime for user_permissions so sidebar updates live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_permissions;
  END IF;
END $$;


-- ============================================================
-- MIGRATION: company_bank_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_name        TEXT NOT NULL,
  account_type        TEXT NOT NULL DEFAULT 'Current',
  account_number      TEXT NOT NULL,
  bank_name           TEXT NOT NULL,
  bank_ifsc           TEXT NOT NULL,
  branch_name         TEXT,
  swift_code          TEXT,
  upi_id              TEXT,
  is_default          BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_bank_accounts_select ON public.company_bank_accounts;
DROP POLICY IF EXISTS company_bank_accounts_insert ON public.company_bank_accounts;
DROP POLICY IF EXISTS company_bank_accounts_update ON public.company_bank_accounts;
DROP POLICY IF EXISTS company_bank_accounts_delete ON public.company_bank_accounts;

CREATE POLICY company_bank_accounts_select ON public.company_bank_accounts FOR SELECT USING (is_account_member(account_id));
CREATE POLICY company_bank_accounts_insert ON public.company_bank_accounts FOR INSERT WITH CHECK (is_super_admin() AND is_account_member(account_id));
CREATE POLICY company_bank_accounts_update ON public.company_bank_accounts FOR UPDATE USING (is_super_admin() AND is_account_member(account_id));
CREATE POLICY company_bank_accounts_delete ON public.company_bank_accounts FOR DELETE USING (is_super_admin() AND is_account_member(account_id));

DROP TRIGGER IF EXISTS set_updated_at ON public.company_bank_accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed existing bank accounts from company_settings into company_bank_accounts
INSERT INTO public.company_bank_accounts (account_id, account_name, account_type, account_number, bank_name, bank_ifsc, is_default)
SELECT 
  account_id, 
  bank_account_name, 
  bank_account_type, 
  bank_account_number, 
  bank_name, 
  bank_ifsc, 
  true
FROM public.company_settings cs
WHERE cs.bank_account_name IS NOT NULL AND cs.bank_account_name <> ''
  AND cs.bank_account_number IS NOT NULL AND cs.bank_account_number <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.company_bank_accounts cba 
    WHERE cba.account_id = cs.account_id 
      AND cba.account_number = cs.bank_account_number
  )
ON CONFLICT DO NOTHING;

-- Enable Realtime publication for company_bank_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'company_bank_accounts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE company_bank_accounts;
  END IF;
END $$;


-- ============================================================
-- MIGRATION: proformas & sales_registers
-- ============================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.proforma_status AS ENUM (
    'draft', 'issued', 'waiting_payment', 'partially_paid', 'paid', 'cancelled', 'converted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sales_register_status AS ENUM (
    'pending', 'processing', 'completed', 'cancelled', 'delivered'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Proformas Table
CREATE TABLE IF NOT EXISTS public.proformas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  proforma_no          TEXT        NOT NULL,
  parent_quotation_id   UUID        REFERENCES public.quotations(id) ON DELETE SET NULL,
  entry_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  company_name          TEXT        NOT NULL,
  kind_attention        TEXT,
  contact_person        TEXT,
  email                 TEXT,
  mobile                TEXT        NOT NULL,
  alt_mobile            TEXT,
  address               TEXT        NOT NULL,
  state                 TEXT,
  pincode               TEXT,
  gst_no                TEXT,
  source                TEXT,
  subject               TEXT,
  basic_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_type              public.quotation_tax_type NOT NULL DEFAULT 'none',
  custom_tax_rate       NUMERIC(5,2),
  tax_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_words          TEXT,
  status                public.proforma_status NOT NULL DEFAULT 'draft',
  bank_account_name     TEXT,
  bank_account_type     TEXT,
  bank_account_number   TEXT,
  bank_name             TEXT,
  bank_ifsc             TEXT,
  manager_name          TEXT,
  manager_designation   TEXT DEFAULT 'Manager',
  lead_id               UUID        REFERENCES public.b2b_leads(id) ON DELETE SET NULL,
  valid_until           DATE,
  transportation_charges NUMERIC(14,2) DEFAULT 0,
  packing_charges        NUMERIC(14,2) DEFAULT 0,
  other_charges          NUMERIC(14,2) DEFAULT 0,
  reference_number       TEXT,
  notes                  TEXT,
  approval_status        TEXT DEFAULT 'pending',
  conversion_history     JSONB DEFAULT '[]'::jsonb,
  document_type          TEXT DEFAULT 'proforma',
  document_relationships JSONB DEFAULT '[]'::jsonb,
  audit_history          JSONB DEFAULT '[]'::jsonb,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, proforma_no)
);

CREATE INDEX IF NOT EXISTS idx_proformas_account_id ON public.proformas(account_id);
CREATE INDEX IF NOT EXISTS idx_proformas_status     ON public.proformas(status);
CREATE INDEX IF NOT EXISTS idx_proformas_entry_date ON public.proformas(entry_date DESC);

-- Proforma items
CREATE TABLE IF NOT EXISTS public.proforma_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id    UUID        NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  position        INTEGER     NOT NULL DEFAULT 0,
  product_name    TEXT        NOT NULL,
  description     TEXT,
  hsn_code        TEXT,
  uom             TEXT        DEFAULT 'Pcs',
  rate            NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  amount          NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(rate * quantity, 2)) STORED,
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proforma_items_pid ON public.proforma_items(proforma_id, position);

-- Proforma terms
CREATE TABLE IF NOT EXISTS public.proforma_terms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id    UUID        NOT NULL UNIQUE REFERENCES public.proformas(id) ON DELETE CASCADE,
  terms_text      TEXT        NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proforma status history
CREATE TABLE IF NOT EXISTS public.proforma_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id    UUID        NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  old_status      public.proforma_status,
  new_status      public.proforma_status NOT NULL,
  changed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psh_proforma ON public.proforma_status_history(proforma_id, created_at DESC);

-- Proforma attachments
CREATE TABLE IF NOT EXISTS public.proforma_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id    UUID        NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  file_name       TEXT        NOT NULL,
  file_url        TEXT        NOT NULL,
  mime_type       TEXT,
  size_bytes      INTEGER,
  uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_proforma ON public.proforma_attachments(proforma_id);

-- Proforma logs
CREATE TABLE IF NOT EXISTS public.proforma_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id    UUID        NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  channel         TEXT        NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  recipient       TEXT,
  status          TEXT        NOT NULL DEFAULT 'sent',
  message_id      TEXT,
  error           TEXT,
  sent_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pl_proforma ON public.proforma_logs(proforma_id, sent_at DESC);

-- 3. Sales Registers Table
CREATE TABLE IF NOT EXISTS public.sales_registers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sales_register_no    TEXT        NOT NULL,
  parent_proforma_id    UUID        REFERENCES public.proformas(id) ON DELETE SET NULL,
  entry_date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  company_name          TEXT        NOT NULL,
  kind_attention        TEXT,
  contact_person        TEXT,
  email                 TEXT,
  mobile                TEXT        NOT NULL,
  alt_mobile            TEXT,
  address               TEXT        NOT NULL,
  state                 TEXT,
  pincode               TEXT,
  gst_no                TEXT,
  source                TEXT,
  subject               TEXT,
  basic_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_type              public.quotation_tax_type NOT NULL DEFAULT 'none',
  custom_tax_rate       NUMERIC(5,2),
  tax_amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_words          TEXT,
  status                public.sales_register_status NOT NULL DEFAULT 'pending',
  bank_account_name     TEXT,
  bank_account_type     TEXT,
  bank_account_number   TEXT,
  bank_name             TEXT,
  bank_ifsc             TEXT,
  manager_name          TEXT,
  manager_designation   TEXT DEFAULT 'Manager',
  lead_id               UUID        REFERENCES public.b2b_leads(id) ON DELETE SET NULL,
  valid_until           DATE,
  dispatch_courier      TEXT,
  dispatch_tracking_no  TEXT,
  dispatch_date         DATE,
  transportation_charges NUMERIC(14,2) DEFAULT 0,
  packing_charges        NUMERIC(14,2) DEFAULT 0,
  other_charges          NUMERIC(14,2) DEFAULT 0,
  reference_number       TEXT,
  notes                  TEXT,
  approval_status        TEXT DEFAULT 'pending',
  conversion_history     JSONB DEFAULT '[]'::jsonb,
  document_type          TEXT DEFAULT 'sales_register',
  document_relationships JSONB DEFAULT '[]'::jsonb,
  audit_history          JSONB DEFAULT '[]'::jsonb,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, sales_register_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_registers_account_id ON public.sales_registers(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_registers_status     ON public.sales_registers(status);
CREATE INDEX IF NOT EXISTS idx_sales_registers_entry_date ON public.sales_registers(entry_date DESC);

-- Sales register items
CREATE TABLE IF NOT EXISTS public.sales_register_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_register_id   UUID        NOT NULL REFERENCES public.sales_registers(id) ON DELETE CASCADE,
  position            INTEGER     NOT NULL DEFAULT 0,
  product_name        TEXT        NOT NULL,
  description         TEXT,
  hsn_code            TEXT,
  uom                 TEXT        DEFAULT 'Pcs',
  rate                NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity            NUMERIC(10,3) NOT NULL DEFAULT 1,
  amount              NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(rate * quantity, 2)) STORED,
  image_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_register_items_srid ON public.sales_register_items(sales_register_id, position);

-- Sales register terms
CREATE TABLE IF NOT EXISTS public.sales_register_terms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_register_id   UUID        NOT NULL UNIQUE REFERENCES public.sales_registers(id) ON DELETE CASCADE,
  terms_text          TEXT        NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales register status history
CREATE TABLE IF NOT EXISTS public.sales_register_status_history (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_register_id   UUID        NOT NULL REFERENCES public.sales_registers(id) ON DELETE CASCADE,
  old_status          public.sales_register_status,
  new_status          public.sales_register_status NOT NULL,
  changed_by          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srsh_sales ON public.sales_register_status_history(sales_register_id, created_at DESC);

-- Sales register attachments
CREATE TABLE IF NOT EXISTS public.sales_register_attachments (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_register_id   UUID        NOT NULL REFERENCES public.sales_registers(id) ON DELETE CASCADE,
  file_name           TEXT        NOT NULL,
  file_url            TEXT        NOT NULL,
  mime_type           TEXT,
  size_bytes          INTEGER,
  uploaded_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sra_sales ON public.sales_register_attachments(sales_register_id);

-- Sales register logs
CREATE TABLE IF NOT EXISTS public.sales_register_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_register_id   UUID        NOT NULL REFERENCES public.sales_registers(id) ON DELETE CASCADE,
  channel             TEXT        NOT NULL CHECK (channel IN ('whatsapp','email','sms')),
  recipient           TEXT,
  status              TEXT        NOT NULL DEFAULT 'sent',
  message_id          TEXT,
  error               TEXT,
  sent_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_srl_sales ON public.sales_register_logs(sales_register_id, sent_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE public.proformas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_terms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_status_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_attachments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_logs                ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales_registers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_register_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_register_terms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_register_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_register_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_register_logs          ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS proformas_account_policy ON public.proformas;
CREATE POLICY proformas_account_policy ON public.proformas
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS pi_account_policy ON public.proforma_items;
CREATE POLICY pi_account_policy ON public.proforma_items
  USING (proforma_id IN (
    SELECT id FROM public.proformas WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS pt_account_policy ON public.proforma_terms;
CREATE POLICY pt_account_policy ON public.proforma_terms
  USING (proforma_id IN (
    SELECT id FROM public.proformas WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS psh_account_policy ON public.proforma_status_history;
CREATE POLICY psh_account_policy ON public.proforma_status_history
  USING (proforma_id IN (
    SELECT id FROM public.proformas WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS pa_account_policy ON public.proforma_attachments;
CREATE POLICY pa_account_policy ON public.proforma_attachments
  USING (proforma_id IN (
    SELECT id FROM public.proformas WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS pl_account_policy ON public.proforma_logs;
CREATE POLICY pl_account_policy ON public.proforma_logs
  USING (proforma_id IN (
    SELECT id FROM public.proformas WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS sales_registers_account_policy ON public.sales_registers;
CREATE POLICY sales_registers_account_policy ON public.sales_registers
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sri_account_policy ON public.sales_register_items;
CREATE POLICY sri_account_policy ON public.sales_register_items
  USING (sales_register_id IN (
    SELECT id FROM public.sales_registers WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS srt_account_policy ON public.sales_register_terms;
CREATE POLICY srt_account_policy ON public.sales_register_terms
  USING (sales_register_id IN (
    SELECT id FROM public.sales_registers WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS srsh_account_policy ON public.sales_register_status_history;
CREATE POLICY srsh_account_policy ON public.sales_register_status_history
  USING (sales_register_id IN (
    SELECT id FROM public.sales_registers WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS sra_account_policy ON public.sales_register_attachments;
CREATE POLICY sra_account_policy ON public.sales_register_attachments
  USING (sales_register_id IN (
    SELECT id FROM public.sales_registers WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS srl_account_policy ON public.sales_register_logs;
CREATE POLICY srl_account_policy ON public.sales_register_logs
  USING (sales_register_id IN (
    SELECT id FROM public.sales_registers WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid())));

-- 6. Triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_proforma_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_proformas_updated_at ON public.proformas;
CREATE TRIGGER trg_proformas_updated_at
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.set_proforma_updated_at();

CREATE OR REPLACE FUNCTION public.set_sales_register_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_sales_registers_updated_at ON public.sales_registers;
CREATE TRIGGER trg_sales_registers_updated_at
  BEFORE UPDATE ON public.sales_registers
  FOR EACH ROW EXECUTE FUNCTION public.set_sales_register_updated_at();

-- 7. Sequential Number Generators
CREATE OR REPLACE FUNCTION public.next_proforma_no(p_account_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_seq  BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    (REGEXP_MATCH(proforma_no, 'PI-\d{4}-(\d+)'))[1]::BIGINT
  ), 0) + 1
  INTO v_seq
  FROM public.proformas
  WHERE account_id = p_account_id
    AND proforma_no LIKE 'PI-' || v_year || '-%';
  RETURN 'PI-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END $$;

CREATE OR REPLACE FUNCTION public.next_sales_register_no(p_account_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year TEXT := TO_CHAR(NOW(), 'YYYY');
  v_seq  BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    (REGEXP_MATCH(sales_register_no, 'SR-\d{4}-(\d+)'))[1]::BIGINT
  ), 0) + 1
  INTO v_seq
  FROM public.sales_registers
  WHERE account_id = p_account_id
    AND sales_register_no LIKE 'SR-' || v_year || '-%';
  RETURN 'SR-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END $$;

-- 8. Add cancel status to quotation_status enum (if missing)
DO $$
BEGIN
  ALTER TYPE public.quotation_status ADD VALUE 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add converted status to quotation_status and proforma_status enums (if missing)
DO $$
BEGIN
  ALTER TYPE public.quotation_status ADD VALUE 'converted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.proforma_status ADD VALUE 'converted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 9. Seed new permissions
INSERT INTO permissions (module, action, description) VALUES
  ('quotation', 'convert', 'Convert Quotation to Proforma Invoice'),
  
  ('proforma', 'view',   'View Proforma Invoices'),
  ('proforma', 'create', 'Create Proforma Invoices'),
  ('proforma', 'edit',   'Edit Proforma Invoices'),
  ('proforma', 'delete', 'Delete Proforma Invoices'),
  ('proforma', 'send',   'Send Proforma Invoices'),
  ('proforma', 'convert', 'Convert Proforma Invoice to Sales Register'),
  
  ('sales', 'create', 'Create Sales Register'),
  ('sales', 'edit',   'Edit Sales Register'),
  ('sales', 'delete', 'Delete Sales Register'),
  ('sales', 'dispatch', 'Dispatch / Track Sales Register'),
  ('sales', 'complete', 'Complete Sales Register')
ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description;

-- Re-assign permissions to Super Admin
DO $$
DECLARE
  v_role_id UUID;
  v_perm RECORD;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';
  IF v_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM permissions LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Assign new permissions to Admin role
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Admin';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE (p.module, p.action) IN (
      ('quotation', 'convert'),
      ('proforma', 'view'),
      ('proforma', 'create'),
      ('proforma', 'edit'),
      ('proforma', 'delete'),
      ('proforma', 'send'),
      ('proforma', 'convert'),
      ('sales', 'create'),
      ('sales', 'edit'),
      ('sales', 'delete'),
      ('sales', 'dispatch'),
      ('sales', 'complete')
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Enable Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'proformas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE proformas;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'proforma_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE proforma_items;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales_registers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sales_registers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales_register_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sales_register_items;
  END IF;
END $$;


-- ============================================================
-- IMPORT & EXPORT SYSTEM UPGRADE
-- ============================================================

-- 1. Import History Table
CREATE TABLE IF NOT EXISTS public.import_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  module          TEXT        NOT NULL, -- 'enquiry', 'quotation', 'proforma', 'sales', 'customer', 'product'
  filename        TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'completed', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
  rows_imported   INTEGER     NOT NULL DEFAULT 0,
  rows_failed     INTEGER     NOT NULL DEFAULT 0,
  duration        INTEGER,    -- duration in milliseconds
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Export History Table
CREATE TABLE IF NOT EXISTS public.export_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  module          TEXT        NOT NULL,
  export_type     TEXT        NOT NULL, -- 'excel', 'csv', 'pdf'
  filters_used    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  rows_exported   INTEGER     NOT NULL DEFAULT 0,
  filename        TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Import Logs Table (Error/Warning detail)
CREATE TABLE IF NOT EXISTS public.import_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id       UUID        NOT NULL REFERENCES public.import_history(id) ON DELETE CASCADE,
  row_index       INTEGER,
  row_data        JSONB,
  status          TEXT        NOT NULL, -- 'success', 'warning', 'error'
  message         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Import Mappings Table (Excel columns to CRM mapping)
CREATE TABLE IF NOT EXISTS public.import_mappings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  module          TEXT        NOT NULL,
  mapping         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, module)
);

-- 5. Bulk Processing Jobs Table
CREATE TABLE IF NOT EXISTS public.bulk_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID        NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type        TEXT        NOT NULL, -- 'import', 'export'
  module          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
  progress        INTEGER     NOT NULL DEFAULT 0,
  total_rows      INTEGER     NOT NULL DEFAULT 0,
  processed_rows  INTEGER     NOT NULL DEFAULT 0,
  failed_rows     INTEGER     NOT NULL DEFAULT 0,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Configuration
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_history_policy ON public.import_history;
CREATE POLICY import_history_policy ON public.import_history
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS export_history_policy ON public.export_history;
CREATE POLICY export_history_policy ON public.export_history
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS import_logs_policy ON public.import_logs;
CREATE POLICY import_logs_policy ON public.import_logs
  USING (import_id IN (
    SELECT id FROM public.import_history WHERE account_id IN (
      SELECT account_id FROM public.profiles WHERE user_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS import_mappings_policy ON public.import_mappings;
CREATE POLICY import_mappings_policy ON public.import_mappings
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS bulk_jobs_policy ON public.bulk_jobs;
CREATE POLICY bulk_jobs_policy ON public.bulk_jobs
  USING (account_id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid()));

-- 6. Add Import/Export permissions to the permissions table
INSERT INTO permissions (module, action, description) VALUES
  ('data_management', 'import', 'Import Excel spreadsheets into CRM'),
  ('data_management', 'export', 'Export registers as Excel, CSV, or PDF'),
  ('data_management', 'templates', 'Download Excel import templates'),
  ('data_management', 'history_delete', 'Delete import history logs'),
  ('data_management', 'logs_view', 'View detailed import logs')
ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description;

-- Grant all permissions to Super Admin role
DO $$
DECLARE
  v_role_id UUID;
  v_perm RECORD;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Super Admin';
  IF v_role_id IS NOT NULL THEN
    FOR v_perm IN SELECT id FROM permissions WHERE module = 'data_management' LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (v_role_id, v_perm.id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Grant permissions to Admin role
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  SELECT id INTO v_role_id FROM roles WHERE name = 'Admin';
  IF v_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT v_role_id, p.id FROM permissions p
    WHERE p.module = 'data_management' AND p.action IN ('import', 'export', 'templates', 'logs_view')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;


-- ============================================================
-- ADD CUSTOMER ADDRESS FIELDS TO CONTACTS TABLE
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE public.sales_registers
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- ============================================================
-- CRM PIPELINE STAGES & AUTOMATIONS
-- ============================================================

-- Create crm_pipeline_stages table
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_number TEXT NOT NULL,
  color TEXT NOT NULL,
  position INTEGER NOT NULL,
  target_duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, name)
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_pipeline_stages_select ON crm_pipeline_stages;
DROP POLICY IF EXISTS crm_pipeline_stages_all ON crm_pipeline_stages;
CREATE POLICY crm_pipeline_stages_select ON crm_pipeline_stages FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_pipeline_stages_all ON crm_pipeline_stages FOR ALL USING (is_account_member(account_id, 'agent'));

-- Create crm_pipeline_automations table
CREATE TABLE IF NOT EXISTS public.crm_pipeline_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL, 
  target_stage TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crm_pipeline_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_pipeline_automations_select ON crm_pipeline_automations;
DROP POLICY IF EXISTS crm_pipeline_automations_all ON crm_pipeline_automations;
CREATE POLICY crm_pipeline_automations_select ON public.crm_pipeline_automations FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_pipeline_automations_all ON public.crm_pipeline_automations FOR ALL USING (is_account_member(account_id, 'admin'));

-- Create crm_stage_assignments table
CREATE TABLE IF NOT EXISTS public.crm_stage_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  crm_lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crm_stage_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crm_stage_assignments_select ON crm_stage_assignments;
DROP POLICY IF EXISTS crm_stage_assignments_all ON crm_stage_assignments;
CREATE POLICY crm_stage_assignments_select ON public.crm_stage_assignments FOR SELECT USING (is_account_member(account_id));
CREATE POLICY crm_stage_assignments_all ON public.crm_stage_assignments FOR ALL USING (is_account_member(account_id, 'agent'));

-- Alter crm_lead_history table for stage duration
ALTER TABLE public.crm_lead_history ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ;
ALTER TABLE public.crm_lead_history ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Drop old check constraint first to allow migration to new stages
ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_stage_check;

-- Alter stage column default on crm_leads
ALTER TABLE public.crm_leads ALTER COLUMN stage SET DEFAULT 'Customer';

-- Migrate existing crm_leads to 'Customer'
UPDATE public.crm_leads SET stage = 'Customer' WHERE stage NOT IN (
  'Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material',
  'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual',
  'Dispatch', 'Payment', 'Appreciation'
) OR stage IS NULL;

-- Reconfigure and enforce the new stage check constraint
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_stage_check CHECK (stage IN (
  'Customer', 'Enquiry Design Estimate', 'PO / Advance', 'Bill of Material',
  'Manufacturing', 'Inspection', 'Invoice', 'Estimate vs Actual',
  'Dispatch', 'Payment', 'Appreciation'
));
-- Alter conversations table to support deep-linked document context
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_opened_document TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS document_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS chat_context JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_shared_pdf TEXT;

-- Alter sync_logs and integration_sync_state to support detailed logging and cursors
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS pages_processed INTEGER DEFAULT 0;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS imported INTEGER DEFAULT 0;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS skipped INTEGER DEFAULT 0;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS failed INTEGER DEFAULT 0;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS last_successful_page INTEGER;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS current_cursor TEXT;
ALTER TABLE public.sync_logs ADD COLUMN IF NOT EXISTS api_response_time INTEGER;

ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS current_cursor TEXT;
ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS last_lead_id TEXT;
ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS current_date_filter TEXT;
ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS custom_start_date TIMESTAMPTZ;
ALTER TABLE public.integration_sync_state ADD COLUMN IF NOT EXISTS custom_end_date TIMESTAMPTZ;

-- Ensure missing columns exist on b2b_raw_logs
ALTER TABLE public.b2b_raw_logs ADD COLUMN IF NOT EXISTS response_json JSONB;
ALTER TABLE public.b2b_raw_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.b2b_raw_logs ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to company_bank_accounts
ALTER TABLE public.company_bank_accounts ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.company_bank_accounts ADD COLUMN IF NOT EXISTS swift_code TEXT;
ALTER TABLE public.company_bank_accounts ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- ============================================================
-- CLEAN UP LEGACY/BUGGY TRIGGERS
-- ============================================================
DO $$
DECLARE
  v_trg RECORD;
BEGIN
  -- Clean proformas triggers (except updated_at)
  FOR v_trg IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.proformas'::regclass 
      AND tgname != 'trg_proformas_updated_at'
      AND tgisinternal = false
  LOOP
    EXECUTE 'DROP TRIGGER ' || quote_ident(v_trg.tgname) || ' ON public.proformas;';
  END LOOP;

  -- Clean quotations triggers (except updated_at)
  FOR v_trg IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.quotations'::regclass 
      AND tgname != 'trg_quotations_updated_at'
      AND tgisinternal = false
  LOOP
    EXECUTE 'DROP TRIGGER ' || quote_ident(v_trg.tgname) || ' ON public.quotations;';
  END LOOP;

  -- Clean sales_registers triggers (except updated_at)
  FOR v_trg IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.sales_registers'::regclass 
      AND tgname != 'trg_sales_registers_updated_at'
      AND tgisinternal = false
  LOOP
    EXECUTE 'DROP TRIGGER ' || quote_ident(v_trg.tgname) || ' ON public.sales_registers;';
  END LOOP;
END $$;

-- Make AI enabled by default for existing environments
ALTER TABLE public.whatsapp_config ALTER COLUMN ai_enabled SET DEFAULT true;
ALTER TABLE public.conversations ALTER COLUMN ai_mode SET DEFAULT true;

UPDATE public.whatsapp_config SET ai_enabled = true;
UPDATE public.conversations SET ai_mode = true;

-- ============================================================
-- SUPABASE REALTIME PUBLICATION
-- ============================================================
-- Enable realtime for the tables the Inbox subscribes to.
-- Without this, new inbound WhatsApp messages and conversation
-- updates are saved to the DB but never pushed to connected
-- browser clients, so the inbox never updates live.
--
-- REPLICA IDENTITY FULL is required so that UPDATE and DELETE
-- events include the full old row (needed for Realtime to diff
-- and send correct payloads to subscribed clients).
-- ============================================================

-- Set REPLICA IDENTITY to FULL so UPDATE/DELETE payloads include old row data
ALTER TABLE public.messages       REPLICA IDENTITY FULL;
ALTER TABLE public.conversations  REPLICA IDENTITY FULL;
ALTER TABLE public.contacts       REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication if not already added
DO $$
DECLARE
  v_exists boolean;
BEGIN
  -- messages
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- conversations
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  -- contacts (for contact name updates showing live in inbox sidebar)
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  END IF;
END $$;


-- ============================================================
-- MIGRATION: 025_openrouter_failover.sql
-- ============================================================
-- Add failover and tracking columns to whatsapp_config
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_fallback_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_model_status TEXT NOT NULL DEFAULT 'healthy'; -- 'healthy', 'degraded', 'unavailable'
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_last_error TEXT;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_last_success_at TIMESTAMPTZ;
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_available_models JSONB DEFAULT '[]'::jsonb;

-- Create AI Fallback Logs table
CREATE TABLE IF NOT EXISTS public.ai_fallback_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  selected_model TEXT NOT NULL,
  failed_model TEXT,
  fallback_model TEXT,
  reason_for_fallback TEXT,
  http_status INTEGER,
  latency_ms INTEGER,
  token_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policies
ALTER TABLE public.ai_fallback_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_fallback_logs_select ON public.ai_fallback_logs;
CREATE POLICY ai_fallback_logs_select ON public.ai_fallback_logs FOR SELECT USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS ai_fallback_logs_insert ON public.ai_fallback_logs;
CREATE POLICY ai_fallback_logs_insert ON public.ai_fallback_logs FOR INSERT WITH CHECK (public.is_account_member(account_id));


-- MIGRATION: 026_gemini_integration.sql
-- Add ai_provider and gemini_api_key columns to whatsapp_config
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';
ALTER TABLE public.whatsapp_config ALTER COLUMN ai_provider SET DEFAULT 'gemini';
ALTER TABLE public.whatsapp_config ALTER COLUMN ai_model SET DEFAULT 'gemini-2.5-flash';
UPDATE public.whatsapp_config SET ai_provider = 'gemini' WHERE ai_provider IS NULL OR ai_provider = 'openrouter';
UPDATE public.whatsapp_config SET ai_model = 'gemini-2.5-flash' WHERE ai_model = 'google/gemini-2.5-flash:free';
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

