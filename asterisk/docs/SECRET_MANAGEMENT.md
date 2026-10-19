# Asterisk secret management (Phase 13)

## Principle

Committed Asterisk overlays must not contain production credentials.

Use secret-manager references in templates:

```
secret = <secret-manager:ASTERISK_AMI_SECRET>
password = <secret-manager:ASTERISK_ARI_PASSWORD>
```

Deploy tooling (Ansible, systemd EnvironmentFile, Vault Agent) replaces references before `asterisk -rx "manager reload"` / module reload.

## Files

| File | Notes |
|------|-------|
| `manager_japit.conf` | AMI user secret via reference |
| `manager_japit.conf.sample` | Dual-user sample with references |
| `ari_japit.conf.sample` | ARI password via reference |

## Single-node compatibility

Current environment remains one Asterisk. Keep the same overlay pattern for future `pbx-2` (per-node EnvironmentFile, shared Vault path or node-suffixed keys).

## Rotation

1. Rotate secret in Vault / secret store
2. Render overlay on PBX host
3. `asterisk -rx "manager reload"` (or restart if required)
4. Refresh FastAPI AMI client (`SECRETS` refresh + AMI reconnect / API restart)

Never commit real AMI/ARI passwords to git.
