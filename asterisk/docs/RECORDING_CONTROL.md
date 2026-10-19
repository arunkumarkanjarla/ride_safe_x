# Asterisk Recording Control (AST-12 / FE-11)

## Scope

On-demand MixMonitor control for agent_controlled campaigns. Phase 20 adds the softphone UI and status endpoint; AMI actions remain Phase 12.

## AMI actions

| UI action | AMI |
|-----------|-----|
| Start | `MixMonitor` |
| Stop | `StopMixMonitor` |
| Pause | `PauseMixMonitor` |
| Resume | `UnpauseMixMonitor` |

Channel is the agent’s active SIP/WebRTC (or deskphone bridge) channel from presence.

## Policies

Resolved from campaign `recording_policy` with platform default fallback:

- `always_record` — dialplan MixMonitor; softphone cannot stop/pause (PCI payment mode may pause via internal `pci_payment`; see `PCI_SAFE_DTMF.md`)
- `agent_controlled` — softphone may start/pause/resume/stop
- `disabled` — control rejected

## Files / pipeline

On-demand starts write under configured `recording_monitor_root` (`ondemand-{node}-{id}.wav`). Existing recording transfer worker / encryption / playback / QA tags are unchanged.

## Dual-PBX

`asterisk_node_id` is recorded on control events. Do not create a second AMI worker for Phase 20.

## Ops notes

- Softphone UI must call `/api/v1/agent/recording/status` after refresh
- Pause recording ≠ call hold
- Staging should measure pause/resume audio reflection (~1s target)
