# Dual-node CDR/CEL + leg stitching (AST-19)

## Node identity

Set `ASTERISK_NODE_ID` / dialplan `GLOBAL(JAPIT_NODE_ID)` per PBX (`pbx-1`, `pbx-2`).

Tagged on:

- `calls.call_reporting_facts.asterisk_node_id`
- `calls.call_legs.asterisk_node_id`
- CDR userfield / CEL extras where dialplan emits node

## Logical calls

`calls.call_legs` groups legs by `logical_call_id` correlated via `linkedid`.  
Transfers set `parent_leg_id` + `transfer_type`.

## API

`GET /api/v1/reports/call-legs/stitch?linkedid=…`  
`GET /api/v1/reports/call-legs/fixture/attended-transfer`

## Reporting rule

Do **not** double-count top-level logical calls — aggregate by `logical_call_id`.
