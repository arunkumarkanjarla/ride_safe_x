/* RideNova Admin portal – operations data (synthetic, in memory).
   Master lists (country → state → city) and a generated data set of vehicles, rides, food & parcel orders and partner
   applications used by the command center (A02), live map (A03), rides (A04), orders (A27) and partner review (A24).
   Generated from a fixed seed, so every page load shows the same data; nothing is stored or sent anywhere. */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {};

  // ------------------------------------------------------------------ masters
  var COUNTRIES = [
    { code: 'IN', name: 'India', currency: 'INR', plate: 'IN', names: 'in', states: [
      { code: 'TS', name: 'Telangana', cities: [['HYD', 'Hyderabad', 17.385, 78.4867, 10], ['WGL', 'Warangal', 17.9689, 79.5941, 2]] },
      { code: 'KA', name: 'Karnataka', cities: [['BLR', 'Bengaluru', 12.9716, 77.5946, 12], ['MYS', 'Mysuru', 12.2958, 76.6394, 2]] },
      { code: 'MH', name: 'Maharashtra', cities: [['BOM', 'Mumbai', 19.076, 72.8777, 12], ['PNQ', 'Pune', 18.5204, 73.8567, 5]] },
      { code: 'TN', name: 'Tamil Nadu', cities: [['MAA', 'Chennai', 13.0827, 80.2707, 8], ['CJB', 'Coimbatore', 11.0168, 76.9558, 2]] },
      { code: 'KL', name: 'Kerala', cities: [['COK', 'Kochi', 9.9312, 76.2673, 3], ['CCJ', 'Kozhikode', 11.2588, 75.7804, 2]] },
      { code: 'DL', name: 'Delhi', cities: [['DEL', 'New Delhi', 28.6139, 77.209, 11]] }] },
    { code: 'AE', name: 'United Arab Emirates', currency: 'AED', plate: 'AE', names: 'ar', states: [
      { code: 'DU', name: 'Dubai', cities: [['DXB', 'Dubai', 25.2048, 55.2708, 6]] },
      { code: 'AZ', name: 'Abu Dhabi', cities: [['AUH', 'Abu Dhabi', 24.4539, 54.3773, 3]] }] },
    { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', plate: 'SA', names: 'ar', states: [
      { code: 'RI', name: 'Riyadh Province', cities: [['RUH', 'Riyadh', 24.7136, 46.6753, 4]] },
      { code: 'MK', name: 'Makkah Province', cities: [['JED', 'Jeddah', 21.4858, 39.1925, 3]] }] },
    { code: 'GB', name: 'United Kingdom', currency: 'GBP', plate: 'GB', names: 'en', states: [
      { code: 'ENG', name: 'England', cities: [['LON', 'London', 51.5072, -0.1276, 7], ['MAN', 'Manchester', 53.4808, -2.2426, 3]] },
      { code: 'SCT', name: 'Scotland', cities: [['EDI', 'Edinburgh', 55.9533, -3.1883, 2]] }] },
    { code: 'US', name: 'United States', currency: 'USD', plate: 'US', names: 'en', states: [
      { code: 'NY', name: 'New York', cities: [['NYC', 'New York City', 40.7128, -74.006, 7]] },
      { code: 'CA', name: 'California', cities: [['SFO', 'San Francisco', 37.7749, -122.4194, 4], ['LAX', 'Los Angeles', 34.0522, -118.2437, 5]] },
      { code: 'TX', name: 'Texas', cities: [['AUS', 'Austin', 30.2672, -97.7431, 2]] }] },
    { code: 'SG', name: 'Singapore', currency: 'SGD', plate: 'SG', names: 'en', states: [
      { code: 'SG', name: 'Singapore', cities: [['SIN', 'Singapore', 1.3521, 103.8198, 5]] }] },
    { code: 'AU', name: 'Australia', currency: 'AUD', plate: 'AU', names: 'en', states: [
      { code: 'NSW', name: 'New South Wales', cities: [['SYD', 'Sydney', -33.8688, 151.2093, 4]] },
      { code: 'VIC', name: 'Victoria', cities: [['MEL', 'Melbourne', -37.8136, 144.9631, 3]] }] },
    { code: 'KE', name: 'Kenya', currency: 'KES', plate: 'KE', names: 'en', states: [
      { code: 'NBO', name: 'Nairobi County', cities: [['NBO', 'Nairobi', -1.2921, 36.8219, 3]] }] },
    { code: 'BR', name: 'Brazil', currency: 'BRL', plate: 'BR', names: 'pt', states: [
      { code: 'SP', name: 'São Paulo', cities: [['SAO', 'São Paulo', -23.5505, -46.6333, 5]] }] },
    { code: 'DE', name: 'Germany', currency: 'EUR', plate: 'DE', names: 'en', states: [
      { code: 'BE', name: 'Berlin', cities: [['BER', 'Berlin', 52.52, 13.405, 3]] }] },
    { code: 'JP', name: 'Japan', currency: 'JPY', plate: 'JP', names: 'jp', states: [
      { code: 'TK', name: 'Tokyo', cities: [['TYO', 'Tokyo', 35.6762, 139.6503, 5]] }] }
  ];
  var CITIES = {}, CITY_LIST = [];
  COUNTRIES.forEach(function (c) {
    c.states.forEach(function (s) {
      s.cities = s.cities.map(function (a) {
        var city = { id: a[0], name: a[1], lat: a[2], lng: a[3], weight: a[4], state: s.code, stateName: s.name, country: c.code, countryName: c.name, currency: c.currency };
        CITIES[city.id] = city; CITY_LIST.push(city);
        return city;
      });
    });
  });
  function country(code) { return COUNTRIES.filter(function (c) { return c.code === code; })[0] || null; }
  function state(cc, sc) { var c = country(cc); return c ? c.states.filter(function (s) { return s.code === sc; })[0] || null : null; }

  var SYMBOL = { INR: '₹', AED: 'AED ', SAR: 'SAR ', GBP: '£', USD: '$', SGD: 'S$', AUD: 'A$', KES: 'KSh ', BRL: 'R$', EUR: '€', JPY: '¥' };
  function money(v, cur) {
    var whole = cur === 'JPY' || cur === 'KES' || cur === 'INR';
    var n = Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    return (SYMBOL[cur] || cur + ' ') + n;
  }

  // ------------------------------------------------------------------ seeded random numbers
  var seed = 20261011;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function int(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  function weighted(pairs) { var total = pairs.reduce(function (t, p) { return t + p[1]; }, 0), r = rnd() * total; for (var i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; } return pairs[0][0]; }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

  var FIRST = {
    in: ['Arjun', 'Meera', 'Vikram', 'Ravi', 'Sneha', 'Kiran', 'Imran', 'Lakshmi', 'Suresh', 'Divya', 'Rahul', 'Anil', 'Priya', 'Farhan', 'Kavya', 'Naveen', 'Pooja', 'Sanjay', 'Asha', 'Manoj', 'Ananya', 'Harish', 'Nisha', 'Deepak'],
    ar: ['Omar', 'Fatima', 'Yousef', 'Aisha', 'Khalid', 'Layla', 'Hassan', 'Noor', 'Tariq', 'Mariam', 'Faisal', 'Huda'],
    en: ['James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Grace', 'Daniel', 'Chloe', 'Samuel', 'Zoe', 'Wanjiru', 'Otieno'],
    pt: ['Lucas', 'Ana', 'Mateus', 'Beatriz', 'Gabriel', 'Julia', 'Rafael', 'Larissa'],
    jp: ['Haruto', 'Yui', 'Sota', 'Hina', 'Ren', 'Aoi', 'Yuto', 'Sakura']
  };
  var LAST = { in: 'KRSMPNVDTBAGH', ar: 'AHKSMNF', en: 'BCDHKLMPRSTW', pt: 'ACFLMORS', jp: 'IKMNSTY' };
  function person(group) { var f = pick(FIRST[group]), l = LAST[group].charAt(int(0, LAST[group].length - 1)); return { name: f + ' ' + l + '.', initials: (f.charAt(0) + l).toUpperCase() }; }
  function phoneMasked(cc) {
    var p = { IN: '+91 9', AE: '+971 5', SA: '+966 5', GB: '+44 7', US: '+1 4', SG: '+65 9', AU: '+61 4', KE: '+254 7', BR: '+55 1', DE: '+49 1', JP: '+81 9' }[cc] || '+0 ';
    return p + '••• ••' + pad(int(0, 999), 3);
  }
  function plate(c) {
    var L = 'ABCDEFGHJKLMNPRSTUVWXYZ', two = function () { return L.charAt(int(0, 22)) + L.charAt(int(0, 22)); };
    switch (c.country) {
      case 'IN': return c.state + ' ' + pad(int(1, 40), 2) + ' ' + two() + ' ' + pad(int(1, 9999), 4);
      case 'AE': return c.id + ' ' + L.charAt(int(0, 22)) + ' ' + int(10000, 99999);
      case 'GB': return two() + pad(int(10, 74), 2) + ' ' + two() + L.charAt(int(0, 22));
      case 'US': return int(1, 9) + two() + L.charAt(int(0, 22)) + int(100, 999);
      case 'JP': return 'Shinagawa ' + int(300, 599) + ' ' + pad(int(1, 9999), 4);
      default: return two() + '-' + int(1000, 9999);
    }
  }

  // ------------------------------------------------------------------ vehicle types
  var TYPES = {
    bike: { label: 'Bike', models: ['Honda Shine', 'TVS Apache', 'Yamaha FZ', 'Bajaj Pulsar'], perKm: 6, service: 'Bike' },
    auto: { label: 'Auto', models: ['Bajaj RE', 'Piaggio Ape', 'Mahindra Treo (EV)'], perKm: 12, service: 'Auto' },
    cab: { label: 'Cab', models: ['Swift Dzire', 'Toyota Etios', 'Hyundai Aura', 'Toyota Corolla', 'Kia Rio'], perKm: 16, service: 'Cab' },
    premium: { label: 'Premium', models: ['Toyota Camry', 'Honda Accord', 'Mercedes E-Class', 'BMW 5 Series'], perKm: 26, service: 'Premium' },
    suv: { label: 'XL / SUV', models: ['Toyota Innova', 'Kia Carens', 'Ertiga', 'Chevrolet Suburban'], perKm: 21, service: 'XL' },
    bus: { label: 'Bus', models: ['Volvo 9600', 'Ashok Leyland Viking', 'Scania Touring'], perKm: 4, service: 'Long trip' },
    delivery: { label: 'Delivery', models: ['Hero Splendor', 'Ather 450X (EV)', 'Ola S1 (EV)'], perKm: 0, service: 'Delivery' },
    van: { label: 'Parcel van', models: ['Tata Ace', 'Maruti Eeco', 'Ford Transit'], perKm: 0, service: 'Parcel' }
  };
  var TYPE_MIX = { IN: [['bike', 22], ['auto', 22], ['cab', 26], ['premium', 4], ['suv', 6], ['bus', 3], ['delivery', 13], ['van', 4]],
    other: [['cab', 46], ['premium', 14], ['suv', 12], ['bike', 4], ['bus', 3], ['delivery', 15], ['van', 6]] };
  var STATUS = { AVAILABLE: 'Available', ON_TRIP: 'On trip', OFFER: 'Offer pending', SOS: 'SOS', OFFLINE: 'Offline' };

  var PLACES = ['Airport Terminal 1', 'Central Railway Station', 'Tech Park Gate 2', 'City Mall', 'Old Town Square', 'University Campus', 'General Hospital', 'Business Bay Tower', 'Lake View Apartments', 'Stadium North', 'Metro Station', 'Convention Centre', 'Harbour Front', 'Green Park', 'Market Street', 'Riverside Hotel'];
  var NOW = Date.now(), MIN = 60000;

  // ------------------------------------------------------------------ generation
  var vehicles = [], rides = [], orders = [], restaurants = [], partners = [];
  var V = {}, R = {}, O = {}, P = {};
  var rideSeq = 1000, orderSeq = 4300, parcelSeq = 88100;

  function jitter(city, spread) { var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * spread; return [city.lat + Math.sin(a) * d, city.lng + Math.cos(a) * d / Math.max(0.3, Math.cos(city.lat * Math.PI / 180))]; }
  function rideId() { rideSeq += int(1, 7); return 'RN-' + pad(rideSeq, 5); }

  function fare(city, type, km, min, surge) {
    var t = TYPES[type] || TYPES.cab, k = { INR: 1, AED: 0.11, SAR: 0.12, GBP: 0.03, USD: 0.04, SGD: 0.05, AUD: 0.06, KES: 4.8, BRL: 0.2, EUR: 0.035, JPY: 5.5 }[city.currency];
    var base = Math.round(40 * k * 100) / 100, dist = Math.round(km * (t.perKm || 14) * k * 100) / 100, time = Math.round(min * 1.5 * k * 100) / 100;
    var surgeAmt = Math.round((base + dist + time) * (surge - 1) * 100) / 100, tax = Math.round((base + dist + time + surgeAmt) * 0.05 * 100) / 100;
    var discount = rnd() < 0.2 ? Math.round((base + dist) * 0.15 * 100) / 100 : 0;
    return { base: base, distance: dist, time: time, surge: surgeAmt, tax: tax, discount: discount, total: Math.round((base + dist + time + surgeAmt + tax - discount) * 100) / 100 };
  }

  function makeRide(city, v, stateName, at) {
    var type = v ? v.type : weighted([['cab', 5], ['auto', 3], ['bike', 3], ['premium', 1], ['suv', 1]]);
    if (city.country !== 'IN' && (type === 'auto' || type === 'bike')) type = 'cab';
    var km = Math.round((2 + rnd() * 18) * 10) / 10, min = Math.round(km * (2.2 + rnd() * 1.5)), surge = rnd() < 0.25 ? [1.2, 1.4, 1.6, 1.8][int(0, 3)] : 1;
    var rider = person(country(city.country).names), from = pick(PLACES), to = pick(PLACES.filter(function (p) { return p !== from; }));
    var payState = { SEARCHING: 'PENDING', OFFER: 'PENDING', DRIVER_ASSIGNED: 'AUTHORISED', ARRIVED: 'AUTHORISED', IN_PROGRESS: 'AUTHORISED', COMPLETED: 'CAPTURED', CANCELLED: 'VOID', NO_DRIVER: 'VOID' }[stateName];
    var method = city.country === 'IN' ? weighted([['UPI', 6], ['Cash', 3], ['Card', 2], ['Wallet', 1]]) : weighted([['Card', 7], ['Wallet', 2], ['Cash', 1]]);
    if (stateName === 'COMPLETED' && rnd() < 0.05) payState = 'FAILED';
    if (stateName === 'COMPLETED' && method === 'Cash') payState = 'COLLECTED';
    var p = jitter(city, 0.12), d = jitter(city, 0.16);
    var r = {
      id: rideId(), city: city.id, service: TYPES[type].service, type: type, state: stateName, requestedAt: at,
      rider: { name: rider.name, initials: rider.initials, rating: (4.2 + rnd() * 0.8).toFixed(1), phone: phoneMasked(city.country), trips: int(1, 240) },
      vehicleId: v ? v.id : null, pickup: { name: from + ', ' + city.name, lat: p[0], lng: p[1] }, drop: { name: to + ', ' + city.name, lat: d[0], lng: d[1] },
      km: km, minutes: min, surge: surge, zone: city.id + '-' + pad(int(1, 24), 2), fare: fare(city, type, km, min, surge), currency: city.currency,
      payment: { method: method, state: payState }, pickupEta: int(2, 9), rating: stateName === 'COMPLETED' && rnd() < 0.7 ? int(3, 5) : null,
      flags: [], notes: [], refunds: [], timeline: []
    };
    var t = at, add = function (m, txt, kind) { t += m * MIN; r.timeline.push({ at: Math.min(t, NOW), text: txt, kind: kind || '' }); };
    add(0, 'Ride requested · quote ' + money(r.fare.total, r.currency));
    add(0.05, 'Dispatch started, ' + int(3, 14) + ' candidates nearby');
    if (stateName === 'NO_DRIVER') { add(3, 'No driver accepted within 3 min', 'a'); add(0.1, 'Rider notified: no driver found', 'a'); }
    else if (stateName !== 'SEARCHING') {
      if (rnd() < 0.3) add(0.2, 'Offer to a nearby driver declined', 'a');
      if (stateName === 'OFFER') add(0.2, 'Offer sent to ' + (v ? v.driver.name : 'driver') + ' · waiting for answer');
      else if (stateName === 'CANCELLED') { add(0.4, (v ? v.driver.name : 'Driver') + ' accepted'); add(int(1, 4), weighted([['Rider cancelled: plans changed', 3], ['Driver cancelled: rider not reachable', 1]]), 'a'); }
      else {
        add(0.4, (v ? v.driver.name : 'Driver') + ' accepted · ETA ' + r.pickupEta + ' min');
        if (stateName !== 'DRIVER_ASSIGNED') {
          add(r.pickupEta, 'Driver arrived at pickup');
          if (stateName !== 'ARRIVED') {
            add(1, 'OTP verified, trip started');
            if (rnd() < 0.15) { add(min / 3, 'Route deviation check sent', 'a'); add(0.2, 'Rider confirmed OK'); r.flags.push('Route deviation'); }
            if (stateName === 'COMPLETED') { add(min, 'Trip completed · ' + km + ' km · ' + min + ' min'); add(0.1, 'Payment ' + payState.toLowerCase() + ' · ' + method, payState === 'FAILED' ? 'a' : ''); if (r.rating) add(2, 'Rider rated ' + r.rating + '★'); }
            else add(0, 'Location every 3 s · ' + int(40, 260) + ' points');
          }
        }
      }
    }
    if (v && v.status === 'SOS') { r.flags.push('SOS'); r.timeline.push({ at: NOW - int(1, 5) * MIN, text: 'SOS raised by ' + weighted([['rider', 2], ['driver', 1]]) + ' · safety team alerted', kind: 'a' }); }
    rides.push(r); R[r.id] = r;
    return r;
  }

  CITY_LIST.forEach(function (city) {
    var mix = TYPE_MIX[city.country] || TYPE_MIX.other, n = city.weight * 14;
    for (var i = 0; i < n; i++) {
      var type = weighted(mix), drv = person(country(city.country).names), pos = jitter(city, 0.11);
      var status = weighted([['AVAILABLE', 40], ['ON_TRIP', 42], ['OFFER', 6], ['OFFLINE', 11], ['SOS', 0.35]]);
      var v = {
        id: 'V' + pad(vehicles.length + 1, 5), type: type, model: pick(TYPES[type].models), plate: plate(city), city: city.id, lat: pos[0], lng: pos[1],
        heading: int(0, 359), status: status, speed: status === 'ON_TRIP' ? int(12, 62) : status === 'AVAILABLE' ? int(0, 25) : 0, ping: int(1, 9),
        driver: { id: 'DR' + pad(vehicles.length + 1, 5), name: drv.name, initials: drv.initials, rating: (4.3 + rnd() * 0.7).toFixed(1), phone: phoneMasked(city.country), trips: int(0, 14), joined: 2019 + int(0, 6) },
        rideId: null, orderId: null
      };
      v.driver.earned = Math.round(v.driver.trips * fare(city, type, 7, 18, 1).total * 0.8);
      vehicles.push(v); V[v.id] = v;
      if (type !== 'delivery' && type !== 'van' && (status === 'ON_TRIP' || status === 'OFFER' || status === 'SOS')) {
        var st = status === 'OFFER' ? 'OFFER' : weighted([['IN_PROGRESS', 6], ['DRIVER_ASSIGNED', 2], ['ARRIVED', 1]]);
        v.rideId = makeRide(city, v, st, NOW - int(4, 40) * MIN).id;
      }
    }
    // waiting requests (no driver yet) and today's finished rides
    for (var w = 0; w < Math.max(1, Math.round(city.weight * 1.4)); w++) makeRide(city, null, 'SEARCHING', NOW - int(0, 3) * MIN);
    for (var h = 0; h < city.weight * 5; h++) {
      var done = vehicles.filter(function (x) { return x.city === city.id && TYPES[x.type].perKm; });
      var st2 = weighted([['COMPLETED', 18], ['CANCELLED', 3], ['NO_DRIVER', 1]]);
      makeRide(city, st2 === 'NO_DRIVER' ? null : pick(done), st2, NOW - int(45, 14 * 60) * MIN);
    }
  });
  rides.sort(function (a, b) { return b.requestedAt - a.requestedAt; });

  // ------------------------------------------------------------------ food & parcel
  var RESTAURANTS = ['Biryani House', 'The Grill Room', 'Udupi Corner', 'Spice Route', 'Pizza Point', 'Green Leaf Café', 'Tea Stall 9', 'Dragon Wok', 'Burger Barn', 'Shawarma Street', 'Sushi Go', 'Pasta Fresca', 'Curry Leaf', 'Taco Town', 'Falafel Co.', 'Dosa Darbar'];
  var DISHES = [['Chicken biryani', 280], ['Paneer tikka', 220], ['Masala dosa', 90], ['Veg thali', 180], ['Margherita pizza', 320], ['Burger meal', 260], ['Chicken shawarma', 150], ['Hakka noodles', 190], ['Salmon roll', 420], ['Falafel wrap', 170], ['Cold coffee', 120], ['Gulab jamun', 80]];
  var ORDER_FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
  var PARCEL_FLOW = ['PLACED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'];
  var LABEL_ORDER = { PLACED: 'Placed', ACCEPTED: 'Accepted by partner', PREPARING: 'Preparing', READY: 'Ready for pickup', PICKED_UP: 'Picked up by courier', ON_THE_WAY: 'On the way', DELIVERED: 'Delivered', CANCELLED: 'Cancelled', FAILED: 'Failed' };
  CITY_LIST.forEach(function (city) {
    var names = RESTAURANTS.slice().sort(function () { return rnd() - 0.5; }).slice(0, Math.min(8, 3 + Math.round(city.weight / 2)));
    names.forEach(function (n) {
      var rs = { id: 'RS-' + city.id + '-' + pad(restaurants.length + 1, 3), name: n, city: city.id, status: weighted([['OPEN', 12], ['BUSY', 2], ['PAUSED', 1]]), prep: int(12, 28), rejects: weighted([[0, 6], [1, 3], [2, 2], [6, 1]]), rating: (3.8 + rnd() * 1.1).toFixed(1) };
      if (rs.status === 'PAUSED') rs.pausedFor = int(10, 60);
      restaurants.push(rs);
    });
    var couriers = vehicles.filter(function (v) { return v.city === city.id && (v.type === 'delivery' || v.type === 'van'); });
    var n = city.weight * 9;
    for (var i = 0; i < n; i++) {
      var food = rnd() < 0.72, flow = food ? ORDER_FLOW : PARCEL_FLOW;
      var st = weighted(food ? [['PLACED', 3], ['ACCEPTED', 3], ['PREPARING', 8], ['READY', 3], ['PICKED_UP', 2], ['ON_THE_WAY', 8], ['DELIVERED', 22], ['CANCELLED', 2]]
        : [['PLACED', 2], ['ACCEPTED', 2], ['PICKED_UP', 3], ['ON_THE_WAY', 6], ['DELIVERED', 14], ['CANCELLED', 1], ['FAILED', 1]]);
      var placed = NOW - (st === 'DELIVERED' || st === 'CANCELLED' || st === 'FAILED' ? int(50, 12 * 60) : int(2, 45)) * MIN;
      var cust = person(country(city.country).names), rest = food ? pick(restaurants.filter(function (x) { return x.city === city.id; })) : null;
      var items = [], k = { INR: 1, AED: 0.045, SAR: 0.045, GBP: 0.011, USD: 0.013, SGD: 0.017, AUD: 0.02, KES: 1.6, BRL: 0.065, EUR: 0.012, JPY: 1.8 }[city.currency];
      if (food) for (var j = 0, m = int(1, 4); j < m; j++) { var dsh = pick(DISHES), same = items.filter(function (x) { return x.name === dsh[0]; })[0]; if (same) same.qty++; else items.push({ name: dsh[0], qty: int(1, 2), price: Math.round(dsh[1] * k * 100) / 100 }); }
      else items.push({ name: pick(['Documents envelope', 'Small box (< 5 kg)', 'Laptop bag', 'Gift parcel', 'Medium box (< 10 kg)']), qty: 1, price: Math.round(int(60, 180) * k * 100) / 100 });
      var sub = items.reduce(function (t, x) { return t + x.qty * x.price; }, 0), del = Math.round(int(20, 45) * k * 100) / 100;
      var promised = placed + int(28, 45) * MIN, idx = flow.indexOf(st);
      var courier = idx >= flow.indexOf('PICKED_UP') || (food && st === 'READY' && rnd() < 0.5) ? pick(couriers) : null;
      var o = {
        id: food ? '#' + (++orderSeq) : 'PRC-' + (parcelSeq += int(1, 9)), kind: food ? 'Food' : 'Parcel', city: city.id, state: st, placedAt: placed, promisedAt: promised,
        partner: food ? { id: rest.id, name: rest.name } : { id: null, name: person(country(city.country).names).name + ' (sender)' },
        customer: { name: cust.name, phone: phoneMasked(city.country), address: pick(PLACES) + ', ' + city.name },
        courierId: courier ? courier.id : null, items: items, currency: city.currency,
        totals: { items: Math.round(sub * 100) / 100, delivery: del, tax: Math.round(sub * 0.05 * 100) / 100, total: Math.round((sub + del + sub * 0.05) * 100) / 100 },
        payment: { method: city.country === 'IN' ? weighted([['UPI', 5], ['Cash', 2], ['Card', 2]]) : 'Card', state: st === 'CANCELLED' ? 'REFUNDED' : st === 'DELIVERED' ? 'CAPTURED' : 'AUTHORISED' },
        issue: null, credits: [], notes: [], timeline: []
      };
      if (courier && courier.status !== 'OFFLINE') { courier.orderId = o.id; }
      var t = placed, add = function (m, txt, kind) { t += m * MIN; o.timeline.push({ at: Math.min(t, NOW), text: txt, kind: kind || '' }); };
      add(0, 'Order placed · ' + money(o.totals.total, o.currency));
      for (var s2 = 1; s2 <= Math.max(0, idx); s2++) add(int(1, 9), LABEL_ORDER[flow[s2]] || flow[s2]);
      if (st === 'CANCELLED') add(int(2, 8), weighted([['Cancelled by customer', 2], ['Cancelled: restaurant could not prepare', 1]]), 'a');
      if (st === 'FAILED') add(int(10, 30), 'Delivery failed: receiver unreachable', 'a');
      var eta = st === 'DELIVERED' ? t : NOW + int(4, 26) * MIN;
      o.etaAt = eta;
      o.lateMin = Math.max(0, Math.round((eta - promised) / MIN));
      if (o.lateMin > 0 && st !== 'DELIVERED' && st !== 'CANCELLED') o.issue = food ? pick(['Kitchen delay', 'Partner rain delay', 'Courier unassigned', 'Batched, 2nd drop', 'Address unclear']) : pick(['Receiver unreachable', 'Traffic', 'Courier unassigned']);
      orders.push(o); O[o.id] = o;
    }
  });
  orders.sort(function (a, b) { return b.placedAt - a.placedAt; });

  // ------------------------------------------------------------------ partner applications
  var PARTNER_TYPES = {
    Restaurant: { docs: [['fssai', 'Food safety licence'], ['gst', 'Tax registration'], ['menu', 'Menu & prices'], ['kitchen', 'Kitchen photos'], ['bank', 'Bank account proof'], ['id', 'Owner ID']], visit: true,
      names: ['Saffron Bowl', 'Coastal Curry', 'Urban Tandoor', 'Green Leaf Café', 'Bao House', 'Malabar Kitchen', 'Little Italy', 'Kebab Corner'] },
    Hotel: { docs: [['reg', 'Business registration'], ['gst', 'Tax registration'], ['fire', 'Fire safety certificate'], ['photos', 'Room photos'], ['bank', 'Bank account proof'], ['id', 'Owner ID']], visit: true,
      names: ['Heritage View Hotel', 'Palm Residency', 'Skyline Suites', 'Lakeside Inn', 'Harbour Lights Hotel', 'Garden Court'] },
    Rental: { docs: [['reg', 'Business registration'], ['rc', 'Vehicle registrations'], ['ins', 'Fleet insurance'], ['permit', 'Rental permit'], ['bank', 'Bank account proof'], ['id', 'Owner ID']], visit: false,
      names: ['Ride Easy Rentals', 'Wheels on Demand', 'City Drive Rentals', 'Zoom Cars Hub'] },
    Bus: { docs: [['reg', 'Operator licence'], ['permit', 'Route permits'], ['fitness', 'Fitness certificates'], ['ins', 'Passenger insurance'], ['bank', 'Bank account proof'], ['id', 'Owner ID']], visit: false,
      names: ['Malabar Travels', 'Deccan Express Lines', 'Southern Star Coaches', 'Gulf Coach Co.'] }
  };
  var STAGES = ['SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'SITE_VISIT', 'AGREEMENT', 'APPROVED', 'LIVE', 'REJECTED', 'SUSPENDED'];
  var REVIEWERS = ['Priya K.', 'Rohit S.', 'Anjali M.', 'Unassigned'];
  for (var pi = 0; pi < 64; pi++) {
    var ptype = weighted([['Restaurant', 9], ['Hotel', 4], ['Rental', 2], ['Bus', 2]]), def = PARTNER_TYPES[ptype], city = weighted(CITY_LIST.map(function (c) { return [c, c.weight]; }));
    var stage = weighted([['SUBMITTED', 9], ['IN_REVIEW', 10], ['INFO_REQUESTED', 5], ['SITE_VISIT', def.visit ? 4 : 0], ['AGREEMENT', 3], ['APPROVED', 2], ['LIVE', 4], ['REJECTED', 3], ['SUSPENDED', 0.5]]);
    var owner = person(country(city.country).names), submitted = NOW - (rnd() < 0.7 ? int(20, 44 * 60) : int(44 * 60, 9 * 24 * 60)) * MIN;
    var app = {
      id: 'PA-' + pad(5100 + pi * 3 + int(0, 2), 5), name: pick(def.names) + (rnd() < 0.3 ? ' · ' + city.name : ''), type: ptype, city: city.id, stage: stage, submittedAt: submitted,
      owner: { name: owner.name, phone: phoneMasked(city.country), email: owner.name.split(' ')[0].toLowerCase() + '@•••••.com' },
      assignee: stage === 'SUBMITTED' ? 'Unassigned' : pick(REVIEWERS.slice(0, 3)), risk: weighted([['Low', 6], ['Medium', 3], ['High', 1]]),
      commission: ptype === 'Restaurant' ? 18 : ptype === 'Hotel' ? 15 : 12, currency: city.currency,
      details: ptype === 'Restaurant' ? { 'Cuisine': pick(['South Indian', 'North Indian', 'Arabic', 'Italian', 'Pan-Asian', 'Cafe']), 'Seats': String(int(20, 120)), 'Avg prep time': int(12, 25) + ' min', 'Delivery radius': int(3, 8) + ' km' }
        : ptype === 'Hotel' ? { 'Rooms': String(int(12, 140)), 'Star rating': int(2, 5) + '★', 'Avg night rate': money(int(1800, 9000) * ({ INR: 1 }[city.currency] || 0.04), city.currency), 'Check-in': '12:00' }
          : ptype === 'Rental' ? { 'Fleet size': String(int(8, 90)), 'Vehicle types': 'Hatchback, Sedan, SUV', 'Self-drive': rnd() < 0.6 ? 'Yes' : 'No', 'Deposit': money(int(2000, 10000) * ({ INR: 1 }[city.currency] || 0.04), city.currency) }
            : { 'Buses': String(int(4, 40)), 'Routes': String(int(2, 18)), 'Sleeper': rnd() < 0.5 ? 'Yes' : 'No', 'Seats per bus': String(int(30, 49)) },
      docs: def.docs.map(function (d) { return { key: d[0], title: d[1], state: 'PENDING', note: '' }; }),
      checks: [], history: [], requested: []
    };
    var verifiedAll = ['SITE_VISIT', 'AGREEMENT', 'APPROVED', 'LIVE', 'SUSPENDED'].indexOf(stage) >= 0;
    app.docs.forEach(function (d) {
      if (verifiedAll) d.state = 'VERIFIED';
      else if (stage === 'IN_REVIEW') d.state = weighted([['VERIFIED', 5], ['PENDING', 4], ['REJECTED', 1]]);
      else if (stage === 'INFO_REQUESTED') d.state = weighted([['VERIFIED', 4], ['REJECTED', 2]]);
      else if (stage === 'REJECTED') d.state = weighted([['VERIFIED', 2], ['REJECTED', 2], ['PENDING', 1]]);
      if (d.state === 'REJECTED') d.note = pick(['Image blurred, please re-upload', 'Name does not match registration', 'Document expired', 'Page missing']);
    });
    if (stage === 'INFO_REQUESTED') { app.requested = app.docs.filter(function (d) { return d.state === 'REJECTED'; }).map(function (d) { return d.key; }); if (!app.requested.length) { app.docs[0].state = 'REJECTED'; app.docs[0].note = 'Document expired'; app.requested = [app.docs[0].key]; } }
    app.checks = [
      ['Business registration lookup', rnd() < 0.9 ? ['Valid, matches name', 'pass'] : ['Name mismatch', 'fail']],
      ['Tax ID status', rnd() < 0.92 ? ['Active', 'pass'] : ['Not found', 'fail']],
      ['Location', rnd() < 0.85 ? ['Pin matches map listing', 'pass'] : ['Pin 600 m away from listing', 'warn']],
      ['Photos', rnd() < 0.9 ? ['No duplicates online', 'pass'] : ['2 photos found on another listing', 'warn']],
      ['Bank account', rnd() < 0.9 ? ['Name match ' + int(88, 100) + '%', 'pass'] : ['Name match 61%', 'warn']],
      ['Sanctions & watch lists', ['No match', 'pass']]
    ].map(function (c) { return { name: c[0], result: c[1][0], state: c[1][1] }; });
    if (verifiedAll) app.checks.forEach(function (c) { if (c.state === 'fail') { c.state = 'pass'; c.result = 'Resolved manually'; } });
    var t = submitted, add = function (m, txt, by) { t += m * MIN; app.history.push({ at: Math.min(t, NOW), text: txt, by: by || 'System' }); };
    add(0, 'Application submitted from the partner app', app.owner.name);
    add(1, 'Automatic checks completed');
    if (stage !== 'SUBMITTED') add(int(30, 600), 'Review started', app.assignee);
    if (stage === 'INFO_REQUESTED') add(int(10, 90), 'More information requested: ' + app.requested.length + ' document(s)', app.assignee);
    if (['SITE_VISIT', 'AGREEMENT', 'APPROVED', 'LIVE', 'SUSPENDED'].indexOf(stage) >= 0) add(int(30, 240), 'All documents verified', app.assignee);
    if (stage === 'SITE_VISIT') { app.visit = { at: NOW + int(1, 4) * 24 * 60 * MIN, by: pick(['Field team North', 'Field team South']) }; add(5, 'Site visit scheduled', app.assignee); }
    if (['AGREEMENT', 'APPROVED', 'LIVE', 'SUSPENDED'].indexOf(stage) >= 0) { if (def.visit) add(int(600, 2000), 'Site visit passed', 'Field team'); add(10, 'Agreement sent · commission ' + app.commission + '%', app.assignee); }
    if (['APPROVED', 'LIVE', 'SUSPENDED'].indexOf(stage) >= 0) add(int(200, 1500), 'Agreement signed by the partner', app.owner.name);
    if (['LIVE', 'SUSPENDED'].indexOf(stage) >= 0) add(int(30, 300), 'Partner is live on RideNova', app.assignee);
    if (stage === 'SUSPENDED') add(int(300, 3000), 'Suspended: repeated customer complaints', app.assignee);
    if (stage === 'REJECTED') { app.rejection = pick(['Documents not valid', 'Failed site visit', 'Duplicate listing']); add(int(60, 900), 'Rejected: ' + app.rejection, app.assignee); }
    partners.push(app); P[app.id] = app;
  }
  partners.sort(function (a, b) { return a.submittedAt - b.submittedAt; });

  // ------------------------------------------------------------------ helpers
  // geography filter {country, state, city}: empty values mean "all"
  function inGeo(cityId, g) {
    if (!g) return true;
    var c = CITIES[cityId]; if (!c) return false;
    return (!g.country || c.country === g.country) && (!g.state || c.state === g.state) && (!g.city || c.id === g.city);
  }
  function geoLabel(g) {
    if (g && g.city) return CITIES[g.city].name;
    if (g && g.state) { var s = state(g.country, g.state); return s ? s.name : 'All'; }
    if (g && g.country) { var c = country(g.country); return c ? c.name : 'All'; }
    return 'All countries';
  }
  function citiesIn(g) { return CITY_LIST.filter(function (c) { return inGeo(c.id, g); }); }

  RN.opsData = {
    COUNTRIES: COUNTRIES, CITIES: CITIES, CITY_LIST: CITY_LIST, TYPES: TYPES, STATUS: STATUS, STAGES: STAGES, PARTNER_TYPES: PARTNER_TYPES,
    ORDER_FLOW: ORDER_FLOW, PARCEL_FLOW: PARCEL_FLOW, LABEL_ORDER: LABEL_ORDER, REVIEWERS: REVIEWERS,
    vehicles: vehicles, rides: rides, orders: orders, restaurants: restaurants, partners: partners,
    vehicle: function (id) { return V[id] || null; }, ride: function (id) { return R[id] || null; }, order: function (id) { return O[id] || null; }, partner: function (id) { return P[id] || null; },
    addRide: function (r) { if (!R[r.id]) { rides.unshift(r); R[r.id] = r; } return R[r.id]; },
    country: country, state: state, inGeo: inGeo, geoLabel: geoLabel, citiesIn: citiesIn, money: money, NOW: NOW,
    random: rnd, int: int
  };
})();
