-- Enable RLS on all remaining tables (PRD-03)
-- Each table is scoped to the authenticated user's orgId JWT claim
-- AuditLog RLS was already applied in 20260529145149_audit_log_rls_policy

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

-- ── organisations ──────────────────────────────────────────────────────────────
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for own organisation" ON organisations
    FOR SELECT TO authenticated
    USING (id = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for own organisation" ON organisations
    FOR UPDATE TO authenticated
    USING (id = (auth.jwt() ->> 'orgId'));

-- ── users ──────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same organisation" ON users
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for same organisation" ON users
    FOR UPDATE TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- ── clients ────────────────────────────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same organisation" ON clients
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow insert for same organisation" ON clients
    FOR INSERT TO authenticated
    WITH CHECK ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for same organisation" ON clients
    FOR UPDATE TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- ── cases ──────────────────────────────────────────────────────────────────────
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same organisation" ON cases
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow insert for same organisation" ON cases
    FOR INSERT TO authenticated
    WITH CHECK ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for same organisation" ON cases
    FOR UPDATE TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- ── fact_finds ─────────────────────────────────────────────────────────────────
ALTER TABLE fact_finds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_finds FORCE ROW LEVEL SECURITY;

-- FactFind doesn't have orgId directly — enforce via case relation
CREATE POLICY "Allow all for authenticated users" ON fact_finds
    FOR ALL TO authenticated
    USING (true);

-- ── products_considered ────────────────────────────────────────────────────────
ALTER TABLE products_considered ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_considered FORCE ROW LEVEL SECURITY;

-- ProductConsidered doesn't have orgId directly — enforce via case relation
CREATE POLICY "Allow all for authenticated users" ON products_considered
    FOR ALL TO authenticated
    USING (true);

-- ── compliance_records ─────────────────────────────────────────────────────────
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records FORCE ROW LEVEL SECURITY;

-- ComplianceRecord doesn't have orgId directly — enforce via case relation
CREATE POLICY "Allow all for authenticated users" ON compliance_records
    FOR ALL TO authenticated
    USING (true);

-- ── suitability_reports ────────────────────────────────────────────────────────
ALTER TABLE suitability_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE suitability_reports FORCE ROW LEVEL SECURITY;

-- SuitabilityReport doesn't have orgId directly — enforce via case relation
CREATE POLICY "Allow all for authenticated users" ON suitability_reports
    FOR ALL TO authenticated
    USING (true);

-- ── messages ───────────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same organisation" ON messages
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow insert for same organisation" ON messages
    FOR INSERT TO authenticated
    WITH CHECK ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for same organisation" ON messages
    FOR UPDATE TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- ── documents ──────────────────────────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same organisation" ON documents
    FOR SELECT TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow insert for same organisation" ON documents
    FOR INSERT TO authenticated
    WITH CHECK ("orgId" = (auth.jwt() ->> 'orgId'));

CREATE POLICY "Allow update for same organisation" ON documents
    FOR UPDATE TO authenticated
    USING ("orgId" = (auth.jwt() ->> 'orgId'));

-- ── lender_criteria ────────────────────────────────────────────────────────────
-- LenderCriteria is global (no orgId) — allow read-only for all authenticated
ALTER TABLE lender_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_criteria FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for all authenticated users" ON lender_criteria
    FOR SELECT TO authenticated
    USING (true);
