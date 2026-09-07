-- Create auth schema if it does not exist (for shadow database validation)
CREATE SCHEMA IF NOT EXISTS auth;

-- Define a dummy auth.jwt() function only if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'auth' AND p.proname = 'jwt'
    ) THEN
        CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb;';
    END IF;
END $$;

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Allow SELECT scoped to orgId via authenticated user's JWT orgId custom claim
CREATE POLICY "Allow select for same organization" ON audit_logs
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- Allow INSERT for all authenticated users
CREATE POLICY "Allow insert for all authenticated users" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Deny UPDATE for all roles — audit log is immutable (PRD-07 FCA compliance)
CREATE POLICY "Deny update on audit_logs" ON audit_logs
    FOR UPDATE TO authenticated
    USING (false);

-- Deny DELETE for all roles — audit log is immutable (PRD-07 FCA compliance)
CREATE POLICY "Deny delete on audit_logs" ON audit_logs
    FOR DELETE TO authenticated
    USING (false);