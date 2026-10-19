# Using BMAD with RideNova (external install)

**BMAD version:** 4.44.2  
**Install location:** `D:\git\bmad_project` (not inside `ride_safe_x`)

## Rule

Do **not** copy `.bmad-core`, Cursor BMAD agent rules, or the BMAD Method package into this repository. RideNova is a **consumer** of the sibling BMAD installation.

## How to use

1. Open or reference the BMAD workspace: `D:\git\bmad_project\bmad_project_org`.
2. Activate agents via Cursor rules under that workspace (e.g. `@sm`, `@dev`, `@qa`, `@architect`).
3. Follow the installed workflow docs:
   - `.bmad-core/workflows/brownfield-fullstack.yaml`
   - `.bmad-core/enhanced-ide-development-workflow.md`
   - `.bmad-core/working-in-the-brownfield.md`
4. Create RideNova artifacts **in this repo** under `docs/` (implementation reports, stories when authored, architecture decisions). Do not invent CLI commands — verify against the installed `bmad-method` / agent `*` command lists.

## Typical IDE loop (from installed docs)

| Step | Agent | Command (as documented in BMAD) |
|---|---|---|
| Draft story | SM | `*draft` |
| Implement | Dev | `*develop-story` |
| Review / gate | QA | `*review` / gate updates |

Project-specific paths for stories/QA outputs can be created under `docs/stories/` and `docs/qa/` when those workflows run — still without installing BMAD into this tree.
