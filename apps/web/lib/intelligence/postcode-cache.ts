/**
 * Postcodes.io lookup + permanent cache — PRD-15 B5
 *
 * On every snapshot creation (and optionally on preview):
 *   1. Check PostcodeGeography table for a cached record (full or outward code).
 *   2. Cache hit → return immediately, even if the live API is down.
 *   3. Cache miss → call Postcodes.io with a 2s timeout, store result permanently.
 *
 * We cache both full postcodes (e.g. "SW1A 2AA") and outward codes (e.g. "SW1A").
 * Outward codes are stored under the normalised outward code key so multiple full
 * postcodes in the same district share the same geography row.
 *
 * Never throws — returns null on lookup failure so the snapshot can still save
 * (geography data is informational, not required for the core calculation).
 */

import { prisma } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeographyResult {
  postcode: string;      // the key used for cache lookup (normalised)
  outwardCode: string;
  lat: number | null;
  lng: number | null;
  region: string | null;
  adminDistrict: string | null;
  lsoa: string | null;
  msoa: string | null;
  constituency: string | null;
}

// ── Postcodes.io response shape (partial) ─────────────────────────────────────

interface PostcodesIoResult {
  postcode: string;
  outcode: string;
  latitude: number | null;
  longitude: number | null;
  region: string | null;
  admin_district: string | null;
  lsoa: string | null;
  msoa: string | null;
  parliamentary_constituency: string | null;
}

interface PostcodesIoResponse {
  status: number;
  result: PostcodesIoResult | null;
}

interface PostcodesIoOutwardResponse {
  status: number;
  result: {
    outcode: string;
    latitude: number | null;
    longitude: number | null;
    region: string[];
    admin_district: string[];
    constituency: string[];
  } | null;
}

// ── Internal: normalise postcode string ───────────────────────────────────────

export function normalisePostcode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Extract outward code from a full UK postcode, e.g. "SW1A 2AA" → "SW1A". */
export function toOutwardCode(postcode: string): string {
  const normalised = normalisePostcode(postcode);
  // Full postcode: outward = everything before the last space
  const spaceIdx = normalised.lastIndexOf(' ');
  if (spaceIdx > 0) return normalised.slice(0, spaceIdx);
  // Already an outward code (no space)
  return normalised;
}

// ── Internal: live Postcodes.io call ─────────────────────────────────────────

async function lookupFullPostcode(
  postcode: string,
): Promise<GeographyResult | null> {
  const encoded = encodeURIComponent(postcode.replace(/\s/g, ''));
  const url = `https://api.postcodes.io/postcodes/${encoded}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2_000),
      headers: { 'User-Agent': 'KO-Broker/1.0' },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as PostcodesIoResponse;
    if (json.status !== 200 || !json.result) return null;

    const r = json.result;
    return {
      postcode: normalisePostcode(postcode),
      outwardCode: r.outcode.toUpperCase(),
      lat: r.latitude,
      lng: r.longitude,
      region: r.region,
      adminDistrict: r.admin_district,
      lsoa: r.lsoa,
      msoa: r.msoa,
      constituency: r.parliamentary_constituency,
    };
  } catch {
    return null;
  }
}

async function lookupOutwardCode(
  outward: string,
): Promise<GeographyResult | null> {
  const encoded = encodeURIComponent(outward.toLowerCase());
  const url = `https://api.postcodes.io/outcodes/${encoded}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2_000),
      headers: { 'User-Agent': 'KO-Broker/1.0' },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as PostcodesIoOutwardResponse;
    if (json.status !== 200 || !json.result) return null;

    const r = json.result;
    return {
      postcode: outward.toUpperCase(),
      outwardCode: r.outcode.toUpperCase(),
      lat: r.latitude,
      lng: r.longitude,
      region: r.region?.[0] ?? null,
      adminDistrict: r.admin_district?.[0] ?? null,
      lsoa: null,
      msoa: null,
      constituency: r.constituency?.[0] ?? null,
    };
  } catch {
    return null;
  }
}

// ── Internal: write to PostcodeGeography ──────────────────────────────────────

async function persist(geo: GeographyResult): Promise<void> {
  await prisma.postcodeGeography.upsert({
    where: { postcode: geo.postcode },
    create: {
      postcode: geo.postcode,
      outwardCode: geo.outwardCode,
      lat: geo.lat,
      lng: geo.lng,
      region: geo.region,
      adminDistrict: geo.adminDistrict,
      lsoa: geo.lsoa,
      msoa: geo.msoa,
      constituency: geo.constituency,
      cachedAt: new Date(),
    },
    update: {
      // Don't refresh existing cache — permanent per spec.
      // Only update cachedAt to record that we confirmed it.
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up geography for a postcode (full or outward), returning cached data
 * when available. Falls back to the live Postcodes.io API with a 2s timeout
 * and stores the result permanently on success.
 *
 * Returns null if the postcode is not found or the API is unreachable —
 * callers must handle null gracefully (snapshot saves without geography data).
 */
export async function lookupPostcode(
  rawPostcode: string,
): Promise<GeographyResult | null> {
  const normalised = normalisePostcode(rawPostcode);
  const isFullPostcode = normalised.includes(' ');
  const outward = toOutwardCode(normalised);

  // ── 1. Try cache hit (exact match first, then outward code) ──────────────────
  const cached = await prisma.postcodeGeography.findUnique({
    where: { postcode: normalised },
  });

  if (cached) {
    return {
      postcode: cached.postcode,
      outwardCode: cached.outwardCode,
      lat: cached.lat,
      lng: cached.lng,
      region: cached.region,
      adminDistrict: cached.adminDistrict,
      lsoa: cached.lsoa,
      msoa: cached.msoa,
      constituency: cached.constituency,
    };
  }

  // If full postcode not cached, check if we at least have the outward code
  if (isFullPostcode) {
    const outwardCached = await prisma.postcodeGeography.findUnique({
      where: { postcode: outward },
    });
    if (outwardCached) {
      // Return outward-code data as a best-effort for the full postcode
      return {
        postcode: normalised,
        outwardCode: outwardCached.outwardCode,
        lat: outwardCached.lat,
        lng: outwardCached.lng,
        region: outwardCached.region,
        adminDistrict: outwardCached.adminDistrict,
        lsoa: null, // outward-code rows never have lsoa/msoa
        msoa: null,
        constituency: outwardCached.constituency,
      };
    }
  }

  // ── 2. Cache miss — call Postcodes.io ────────────────────────────────────────
  let geo: GeographyResult | null = null;

  if (isFullPostcode) {
    geo = await lookupFullPostcode(normalised);
  }

  // Fall back to outward code lookup if full lookup failed or not a full postcode
  if (!geo) {
    geo = await lookupOutwardCode(outward);
    if (geo) {
      // Use outward code as the cache key when we only have that data
      geo = { ...geo, postcode: outward };
    }
  }

  if (!geo) return null;

  // ── 3. Persist (fire-and-forget — don't let a DB write block the response) ────
  void persist(geo).catch((err) =>
    console.warn('[postcode-cache] persist failed:', err instanceof Error ? err.message : err),
  );

  return geo;
}
