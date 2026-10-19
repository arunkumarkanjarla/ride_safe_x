-- AST-02 one-time WebRTC endpoint codec reconciliation.
-- Review the affected endpoint count before applying in production.
UPDATE telephony.japit_ps_endpoints
SET allow = 'opus,ulaw',
    direct_media = 'yes'
WHERE webrtc = 'yes'
   OR id LIKE '%ws';
