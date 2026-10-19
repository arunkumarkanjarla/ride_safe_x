# WebRTC SIP WS from Windows laptop (2026-08-04)

## Context

Agent Browser WebRTC on a Windows laptop failed because the app tried:

`ws://host.docker.internal/asterisk/ws`

Asterisk (and nginx `/asterisk/ws`) live on **`192.168.20.26`**.

## Asterisk side

No config change required for this incident. Confirmed from the laptop:

| Target | Result |
|--------|--------|
| `ws://192.168.20.26/asterisk/ws` (nginx → Asterisk) | 101 Switching Protocols |
| `ws://192.168.20.26:8088/ws` (Asterisk `http.conf` bindport) | 101 Switching Protocols |

Relevant config already in tree:

- `http.conf` — `enabled=yes`, `bindaddr=0.0.0.0`, `bindport=8088`
- `pjsip.conf` — `external_media_address` / `external_signaling_address` = `192.168.20.26`

## App fix location

Python credentials + FastAPI SIP bridge (not Asterisk):

`python-git/python-service/docs/operations/WEBRTC_SIP_WS_HOST_FIX_2026-08-04.md`
