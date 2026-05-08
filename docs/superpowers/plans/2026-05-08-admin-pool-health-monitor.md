# Admin Pool Health Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only account pool health dashboard for OpenAI/Codex account groups.

**Architecture:** Use the existing admin groups and accounts APIs and aggregate pool health in a focused frontend module. Add one admin route and sidebar entry, then deploy rebuilt frontend assets through the existing static override directory.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Vitest, Tailwind CSS, existing Pixel admin API client.

---

### Task 1: Pool Health Aggregation

**Files:**
- Create: `frontend/src/views/admin/poolHealth.ts`
- Create: `frontend/src/views/admin/__tests__/poolHealth.spec.ts`

- [ ] **Step 1: Write failing aggregation tests**

Test that OpenAI accounts are grouped by admin groups, ungrouped accounts go into a synthetic pool, schedulable/rate-limited counts are derived from runtime fields, and Codex 5h/7d percentages are averaged only when snapshots exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend exec vitest run src/views/admin/__tests__/poolHealth.spec.ts`
Expected: FAIL because `poolHealth.ts` does not exist.

- [ ] **Step 3: Implement minimal aggregation helpers**

Create typed helpers that accept `AdminGroup[]` and `Account[]` and return summary cards, pool rows, selected account rows, health labels, and percentage formatting values.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend exec vitest run src/views/admin/__tests__/poolHealth.spec.ts`
Expected: PASS.

### Task 2: Admin Page

**Files:**
- Create: `frontend/src/views/admin/PoolHealthMonitorView.vue`

- [ ] **Step 1: Add the admin dashboard page**

Fetch all public OpenAI groups and all OpenAI accounts with paginated admin account API calls, aggregate with `poolHealth.ts`, show summary cards, pool cards, selected pool account table, filters, and refresh control.

- [ ] **Step 2: Run typecheck/build check**

Run: `pnpm --dir frontend run typecheck`
Expected: PASS or actionable type errors only in touched files, then fix them.

### Task 3: Navigation and Locales

**Files:**
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/components/layout/AppSidebar.vue`
- Modify: `frontend/src/i18n/locales/zh.ts`
- Modify: `frontend/src/i18n/locales/en.ts`
- Optionally modify: `frontend/src/router/README.md`

- [ ] **Step 1: Register admin route**

Add `/admin/pools/monitor` with `requiresAuth` and `requiresAdmin` metadata.

- [ ] **Step 2: Add sidebar entry**

Add an admin sidebar item near groups/accounts using the existing icon system.

- [ ] **Step 3: Add i18n strings**

Add nav label and page/table/status strings in Chinese and English.

- [ ] **Step 4: Verify route/locales compile**

Run: `pnpm --dir frontend run typecheck`
Expected: PASS.

### Task 4: Build, Commit, Deploy

**Files:**
- Generated build assets under `backend/internal/web/dist`

- [ ] **Step 1: Build frontend**

Run: `pnpm --dir frontend run build`
Expected: PASS and new dist assets generated.

- [ ] **Step 2: Commit feature**

Run:
```bash
git add frontend/src docs/superpowers/plans/2026-05-08-admin-pool-health-monitor.md
git commit -m "feat: add admin pool health monitor"
```

- [ ] **Step 3: Deploy static override assets**

Copy the new built assets to `/opt/pixel/data/public/assets` on `52.77.228.143`. Preserve the current embedded `index.html` asset names by copying the new main JS/CSS to the old deployed main JS/CSS filenames.

- [ ] **Step 4: Verify production route**

Check that `http://52.77.228.143:8080/assets/index-2vTUq-k5.js` contains `/admin/pools/monitor` and that `pixel.service` remains active.
