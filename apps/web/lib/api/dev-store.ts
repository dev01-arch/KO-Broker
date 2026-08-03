import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { generateReference } from '@ko/utils';
import type {
  CaseStage,
  CaseType,
  ClientStatus,
  ClientType,
  DocumentType,
  EmploymentStatus,
  MessageChannel,
  MessageDirection,
  MessageSource,
  ReportStatus,
  ReportTemplate,
  UpsertFactFindInput,
  CreateProductConsideredInput,
  UpdateProductConsideredInput,
} from '@ko/types';
import { calculateLTV } from '@ko/utils';

type DevUser = {
  id: string;
  clerkId: string;
  orgId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type DevOrg = {
  id: string;
  name: string;
  slug: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
};

type DevClient = {
  id: string;
  orgId: string;
  referenceNumber: string;
  clientType: ClientType;
  companyName?: string;
  companyNumber?: string;
  title?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  employmentStatus: EmploymentStatus;
  annualIncome?: number;
  isReferred?: boolean;
  referredToCompany?: string;
  assignedMemberId?: string;
  status?: ClientStatus;
  insurerName?: string;
  isVulnerable: boolean;
  portalEnabled: boolean;
  createdAt: string;
};

type DevCase = {
  id: string;
  orgId: string;
  clientId: string;
  referenceNumber: string;
  type: CaseType;
  stage: CaseStage;
  propertyValue?: number;
  loanAmount?: number;
  ltv?: number;
  termYears?: number;
  selectedLender?: string;
  selectedProduct?: string;
  selectedRate?: number;
  selectedFee?: number;
  adviserNotes?: string;
  assignedAdviserId?: string;
  createdAt: string;
  updatedAt: string;
};

type DevFactFind = {
  id: string;
  caseId: string;
  personalDetails?: Record<string, unknown>;
  employmentDetails?: Record<string, unknown>;
  incomeDetails?: Record<string, unknown>;
  expenditureDetails?: Record<string, unknown>;
  propertyDetails?: Record<string, unknown>;
  existingMortgages?: Record<string, unknown>;
  clientPreferences?: Record<string, unknown>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type DevProductConsidered = {
  id: string;
  orgId: string;
  caseId: string;
  lenderName: string;
  productName: string;
  rate?: number;
  fee?: number;
  isSelected: boolean;
  reasonNotSelected?: string;
  createdAt: string;
};

type DevDocument = {
  id: string;
  orgId: string;
  caseId?: string;
  clientId?: string;
  name: string;
  documentType: DocumentType;
  storageUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  createdAt: string;
};

type DevMessage = {
  id: string;
  orgId: string;
  caseId?: string;
  clientId?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  sourceType: MessageSource;
  subject?: string;
  body: string;
  isRead: boolean;
  threadId?: string;
  createdAt: string;
};

type DevAiReport = {
  id: string;
  orgId: string;
  caseId: string;
  templateType: ReportTemplate;
  status: ReportStatus;
  sections?: Record<string, unknown> | unknown[];
  pdfUrl?: string;
  generatedBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type DevAuditLog = {
  id: string;
  orgId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown>;
  createdAt: string;
};

type DevOrgSettings = {
  orgId: string;
  integrations?: {
    equifax?: { apiKey?: string; enabled?: boolean };
    twilio?: { accountSid?: string; authToken?: string; enabled?: boolean };
  };
  messaging?: {
    inApp?: { enabled?: boolean };
    email?: { enabled?: boolean };
    sms?: { enabled?: boolean };
  };
};

type DevOrganisationMember = {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'ADVISER' | 'COMPLIANCE' | 'VIEWER';
  isActive: boolean;
  createdAt: string;
};

type DevStore = {
  orgs: DevOrg[];
  users: DevUser[];
  members: DevOrganisationMember[];
  clients: DevClient[];
  cases: DevCase[];
  factFinds: DevFactFind[];
  products: DevProductConsidered[];
  documents: DevDocument[];
  messages: DevMessage[];
  aiReports: DevAiReport[];
  auditLogs: DevAuditLog[];
  orgSettings: DevOrgSettings[];
};

const STORE_PATH = path.join(process.cwd(), '.data', 'local-api-store.json');

function emptyStore(): DevStore {
  return {
    orgs: [],
    users: [],
    members: [],
    clients: [],
    cases: [],
    factFinds: [],
    products: [],
    documents: [],
    messages: [],
    aiReports: [],
    auditLogs: [],
    orgSettings: [],
  };
}

function loadStore(): DevStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return emptyStore();
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as DevStore;
    return {
      orgs: parsed.orgs ?? [],
      users: parsed.users ?? [],
      members: parsed.members ?? [],
      clients: parsed.clients ?? [],
      cases: parsed.cases ?? [],
      factFinds: parsed.factFinds ?? [],
      products: parsed.products ?? [],
      documents: parsed.documents ?? [],
      messages: parsed.messages ?? [],
      aiReports: parsed.aiReports ?? [],
      auditLogs: parsed.auditLogs ?? [],
      orgSettings: parsed.orgSettings ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(store: DevStore) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function mutateStore<T>(fn: (store: DevStore) => T): T {
  const store = loadStore();
  const result = fn(store);
  saveStore(store);
  return result;
}

export const devStore = {
  findUserByClerkId(clerkId: string) {
    return loadStore().users.find((user) => user.clerkId === clerkId) ?? null;
  },

  ensureUser(input: {
    clerkId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    orgName: string;
    slug: string;
  }) {
    return mutateStore((store) => {
      const existing = store.users.find((user) => user.clerkId === input.clerkId);
      if (existing) return existing;

      const org: DevOrg = {
        id: randomUUID(),
        name: input.orgName,
        slug: input.slug,
        plan: 'STARTER',
      };
      const user: DevUser = {
        id: randomUUID(),
        clerkId: input.clerkId,
        orgId: org.id,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'ADMIN',
      };
      store.orgs.push(org);
      store.users.push(user);
      store.members.push({
        id: randomUUID(),
        orgId: org.id,
        email: user.email.toLowerCase(),
        firstName: user.firstName?.trim() || 'Admin',
        lastName: user.lastName?.trim() || 'User',
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      return user;
    });
  },

  listClients(orgId: string, params: {
    page: number;
    perPage: number;
    search?: string;
    employmentStatus?: EmploymentStatus;
    clientType?: ClientType;
    isReferred?: boolean;
    clientCategory?: 'REFERRAL' | 'INDIVIDUAL' | 'COMPANY';
    status?: ClientStatus;
    assignedMemberId?: string;
  }) {
    const store = loadStore();
    let clients = store.clients.filter((client) => client.orgId === orgId);

    if (params.clientCategory === 'REFERRAL') {
      clients = clients.filter((client) => client.isReferred === true);
    } else if (params.clientCategory === 'INDIVIDUAL') {
      clients = clients.filter(
        (client) => (client.clientType ?? 'INDIVIDUAL') === 'INDIVIDUAL' && !client.isReferred,
      );
    } else if (params.clientCategory === 'COMPANY') {
      clients = clients.filter((client) => client.clientType === 'COMPANY');
    }

    if (params.employmentStatus) {
      clients = clients.filter((client) => client.employmentStatus === params.employmentStatus);
    }

    if (params.clientType && !params.clientCategory) {
      clients = clients.filter((client) => (client.clientType ?? 'INDIVIDUAL') === params.clientType);
    }

    if (params.isReferred !== undefined && !params.clientCategory) {
      clients = clients.filter((client) => (client.isReferred ?? false) === params.isReferred);
    }

    if (params.status) {
      clients = clients.filter((client) => (client.status ?? 'PROSPECT') === params.status);
    }

    if (params.assignedMemberId) {
      clients = clients.filter((client) => client.assignedMemberId === params.assignedMemberId);
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      clients = clients.filter((client) => {
        const haystack = [
          client.firstName,
          client.lastName,
          client.companyName,
          client.email,
          client.referenceNumber,
          client.referredToCompany,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    clients.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = clients.length;
    const start = (params.page - 1) * params.perPage;
    const pageItems = clients.slice(start, start + params.perPage);

    return {
      total,
      clients: pageItems.map((client) => ({
        ...client,
        clientType: client.clientType ?? 'INDIVIDUAL',
        status: client.status ?? 'PROSPECT',
        assignedMember: client.assignedMemberId
          ? store.members.find(
              (member) =>
                member.orgId === orgId && member.id === client.assignedMemberId,
            ) ?? null
          : null,
        _count: { cases: 0, messages: 0 },
      })),
    };
  },

  createClient(orgId: string, input: {
    clientType?: ClientType;
    title?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    companyNumber?: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    employmentStatus?: EmploymentStatus;
    annualIncome?: number;
    isReferred?: boolean;
    referredToCompany?: string;
    assignedMemberId?: string;
    insurerName?: string;
  }) {
    const clientType = input.clientType ?? 'INDIVIDUAL';
    const isCompany = clientType === 'COMPANY';
    const companyName = input.companyName?.trim();
    const firstName = isCompany ? companyName! : input.firstName!.trim();
    const lastName = isCompany ? '—' : input.lastName!.trim();
    const isReferred = !isCompany && input.isReferred === true;
    const referredToCompany = isReferred ? input.referredToCompany?.trim() : undefined;
    const insurerName =
      !isCompany && !isReferred && input.insurerName?.trim()
        ? input.insurerName.trim()
        : undefined;

    return mutateStore((store) => {
      const year = new Date().getFullYear();
      const prefix = `KOC-${year}-`;
      const yearRefs = store.clients
        .filter((client) => client.orgId === orgId && client.referenceNumber.startsWith(prefix))
        .map((client) => Number.parseInt(client.referenceNumber.slice(prefix.length), 10))
        .filter((n) => Number.isFinite(n));
      const sequence = yearRefs.length > 0 ? Math.max(...yearRefs) + 1 : 1;
      const client: DevClient = {
        id: randomUUID(),
        orgId,
        referenceNumber: generateReference('KOC', sequence),
        clientType,
        companyName: isCompany ? companyName : undefined,
        companyNumber: isCompany ? input.companyNumber?.trim() || undefined : undefined,
        title: isCompany ? undefined : input.title,
        firstName,
        lastName,
        email: input.email,
        phone: input.phone,
        dateOfBirth: isCompany ? undefined : input.dateOfBirth,
        employmentStatus: input.employmentStatus ?? 'EMPLOYED',
        annualIncome: input.annualIncome,
        isReferred,
        referredToCompany,
        assignedMemberId: input.assignedMemberId,
        insurerName: input.insurerName,
        status: 'PROSPECT',
        isVulnerable: false,
        portalEnabled: false,
        createdAt: new Date().toISOString(),
      };
      store.clients.push(client);
      return client;
    });
  },

  getClient(orgId: string, id: string) {
    const client = loadStore().clients.find(
      (item) => item.orgId === orgId && item.id === id,
    );
    if (!client) return null;
    return {
      ...client,
      cases: [],
      _count: { messages: 0, documents: 0 },
    };
  },

  updateClient(orgId: string, id: string, input: Record<string, unknown>) {
    return mutateStore((store) => {
      const index = store.clients.findIndex(
        (item) => item.orgId === orgId && item.id === id,
      );
      if (index < 0) return null;
      const current = store.clients[index];
      const next = {
        ...current,
        ...input,
      } as DevClient;
      store.clients[index] = next;
      return {
        id: next.id,
        firstName: next.firstName,
        isVulnerable: next.isVulnerable,
      };
    });
  },

  deleteClient(orgId: string, id: string) {
    return mutateStore((store) => {
      const client = store.clients.find((item) => item.orgId === orgId && item.id === id);
      if (!client) return { error: 'NOT_FOUND' as const };

      const caseIds = store.cases
        .filter((item) => item.orgId === orgId && item.clientId === id)
        .map((item) => item.id);

      store.factFinds = store.factFinds.filter((item) => !caseIds.includes(item.caseId));
      store.cases = store.cases.filter((item) => !caseIds.includes(item.id));
      store.messages = store.messages.filter(
        (item) => item.orgId !== orgId || (item.clientId !== id && !caseIds.includes(item.caseId ?? '')),
      );
      store.documents = store.documents.filter(
        (item) => item.orgId !== orgId || (item.clientId !== id && !caseIds.includes(item.caseId ?? '')),
      );
      store.aiReports = store.aiReports.filter((item) => !caseIds.includes(item.caseId));
      store.clients = store.clients.filter((item) => !(item.orgId === orgId && item.id === id));

      return { deleted: true as const };
    });
  },

  listCases(
    orgId: string,
    params: {
      page: number;
      perPage: number;
      search?: string;
      stage?: CaseStage;
      type?: CaseType;
      clientId?: string;
    },
  ) {
    const store = loadStore();
    let cases = store.cases.filter((item) => item.orgId === orgId);

    if (params.stage) cases = cases.filter((item) => item.stage === params.stage);
    if (params.type) cases = cases.filter((item) => item.type === params.type);
    if (params.clientId) cases = cases.filter((item) => item.clientId === params.clientId);

    if (params.search) {
      const q = params.search.toLowerCase();
      cases = cases.filter((item) => {
        const client = store.clients.find((c) => c.id === item.clientId);
        const haystack = [
          item.referenceNumber,
          client?.firstName,
          client?.lastName,
          client?.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    cases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = cases.length;
    const pageItems = cases.slice(
      (params.page - 1) * params.perPage,
      params.page * params.perPage,
    );

    return {
      total,
      cases: pageItems.map((item) => {
        const client = store.clients.find((c) => c.id === item.clientId)!;
        return {
          ...item,
          updatedAt: new Date(item.updatedAt),
          client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
          },
          adviser: null,
          _count: { messages: 0, documents: 0 },
        };
      }),
    };
  },

  createCase(
    orgId: string,
    input: {
      clientId: string;
      type: CaseType;
      propertyValue?: number;
      loanAmount?: number;
      termYears?: number;
    },
  ) {
    return mutateStore((store) => {
      const client = store.clients.find(
        (item) => item.orgId === orgId && item.id === input.clientId,
      );
      if (!client) return { error: 'NOT_FOUND' as const };

      const year = new Date().getFullYear();
      const count = store.cases.filter(
        (item) => item.orgId === orgId && item.createdAt.startsWith(String(year)),
      ).length;
      const now = new Date().toISOString();
      const ltv =
        input.propertyValue && input.loanAmount
          ? calculateLTV(input.loanAmount, input.propertyValue)
          : undefined;
      const created: DevCase = {
        id: randomUUID(),
        orgId,
        clientId: input.clientId,
        referenceNumber: generateReference('KOF', count + 1),
        type: input.type,
        stage: 'ENQUIRY',
        propertyValue: input.propertyValue,
        loanAmount: input.loanAmount,
        ltv,
        termYears: input.termYears,
        createdAt: now,
        updatedAt: now,
      };
      store.cases.push(created);
      return {
        case: {
          ...created,
          updatedAt: new Date(created.updatedAt),
          client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
          },
          adviser: null,
          _count: { messages: 0, documents: 0 },
        },
      };
    });
  },

  getCase(orgId: string, id: string) {
    const store = loadStore();
    const item = store.cases.find((c) => c.orgId === orgId && c.id === id);
    if (!item) return null;
    const client = store.clients.find((c) => c.id === item.clientId);
    if (!client) return null;
    const factFind = store.factFinds.find((f) => f.caseId === item.id) ?? null;
    const products = (store.products ?? []).filter((p) => p.caseId === item.id);
    return {
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      client: {
        id: client.id,
        referenceNumber: client.referenceNumber,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        employmentStatus: client.employmentStatus,
      },
      adviser: null,
      factFind: factFind
        ? {
            ...factFind,
            completedAt: factFind.completedAt ? new Date(factFind.completedAt) : null,
            createdAt: new Date(factFind.createdAt),
            updatedAt: new Date(factFind.updatedAt),
          }
        : null,
      productsConsidered: products.map((p) => ({
        id: p.id,
        caseId: p.caseId,
        lenderName: p.lenderName,
        productName: p.productName,
        rate: p.rate,
        fee: p.fee,
        isSelected: p.isSelected,
        reasonNotSelected: p.reasonNotSelected,
        createdAt: new Date(p.createdAt),
      })),
      _count: { messages: 0, documents: 0 },
    };
  },

  updateCase(
    orgId: string,
    id: string,
    input: {
      stage?: CaseStage;
      propertyValue?: number;
      loanAmount?: number;
      termYears?: number;
      selectedLender?: string;
      selectedProduct?: string;
      selectedRate?: number;
      selectedFee?: number;
      adviserNotes?: string;
      assignedAdviserId?: string | null;
    },
  ) {
    return mutateStore((store) => {
      const index = store.cases.findIndex((item) => item.orgId === orgId && item.id === id);
      if (index < 0) return { error: 'NOT_FOUND' as const };

      const current = store.cases[index];
      const propertyValue = input.propertyValue ?? current.propertyValue;
      const loanAmount = input.loanAmount ?? current.loanAmount;
      const ltv =
        propertyValue && loanAmount ? calculateLTV(loanAmount, propertyValue) : current.ltv;

      const next: DevCase = {
        ...current,
        ...input,
        assignedAdviserId: input.assignedAdviserId ?? current.assignedAdviserId,
        ltv,
        updatedAt: new Date().toISOString(),
      };
      store.cases[index] = next;

      const client = store.clients.find((c) => c.id === next.clientId)!;
      return {
        case: {
          ...next,
          updatedAt: new Date(next.updatedAt),
          client: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
          },
          adviser: null,
          _count: { messages: 0, documents: 0 },
        },
      };
    });
  },

  upsertFactFind(orgId: string, caseId: string, input: UpsertFactFindInput) {
    return mutateStore((store) => {
      const existingCase = store.cases.find((item) => item.orgId === orgId && item.id === caseId);
      if (!existingCase) return { error: 'NOT_FOUND' as const };

      const { markComplete, ...sections } = input;
      const now = new Date().toISOString();
      const index = store.factFinds.findIndex((item) => item.caseId === caseId);

      if (index < 0) {
        const created: DevFactFind = {
          id: randomUUID(),
          caseId,
          ...sections,
          completedAt: markComplete ? now : undefined,
          createdAt: now,
          updatedAt: now,
        };
        store.factFinds.push(created);
        return {
          factFind: {
            ...created,
            completedAt: created.completedAt ? new Date(created.completedAt) : null,
            createdAt: new Date(created.createdAt),
            updatedAt: new Date(created.updatedAt),
          },
        };
      }

      const current = store.factFinds[index];
      const updated: DevFactFind = {
        ...current,
        ...sections,
        completedAt: markComplete ? now : current.completedAt,
        updatedAt: now,
      };
      store.factFinds[index] = updated;
      return {
        factFind: {
          ...updated,
          completedAt: updated.completedAt ? new Date(updated.completedAt) : null,
          createdAt: new Date(updated.createdAt),
          updatedAt: new Date(updated.updatedAt),
        },
      };
    });
  },

  // ── Products considered (RESEARCH) ─────────────────────────────────────────

  listProducts(orgId: string, caseId: string) {
    const store = loadStore();
    const caseRecord = store.cases.find((c) => c.orgId === orgId && c.id === caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };
    const products = (store.products ?? [])
      .filter((p) => p.caseId === caseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt),
      }));
    return { products };
  },

  createProduct(orgId: string, caseId: string, input: CreateProductConsideredInput) {
    return mutateStore((store) => {
      if (!store.products) store.products = [];
      const caseIndex = store.cases.findIndex((c) => c.orgId === orgId && c.id === caseId);
      if (caseIndex < 0) return { error: 'NOT_FOUND' as const };

      if (input.isSelected) {
        store.products = store.products.map((p) =>
          p.caseId === caseId ? { ...p, isSelected: false } : p,
        );
      }

      const product: DevProductConsidered = {
        id: randomUUID(),
        orgId,
        caseId,
        lenderName: input.lenderName,
        productName: input.productName,
        rate: input.rate,
        fee: input.fee,
        isSelected: input.isSelected ?? false,
        reasonNotSelected: input.reasonNotSelected,
        createdAt: new Date().toISOString(),
      };
      store.products.push(product);

      if (product.isSelected) {
        store.cases[caseIndex] = {
          ...store.cases[caseIndex],
          selectedLender: product.lenderName,
          selectedProduct: product.productName,
          selectedRate: product.rate,
          selectedFee: product.fee,
          updatedAt: new Date().toISOString(),
        };
      }

      return { product: { ...product, createdAt: new Date(product.createdAt) } };
    });
  },

  updateProduct(
    orgId: string,
    caseId: string,
    productId: string,
    input: UpdateProductConsideredInput,
  ) {
    return mutateStore((store) => {
      if (!store.products) store.products = [];
      const caseIndex = store.cases.findIndex((c) => c.orgId === orgId && c.id === caseId);
      if (caseIndex < 0) return { error: 'NOT_FOUND' as const };

      const index = store.products.findIndex(
        (p) => p.orgId === orgId && p.caseId === caseId && p.id === productId,
      );
      if (index < 0) return { error: 'NOT_FOUND' as const, message: 'Product not found' };

      const existing = store.products[index];
      if (input.isSelected === true) {
        store.products = store.products.map((p) =>
          p.caseId === caseId && p.id !== productId ? { ...p, isSelected: false } : p,
        );
      }

      const updated: DevProductConsidered = {
        ...existing,
        lenderName: input.lenderName ?? existing.lenderName,
        productName: input.productName ?? existing.productName,
        rate: input.rate === undefined ? existing.rate : (input.rate ?? undefined),
        fee: input.fee === undefined ? existing.fee : (input.fee ?? undefined),
        isSelected: input.isSelected ?? existing.isSelected,
        reasonNotSelected:
          input.reasonNotSelected === undefined
            ? existing.reasonNotSelected
            : (input.reasonNotSelected ?? undefined),
      };
      store.products[index] = updated;

      if (updated.isSelected) {
        store.cases[caseIndex] = {
          ...store.cases[caseIndex],
          selectedLender: updated.lenderName,
          selectedProduct: updated.productName,
          selectedRate: updated.rate,
          selectedFee: updated.fee,
          updatedAt: new Date().toISOString(),
        };
      } else if (existing.isSelected && input.isSelected === false) {
        store.cases[caseIndex] = {
          ...store.cases[caseIndex],
          selectedLender: undefined,
          selectedProduct: undefined,
          selectedRate: undefined,
          selectedFee: undefined,
          updatedAt: new Date().toISOString(),
        };
      }

      return { product: { ...updated, createdAt: new Date(updated.createdAt) } };
    });
  },

  deleteProduct(orgId: string, caseId: string, productId: string) {
    return mutateStore((store) => {
      if (!store.products) store.products = [];
      const caseIndex = store.cases.findIndex((c) => c.orgId === orgId && c.id === caseId);
      if (caseIndex < 0) return { error: 'NOT_FOUND' as const };

      const index = store.products.findIndex(
        (p) => p.orgId === orgId && p.caseId === caseId && p.id === productId,
      );
      if (index < 0) return { error: 'NOT_FOUND' as const, message: 'Product not found' };

      const [removed] = store.products.splice(index, 1);
      if (removed.isSelected) {
        store.cases[caseIndex] = {
          ...store.cases[caseIndex],
          selectedLender: undefined,
          selectedProduct: undefined,
          selectedRate: undefined,
          selectedFee: undefined,
          updatedAt: new Date().toISOString(),
        };
      }
      return { ok: true as const };
    });
  },

  // ── Documents ──────────────────────────────────────────────────────────────

  listDocuments(
    orgId: string,
    params: { page: number; perPage: number; caseId?: string; clientId?: string; documentType?: DocumentType },
  ) {
    const store = loadStore();
    let docs = store.documents.filter((d) => d.orgId === orgId);
    if (params.caseId) docs = docs.filter((d) => d.caseId === params.caseId);
    if (params.clientId) docs = docs.filter((d) => d.clientId === params.clientId);
    if (params.documentType) docs = docs.filter((d) => d.documentType === params.documentType);
    docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = docs.length;
    return {
      total,
      documents: docs.slice((params.page - 1) * params.perPage, params.page * params.perPage),
    };
  },

  createDocument(
    orgId: string,
    input: {
      name: string;
      documentType: DocumentType;
      caseId?: string;
      clientId?: string;
      storageUrl: string;
      mimeType?: string;
      sizeBytes?: number;
      uploadedBy?: string;
    },
  ) {
    return mutateStore((store) => {
      const doc: DevDocument = {
        id: randomUUID(),
        orgId,
        ...input,
        createdAt: new Date().toISOString(),
      };
      store.documents.push(doc);
      return doc;
    });
  },

  getDocument(orgId: string, id: string) {
    return loadStore().documents.find((d) => d.orgId === orgId && d.id === id) ?? null;
  },

  deleteDocument(orgId: string, id: string) {
    return mutateStore((store) => {
      const index = store.documents.findIndex((d) => d.orgId === orgId && d.id === id);
      if (index < 0) return false;
      store.documents.splice(index, 1);
      return true;
    });
  },

  // ── Messages ───────────────────────────────────────────────────────────────

  listMessages(
    orgId: string,
    params: {
      page: number;
      perPage: number;
      caseId?: string;
      clientId?: string;
      unreadOnly?: boolean;
    },
  ) {
    const store = loadStore();
    let msgs = store.messages.filter((m) => m.orgId === orgId);
    if (params.caseId) msgs = msgs.filter((m) => m.caseId === params.caseId);
    if (params.clientId) msgs = msgs.filter((m) => m.clientId === params.clientId);
    if (params.unreadOnly) msgs = msgs.filter((m) => !m.isRead);
    msgs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = msgs.length;
    return {
      total,
      messages: msgs.slice((params.page - 1) * params.perPage, params.page * params.perPage),
    };
  },

  createMessage(
    orgId: string,
    input: {
      body: string;
      channel: MessageChannel;
      direction: MessageDirection;
      sourceType: MessageSource;
      subject?: string;
      caseId?: string;
      clientId?: string;
      threadId?: string;
    },
  ) {
    return mutateStore((store) => {
      const msg: DevMessage = {
        id: randomUUID(),
        orgId,
        isRead: false,
        ...input,
        createdAt: new Date().toISOString(),
      };
      store.messages.push(msg);
      return msg;
    });
  },

  markMessageRead(orgId: string, id: string, isRead = true) {
    return mutateStore((store) => {
      const index = store.messages.findIndex((m) => m.orgId === orgId && m.id === id);
      if (index < 0) return null;
      store.messages[index] = { ...store.messages[index], isRead };
      return store.messages[index];
    });
  },

  // ── AI Reports ─────────────────────────────────────────────────────────────

  listAiReports(orgId: string, params: { page: number; perPage: number; caseId?: string }) {
    const store = loadStore();
    let reports = store.aiReports.filter((r) => r.orgId === orgId);
    if (params.caseId) reports = reports.filter((r) => r.caseId === params.caseId);
    reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = reports.length;
    return {
      total,
      reports: reports.slice((params.page - 1) * params.perPage, params.page * params.perPage),
    };
  },

  createAiReport(
    orgId: string,
    input: { caseId: string; templateType: ReportTemplate; generatedBy?: string },
  ) {
    return mutateStore((store) => {
      const caseRecord = store.cases.find((c) => c.orgId === orgId && c.id === input.caseId);
      if (!caseRecord) return { error: 'NOT_FOUND' as const };

      const now = new Date().toISOString();
      const report: DevAiReport = {
        id: randomUUID(),
        orgId,
        caseId: input.caseId,
        templateType: input.templateType,
        status: 'DRAFT',
        sections: [
          {
            id: 'client-introduction',
            title: 'Client Introduction',
            content:
              'Client objectives, income, and risk profile documented during the digital fact-find. Consumer Duty outcomes considered.',
            complianceFlag: 'REVIEW_REQUIRED',
            flagReason: 'Dev-store draft — requires adviser review.',
          },
          {
            id: 'property-details',
            title: 'Property Details',
            content:
              'Subject property details, valuation, and loan-to-value documented for this case. Fair value assessment recorded.',
            complianceFlag: 'OK',
            flagReason: null,
          },
          {
            id: 'product-research-recommendation',
            title: 'Product Research & Recommendation',
            content:
              'Products considered and recommendation rationale recorded with Consumer Duty evidencing.',
            complianceFlag: 'OK',
            flagReason: null,
          },
          {
            id: 'risks-consumer-duty',
            title: 'Risks & Consumer Duty',
            content:
              'Consumer Duty risks communicated; fair value assessment and personalised outcomes recorded.',
            complianceFlag: 'OK',
            flagReason: null,
          },
        ],
        generatedBy: input.generatedBy,
        createdAt: now,
        updatedAt: now,
      };
      store.aiReports.push(report);
      return { report };
    });
  },

  getAiReport(orgId: string, id: string) {
    return loadStore().aiReports.find((r) => r.orgId === orgId && r.id === id) ?? null;
  },

  updateAiReportSection(
    orgId: string,
    reportId: string,
    sectionKey: string,
    content: string,
  ) {
    return mutateStore((store) => {
      const index = store.aiReports.findIndex((r) => r.orgId === orgId && r.id === reportId);
      if (index < 0) return null;
      const current = store.aiReports[index];
      const currentSections = current.sections;
      let nextSections: Record<string, unknown> | unknown[];

      if (Array.isArray(currentSections)) {
        const found = currentSections.some(
          (s) => typeof s === 'object' && s !== null && (s as { id?: string }).id === sectionKey,
        );
        nextSections = found
          ? currentSections.map((s) => {
              if (typeof s !== 'object' || s === null || (s as { id?: string }).id !== sectionKey) {
                return s;
              }
              return {
                ...s,
                content,
                complianceFlag: 'REVIEW_REQUIRED',
                flagReason: 'Regenerated — requires adviser review before finalisation.',
              };
            })
          : [
              ...currentSections,
              {
                id: sectionKey,
                title: sectionKey,
                content,
                complianceFlag: 'REVIEW_REQUIRED',
                flagReason: 'Regenerated — requires adviser review before finalisation.',
              },
            ];
      } else {
        nextSections = { ...(currentSections ?? {}), [sectionKey]: content };
      }

      store.aiReports[index] = {
        ...current,
        sections: nextSections,
        updatedAt: new Date().toISOString(),
      };
      return store.aiReports[index];
    });
  },

  approveAiReport(orgId: string, id: string, approvedBy?: string) {
    return mutateStore((store) => {
      const index = store.aiReports.findIndex((r) => r.orgId === orgId && r.id === id);
      if (index < 0) return null;
      store.aiReports[index] = {
        ...store.aiReports[index],
        status: 'FINALISED',
        approvedBy,
        updatedAt: new Date().toISOString(),
      };
      return store.aiReports[index];
    });
  },

  // ── Audit Log / Timeline ───────────────────────────────────────────────────

  addAuditLog(entry: Omit<DevAuditLog, 'id' | 'createdAt'>) {
    return mutateStore((store) => {
      const log: DevAuditLog = {
        id: randomUUID(),
        ...entry,
        createdAt: new Date().toISOString(),
      };
      store.auditLogs.push(log);
      return log;
    });
  },

  listTimeline(orgId: string, entityId: string, params: { page: number; perPage: number }) {
    const store = loadStore();
    const logs = store.auditLogs.filter(
      (l) => l.orgId === orgId && l.entityId === entityId,
    );
    logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = logs.length;
    return {
      total,
      entries: logs.slice((params.page - 1) * params.perPage, params.page * params.perPage),
    };
  },

  // ── Org Settings ───────────────────────────────────────────────────────────

  getOrg(orgId: string): DevOrg | undefined {
    return loadStore().orgs.find((o) => o.id === orgId);
  },

  getOrgSettings(orgId: string): DevOrgSettings {
    return loadStore().orgSettings.find((s) => s.orgId === orgId) ?? { orgId };
  },

  listAdvisers(orgId: string) {
    const store = loadStore();
    return store.members
      .filter((member) => member.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((member) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
        isActive: member.isActive,
        createdAt: member.createdAt,
      }));
  },

  listAdvisersForAssignment(orgId: string) {
    return mutateStore((store) => {
      const advisers = store.members
        .filter((member) => member.orgId === orgId && member.role !== 'ADMIN')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const admins = store.users.filter((user) => user.orgId === orgId && user.role === 'ADMIN');
      for (const admin of admins) {
        const email = admin.email.toLowerCase();
        let member = store.members.find(
          (row) => row.orgId === orgId && row.email.toLowerCase() === email,
        );
        if (!member) {
          member = {
            id: randomUUID(),
            orgId,
            email,
            firstName: admin.firstName?.trim() || 'Admin',
            lastName: admin.lastName?.trim() || 'User',
            role: 'ADMIN',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          store.members.push(member);
        }
      }

      const adminMembers = store.members.filter(
        (member) => member.orgId === orgId && member.role === 'ADMIN' && member.isActive,
      );
      const byEmail = new Map<string, DevOrganisationMember>();
      for (const member of [...advisers, ...adminMembers]) {
        byEmail.set(member.email.toLowerCase(), member);
      }

      return Array.from(byEmail.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((member) => ({
          id: member.id,
          email: member.email,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
          isActive: member.isActive,
          invitePending: false,
          inviteTokenExpiry: null as string | null,
          canViewAllClients: member.role === 'ADMIN',
          canViewAccountDetails: member.role === 'ADMIN',
          canViewAiSummaries: member.role === 'ADMIN',
          createdAt: member.createdAt,
          memberId: member.id,
        }));
    });
  },

  getMember(orgId: string, memberId: string) {
    return (
      loadStore().members.find(
        (member) => member.orgId === orgId && member.id === memberId,
      ) ?? null
    );
  },

  createAdviser(orgId: string, input: { firstName: string; lastName: string; email: string }) {
    return mutateStore((store) => {
      const email = input.email.toLowerCase();
      const duplicate = store.members.some(
        (member) => member.orgId === orgId && member.email === email,
      );
      if (duplicate) {
        throw new Error('MEMBER_EMAIL_EXISTS');
      }

      const member: DevOrganisationMember = {
        id: randomUUID(),
        orgId,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'ADVISER',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      store.members.push(member);
      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        isActive: member.isActive,
        createdAt: member.createdAt,
      };
    });
  },

  updateOrgSettings(orgId: string, input: Partial<Omit<DevOrgSettings, 'orgId'>>) {
    return mutateStore((store) => {
      const index = store.orgSettings.findIndex((s) => s.orgId === orgId);
      if (index < 0) {
        const settings: DevOrgSettings = { orgId, ...input };
        store.orgSettings.push(settings);
        return settings;
      }
      store.orgSettings[index] = { ...store.orgSettings[index], ...input };
      return store.orgSettings[index];
    });
  },
};
