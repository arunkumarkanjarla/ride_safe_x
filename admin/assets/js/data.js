/* RideNova prototype – deterministic synthetic seed data.
   Every name, number and address is fictional and matches what the approved mock screens show,
   so a screen and the simulated state always agree. No real personal data. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.RN = root.RN || {}; root.RN.data = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Codes the simulated services accept. Shown on screen as "Demo code" hints. Not secrets.
  var DEMO_CODES = { riderOtp: '482716', driverOtp: '482716', adminPassword: 'demo-only', adminMfa: '730951', tripOtp: '4827', foodOtp: '4471', agentCode: '246810' };

  var RIDER = { id: 'U-1001', name: 'Ananya Rao', short: 'Ananya R.', initials: 'AR', phone: '+91 98480 04321', phoneMasked: '+91 98••• ••321',
    rating: 4.8, rides: 112, email: 'ananya@example.com', walletPaise: 12000, upi: 'ananya@okbank', card: 'Visa •••• 4417',
    contacts: [{ name: 'Mom', phone: '+91 98•••••210' }, { name: 'Rahul', phone: '+91 99•••••876' }] };

  var DRIVERS = {
    'DRV-1042': { id: 'DRV-1042', name: 'Arjun Kumar', short: 'Arjun K.', initials: 'AK', rating: 4.9, phoneMasked: '+91 90••• ••345',
      vehicle: 'White Swift Dzire', plate: 'TS 09 EA 4521', type: 'Cab', city: 'Hyderabad', persona: true },
    'DRV-0051': { id: 'DRV-0051', name: 'Imran Shaik', short: 'Imran S.', initials: 'IS', rating: 4.7, phoneMasked: '+91 91••• ••118',
      vehicle: 'Silver WagonR', plate: 'TS 08 UB 2290', type: 'Cab', city: 'Hyderabad' },
    'DRV-0077': { id: 'DRV-0077', name: 'Kiran Prasad', short: 'Kiran P.', initials: 'KP', rating: 4.6, phoneMasked: '+91 93••• ••604',
      vehicle: 'Grey Etios', plate: 'TS 07 FK 8812', type: 'Cab', city: 'Hyderabad' },
    'DRV-2001': { id: 'DRV-2001', name: 'Salim M.', short: 'Salim M.', initials: 'SM', rating: 4.9, phoneMasked: '+91 95••• ••771',
      vehicle: 'Bike', plate: 'TS 10 K 1188', type: 'Bike', city: 'Hyderabad' }
  };

  var ADMINS = { 'ADM-7': { id: 'ADM-7', name: 'Priya K.', initials: 'PK', email: 'priya.k@ridenova.example', defaultRole: 'OPS_MANAGER' } };

  var RIDE_TEMPLATE = {
    id: 'RN-20260927-00125', vehicle: 'Cab', pickup: 'Gate 2, Lumbini Apartments', pickupArea: 'Road 12, Banjara Hills',
    drop: 'Hitec City Metro Station', dropArea: 'Madhapur', km: 9.8, mins: 27, quotePaise: 23600, finalPaise: 24800,
    surge: 1.2, zone: 'HYD-BH-04', otp: DEMO_CODES.tripOtp, payMethod: 'UPI',
    fare: [['Base fare', 5000], ['Distance 9.9 km', 13860], ['Time 26 min', 3900], ['High demand 1.2×', 4550], ['Coupon RIDE50', -3700], ['Taxes', 1190]],
    driverEarnPaise: 27310
  };

  var ORDER_TEMPLATE = {
    id: '4415', restaurant: 'Biryani House', partnerId: 'PTN-301', items: [['Chicken dum biryani', 28900], ['Paneer biryani', 24900]],
    itemsPaise: 53800, couponPaise: 8000, deliveryPaise: 0, totalPaise: 45800, delivery: 'Saver', note: 'less spicy', otp: DEMO_CODES.foodOtp,
    courierId: 'DRV-2001', drop: 'Road 12, Banjara Hills'
  };

  // Documents shown on D03. state: missing | uploaded | in_review | rejected | approved
  var KYC_TEMPLATE = {
    applicant: 'DRV-1042',
    docs: [
      { key: 'licence', title: 'Driving licence', state: 'uploaded' }, { key: 'rc', title: 'Vehicle RC', state: 'uploaded' },
      { key: 'insurance', title: 'Insurance', state: 'rejected', reason: 'Photo unclear, please retake' }, { key: 'permit', title: 'Permit', state: 'missing' },
      { key: 'fitness', title: 'Fitness certificate', state: 'missing' }, { key: 'police', title: 'Police verification', state: 'uploaded' },
      { key: 'photo', title: 'Profile photo', state: 'uploaded' }
    ]
  };

  // Candidate drivers in the order the mock dispatcher offers them, per scenario behaviour.
  // response: accept | decline | ignore (offer expires)
  var DISPATCH_PLANS = {
    happy: [['DRV-1042', 'accept']],
    reassign: [['DRV-0051', 'decline'], ['DRV-0077', 'ignore'], ['DRV-1042', 'accept']],
    none: []
  };

  var SCENARIOS = [
    { id: 'A', title: 'Successful city ride', plan: 'happy', payment: 'success', start: 'R07', apps: ['rider', 'driver', 'admin'],
      steps: ['Rider: Where to? → pick Hitec City → Book Cab → Confirm pickup', 'Driver (auto or manual) accepts on D07', 'Watch R12 → R15 → R17, then rate on R18', 'Admin A04 shows the same ride and its event timeline'] },
    { id: 'B', title: 'Driver rejection and reassignment', plan: 'reassign', payment: 'success', start: 'R09', apps: ['rider', 'driver', 'admin'],
      steps: ['Book a Cab', 'Imran S. declines, Kiran P. lets the offer expire', 'Arjun K. accepts; R11 and A04 show every offer'] },
    { id: 'C', title: 'No eligible driver', plan: 'none', payment: 'success', start: 'R09', apps: ['rider', 'admin'],
      steps: ['Book a Cab', 'Search ends with NO_DRIVER_FOUND', 'Retry (new request) or cancel on R11'] },
    { id: 'D', title: 'Cancellation', plan: 'happy', payment: 'success', start: 'R09', apps: ['rider', 'driver', 'admin'],
      steps: ['Cancel while searching (free)', 'Or cancel after the driver accepted (fee after the free window)', 'Trip in progress cannot be cancelled, only ended'] },
    { id: 'E', title: 'Payment failure', plan: 'happy', payment: 'fail', start: 'R09', apps: ['rider', 'driver', 'admin'],
      steps: ['Complete a ride', 'Gateway declines twice → PAYMENT_FAILED; R17 never shows Paid', 'Pay another way to settle; new bookings blocked until then'] },
    { id: 'F', title: 'Driver onboarding', plan: 'happy', payment: 'success', start: 'D03', apps: ['driver', 'admin'], kyc: 'draft',
      steps: ['Driver uploads the missing documents and submits on D03', 'Admin reviews on A07: approve, ask to re-upload or reject', 'D04 reflects the decision; approved drivers can go online'] },
    { id: 'G', title: 'Safety incident (SOS)', plan: 'happy', payment: 'success', start: 'R15', apps: ['rider', 'admin'], ride: 'in_progress',
      steps: ['Rider holds SOS on R16', 'Incident appears on A13; acknowledge, escalate, resolve, close', 'R16 shows the incident status'] },
    { id: 'H', title: 'Food delivery', plan: 'happy', payment: 'success', start: 'R45', apps: ['rider', 'partner', 'driver', 'admin'],
      steps: ['Rider pays on R45', 'Restaurant accepts on P02 and marks ready', 'Salim accepts on D22, picks up and delivers on D23', 'Rider tracks on R46; Admin A27 shows the order'] },
    { id: 'I', title: 'Interrupted connectivity', plan: 'happy', payment: 'success', start: 'D10', apps: ['driver', 'rider'], ride: 'in_progress',
      steps: ['Switch the driver app offline in the demo bar', 'End the trip: it is queued, not lost; duplicate taps are ignored', 'Go back online: the queue syncs (D19) and the rider sees the trip end'] },
    { id: 'J', title: 'Authorization (mock roles)', plan: 'happy', payment: 'success', start: 'A07', apps: ['admin'], role: 'SUPPORT_AGENT',
      steps: ['Signed in as a Support agent', 'Approve KYC on A07 or block an account on A14', 'The action is denied and the denial is written to the audit log'] }
  ];

  // ---- support portal catalogue (new; wording based on the blueprint's support screens R26, R27, D20, A12)
  var SUPPORT_CATEGORIES = [
    { key: 'account', title: 'Login and account', icon: 'user', issues: ['I did not receive the OTP', 'I cannot log in', 'Change my phone number', 'Delete my account'] },
    { key: 'booking', title: 'Booking and cancellations', icon: 'car', issues: ['I was charged a cancellation fee', 'My driver never arrived', 'I want to change my booking', 'Scheduled ride did not happen'] },
    { key: 'people', title: 'Driver or rider issues', icon: 'users', issues: ['Driver behaviour', 'Rider behaviour', 'Vehicle condition', 'Route taken'] },
    { key: 'payments', title: 'Payments and refunds', icon: 'card', issues: ['I was charged more than the estimate', 'Payment failed but money was deducted', 'Refund not received', 'Payout or earnings issue'] },
    { key: 'delivery', title: 'Food and parcel delivery', icon: 'bag', issues: ['Order is late', 'Items missing or wrong', 'Food was cold', 'Parcel not delivered'] },
    { key: 'partner', title: 'Partner issues', icon: 'grid', issues: ['Order or booking dispute', 'Payout or commission question', 'Listing or menu problem', 'Onboarding status'] },
    { key: 'safety', title: 'Safety and SOS', icon: 'shield', issues: ['Report a safety concern', 'Follow up on an SOS', 'Lost item'] },
    { key: 'technical', title: 'Technical issues', icon: 'settings', issues: ['App is not working', 'Location is wrong', 'Notifications not arriving'] }
  ];
  var HELP_ARTICLES = [
    { id: 'KB-101', cat: 'payments', title: 'Why the final fare can differ from the estimate', body: 'The estimate uses the expected route and time. The final fare uses the actual distance and time from the trip, so traffic or a changed destination can change it. Every line of the fare is shown on your receipt.' },
    { id: 'KB-102', cat: 'booking', title: 'Cancellation fees', body: 'Cancelling while we search for a driver is free. After a driver has accepted, a small fee may apply once the free window has passed. (Amount not final in this prototype.)' },
    { id: 'KB-103', cat: 'account', title: 'I did not receive the OTP', body: 'Wait for the timer to finish, then tap Resend or choose WhatsApp. Codes expire after 5 minutes and you can request 3 codes every 10 minutes.' },
    { id: 'KB-104', cat: 'safety', title: 'What happens when I press SOS', body: 'Our safety team is alerted, your live location goes to your emergency contacts and an agent calls you. In an emergency always call 112 as well.' },
    { id: 'KB-105', cat: 'delivery', title: 'My food order is late', body: 'Track the order in the app. Saver delivery can take up to 12 minutes longer because the partner carries another order on the way.' },
    { id: 'KB-106', cat: 'payments', title: 'When will I get my refund', body: 'Refunds to UPI arrive within 1–3 working days, to cards within 5–7 working days, and to the wallet immediately.' },
    { id: 'KB-107', cat: 'partner', title: 'How payouts and commission work', body: 'Partners are paid weekly. The statement shows gross sales, commission, offers you funded and tax deducted.' },
    { id: 'KB-108', cat: 'technical', title: 'The app shows the wrong location', body: 'Turn on precise location, or move the pin on the map to the exact pickup point.' }
  ];
  // Keyword → canned reply used by the simulated chat agent
  var CHAT_REPLIES = [
    [/refund|money back/i, 'I can see the payment on your account. Refunds to UPI arrive within 1–3 working days. Shall I raise a refund request for you?'],
    [/charge|fare|estimate|expensive/i, 'Your fare is higher than the estimate because the trip took longer than expected. I can request a fare review if you think it is wrong.'],
    [/lost|forgot|left/i, 'I am sorry about that. I have contacted the driver through a masked call; they will confirm whether the item is in the car.'],
    [/driver|rude|behaviour|behavior/i, 'Thank you for telling us. I have recorded this for the quality team. Do you feel safe now?'],
    [/late|order|food/i, 'Your order is with the delivery partner now. I will keep an eye on it and credit you if it is more than 15 minutes late.'],
    [/otp|login|code/i, 'Please wait for the resend timer, then request the code again or choose WhatsApp. Codes expire after 5 minutes.'],
    [/safe|sos|unsafe|danger/i, 'Your safety comes first. If you are in danger call 112 now. I am alerting our safety team to call you.'],
    [/thank/i, 'You are welcome! Is there anything else I can help with?']
  ];
  var CHAT_FALLBACK = 'Thanks, I am looking into this. Could you share a little more detail?';
  var AGENTS = ['Meera S.', 'Vikram R.', 'Farah N.', 'Rohan D.', 'Sana P.'];
  // Existing sample tickets shown on A12 in the approved design
  var SUPPORT_TICKETS = [
    { id: '48790', by: 'driver', user: 'Arjun K.', category: 'payments', issue: 'Fare dispute', ref: 'RN-20260926-00988', priority: 'P2', status: 'IN_PROGRESS', assignee: 'Meera S.', ageMin: 60 },
    { id: '48802', by: 'rider', user: 'Ananya R.', category: 'safety', issue: 'Lost item · black backpack', ref: 'RN-20260927-00125', priority: 'P2', status: 'WAITING_ON_USER', assignee: 'Meera S.', ageMin: 180 },
    { id: '48811', by: 'rider', user: 'Karthik V.', category: 'people', issue: 'Driver rude', ref: 'RN-20260925-00410', priority: 'P1', status: 'OPEN', assignee: null, ageMin: 300 },
    { id: '48815', by: 'driver', user: 'Imran S.', category: 'payments', issue: 'Payout failed', ref: 'PAYOUT-0921', priority: 'P3', status: 'OPEN', assignee: null, ageMin: 290 }
  ];
  // Partner bookings shown on P04 (hotel), P05 (rental) and P06 (bus)
  var BOOKINGS = [
    { id: 'HB-7712', kind: 'hotel', guest: 'Ananya R.', detail: 'Deluxe double · 2 guests · 2 nights', state: 'CONFIRMED', amountPaise: 680000 },
    { id: 'HB-7719', kind: 'hotel', guest: 'Kiran M.', detail: 'Palace-view · 1 guest · 1 night', state: 'PENDING', amountPaise: 390000 },
    { id: 'RB-3301', kind: 'rental', guest: 'Ananya R.', detail: 'Scooter 01 · 2 days · delivery to Mysuru bus stand', state: 'CONFIRMED', amountPaise: 90000 },
    { id: 'BB-5521', kind: 'bus', guest: 'Ananya R. + 1', detail: 'Seats 14, 15 · KSRTC stand', state: 'CHECKED_IN', amountPaise: 108000 },
    { id: 'BB-5530', kind: 'bus', guest: 'Faisal K.', detail: 'Seat 22 · Thamarassery', state: 'CONFIRMED', amountPaise: 54000 }
  ];

  return { SUPPORT_CATEGORIES: SUPPORT_CATEGORIES, HELP_ARTICLES: HELP_ARTICLES, CHAT_REPLIES: CHAT_REPLIES, CHAT_FALLBACK: CHAT_FALLBACK,
    AGENTS: AGENTS, SUPPORT_TICKETS: SUPPORT_TICKETS, BOOKINGS: BOOKINGS, DEMO_CODES: DEMO_CODES, RIDER: RIDER, DRIVERS: DRIVERS, ADMINS: ADMINS, RIDE_TEMPLATE: RIDE_TEMPLATE, ORDER_TEMPLATE: ORDER_TEMPLATE,
    KYC_TEMPLATE: KYC_TEMPLATE, DISPATCH_PLANS: DISPATCH_PLANS, SCENARIOS: SCENARIOS };
});
