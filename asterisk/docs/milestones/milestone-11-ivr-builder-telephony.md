# Milestone 11 IVR Builder Telephony Contract

## Scope

Milestone 11 adds versioned IVR builder publish support on top of the existing Japit PostgreSQL IVR lookup contract without replacing the brownfield PBX ownership boundary.

## Brownfield Boundary

- Milestone 11 does not modify `/opt/asterisk-api`
- Milestone 11 does not replace the existing dialplan function contract established in Milestone 7
- Milestone 11 does not introduce a new PBX daemon or new SIP ownership layer
- existing IVRs without published builder state continue using the legacy runtime path

## PBX-Facing Runtime Inputs

The existing Asterisk lookup contract remains the same at the function-call level:

- `public.get_japit_ivr_welcome(text)`
- `public.get_japit_ivr_invalid(text)`
- `public.get_japit_ivr_timeout_seconds(text)`
- `public.get_japit_ivr_default_type(text)`
- `public.get_japit_ivr_default_target(text)`
- `public.get_japit_ivr_action_type(text, text)`
- `public.get_japit_ivr_action_target(text, text)`

No new PBX credentials were introduced for this milestone.

## PostgreSQL Runtime Change

Milestone 11 revision `20260704_0010` adds wrapper behavior to those same IVR lookup functions:

- first read compiled published IVR runtime rows from `ivr_published_states` and `ivr_published_options`
- if no compiled published version exists for the IVR, fall back to the legacy `ivrs` plus `ivr_menu_options` implementation

This preserves the live PBX call contract while enabling builder draft and publish control in the application layer.

## Published Runtime Tables

Publish writes the PBX-facing contract into:

- `public.ivr_published_states`
- `public.ivr_published_options`

Those tables store:

- prompt references
- timeout and retry behavior
- business-hours and holiday route overrides
- default route type and target
- menu digit action type and target mappings

## Webhook Runtime Note

Webhook nodes compile to `action_type=webhook` plus the configured target URL in the published runtime state.

Manual webhook testing is executed from FastAPI, not from Asterisk.

Any live PBX consumer that wants to act on published webhook nodes must continue honoring the existing lookup contract and explicitly handle the `webhook` action type on the dialplan or app side.

## Data Ownership

Milestone 11 stores application-owned edit and publish state in:

- `public.ivr_flow_versions`
- `public.ivr_flow_nodes`
- `public.ivr_flow_edges`
- `public.ivr_webhook_test_runs`
- `public.ivr_published_states`
- `public.ivr_published_options`
- `audit.audit_logs`

## Operational Notes

- published builder versions are explicit and operator-driven
- the current PBX-facing lookup path remains deterministic because only one published builder runtime state is active per IVR
- rollback remains simple because the legacy lookup path still exists as the direct fallback when published builder state is absent
