# AST-26 Call quality telemetry (RTCP → CDR)

## Sources (in preference order)

1. **Hangup `CHANNEL(rtpqos,audio,*)`** via `[japit-rtp-qos-hangup]` `UserEvent(JapitRtpQos)`.
   - `txjitter` / `rxjitter` / `rtt` are **seconds** → stored as `*_ms` (`× 1000`).
   - `txploss` / `rxploss` are **packet counts**, not percents.
   - `packet_loss_percent = 100 × lost / (received + lost)` when counts exist.
   - Leg jitter/loss = `max(tx, rx)`.
2. **AMI `RTCPSent` / `RTCPReceived`** (mid-call cache in the existing AMI worker).
   - `IAJitter` is RFC 3550 timestamp units at **8 kHz** → `ms = IAJitter / 8`.
   - `FractionLost` is 0–255 → `percent = FractionLost / 256 × 100`.
3. If neither source has usable metrics: persist **NULL** metrics with `mos_status=unavailable` / `insufficient_data` and `quality_state=UNKNOWN`. **Never store 0 for missing data.**

CEL/ARI/WebRTC `getStats()` are **not** CDR sources. Agents cannot POST MOS/jitter/loss.

## MOS

Asterisk does not supply MOS. Estimated MOS uses a simplified ITU-T G.107 E-model (`mos_method=e_model_rtcp`) only when **both** `jitter_ms` and `packet_loss_percent` are present (loss may be `0.0`). RTT is optional and is never invented.

- `mos_status=estimated` — E-model ran
- `mos_status=unavailable` — no RTCP/rtpqos
- `mos_status=insufficient_data` — partial metrics
- `mos_status=invalid` — corrupt values rejected
- **`measured` is never used**

## Quality states

Defaults match `react-web/src/lib/softphone/connectionQuality.ts`:

| Metric | FAIR (warning) | POOR (critical) |
|--------|----------------|-----------------|
| Jitter | > 45 ms | > 80 ms |
| Packet loss | > 3% | > 8% |
| RTT | > 250 ms | > 400 ms |
| MOS | < 3.6 | < 3.1 |

UNKNOWN is never classified as GOOD. Degraded = POOR.

## Collection

Existing AMI worker only. Hangup handler `Return()`s immediately. Bounded in-memory RTCP cache (TTL 2h). Feature flag `CALL_QUALITY_ENABLED`.
