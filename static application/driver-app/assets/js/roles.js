/* RideNova prototype – MOCK role/permission matrix (architecture page 10).
   DEMONSTRATION ONLY. Switching roles in the browser is not authorization: anyone can edit this file
   or the stored demo state. Real enforcement belongs to the backend (every service checks permissions). */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.RN = root.RN || {}; root.RN.rbac = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'SAFETY_MANAGER', 'FRAUD_ANALYST', 'FINANCE_MANAGER', 'SUPPORT_AGENT', 'FLEET_MANAGER', 'AUDITOR'];
  var LABELS = { SUPER_ADMIN: 'Super admin', OPS_MANAGER: 'Operations manager', SAFETY_MANAGER: 'Safety manager', FRAUD_ANALYST: 'Fraud analyst',
    FINANCE_MANAGER: 'Finance manager', SUPPORT_AGENT: 'Support agent', FLEET_MANAGER: 'Fleet manager', AUDITOR: 'Auditor' };
  // permission: roles in the same order as ROLES (1 = granted), copied from page 10
  var MATRIX = {
    'ride.view':                 [1, 1, 1, 1, 1, 1, 1, 1],
    'ride.cancel':               [1, 1, 0, 0, 0, 1, 0, 0],
    'driver.verify':             [1, 1, 0, 0, 0, 0, 0, 0],
    'payment.refund':            [1, 0, 0, 0, 1, 1, 0, 0],
    'incident.view':             [1, 1, 1, 1, 0, 1, 0, 1],
    'incident.close':            [1, 0, 1, 0, 0, 0, 0, 0],
    'fraud.block_account':       [1, 0, 0, 1, 0, 0, 0, 0],
    'pricing.edit':              [1, 1, 0, 0, 0, 0, 0, 0],
    'report.export':             [1, 1, 1, 1, 1, 0, 1, 1],
    'government_report.create':  [1, 0, 1, 0, 0, 0, 0, 0],
    'government_report.approve': [1, 0, 0, 0, 0, 0, 0, 0],
    'audit.view':                [1, 0, 0, 0, 0, 0, 0, 1],
    'user.pii.view_full':        [1, 0, 1, 0, 0, 0, 0, 0]
  };
  // Incident handling below "close" (acknowledge/escalate/resolve) is not in the page-10 matrix.
  // Assumption (documented): it needs incident.view plus being a safety or ops role.
  // Further assumptions for admin screens whose actions the matrix does not cover (docs/workflows/rbac.md):
  var EXTRA = {
    'incident.handle': ['SUPER_ADMIN', 'OPS_MANAGER', 'SAFETY_MANAGER'],
    'ride.dispatch': ['SUPER_ADMIN', 'OPS_MANAGER'],
    'ticket.resolve': ['SUPER_ADMIN', 'OPS_MANAGER', 'SUPPORT_AGENT'],
    'coupon.create': ['SUPER_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'],
    'campaign.send': ['SUPER_ADMIN', 'OPS_MANAGER'],
    'partner.approve': ['SUPER_ADMIN', 'OPS_MANAGER'],
    'coverage.publish': ['SUPER_ADMIN', 'OPS_MANAGER'],
    'agentdesk.manage': ['SUPER_ADMIN', 'OPS_MANAGER'],
    'config.edit': ['SUPER_ADMIN']
  };

  function can(role, perm) {
    if (EXTRA[perm]) return EXTRA[perm].indexOf(role) >= 0;
    var row = MATRIX[perm], i = ROLES.indexOf(role);
    return !!(row && i >= 0 && row[i]);
  }
  function rolesWith(perm) { return ROLES.filter(function (r) { return can(r, perm); }); }
  return { ROLES: ROLES, LABELS: LABELS, MATRIX: MATRIX, EXTRA: EXTRA, can: can, rolesWith: rolesWith,
    DISCLAIMER: 'Mock roles for demonstration only. This is not security; the backend will enforce permissions.' };
});
