# Opus WebRTC Diagnostics Checklist (AST-02)

Use this checklist before enabling Opus for a production cohort and when
investigating a codec, RTP, or quality incident.

## Pre-change

- [ ] Confirm the approved WebRTC endpoint allow-list is `opus,ulaw`.
- [ ] Confirm `[Mediant]` remains `allow=alaw,ulaw` and `direct_media=no`.
- [ ] Confirm `codec_opus.so` is installed or that the rollout accepts a
  G.711-only fallback on hosts where it is not yet installed.
- [ ] Run `module show like opus`; record the result.
- [ ] Run `core show codecs`; confirm Opus is listed when the module is loaded.
- [ ] Run `core show translation`; confirm the required Opus ↔ G.711 paths are
  available.
- [ ] Capture baseline Asterisk process CPU, load, packet loss, jitter, and
  MOS/quality evidence for G.711 calls.
- [ ] Ensure the monitoring scraper can collect
  `japit_telephony_opus_enabled`,
  `japit_telephony_codec_negotiated_total`, and
  `japit_telephony_transcode_total`.

## Controlled browser-to-browser call

- [ ] Use two WebRTC endpoints that advertise Opus.
- [ ] Run `pjsip show endpoint {ext}ws` for both endpoints; verify the
  configured allow-list.
- [ ] Inspect INVITE and 200 OK SDP; verify `a=rtpmap` includes Opus and
  identify the selected payload type.
- [ ] Confirm the live call uses Opus from browser diagnostics or Asterisk
  channel/RTCP evidence.
- [ ] Verify direct RTP only when it is expected and both endpoints are
  reachable; record when Asterisk must relay media.
- [ ] Record MOS or quality evidence, loss, jitter, RTT, and CPU.

## Controlled browser-to-Mediant call

- [ ] Inspect browser-leg SDP for Opus and Mediant-leg SDP for PCMU/PCMA.
- [ ] Confirm the Mediant endpoint still reports `allow=alaw,ulaw` and
  `direct_media=no`.
- [ ] Confirm Asterisk remains in the RTP path for the trunk call.
- [ ] Confirm an Opus ↔ `ulaw` or Opus ↔ `alaw` translation occurs only for
  this mixed-codec path.
- [ ] Compare Asterisk CPU with the G.711 baseline and record the active call
  count.
- [ ] Verify voice quality in both directions and record the measurement
  source.

## Live diagnostics

Run only during an approved, isolated test window:

```text
module show like opus
core show codecs
core show translation
pjsip show endpoint {ext}ws
rtp set debug on
rtp set debug off
```

- [ ] Check SDP (`a=rtpmap`, `a=fmtp`) from the SIP trace; do not infer the
  negotiated codec from endpoint configuration alone.
- [ ] Enable `rtp set debug on` only for the selected test call and turn it off
  promptly because it is verbose and may contain call metadata.
- [ ] Correlate metrics and host CPU with the test timestamps.

## Failure triage

- [ ] If `codec_opus.so` is absent, retain `load = codec_opus.so` (not
  `require`) and operate G.711-only until the approved package is installed.
- [ ] If SDP does not offer/answer Opus, inspect the browser capability,
  endpoint allow-list, and `pjsip show endpoint {ext}ws`.
- [ ] If a Mediant call negotiates Opus, stop the rollout: the trunk policy is
  G.711 only.
- [ ] If browser-to-browser calls transcode unexpectedly, identify the
  endpoint allow-lists, recording/features, NAT, and direct-media eligibility.
- [ ] If MOS is below 4.0 or unavailable, retain raw loss/jitter/RTT data and
  investigate before expanding the cohort.

## Rollback verification

- [ ] Set WebRTC endpoint `allow` back to `ulaw,alaw`.
- [ ] Set `ASTERISK_WEBRTC_DIRECT_MEDIA=false`.
- [ ] Reload the approved PJSIP configuration or restart Asterisk per the
  change procedure.
- [ ] Verify the endpoint and SDP now use only the approved G.711 codecs.
- [ ] Confirm new controlled calls succeed and capture post-rollback evidence.
