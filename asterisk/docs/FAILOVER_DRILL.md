# Failover drill (AST-20)

See `Documents/PHASE12_FAILOVER_DRILL.md` for the full checklist, QA sign-off, and RTO/RPO measurement.

Helper (non-destructive):

```bash
bash asterisk/scripts/failover_drill.sh
```

**Never** auto-trigger production failover from CI.
