/* RideNova bundled default platform config (shared by all 5 apps).
   The admin portal (admin/control.html) writes a versioned copy to localStorage "ridenova.platform.v1";
   apps fall back to this bundle when nothing is stored. Export/Import in admin produces the same JSON shape. */
window.RN_PLATFORM_DEFAULT = {
  schema: 1, version: 1, updatedAt: 0, updatedBy: 'bundle', history: [],
  defaultCity: 'HYD',
  services: [
    { id: 'ride', label: 'Ride', icon: 'car', go: 'R07', arg: null, badge: '', on: true, order: 1 },
    { id: 'bike', label: 'Bike taxi', icon: 'bike', go: 'R59', arg: 'Bike', badge: '', on: true, order: 2 },
    { id: 'auto', label: 'Auto', icon: 'auto', go: 'R59', arg: 'Auto', badge: '', on: true, order: 3 },
    { id: 'intercity', label: 'Long trip', icon: 'map', go: 'R32', arg: null, badge: 'NEW', on: true, order: 4 },
    { id: 'share', label: 'Share seat', icon: 'users', go: 'R33', arg: 'share', badge: '-40%', on: true, order: 5 },
    { id: 'bus', label: 'Bus', icon: 'bus', go: 'R33', arg: 'bus', badge: '', on: true, order: 6 },
    { id: 'rentals', label: 'Rentals', icon: 'key', go: 'R43', arg: null, badge: '', on: true, order: 7 },
    { id: 'hotels', label: 'Hotels', icon: 'bed', go: 'R41', arg: null, badge: '', on: true, order: 8 },
    { id: 'food', label: 'Food', icon: 'food', go: 'R44', arg: null, badge: '', on: true, order: 9 },
    { id: 'parcel', label: 'Parcel', icon: 'box', go: 'R47', arg: null, badge: '', on: true, order: 10 },
    { id: 'plan', label: 'Plan trip', icon: 'sparkle', go: 'R52', arg: null, badge: 'AI', on: true, order: 11 },
    { id: 'deals', label: 'Deals', icon: 'percent', go: 'R49', arg: null, badge: '', on: true, order: 12 }
  ],
  vehicles: [
    { id: 'Bike', label: 'Bike', icon: 'bike', on: true, order: 1, seats: 1, eta: 2, note: 'Helmet provided \u00B7 1 seat' },
    { id: 'Auto', label: 'Auto', icon: 'auto', on: true, order: 2, seats: 3, eta: 4, note: 'Metered fare \u00B7 3 seats' },
    { id: 'Cab', label: 'Cab', icon: 'car', on: true, order: 3, seats: 4, eta: 3, note: 'AC \u00B7 4 seats' },
    { id: 'Premium', label: 'Premium', icon: 'car2', on: true, order: 4, seats: 4, eta: 6, note: 'Top-rated drivers \u00B7 sedan' }
  ],
  pricing: {
    taxPct: 5, currency: 'INR',
    night: { from: 23, to: 5 },
    surge: { cap: 2.0, rules: [
      { id: 'peak-am', zone: '*', mult: 1.2, from: 8, to: 10, on: true },
      { id: 'peak-pm', zone: '*', mult: 1.2, from: 17, to: 20, on: true },
      { id: 'hitec', zone: 'HYD-HITEC-01', mult: 1.3, from: 9, to: 11, on: false }
    ] },
    // rupees; perKm/perMin may be fractional. commissionPct = platform take-rate on the pre-tax fare.
    cities: {
      HYD: {
        Bike: { base: 20, perKm: 6.5, perMin: 0.8, minFare: 30, bookingFee: 0, freeWaitMin: 3, waitPerMin: 1, cancelFee: 10, nightPct: 0, commissionPct: 15 },
        Auto: { base: 30, perKm: 11, perMin: 1, minFare: 45, bookingFee: 0, freeWaitMin: 3, waitPerMin: 1.5, cancelFee: 12, nightPct: 0, commissionPct: 15 },
        Cab: { base: 50, perKm: 14.5, perMin: 1.5, minFare: 70, bookingFee: 0, freeWaitMin: 4, waitPerMin: 2, cancelFee: 15, nightPct: 0, commissionPct: 20 },
        Premium: { base: 80, perKm: 21, perMin: 2.2, minFare: 110, bookingFee: 0, freeWaitMin: 5, waitPerMin: 3, cancelFee: 25, nightPct: 0, commissionPct: 22 }
      },
      BLR: {
        Bike: { base: 25, perKm: 7, perMin: 1, minFare: 35, bookingFee: 0, freeWaitMin: 3, waitPerMin: 1, cancelFee: 10, nightPct: 0, commissionPct: 15 },
        Auto: { base: 36, perKm: 15, perMin: 1, minFare: 50, bookingFee: 0, freeWaitMin: 3, waitPerMin: 1.5, cancelFee: 15, nightPct: 50, commissionPct: 15 },
        Cab: { base: 60, perKm: 16, perMin: 1.5, minFare: 90, bookingFee: 5, freeWaitMin: 4, waitPerMin: 2, cancelFee: 20, nightPct: 10, commissionPct: 20 },
        Premium: { base: 90, perKm: 22, perMin: 2.5, minFare: 130, bookingFee: 5, freeWaitMin: 5, waitPerMin: 3, cancelFee: 30, nightPct: 10, commissionPct: 22 }
      }
    }
  },
  cities: [
    { id: 'HYD', name: 'Hyderabad', on: true, zones: [
      { id: 'HYD-HITEC-01', name: 'Hitec City', type: 'surge', on: true, fee: 0, services: { Bike: true, Auto: true, Cab: true, Premium: true } },
      { id: 'HYD-AIRPORT', name: 'Rajiv Gandhi Intl Airport', type: 'airport', on: true, fee: 0, match: 'Airport', services: { Bike: false, Auto: true, Cab: true, Premium: true } },
      { id: 'HYD-CHARMINAR-NP', name: 'Charminar no-pickup', type: 'no-pickup', on: true, fee: 0, match: 'Charminar', services: { Bike: true, Auto: true, Cab: false, Premium: false } },
      { id: 'HYD-OLDCITY-02', name: 'Old City', type: 'standard', on: true, fee: 0, services: { Bike: true, Auto: true, Cab: true, Premium: true } }
    ] },
    { id: 'BLR', name: 'Bengaluru', on: true, zones: [
      { id: 'BLR-KIA', name: 'Kempegowda Intl Airport', type: 'airport', on: true, fee: 90, match: 'Kempegowda', services: { Bike: false, Auto: false, Cab: true, Premium: true } },
      { id: 'BLR-ORR', name: 'Outer Ring Road', type: 'surge', on: true, fee: 0, services: { Bike: true, Auto: true, Cab: true, Premium: true } }
    ] }
  ],
  offers: {
    coupons: [
      { code: 'RIDE50', title: '50% off your next 2 rides', sub: 'Up to \u20B9100 per ride \u00B7 cabs, autos and bikes', cat: 'ride', pct: 50, cap: 10000, min: 0, limit: 5000, used: 1840, ends: '2026-12-31', on: true, tone: 'brand' },
      { code: 'BIRYANI40', title: '40% off biryani orders', sub: 'Up to \u20B980 \u00B7 minimum \u20B9199', cat: 'food', pct: 40, cap: 8000, min: 19900, limit: 2000, used: 920, ends: '2026-12-31', on: true, tone: 'amber' },
      { code: 'FIRST75', title: '\u20B975 off your first food order', sub: 'Orders above \u20B9299', cat: 'food', flat: 7500, min: 29900, limit: 10000, used: 3110, ends: '2026-12-31', on: true, tone: 'amber' },
      { code: 'STAY15', title: '15% off hotels', sub: 'Up to \u20B9600 \u00B7 stays of 1 night or more', cat: 'hotel', pct: 15, cap: 60000, min: 0, limit: 1000, used: 120, ends: '2026-12-31', on: true, tone: 'blue' },
      { code: 'GOBUS10', title: '10% off bus tickets', sub: 'Up to \u20B9120 \u00B7 all operators', cat: 'bus', pct: 10, cap: 12000, min: 0, limit: 3000, used: 410, ends: '2026-12-31', on: true, tone: 'blue' },
      { code: 'SHARE40', title: '40% off shared seats', sub: 'Long-distance shared cabs only', cat: 'share', pct: 40, cap: 40000, min: 0, limit: 1500, used: 220, ends: '2026-12-31', on: true, tone: 'brand' },
      { code: 'SENDIT20', title: '\u20B920 off parcels', sub: 'Any parcel above \u20B9100', cat: 'parcel', flat: 2000, min: 10000, limit: 4000, used: 760, ends: '2026-12-31', on: true, tone: 'amber' },
      { code: 'ROAD10', title: '10% off rentals', sub: 'Up to \u20B9300 \u00B7 scooters, bikes and cars', cat: 'rental', pct: 10, cap: 30000, min: 0, limit: 2000, used: 95, ends: '2026-12-31', on: true, tone: 'blue' }
    ],
    referral: { referrerPaise: 10000, refereePaise: 5000, on: true },
    cashback: { pct: 0, capPaise: 0, on: false }
  },
  drivers: {
    kycAutoApproveSecs: 15,
    docs: ['Driving licence', 'Vehicle RC', 'Insurance', 'Aadhaar / PAN', 'Selfie'],
    quests: [
      { id: 'q1', title: 'Weekend quest', desc: 'Complete 30 trips Sat-Sun', target: 30, progress: 18, rewardPaise: 100000, on: true },
      { id: 'q2', title: 'Peak hours', desc: 'Do 10 trips between 6-10 PM', target: 10, progress: 6, rewardPaise: 50000, on: true },
      { id: 'q3', title: 'Five-star streak', desc: 'Get 15 five-star ratings in a row', target: 15, progress: 15, rewardPaise: 30000, on: true },
      { id: 'q4', title: 'Early bird', desc: 'Complete 5 trips before 9 AM', target: 5, progress: 2, rewardPaise: 25000, on: true }
    ],
    payout: { minPaise: 10000, instantFeePaise: 1000, cycle: 'Weekly (Monday)' }
  },
  partners: { commissionPct: 18, autoApproveSecs: 15, payoutCycle: 'Weekly (Wednesday)', tdsPct: 1 },
  broadcasts: [],
  flags: { cash_payments: true, women_driver_preference: true, ai_support_assistant: true, night_ride_checkin: true, scheduled_rides: true, referral_program: true, tipping: true },
  maintenance: { customer: false, driver: false, partner: false, agent: false, message: 'We are upgrading RideNova. Please try again in a few minutes.' },
  content: {
    supportPhone: '1800 123 4567',
    terms: 'By using RideNova you agree to the rider terms, the fare policy shown before booking and the community guidelines.',
    faqs: [
      { q: 'How is my fare calculated?', a: 'Base fare + distance + time, a minimum fare, any surge or night charge shown before you book, and 5% GST.' },
      { q: 'What is the cancellation fee?', a: 'Free within 2 minutes of booking. After that, a small fee goes to the driver who was on the way.' },
      { q: 'How do refunds work?', a: 'Approved refunds go to your RideNova wallet instantly, or to the original payment method in 5-7 days.' }
    ]
  },
  roles: {
    SUPER_ADMIN: ['*'],
    OPS_MANAGER: ['services', 'pricing', 'zones', 'offers', 'drivers', 'partners', 'customers', 'liveops', 'broadcasts', 'flags', 'content', 'audit', 'config'],
    FLEET_MANAGER: ['drivers', 'zones', 'liveops', 'audit'],
    FINANCE_MANAGER: ['pricing', 'offers', 'customers', 'partners', 'drivers', 'audit'],
    SUPPORT_AGENT: ['customers', 'liveops', 'content', 'audit'],
    SAFETY_MANAGER: ['liveops', 'drivers', 'broadcasts', 'audit'],
    FRAUD_ANALYST: ['customers', 'drivers', 'audit'],
    AUDITOR: ['audit']
  }
};
