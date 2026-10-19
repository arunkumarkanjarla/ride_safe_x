# Queue Overflow Dialplan (AST-08)

`[japit-queue]` evaluates configured overflow rules after `Queue()` returns and when a
queue has no ready members. It calls the private FastAPI endpoint
`GET /api/v1/telephony/queue/overflow/decide-simple`; the pipe response is either
`ok|target_queue|reason|hop|rule_id`, `none||||`, or `fail||||`.

## Flow and guards

1. The inherited `JAPIT_OVERFLOW_HOP` and `JAPIT_OVERFLOW_VISITED` variables begin
   at `0` and empty.
2. The dialplan supplies queue status, ready/waiting member counts, hop, visited
   queues, and `linkedid` to the runtime evaluator.
3. An `ok` response is accepted only when the target is non-empty, differs from the
   source, is not visited, and has not exceeded `JAPIT_OVERFLOW_MAX_HOPS` (default
   `3`). The source is then appended to `VISITED`, hop is incremented, and the call
   re-enters `[japit-queue]` exactly once for that decision.
4. `none`, `fail`, CURL timeout, malformed output, or any loop guard go directly to
   the existing ODBC failover. No caller is dropped because the runtime service is
   unavailable.

```mermaid
sequenceDiagram
  participant Caller
  participant Asterisk
  participant Runtime as Overflow runtime
  participant ODBC as Legacy failover
  Caller->>Asterisk: Queue(source)
  Asterisk->>Runtime: decide-simple(status, counts, hop, visited)
  alt safe matching rule
    Runtime-->>Asterisk: ok|target|reason|nextHop|rule
    Asterisk->>Asterisk: mark CDR, event, visited; Queue(target)
  else no rule, error, or guard
    Runtime-->>Asterisk: none/fail
    Asterisk->>ODBC: existing queue failover
  end
```

## Marking and diagnostics

Each accepted move writes:

- `CDR(userfield)`: `overflow:{source}>{target}:hop={n}:reason={reason}`
- AMI event: `UserEvent(JapitQueueOverflow)` with `SourceQueue`, `TargetQueue`,
  `Hop`, `Reason`, `RuleId`, `LinkedId`, and UTC `Timestamp`
- Asterisk `Verbose(2)` log line

The runtime route is intentionally unauthenticated for Asterisk CURL and must be
reachable only on the private telephony network. The admin/debug endpoint remains
permission-protected: `GET /api/v1/admin/queues/{id}/overflow/evaluate`.
