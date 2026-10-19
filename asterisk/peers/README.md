# Asterisk peer topology

AST-03 introduces **Asterisk-2** as a configuration and data peer of Asterisk-1. Both nodes run the same Asterisk release, Git revision, module set, codecs, dialplan, realtime mappings, queues, templates, prompts, sound assets, and application integration.

This is an active/manual-peer foundation, not an automatic high-availability system. A call remains on the PBX that accepted it. Operators select the node for testing or cutover; no component automatically moves SIP registrations, trunks, AMI sessions, or active calls between nodes.

## Node roles and addressing

| Node | Identity | Required unique values |
|---|---|---|
| Asterisk-1 | `ASTERISK_NODE_ID=1` | host name, private/public IP, PJSIP transports, RTP media address, AMI bind/ACL |
| Asterisk-2 | `ASTERISK_NODE_ID=2` | host name, private/public IP, PJSIP transports, RTP media address, AMI bind/ACL |

Set the Asterisk-2 values through the samples in `asterisk-2/`; do not copy an Asterisk-1 transport, NAT, or AMI ACL unchanged.

## Shared versus node-local

| Scope | Contents | Operational rule |
|---|---|---|
| Shared Git tree | configuration, modules policy, codecs policy, dialplan, queue templates, realtime/sorcery/ODBC definitions | Deploy the same approved commit to both nodes with the deployment script. |
| Shared PostgreSQL | realtime records, queue state/configuration, CDR/CEL and application data | Both nodes use the primary `japit_call_center-postgres` DSN. A replica DSN is documented for manual disaster procedures only. |
| Shared storage | recordings, custom sounds, MOH, prompts, TLS certificates, voicemail | Mount the same paths with Asterisk-readable ownership and write semantics described in `../docs/SHARED_STORAGE.md`. |
| Node-local | `/etc/asterisk` node overlay values, hostname, IP routes/firewall, PJSIP transport advertisement, RTP port exposure, AMI bind address/ACL, `node.env` | Apply after the standard Git deploy. Never place host-specific secrets or IPs in the shared base files. |
| Node-local runtime | PID/socket files, logs, astdb, temporary spool files, active channels and registrations | Do not mount or synchronize these between peers. |

## Explicit non-goals in AST-03

- No Keepalived or any virtual IP.
- No shared SIP VIP and no automatic registration movement.
- No automatic trunk failover.
- No automatic AMI failover or AMI connection pooling.
- No claim that active calls survive a node outage.

FastAPI remains pinned to exactly one configured AMI host. Changing it to the other peer is a deliberate, verified operator action; dual AMI orchestration belongs to a later phase.
