# PCI-safe DTMF / payment mode (AST-27)

This is an engineering control for card-entry **recording pause** and **DTMF masking**. It is **not** a PCI DSS certification.

There is no Japit payment processor. This is a secure payment-mode integration point: pause MixMonitor, never log or store digit values, resume only after a proven safe end.

Never use real PAN, CVV, PIN, or OTP. Staging tests use synthetic DTMF only (`1`–`5` or clearly fake placeholders).

## Invariant

```
IF payment state is REQUESTED / ACTIVE / UNKNOWN / FAILED:
    MixMonitor must stay paused (or pause must be retried).
    Agent resume/start is rejected (payment_mode_blocks_recording).
    PAYMENT_ACTIVE + RECORDING is invalid.

IF payment state is UNKNOWN / FAILED:
    Do not UnpauseMixMonitor until confirm_safe=true.
    Worker / FastAPI restart must not auto-resume.
```

Feature flag: `PCI_DTMF_ENABLED` (default true). Rollback = `PCI_DTMF_ENABLED=false`. That does **not** disable recording encryption, toll-fraud, DND/consent, governor, MFA, or ARI security.

## State machine

```
NORMAL → REQUESTED → ACTIVE → ENDED → NORMAL
                  ↘ UNKNOWN / FAILED → recording stays paused
```

## Recording

Reuses Phase 12 / 20 `control_recording()`:

| Payment | AMI | Notes |
|---------|-----|--------|
| Start | `PauseMixMonitor` | Allowed even under `always_record` via internal `pci_payment=True`. Agent pause/stop under `always_record` stays blocked. `stop` is never used for payment. |
| End (proven) | `UnpauseMixMonitor` | Only after ACTIVE with `recording_paused` or `confirm_safe`. |
| Uncertain end | none | `needs_confirm_safe`; MixMonitor remains paused. |

Same CallSession / `logical_call_id` / recording metadata / encryption / playback / QA.

Encryption is **not** a substitute for pause. Required: DTMF is not recorded, not “recorded then encrypted”.

## Dialplan (optional Gosub)

API/AMI is authoritative. Dialplan helpers:

- `[japit-payment-start]` — `Set(__JAPIT_PAYMENT_MODE=1)`, `TryExec(PauseMixMonitor())`, `UserEvent(JapitPaymentMode)` **without Digit**
- `[japit-payment-end]` — resume only if `JAPIT_PAYMENT_SAFE!=0`; otherwise hold (recording stays paused)

Do not `NoOp`/`Verbose`/`UserEvent` digit values. Queue callback `[japit-queue-dtmf]` is **not** PCI card-entry; leave it unchanged.

Do **not** add AMI `dtmf` eventfilter in `manager_japit.conf` (that would increase exposure). If DTMF AMI events arrive anyway, the listener sanitizes and logs `digit_received=true` only.

CEL `events=` does not include DTMF.

## Masking

Never log or persist: DTMF digit, PAN, CVV, PIN, OTP.

Safe log: `dtmf_event=true payment_mode=true digit_received=true`

Central sanitizer: `python-service/app/modules/pci_dtmf/sanitize.py` (audit, AMI, ARI `ChannelDtmfReceived`).

## APIs

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/v1/agent/payment-mode/start` | `recording.control` **or** `agent.telephony.control` |
| POST | `/api/v1/agent/payment-mode/end` | same; `confirm_safe` required if UNKNOWN/FAILED |
| GET | `/api/v1/agent/payment-mode/status` | same |

Agents may only control payment mode for their own active call. Extra body fields (including `digit` / `pan`) are rejected (422). Responses never contain DTMF values. Payment mode never Originates.

## Guided scripts

Step type `secure_payment`: entering the step starts payment mode; completing it stores `{status: completed}` only. Numeric/PAN answers are rejected.

## Metrics

`japit_payment_mode_started_total`, `completed_total`, `failed_total`, `japit_payment_recording_paused_total`, `resumed_total`, `japit_payment_safe_pause_total`.

Labels only: `direction`, `result`, `reason`, `node`. Never phone, PAN, DTMF, channel, or session IDs.

## Audit

`payment_mode.started`, `payment_mode.recording_paused`, `payment_mode.ended`, `payment_mode.recording_resumed`, `payment_mode.failed`, `payment_mode.safe_pause`. Metadata: session id, actor, state, result — never digits.

## Failure / recovery

After AMI, ARI, FastAPI, recording-worker, or Redis restart during payment: **do not auto-resume**. Require `confirm_safe` if state is UNKNOWN/FAILED. Asterisk restart drops MixMonitor with the channel; do not invent a resume.

## Rollback

1. `PCI_DTMF_ENABLED=false`
2. Alembic downgrade **`20260814_0080` → `20260814_0079` only** if schema must revert
3. Do not downgrade Phases 23–27. Do not disable encryption, MixMonitor, or workers.
