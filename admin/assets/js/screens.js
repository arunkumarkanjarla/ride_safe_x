/* Screens of the Admin portal and the screens of other applications it links to. */
window.RN_SCREENS = {
 "A01": {
  "app": "admin",
  "title": "Admin login & MFA",
  "to": [
   "A02"
  ],
  "from": []
 },
 "A02": {
  "app": "admin",
  "title": "Operations command center",
  "to": [
   "A03",
   "A13",
   "A07",
   "A12",
   "A14",
   "A11",
   "A04"
  ],
  "from": [
   "A01"
  ]
 },
 "A03": {
  "app": "admin",
  "title": "Live map",
  "to": [
   "A04",
   "A06"
  ],
  "from": [
   "A02",
   "A06"
  ]
 },
 "A04": {
  "app": "admin",
  "title": "Rides",
  "to": [
   "A11",
   "A13",
   "A15"
  ],
  "from": [
   "A02",
   "A03",
   "A05",
   "A11",
   "A12",
   "A30",
   "A13",
   "A15"
  ]
 },
 "A27": {
  "app": "admin",
  "title": "Food & parcel orders",
  "to": [
   "A24",
   "A12"
  ],
  "from": []
 },
 "A23": {
  "app": "admin",
  "title": "Services & countries",
  "to": [
   "A22",
   "A25"
  ],
  "from": [
   "A24"
  ]
 },
 "A26": {
  "app": "admin",
  "title": "Long-distance & sharing",
  "to": [
   "A25",
   "A09"
  ],
  "from": [
   "A25"
  ]
 },
 "A25": {
  "app": "admin",
  "title": "Network coverage map",
  "to": [
   "A26"
  ],
  "from": [
   "A23",
   "A26"
  ]
 },
 "A24": {
  "app": "admin",
  "title": "Partner onboarding review",
  "to": [
   "A23"
  ],
  "from": [
   "A27"
  ]
 },
 "A05": {
  "app": "admin",
  "title": "Riders",
  "to": [
   "A04",
   "A14"
  ],
  "from": [
   "A14"
  ]
 },
 "A06": {
  "app": "admin",
  "title": "Drivers",
  "to": [
   "A07",
   "A08",
   "A03"
  ],
  "from": [
   "A03",
   "A07",
   "A08",
   "A14"
  ]
 },
 "A07": {
  "app": "admin",
  "title": "KYC review",
  "to": [
   "A06"
  ],
  "from": [
   "A02",
   "A06"
  ]
 },
 "A08": {
  "app": "admin",
  "title": "Vehicles & fleet",
  "to": [
   "A06"
  ],
  "from": [
   "A06"
  ]
 },
 "A09": {
  "app": "admin",
  "title": "Pricing & surge",
  "to": [
   "A10",
   "A16",
   "A29"
  ],
  "from": [
   "A26",
   "A29",
   "A10",
   "A16"
  ]
 },
 "A29": {
  "app": "admin",
  "title": "Daily fees, taxes & zone rates",
  "to": [
   "A09",
   "A10",
   "A11"
  ],
  "from": [
   "A09"
  ]
 },
 "A10": {
  "app": "admin",
  "title": "Zones & geofences",
  "to": [
   "A09"
  ],
  "from": [
   "A09",
   "A29"
  ]
 },
 "A11": {
  "app": "admin",
  "title": "Payments & refunds",
  "to": [
   "A04",
   "A17"
  ],
  "from": [
   "A02",
   "A04",
   "A29",
   "A12",
   "A30"
  ]
 },
 "A28": {
  "app": "admin",
  "title": "Deals & loyalty",
  "to": [
   "A21",
   "A14"
  ],
  "from": []
 },
 "A12": {
  "app": "admin",
  "title": "Support tickets",
  "to": [
   "A04",
   "A11"
  ],
  "from": [
   "A02",
   "A27",
   "A30",
   "A31"
  ]
 },
 "A30": {
  "app": "admin",
  "title": "Disputes",
  "to": [
   "A11",
   "A12",
   "A04"
  ],
  "from": []
 },
 "A13": {
  "app": "admin",
  "title": "Safety & SOS console",
  "to": [
   "A18",
   "A04"
  ],
  "from": [
   "A02",
   "A04"
  ]
 },
 "A14": {
  "app": "admin",
  "title": "Fraud review queue",
  "to": [
   "A05",
   "A06"
  ],
  "from": [
   "A02",
   "A05",
   "A28"
  ]
 },
 "A15": {
  "app": "admin",
  "title": "Telephony console",
  "to": [
   "A04"
  ],
  "from": [
   "A04",
   "A31"
  ]
 },
 "A31": {
  "app": "admin",
  "title": "Agent portal control",
  "to": [
   "A12",
   "A15",
   "A19"
  ],
  "from": []
 },
 "A16": {
  "app": "admin",
  "title": "AI insights",
  "to": [
   "A09"
  ],
  "from": [
   "A09"
  ]
 },
 "A17": {
  "app": "admin",
  "title": "Reports & analytics",
  "to": [
   "A18"
  ],
  "from": [
   "A11",
   "A21"
  ]
 },
 "A18": {
  "app": "admin",
  "title": "Government reports",
  "to": [
   "A19"
  ],
  "from": [
   "A13",
   "A17"
  ]
 },
 "A19": {
  "app": "admin",
  "title": "Audit log",
  "to": [
   "A20"
  ],
  "from": [
   "A31",
   "A18",
   "A20",
   "A22"
  ]
 },
 "A20": {
  "app": "admin",
  "title": "Roles & permissions",
  "to": [
   "A19"
  ],
  "from": [
   "A19"
  ]
 },
 "A21": {
  "app": "admin",
  "title": "Notifications & campaigns",
  "to": [
   "A17"
  ],
  "from": [
   "A28"
  ]
 },
 "A22": {
  "app": "admin",
  "title": "System configuration",
  "to": [
   "A19"
  ],
  "from": [
   "A23"
  ]
 }
};
