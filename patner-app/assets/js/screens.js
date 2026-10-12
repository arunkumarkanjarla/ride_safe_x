/* Screens of the Partner app and the screens of other applications it links to. */
window.RN_SCREENS = {
 "P08": {
  "app": "partner",
  "title": "Partner sign-in",
  "to": [
   "P09",
   "P01"
  ],
  "from": [
   "P10"
  ]
 },
 "P01": {
  "app": "partner",
  "title": "Partner onboarding",
  "to": [
   "P02",
   "P04",
   "P05",
   "P06"
  ],
  "from": [
   "P08"
  ]
 },
 "P09": {
  "app": "partner",
  "title": "Partner home",
  "to": [
   "P02",
   "P03",
   "P04",
   "P05",
   "P06",
   "P07"
  ],
  "from": [
   "P08"
  ]
 },
 "P02": {
  "app": "partner",
  "title": "Restaurant orders",
  "to": [
   "P03",
   "P07"
  ],
  "from": [
   "P01",
   "P09",
   "P03",
   "P07"
  ]
 },
 "P03": {
  "app": "partner",
  "title": "Menu & availability",
  "to": [
   "P02"
  ],
  "from": [
   "P09",
   "P02"
  ]
 },
 "P04": {
  "app": "partner",
  "title": "Rooms, rates & bookings",
  "to": [
   "P07"
  ],
  "from": [
   "P01",
   "P09"
  ]
 },
 "P05": {
  "app": "partner",
  "title": "Rental fleet calendar",
  "to": [
   "P07"
  ],
  "from": [
   "P01",
   "P09"
  ]
 },
 "P06": {
  "app": "partner",
  "title": "Bus schedule & seats",
  "to": [
   "P07"
  ],
  "from": [
   "P01",
   "P09"
  ]
 },
 "P07": {
  "app": "partner",
  "title": "Payouts & reviews",
  "to": [
   "P02"
  ],
  "from": [
   "P09",
   "P02",
   "P04",
   "P05",
   "P06"
  ]
 },
 "P10": {
  "app": "partner",
  "title": "Business profile & settings",
  "to": [
   "P11",
   "P08"
  ],
  "from": []
 },
 "P11": {
  "app": "partner",
  "title": "Support & complaints",
  "to": [],
  "from": [
   "P10"
  ]
 }
};
