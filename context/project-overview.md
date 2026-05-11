# KO Broker Platform

## Overview

The KO Broker Platform is a smarter, zero-cost MVP broker platform built for UK mortgage brokerages by Luxcity Technology for KO Realtors (KO Financials). It is designed to replace fragmented tools, reduce lender search time, and provide enterprise-grade features such as AI report generation to smaller brokerages.

## Goals

1. Reduce lender search time by 30-60 minutes per case.
2. Unify fragmented compliance documents into a single, structured audit trail.
3. Bring enterprise tools (like AI report generation and automated compliance) into reach.

## Core User Flow

1. **Enquiry**: Create a new client and case.
2. **Fact-Find**: Complete a 7-step digital fact-find with auto-save and vulnerability assessment.
3. **Research**: Use built-in calculators to assess affordability, stamp duty, etc., and record considered products.
4. **DIP / ESIS**: Generate and store ESIS documents.
5. **Offer / Suitability Report**: Generate an AI-powered suitability report, review, approve, and finalise it.
6. **Completion**: Case finalized and archived.

## Features

### Client & Case Management (CRM)
- Centralized client list with search and filtering.
- Drag-and-drop Kanban pipeline and table views for cases.
- Comprehensive case detail view with 5 sub-tabs (Overview, Documents, Compliance, Messages, AI Report).

### Compliance Engine & Audit Trail
- 5-stage FCA advice workflow (Initial Disclosure -> Fact-Find -> Research -> ESIS -> Suitability Report).
- Immutable, insert-only audit log for every mutation.
- Vulnerable customer assessment scoring.

### Fact-Find Forms
- Multi-step, auto-saving data collection wizard.
- Flexible JSON schema storage.

### AI Suitability Report Generation
- Azure AI Foundry integration (GPT-4o/mini) with 8 built-in templates.
- Section-by-section regeneration and deterministic compliance checking.
- Automated branded PDF generation.

### Messages & Notifications
- Centralized 2-way messaging hub integrating emails (Resend) and SMS (Twilio).
- Automated notifications for key stage advances and report approvals.

### Calculators
- 8 reactive mortgage calculators (Affordability, Monthly payment, Stamp duty, LTV, ERC, Rental yield, Remortgage saving, Debt consolidation).

## Scope

### In Scope
- Delivery of the MVP encompassing PRD-00 to PRD-12, and PRD-14.
- This includes the landing page, CRM, compliance engine, fact-find, AI reports, messaging, calculators, billing, and settings.
- Zero-cost infrastructure scaling using Vercel, Supabase free tier, Clerk free tier, and Cloudflare R2.

### Out of Scope
- **Client Portal (Phase 2)**: Only the data structures (`portalEnabled`, `portalAccessToken`) and routing placeholders are in scope for MVP. The actual client-facing interface is out of scope (PRD-13).

## Success Criteria

1. Fully functioning end-to-end broker workflow deployed for KO Broker.
2. Vercel deployments pass all CI checks (typecheck, lint, unit tests, build).
3. The platform supports the core KO Broker team with zero data leakage across organizations.
