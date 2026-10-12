/* Screens of the Customer app and the screens of other applications it links to. */
window.RN_SCREENS = {
 "R01": {
  "app": "rider",
  "title": "Splash",
  "to": [
   "R02",
   "R03",
   "R29"
  ],
  "from": []
 },
 "R02": {
  "app": "rider",
  "title": "Onboarding",
  "to": [
   "R03"
  ],
  "from": [
   "R01"
  ]
 },
 "R58": {
  "app": "rider",
  "title": "Sign in or create account",
  "to": [
   "R03",
   "R57"
  ],
  "from": [
   "R57"
  ]
 },
 "R57": {
  "app": "rider",
  "title": "Terms & privacy",
  "to": [
   "R58"
  ],
  "from": [
   "R58"
  ]
 },
 "R03": {
  "app": "rider",
  "title": "Login with phone",
  "to": [
   "R04"
  ],
  "from": [
   "R01",
   "R02",
   "R58",
   "R28"
  ]
 },
 "R04": {
  "app": "rider",
  "title": "Verify OTP",
  "to": [
   "R05",
   "R29"
  ],
  "from": [
   "R03"
  ]
 },
 "R05": {
  "app": "rider",
  "title": "Profile setup",
  "to": [
   "R06"
  ],
  "from": [
   "R04"
  ]
 },
 "R06": {
  "app": "rider",
  "title": "Permissions",
  "to": [
   "R29"
  ],
  "from": [
   "R05"
  ]
 },
 "R53": {
  "app": "rider",
  "title": "Country, language & currency",
  "to": [
   "R29"
  ],
  "from": []
 },
 "R29": {
  "app": "rider",
  "title": "All services home",
  "to": [
   "R30",
   "R07",
   "R32",
   "R44",
   "R47",
   "R41",
   "R43",
   "R36",
   "R49",
   "R52",
   "R51",
   "R54"
  ],
  "from": [
   "R01",
   "R04",
   "R06",
   "R53",
   "R07"
  ]
 },
 "R30": {
  "app": "rider",
  "title": "Choose your priority",
  "to": [
   "R31",
   "R33",
   "R44"
  ],
  "from": [
   "R29"
  ]
 },
 "R52": {
  "app": "rider",
  "title": "AI trip assistant",
  "to": [
   "R36"
  ],
  "from": [
   "R29"
  ]
 },
 "R51": {
  "app": "rider",
  "title": "Emergency mode",
  "to": [
   "R12"
  ],
  "from": [
   "R29"
  ]
 },
 "R07": {
  "app": "rider",
  "title": "Ride home map",
  "to": [
   "R08",
   "R23",
   "R29"
  ],
  "from": [
   "R29",
   "R18",
   "R21"
  ]
 },
 "R08": {
  "app": "rider",
  "title": "Search destination",
  "to": [
   "R31",
   "R09"
  ],
  "from": [
   "R07"
  ]
 },
 "R31": {
  "app": "rider",
  "title": "Compare by priority",
  "to": [
   "R09",
   "R10",
   "R36"
  ],
  "from": [
   "R30",
   "R08",
   "R49"
  ]
 },
 "R09": {
  "app": "rider",
  "title": "Ride options & fare",
  "to": [
   "R10",
   "R22",
   "R55"
  ],
  "from": [
   "R08",
   "R31",
   "R11",
   "R22"
  ]
 },
 "R10": {
  "app": "rider",
  "title": "Confirm pickup & pay",
  "to": [
   "R11"
  ],
  "from": [
   "R31",
   "R09"
  ]
 },
 "R11": {
  "app": "rider",
  "title": "Finding driver",
  "to": [
   "R12",
   "R09"
  ],
  "from": [
   "R10"
  ]
 },
 "R12": {
  "app": "rider",
  "title": "Driver assigned",
  "to": [
   "R13",
   "R14",
   "R15",
   "R16"
  ],
  "from": [
   "R51",
   "R11",
   "R13",
   "R14"
  ]
 },
 "R13": {
  "app": "rider",
  "title": "Masked call",
  "to": [
   "R12"
  ],
  "from": [
   "R12",
   "R14"
  ]
 },
 "R14": {
  "app": "rider",
  "title": "In-ride chat",
  "to": [
   "R12",
   "R13"
  ],
  "from": [
   "R12",
   "R15"
  ]
 },
 "R15": {
  "app": "rider",
  "title": "Trip in progress",
  "to": [
   "R16",
   "R17",
   "R14"
  ],
  "from": [
   "R12",
   "R16"
  ]
 },
 "R16": {
  "app": "rider",
  "title": "SOS emergency",
  "to": [
   "R15"
  ],
  "from": [
   "R12",
   "R15"
  ]
 },
 "R17": {
  "app": "rider",
  "title": "Trip complete & payment",
  "to": [
   "R18",
   "R19",
   "R27",
   "R55"
  ],
  "from": [
   "R15"
  ]
 },
 "R18": {
  "app": "rider",
  "title": "Rate driver",
  "to": [
   "R07"
  ],
  "from": [
   "R17",
   "R46"
  ]
 },
 "R19": {
  "app": "rider",
  "title": "Invoice",
  "to": [
   "R20",
   "R55"
  ],
  "from": [
   "R17",
   "R55",
   "R20"
  ]
 },
 "R55": {
  "app": "rider",
  "title": "Where your money went",
  "to": [
   "R19",
   "R27"
  ],
  "from": [
   "R09",
   "R17",
   "R19"
  ]
 },
 "R23": {
  "app": "rider",
  "title": "Schedule a ride",
  "to": [
   "R20"
  ],
  "from": [
   "R07",
   "R20"
  ]
 },
 "R32": {
  "app": "rider",
  "title": "Long-distance search",
  "to": [
   "R33"
  ],
  "from": [
   "R29"
  ]
 },
 "R33": {
  "app": "rider",
  "title": "Long-distance options",
  "to": [
   "R34",
   "R35",
   "R43",
   "R38",
   "R36"
  ],
  "from": [
   "R30",
   "R32"
  ]
 },
 "R34": {
  "app": "rider",
  "title": "Shared seat details",
  "to": [
   "R36",
   "R39"
  ],
  "from": [
   "R33"
  ]
 },
 "R35": {
  "app": "rider",
  "title": "Bus seat & boarding point",
  "to": [
   "R36",
   "R54"
  ],
  "from": [
   "R33"
  ]
 },
 "R43": {
  "app": "rider",
  "title": "Car & bike rentals",
  "to": [
   "R36",
   "R54"
  ],
  "from": [
   "R29",
   "R33"
  ]
 },
 "R36": {
  "app": "rider",
  "title": "Trip plan (multi-leg)",
  "to": [
   "R37",
   "R38",
   "R39",
   "R41",
   "R54"
  ],
  "from": [
   "R29",
   "R52",
   "R31",
   "R33",
   "R34",
   "R35",
   "R43",
   "R37",
   "R38",
   "R40",
   "R42",
   "R54"
  ]
 },
 "R37": {
  "app": "rider",
  "title": "Stops along the route",
  "to": [
   "R36",
   "R41"
  ],
  "from": [
   "R36",
   "R38"
  ]
 },
 "R38": {
  "app": "rider",
  "title": "No-network warning",
  "to": [
   "R39",
   "R37",
   "R36"
  ],
  "from": [
   "R33",
   "R36"
  ]
 },
 "R39": {
  "app": "rider",
  "title": "Offline pack & backup plan",
  "to": [
   "R40"
  ],
  "from": [
   "R34",
   "R36",
   "R38"
  ]
 },
 "R40": {
  "app": "rider",
  "title": "Travelling offline",
  "to": [
   "R36"
  ],
  "from": [
   "R39"
  ]
 },
 "R41": {
  "app": "rider",
  "title": "Hotels",
  "to": [
   "R42"
  ],
  "from": [
   "R29",
   "R36",
   "R37"
  ]
 },
 "R42": {
  "app": "rider",
  "title": "Hotel detail & booking",
  "to": [
   "R36",
   "R54"
  ],
  "from": [
   "R41"
  ]
 },
 "R44": {
  "app": "rider",
  "title": "Food home",
  "to": [
   "R45"
  ],
  "from": [
   "R29",
   "R30"
  ]
 },
 "R45": {
  "app": "rider",
  "title": "Menu & cart",
  "to": [
   "R46"
  ],
  "from": [
   "R44"
  ]
 },
 "R46": {
  "app": "rider",
  "title": "Food order tracking",
  "to": [
   "R18"
  ],
  "from": [
   "R45",
   "R54",
   "R56"
  ]
 },
 "R47": {
  "app": "rider",
  "title": "Send a parcel",
  "to": [
   "R48"
  ],
  "from": [
   "R29"
  ]
 },
 "R48": {
  "app": "rider",
  "title": "Parcel tracking & proof",
  "to": [
   "R27"
  ],
  "from": [
   "R47",
   "R54"
  ]
 },
 "R49": {
  "app": "rider",
  "title": "Deals & savings hub",
  "to": [
   "R22",
   "R50",
   "R31"
  ],
  "from": [
   "R29",
   "R50"
  ]
 },
 "R50": {
  "app": "rider",
  "title": "Flexible: price alert",
  "to": [
   "R49",
   "R54"
  ],
  "from": [
   "R49"
  ]
 },
 "R22": {
  "app": "rider",
  "title": "Offers & coupons",
  "to": [
   "R09"
  ],
  "from": [
   "R09",
   "R49"
  ]
 },
 "R21": {
  "app": "rider",
  "title": "Wallet",
  "to": [
   "R07"
  ],
  "from": [
   "R28"
  ]
 },
 "R54": {
  "app": "rider",
  "title": "Trips & tickets",
  "to": [
   "R36",
   "R48",
   "R46"
  ],
  "from": [
   "R29",
   "R35",
   "R43",
   "R36",
   "R42",
   "R50",
   "R56"
  ]
 },
 "R56": {
  "app": "rider",
  "title": "Notifications",
  "to": [
   "R54",
   "R46",
   "S07"
  ],
  "from": []
 },
 "R20": {
  "app": "rider",
  "title": "Ride history",
  "to": [
   "R19",
   "R27",
   "R23"
  ],
  "from": [
   "R19",
   "R23"
  ]
 },
 "R24": {
  "app": "rider",
  "title": "Emergency contacts",
  "to": [
   "R28"
  ],
  "from": [
   "R28"
  ]
 },
 "R25": {
  "app": "rider",
  "title": "Rider KYC",
  "to": [
   "R28"
  ],
  "from": [
   "R28"
  ]
 },
 "R26": {
  "app": "rider",
  "title": "Support & AI assistant",
  "to": [
   "R27"
  ],
  "from": [
   "R27",
   "R28"
  ]
 },
 "R27": {
  "app": "rider",
  "title": "Complaint / lost item",
  "to": [
   "R26"
  ],
  "from": [
   "R17",
   "R55",
   "R48",
   "R20",
   "R26"
  ]
 },
 "R28": {
  "app": "rider",
  "title": "Account & settings",
  "to": [
   "R24",
   "R25",
   "R21",
   "R26",
   "R03"
  ],
  "from": [
   "R24",
   "R25"
  ]
 }
};
