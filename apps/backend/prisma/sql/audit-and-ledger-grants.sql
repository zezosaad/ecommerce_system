-- Audit and Ledger GRANT script
-- Restricts the application DB user to INSERT-only on audit_logs and ledger_entries
-- to enforce append-only discipline at the database level.
--
-- Run this migration AFTER the initial foundation migration.
-- The app user should NOT be able to UPDATE or DELETE from these tables.

-- Audit logs: INSERT and SELECT only
REVOKE ALL ON audit_logs FROM CURRENT_USER;
GRANT SELECT, INSERT ON audit_logs TO CURRENT_USER;

-- Ledger entries: INSERT and SELECT only
REVOKE ALL ON ledger_entries FROM CURRENT_USER;
GRANT SELECT, INSERT ON ledger_entries TO CURRENT_USER;

-- Idempotency records: full CRUD (needed for TTL-based cleanup)
-- No restrictions needed; the interceptor manages reads and writes.
