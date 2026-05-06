-- Append-only enforcement: revoke UPDATE/DELETE on audit_logs and
-- ledger_entries from the application role at the database level. This
-- complements the application-layer rule that only AuditService and
-- LedgerService may insert into these tables.
--
-- Note: this migration depends on knowing the application DB role name.
-- We use CURRENT_USER which is the role Prisma is connected as. If the
-- production setup uses a separate read-only role for analytics, that
-- role should be excluded from these grants.

REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs"     FROM CURRENT_USER;
REVOKE UPDATE, DELETE, TRUNCATE ON "ledger_entries" FROM CURRENT_USER;
GRANT SELECT, INSERT ON "audit_logs"     TO CURRENT_USER;
GRANT SELECT, INSERT ON "ledger_entries" TO CURRENT_USER;

-- Idempotency records intentionally allow full CRUD: the purge job needs
-- DELETE to remove expired rows.
