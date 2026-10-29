-- Row-level security: every public table has RLS on and no grants to anon or authenticated,
-- so Supabase's Data API (PostgREST) and Realtime return nothing with the public anon key.
-- All reads and writes go through the app server, which connects as the table owner and authorizes each request
-- itself (access.ts for staff, portal-client.ts for clients). A test (portal.test.ts) fails if any table is left without RLS.
-- Every later migration that adds a table must enable RLS on it the same way.

-- Local shim: Supabase already has these roles. Created only when missing.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Tables created later by the owner don't get Supabase's default grants either.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
