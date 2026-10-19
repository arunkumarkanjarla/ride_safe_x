# Asterisk SIP Floating VIP (AST-05)

Two Asterisk nodes share one SIP virtual IP (VIP) through Keepalived VRRP. Asterisk-1 starts at priority 150 and Asterisk-2 at 100; only the current `MASTER` owns the VIP. The supplied samples use unicast peers, which is preferred where multicast VRRP is blocked or unreliable.

## Deployment

Copy the matching sample to `/etc/keepalived/keepalived.conf`, replacing every example address, NIC name, authentication passphrase, and `CLUSTER_SIP_VIP` defaults in notification scripts. Install scripts in `/usr/local/libexec/japit`, set mode `0755`, create `/var/lib/japit/cluster`, then validate with `keepalived --config-test -f /etc/keepalived/keepalived.conf` before enabling the service.

`check_asterisk_health.sh` verifies the Asterisk process/CLI, optional AMI TCP reachability, ODBC, an optional DB command, shared storage mount, and disk/CPU/memory thresholds. `check_pjsip_options.sh` is deliberately a soft responsiveness check. Configure required paths and thresholds through its environment before production use.

## Split-brain and failover

Keep `nopreempt` enabled: a recovered preferred node does not automatically reclaim a VIP that is serving calls. Use planned failback only after draining the active node and confirming storage/database health. Unicast peers, a unique VRID, a strong matching VRRP password, and network ACLs between the two nodes are required. The fault hook is dry-run only; add tested external STONITH/fencing only after an operational change review.

The notification hooks atomically write `vrrp-state.json` and append `failover-history.jsonl` under `/var/lib/japit/cluster`. The API reads those files; protect the directory from untrusted writers.

The engineering target is VIP migration in under 10 seconds and new-call recovery in under 30 seconds. Existing dialogs/media are expected to drop during an Asterisk node loss; this design does not preserve established calls.

## AMI and trunks

Set the application's `ASTERISK_AMI_HOST` to the SIP VIP so AMI control traffic follows the active node. This change does not implement SIP trunk registration failover and does not automatically fail over, alter, or register trunks.
