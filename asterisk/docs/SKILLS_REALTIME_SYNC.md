# AST-09: Realtime Skills Queue-Member Sync

Skills changes update Asterisk dynamic queue-member penalties without a
dialplan, queue, module, or process reload.

## Flow

1. An administrator creates, updates, bulk-replaces, or deletes an
   `AgentSkill` or `QueueSkill`.
2. The API commits the skills change, then performs a best-effort AST-09 sync.
3. Each affected active `QueueMember.penalty` is recalculated:
   - a member below a required minimum proficiency receives `100`;
   - otherwise the largest applicable `(preferred - proficiency) × 10` value is
     used, clamped to `0..100`;
   - optional skills do not penalize agents who do not have that skill.
4. For each member with an extension, the API changes the existing dynamic
   `Local/<extension>@japit-agent-offer/n` member with AMI `QueuePenalty`.
   If that action is unavailable, it uses AMI `Command` with
   `queue set penalty ...`; it never re-adds a member for this update.

The agent Ready path reads the stored `QueueMember.penalty` for both the
login-all request and its `QueueAdd` recovery path, so a subsequent login also
uses the current score.

## Skill-first then next agent on Decline

1. For **one-at-a-time** strategies (`leastrecent` / `rrmemory`), `[japit-queue]` sets
   `QUEUE_MAX_PENALTY=0` before `Queue()` so only preferred-skill members (AST-09
   penalty `0`) are offered first.
2. For **`ringall`**, dialplan sets `QUEUE_MAX_PENALTY=100` and Admin save flattens
   live member penalties to `0` so every ready member rings together. Skill scores
   remain in the DB and are restored when the queue returns to leastrecent/rrmemory.
3. On AMI `AgentRingNoAnswer` (Decline / no-answer) for non-ringall strategies,
   FastAPI raises `QUEUE_MAX_PENALTY=100` on the Mediant caller and briefly pauses
   the declining interface so the **next-best** agent is offered.
4. `queuerules.conf` rule `japit-skill-expand` expands to `100` after 25s if the
   AMI path is missed (`defaultrule=japit-skill-expand`).

Toggle with `SKILLS_DECLINE_EXPAND_ENABLED` (default `true`).

## Operations

- Enable/disable with `SKILLS_ASTERISK_SYNC_ENABLED` (default: `true`).
- CRUD succeeds even when Asterisk is unavailable; errors are logged and a
  later Ready operation applies the already-stored penalty.
- Expected propagation for an available AMI endpoint is one synchronous
  request per affected dynamic member, normally well below five seconds.
- Inspect live state with `asterisk -rx "queue show <queue>"`.

This design intentionally does **not** invoke `queue reload`, `module reload`,
or a dialplan reload.
