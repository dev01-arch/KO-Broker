/**
 * Shared utility functions — PRD-02
 *
 * Pure utility functions used across the app.
 * No side effects, no API calls, no framework dependencies.
 */

/**
 * Generate a reference number in the format KOC-YYYY-NNNN or KOF-YYYY-NNNN.
 */
export function generateReference(prefix: 'KOC' | 'KOF', sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceNumber).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

/**
 * Calculate LTV (Loan to Value) percentage.
 */
export function calculateLTV(loanAmount: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return Math.round((loanAmount / propertyValue) * 100);
}

/**
 * Format currency (GBP).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Slugify a string for URL-safe usage.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
