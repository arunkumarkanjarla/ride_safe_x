/* Screens of the Driver app and the screens of other applications it links to. */
window.RN_SCREENS = {
 "D01": {
  "app": "driver",
  "title": "Driver login",
  "to": [
   "D02",
   "D05"
  ],
  "from": [
   "D28"
  ]
 },
 "D02": {
  "app": "driver",
  "title": "Registration",
  "to": [
   "D03"
  ],
  "from": [
   "D01"
  ]
 },
 "D03": {
  "app": "driver",
  "title": "Upload documents",
  "to": [
   "D04"
  ],
  "from": [
   "D02",
   "D04",
   "D17"
  ]
 },
 "D04": {
  "app": "driver",
  "title": "Verification status",
  "to": [
   "D03",
   "D05"
  ],
  "from": [
   "D03"
  ]
 },
 "D05": {
  "app": "driver",
  "title": "Home (offline)",
  "to": [
   "D06",
   "D17",
   "D13",
   "D16"
  ],
  "from": [
   "D01",
   "D04",
   "D06",
   "D17"
  ]
 },
 "D21": {
  "app": "driver",
  "title": "Choose services",
  "to": [
   "D06",
   "D24"
  ],
  "from": [
   "D28"
  ]
 },
 "D06": {
  "app": "driver",
  "title": "Online & waiting",
  "to": [
   "D07",
   "D05"
  ],
  "from": [
   "D05",
   "D21",
   "D07",
   "D12",
   "D23"
  ]
 },
 "D17": {
  "app": "driver",
  "title": "Document expiry alerts",
  "to": [
   "D03",
   "D05"
  ],
  "from": [
   "D05",
   "D28"
  ]
 },
 "D07": {
  "app": "driver",
  "title": "Incoming ride request",
  "to": [
   "D08",
   "D06"
  ],
  "from": [
   "D06"
  ]
 },
 "D08": {
  "app": "driver",
  "title": "Navigate to pickup",
  "to": [
   "D09",
   "D18"
  ],
  "from": [
   "D07",
   "D29"
  ]
 },
 "D29": {
  "app": "driver",
  "title": "Call rider",
  "to": [
   "D08",
   "D09"
  ],
  "from": []
 },
 "D09": {
  "app": "driver",
  "title": "Arrived & start trip",
  "to": [
   "D10"
  ],
  "from": [
   "D08",
   "D29"
  ]
 },
 "D10": {
  "app": "driver",
  "title": "Trip navigation",
  "to": [
   "D11",
   "D18",
   "D19"
  ],
  "from": [
   "D09",
   "D25",
   "D18",
   "D19"
  ]
 },
 "D11": {
  "app": "driver",
  "title": "Trip complete & collect",
  "to": [
   "D12",
   "D27"
  ],
  "from": [
   "D10"
  ]
 },
 "D12": {
  "app": "driver",
  "title": "Rate rider",
  "to": [
   "D06"
  ],
  "from": [
   "D11"
  ]
 },
 "D22": {
  "app": "driver",
  "title": "Delivery request",
  "to": [
   "D23"
  ],
  "from": []
 },
 "D23": {
  "app": "driver",
  "title": "Pickup & delivery proof",
  "to": [
   "D06"
  ],
  "from": [
   "D22"
  ]
 },
 "D24": {
  "app": "driver",
  "title": "Publish a long trip",
  "to": [
   "D25"
  ],
  "from": [
   "D21"
  ]
 },
 "D25": {
  "app": "driver",
  "title": "Seats & parcels manifest",
  "to": [
   "D26",
   "D10"
  ],
  "from": [
   "D24"
  ]
 },
 "D26": {
  "app": "driver",
  "title": "No-network stretch ahead",
  "to": [
   "D19"
  ],
  "from": [
   "D25"
  ]
 },
 "D18": {
  "app": "driver",
  "title": "Driver SOS",
  "to": [
   "D10"
  ],
  "from": [
   "D08",
   "D10"
  ]
 },
 "D19": {
  "app": "driver",
  "title": "Offline mode & sync",
  "to": [
   "D10"
  ],
  "from": [
   "D10",
   "D26"
  ]
 },
 "D13": {
  "app": "driver",
  "title": "Earnings",
  "to": [
   "D14",
   "D15",
   "D16",
   "D27"
  ],
  "from": [
   "D05",
   "D27",
   "D14",
   "D15"
  ]
 },
 "D27": {
  "app": "driver",
  "title": "Today's earnings & daily fee",
  "to": [
   "D13",
   "D14",
   "D20"
  ],
  "from": [
   "D11",
   "D13",
   "D14"
  ]
 },
 "D14": {
  "app": "driver",
  "title": "Wallet & payouts",
  "to": [
   "D13",
   "D27"
  ],
  "from": [
   "D13",
   "D27",
   "D20"
  ]
 },
 "D15": {
  "app": "driver",
  "title": "Incentives",
  "to": [
   "D13"
  ],
  "from": [
   "D13"
  ]
 },
 "D16": {
  "app": "driver",
  "title": "Trip history",
  "to": [
   "D20"
  ],
  "from": [
   "D05",
   "D13",
   "D20"
  ]
 },
 "D20": {
  "app": "driver",
  "title": "Driver support",
  "to": [
   "D16",
   "D14"
  ],
  "from": [
   "D27",
   "D16",
   "D28"
  ]
 },
 "D28": {
  "app": "driver",
  "title": "Account & profile",
  "to": [
   "D17",
   "D21",
   "D20",
   "D01"
  ],
  "from": []
 }
};
