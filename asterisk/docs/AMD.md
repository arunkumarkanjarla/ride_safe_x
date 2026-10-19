# AST-22 Answering Machine Detection

AMD runs **after PSTN answer** on the existing predictive/callback path. It is not a second dialer.

## Where AMD runs

`[japit-join-conf]` (Dial `U()` on the answered Mediant/PSTN channel).

`[japit-callback-originate]` does **not** call `AMD()` (no far-end audio before Dial). It inherits `JAPIT_AMD_*` into `[japit-app-outbound]`.

## Gate

AMD executes only when inherited `JAPIT_AMD_ENABLED=1`.

Manual agent originate does not set that variable, so AMD stays off.

## Sequence (must not change)

1. Phase 18 compliance gate
2. Phase 17 governor `allow_originate`
3. AST-15 Python + dialplan `japit-tollfraud-check`
4. AST-06 `japit-pstn-dial` (primary → secondary)
5. Answer → AMD (if enabled)
6. HUMAN: `JapitOriginationAnswered` + Return (existing agent bridge)
7. MACHINE/UNKNOWN: campaign/profile action (`continue` or `hangup`)

## Profiles (channel variables)

| Profile | Uncertain policy | Intent |
|---------|------------------|--------|
| default | hangup | Balanced; do not treat NOTSURE as HUMAN |
| conservative | continue | Prefer HUMAN when uncertain |
| aggressive | hangup | Prefer MACHINE when greeting is long/wordy |

Timings are passed as `AMD()` arguments from the Dialer Worker. `amd.conf` remains the Asterisk default when args are omitted.

## UserEvent

`JapitAmdResult` with session/logical/campaign/lead ids, result, cause, profile, source, duration, node. No phone number in the event payload beyond existing origination events.

## Voicemail drop

**Not implemented.** Do not configure a machine action of `voicemail` / `leave message`.

## Reload

`dialplan reload` after deploying `extensions_japit.conf`. `module reload app_amd.so` if `amd.conf` changes.
