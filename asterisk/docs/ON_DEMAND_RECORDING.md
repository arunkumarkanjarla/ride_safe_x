# On-demand recording control (AST-12)

## Architecture

```text
Agent Console → POST /api/v1/agent/recording/control
             → FastAPI recording_control
             → AMI MixMonitor / StopMixMonitor / PauseMixMonitor / UnpauseMixMonitor
             → local spool /var/spool/asterisk/monitor
```

No Asterisk restart. No dialplan reload per action.

## Campaign policy

| Policy | Behavior |
|--------|----------|
| `always_record` | Auto MixMonitor remains; agent **cannot** stop/pause |
| `agent_controlled` | Agent may start/stop/pause/resume |
| `disabled` | Control actions rejected |

Env default: `RECORDING_DEFAULT_POLICY=always_record`  
Campaign column: `telephony.campaigns.recording_policy`

## API

`POST /api/v1/agent/recording/control` body: `{ "action": "start|stop|pause|resume", "channel_name": optional }`  
Permission: `recording.control`

## Audit

`media.recording_control_events` + `audit_logs` action `recording.control.*`  
Results: `recording_started|stopped|paused|resumed|recording_failed`

## Metrics

`japit_recordings_started_total`, `…_stopped_total`, `…_paused_total`, `…_resumed_total`, `japit_recording_control_failures_total`
