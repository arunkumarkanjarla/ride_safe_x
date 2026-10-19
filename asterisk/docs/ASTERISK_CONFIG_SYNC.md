# Asterisk configuration synchronization and drift detection (AST-04)

## Scope

AST-04 keeps the shared, top-level Asterisk configuration identical on both
peers through Git and Ansible. It does not configure Keepalived, a virtual IP,
SIP trunk failover, AMI failover, or active-call migration.

The Git checkout (`/opt/asterisk` by default) is the source of truth and is
deployed to `/etc/asterisk` by `automated_update_asterisk_git_to_server.sh`.
The deploy script pulls only the approved branch, makes a complete live backup,
validates source and copied files, reloads mapped services, and rolls back when
validation or a reload fails.

## Ansible flow

Use `ansible-core` 2.14 or later. Copy the inventory and group variable samples
to non-sample files, set host addresses, and protect SSH, AMI, and ODBC secrets
with Ansible Vault. Do not commit a populated production inventory.

From `ansible/`, run:

```bash
ansible-playbook playbooks/deploy_asterisk_config.yml
ansible-playbook playbooks/apply_node_overlay.yml
ansible-playbook playbooks/check_config_drift.yml
```

Shared deployment is serialized one peer at a time. `apply_node_overlay.yml`
accepts only reviewed, non-sample files with no unresolved `<PLACEHOLDER>`,
backs up each effective target, and applies only explicit destinations below
`/etc/asterisk`. It deliberately does not sync peer overlay directories.

## Versioning and checksums

Use a protected branch and an approved commit for both peers. Record the Git
commit in the deployment change record. The aggregate checksum is deterministic:

```bash
sudo CONFIG_DIR=/opt/asterisk asterisk/scripts/compute_config_checksum.sh
sudo CONFIG_DIR=/etc/asterisk asterisk/scripts/compute_config_checksum.sh
```

It covers top-level shared files by file name and SHA-256 digest. It excludes
Git metadata, documentation, backup files, private keys, astdb/SQLite state,
samples, `node.env`, and a file whose first matching comment is tagged
`JAPIT-NODE-LOCAL` or `AST-LOCAL-OVERLAY`. Tag host-specific transport bind
files this way before placing them in `/etc/asterisk`.

## Drift detection and alerts

The read-only checker compares Git and live file SHA-256 digests, writes an
atomic JSON report to
`/opt/asterisk-deployment/cluster/drift-report.json` by default, logs a summary
to syslog with tag `asterisk-config-drift`, and returns 0 when clean or 1 on
drift. Configure `PROM_TEXTFILE_DIR` to additionally write
`asterisk_config_drift.prom` for a Prometheus textfile collector.

Install `ops/cron/asterisk-drift-nightly.cron.sample` after Ansible has
installed the helper script. The scheduled job can read optional deployment
paths and `PROM_TEXTFILE_DIR` from `/etc/default/japit-asterisk-drift`.

Run it on demand:

```bash
sudo /usr/local/libexec/japit-asterisk/check_config_drift.sh
sudo cat /opt/asterisk-deployment/cluster/drift-report.json
sudo /usr/local/libexec/japit-asterisk/verify_config_domains.sh
```

The JSON fields `missing_live`, `changed`, and `unmanaged_live` are the diff
report. Resolve drift by identifying its owner, committing the intended shared
change, then redeploying; do not silently copy a live file into Git.

Alert on: drift, deploy failure, Git version mismatch, aggregate checksum
mismatch, and a peer being offline or unreachable by Ansible. Treat an
unreachable peer as an operational alert, not a clean drift result.
