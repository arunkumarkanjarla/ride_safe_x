---

# Asterisk Debugging & Troubleshooting

The following CLI commands are commonly used during development, deployment, debugging, and production support of the Enterprise Call Center Pro telephony platform.

## Connect to Asterisk CLI

```bash
asterisk -r
```

Connect to the running Asterisk console.

```bash
asterisk -rvvv
```

Connect with increased verbosity.

```bash
asterisk -rx "<command>"
```

Execute a single CLI command remotely.

Example:

```bash
asterisk -rx "core show channels"
```

---

## General Debugging

Increase console verbosity

```bash
core set verbose 5
```

Enable debugging

```bash
core set debug 5
```

Disable debugging

```bash
core set debug off
```

Rotate log files

```bash
logger rotate
```

Show active channels

```bash
core show channels
```

Display channel information

```bash
core show channel <channel>
```

Show dialplan

```bash
dialplan show
```

Reload dialplan

```bash
dialplan reload
```

---

## PJSIP Debugging

Show endpoints

```bash
pjsip show endpoints
```

Show contacts

```bash
pjsip show contacts
```

Show registrations

```bash
pjsip show registrations
```

Show transports

```bash
pjsip show transports
```

Enable SIP packet logging

```bash
pjsip set logger on
```

Disable SIP packet logging

```bash
pjsip set logger off
```

Reload PJSIP

```bash
pjsip reload
```

---

## chan_sip (Legacy)

List SIP peers

```bash
sip show peers
```

Peer details

```bash
sip show peer <peer>
```

Registrations

```bash
sip show registry
```

Enable SIP debugging

```bash
sip set debug on
```

Disable SIP debugging

```bash
sip set debug off
```

Reload SIP

```bash
sip reload
```

---

## RTP Debugging

Enable RTP debugging

```bash
rtp set debug on
```

Debug RTP for a specific IP

```bash
rtp set debug ip <ip>
```

Disable RTP debugging

```bash
rtp set debug off
```

---

## AGI / AMI Debugging

Enable AGI debugging

```bash
agi set debug on
```

Disable AGI debugging

```bash
agi set debug off
```

Show connected AMI clients

```bash
manager show connected
```

Enable AMI debugging

```bash
manager set debug on
```

Disable AMI debugging

```bash
manager set debug off
```

---

## Module Management

List loaded modules

```bash
module show
```

Reload all modules

```bash
module reload
```

Load a module

```bash
module load <module>
```

Unload a module

```bash
module unload <module>
```

---

## AstDB Commands

Show database

```bash
database show
```

Read a key

```bash
database get <family> <key>
```

Write a key

```bash
database put <family> <key> <value>
```

Delete a key

```bash
database del <family> <key>
```

---

## Codec Information

List supported codecs

```bash
core show codecs
```

Show codec translation matrix

```bash
core show translation
```

---

## Linux Troubleshooting

Watch Asterisk logs

```bash
tail -f /var/log/asterisk/full
```

Systemd logs

```bash
journalctl -u asterisk -f
```

Capture SIP packets

```bash
tcpdump -i any -nn port 5060
```

Capture RTP packets

```bash
tcpdump -i any udp portrange 10000-20000
```

View listening ports

```bash
ss -tulpn
```

---

## Recommended Debugging Workflow

1. Connect to the Asterisk CLI.
2. Increase verbosity (`core set verbose 5`).
3. Enable SIP logging (`pjsip set logger on`).
4. Place a test call.
5. Verify channel creation (`core show channels`).
6. Inspect RTP flow if audio issues occur.
7. Review `/var/log/asterisk/full`.
8. Disable debugging after troubleshooting.

> **Note:** Disable verbose logging and protocol debugging after completing troubleshooting to avoid excessive log generation and unnecessary CPU usage in production environments.