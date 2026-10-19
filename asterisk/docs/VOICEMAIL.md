# AST-24 Voicemail mailboxes

Japit agent mailboxes use Asterisk `VoiceMail()` when `ODBC_GET_JAPIT_VM_ENABLED` returns `1`. Otherwise the existing `Record()` DID/IVR/queue dump path is unchanged.

## Dialplan

`[japit-voicemail]`:

1. Look up `ODBC_GET_JAPIT_VM_ENABLED(${JAPIT_MAILBOX})`
2. If `1`: `VoiceMail(${JAPIT_MAILBOX}@japit,u)` then hangup handler `JapitVoicemailSaved`
3. Else: existing `Record()` dump under `/var/spool/asterisk/voicemail/default/japit/...`

Do not edit VICIDIAL `voicemail.conf`. Include the generated file from the Japit-managed voicemail config:

```
#include voicemail_japit.conf
```

`voicemail_japit.conf` holds Asterisk **system** mailbox secrets, not agent PINs.

## MWI

PJSIP realtime `mailboxes={ext}@japit` is written by `telephony_sync` when an enabled Japit mailbox matches the extension number. Native app_voicemail MWI is primary. AMI `MWIUpdate` is best-effort fallback.

Endpoint notes:

- WebRTC (`{ext}ws`) and deskphone (`{ext}`) both receive the same mailbox hint.
- MWI subscribe support depends on the phone/softphone. The agent UI unread count does not replace native MWI.

## Greetings

Custom unavailable/busy greetings are stored as `{shared_voicemail_root}/japit/{mailbox}/unavail.wav` (and `busy.wav`). Paths are never taken from API input.

## Rollback

Set `VOICEMAIL_ENABLED=false` to disable product APIs and email drain. Existing `Record()` dump and normal calling continue. To force the Record() path for a mailbox, disable the mailbox row (ODBC returns `0`).

## Staging CLI (authorized only)

```
asterisk -rx "module show like voicemail"
asterisk -rx "voicemail show users"
asterisk -rx "dialplan show japit-voicemail"
asterisk -rx "pjsip show endpoints"
```
