/* RideNova Agent portal – synthetic data (in memory only; every page load starts from this file).
   People, numbers and addresses are invented. Phone numbers and e-mail addresses are already masked:
   agents never see full contact details (the telephony and mail providers connect them in the next phase). */
window.RN_AGENT_DATA = {
  contacts: [
    { id: 'C-2201', type: 'customer', name: 'Ananya R.', phone: '+91 98••• ••412', email: 'an•••@gmail.example', city: 'Hyderabad', since: 'Mar 2023', tier: 'Gold', rating: '4.9',
      stats: '112 rides · 38 food orders · wallet ₹240', records: [['RN-20260927-00125', 'Ride · Banjara Hills → Hitec City', '₹248', 'Today 08:42'], ['Order #4412', 'Food · Biryani House', '₹380', 'Yesterday'], ['RN-20260924-00031', 'Ride · Home → Work', '₹212', '24 Sep']] },
    { id: 'C-2202', type: 'customer', name: 'Karthik V.', phone: '+91 90••• ••118', email: 'ka•••@outlook.example', city: 'Bengaluru', since: 'Jan 2024', tier: 'Silver', rating: '4.7',
      stats: '41 rides · 6 parcels', records: [['RN-20261010-00311', 'Ride · Indiranagar → Airport', '₹1,140', 'Today 06:10'], ['PX-88120', 'Parcel · Koramangala', '₹96', '2 Oct']] },
    { id: 'C-2203', type: 'customer', name: 'Rahul M.', phone: '+91 99••• ••730', email: 'ra•••@yahoo.example', city: 'Hyderabad', since: 'Jul 2025', tier: 'Basic', rating: '4.5',
      stats: '9 rides · 14 food orders', records: [['Order #4498', 'Food · Paradise Grill', '₹520', 'Today 13:05'], ['RN-20261003-00090', 'Ride · Kondapur → Gachibowli', '₹156', '3 Oct']] },
    { id: 'C-2204', type: 'customer', name: 'Divya K.', phone: '+91 97••• ••205', email: 'di•••@gmail.example', city: 'Chennai', since: 'Nov 2022', tier: 'Platinum', rating: '5.0',
      stats: '260 rides · 3 intercity trips', records: [['IC-55102', 'Intercity · Chennai → Puducherry, shared seat', '₹640', 'Tomorrow 07:00'], ['RN-20261008-00402', 'Ride · T. Nagar → Adyar', '₹188', '8 Oct']] },
    { id: 'C-2205', type: 'customer', name: 'Joseph T.', phone: '+91 94••• ••661', email: 'jo•••@proton.example', city: 'Kochi', since: 'Aug 2026', tier: 'Basic', rating: '4.8',
      stats: '3 rides · 1 hotel booking', records: [['HB-20311', 'Hotel · Lake View Homestay, 2 nights', '₹4,200', '12 Oct'], ['RN-20261009-00055', 'Ride · Fort Kochi → Marine Drive', '₹230', '9 Oct']] },
    { id: 'D-3101', type: 'driver', name: 'Arjun K.', phone: '+91 98••• ••903', email: 'ar•••@gmail.example', city: 'Hyderabad', since: 'Feb 2022', tier: 'Pro driver', rating: '4.86',
      stats: '3,412 trips · Cab · TS 09 EX 4821', records: [['PO-77120', 'Weekly payout', '₹18,460', 'Mon 06 Oct'], ['RN-20260927-00125', 'Ride · Banjara Hills → Hitec City', '₹248', 'Today 08:42']] },
    { id: 'D-3102', type: 'driver', name: 'Imran S.', phone: '+91 91••• ••377', email: 'im•••@gmail.example', city: 'Hyderabad', since: 'May 2024', tier: 'Driver', rating: '4.71',
      stats: '1,120 trips · Auto · TS 10 UA 1180', records: [['PO-77141', 'Weekly payout – failed (IFSC)', '₹9,870', 'Mon 06 Oct'], ['DF-1006', 'Daily platform fee', '₹49', 'Today']] },
    { id: 'D-3103', type: 'driver', name: 'Suresh P.', phone: '+91 93••• ••540', email: 'su•••@gmail.example', city: 'Bengaluru', since: 'Oct 2021', tier: 'Pro driver', rating: '4.92',
      stats: '5,980 trips · Cab + intercity', records: [['IC-55090', 'Intercity · Bengaluru → Mysuru, 3 seats', '₹1,650', 'Yesterday'], ['PO-77098', 'Weekly payout', '₹22,310', 'Mon 06 Oct']] },
    { id: 'D-3104', type: 'driver', name: 'Lakshmi N.', phone: '+91 96••• ••218', email: 'la•••@gmail.example', city: 'Chennai', since: 'Jun 2025', tier: 'Delivery partner', rating: '4.88',
      stats: '890 deliveries · Bike', records: [['Order #4471', 'Delivery · Saravana Bhavan', '₹62 earned', 'Today 12:20']] },
    { id: 'P-4101', type: 'partner', name: 'Biryani House', phone: '+91 40••• ••100', email: 'or•••@biryanihouse.example', city: 'Hyderabad', since: 'Apr 2023', tier: 'Restaurant', rating: '4.4',
      stats: '18,200 orders · 2 outlets', records: [['PP-9012', 'Weekly partner payout', '₹2,14,800', 'Mon 06 Oct'], ['Order #4412', 'Order · Ananya R.', '₹380', 'Yesterday']] },
    { id: 'P-4102', type: 'partner', name: 'Lake View Homestay', phone: '+91 48••• ••770', email: 'st•••@lakeview.example', city: 'Kochi', since: 'Jan 2026', tier: 'Hotel / homestay', rating: '4.6',
      stats: '310 bookings · 6 rooms', records: [['HB-20311', 'Booking · Joseph T., 2 nights', '₹4,200', '12 Oct']] },
    { id: 'P-4103', type: 'partner', name: 'GreenWheels Rentals', phone: '+91 80••• ••455', email: 'ops•••@greenwheels.example', city: 'Mysuru', since: 'Sep 2024', tier: 'Rental company', rating: '4.5',
      stats: '1,460 rentals · 42 scooters', records: [['RT-7781', 'Scooter rental · 2 days', '₹1,100', 'Yesterday']] },
    { id: 'P-4104', type: 'partner', name: 'Sri Travels Bus', phone: '+91 44••• ••902', email: 'bo•••@sritravels.example', city: 'Chennai', since: 'Mar 2025', tier: 'Bus operator', rating: '4.3',
      stats: '7 routes · 22 buses', records: [['BS-3320', 'Bus · Chennai → Bengaluru, 31 seats sold', '₹27,900', 'Tonight 22:00']] }
  ],

  // conversations already waiting when the portal opens; "ago" = minutes before page load
  seed: [
    { channel: 'call', contact: 'C-2202', subject: 'Airport ride – charged twice', category: 'Payments', priority: 'P2', state: 'OPEN', mine: true, ago: 35,
      msgs: [['system', 'Inbound call · IVR option "Payments" · 4 min 12 s · recorded (simulated)'], ['note', 'Customer sees two debits of ₹1,140. Bank statement screenshot requested by email.']] },
    { channel: 'email', contact: 'C-2201', subject: 'Left my black backpack in the cab', category: 'Lost item', priority: 'P2', state: 'PENDING', mine: true, ago: 95, ref: 'RN-20260927-00125',
      msgs: [['contact', 'Hello, I left my black backpack on the back seat of my morning ride (RN-20260927-00125). It has my laptop. Please help.'], ['agent', 'Hi Ananya, we have contacted the driver. He can drop the bag at 8 PM today; a ₹100 return fee applies. Shall we go ahead?']] },
    { channel: 'email', contact: 'P-4101', subject: 'Payout lower than expected this week', category: 'Partner payouts', priority: 'P3', state: 'NEW', ago: 50,
      msgs: [['contact', 'Dear team, our payout PP-9012 is ₹2,14,800 but our own report shows ₹2,22,300. Please share the order-level breakdown.']] },
    { channel: 'email', contact: 'D-3102', subject: 'Payout failed again', category: 'Driver payouts', priority: 'P2', state: 'NEW', ago: 70,
      msgs: [['contact', 'My weekly payout PO-77141 failed for the second time. I need the money for the auto EMI. Please check urgently.']] },
    { channel: 'whatsapp', contact: 'C-2203', subject: 'Food order 40 minutes late', category: 'Food order', priority: 'P2', state: 'NEW', ago: 6,
      msgs: [['contact', 'My order #4498 from Paradise Grill is 40 minutes late and the app still says preparing. Can you check?']] },
    { channel: 'x', contact: 'C-2204', subject: 'Public post: "Driver cancelled 3 times"', category: 'Ride cancelled', priority: 'P2', state: 'NEW', ago: 12, public: true, sentiment: 'negative',
      msgs: [['contact', '@RideNova three drivers cancelled on me this morning in T. Nagar. Missed my meeting. Not acceptable.']] },
    { channel: 'facebook', contact: 'P-4102', subject: 'Message: listing photos not updating', category: 'Partner listing', priority: 'P3', state: 'OPEN', mine: true, ago: 140,
      msgs: [['contact', 'Hi, I uploaded new photos for our rooms two days ago but the app still shows the old ones.'], ['agent', 'Thanks for reaching out. New photos are reviewed within 48 hours; I have asked the team to prioritise yours.']] },
    { channel: 'instagram', contact: 'D-3103', subject: 'Comment: intercity seats not showing', category: 'Intercity', priority: 'P3', state: 'NEW', ago: 25, public: true, sentiment: 'neutral',
      msgs: [['contact', 'Published 3 seats Bengaluru → Mysuru for tomorrow, customers say they cannot see them. Anyone else?']] },
    { channel: 'chat', contact: 'C-2205', subject: 'Homestay check-in time', category: 'Hotel booking', priority: 'P3', state: 'NEW', ago: 1,
      msgs: [['contact', 'Hi, can I check in at 10 AM instead of 2 PM at Lake View Homestay?']] },
    { channel: 'app', contact: 'D-3101', subject: 'Rider left an item – what do I do?', category: 'Lost item', priority: 'P3', state: 'NEW', ago: 80,
      msgs: [['contact', 'A rider left a black backpack in my cab this morning. Support asked me to drop it at 8 PM. Will I get the ₹100 return fee?']] },
    { channel: 'call', contact: 'D-3104', subject: 'Customer unreachable at drop', category: 'Delivery', priority: 'P2', state: 'RESOLVED', ago: 210, disposition: 'Information given',
      msgs: [['system', 'Inbound call · IVR option "Delivery help" · 2 min 40 s'], ['note', 'Guided the delivery partner to use the masked call and the 10-minute wait rule.']] },
    { channel: 'email', contact: 'P-4104', subject: 'Bus cancelled because of a strike – refunds?', category: 'Bus booking', priority: 'P1', state: 'ESCALATED', ago: 30, escalatedTo: 'Partner success',
      msgs: [['contact', 'Our 22:00 Chennai → Bengaluru bus cannot run tonight due to a transport strike. 31 seats are sold. How do we refund the customers?'], ['system', 'Escalated to Partner success: bulk refund needs approval.']] }
  ],

  // calls already waiting in the queue when the portal opens
  callQueue: [
    { contact: 'D-3101', ivr: 'Driver payouts', ago: 1 },
    { contact: 'C-2204', ivr: 'Safety', ago: 0 }
  ],

  // new contacts the simulation sends while the portal is open (one is picked at random for an enabled channel)
  incoming: {
    call: [['C-2201', 'Payments', 'Wallet top-up not credited'], ['D-3103', 'Intercity', 'Seat booking question'], ['P-4103', 'Partner support', 'Scooter returned damaged'], ['C-2205', 'Bookings', 'Change hotel dates'], ['D-3104', 'Delivery help', 'Restaurant not handing over order']],
    email: [['C-2204', 'Invoice needed for office reimbursement', 'Please send a GST invoice for my rides this month. Company name: Lotus Analytics.'], ['P-4103', 'Commission rate query', 'Can you explain the platform fee on our rental bookings this week?'], ['D-3103', 'Change of bank account', 'I have moved to a new bank. How do I change my payout account safely?'], ['C-2203', 'Promo code did not apply', 'Code FEST50 did not apply on my food order #4498 even though the cart was above ₹300.']],
    chat: [['C-2201', 'Driver is not moving', 'My driver has been stopped for 10 minutes and is not answering. What should I do?'], ['C-2202', 'Change drop location', 'Can I change my drop location during the ride?'], ['D-3102', 'App shows offline', 'I am online but the app keeps going offline every few minutes.'], ['C-2205', 'Rental helmet', 'Does the scooter rental come with two helmets?']],
    app: [['C-2203', 'Item missing from order', 'Raita missing from order #4498. Please refund.'], ['D-3104', 'Wrong delivery fee', 'I got ₹42 for a 6 km delivery, it should be more.'], ['P-4101', 'Item out of stock', 'How do I mark Mutton Biryani out of stock only for today?']],
    whatsapp: [['C-2202', 'Parcel not picked up', 'Hi, my parcel PX-88120 still says waiting for pickup. Courier never came.'], ['D-3101', 'Incentive not received', 'I finished 40 trips this week but the incentive is not showing.'], ['C-2204', 'Seat change', 'Can I change my intercity seat to a window seat?']],
    facebook: [['C-2205', 'Review: great homestay', 'Lovely stay at Lake View, booked through RideNova. Smooth check-in!'], ['P-4104', 'Message: boarding point change', 'We want to add a new boarding point at Guindy for our night bus.']],
    instagram: [['C-2203', 'Comment: delivery was cold', 'Food arrived cold again @ridenova 🥶 third time this month.'], ['D-3104', 'Message: delivery bag', 'How do I get a new insulated delivery bag?']],
    x: [['C-2201', 'Mention: surge too high', '@RideNova ₹480 for 6 km at 7 PM? Surge is crazy today.'], ['C-2202', 'Mention: thanks to driver', 'Shout-out to my @RideNova driver Suresh who returned my wallet!']]
  },

  // what contacts say back after an agent replies (picked at random)
  replies: ['Thanks, that helps.', 'OK, I will wait for the update.', 'Can you tell me how long it will take?', 'That works for me, thank you.', 'I already tried that, it did not work.', 'Great, thanks for the quick reply!'],

  ivr: ['Payments', 'Ride help', 'Safety', 'Food & parcels', 'Driver payouts', 'Partner support', 'Bookings'],
  teams: ['Customer care', 'Driver care', 'Partner care', 'Social media', 'All teams']
};
