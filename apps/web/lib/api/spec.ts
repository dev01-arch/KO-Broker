/**
 * KO Broker API specification — used by the /api-docs page.
 * Describes every route, method, params, request body, and response shape.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type ParamIn = 'query' | 'path' | 'body';

export interface ParamDef {
    name: string;
    in: ParamIn;
    required: boolean;
    type: string;
    description: string;
    example?: string | number | boolean;
    enum?: string[];
}

export interface ResponseDef {
    status: number;
    description: string;
    example: unknown;
}

export interface EndpointDef {
    method: HttpMethod;
    path: string;
    summary: string;
    description: string;
    auth: boolean;
    tags: string[];
    params?: ParamDef[];
    responses: ResponseDef[];
}

export interface TagGroup {
    tag: string;
    color: string;
    description: string;
}

// ── Tag groups ────────────────────────────────────────────────────────────────

export const TAG_GROUPS: TagGroup[] = [
    { tag: 'Clients', color: '#1D9E75', description: 'Client records — the people the brokerage services.' },
    { tag: 'Cases', color: '#7E22CE', description: 'Cases (deals/transactions) that move through the pipeline.' },
    { tag: 'Documents', color: '#0EA5E9', description: 'File uploads (ID, income, compliance, ESIS) stored on Cloudflare R2.' },
    { tag: 'Compliance', color: '#10B981', description: 'Compliance engine stage gating and workflows.' },
    { tag: 'AI', color: '#3B82F6', description: 'AI suitability report generation, section regeneration, and approval.' },
    { tag: 'Messages', color: '#378ADD', description: 'In-app, email, and SMS message threads.' },
    { tag: 'Timeline', color: '#C2410C', description: 'Immutable audit log entries for a case.' },
    { tag: 'Billing', color: '#EC4899', description: 'Subscription plans, customer checkout, and webhook ingestion.' },
    { tag: 'Settings', color: '#F59E0B', description: 'Organization configuration and third-party integrations.' },
    { tag: 'Portal', color: '#F43F5E', description: 'Client portal onboarding, authentication, fact-find, and messaging.' },
    { tag: 'System', color: '#6B7280', description: 'Health checks and infrastructure endpoints.' },
];

// ── Endpoint definitions ──────────────────────────────────────────────────────

export const ENDPOINTS: EndpointDef[] = [
    // ── Health ──────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/health',
        summary: 'Health check',
        description: 'Returns the operational status of core services (DB, AI). Polled by uptime monitoring every 5 minutes.',
        auth: false,
        tags: ['System'],
        responses: [
            {
                status: 200,
                description: 'Service is healthy',
                example: {
                    status: 'ok',
                    timestamp: '2026-05-19T10:00:00.000Z',
                    services: { db: true, openrouter: true, openrouterModel: 'openrouter/free' },
                    version: '0.1.0',
                },
            },
        ],
    },

    // ── Clients ─────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/clients',
        summary: 'List clients',
        description: 'Returns a paginated, filterable list of clients scoped to the authenticated organisation.',
        auth: true,
        tags: ['Clients'],
        params: [
            { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number (default: 1)', example: 1 },
            { name: 'perPage', in: 'query', required: false, type: 'integer', description: 'Results per page, max 100 (default: 25)', example: 25 },
            { name: 'search', in: 'query', required: false, type: 'string', description: 'Free-text search across name, email, reference', example: 'James' },
            {
                name: 'employmentStatus',
                in: 'query',
                required: false,
                type: 'string',
                description: 'Filter by employment status',
                enum: ['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'],
            },
        ],
        responses: [
            {
                status: 200,
                description: 'Paginated client list',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'clx1abc',
                            referenceNumber: 'KOC-2026-0001',
                            firstName: 'James',
                            lastName: 'Osei',
                            email: 'james@example.com',
                            employmentStatus: 'EMPLOYED',
                            annualIncome: 65000,
                            isVulnerable: false,
                            _count: { cases: 2, messages: 5 },
                        },
                    ],
                    meta: { total: 42, page: 1, perPage: 25 },
                },
            },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/clients',
        summary: 'Create client',
        description: 'Creates a new client record. Auto-generates a KOC reference number. Writes an audit log entry.',
        auth: true,
        tags: ['Clients'],
        params: [
            { name: 'firstName', in: 'body', required: true, type: 'string', description: 'First name', example: 'James' },
            { name: 'lastName', in: 'body', required: true, type: 'string', description: 'Last name', example: 'Osei' },
            { name: 'email', in: 'body', required: true, type: 'string', description: 'Email address', example: 'james@example.com' },
            { name: 'title', in: 'body', required: false, type: 'string', description: 'Title (Mr, Mrs, Ms…)', example: 'Mr' },
            { name: 'phone', in: 'body', required: false, type: 'string', description: 'Phone number', example: '+44 7700 900000' },
            { name: 'dateOfBirth', in: 'body', required: false, type: 'string', description: 'ISO date string', example: '1985-06-15' },
            { name: 'employmentStatus', in: 'body', required: false, type: 'string', description: 'Employment status', enum: ['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'] },
            { name: 'annualIncome', in: 'body', required: false, type: 'number', description: 'Gross annual income in GBP', example: 65000 },
        ],
        responses: [
            {
                status: 201,
                description: 'Client created',
                example: { success: true, data: { id: 'clx1abc', referenceNumber: 'KOC-2026-0001', firstName: 'James', lastName: 'Osei', email: 'james@example.com' } },
            },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: { email: ['Valid email is required'] } } } },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'GET',
        path: '/api/clients/[id]',
        summary: 'Get client',
        description: 'Returns a single client record with their associated cases and message/document counts.',
        auth: true,
        tags: ['Clients'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Client CUID', example: 'clx1abc' },
        ],
        responses: [
            {
                status: 200,
                description: 'Client record with cases',
                example: {
                    success: true,
                    data: {
                        id: 'clx1abc',
                        referenceNumber: 'KOC-2026-0001',
                        firstName: 'James',
                        lastName: 'Osei',
                        email: 'james@example.com',
                        isVulnerable: false,
                        cases: [{ id: 'clf2xyz', referenceNumber: 'KOF-2026-0001', type: 'PURCHASE', stage: 'RESEARCH' }],
                        _count: { messages: 5, documents: 3 },
                    },
                },
            },
            { status: 404, description: 'Client not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } } },
        ],
    },
    {
        method: 'PATCH',
        path: '/api/clients/[id]',
        summary: 'Update client',
        description: 'Partially updates a client record. All fields are optional. Writes a diff-based audit log entry.',
        auth: true,
        tags: ['Clients'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Client CUID', example: 'clx1abc' },
            { name: 'firstName', in: 'body', required: false, type: 'string', description: 'Updated first name' },
            { name: 'lastName', in: 'body', required: false, type: 'string', description: 'Updated last name' },
            { name: 'email', in: 'body', required: false, type: 'string', description: 'Updated email' },
            { name: 'phone', in: 'body', required: false, type: 'string', description: 'Updated phone' },
            { name: 'employmentStatus', in: 'body', required: false, type: 'string', description: 'Updated employment status', enum: ['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'] },
            { name: 'annualIncome', in: 'body', required: false, type: 'number', description: 'Updated annual income' },
            { name: 'isVulnerable', in: 'body', required: false, type: 'boolean', description: 'Vulnerable customer flag' },
            { name: 'vulnerabilityNotes', in: 'body', required: false, type: 'string', description: 'Adviser notes on vulnerability' },
            { name: 'portalEnabled', in: 'body', required: false, type: 'boolean', description: 'Enable client portal access' },
        ],
        responses: [
            { status: 200, description: 'Updated client', example: { success: true, data: { id: 'clx1abc', firstName: 'James', isVulnerable: true } } },
            { status: 404, description: 'Client not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } } },
        ],
    },

    // ── Cases ────────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/cases',
        summary: 'List cases',
        description: 'Returns a paginated list of cases for the organisation. Supports filtering by stage, type, adviser, and free-text search.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: 1 },
            { name: 'perPage', in: 'query', required: false, type: 'integer', description: 'Results per page, max 100', example: 25 },
            { name: 'search', in: 'query', required: false, type: 'string', description: 'Search by reference or client name', example: 'KOF-2026' },
            { name: 'stage', in: 'query', required: false, type: 'string', description: 'Filter by pipeline stage', enum: ['ENQUIRY', 'FACT_FIND', 'RESEARCH', 'DIP', 'OFFER', 'COMPLETION', 'ARCHIVED'] },
            { name: 'type', in: 'query', required: false, type: 'string', description: 'Filter by case type', enum: ['PURCHASE', 'REMORTGAGE', 'BTL', 'FURTHER_ADVANCE', 'PRODUCT_TRANSFER'] },
            { name: 'adviserId', in: 'query', required: false, type: 'string', description: 'Filter by assigned adviser ID' },
        ],
        responses: [
            {
                status: 200,
                description: 'Paginated case list',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'clf2xyz',
                            referenceNumber: 'KOF-2026-0001',
                            type: 'PURCHASE',
                            stage: 'RESEARCH',
                            loanAmount: 280000,
                            propertyValue: 350000,
                            ltv: 80,
                            client: { id: 'clx1abc', firstName: 'James', lastName: 'Osei' },
                            adviser: { id: 'usr1', firstName: 'Sarah', lastName: 'Davies' },
                            _count: { messages: 3, documents: 2 },
                        },
                    ],
                    meta: { total: 18, page: 1, perPage: 25 },
                },
            },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/cases',
        summary: 'Create case',
        description: 'Creates a new case in ENQUIRY stage. Auto-generates a KOF reference. Validates client belongs to the same org. Calculates LTV if both loan and property values are provided.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'clientId', in: 'body', required: true, type: 'string', description: 'ID of the client this case belongs to', example: 'clx1abc' },
            { name: 'type', in: 'body', required: true, type: 'string', description: 'Case type', enum: ['PURCHASE', 'REMORTGAGE', 'BTL', 'FURTHER_ADVANCE', 'PRODUCT_TRANSFER'] },
            { name: 'propertyValue', in: 'body', required: false, type: 'number', description: 'Estimated property value in GBP', example: 350000 },
            { name: 'loanAmount', in: 'body', required: false, type: 'number', description: 'Requested loan amount in GBP', example: 280000 },
            { name: 'termYears', in: 'body', required: false, type: 'integer', description: 'Mortgage term in years', example: 25 },
        ],
        responses: [
            {
                status: 201,
                description: 'Case created',
                example: { success: true, data: { id: 'clf2xyz', referenceNumber: 'KOF-2026-0001', type: 'PURCHASE', stage: 'ENQUIRY', ltv: 80 } },
            },
            { status: 404, description: 'Client not found in org', example: { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: { clientId: ['Client is required'] } } } },
        ],
    },
    {
        method: 'GET',
        path: '/api/cases/[id]',
        summary: 'Get case',
        description: 'Returns a full case record including client, adviser, fact-find, compliance records, suitability reports, messages (last 50), documents, and products considered.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
        ],
        responses: [
            {
                status: 200,
                description: 'Full case record',
                example: {
                    success: true,
                    data: {
                        id: 'clf2xyz',
                        referenceNumber: 'KOF-2026-0001',
                        type: 'PURCHASE',
                        stage: 'RESEARCH',
                        loanAmount: 280000,
                        propertyValue: 350000,
                        ltv: 80,
                        client: { id: 'clx1abc', firstName: 'James', lastName: 'Osei', isVulnerable: false },
                        adviser: { id: 'usr1', firstName: 'Sarah', lastName: 'Davies' },
                        complianceRecords: [],
                        messages: [],
                        documents: [],
                    },
                },
            },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
        ],
    },
    {
        method: 'PATCH',
        path: '/api/cases/[id]',
        summary: 'Update case',
        description: 'Partially updates a case. Stage changes are recorded as CASE_STAGE_CHANGED in the audit log. LTV is recalculated automatically when loan or property values change.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
            { name: 'stage', in: 'body', required: false, type: 'string', description: 'New pipeline stage', enum: ['ENQUIRY', 'FACT_FIND', 'RESEARCH', 'DIP', 'OFFER', 'COMPLETION', 'ARCHIVED'] },
            { name: 'propertyValue', in: 'body', required: false, type: 'number', description: 'Updated property value' },
            { name: 'loanAmount', in: 'body', required: false, type: 'number', description: 'Updated loan amount' },
            { name: 'termYears', in: 'body', required: false, type: 'integer', description: 'Updated term in years' },
            { name: 'selectedLender', in: 'body', required: false, type: 'string', description: 'Selected lender name', example: 'Halifax' },
            { name: 'selectedProduct', in: 'body', required: false, type: 'string', description: 'Selected product name' },
            { name: 'selectedRate', in: 'body', required: false, type: 'number', description: 'Selected interest rate %', example: 4.49 },
            { name: 'selectedFee', in: 'body', required: false, type: 'number', description: 'Product fee in GBP', example: 999 },
            { name: 'adviserNotes', in: 'body', required: false, type: 'string', description: 'Free-text adviser notes' },
            { name: 'assignedAdviserId', in: 'body', required: false, type: 'string', description: 'Reassign to a different adviser' },
        ],
        responses: [
            { status: 200, description: 'Updated case', example: { success: true, data: { id: 'clf2xyz', stage: 'DIP', ltv: 80 } } },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } } },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/cases/[id]/products',
        summary: 'Sync compared products',
        description: 'Replaces the case\'s list of compared products. If one is marked as recommended (isSelected: true), it automatically synchronizes the parent Case\'s selected product details.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
            { name: 'products', in: 'body', required: true, type: 'array', description: 'List of compared products' },
        ],
        responses: [
            {
                status: 200,
                description: 'Products updated successfully',
                example: {
                    success: true,
                    data: [
                        { id: 'prod123', lenderName: 'NatWest', productName: '5yr Fixed', rate: 4.2, fee: 0, isSelected: true },
                        { id: 'prod456', lenderName: 'Halifax', productName: '2yr Fixed', rate: 4.5, fee: 999, isSelected: false }
                    ]
                }
            },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } } },
        ],
    },

    // ── Timeline ─────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/cases/[id]/timeline',
        summary: 'Case timeline',
        description: 'Returns all AuditLog entries for a case and its client, ordered chronologically. Entries with notificationSent: true indicate a client notification was triggered.',
        auth: true,
        tags: ['Timeline'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
        ],
        responses: [
            {
                status: 200,
                description: 'Chronological audit entries',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'aud1',
                            entityType: 'Case',
                            entityId: 'clf2xyz',
                            action: 'CASE_CREATED',
                            diff: { after: { stage: 'ENQUIRY' } },
                            notificationSent: false,
                            createdAt: '2026-05-01T09:00:00.000Z',
                            user: { firstName: 'Sarah', lastName: 'Davies' },
                        },
                        {
                            id: 'aud2',
                            entityType: 'Case',
                            entityId: 'clf2xyz',
                            action: 'CASE_STAGE_CHANGED',
                            diff: { stage: { before: 'ENQUIRY', after: 'FACT_FIND' } },
                            notificationSent: true,
                            createdAt: '2026-05-03T14:22:00.000Z',
                            user: { firstName: 'Sarah', lastName: 'Davies' },
                        },
                    ],
                    meta: { total: 2, page: 1, perPage: 2 },
                },
            },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
        ],
    },

    // ── Messages ─────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/messages',
        summary: 'List messages',
        description: 'Returns paginated messages for the organisation. Filter by caseId or clientId to get a specific thread.',
        auth: true,
        tags: ['Messages'],
        params: [
            { name: 'page', in: 'query', required: false, type: 'integer', description: 'Page number', example: 1 },
            { name: 'perPage', in: 'query', required: false, type: 'integer', description: 'Results per page', example: 25 },
            { name: 'caseId', in: 'query', required: false, type: 'string', description: 'Filter to a specific case thread', example: 'clf2xyz' },
            { name: 'clientId', in: 'query', required: false, type: 'string', description: 'Filter to a specific client thread', example: 'clx1abc' },
        ],
        responses: [
            {
                status: 200,
                description: 'Paginated message list',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'msg1',
                            direction: 'OUTBOUND',
                            channel: 'EMAIL',
                            sourceType: 'CASE_UPDATE',
                            body: 'Your application has moved to the Research stage.',
                            isRead: true,
                            createdAt: '2026-05-03T14:22:00.000Z',
                        },
                    ],
                    meta: { total: 1, page: 1, perPage: 25 },
                },
            },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/messages',
        summary: 'Send message',
        description: 'Creates a new outbound message. Writes an audit log entry when caseId is provided.',
        auth: true,
        tags: ['Messages'],
        params: [
            { name: 'body', in: 'body', required: true, type: 'string', description: 'Message body text', example: 'Your mortgage offer has been received.' },
            { name: 'caseId', in: 'body', required: false, type: 'string', description: 'Associate with a case', example: 'clf2xyz' },
            { name: 'clientId', in: 'body', required: false, type: 'string', description: 'Associate with a client', example: 'clx1abc' },
            { name: 'channel', in: 'body', required: false, type: 'string', description: 'Delivery channel (default: IN_APP)', enum: ['EMAIL', 'SMS', 'IN_APP'] },
            { name: 'sourceType', in: 'body', required: false, type: 'string', description: 'Message source (default: CASE_UPDATE)', enum: ['CASE_UPDATE', 'COMPLIANCE', 'AI_REPORT', 'CLIENT_REPLY', 'SYSTEM'] },
            { name: 'subject', in: 'body', required: false, type: 'string', description: 'Email subject line', example: 'Mortgage offer received' },
        ],
        responses: [
            { status: 201, description: 'Message created', example: { success: true, data: { id: 'msg2', direction: 'OUTBOUND', channel: 'IN_APP', body: 'Your mortgage offer has been received.' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', fields: { body: ['Message body is required'] } } } },
        ],
    },
    {
        method: 'PATCH',
        path: '/api/messages/[id]',
        summary: 'Mark message read',
        description: 'Updates the isRead flag on a message. Used to clear unread badges in the UI.',
        auth: true,
        tags: ['Messages'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Message CUID', example: 'msg1' },
            { name: 'isRead', in: 'body', required: true, type: 'boolean', description: 'Read state to set', example: true },
        ],
        responses: [
            { status: 200, description: 'Updated message', example: { success: true, data: { id: 'msg1', isRead: true } } },
            { status: 404, description: 'Message not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } } },
        ],
    },
    // ── Documents ────────────────────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/documents',
        summary: 'List documents',
        description: 'Returns a paginated list of documents scoped to the org. Filter by caseId, clientId, or documentType. Used by the Documents tab on the case detail view.',
        auth: true,
        tags: ['Documents'],
        params: [
            { name: 'page',         in: 'query', required: false, type: 'integer', description: 'Page number (default: 1)',              example: 1 },
            { name: 'perPage',      in: 'query', required: false, type: 'integer', description: 'Results per page, max 100 (default: 25)', example: 25 },
            { name: 'caseId',       in: 'query', required: false, type: 'string',  description: 'Filter to a specific case',             example: 'clf2xyz' },
            { name: 'clientId',     in: 'query', required: false, type: 'string',  description: 'Filter to a specific client',           example: 'clx1abc' },
            { name: 'documentType', in: 'query', required: false, type: 'string',  description: 'Filter by document type', enum: ['ID', 'INCOME', 'FINANCIAL', 'LENDER', 'COMPLIANCE', 'OTHER'] },
        ],
        responses: [
            {
                status: 200,
                description: 'Paginated document list',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'doc1abc',
                            name: 'ESIS_Document.pdf',
                            documentType: 'COMPLIANCE',
                            mimeType: 'application/pdf',
                            sizeBytes: 204800,
                            storageUrl: 'https://storage.koplatform.co.uk/documents/...',
                            uploadedBy: 'usr1',
                            createdAt: '2026-05-10T11:00:00.000Z',
                            case: { id: 'clf2xyz', referenceNumber: 'KOF-2026-0001' },
                        },
                    ],
                    meta: { total: 3, page: 1, perPage: 25 },
                },
            },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/documents',
        summary: 'Upload document',
        description: 'Uploads a file to Cloudflare R2 and creates a Document record. Accepts multipart/form-data. The documentType and name fields control compliance gate satisfaction: uploading a COMPLIANCE document with a name containing "ESIS" satisfies the ESIS checklist gate; uploading any COMPLIANCE document satisfies the INITIAL_DISCLOSURE gate.',
        auth: true,
        tags: ['Documents'],
        params: [
            { name: 'file',         in: 'body', required: true,  type: 'file',    description: 'The file to upload. Max 50 MB. Accepted: PDF, Word, Excel, images, plain text.' },
            { name: 'name',         in: 'body', required: true,  type: 'string',  description: 'Display name for the document',                     example: 'ESIS_Document.pdf' },
            { name: 'documentType', in: 'body', required: false, type: 'string',  description: 'Document category (default: OTHER)', enum: ['ID', 'INCOME', 'FINANCIAL', 'LENDER', 'COMPLIANCE', 'OTHER'] },
            { name: 'caseId',       in: 'body', required: false, type: 'string',  description: 'Associate with a case (caseId or clientId required)', example: 'clf2xyz' },
            { name: 'clientId',     in: 'body', required: false, type: 'string',  description: 'Associate with a client',                           example: 'clx1abc' },
        ],
        responses: [
            {
                status: 201,
                description: 'Document uploaded and record created',
                example: {
                    success: true,
                    data: {
                        id: 'doc1abc',
                        name: 'ESIS_Document.pdf',
                        documentType: 'COMPLIANCE',
                        mimeType: 'application/pdf',
                        sizeBytes: 204800,
                        storageUrl: 'https://storage.koplatform.co.uk/documents/...',
                        caseId: 'clf2xyz',
                        clientId: null,
                        uploadedBy: 'usr1',
                        createdAt: '2026-05-10T11:00:00.000Z',
                    },
                },
            },
            { status: 422, description: 'Validation error (missing name, bad type, no caseId/clientId, file too large)', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Document name is required', fields: { name: ['Document name is required'] } } } },
            { status: 404, description: 'Case or client not found in org', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
        ],
    },
    {
        method: 'GET',
        path: '/api/documents/[id]',
        summary: 'Get document',
        description: 'Returns a single document record. Refreshes the R2 pre-signed URL so the returned storageUrl is always valid for at least 7 days from the time of this request.',
        auth: true,
        tags: ['Documents'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Document CUID', example: 'doc1abc' },
        ],
        responses: [
            {
                status: 200,
                description: 'Document record with fresh signed URL',
                example: {
                    success: true,
                    data: {
                        id: 'doc1abc',
                        name: 'ESIS_Document.pdf',
                        documentType: 'COMPLIANCE',
                        storageUrl: 'https://r2.cloudflarestorage.com/...?X-Amz-Expires=604800&...',
                        case: { id: 'clf2xyz', referenceNumber: 'KOF-2026-0001' },
                    },
                },
            },
            { status: 404, description: 'Document not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } } },
        ],
    },
    {
        method: 'DELETE',
        path: '/api/documents/[id]',
        summary: 'Delete document',
        description: 'Removes the Document record from the database and writes an audit log entry. The R2 object is intentionally retained for compliance audit purposes — it is not purged from storage.',
        auth: true,
        tags: ['Documents'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Document CUID', example: 'doc1abc' },
        ],
        responses: [
            { status: 200, description: 'Document record deleted', example: { success: true, data: { id: 'doc1abc' } } },
            { status: 404, description: 'Document not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } } },
        ],
    },

    // ── Compliance ────────────────────────────────────────────────────────────────
    {
        method: 'POST',
        path: '/api/compliance/advance',
        summary: 'Advance case stage',
        description: 'Attempts to advance a case to the next compliance stage. Performs strict linear stage transitions and runs mandatory gate checks (e.g. initial disclosures, DIP document containing ESIS, suitability report finalized). Updates Case and creates a ComplianceRecord in a transaction, creates system notifications, and sends email/SMS client updates.',
        auth: true,
        tags: ['Compliance'],
        params: [
            { name: 'caseId', in: 'body', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
            { name: 'targetStage', in: 'body', required: true, type: 'string', description: 'Compliance stage to advance to', enum: ['FACT_FIND', 'RESEARCH', 'ESIS', 'SUITABILITY_REPORT', 'COMPLETION'] },
        ],
        responses: [
            { status: 200, description: 'Case advanced successfully', example: { success: true, data: { id: 'clf2xyz', stage: 'FACT_FIND' } } },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
            { status: 422, description: 'Business rule violation / Checklist validation failed', example: { success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Compliance checklist verification failed for current stage.', details: ['A document of type COMPLIANCE is required to complete INITIAL_DISCLOSURE stage.'] } } },
        ],
    },

    // ── Fact-Find ───────────────────────────────────────────────────────────────
    {
        method: 'PUT',
        path: '/api/cases/[id]/fact-find',
        summary: 'Upsert fact-find',
        description: 'Upserts the FactFind record associated with the case. Performs step 7 vulnerability calculations on the fly to flag vulnerable clients.',
        auth: true,
        tags: ['Cases'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
            { name: 'personalDetails', in: 'body', required: false, type: 'object', description: 'Step 1 personal details block' },
            { name: 'employmentDetails', in: 'body', required: false, type: 'object', description: 'Step 2 employment details block' },
            { name: 'incomeDetails', in: 'body', required: false, type: 'object', description: 'Step 3 income details block' },
            { name: 'expenditureDetails', in: 'body', required: false, type: 'object', description: 'Step 4 expenditure details block' },
            { name: 'propertyDetails', in: 'body', required: false, type: 'object', description: 'Step 5 property details block' },
            { name: 'existingMortgages', in: 'body', required: false, type: 'object', description: 'Step 6 existing mortgages block' },
            { name: 'clientPreferences', in: 'body', required: false, type: 'object', description: 'Step 7 preferences & vulnerability answers block' },
            { name: 'markComplete', in: 'body', required: false, type: 'boolean', description: 'Mark fact-find complete' },
        ],
        responses: [
            { status: 200, description: 'Fact-find upserted', example: { success: true, data: { factFind: { id: 'ff1', caseId: 'clf2xyz' }, client: { id: 'clx1abc', isVulnerable: false } } } },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
        ],
    },

    // ── AI Suitability Reports ──────────────────────────────────────────────────
    {
        method: 'POST',
        path: '/api/ai/generate-report',
        summary: 'Generate AI report',
        description: 'Generates a new AI suitability report for a case. Validates preconditions (fact-find complete, product selected, ≥3 products considered), constructs the prompt, calls OpenRouter, and stores the report as DRAFT.',
        auth: true,
        tags: ['AI'],
        params: [
            { name: 'caseId', in: 'body', required: true, type: 'string', description: 'Case CUID', example: 'clf2xyz' },
            { name: 'templateType', in: 'body', required: true, type: 'string', description: 'Report template type', enum: ['BTL', 'FTB', 'REMORTGAGE', 'HOME_MOVER', 'PRODUCT_TRANSFER', 'DIVORCE', 'SELF_EMPLOYED', 'VULNERABLE_OVERLAY'] },
        ],
        responses: [
            {
                status: 201,
                description: 'Report draft created',
                example: {
                    success: true,
                    data: {
                        id: 'rep123',
                        caseId: 'clf2xyz',
                        templateType: 'BTL',
                        status: 'DRAFT',
                        sections: [
                            {
                                id: 'client-introduction',
                                title: 'Client Introduction',
                                content: 'Sophie Williams (reference KOC-1003) is a contractor with an annual income of £80,000...',
                                complianceFlag: 'REVIEW_REQUIRED',
                                flagReason: 'Missing address, date of birth, and telephone number.'
                            },
                            {
                                id: 'product-research-recommendation',
                                title: 'Product Research & Recommendation',
                                content: 'Three products were reviewed: Halifax 2-year fixed at 4.5% (no fee), Natwest 5-year fixed at 4.2%...',
                                complianceFlag: 'OK',
                                flagReason: null
                            }
                        ],
                        pdfUrl: null,
                        generatedBy: 'usr1abc',
                        approvedBy: null,
                        createdAt: '2026-07-10T09:00:00.000Z',
                        updatedAt: '2026-07-10T09:00:00.000Z'
                    }
                }
            },
            { status: 422, description: 'Precondition check failed', example: { success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Fact-find must be completed before generating a report.' } } },
            { status: 503, description: 'AI service unavailable', example: { success: false, error: { code: 'INTERNAL_ERROR', message: 'OpenRouter is not configured.' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/ai/regenerate-section',
        summary: 'Regenerate report section',
        description: 'Regenerates a single section of an existing suitability report. Replaces only the target section; all other sections remain unchanged. Resets the section\'s complianceFlag to REVIEW_REQUIRED.',
        auth: true,
        tags: ['AI'],
        params: [
            { name: 'reportId', in: 'body', required: true, type: 'string', description: 'Report CUID', example: 'rep123' },
            { name: 'sectionId', in: 'body', required: true, type: 'string', description: 'Section CUID', example: 'sec456' },
            { name: 'adviserContext', in: 'body', required: false, type: 'string', description: 'Adviser guidelines or context for regeneration', example: 'Emphasize the client\'s deposit source' },
        ],
        responses: [
            {
                status: 200,
                description: 'Section regenerated',
                example: {
                    success: true,
                    data: {
                        id: 'rep123',
                        caseId: 'clf2xyz',
                        templateType: 'BTL',
                        status: 'DRAFT',
                        sections: [
                            {
                                id: 'client-introduction',
                                title: 'Client Introduction',
                                content: 'Sophie Williams is a contractor with an annual income of £80,000, preferring weekly email updates...',
                                complianceFlag: 'REVIEW_REQUIRED',
                                flagReason: 'Regenerated — requires adviser review before finalisation.'
                            },
                            {
                                id: 'product-research-recommendation',
                                title: 'Product Research & Recommendation',
                                content: 'Three products were reviewed: Halifax 2-year fixed at 4.5% (no fee), Natwest 5-year fixed at 4.2%...',
                                complianceFlag: 'OK',
                                flagReason: null
                            }
                        ],
                        pdfUrl: null,
                        generatedBy: 'usr1abc',
                        approvedBy: null,
                        createdAt: '2026-07-10T09:00:00.000Z',
                        updatedAt: '2026-07-10T09:02:00.000Z'
                    }
                }
            },
            { status: 404, description: 'Report or section not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/ai/reports/[id]/approve',
        summary: 'Approve & finalise report',
        description: 'Runs pre-finalisation compliance checks (deterministic layout check, Consumer Duty phrase check, placeholder checks), sets report status to FINALISED, generates and uploads the PDF report, and triggers client notifications.',
        auth: true,
        tags: ['AI'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Report CUID', example: 'rep123' },
        ],
        responses: [
            { status: 200, description: 'Report finalised and notifications sent', example: { success: true, data: { id: 'rep123', status: 'FINALISED', pdfUrl: 'https://...' } } },
            { status: 422, description: 'Compliance check failed', example: { success: false, error: { code: 'BUSINESS_RULE_VIOLATION', message: 'Pre-finalisation compliance checks failed.', details: ['Required section [Mortgage Details] is missing.'] } } },
        ],
    },

    // ── Billing & Subscriptions ─────────────────────────────────────────────────
    {
        method: 'POST',
        path: '/api/billing/checkout',
        summary: 'Create Checkout Session',
        description: 'Creates a Stripe Checkout Session for upgrading an organization\'s plan to PROFESSIONAL or ENTERPRISE.',
        auth: true,
        tags: ['Billing'],
        params: [
            { name: 'plan', in: 'body', required: true, type: 'string', description: 'Subscription plan tier', enum: ['PROFESSIONAL', 'ENTERPRISE'] },
        ],
        responses: [
            { status: 200, description: 'Session created successfully', example: { success: true, data: { url: 'https://checkout.stripe.com/...' } } },
        ],
    },

    // ── Settings & Integrations ─────────────────────────────────────────────────
    {
        method: 'GET',
        path: '/api/settings/integrations',
        summary: 'Get integrations keys',
        description: 'Fetches third-party integration settings (Equifax, Twilio) with sensitive API keys masked.',
        auth: true,
        tags: ['Settings'],
        responses: [
            { status: 200, description: 'Settings fetched successfully', example: { success: true, data: { equifax: { apiKey: 'sk_eq••••••••1234', enabled: true }, twilio: { accountSid: 'AC...', authToken: '••••••••', enabled: false } } } },
        ],
    },
    {
        method: 'PUT',
        path: '/api/settings/integrations',
        summary: 'Update integrations keys',
        description: 'Updates third-party integration settings. Enforces ADMIN role. Preserves existing secrets if they are passed back masked.',
        auth: true,
        tags: ['Settings'],
        params: [
            { name: 'equifax', in: 'body', required: false, type: 'object', description: 'Equifax configuration' },
            { name: 'twilio', in: 'body', required: false, type: 'object', description: 'Twilio configuration' },
        ],
        responses: [
            { status: 200, description: 'Settings updated successfully', example: { success: true, message: 'Integration settings updated successfully' } },
        ],
    },
    {
        method: 'GET',
        path: '/api/settings/advisers',
        summary: 'List advisers',
        description: 'Returns a list of all advisers in the organisation. Enforces ADMIN role.',
        auth: true,
        tags: ['Settings'],
        responses: [
            {
                status: 200,
                description: 'Advisers list',
                example: {
                    success: true,
                    data: [
                        {
                            id: 'usr_adviser1',
                            email: 'jane.smith@example.com',
                            firstName: 'Jane',
                            lastName: 'Smith',
                            role: 'ADVISER',
                            isActive: true,
                            invitePending: false,
                            inviteTokenExpiry: null,
                            canViewAllClients: false,
                            canViewAccountDetails: false,
                            canViewAiSummaries: false,
                            createdAt: '2026-07-17T10:00:00.000Z'
                        }
                    ]
                }
            },
            { status: 401, description: 'Not authenticated', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in' } } },
            { status: 403, description: 'Forbidden - ADMIN required', example: { success: false, error: { code: 'FORBIDDEN', message: 'Admin role is required' } } }
        ]
    },
    {
        method: 'POST',
        path: '/api/settings/advisers',
        summary: 'Invite adviser',
        description: 'Creates a pending adviser shell record, generates a 48h invite token, and sends an invite email. Enforces ADMIN role.',
        auth: true,
        tags: ['Settings'],
        params: [
            { name: 'email', in: 'body', required: true, type: 'string', description: 'Adviser email address', example: 'jane.smith@example.com' },
            { name: 'firstName', in: 'body', required: true, type: 'string', description: 'First name', example: 'Jane' },
            { name: 'lastName', in: 'body', required: true, type: 'string', description: 'Last name', example: 'Smith' },
            { name: 'canViewAllClients', in: 'body', required: false, type: 'boolean', description: 'Permission to view all clients (default: false)', example: false },
            { name: 'canViewAccountDetails', in: 'body', required: false, type: 'boolean', description: 'Permission to view full financial account details (default: false)', example: false },
            { name: 'canViewAiSummaries', in: 'body', required: false, type: 'boolean', description: 'Permission to view AI reports (default: false)', example: false }
        ],
        responses: [
            {
                status: 201,
                description: 'Adviser invited',
                example: {
                    success: true,
                    data: {
                        id: 'usr_adviser1',
                        email: 'jane.smith@example.com'
                    }
                }
            },
            { status: 409, description: 'Conflict - Adviser already exists', example: { success: false, error: { code: 'CONFLICT', message: 'An adviser with this email already exists in your organisation.' } } },
            { status: 422, description: 'Validation error', example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } } }
        ]
    },
    {
        method: 'PATCH',
        path: '/api/settings/advisers/[id]',
        summary: 'Update adviser visibility/status',
        description: 'Updates an adviser\'s status (active/inactive) or visibility permission flags. Enforces ADMIN role.',
        auth: true,
        tags: ['Settings'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Adviser user CUID', example: 'usr_adviser1' },
            { name: 'isActive', in: 'body', required: false, type: 'boolean', description: 'Adviser active status', example: true },
            { name: 'canViewAllClients', in: 'body', required: false, type: 'boolean', description: 'Permission to view all clients', example: true },
            { name: 'canViewAccountDetails', in: 'body', required: false, type: 'boolean', description: 'Permission to view account details', example: true },
            { name: 'canViewAiSummaries', in: 'body', required: false, type: 'boolean', description: 'Permission to view AI summaries', example: true }
        ],
        responses: [
            {
                status: 200,
                description: 'Adviser updated',
                example: {
                    success: true,
                    data: {
                        id: 'usr_adviser1',
                        email: 'jane.smith@example.com',
                        isActive: true,
                        canViewAllClients: true,
                        canViewAccountDetails: true,
                        canViewAiSummaries: true
                    }
                }
            },
            { status: 404, description: 'Adviser not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } } }
        ]
    },
    {
        method: 'DELETE',
        path: '/api/settings/advisers/[id]',
        summary: 'Delete adviser',
        description: 'Permanently deletes an adviser record. Adviser must be deactivated first. Enforces ADMIN role.',
        auth: true,
        tags: ['Settings'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Adviser user CUID', example: 'usr_adviser1' }
        ],
        responses: [
            {
                status: 200,
                description: 'Adviser deleted',
                example: {
                    success: true,
                    message: 'Adviser permanently deleted.'
                }
            },
            { status: 409, description: 'Conflict - Adviser is active', example: { success: false, error: { code: 'CONFLICT', message: 'Adviser must be deactivated before deletion. Deactivate them first.' } } },
            { status: 404, description: 'Adviser not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } } }
        ]
    },
    {
        method: 'POST',
        path: '/api/settings/advisers/[id]/resend-invite',
        summary: 'Resend invite',
        description: 'Regenerates a 48h invite token and resends the invitation email to a pending adviser. Enforces ADMIN role.',
        auth: true,
        tags: ['Settings'],
        params: [
            { name: 'id', in: 'path', required: true, type: 'string', description: 'Adviser user CUID', example: 'usr_adviser1' }
        ],
        responses: [
            {
                status: 200,
                description: 'Invite resent',
                example: {
                    success: true,
                    message: 'Invite resent successfully.'
                }
            },
            { status: 404, description: 'Pending adviser not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Pending adviser not found.' } } }
        ]
    },
    {
        method: 'POST',
        path: '/api/advisers/accept-invite',
        summary: 'Accept adviser invite',
        description: 'Accepts an adviser invitation link. Validates token expiry, links the Clerk user ID, and activates the adviser user. Bypasses standard auth wrapper so a user mid sign-up can accept.',
        auth: false,
        tags: ['Settings'],
        params: [
            { name: 'token', in: 'body', required: true, type: 'string', description: 'Secret invite token', example: 'invite_token_hex' }
        ],
        responses: [
            {
                status: 200,
                description: 'Invite accepted successfully',
                example: {
                    success: true,
                    message: 'Invite accepted. Welcome to KO Broker.'
                }
            },
            { status: 400, description: 'Invalid, used, or expired token', example: { success: false, error: { code: 'INVALID_TOKEN', message: 'Invite link is invalid or has already been used.' } } },
            { status: 401, description: 'Missing user ID header', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in to accept an invite.' } } }
        ]
    },

    // ── Webhooks & System Integrations ──────────────────────────────────────────
    {
        method: 'POST',
        path: '/api/webhooks/email',
        summary: 'Email webhook receiver',
        description: 'Handles inbound email webhooks. Verifies signature via Svix (if secret configured) or API secret key, resolves client by sender email, and creates an INBOUND Message record linked to the case timeline.',
        auth: false,
        tags: ['System'],
        params: [
            { name: 'from', in: 'body', required: true, type: 'object', description: 'Sender details' },
            { name: 'to', in: 'body', required: true, type: 'array', description: 'Recipient list' },
            { name: 'subject', in: 'body', required: true, type: 'string', description: 'Email subject' },
            { name: 'text', in: 'body', required: false, type: 'string', description: 'Email plaintext body' },
        ],
        responses: [
            { status: 201, description: 'Inbound message logged', example: { success: true, messageId: 'msgInbound123' } },
        ],
    },
    {
        method: 'POST',
        path: '/api/webhooks/stripe',
        summary: 'Stripe webhook receiver',
        description: 'Ingests Stripe subscription events (checkout.session.completed, customer.subscription.updated/deleted) to update the organization\'s subscription plan tier in real-time.',
        auth: false,
        tags: ['System'],
        responses: [
            { status: 200, description: 'Webhook processed successfully', example: { received: true } },
        ],
    },
    {
        method: 'POST',
        path: '/api/webhooks/clerk',
        summary: 'Clerk webhook receiver',
        description: 'Ingests Clerk authentication events (user.created, organization.created, organizationMembership.created) to sync users, organizations, and memberships with the local database.',
        auth: false,
        tags: ['System'],
        responses: [
            { status: 200, description: 'Webhook processed successfully', example: { success: true } },
        ],
    },
    // ── Client Portal ───────────────────────────────────────────────────────────
    {
        method: 'POST',
        path: '/api/portal/invite',
        summary: 'Invite client to portal',
        description: 'Generates a secure single-use portalAccessToken for the client, initializes the FactFind JSON structure with pre-populated client details, and sends onboarding links via Resend (email) and Twilio (SMS).',
        auth: true,
        tags: ['Portal'],
        params: [
            { name: 'caseId', in: 'body', required: true, type: 'string', description: 'Case ID CUID', example: 'clf2xyz' },
        ],
        responses: [
            { status: 201, description: 'Portal invite generated and notifications sent', example: { success: true, message: 'Onboarding invitation sent successfully.' } },
            { status: 404, description: 'Case not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/verify-token',
        summary: 'Verify portal setup token',
        description: 'Checks if a magic link portalAccessToken is valid and returns basic client metadata to prompt account setup.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'token', in: 'body', required: true, type: 'string', description: 'Secret magic token', example: 'd3b07384...' },
        ],
        responses: [
            { status: 200, description: 'Token is valid', example: { success: true, data: { email: 'james@example.com', firstName: 'James', lastName: 'Osei' } } },
            { status: 404, description: 'Invalid or expired token', example: { success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired setup token' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/setup',
        summary: 'Setup client account',
        description: 'Consumes the portalAccessToken, sets the password, and creates the authenticated client session cookie.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'token', in: 'body', required: true, type: 'string', description: 'Setup token', example: 'd3b07384...' },
            { name: 'password', in: 'body', required: true, type: 'string', description: 'New password for the client portal', example: 'P@ssword123!' },
        ],
        responses: [
            { status: 200, description: 'Client portal account configured successfully', example: { success: true, message: 'Account configured successfully.' } },
            { status: 404, description: 'Token not found', example: { success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired setup token' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/login',
        summary: 'Client portal login',
        description: 'Authenticates a client using email and password, returning a secure client_session JWT cookie.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'email', in: 'body', required: true, type: 'string', description: 'Client email address', example: 'james@example.com' },
            { name: 'password', in: 'body', required: true, type: 'string', description: 'Client password', example: 'P@ssword123!' },
        ],
        responses: [
            { status: 200, description: 'Login successful', example: { success: true, data: { id: 'clx1abc', email: 'james@example.com' } } },
            { status: 401, description: 'Invalid credentials', example: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/logout',
        summary: 'Client portal logout',
        description: 'Clears the client_session cookie to end the session.',
        auth: false,
        tags: ['Portal'],
        responses: [
            { status: 200, description: 'Logged out successfully', example: { success: true } },
        ],
    },
    {
        method: 'GET',
        path: '/api/portal/fact-find',
        summary: 'Get client fact-find',
        description: 'Fetches the current case FactFind JSON questionnaire. Authenticates via client_session cookie.',
        auth: false,
        tags: ['Portal'],
        responses: [
            { status: 200, description: 'Fact-find record returned', example: { success: true, data: { personalDetails: {}, employmentDetails: {}, completedAt: null } } },
        ],
    },
    {
        method: 'PUT',
        path: '/api/portal/fact-find',
        summary: 'Update client fact-find',
        description: 'Updates sections of the FactFind. Fails with 403 Forbidden if marked completed.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'personalDetails', in: 'body', required: false, type: 'object', description: 'Step 1 personal details block' },
            { name: 'employmentDetails', in: 'body', required: false, type: 'object', description: 'Step 2 employment details block' },
            { name: 'incomeDetails', in: 'body', required: false, type: 'object', description: 'Step 3 income details block' },
            { name: 'expenditureDetails', in: 'body', required: false, type: 'object', description: 'Step 4 expenditure details block' },
            { name: 'propertyDetails', in: 'body', required: false, type: 'object', description: 'Step 5 property details block' },
            { name: 'existingMortgages', in: 'body', required: false, type: 'object', description: 'Step 6 existing mortgages block' },
            { name: 'clientPreferences', in: 'body', required: false, type: 'object', description: 'Step 7 preferences & vulnerability answers block' },
        ],
        responses: [
            { status: 200, description: 'Fact-find updated successfully', example: { success: true, data: { id: 'ff123', completedAt: null } } },
            { status: 403, description: 'Fact-find is completed and locked', example: { success: false, error: { code: 'FORBIDDEN', message: 'This fact-find is already complete and cannot be edited.' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/fact-find/complete',
        summary: 'Complete client fact-find',
        description: 'Marks FactFind completedAt to lock editing, runs vulnerability scoring, logs a completed audit trail event, and alerts the broker via Resend email and in-app thread update.',
        auth: false,
        tags: ['Portal'],
        responses: [
            { status: 200, description: 'Fact-find complete status locked', example: { success: true, data: { completedAt: '2026-06-26T12:00:00Z' } } },
        ],
    },
    {
        method: 'GET',
        path: '/api/portal/messages',
        summary: 'Get client messages',
        description: 'Fetches the in-app 2-way conversation thread between client and broker. Authenticates via client_session cookie.',
        auth: false,
        tags: ['Portal'],
        responses: [
            { status: 200, description: 'List of messages in chronological order', example: { success: true, data: [{ direction: 'INBOUND', body: 'Hello adviser' }] } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/messages',
        summary: 'Send client message',
        description: 'Sends a message to the adviser. Creates an INBOUND Message record in the database.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'body', in: 'body', required: true, type: 'string', description: 'Message body text', example: 'I have uploaded my proof of address.' },
        ],
        responses: [
            { status: 201, description: 'Message sent', example: { success: true, data: { id: 'msg999', direction: 'INBOUND', body: 'I have uploaded my proof of address.' } } },
        ],
    },
    {
        method: 'POST',
        path: '/api/portal/documents',
        summary: 'Client upload document',
        description: 'Uploads verification documents (ID, Income proof, etc.) to Cloudflare R2 and links them to the client record. Authenticates via client_session cookie.',
        auth: false,
        tags: ['Portal'],
        params: [
            { name: 'file', in: 'body', required: true, type: 'file', description: 'File to upload (max 50 MB)' },
            { name: 'name', in: 'body', required: true, type: 'string', description: 'Display name', example: 'Passport.pdf' },
            { name: 'documentType', in: 'body', required: true, type: 'string', description: 'Document type', enum: ['ID', 'INCOME', 'FINANCIAL', 'OTHER'] },
        ],
        responses: [
            { status: 201, description: 'File uploaded and logged in Case documents', example: { success: true, data: { id: 'doc999', name: 'Passport.pdf', storageUrl: 'https://...' } } },
        ],
    },
];
