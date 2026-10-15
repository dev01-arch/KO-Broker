-- Client delete was refused because these tables allow select, insert, and
-- update for the organisation, and no delete. The same org check applies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'Allow delete for same organisation'
  ) THEN
    CREATE POLICY "Allow delete for same organisation" ON clients
      FOR DELETE TO authenticated
      USING ("orgId" = (auth.jwt() ->> 'orgId'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'Allow delete for same organisation'
  ) THEN
    CREATE POLICY "Allow delete for same organisation" ON cases
      FOR DELETE TO authenticated
      USING ("orgId" = (auth.jwt() ->> 'orgId'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Allow delete for same organisation'
  ) THEN
    CREATE POLICY "Allow delete for same organisation" ON messages
      FOR DELETE TO authenticated
      USING ("orgId" = (auth.jwt() ->> 'orgId'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Allow delete for same organisation'
  ) THEN
    CREATE POLICY "Allow delete for same organisation" ON documents
      FOR DELETE TO authenticated
      USING ("orgId" = (auth.jwt() ->> 'orgId'));
  END IF;
END $$;
