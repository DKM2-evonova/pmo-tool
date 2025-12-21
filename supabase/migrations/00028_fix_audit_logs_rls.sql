-- Fix overly permissive RLS policy on audit_logs
-- The INSERT policy was "WITH CHECK (true)" which allowed any authenticated user to insert
-- Audit logs should only be inserted by service role (SECURITY DEFINER functions)

-- Drop the permissive INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

-- No INSERT policy needed for authenticated users
-- Audit logs are inserted via:
-- 1. create_audit_log() function (SECURITY DEFINER)
-- 2. batch_create_audit_logs() function (SECURITY DEFINER)
-- 3. Service role client (bypasses RLS)

-- Add policy to prevent direct INSERT by authenticated users
-- This ensures only SECURITY DEFINER functions or service role can insert
CREATE POLICY "Prevent direct audit log inserts"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Note: SECURITY DEFINER functions bypass RLS policies, so they can still insert
-- Service role also bypasses RLS, so backend audit logging still works
