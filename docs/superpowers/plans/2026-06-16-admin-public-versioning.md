# Admin Public Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split DashEasy into a public read-only dashboard and a protected admin area that imports, publishes, and republishes versioned financial datasets.

**Architecture:** Keep the current dashboard components as the shared visualization layer. Add a Supabase-backed version service that reads the published version for `/` and lets authenticated admins create draft versions, publish one active version, and republish historic versions from `/admin`.

**Tech Stack:** React, TypeScript, Vite, Supabase Auth, Supabase Postgres/RLS, Vitest.

---

### Task 1: Version Model And Tests

**Files:**
- Modify: `src/types/financial.ts`
- Create: `src/services/dashboardVersionService.test.ts`
- Modify: `src/services/financialDataService.ts`

- [ ] Add dashboard version types for `draft`, `published`, and `archived`.
- [ ] Write tests that prove records are mapped from Supabase rows, latest published data loads, and publish/republication delegates to RPC safely.
- [ ] Run `npm test src/services/dashboardVersionService.test.ts` and verify it fails before implementation.

### Task 2: Supabase Version Service

**Files:**
- Create: `src/services/dashboardVersionService.ts`
- Modify: `src/services/financialDataService.ts`
- Modify: `src/components/ExcelUpload.tsx`

- [ ] Implement loading published/admin versions and records from Supabase.
- [ ] Change import confirmation to save a draft dashboard version.
- [ ] Keep local-only fallback when Supabase is not configured.

### Task 3: Database Migration

**Files:**
- Create: `supabase/migrations/002_dashboard_versions.sql`
- Modify: `docs/DATABASE_DESIGN.md`
- Modify: `docs/SECURITY_CHECKLIST.md`

- [ ] Add `dashboard_versions`.
- [ ] Add `version_id` to `financial_imports` and `financial_records`.
- [ ] Add publication RPC `publish_dashboard_version`.
- [ ] Add RLS where public users only select the published version and authenticated users can manage versions.

### Task 4: Public/Admin UI Split

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/admin/AdminDashboard.tsx`
- Create: `src/components/admin/AdminLogin.tsx`
- Create: `src/components/admin/VersionHistory.tsx`
- Modify: `src/styles.css`

- [ ] Route `/` to public visualization without import controls.
- [ ] Route `/admin` to authenticated admin controls.
- [ ] Add email/password login, logout, import drawer, publish button, and version history with republish action.
- [ ] Load saved dashboard data when the app opens.

### Task 5: Verification

**Files:**
- Modify tests where needed.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Verify `/` hides import/admin controls.
- [ ] Verify `/admin` shows login when signed out.
- [ ] Verify the public dashboard can render saved records from the service mapping.
