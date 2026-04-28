/**
 * Audit trail logger — PRD-07
 *
 * INSERT-ONLY audit log. No UPDATE or DELETE on AuditLog.
 * Called by every mutation handler.
 * Diffs computed with deep-diff comparing before/after snapshots.
 */

// TODO (PRD-07): Implement logAuditEvent()

export {};
