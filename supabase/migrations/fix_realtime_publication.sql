-- ============================================================
-- FIX: Enable Supabase Realtime for Inbox tables
-- ============================================================
-- PURPOSE: Messages sent to Meta WhatsApp were being saved to the
-- database but were NOT appearing in the CRM Inbox in real time.
-- Root cause: messages and conversations tables were missing from
-- the supabase_realtime publication, so browser clients subscribed
-- to Realtime never received INSERT/UPDATE events.
--
-- Run this SQL once in the Supabase SQL Editor for your project.
-- ============================================================

-- Step 1: Set REPLICA IDENTITY to FULL
-- This ensures UPDATE/DELETE realtime events include the complete
-- old row data, which Supabase Realtime needs to send correct payloads.
ALTER TABLE public.messages       REPLICA IDENTITY FULL;
ALTER TABLE public.conversations  REPLICA IDENTITY FULL;
ALTER TABLE public.contacts       REPLICA IDENTITY FULL;

-- Step 2: Add tables to supabase_realtime publication
-- Uses idempotent DO block so re-running is safe.
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
    RAISE NOTICE 'Added messages to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'messages already in supabase_realtime publication';
  END IF;

  -- conversations
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    RAISE NOTICE 'Added conversations to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'conversations already in supabase_realtime publication';
  END IF;

  -- contacts
  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
  ) INTO v_exists;
  IF NOT v_exists THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    RAISE NOTICE 'Added contacts to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'contacts already in supabase_realtime publication';
  END IF;
END $$;

-- Step 3: Verify the fix was applied
SELECT tablename, rowfilter
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations', 'contacts')
ORDER BY tablename;
