# Shared AGI binaries (AST-11)

Japit dialplan (`extensions_japit.conf`) does not invoke legacy VICIdial AGI
scripts. Shared AGI support is still required so both Asterisk peers (when
deployed) resolve the same optional AGI helpers and future dialplan AGI hooks.

## Path

| Path | Purpose |
|------|---------|
| `/var/lib/asterisk/agi-bin` | Shared AGI executable directory |

Mount this path on shared storage in dual-PBX staging (see `SHARED_STORAGE.md`).
On a single-node production host, a local directory is sufficient; validation
scripts still require it to exist and be readable.

## Layout

```text
/var/lib/asterisk/agi-bin/
  README.md          # this file (or symlink from Git deploy)
  japit/             # reserved for Japit AGI helpers
```

Deploy AGI scripts via the same Ansible/Git revision used for dialplan so
PBX peers never diverge when a second node is introduced.
