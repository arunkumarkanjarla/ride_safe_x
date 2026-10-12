# RideNova – architecture and screen blueprint

This folder holds the approved blueprint and everything that generates the static applications next to it.

| Path | Content |
| --- | --- |
| `index.html`, `architecture/`, `screens/`, `flows/`, `images/index.html` | Generated blueprint site: 27 architecture pages and 144 screen specification pages (each with an "Open in the app" link) |
| `images/` | Screen PNGs, SVG diagrams, original reference image |
| `source/` | Python generator: screen specs and mocks (`rider*.py`, `driver.py`, `admin.py`, `screens2-4.py`), registry, wiring table (`proto_wiring.py`), post-processor, app builder (`build_apps.py`) |
| `assets/js`, `assets/css` | Hand-written runtime (engine, state machines, roles, app runtime, hub), `assets/js/controllers/` (one file per application plus `kit.js`) and stylesheets |
| `tests/` | Static tests (Python), engine tests (Node), browser tests (Edge/Chrome via DevTools protocol) |
| `tools/` | Documentation generator, screenshot tool; `demo_server.py` is from the previous phase and not used |
| `docs/` | Analysis, workflows, guides, reports and the static application phase (`docs/static-app/`) |

Build the blueprint: `py source/build.py`; also regenerate the five application folders: `py source/build.py --apps`
(Python 3.12+). Screen behaviour per application: `assets/js/controllers/<app>.js`. Docs: `py tools/gen_docs.py`. Tests: see
[docs/static-app/install-and-test.md](docs/static-app/install-and-test.md).

## Documentation index

* Static application phase: [analysis and plan](docs/static-app/00-analysis-and-plan.md) · [route inventory](docs/static-app/route-inventory.md) ·
  [user roles](docs/static-app/user-roles.md) · [workflows](docs/static-app/workflows.md) · [security rules](docs/static-app/security-rules.md) ·
  [run and test](docs/static-app/install-and-test.md) · [gaps and links](docs/static-app/gaps-and-links.md) · [acceptance checklist](docs/static-app/acceptance-checklist.md)
* Analysis: [inventory](docs/analysis/workspace-inventory.md) · [screens and images](docs/analysis/screen-image-mapping.md) ·
  [architecture findings](docs/analysis/architecture-findings.md) · [code review](docs/analysis/existing-code-review.md) ·
  [missing requirements](docs/analysis/missing-requirements.md)
* Workflows: [ride, payment, SOS, food, KYC](docs/workflows/workflows.md) · [state machines](docs/workflows/state-machines.md) ·
  [navigation map](docs/workflows/navigation-map.md) · [mock roles](docs/workflows/rbac.md)
* Previous phase: [prototype architecture](docs/guides/prototype-architecture.md) · [security baseline](docs/guides/security-baseline.md) ·
  [test report](docs/reports/test-report.md) · [backend readiness](docs/reports/backend-readiness-checklist.md)
