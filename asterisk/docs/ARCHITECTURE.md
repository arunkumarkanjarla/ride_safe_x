# Asterisk architecture — how Japit Call Center telephony works

## System context

```mermaid
flowchart TB
  subgraph Users
    AgentUI[Agent React + WebRTC]
    SupUI[Supervisor UI]
    Desk[X-Lite / desk phone]
    PSTN[PSTN / trunk]
  end

  subgraph App["192.168.20.26 app plane"]
    NGX[NGINX]
    API1[FastAPI leader :8101]
    APIX[FastAPI replicas :8102-8106]
  end

  subgraph PBX["Asterisk"]
    PJSIP[PJSIP endpoints]
    DP[Dialplan japit-* + legacy]
    Q[Queues realtime]
    AMI[AMI manager_japit]
    ODBC[ODBC japit_call_center]
  end

  subgraph Data
    PG[(PostgreSQL)]
    Redis[(Redis)]
    Rec[/var/spool/asterisk/monitor/]
  end

  AgentUI -->|HTTPS + WSS SIP| NGX
  SupUI --> NGX
  NGX -->|API| API1
  NGX -->|API LB| APIX
  API1 -->|AMI Events/Actions| AMI
  AMI --> PJSIP
  AMI --> DP
  AMI --> Q
  Desk --> PJSIP
  AgentUI -->|RTP/WebRTC| PJSIP
  PSTN --> DP
  DP --> Q
  DP --> ODBC
  ODBC --> PG
  API1 --> PG
  API1 --> Redis
  DP --> Rec
  API1 -->|recording sync| Rec
```

## Inbound call flow

```mermaid
sequenceDiagram
  participant Trunk as Trunk/PSTN
  participant Ast as Asterisk
  participant ODBC as Japit ODBC
  participant Q as Queue
  participant Agent as Agent endpoint
  participant API as FastAPI AMI listener

  Trunk->>Ast: INVITE to DID
  Ast->>Ast: direct-inbound → japit-pre-router
  Ast->>ODBC: lookup DID / campaign / IVR
  alt Japit route exists
    Ast->>Ast: japit-inbound / japit-ivr / japit-queue
    Ast->>Q: Queue enter
    Q->>Agent: Ring member
    Ast->>API: AMI Queue/Dial/Bridge/Hangup events
    API->>API: presence + session in Redis/DB
  else No Japit route
    Ast->>Ast: fallback legacy inbound
  end
```

## Outbound / WebRTC agent flow

```mermaid
sequenceDiagram
  participant UI as React Agent
  participant API as FastAPI
  participant Ast as Asterisk AMI/PJSIP
  participant Cust as Customer

  UI->>API: Ready
  API->>Ast: unpause / queue member state
  UI->>Ast: WebRTC REGISTER (via SIP WS bridge)
  UI->>API: Click dial
  API->>Ast: Originate
  Ast->>Cust: Outbound leg
  Ast->>API: AMI events (ringing, answer, hangup)
  API->>UI: realtime poll / call state
  UI->>API: disposition / wrap-up
```

## Dialplan contexts (Japit)

Implemented primarily in `etc_asterisk/extensions_japit.conf` (included from `extensions.conf`):

| Context | Purpose |
|---------|---------|
| `japit-pre-router` | DID → Japit route or legacy fallback |
| `japit-inbound` | Inbound campaign entry |
| `japit-ivr` / `japit-ivr-default` / `japit-ivr-dispatch` | IVR menus |
| `japit-queue` | Queue delivery + AST-28 sticky preference (CURL then Queue()) |
| `japit-extension-route` | Direct extension |
| `japit-callback` | Callbacks |
| `japit-voicemail` | VM |
| `japit-app-outbound` | App-driven outbound |
| `japit-heartbeat` | Agent heartbeat hooks |
| `japit-recording-hangup` | Recording finalize events |
| `japit-rtp-qos-hangup` | AST-26 CHANNEL(rtpqos) UserEvent (Return only) |
| `japit-payment-start` | AST-27 PCI payment mode: PauseMixMonitor + no digit logging (Return only) |
| `japit-payment-end` | AST-27 resume MixMonitor only when `JAPIT_PAYMENT_SAFE=1` (Return only) |
| `japit-internal` | Internal routing |

## Control planes

| Plane | Mechanism | Consumer |
|-------|-----------|----------|
| Call control / presence | AMI (`manager_japit.conf`) | FastAPI leader only |
| Optional ARI | `ari_japit.conf` | tooling / future |
| Realtime queues | `extconfig` + Postgres tables | Asterisk + admin UI |
| Business data | ODBC funcs | Dialplan |

## Leader vs replicas (app side)

When FastAPI runs as Docker ×6:

- **Only fastapi-1** should run AMI listener, dispatch, recording sync, queue recovery
- Replicas serve HTTP API
- NGINX pins agent telephony + realtime poll + SIP WS to **8101**

See app Docker pack: `docs/DOCKER_FASTAPI_LB.md` / telephony RCA.

## Optional Asterisk-2 peer (manual operation)

AST-03 permits a second Asterisk peer with the same Git-managed configuration,
modules/codecs, realtime data, and shared media storage. Each PBX retains its
own SIP/RTP identity and node-local AMI ACL. FastAPI is manually pinned to one
AMI host at a time. This is not automatic HA: there is no Keepalived, SIP VIP,
automatic trunk failover, or automatic AMI failover. See
`docs/ASTERISK_PEER_DEPLOYMENT.md` and `peers/README.md`.

## Visual overview

![Pin-to-pin overview](images/japit-callcenter-project-overview-pin-to-pin.png)

*(File included when present on the source server.)*
