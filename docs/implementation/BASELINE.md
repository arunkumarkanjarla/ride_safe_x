# RideNova — Phase 0 Baseline Audit

**Audit date:** 2026-10-19  
**Repository root (verified):** `D:\git\ride_safe_x`  
**Git:** branch `develop` @ `9234416` (`origin/develop`), working tree clean  
**Remote:** `https://github.com/arunkumarkanjarla/ride_safe_x.git`  
**Product names:** workspace `ride_safe_x` · UI brand **RideNova**

---

## 1. What the repository actually contains

| Area | Present? | Location / notes |
|---|---|---|
| Static multi-app prototype | **Yes** | `static application/` (entire product UI today) |
| Backend (FastAPI / Python app) | **No** | — |
| Mobile (React Native / Expo) | **No** | — |
| Web portal (React / Vite) | **No** | Admin + agent are vanilla JS SPAs |
| Docker Compose / infrastructure | **No** | Docker Desktop installed; no project compose |
| Shared packages / monorepo tooling | **No** | No root `package.json`, no `pnpm`/`npm` workspaces |
| Database migrations | **No** | Empty DB `ride_safe_x` only |
| CI workflows | **No** | No `.github/workflows` in this repo |
| BMAD installed in this repo | **No** | BMAD lives in sibling workspace `D:\git\bmad_project` |
| Root `.gitignore` | **No** | Must be added in Phase 1 |

### Current top-level layout

```
ride_safe_x/
  README.md                 # Paths assume content at repo root (stale after move)
  static application/       # All application + docs + tests
    customer-app/           # Rider SPA (~60 screens, 19 JS)
    driver-app/             # Driver SPA (~29 screens, 13 JS)
    patner-app/             # Partner SPA (~11 screens; folder typo preserved)
    admin/                  # Ops SPA + control.html (24 JS)
    agent-portal/           # Support agent desktop SPA (7 JS)
    shared/                 # RNPC platform config/ops (localStorage)
    connected-demo/         # Multi-app same-origin demo hub
    architecture-workflow/  # Wireframes (~182 HTML), generator, older tests
    docs/                   # Prior audit/certification for static phase
    docs-analysis/          # 8 CDP browser suites + crawls
```

There is **no** `apps/`, `backend/`, `packages/`, `workers/`, `ai_service/`, or `infrastructure/` yet.

---

## 2. Environment verified on this machine

| Tool | Result |
|---|---|
| Node.js | `v24.18.0` |
| Python launcher | `py` → Python **3.14.2** (`python` Store stub present) |
| Docker Desktop | Server **29.6.2**, Compose **v5.3.1** |
| Docker containers | None running |
| PostgreSQL Windows service | `postgresql-x64-18` **Running** |
| PostgreSQL listen | `localhost:5432` reachable |
| Database | `ride_safe_x` exists; user `postgres`; **no application tables** (`\dt` empty) |
| Extensions installed | `plpgsql` only |
| Available (not installed) | `uuid-ossp`, `pgcrypto`, `citext` |
| **PostGIS** | **Installed and verified** as **3.6.2** on `ride_safe_x` (Phase 1 re-verify via `/health/db`) |
| `D:\ridenova-data\uploads` | **Does not exist yet** |
| MinIO in runtime code | **Absent** (references only in architecture-workflow blueprint HTML/source — historical) |

### PostgreSQL decision (operator-provided)

| Setting | Value |
|---|---|
| Host (host processes) | `localhost` |
| Host (containers) | `host.docker.internal` (planned Phase 1) |
| Port | `5432` (default; confirmed open) |
| Database | `ride_safe_x` |
| Username | `postgres` |
| Password | **Provided out-of-band** — store only in ignored `.env`; never commit |

Credentials were shared in chat for Phase 0 connectivity proof. **Rotate before any shared/remote use** and keep secrets out of Git and docs.

Connectivity proof (2026-10-19):

```text
current_database | ride_safe_x
current_user     | postgres
version          | PostgreSQL 18.2 on x86_64-windows, ...
```

---

## 3. BMAD status

| Item | Finding |
|---|---|
| Installed BMAD version | **4.44.2** (in `D:\git\bmad_project\bmad_project_org` and `BMAD-METHOD`) |
| Project config | `.bmad-core/core-config.yaml` (prd/architecture sharded under `docs/`) |
| Workflow for this effort | `brownfield-fullstack` (major modernization: static → multi-service) |
| IDE workflow | SM `*draft` → Dev `*develop-story` → QA `*review` / gates |
| Agents available | analyst, pm, architect, po, sm, dev, qa, ux-expert (+ infra expansion pack) |
| In `ride_safe_x` | **Not installed** — Phase 1 should install BMAD into this repo (or symlink/copy `.bmad-core` + Cursor rules) |

Do **not** invent BMAD CLI commands beyond what `bmad-method` / agent `*` commands document.

---

## 4. Static application — what works (product capability)

Prior static-phase certification (`static application/docs/FINAL_CERTIFICATION.md`) marked the demo **demo-complete, not production**. Capabilities exist as **browser simulation** (`localStorage` / RNPC), not server APIs:

- Customer: register/OTP, ride booking, trip lifecycle, wallet, food/bus/hotel/rental/parcel demos, support
- Driver: onboarding/docs, KYC queue, online/offline, trip accept, earnings
- Partner: onboarding, menu, payouts
- Admin: ops screens + Platform Control (pricing, KYC, maintenance, broadcasts, mock RBAC)
- Agent portal: queue/chat/call **simulation** (no Asterisk)
- Cross-tab config/ops via `ridenova.platform.v1` / `ridenova.ops.v1`
- Trip engine persistence key `ridenova.demo.v1` (Slice A)

**Security note (documented in-repo):** client-side role switching is **not** authorization.

---

## 5. Baseline test evidence (executed 2026-10-19)

### 5.1 CDP suites — `static application/docs-analysis/`

Commands:

```powershell
cd "D:\git\ride_safe_x\static application\docs-analysis"
node test-customer.js
node test-driver.js
node test-partner.js
node test-admin.js
node test-agent.js
node test-ux.js
node test-admin-control.js
node test-flows.js
```

**Run A (earlier same day):** admin, agent, ux, admin-control printed ALL PASSED; customer/driver/partner/flows printed FAILED (console).  
**Run B (evidence file):** `docs/implementation/evidence/BASELINE_SUMMARY_20261019-165227.json`

| Suite | Verdict (Run B console) | `process.exit` |
|---|---|---|
| `test-customer.js` | **FAILED 1** (phone validation timeout on R03) | 0 (suite does not exit non-zero) |
| `test-driver.js` | **FAILED 1** (publish trip sheet timeout after logout) | 0 |
| `test-partner.js` | **FAILED 2** (sign-in / restore timeouts) | 0 |
| `test-admin.js` | **ALL PASSED** | 0 |
| `test-agent.js` | **ALL PASSED** | 0 |
| `test-ux.js` | **ALL PASSED** (55) | 0 |
| `test-admin-control.js` | **FAILED** (45 passed, 2 failed) | 1 |
| `test-flows.js` | **FAILED 13** (stuck at R58 / onboarding path) | 0 |

**Conclusion:** Static demo is **not fully green** on this machine today. Prior certification logs claimed 8/8; current re-run shows **regression or environment flake**. Several suites print `FAILED` but still exit `0` — CI must not trust exit code alone until fixed in Phase 1.

Compared to older certification: treat prior “8/8 ALL PASSED” as **historical**, not current gate evidence.

### 5.2 Architecture-workflow tests

```powershell
cd "D:\git\ride_safe_x\static application\architecture-workflow"
py -m unittest discover -s tests -p "test_*.py" -v
node --test tests/engine/engine.test.js
```

| Suite | Result |
|---|---|
| Python `unittest` (`test_*.py`) | **FAILED (3 failures / 25 tests)** — app isolation / localStorage / missing utility CSS classes in evolved `customer-app` |
| `tests/engine/engine.test.js` | **25/25 PASS** |

Browser e2e under `architecture-workflow/tests/browser/` was **not** re-run in Phase 0 (long / optional relative to foundation work).

### 5.3 Builds

No frontend/backend build pipeline exists yet. Static apps serve as files (no bundler).

---

## 6. Incomplete / risk inventory (grounded)

| Risk | Detail |
|---|---|
| No backend | All “working” flows are localStorage demos |
| Stale root README | Links assume files at repo root; content is under `static application/` |
| Flaky / failing CDP suites | Customer/partner/flows broken or brittle; admin-control flake between runs |
| Test exit codes | Most CDP suites do not `process.exit(1)` on failure |
| Folder typo | `patner-app` (preserve until coordinated rename) |
| MinIO in blueprints | Architecture HTML/source still mention MinIO — must not re-enter runtime architecture |
| PostGIS missing | Geospatial SQL not available on current Windows PG without installing PostGIS |
| No secrets hygiene | No root `.gitignore` / `.env.example` yet |
| BMAD not in-repo | Workflow tracking not wired to `ride_safe_x` |
| Dual portal UIs | Separate `admin/` and `agent-portal/` static apps; target is **one** React web portal with RBAC |

---

## 7. What must be preserved

1. Entire `static application/` tree as **authoritative UI/workflow reference** (do not delete or mass-regenerate casually).
2. Screen IDs and flows (R\*, D\*, P\*, A\*, G\*) and `ROLE_PAGE_MATRIX.md` mapping.
3. RNPC concepts (fare formula, platform config/ops, audit list shapes) as product rules to re-implement server-side.
4. Engine state machines (`architecture-workflow` + app `engine.js` / `state-machines.js`) as booking/trip lifecycle reference.
5. Existing CDP suites as regression anchors for the static prototype until React/RN replacements exist.
6. Agent portal policy model (A31 publish) as ops requirements for support configuration.
7. Git history on `develop` — no re-init, force-push, or nested repo.

---

## 8. Phase 0 gate status

| Gate criterion | Status |
|---|---|
| Repository inspected | **Met** |
| Baseline tests executed with evidence | **Met** (results mixed; recorded honestly) |
| Implementation plan + architecture + decisions + traceability | **Met** (sibling docs) |
| No destructive mass rewrite | **Met** (docs only) |

**Phase 0 complete. Awaiting approval before Phase 1 implementation.**
