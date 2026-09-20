# 🛡️ Dead Link Insurance

> **Impact Insurance for Developer Documentation, Landing Pages, and Onboarding Funnels.**  
> Built for a 24-hour launch with the **"One Plan + Usage Cap"** business model.

Instead of generic 404 alert dumps, **Dead Link Insurance** acts as an impact-aware reliability system that:
1. **Traces root-cause AST coordinates**: Traces broken links back to the exact component string (`<DocsNav />` Line 12).
2. **Collapses layout occurrences**: Eliminates duplicate noise by collapsing shared component links across all downstream routes.
3. **Calculates Blast Radius**: Scores outages by critical path (P0 = Pricing / Auth / Onboarding, P1 = Docs, P2 = Changelogs).
4. **Auto-Remediates**: Generates ready-to-merge GitHub Pull Requests with Levenshtein sitemap replacements and Wayback Machine fallbacks.

---

## 💎 Pricing: "One Plan + Usage Cap"

| Plan Feature | Allocation |
| :--- | :--- |
| **Flat Monthly Price** | **$29 / month** |
| **Included Link Cap** | **2,500 link verifications / month** |
| **Monitored Repositories** | Up to **3 active repositories** |
| **AST Root-Cause Collapse** | Included (Unlimited) |
| **Blast Radius & Auto-PRs** | Included (Unlimited) |
| **Usage Top-Up** | **+$10 for +1,000 extra links** |

---

## 🚀 Quickstart

### 1. Run Automated Tests
```bash
bun test
```

### 2. Scan Any Documentation or Code Repository (CLI)
```bash
# Scan demo documentation fixture
bun run scan --dir ./fixtures/demo-docs --repo acme/developer-portal
```

Sample CLI Output:
```text
🚨 ACTIONABLE INCIDENTS DETECTED (2 Root Causes)

[P0 CRITICAL] /api/v2
   ├─ Source:      components/DocsNav.tsx (Line 12)
   ├─ Blast Radius: 5 live pages affected (3 critical onboarding/monetization funnels)
   ├─ Fix Ready:   fix(links): repair broken internal route /api/v2 (affects 5 pages)
   Suggested Git Patch:
     --- a/components/DocsNav.tsx
     +++ b/components/DocsNav.tsx
     @@ -12,1 +12,1 @@
     - <li><a href="/api/v2">REST API v2 Reference</a></li>
     + <li><a href="/docs/api-v3">REST API v2 Reference</a></li>
```

### 3. Launch Web Dashboard & API Server
```bash
bun start
# Opens dashboard at http://localhost:3000
```

Dashboard Features:
- **Usage Meter**: Visual progress bar tracking usage against the 2,500 link monthly cap.
- **Top-Up Simulation**: One-click instant +1,000 link purchase ($10).
- **Incident Graph**: P0/P1/P2 broken link feed with blast radius badges.
- **Remediation Drawer**: View exact git diff and open 1-click Pull Requests.

---

## 🗄️ Supabase Database Schema

To apply the schema to your Supabase instance:
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Paste and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).

Tables created:
- `repositories`: Connected GitHub repos.
- `url_targets`: Global deduplicated URL targets with verification state.
- `occurrences`: Physical AST file coordinates (`file_path`, `start_line`, `is_layout`).
- `monitored_pages`: Route paths and severity classifications.
- `page_occurrences`: Blast radius graph join table.
- `incidents`: High-signal incidents with blast radius and remediation diffs.
- `usage_tracking`: Enforces the 2,500 monthly verification cap.
