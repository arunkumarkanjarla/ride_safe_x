# Enterprise Call Center Pro – Asterisk

Asterisk telephony configuration repository for the **Enterprise Call Center Pro** platform.

This repository contains the complete Asterisk configuration, dialplan, WebRTC integration, queue configuration, realtime mapping, architecture documentation, security guidelines, audit reports, and restoration documentation required to deploy and maintain the telephony layer of the platform.

---

# Repository Purpose

This repository serves as the source control for the Enterprise Call Center Pro PBX layer.

It includes:

* Complete Asterisk configuration
* Japit Call Center custom dialplan
* PJSIP/WebRTC configuration
* AMI integration
* ARI configuration
* Queue management
* Realtime database configuration
* ODBC configuration
* Architecture documentation
* Security documentation
* Audit reports
* Deployment and restoration guides

---

# Repository Structure

```text
.
├── README.md
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── JAPIT_CHANGES.md
│   ├── SECURITY.md
│   ├── INSTALL_RESTORE.md
│   ├── TELEPHONY_ROOT_CAUSE_REPORT.md
│   ├── ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md
│   ├── milestones/
│   └── images/
├── extensions.conf
├── extensions_japit.conf
├── pjsip.conf
├── pjsip_japit.conf
├── manager.conf
├── manager_japit.conf
├── ari.conf
├── ari_japit.conf
├── queues.conf
├── extconfig.conf
├── extconfig_japit.conf
├── sorcery.conf
├── sorcery_japit.conf
├── func_odbc.conf
├── func_odbc_japit.conf
├── res_odbc.conf
├── res_odbc_japit.conf
└── ...
```

The repository mirrors the production Asterisk configuration while excluding sensitive production secrets.

---

# Platform Architecture

```text
React WebRTC
      │
      ▼
NGINX Reverse Proxy
      │
      ▼
FastAPI Backend
      │
      ├────────► PostgreSQL
      │
      ├────────► Redis
      │
      ├────────► MinIO
      │
      ▼
AMI / ARI
      │
      ▼
Asterisk
      │
      ├── Dialplan
      ├── PJSIP
      ├── Queues
      ├── IVR
      ├── Recordings
      └── PSTN / SIP Trunks
```

---

# Major Components

## Dialplan

* Japit custom dialplan
* Queue routing
* IVR
* Call transfer
* Callback
* Agent login
* Agent logout
* Recording support

---

## PJSIP

Supports

* SIP endpoints
* WebRTC endpoints
* Transport configuration
* Authentication
* Codec configuration

---

## AMI

FastAPI communicates with Asterisk using AMI for

* Originate
* Hangup
* Queue control
* Spy
* Whisper
* Barge
* Agent state
* Events

---

## ARI

ARI configuration is available for future application integrations.

---

## Queue Management

Configuration includes

* Queue definitions
* Queue strategies
* Queue members
* Realtime members
* Queue monitoring

---

## Database Integration

Realtime configuration supports

* PostgreSQL
* ODBC
* Sorcery
* Realtime PJSIP
* Queue realtime

---

# Documentation

The `docs/` directory contains complete technical documentation.

| Document                               | Description                                  |
| -------------------------------------- | -------------------------------------------- |
| ARCHITECTURE.md                        | Overall telephony architecture               |
| JAPIT_CHANGES.md                       | Summary of Japit-specific customizations     |
| SECURITY.md                            | Security recommendations and secret handling |
| INSTALL_RESTORE.md                     | Installation and restoration guide           |
| TELEPHONY_ROOT_CAUSE_REPORT.md         | Root cause analysis documentation            |
| ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md | Telephony audit report                       |
| milestones/                            | Development milestones and audit history     |
| images/                                | Architecture diagrams                        |

---

# Security

This repository intentionally excludes sensitive production assets.

Do **not** commit:

* TLS private keys
* Certificates containing private keys
* `.pem`
* `.key`
* Password files
* Production secrets
* Environment files containing credentials

Generate new certificates when deploying to new environments.

---

# Development Workflow

Typical workflow:

1. Create a feature branch.
2. Update required configuration files.
3. Validate configuration.
4. Reload Asterisk modules.
5. Test call flows.
6. Create a Merge Request.
7. Review before merging into the main branch.

---

# Validation

Before deployment, verify:

```bash
asterisk -rx "core reload"

asterisk -rx "dialplan reload"

asterisk -rx "module reload"

asterisk -rx "pjsip reload"

asterisk -rx "queue reload"

asterisk -rx "dialplan show"
```

Ensure there are no syntax errors before applying changes to production.

---

# Related Repositories

This repository is part of the Enterprise Call Center Pro platform.

* Backend (FastAPI)
* Frontend (React)
* Database
* DevOps / Infrastructure
* Asterisk (this repository)

Each repository is versioned independently while maintaining compatibility across platform releases.

---

# Best Practices

* Keep configuration modular.
* Separate Japit customizations from upstream configuration.
* Review all telephony changes before deployment.
* Never commit production credentials.
* Document significant configuration updates.
* Test inbound, outbound, IVR, queues, transfers, and recordings after every major change.

---

# License

Internal project repository.

Enterprise Call Center Pro

Confidential – For authorized development and deployment within the organization.

---

# Automated deploy to this server

Production deploy utility (does **not** push; pulls then copies into `/etc/asterisk`):

```bash
sudo ./automated_update_asterisk_git_to_server.sh --dry-run main
sudo ./automated_update_asterisk_git_to_server.sh main
```

Deployment workspace (backups, logs, rollback helpers):

`/opt/asterisk-deployment/` — see `/opt/asterisk-deployment/README.md`
