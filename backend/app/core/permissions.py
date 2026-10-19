"""Stable permission and role codes for Phase 2–4."""

PROFILE_READ_SELF = "profile.read_self"
PROFILE_UPDATE_SELF = "profile.update_self"
USERS_READ = "users.read"
USERS_MANAGE = "users.manage"
ROLES_READ = "roles.read"
ROLES_MANAGE = "roles.manage"
PERMISSIONS_READ = "permissions.read"
AUDIT_READ = "audit.read"

BOOKINGS_CREATE_SELF = "bookings.create_self"
BOOKINGS_READ_SELF = "bookings.read_self"
BOOKINGS_CANCEL_SELF = "bookings.cancel_self"
BOOKINGS_READ = "bookings.read"
BOOKINGS_CANCEL = "bookings.cancel"
DRIVERS_AVAILABILITY_SELF = "drivers.availability_self"
DRIVERS_OFFERS_SELF = "drivers.offers_self"
DRIVERS_TRIPS_SELF = "drivers.trips_self"
DRIVERS_READ = "drivers.read"
DISPATCH_READ = "dispatch.read"
DISPATCH_RETRY = "dispatch.retry"
DISPATCH_MANAGE = "dispatch.manage"
NOTIFICATIONS_READ_SELF = "notifications.read_self"
NOTIFICATIONS_UPDATE_SELF = "notifications.update_self"
NOTIFICATIONS_OPS_HEALTH = "notifications.ops_health"
PAYMENTS_CREATE_SELF = "payments.create_self"
PAYMENTS_READ_SELF = "payments.read_self"

ALL_PERMISSIONS: list[tuple[str, str]] = [
    (PROFILE_READ_SELF, "Read own profile"),
    (PROFILE_UPDATE_SELF, "Update own profile"),
    (USERS_READ, "Read other users"),
    (USERS_MANAGE, "Manage users"),
    (ROLES_READ, "List roles"),
    (ROLES_MANAGE, "Assign roles"),
    (PERMISSIONS_READ, "List permissions"),
    (AUDIT_READ, "Read audit events"),
    (BOOKINGS_CREATE_SELF, "Create own bookings"),
    (BOOKINGS_READ_SELF, "Read own bookings"),
    (BOOKINGS_CANCEL_SELF, "Cancel own bookings"),
    (BOOKINGS_READ, "Read any booking (ops)"),
    (BOOKINGS_CANCEL, "Cancel any eligible booking (ops)"),
    (DRIVERS_AVAILABILITY_SELF, "Set own driver availability"),
    (DRIVERS_OFFERS_SELF, "View/respond to own offers"),
    (DRIVERS_TRIPS_SELF, "Manage own assigned trips"),
    (DRIVERS_READ, "Read driver readiness (ops)"),
    (DISPATCH_READ, "Read dispatch / offers (ops)"),
    (DISPATCH_RETRY, "Retry dispatch for eligible bookings"),
    (DISPATCH_MANAGE, "Manual dispatch / ops (reserved)"),
    (NOTIFICATIONS_READ_SELF, "List own in-app notifications"),
    (NOTIFICATIONS_UPDATE_SELF, "Mark own notifications read"),
    (NOTIFICATIONS_OPS_HEALTH, "View notification processing health (ops)"),
    (PAYMENTS_CREATE_SELF, "Create own sandbox payment attempts"),
    (PAYMENTS_READ_SELF, "Read own payment attempts"),
]

_CUSTOMER = [
    PROFILE_READ_SELF,
    PROFILE_UPDATE_SELF,
    BOOKINGS_CREATE_SELF,
    BOOKINGS_READ_SELF,
    BOOKINGS_CANCEL_SELF,
    NOTIFICATIONS_READ_SELF,
    NOTIFICATIONS_UPDATE_SELF,
    PAYMENTS_CREATE_SELF,
    PAYMENTS_READ_SELF,
]
_DRIVER = [
    PROFILE_READ_SELF,
    PROFILE_UPDATE_SELF,
    DRIVERS_AVAILABILITY_SELF,
    DRIVERS_OFFERS_SELF,
    DRIVERS_TRIPS_SELF,
    NOTIFICATIONS_READ_SELF,
    NOTIFICATIONS_UPDATE_SELF,
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "customer": list(_CUSTOMER),
    "driver": list(_DRIVER),
    "partner": [
        PROFILE_READ_SELF,
        PROFILE_UPDATE_SELF,
        NOTIFICATIONS_READ_SELF,
        NOTIFICATIONS_UPDATE_SELF,
    ],
    "support_agent": [
        PROFILE_READ_SELF,
        PROFILE_UPDATE_SELF,
        USERS_READ,
        AUDIT_READ,
        BOOKINGS_READ,
        DISPATCH_READ,
        DRIVERS_READ,
        NOTIFICATIONS_READ_SELF,
        NOTIFICATIONS_UPDATE_SELF,
        NOTIFICATIONS_OPS_HEALTH,
    ],
    "admin": [
        PROFILE_READ_SELF,
        PROFILE_UPDATE_SELF,
        USERS_READ,
        USERS_MANAGE,
        ROLES_READ,
        PERMISSIONS_READ,
        AUDIT_READ,
        BOOKINGS_READ,
        BOOKINGS_CANCEL,
        DRIVERS_READ,
        DISPATCH_READ,
        DISPATCH_RETRY,
        DISPATCH_MANAGE,
        NOTIFICATIONS_READ_SELF,
        NOTIFICATIONS_UPDATE_SELF,
        NOTIFICATIONS_OPS_HEALTH,
    ],
    "super_admin": [code for code, _ in ALL_PERMISSIONS],
}

ROLE_META: dict[str, tuple[str, str]] = {
    "customer": ("Customer", "Rider / end customer"),
    "driver": ("Driver", "Driver operator"),
    "partner": ("Partner", "Merchant / partner operator"),
    "support_agent": ("Support agent", "Customer support"),
    "admin": ("Administrator", "Operations administrator"),
    "super_admin": ("Super administrator", "Full platform administration"),
}
