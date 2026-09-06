'use client';
/**
 * /api-docs — KO Broker API Explorer
 *
 * Swagger-style interactive documentation page.
 * Lists every endpoint with method, path, params, and example responses.
 * Includes all Intelligence endpoints from PRD-15.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Globe, Copy, Check, Key } from 'lucide-react';
import { ENDPOINTS, TAG_GROUPS, type EndpointDef } from '@/lib/api/spec';

const isPortalAuthRoute = (path: string) => {
    return path.startsWith('/api/portal/') &&
        !['/api/portal/invite', '/api/portal/verify-token', '/api/portal/setup', '/api/portal/login'].includes(path);
};

// ── Method badge colours ──────────────────────────────────────────────────────
const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
    GET: { bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]' },
    POST: { bg: 'bg-[#F0FDF4]', text: 'text-[#166534]' },
    PATCH: { bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]' },
    PUT: { bg: 'bg-[#FDF4FF]', text: 'text-[#86198F]' },
    DELETE: { bg: 'bg-[#FFF1F2]', text: 'text-[#BE123C]' },
};

// ── Root page ─────────────────────────────────────────────────────────────────
export default function ApiDocsPage() {
    const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());
    const [activeTag, setActiveTag] = useState<string>('all');

    function toggleEndpoint(key: string) {
        setOpenEndpoints((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }

    const filteredEndpoints =
        activeTag === 'all'
            ? ENDPOINTS
            : ENDPOINTS.filter((e) => e.tags.includes(activeTag));

    // Group by tag for display
    const tagOrder = TAG_GROUPS.map((g) => g.tag);
    const grouped = tagOrder.reduce<Record<string, EndpointDef[]>>((acc, tag) => {
        const matches = filteredEndpoints.filter((e) => e.tags.includes(tag));
        if (matches.length) acc[tag] = matches;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[#0D1117] text-white">
            {/* Top bar */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0D1117]/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1D9E75]">
                            <span className="font-heading text-xs font-bold text-white">KO</span>
                        </div>
                        <div>
                            <h1 className="font-heading text-sm font-bold text-white">KO Broker API</h1>
                            <p className="text-[11px] text-white/40">v0.1.0 · REST · JSON</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href="/api/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                        >
                            <Copy className="h-3 w-3" />
                            JSON spec
                        </a>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1D9E75]" />
                            <span className="text-xs text-white/60">Base URL: <span className="text-white/90">/api</span></span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-6 py-8">
                <div className="flex gap-8">
                    {/* Sidebar nav */}
                    <aside className="hidden w-52 shrink-0 lg:block">
                        <div className="sticky top-24 flex flex-col gap-1">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">Resources</p>
                            <button
                                onClick={() => setActiveTag('all')}
                                className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${activeTag === 'all'
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                    }`}
                            >
                                All endpoints
                                <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                                    {ENDPOINTS.length}
                                </span>
                            </button>
                            {TAG_GROUPS.map((group) => {
                                const count = ENDPOINTS.filter((e) => e.tags.includes(group.tag)).length;
                                return (
                                    <button
                                        key={group.tag}
                                        onClick={() => setActiveTag(group.tag)}
                                        className={`rounded-md px-3 py-1.5 text-left text-sm transition-colors ${activeTag === group.tag
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: group.color }}
                                            />
                                            {group.tag}
                                        </span>
                                        <span className="ml-5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{count}</span>
                                    </button>
                                );
                            })}
                            <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-3">
                                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">Auth Overview</p>
                                <div className="flex flex-col gap-2.5 text-xs text-white/60 leading-relaxed">
                                    <div>
                                        <span className="font-semibold text-amber-400">Broker API:</span> Requires a valid Clerk session cookie.
                                    </div>
                                    <div className="border-t border-white/10 pt-2">
                                        <span className="font-semibold text-pink-400 flex items-center gap-1">
                                            <Key className="h-3 w-3 inline" /> Client Portal API:
                                        </span>{' '}
                                        Requires a custom <code className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-pink-300">client_session</code> JWT cookie.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main content */}
                    <main className="min-w-0 flex-1">
                        {/* Intro */}
                        <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
                            <h2 className="mb-2 font-heading text-lg font-bold text-white">KO Broker REST API</h2>
                            <p className="text-sm leading-relaxed text-white/60">
                                All endpoints are scoped to the authenticated organisation. Data from one org is never accessible to another.
                                Every mutation writes an immutable{' '}
                                <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-[#5DCAA5]">AuditLog</code> entry.
                                Responses always follow the{' '}
                                <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-[#5DCAA5]">{'{ success, data, meta }'}</code> or{' '}
                                <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-[#5DCAA5]">{'{ success, error }'}</code> envelope.
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    { label: 'Endpoints', value: ENDPOINTS.length.toString() },
                                    { label: 'Auth', value: 'Clerk' },
                                    { label: 'Format', value: 'JSON' },
                                    { label: 'Validation', value: 'Zod' },
                                ].map((s) => (
                                    <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                                        <div className="font-heading text-lg font-bold text-[#5DCAA5]">{s.value}</div>
                                        <div className="text-[11px] text-white/40">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Endpoint groups */}
                        {Object.entries(grouped).map(([tag, endpoints]) => {
                            const group = TAG_GROUPS.find((g) => g.tag === tag);
                            return (
                                <section key={tag} className="mb-8">
                                    <div className="mb-3 flex items-center gap-3">
                                        <div
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: group?.color ?? '#6B7280' }}
                                        />
                                        <h2 className="font-heading text-base font-bold text-white">{tag}</h2>
                                        <span className="text-xs text-white/30">{group?.description}</span>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {endpoints.map((endpoint) => {
                                            const key = `${endpoint.method}:${endpoint.path}`;
                                            const isOpen = openEndpoints.has(key);
                                            const ms = METHOD_STYLES[endpoint.method] ?? METHOD_STYLES.GET!;
                                            return (
                                                <div
                                                    key={key}
                                                    className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                                                >
                                                    {/* Endpoint header row */}
                                                    <button
                                                        onClick={() => toggleEndpoint(key)}
                                                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                                                    >
                                                        <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-bold ${ms.bg} ${ms.text}`}>
                                                            {endpoint.method}
                                                        </span>
                                                        <code className="flex-1 text-sm text-white/80">{endpoint.path}</code>
                                                        <span className="hidden text-xs text-white/40 sm:block">{endpoint.summary}</span>
                                                        {endpoint.auth ? (
                                                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400/60" aria-label="Requires Clerk auth" />
                                                        ) : isPortalAuthRoute(endpoint.path) ? (
                                                            <Key className="h-3.5 w-3.5 shrink-0 text-pink-400/80" aria-label="Requires Client Portal auth" />
                                                        ) : (
                                                            <Globe className="h-3.5 w-3.5 shrink-0 text-[#1D9E75]/60" aria-label="Public" />
                                                        )}
                                                        {isOpen
                                                            ? <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />
                                                            : <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                                                        }
                                                    </button>
                                                    {/* Expanded detail */}
                                                    {isOpen && <EndpointDetail endpoint={endpoint} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}

                        {/* Error codes reference */}
                        <section className="mb-8">
                            <div className="mb-3 flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#6B7280]" />
                                <h2 className="font-heading text-base font-bold text-white">Error codes</h2>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-white/10">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/5">
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/40">HTTP</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/40">Code</th>
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/40">When</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { status: '200 / 201', code: '—', when: 'Successful operation' },
                                            { status: '401', code: 'UNAUTHORIZED', when: 'No valid Clerk session' },
                                            { status: '403', code: 'FORBIDDEN', when: 'Insufficient role for this action' },
                                            { status: '403', code: 'PLAN_LIMIT_EXCEEDED', when: 'Feature requires a higher plan' },
                                            { status: '404', code: 'NOT_FOUND', when: 'Resource does not exist or belongs to another org' },
                                            { status: '409', code: 'CONFLICT', when: 'Business rule conflict (e.g. copy-to-notes on a case-less snapshot)' },
                                            { status: '422', code: 'VALIDATION_ERROR', when: 'Zod schema validation failed — includes field-level errors' },
                                            { status: '422', code: 'BUSINESS_RULE_VIOLATION', when: 'Business logic rejected the request (e.g. stage skip)' },
                                            { status: '503', code: 'RATE_DATA_NOT_READY', when: 'Rate cache empty — wait for the first BoE ingest cron run' },
                                            { status: '500', code: 'INTERNAL_ERROR', when: 'Unexpected server error' },
                                        ].map((row, i) => (
                                            <tr key={i} className="border-b border-white/5 last:border-0">
                                                <td className="px-4 py-2.5 font-mono text-xs text-white/60">{row.status}</td>
                                                <td className="px-4 py-2.5">
                                                    <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[#5DCAA5]">{row.code}</code>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs text-white/50">{row.when}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
}

// ── Endpoint detail panel ─────────────────────────────────────────────────────
function EndpointDetail({ endpoint }: { endpoint: EndpointDef }) {
    const [activeResponse, setActiveResponse] = useState(0);
    const pathParams = endpoint.params?.filter((p) => p.in === 'path') ?? [];
    const queryParams = endpoint.params?.filter((p) => p.in === 'query') ?? [];
    const bodyParams = endpoint.params?.filter((p) => p.in === 'body') ?? [];

    return (
        <div className="border-t border-white/10 px-4 pb-5 pt-4">
            {/* Description */}
            <p className="mb-5 text-sm leading-relaxed text-white/60">{endpoint.description}</p>
            <div className="grid gap-5 lg:grid-cols-2">
                {/* Left: params */}
                <div className="flex flex-col gap-4">
                    {/* Auth note */}
                    {endpoint.auth ? (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-400/80">
                            <Lock className="h-3 w-3" /> Requires authentication (Clerk session)
                        </div>
                    ) : isPortalAuthRoute(endpoint.path) ? (
                        <div className="flex items-center gap-2 rounded-lg border border-pink-500/20 bg-pink-500/5 px-3 py-2 text-xs text-pink-400">
                            <Key className="h-3 w-3" /> Requires Client Portal authentication (client_session cookie)
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-[#1D9E75]/20 bg-[#1D9E75]/5 px-3 py-2 text-xs text-[#1D9E75]/80">
                            <Globe className="h-3 w-3" /> Public endpoint — no auth required
                        </div>
                    )}
                    {/* Path params */}
                    {pathParams.length > 0 && <ParamTable title="Path parameters" params={pathParams} />}
                    {/* Query params */}
                    {queryParams.length > 0 && <ParamTable title="Query parameters" params={queryParams} />}
                    {/* Body params */}
                    {bodyParams.length > 0 && <ParamTable title="Request body" params={bodyParams} />}
                </div>

                {/* Right: responses */}
                <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">Responses</p>
                    {/* Status tabs */}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {endpoint.responses.map((r, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveResponse(i)}
                                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${activeResponse === i
                                    ? r.status < 300
                                        ? 'bg-[#F0FDF4] text-[#166534]'
                                        : r.status < 500
                                            ? 'bg-[#FFF7ED] text-[#C2410C]'
                                            : 'bg-[#FFF1F2] text-[#BE123C]'
                                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                                    }`}
                            >
                                {r.status}
                            </button>
                        ))}
                    </div>
                    {/* Response description */}
                    <p className="mb-2 text-xs text-white/40">
                        {endpoint.responses[activeResponse]?.description}
                    </p>
                    {/* JSON example */}
                    <JsonBlock value={endpoint.responses[activeResponse]?.example} />
                </div>
            </div>
        </div>
    );
}

// ── Param table ───────────────────────────────────────────────────────────────
function ParamTable({ title, params }: { title: string; params: NonNullable<EndpointDef['params']> }) {
    return (
        <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">{title}</p>
            <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                            <th className="px-3 py-2 text-left font-semibold text-white/40">Name</th>
                            <th className="px-3 py-2 text-left font-semibold text-white/40">Type</th>
                            <th className="px-3 py-2 text-left font-semibold text-white/40">Required</th>
                            <th className="px-3 py-2 text-left font-semibold text-white/40">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {params.map((p) => (
                            <tr key={p.name} className="border-b border-white/5 last:border-0">
                                <td className="px-3 py-2">
                                    <code className="text-[#5DCAA5]">{p.name}</code>
                                </td>
                                <td className="px-3 py-2 text-white/50">{p.type}</td>
                                <td className="px-3 py-2">
                                    {p.required
                                        ? <span className="text-red-400">required</span>
                                        : <span className="text-white/30">optional</span>
                                    }
                                </td>
                                <td className="px-3 py-2 text-white/50">
                                    {p.description}
                                    {p.enum && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {p.enum.map((v) => (
                                                <code key={v} className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-white/60">{v}</code>
                                            ))}
                                        </div>
                                    )}
                                    {p.example !== undefined && (
                                        <div className="mt-0.5 text-white/30">
                                            e.g. <code className="text-white/50">{String(p.example)}</code>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── JSON block with copy button ───────────────────────────────────────────────
function JsonBlock({ value }: { value: unknown }) {
    const [copied, setCopied] = useState(false);
    const text = JSON.stringify(value, null, 2);

    function copy() {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0D1117]">
            <button
                onClick={copy}
                className="absolute right-2 top-2 rounded p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
                aria-label="Copy JSON"
            >
                {copied ? <Check className="h-3.5 w-3.5 text-[#1D9E75]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-white/70">
                <code>{text}</code>
            </pre>
        </div>
    );
}
