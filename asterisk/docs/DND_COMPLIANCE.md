# DND Compliance (Asterisk side)

Outbound compliance (TRAI DND + consent + campaign DNC) is enforced in **Python before AMI Originate**.

Asterisk must never be the first DND gate.

Dialplan continues to enforce:

- AST-15 toll-fraud (`japit-tollfraud-check`)
- AST-06 trunk failover (`japit-pstn-dial`)

If a blocked number somehow reaches Asterisk, that is a control-plane defect — escalate.

Emergency routing may bypass DND restrictions only via existing emergency policy flags; this is unrelated to TRAI list refresh.
