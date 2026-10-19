# Japit Call Center — Phase 3 X-Lite Real UI Certification

**Date:** 2026-07-29  
**Roles:** Senior Telecom QA / Production Support / Root Cause Analyst  
**Architecture:** Docker×6 / NGINX pins / host PG·Redis·Asterisk — **unchanged**  
**Method:** Real React UI + real X-Lite softphone (not API-only)  
**PSTN mobile:** `7702866838`  
**Inbound DID:** `914049583237` (also routed: `914049583236`)  
**Agent:** `Airtel_Billing_Agent` / extension **1016** (X-Lite deskphone)  
**Status:** IN PROGRESS — Inbound Call 2 defects fixed (busy-on-Ready + Accept abandon race + hangup + slow popup) — **operator retest inbound Call 3**

---

## Pre-flight (2026-07-29)

| Check | Result |
|-------|--------|
| FastAPI 1–6 healthy | PASS |
| Single AMI listener (fastapi-1) | PASS |
| PJSIP 1016 registered (`10.10.10.70`) | PASS |
| AOR max_contacts=1 | PASS |
| Queue Airtel_Billing Local/1016 | Present; must be **unpaused** while portal Ready |

---

## Softphone setup (operator)

1. Open portal login → sign in as **Airtel_Billing_Agent**  
2. Connect phone as **X-Lite Deskphone** (ext 1016)  
3. Confirm X-Lite shows registered  
4. Set status **Ready** (answer the one-time X-Lite bridge call)  
5. Reply **`XLITE READY`** when portal shows Ready + X-Lite registered  

---

## Call 1 defects (STOP) → root cause → fix

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Disposition screen before call ends | `confbridge_member_count()` used bare `asterisk -rx` inside Docker → always **0** while call live; heartbeat reconcile treated that as customer left → **wrap_up** | Count via `cli_or_ami_command_output` + channel fallback; never wrap_up while Mediant leg still live / ambiguous count=0 with agent bridge up |
| Music instead of ring while connecting | Agent alone in ConfBridge during PSTN ring had no ringback; Mediant early SIP answer also dumped carrier inband music into ConfBridge | AMI `ConfbridgeStartMOH` class **`japit-ring`** on originate; dialplan `WaitForSilence` before ConfBridge join; StopMOH on connect/disconnect |
| Same music ~2s after connect | Early ConfBridge join mixed carrier music until real answer | Same WaitForSilence gate + StopMOH; ConfBridge prompt sounds pointed at silence |

**Deployed:** dialplan reload, confbridge/moh reload, FastAPI×6 restart (2026-07-29).

---


## Audio retest defects (Call after disposition fix)

| Symptom | Root cause | Fix |
|---------|------------|-----|
| No ring tone (still music) | AMI `ConfbridgeStartMOH` **does not exist** on Asterisk 18.26 here — ringback never started; carrier early media still reached conf when WaitForSilence(400) fired on cadence gaps | Originate Local `japit-ringback-join` + `MusicOnHold(japit-ring)` feeder; `max_members=3`; WaitForSilence(1200,3,55) |
| No hold music | Hold only `ConfbridgeMute` — customer heard silence | Redirect Mediant → `japit-deskphone-hold` / `MusicOnHold(default)`; unhold → `japit-deskphone-unhold-join` |
| ~2s music after answer | Early ConfBridge join still mixed carrier audio | Stronger WaitForSilence + kick ringback feeder on connect |

**Verified in lab:** ringback Local shows `MusicOnHold!japit-ring` + ConfBridge join on 1016; stop clears feeder. FastAPI×6 restarted.

## Mid-call disposition (screenshot 13:03) — root cause

| Symptom | Root cause | Fix | Lab result |
|---------|------------|-----|------------|
| Disposition while still talking | Ringback Local `japit-ringback-join` join/leave was treated as customer connect/hangup (`ConfbridgeLeave` on any `Local/` ended the call) | Ignore all AMI events for ringback feeder; only Mediant leave ends call | **PASS** API call `94975c05-…` → 7702866838: ringing+rb without wrap_up; `in_call` stable; Hold=`MusicOnHold`; hangup→wrap_up only after end |

## WebRTC-aligned ringback (fix for music-not-ring + post-answer music)

WebRTC outbound works because the agent channel **is** the `Dial(PJSIP/…@Mediant)` caller and hears carrier progress/ring on that leg — no ConfBridge MOH feeder.

X-Lite keeps the agent in ConfBridge, so it needed a different path that still matches that intent:

| Symptom | Root cause | Fix (live) |
|---------|------------|------------|
| Music (not ring) while dialing | Feeder used `MusicOnHold(japit-ring)` (looped wav) + carrier early media could still reach the agent path | Originate Local → ConfBridge + paired leg **`Playtones(ring)`** with Indian `tonezone=in`; Dial **`R`** (`RtTU(...)`) blocks carrier early-media music until answer |
| Music continues after customer answers until they talk | Ringback feeder stayed in ConfBridge until slow AMI stop; agent profile had `music_on_hold_class=japit-ring` / `dsp_drop_silence=yes` | Dialplan **`ConfKick`** of `japit-ringback-join` **before** Mediant `ConfBridge` join; AMI stop retained as backup; agent user MOH class → `default`, `dsp_drop_silence=no` |
| Hold | Already fixed | Unchanged: Redirect → `MusicOnHold(default)` |

**Dialplan:** `japit-deskphone-outbound` → `Dial(...,RtTU(japit-deskphone-pstn-to-conf^ext))` → kick ringback → join conf.  
**App:** deskphone originate uses `Local/{num}@japit-deskphone-outbound/n` + `start_deskphone_outbound_ringback` → `japit-ringback-tone`.  
**Lab (2026-07-29 13:56 logs):** Ringback kick during Wait(0.6) **worked**. Hold Redirect while Mediant was inside Dial `U()` ConfBridge → `async goto messed up execution` → call hangup. Combined ring+music from Indian dual-tone `Playtones(ring)` (+ prior Dial `R` path).  
**Fix:** Originate `PJSIP/{num}@Mediant` → `japit-deskphone-pstn-joined` (ConfBridge is primary app — Hold Redirect safe). Ring = `Playtones(425/1000,0/3000)`. Hold sets `pause_reason=call_hold` so ConfbridgeLeave does not wrap_up.  
**Operator:** Ready → dial → expect clean ring only → answer → Hold (customer hears MOH, call stays up) → Resume → hangup → disposition.


---


### Call 1 OUTBOUND — RETEST REQUIRED

1. Confirm **Ready** + X-Lite registered  
2. Dial **7702866838** from portal  
3. While ringing: confirm **ring tone** (not music) on X-Lite  
4. Answer on mobile → confirm **no music bleed**; Hold → Resume → Mute → Unmute  
5. Hangup → Disposition only **after** hangup → Ready  
6. Reply **`OUTBOUND 1 DONE`** (note who hung up)

| # | Direction | Softphone | Result | Issues | Root cause | Fix | Retest |
|---|-----------|-----------|--------|--------|------------|-----|--------|
| 1 | Outbound | X-Lite 1016 | **PARTIAL** | Disposition OK after fix. Ring still music; no hold MOH; ~2s post-answer music | ConfbridgeStartMOH missing on Ast18; hold only muted; WaitForSilence too short | Local japit-ring feeder + hold Redirect MOH + stronger WaitForSilence | **RETEST as Call 2** |
| 2 | Outbound | X-Lite 1016 | PENDING | Expect Playtones ring + ConfKick on answer (WebRTC-aligned) | Prior MOH feeder + late AMI stop | Dial `R` + Playtones + dialplan ConfKick | **Operator retest** |
| 3 | Outbound | X-Lite 1016 | PENDING | | | | |
| 4 | Outbound | X-Lite 1016 | PENDING | | | | |
| 5 | Outbound | X-Lite 1016 | PENDING | | | | |

## INBOUND (6–10)

| # | Direction | Softphone | Result | Issues | Root cause | Fix | Retest |
|---|-----------|-----------|--------|--------|------------|-----|--------|
| 6 | Inbound | X-Lite 1016 | **FAIL** | First Ready → “all agents busy”; second call OK | Deskphone Ready called `mark_webrtc_agent_unavailable` → paused Local offer `reason=unavailable`; heartbeat heal ~30s later | Ready only sets Custom:{ext}ws UNAVAILABLE; **does not** pause Local/@japit-agent-offer | **PASS after fix — see Call 7** |
| 7 | Inbound | X-Lite 1016 | **PARTIAL** | Offer+Accept+Hold OK; hangup API returned 200 but Mediant stayed up ~10s; popup ~6.5s late; session `ended_at` stamped 6ms after Accept | (1) Accept Redirect → Asterisk `QueueCallerAbandon` raced Accept and stamped `ended_at` while status stayed `in_call` (2) UI hangup sent `call_session_id=null` / no Mediant Hangup (3) Ready poll was 8s | Ignore Abandon when Mediant still live / ringing·in_call; force clear `ended_at` on Accept; hangup recovers live session + Mediant; Ready poll **1.5s** / live **1s** | **Operator retest as Call 8** |
| 8 | Inbound | X-Lite 1016 | PENDING | Expect: Ready → immediate offer → Accept → talk → Hold/Resume → Hangup ends PSTN instantly → disposition | | | **Operator** |
| 9 | Inbound | X-Lite 1016 | PENDING | | | | |
| 10 | Inbound | X-Lite 1016 | PENDING | | | | |

## Inbound X-Lite defect (2026-07-29 15:10 logs)

| Symptom | Root cause | Fix (live) |
|---------|------------|------------|
| Inbound never joins agent audio; UI jumps to connected; customer hangs | Deskphone `japit-agent-offer` **Answer()+MOH** made Queue bridge customer↔Local; AMI `DialEnd ANSWER` treated that as outbound connect → `in_call` without ConfBridge | Deskphone offer: **Progress+Wait only** (no Answer). Customer stays on queue MOH until portal **Accept** Redirects Mediant → ConfBridge. DialEnd ignores `japit-agent-offer`. Offer Local hung up after Accept. |

## Inbound Call 6 — “all agents busy” while Ready (2026-07-29 15:22)

| Symptom | Root cause | Fix (live) |
|---------|------------|------------|
| First inbound after Ready plays busy IVR (`ready_members=0`); second call works | `mark_deskphone_agent_ready_for_queues` → `mark_webrtc_agent_unavailable` paused `Local/1016@japit-agent-offer` with `reason=unavailable` immediately after Ready unpause; `heartbeat_ready_heal` unpaused ~30s later | Deskphone Ready only sets WebRTC device-state UNAVAILABLE; **never** pauses Local offer member |

**Lab evidence:** fastapi-1 Ready @09:51:56 → QueuePause Local `unavailable` → first call `JapitAgentsBusy`; heal unpause → second call offered.

## Inbound Call 7 — hangup dead + slow popup (2026-07-29 15:29 session `200d3fd5-…`)

| Symptom | Root cause | Fix (live) |
|---------|------------|------------|
| Popup ~6.5s after queue offer | Ready poll interval **8s** | Ready poll **1.5s**, live **1s** |
| Hangup button “worked” (HTTP 200) but customer stayed on call | Audit: `hangup failure` with `call_session_id=null`, `channel_name=null`, `linked_id=null` — no AMI Hangup. Presence/session already poisoned | Hangup recovers answered session for agent + falls back to any Mediant in agent ConfBridge/hold |
| Session `answered_at` and `ended_at` ~6ms apart at Accept; status stayed `in_call` | Accept Redirect removes caller from Queue → Asterisk **`QueueCallerAbandon`** commits `ended_at` while Accept commits `answered_at`/`in_call` (lost-update race) | Ignore Abandon when Mediant still live or presence ringing/in_call; Accept `force_connect` always clears `ended_at`; ConfbridgeLeave no longer ends call for non-Mediant/CBAnn |

**Timeline (UTC):** offer 09:59:35 → popup 09:59:42 → Accept 09:59:46 → Hold/Mute OK → hangup 10:00:05 **failure/nulls** → Mediant Hangup 10:00:15 (customer) → disposition `ended_by=system`.

**Operator inbound Call 8 checklist:** Ready → dial DID → IVR → queue → popup within ~2s → Accept → talk on X-Lite → Hold/Resume → **Hangup** (PSTN drops immediately) → disposition → Ready.
