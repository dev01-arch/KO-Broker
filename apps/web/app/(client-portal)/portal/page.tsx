import { notFound } from 'next/navigation';

/**
 * Client Portal — PRD-13 (Phase 2)
 *
 * This route group is created per PRD-13 but returns 404 in MVP.
 * The client portal will be built in Phase 2 (Sprint 6+).
 */
export default function ClientPortalPage() {
  notFound();
}
