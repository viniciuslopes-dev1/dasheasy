# Financial Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web dashboard that imports the real Excel structure, persists normalized financial records in Supabase, and displays hierarchical financial charts.

**Architecture:** React components render a three-level dashboard. Services isolate Excel parsing, Supabase persistence, and aggregations. Utilities normalize currency, dates, text keys, and dedupe keys.

**Tech Stack:** React, TypeScript, Vite, Supabase JS, @e965/xlsx, Recharts, Vitest.

---

### Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`

- [ ] Add React + TypeScript build scripts.
- [ ] Add dependencies for Supabase, Excel parsing, charts and tests.
- [ ] Verify `npm run build` runs after implementation files exist.

### Task 2: Import Core

**Files:**
- Create: `src/types/financial.ts`
- Create: `src/utils/normalizeExcelData.ts`
- Create: `src/services/excelImportService.ts`
- Test: `src/utils/normalizeExcelData.test.ts`
- Test: `src/services/excelImportService.test.ts`

- [ ] Write failing tests for currency, text keys and block parsing.
- [ ] Implement normalizers.
- [ ] Implement workbook analysis by repeated internal headers.
- [ ] Verify tests pass.

### Task 3: Data Services

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/services/financialDataService.ts`
- Test: `src/services/financialDataService.test.ts`

- [ ] Write failing tests for aggregation by group, department and person.
- [ ] Implement local aggregation helpers.
- [ ] Implement Supabase insert/query functions.
- [ ] Verify tests pass.

### Task 4: Supabase Migration

**Files:**
- Create: `supabase/migrations/001_financial_imports.sql`

- [ ] Create `financial_imports`.
- [ ] Create `financial_records`.
- [ ] Add indexes.
- [ ] Enable RLS and policies.

### Task 5: UI

**Files:**
- Create: `src/App.tsx`
- Create: `src/components/ExcelUpload.tsx`
- Create: `src/components/dashboard/FinancialDashboard.tsx`
- Create: `src/components/dashboard/GroupingList.tsx`
- Create: `src/components/dashboard/PieChartPanel.tsx`
- Create: `src/components/dashboard/BreadcrumbNavigation.tsx`
- Create: `src/utils/formatCurrency.ts`
- Create: `src/styles.css`

- [ ] Render upload and analysis preview.
- [ ] Render empty, loading and error states.
- [ ] Render dashboard list and pie chart.
- [ ] Implement clicks and breadcrumb navigation.
- [ ] Implement search.

### Task 6: Verification

- [ ] Run unit tests.
- [ ] Run TypeScript build.
- [ ] Run local app and inspect desktop/mobile if possible.
