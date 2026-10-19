/* RideNova Customer app - food, parcels, trip assistant, emergency, support (working screens).
   R44 food home, R45 menu & cart, R46 order tracking, R47 send a parcel, R48 parcel tracking, R52 AI trip assistant,
   R51 medical emergency, R26 support & chat, R27 report an issue. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.store, P = RN.product, h = P.h, ic = P.ic, rs = P.rs;
  var exec = K.exec;
  function pr(n) { return Math.round(n * 100); }

  // ------------------------------------------------------------ restaurants and menus (synthetic)
  // menu item: [name, price in rupees, veg, description, section, bestseller]
  var RESTS = [
    { id: 'bh', n: 'Biryani House', cu: 'Hyderabadi \u00B7 Biryani', veg: false, r: 4.4, km: 1.8, min: 28, for2: 350, offer: '40% OFF up to \u20B980', menu: [
      ['Chicken dum biryani', 289, 0, 'Basmati, slow-cooked, with raita', 'Biryani', 1], ['Paneer biryani', 249, 1, 'Fragrant rice, tandoori paneer', 'Biryani', 0], ['Mutton biryani', 379, 0, 'Tender mutton, family pack serves 2', 'Biryani', 1],
      ['Veg dum biryani', 219, 1, 'Seasonal vegetables and saffron', 'Biryani', 0], ['Chicken 65', 199, 0, 'Crisp curry-leaf fried chicken', 'Starters', 0], ['Mirchi ka salan', 79, 1, 'Peanut-sesame chilli curry', 'Sides', 0], ['Double ka meetha', 99, 1, 'Hyderabadi bread pudding', 'Desserts', 0], ['Thums Up 750 ml', 45, 1, 'Chilled', 'Drinks', 0]] },
    { id: 'uc', n: 'Udupi Corner', cu: 'South Indian \u00B7 Pure veg', veg: true, r: 4.5, km: 0.9, min: 22, for2: 180, offer: 'Free delivery', free: true, menu: [
      ['Masala dosa', 89, 1, 'Crisp dosa, potato masala, chutneys', 'Tiffin', 1], ['Idli (3) with sambar', 59, 1, 'Soft steamed idlis', 'Tiffin', 0], ['Medu vada (2)', 65, 1, 'Crisp and fluffy', 'Tiffin', 0], ['Ghee pongal', 79, 1, 'Peppery rice and dal', 'Tiffin', 0],
      ['Rava kesari', 49, 1, 'Sweet semolina', 'Desserts', 0], ['Filter coffee', 35, 1, 'Strong and frothy', 'Drinks', 1], ['South Indian thali', 149, 1, 'Rice, sambar, rasam, curd, 2 curries', 'Meals', 1]] },
    { id: 'gr', n: 'The Grill Room', cu: 'Continental \u00B7 Grills', veg: false, r: 4.6, km: 3.4, min: 35, for2: 1200, offer: '\u20B975 off above \u20B9299', menu: [
      ['Peri-peri chicken (half)', 389, 0, 'Charcoal grilled, fries', 'Grills', 1], ['Lamb chops', 549, 0, 'Rosemary jus, mash', 'Grills', 0], ['Grilled veg platter', 329, 1, 'Seasonal vegetables, hummus', 'Grills', 0],
      ['Chicken Caesar salad', 299, 0, 'Parmesan, croutons', 'Salads', 0], ['Mushroom soup', 159, 1, 'Cream, thyme', 'Starters', 0], ['Brownie with ice cream', 179, 1, 'Warm chocolate brownie', 'Desserts', 1]] },
    { id: 'ps', n: 'Pizza Street', cu: 'Pizza \u00B7 Italian', veg: false, r: 4.2, km: 2.2, min: 30, for2: 500, offer: 'Buy 1 get 1 on large', menu: [
      ['Margherita (medium)', 249, 1, 'Mozzarella, basil', 'Pizza', 1], ['Pepperoni (medium)', 349, 0, 'Spicy pepperoni, cheese', 'Pizza', 1], ['Farmhouse (medium)', 329, 1, 'Capsicum, onion, olives, mushroom', 'Pizza', 0],
      ['Garlic bread with cheese', 129, 1, '4 pieces', 'Sides', 0], ['Pasta alfredo', 229, 1, 'Creamy white sauce', 'Pasta', 0], ['Cola 600 ml', 50, 1, 'Chilled', 'Drinks', 0]] },
    { id: 'gb', n: 'Green Bowl', cu: 'Healthy \u00B7 Salads & bowls', veg: true, r: 4.3, km: 1.4, min: 24, for2: 420, offer: '20% off first order', menu: [
      ['Quinoa power bowl', 269, 1, 'Quinoa, chickpeas, avocado', 'Bowls', 1], ['Paneer tikka salad', 229, 1, 'High protein', 'Salads', 0], ['Hummus and pita', 169, 1, 'House made', 'Sides', 0],
      ['Cold-pressed orange juice', 119, 1, 'No added sugar', 'Drinks', 0], ['Oats and berry parfait', 139, 1, 'Greek yoghurt', 'Desserts', 0]] },
    { id: 'st', n: 'Sweet Tooth', cu: 'Desserts \u00B7 Bakery', veg: true, r: 4.7, km: 2.7, min: 26, for2: 300, offer: 'Free delivery', free: true, menu: [
      ['Chocolate truffle cake (500 g)', 449, 1, 'Dark chocolate ganache', 'Cakes', 1], ['Red velvet pastry', 119, 1, 'Cream cheese frosting', 'Pastries', 0], ['Gulab jamun (4)', 99, 1, 'Warm with rabri', 'Indian sweets', 1],
      ['Rasmalai (2)', 129, 1, 'Saffron milk', 'Indian sweets', 0], ['Cold coffee', 99, 1, 'Thick and creamy', 'Drinks', 0]] }
  ];
  P.RESTS = RESTS;
  function rest(id) { return RESTS.filter(function (r) { return r.id === id; })[0]; }
  P.cart = { rest: null, q: {}, deliv: 'Standard', note: '' };
  function cartLines() { var r = rest(P.cart.rest); if (!r) return []; return Object.keys(P.cart.q).filter(function (i) { return P.cart.q[i] > 0; }).map(function (i) { var m = r.menu[+i]; return { i: +i, n: m[0], price: pr(m[1]), q: P.cart.q[i], veg: m[2] }; }); }
  function cartCount() { return cartLines().reduce(function (s, l) { return s + l.q; }, 0); }
  function deliveries(r) {
    var base = r.min; return [['Priority', r.free ? 2900 : 4900, Math.max(12, base - 6), 'Direct to you'], ['Standard', r.free ? 0 : 2900, base, 'Usual route'], ['Saver', 0, base + 12, 'Shared with a nearby order \u00B7 CHEAPEST']];
  }
  function bill(r) {
    var u = S.user(), lines = cartLines(), items = lines.reduce(function (s, l) { return s + l.price * l.q; }, 0), dl = deliveries(r).filter(function (d) { return d[0] === P.cart.deliv; })[0] || deliveries(r)[1];
    var d = P.discount('food', items), hasBir = lines.some(function (l) { return /biryani/i.test(l.n); });
    if (d.code === 'BIRYANI40' && !hasBir) d = { paise: 0, code: d.code, why: 'BIRYANI40 works on biryani orders only.' };
    var tax = Math.round(items * 0.05), total = items + dl[1] + tax - d.paise;
    return { lines: lines, items: items, fee: dl[1], eta: dl[2], dlName: dl[0], tax: tax, disc: d.paise, code: d.code, why: d.why, total: Math.max(0, total), min: 9900 };
  }

  // ------------------------------------------------------------ R44 food home
  P.screen('R44', {
    title: 'Food', back: 'R29', nav: 'home',
    reset: function (v) { v.q = ''; v.f = []; v.prio = UI.engine.state.rider.priority; },
    right: function () { return h('button', { type: 'button', class: 'chip', on: { click: function () { P.nav.rest = P.cart.rest || P.nav.rest; if (P.cart.rest) UI.go('R45'); else UI.toast('Your cart is empty. Pick a restaurant first.', 'info'); } } }, [ic('box', 14), ' ' + cartCount()]); },
    build: function (body, v) {
      var u = S.user(), addr = (u.saved.home && u.saved.home.area) || 'Road 12, Banjara Hills';
      body.appendChild(h('div', { class: 'p-where card-m' }, [ic('pin', 18), h('span', { class: 'x-flex-1' }, [h('span', { class: 'xs' }, 'Deliver to'), h('b', null, ' ' + addr)])]));
      body.appendChild(P.search('Search restaurants or dishes', function (q) { v.q = q.trim().toLowerCase(); draw(); }));
      body.appendChild(P.chips([['urgent', 'Urgent'], ['bal', 'Balanced'], ['saver', 'Saver'], ['flex', 'Flexible'], ['deals', 'Deals']], v.prio, function (p) { v.prio = p; exec('rider.priority', { arg: p }, null, { instant: true }); draw(); }));
      body.appendChild(P.chips(['Veg only', 'Under 30 min', 'Offers', 'Rating 4.5+'], v.f, function (f) { v.f = f; draw(); }, true));
      var list = h('div', { class: 'p-opts' }); body.appendChild(list);
      if (cartCount()) body.appendChild(h('div', { class: 'p-cartbar' }, P.btn('View cart \u00B7 ' + cartCount() + ' item' + (cartCount() > 1 ? 's' : ''), '', function () { P.nav.rest = P.cart.rest; UI.go('R45'); })));
      function draw() {
        P.clear(list);
        var rows = RESTS.filter(function (r) {
          if (v.q && (r.n + ' ' + r.cu + ' ' + r.menu.map(function (m) { return m[0]; }).join(' ')).toLowerCase().indexOf(v.q) < 0) return false;
          return v.f.every(function (f) { return f === 'Veg only' ? r.veg : f === 'Under 30 min' ? r.min < 30 : f === 'Offers' ? !!r.offer : r.r >= 4.5; });
        });
        var by = { urgent: function (a, b) { return a.min - b.min; }, saver: function (a, b) { return (a.free ? 0 : 1) - (b.free ? 0 : 1) || a.for2 - b.for2; }, flex: function (a, b) { return a.for2 - b.for2; }, deals: function (a, b) { return (b.offer ? 1 : 0) - (a.offer ? 1 : 0); }, bal: function (a, b) { return b.r - a.r; } }[v.prio];
        rows.sort(by);
        if (!rows.length) { list.appendChild(P.empty('No restaurants match. Clear a filter or search again.', 'food')); return; }
        rows.forEach(function (r) {
          list.appendChild(h('button', { type: 'button', class: 'card-m p-restcard', on: { click: function () { P.nav.rest = r.id; UI.go('R45'); } } }, [
            h('div', { class: 'p-photo' }, r.n), h('div', { class: 'kv' }, [h('b', null, r.n), h('span', { class: 'p-rate' }, '\u2605 ' + r.r)]),
            h('div', { class: 'xs' }, (r.veg ? 'Pure veg \u00B7 ' : '') + r.cu + ' \u00B7 \u20B9' + r.for2 + ' for two'), h('div', { class: 'xs' }, r.min + ' min \u00B7 ' + r.km + ' km'), r.offer ? h('span', { class: 'p-pill' }, r.offer) : null]));
        });
      }
      draw();
    }
  });

  // ------------------------------------------------------------ R45 menu & cart
  P.screen('R45', {
    title: function () { var r = rest(P.nav.rest || P.cart.rest); return r ? r.n : 'Menu'; }, back: 'R44',
    reset: function (v) { v.sec = 'All'; v.veg = false; if (!P.nav.rest) P.nav.rest = P.cart.rest || 'bh'; },
    build: function (body, v) {
      var r = rest(P.nav.rest) || RESTS[0], u = S.user();
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('span', { class: 'xs' }, r.cu), h('span', { class: 'p-rate' }, '\u2605 ' + r.r)]), h('div', { class: 'xs' }, r.min + ' min \u00B7 ' + r.km + ' km' + (r.offer ? ' \u00B7 ' + r.offer : ''))]));
      var secs = ['All'].concat(r.menu.map(function (m) { return m[4]; }).filter(function (x, i, a) { return a.indexOf(x) === i; }));
      body.appendChild(P.chips(secs, v.sec, function (s) { v.sec = s; drawMenu(); }));
      if (!r.veg) body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Veg only'), P.toggle(false, function (on) { v.veg = on; drawMenu(); }, 'Veg only')]));
      var menu = h('div', { class: 'list' }), cart = h('div'); body.appendChild(menu); body.appendChild(cart);
      function setQty(i, n) {
        if (P.cart.rest && P.cart.rest !== r.id && cartCount() && n > 0) {
          UI.confirm('Your cart has items from ' + rest(P.cart.rest).n + '. Start a new cart from ' + r.n + '?', 'Replace cart').then(function (yes) { if (yes) { P.cart = { rest: r.id, q: {}, deliv: 'Standard', note: '' }; P.cart.q[i] = n; drawMenu(); drawCart(); } }); return;
        }
        if (!P.cart.rest || !cartCount()) P.cart = { rest: r.id, q: {}, deliv: P.cart.deliv || 'Standard', note: P.cart.note || '' };
        P.cart.q[i] = n; if (n === 0) delete P.cart.q[i]; drawCart(); if (!cartCount()) P.cart.rest = null;
      }
      function drawMenu() {
        P.clear(menu);
        r.menu.forEach(function (m, i) {
          if ((v.sec !== 'All' && m[4] !== v.sec) || (v.veg && !m[2])) return;
          var q = P.cart.rest === r.id ? (P.cart.q[i] || 0) : 0, counter = h('span');
          var st = P.stepper(q, function (n) { setQty(i, n); }, 0, 9);
          menu.appendChild(h('div', { class: 'p-menu-item' }, [h('span', { class: 'p-veg' + (m[2] ? '' : ' nv'), 'aria-label': m[2] ? 'Veg' : 'Non-veg' }), h('span', { class: 'tx x-flex-1' }, [h('b', null, m[0] + (m[5] ? '  \u2605 Bestseller' : '')), h('span', { class: 'xs' }, m[3]), h('b', null, rs(pr(m[1])))]), st]));
        });
        if (!menu.firstChild) menu.appendChild(P.empty('Nothing in this section matches.', 'food'));
      }
      function drawCart() {
        P.clear(cart); if (P.cart.rest !== r.id || !cartCount()) { cart.appendChild(P.sec('Your cart is empty. Add dishes to order.')); return; }
        var b = bill(r), opts = deliveries(r);
        cart.appendChild(P.sec('DELIVERY'));
        var dl = h('div', { class: 'p-opts' }); opts.forEach(function (d) { dl.appendChild(P.opt({ icon: d[0] === 'Priority' ? 'bolt' : d[0] === 'Saver' ? 'tag' : 'bike', title: d[0], sub: d[2] + ' min \u00B7 ' + d[3], price: d[1] ? rs(d[1]) : 'Free', on: P.cart.deliv === d[0], onClick: function () { P.cart.deliv = d[0]; drawCart(); } })); }); cart.appendChild(dl);
        cart.appendChild(P.field({ name: 'cnote', label: 'Cooking note (optional)', maxlength: 80, value: P.cart.note, placeholder: 'e.g. less spicy', on: { input: function () { P.cart.note = UI.val('cnote'); } } }));
        var sum = h('div', { class: 'card-m' });
        b.lines.forEach(function (l) { sum.appendChild(P.kv(l.n + ' \u00D7 ' + l.q, rs(l.price * l.q))); });
        sum.appendChild(h('div', { class: 'hr' })); sum.appendChild(P.kv('Items', rs(b.items))); sum.appendChild(P.kv('Delivery (' + b.dlName + ')', b.fee ? rs(b.fee) : 'Free')); sum.appendChild(P.kv('Taxes (5%)', rs(b.tax)));
        if (b.disc) sum.appendChild(P.kv('Coupon ' + b.code, '-' + rs(b.disc))); else if (b.why) sum.appendChild(h('div', { class: 'xs' }, b.why)); else if (!u.coupon) sum.appendChild(h('a', { class: 'xs p-link', href: '#/R22', 'data-go': 'R22' }, 'Have a coupon? Apply one'));
        sum.appendChild(h('div', { class: 'hr' })); sum.appendChild(h('div', { class: 'kv' }, [h('b', null, 'To pay'), h('b', { class: 'x-font-size-18px' }, rs(b.total))]));
        sum.appendChild(h('div', { class: 'xs' }, 'Delivering to ' + ((u.saved.home && u.saved.home.area) || 'Road 12, Banjara Hills') + ' \u00B7 about ' + b.eta + ' min'));
        cart.appendChild(sum);
        var below = b.items < b.min;
        if (below) cart.appendChild(P.banner('warn', 'Minimum order is ' + rs(b.min) + '. Add ' + rs(b.min - b.items) + ' more.', 'info'));
        cart.appendChild(P.btn(b.lines.length + ' item' + (b.lines.length > 1 ? 's' : '') + ' \u00B7 Pay ' + rs(b.total), below ? 'p-disabled' : '', function () { if (!below) place(r, b); else UI.toast('Add ' + rs(b.min - b.items) + ' more to reach the minimum order.', 'warn'); }));
      }
      drawMenu(); drawCart();
    }
  });
  function place(r, b) {
    var cur = UI.engine.order();
    if (cur && ['DELIVERED', 'REJECTED', 'CANCELLED'].indexOf(cur.state) < 0) { UI.toast('You already have an order on the way. Track it first.', 'warn'); UI.go('R46'); return; }
    P.pay({ title: 'Order from ' + r.n, paise: b.total, allow: ['Wallet', 'UPI', 'Card', 'Cash'], note: b.disc ? 'Coupon ' + b.code + ' saves ' + rs(b.disc) : '', onPaid: function (m) {
      exec('order.place', { delivery: b.dlName }).then(function (res) {
        var u = S.user();
        if (!res || !res.ok) { if (m === 'Wallet') { S.credit(u, b.total, 'Refund: ' + r.n, 'Refund'); P.applyUser(u); } return; }
        var o = UI.engine.state.orders[res.orderId];
        Object.assign(o, { restaurant: r.n, items: b.lines.map(function (l) { return [l.n + ' \u00D7 ' + l.q, l.price * l.q]; }), itemsPaise: b.items, couponPaise: b.disc, deliveryPaise: b.fee, totalPaise: b.total, delivery: b.dlName, note: P.cart.note || '', drop: (u.saved.home && u.saved.home.area) || 'Road 12, Banjara Hills', etaMin: b.eta, prepMin: 12 });
        if (b.disc) P.useCoupon(b.disc, 'food', b.code);
        S.addBooking({ type: 'food', title: r.n, sub: b.lines.length + ' item' + (b.lines.length > 1 ? 's' : '') + ' \u00B7 ' + b.dlName + ' delivery', paise: b.total, status: 'Placed', when: Date.now(), orderId: res.orderId, orderKey: o.placedAt, payMethod: m, pay: m === 'Cash' ? 'Cash on delivery' : m, code: P.code(), restId: r.id,
          details: b.lines.map(function (l) { return [l.n, 'x' + l.q + ' \u00B7 ' + rs(l.price * l.q)]; }).concat([['Delivery', b.dlName + ' \u00B7 ' + (b.fee ? rs(b.fee) : 'Free')], ['Paid with', m]]) });
        P.cart = { rest: null, q: {}, deliv: 'Standard', note: '' }; UI.toast('Order #' + res.orderId + ' placed with ' + r.n + '.', 'info'); UI.go('R46');
      });
    } });
  }

  // ------------------------------------------------------------ R46 order tracking
  var STAGE_OF = { PLACED: 0, ACCEPTED: 1, PREPARING: 1, READY: 2, PICKED_UP: 3, DELIVERED: 4 };
  var STEPS = ['Order placed', 'Accepted and being prepared', 'Ready for pickup', 'Picked up by delivery partner', 'Delivered'];
  function stageTime(o, i) { if (i === 0) return o.placedAt; var to = [null, ['ACCEPTED', 'PREPARING'], ['READY'], ['PICKED_UP'], ['DELIVERED']][i], hit = (o.history || []).filter(function (x) { return to.indexOf(x.to) >= 0; })[0]; return hit ? hit.at : null; }
  P.screen('R46', {
    title: 'Order tracking', back: 'R44', nav: 'trips',
    build: function (body, v) {
      var o = UI.engine.order(); v.o = o;
      if (!o) { body.appendChild(P.empty('No food order yet. Order something tasty and follow it here.', 'food')); body.appendChild(P.btn('Browse restaurants', '', function () { UI.go('R44'); })); return; }
      v.head = h('div', { class: 'card-m brand' }); v.bar = P.progress(5); v.tl = h('div', { class: 'p-timeline' }); v.cour = h('div'); v.act = h('div');
      body.appendChild(v.head); body.appendChild(v.bar); body.appendChild(v.tl); body.appendChild(v.cour);
      var sum = h('div', { class: 'card-m' }, [h('b', null, o.restaurant)]); (o.items || []).forEach(function (it) { sum.appendChild(P.kv(it[0], rs(it[1]))); }); sum.appendChild(h('div', { class: 'hr' })); sum.appendChild(P.kv('Total paid', rs(o.totalPaise))); sum.appendChild(P.kv('Delivering to', o.drop || '')); if (o.note) sum.appendChild(P.kv('Note', o.note));
      body.appendChild(sum); body.appendChild(v.act); v.refresh = refresh; refresh();
      function refresh() {
        var o = UI.engine.order(); if (!o) return; v.o = o; var st = STAGE_OF[o.state], dead = o.state === 'REJECTED' || o.state === 'CANCELLED';
        P.clear(v.head); P.clear(v.cour); P.clear(v.act);
        if (dead) { v.head.appendChild(h('b', null, 'Order #' + o.id + ' ' + o.state.toLowerCase())); v.head.appendChild(h('span', { class: 'xs' }, 'Refund of ' + rs(o.totalPaise) + ' is on its way (simulated).')); P.setWidth(v.bar, 0); v.act.appendChild(P.btn('Back to food', '', function () { UI.go('R44'); })); P.clear(v.tl); return; }
        var eta = Math.max(1, Math.round((o.etaMin || 28) * (1 - [0.05, 0.25, 0.55, 0.8, 1][st]))), pct = [8, 30, 55, 80, 100][st];
        v.head.appendChild(h('span', { class: 'xs' }, 'Order #' + o.id + ' \u00B7 ' + o.restaurant)); v.head.appendChild(h('b', { class: 'big-num' }, st === 4 ? 'Delivered' : 'Arriving in ' + eta + ' min'));
        v.head.appendChild(h('span', { class: 'xs' }, { PLACED: 'Waiting for the restaurant to accept', ACCEPTED: 'Restaurant accepted your order', PREPARING: 'Being prepared \u00B7 about ' + (o.prepMin || 12) + ' min', READY: 'Packed and ready for pickup', PICKED_UP: 'On the way to you', DELIVERED: 'Enjoy your meal!' }[o.state]));
        if (st < 4) v.head.appendChild(h('span', { class: 'p-pill' }, 'Share code ' + o.otp + ' with the delivery partner')); P.setWidth(v.bar, pct);
        P.clear(v.tl); STEPS.forEach(function (t, i) { var at = stageTime(o, i); v.tl.appendChild(h('div', { class: 'p-tstep' + (i <= st ? ' done' : '') + (i === st && st < 4 ? ' now' : '') }, [h('span', { class: 'p-dot' }), h('span', { class: 'tx' }, [h('b', null, t), h('span', { class: 'xs' }, at && i <= st ? P.ftime(at) : 'Pending')])])); });
        var d = o.courier && o.courier.state === 'ACCEPTED' ? D.DRIVERS[o.courier.id] : null;
        if (d) v.cour.appendChild(h('div', { class: 'card-m p-hello' }, [h('span', { class: 'av' }, (d.short || 'D')[0]), h('div', { class: 'x-flex-1 p-left' }, [h('b', null, d.name || d.short), h('div', { class: 'xs' }, (d.vehicle || 'Bike') + ' \u00B7 contactless drop on')]), h('span', { class: 'p-rate' }, '\u2605 ' + (d.rating || 4.8)),
          h('button', { type: 'button', class: 'ib', 'aria-label': 'Call delivery partner', on: { click: function () { UI.toast('Calling ' + (d.short || 'your delivery partner') + ' on a masked number (simulated).', 'sim'); } } }, ic('phone'))]));
        if (st === 4) {
          var bk = S.user().bookings.filter(function (b) { return b.orderId === o.id && b.orderKey === o.placedAt; })[0];
          if (bk && bk.rating) v.act.appendChild(P.banner('info', 'Thanks! You rated this order ' + bk.rating + '/5.', 'star'));
          else if (bk) { v.act.appendChild(P.sec('RATE THIS ORDER')); v.act.appendChild(P.chips([[5, '\u2605 5'], [4, '\u2605 4'], [3, '\u2605 3'], [2, '\u2605 2'], [1, '\u2605 1']], null, function (n) { bk.rating = n; S.save(); UI.toast('Thanks for rating ' + o.restaurant + ' ' + n + '/5.', 'info'); refresh(); })); }
          v.act.appendChild(P.btn('Order again', '', function () { var b = S.user().bookings.filter(function (x) { return x.orderId === o.id; })[0]; P.nav.rest = (b && b.restId) || 'bh'; UI.go('R45'); }));
        } else if (st <= 1) v.act.appendChild(P.btn('Cancel order', 'ghost', function () { UI.confirm('Cancel this order? You will be refunded in full.', 'Cancel order').then(function (y) { if (y) exec('order.cancel', {}, null, { instant: true }); }); }));
        v.act.appendChild(P.btn('Help with this order', 'ghost sm', function () { P.nav.helpRef = 'Order #' + o.id; UI.go('R26'); }));
      }
    },
    update: function (v) { if (v.refresh) v.refresh(); }, tick: function (v) { if (v.refresh && UI.sid === 'R46') v.refresh(); }
  });

  // ------------------------------------------------------------ parcels
  var PSTAGES = ['Booked', 'Picked up from sender', 'Handed to carrier', 'On the way', 'Out for delivery', 'Delivered'];
  P.parcelStage = function (b) { if (b.status === 'Cancelled') return -1; return Math.min(5, Math.floor((Date.now() - b.createdAt) / (b.stepMs || 30000))); };
  P.parcelLabel = function (b) { var s = P.parcelStage(b); return s < 0 ? 'Cancelled' : s === 5 ? 'Delivered' : s === 0 ? 'Booked' : s === 1 ? 'Picked up' : 'In transit'; };
  P.every(function () {
    var u = S.user(); if (!u) return;
    u.bookings.forEach(function (b) {
      if (b.type !== 'parcel' || b.status === 'Cancelled') return; var s = P.parcelStage(b);
      if ((b.notified == null ? 0 : b.notified) < s) { b.notified = s; if (s === 5) b.status = 'Delivered'; S.save(); if (s <= 5 && [1, 3, 5].indexOf(s) >= 0) S.notify(u, 'Parcel ' + b.pid + ': ' + PSTAGES[s].toLowerCase(), b.title, 'Orders', 'R48'); }
    });
  });
  var PTYPES = [['Documents', 'Documents \u00B7 up to 500 g', 0], ['Small', 'Small \u00B7 up to 5 kg', 1], ['Medium', 'Medium \u00B7 up to 15 kg', 2]];
  var MEALS = [
    { id: 'Breakfast', window: '7:00–10:30 AM', tag: 'MORNING', factor: 0.95 },
    { id: 'Lunch', window: '12:00–3:00 PM', tag: 'PEAK', factor: 1.1 },
    { id: 'Dinner', window: '7:00–10:30 PM', tag: 'EVENING', factor: 1.05 }
  ];
  function mealHint() {
    var hr = new Date().getHours();
    if (hr >= 6 && hr < 11) return 'Breakfast';
    if (hr >= 11 && hr < 16) return 'Lunch';
    if (hr >= 16 && hr < 23) return 'Dinner';
    return 'Lunch';
  }
  P.screen('R47', {
    title: 'Send a parcel', back: 'R29',
    reset: function (v) { v.scope = 'Within city'; v.ptype = 'Small'; v.opt = 0; v.insure = false; v.toCity = 'Mysuru'; v.meal = mealHint(); },
    build: function (body, v) {
      var u = S.user(), home = (u.saved.home && u.saved.home.area) || 'Road 12, Banjara Hills';
      body.appendChild(P.chips(['Within city', 'To another city', 'Home food'], v.scope, function (s) { v.scope = s; v.opt = 0; if (s === 'Home food') { v.ptype = 'Small'; v.meal = mealHint(); } draw(); }));
      var mealBox = h('div'); body.appendChild(mealBox);
      body.appendChild(P.sec('PICKUP'));
      body.appendChild(P.field({ name: 'pfrom', label: 'Pick-up address', value: home, maxlength: 80 }));
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'sname', label: 'Sender name', value: u.name, maxlength: 40 }), P.field({ name: 'sphone', label: 'Sender phone', type: 'tel', inputmode: 'numeric', value: u.phone, maxlength: 10 })]));
      body.appendChild(P.sec('DELIVERY'));
      var cityBox = h('div'); body.appendChild(cityBox);
      body.appendChild(P.field({ name: 'pto', label: 'Delivery address', maxlength: 80, placeholder: v.scope === 'Home food' ? 'Office / home where food should arrive' : 'House, street, area' }));
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'rname', label: 'Receiver name', maxlength: 40 }), P.field({ name: 'rphone', label: 'Receiver phone', type: 'tel', inputmode: 'numeric', maxlength: 10 })]));
      body.appendChild(P.sec('PARCEL'));
      var typeBox = h('div'); body.appendChild(typeBox);
      body.appendChild(P.field({ name: 'what', label: 'What is inside? (required)', maxlength: 60, placeholder: 'e.g. Home lunch dabba, books, documents' }));
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Add insurance up to \u20B95,000 (+\u20B920)'), P.toggle(false, function (on) { v.insure = on; draw(); }, 'Insurance')]));
      var opts = h('div', { class: 'p-opts' }), total = h('div', { class: 'kv' }); body.appendChild(P.sec('CHOOSE A SERVICE')); body.appendChild(opts); body.appendChild(total);
      var go = P.btn('Book parcel', '', submit); body.appendChild(go);
      function km() { return v.scope === 'To another city' ? P.roadKm('Hyderabad', v.toCity) : 3 + Math.floor(P.seeded(UI.val('pfrom') + UI.val('pto'))() * 12); }
      function services() {
        var k = km(), w = [1, 1.4, 2.1][Math.max(0, PTYPES.map(function (t) { return t[0]; }).indexOf(v.ptype))];
        if (v.scope === 'Home food') {
          var m = MEALS.filter(function (x) { return x.id === v.meal; })[0] || MEALS[1];
          var f = m.factor;
          return [
            ['Meal express', 'HOT', 'Bike \u00B7 ' + m.id.toLowerCase() + ' slot ' + m.window + ' \u00B7 ~' + (20 + Math.round(k * 2.2)) + ' min', Math.round((55 + k * 8) * f), 25],
            ['Scheduled meal', m.tag, 'Guaranteed drop in the ' + m.id.toLowerCase() + ' window (' + m.window + ')', Math.round((40 + k * 5.5) * f), 90],
            ['Saver meal', 'CHEAPEST', 'Shared bike runs for home food around ' + m.window.split('\u2013')[0], Math.round((28 + k * 4) * f), 120]
          ];
        }
        if (v.scope === 'Within city') return [['Express courier', 'FAST', 'Bike \u00B7 delivered in about ' + (30 + k * 3) + ' min', Math.round((60 + k * 9) * w), 45], ['Standard', '', 'Auto \u00B7 within 3 hours', Math.round((45 + k * 6) * w), 180], ['Evening slot', 'CHEAPEST', 'Delivered today 6-9 PM', Math.round((30 + k * 4) * w), 360]];
        return [['Express courier', 'FAST', 'Dedicated cab \u00B7 delivered in about ' + P.mins(Math.round(k / 55 * 60)), Math.round((k * 7.5 + 150) * w), 0], ['With a traveller', 'CHEAPEST', 'Shared cab leaving tomorrow 7:00 \u00B7 by evening', Math.round((k * 0.45 + 40) * w), 1], ['Bus parcel', '', 'Tomorrow 10 AM \u00B7 collect at the bus stand', Math.round((k * 0.3 + 40) * w), 1]];
      }
      function draw() {
        P.clear(mealBox);
        if (v.scope === 'Home food') {
          mealBox.appendChild(P.banner('info', 'Home food parcels for breakfast, lunch and dinner slots. Ideal for tiffin / dabba runs.', 'food'));
          mealBox.appendChild(P.sec('MEAL TIME'));
          mealBox.appendChild(P.chips(MEALS.map(function (m) { return [m.id, m.id + ' \u00B7 ' + m.window]; }), v.meal, function (m) { v.meal = m; v.opt = 0; draw(); }));
        }
        P.clear(cityBox); if (v.scope === 'To another city') cityBox.appendChild(P.field({ name: 'pcity', label: 'Delivery city', select: P.CITIES.map(function (c) { return c.n; }).filter(function (n) { return n !== 'Hyderabad'; }), value: v.toCity, on: { change: function () { v.toCity = UI.val('pcity'); draw(); } } }));
        P.clear(typeBox);
        if (v.scope === 'Home food') {
          typeBox.appendChild(P.chips([['Small', 'Tiffin / dabba \u00B7 up to 3 kg'], ['Medium', 'Family pack \u00B7 up to 8 kg']], v.ptype === 'Documents' ? 'Small' : (v.ptype === 'Medium' ? 'Medium' : 'Small'), function (t) { v.ptype = t; draw(); }));
        } else {
          typeBox.appendChild(P.chips(PTYPES.map(function (t) { return [t[0], t[1]]; }), v.ptype, function (t) { v.ptype = t; draw(); }));
        }
        P.clear(opts); var sv = services();
        if (v.opt >= sv.length) v.opt = 0;
        sv.forEach(function (s, i) { opts.appendChild(P.opt({ icon: v.scope === 'Home food' ? 'food' : (i === 1 && v.scope === 'To another city' ? 'users' : 'box'), title: s[0] + (s[1] ? '  ' + s[1] : ''), sub: s[2], price: rs(s[3] * 100), on: i === v.opt, onClick: function () { v.opt = i; draw(); } })); });
        var base = sv[v.opt][3] * 100 + (v.insure ? 2000 : 0), d = P.discount('parcel', base); v.total = base - d.paise; v.sv = sv[v.opt]; v.disc = d;
        P.clear(total); total.appendChild(h('span', null, d.paise ? 'Total (coupon ' + d.code + ' applied)' : 'Total')); total.appendChild(h('b', { class: 'x-font-size-18px' }, rs(v.total)));
        go.textContent = (v.scope === 'Home food' ? 'Book home food \u00B7 ' : 'Book parcel \u00B7 ') + rs(v.total);
      }
      function submit() {
        P.clearErrors(); var bad = false, g = function (n) { return UI.val(n).trim(); };
        if (g('pfrom').length < 4) { UI.fieldError('pfrom', 'Enter the pick-up address.'); bad = true; }
        if (g('sname').length < 2) { UI.fieldError('sname', 'Enter the sender name.'); bad = true; }
        if (!S.validPhone(g('sphone'))) { UI.fieldError('sphone', 'Enter a valid 10-digit mobile.'); bad = true; }
        if (g('pto').length < 4) { UI.fieldError('pto', 'Enter the delivery address.'); bad = true; }
        if (g('rname').length < 2) { UI.fieldError('rname', 'Enter the receiver name.'); bad = true; }
        if (!S.validPhone(g('rphone'))) { UI.fieldError('rphone', 'Enter a valid 10-digit mobile.'); bad = true; } else if (S.digits(g('rphone')) === S.digits(g('sphone'))) { UI.fieldError('rphone', 'Receiver number must differ from the sender.'); bad = true; }
        if (g('what').length < 3) { UI.fieldError('what', 'Tell us what is inside.'); bad = true; }
        if (bad) { UI.toast('Please fix the highlighted fields.', 'error'); return; }
        var pid = 'PRC-' + (88200 + Math.floor(Math.random() * 800));
        var city = v.scope === 'To another city' ? v.toCity : 'Hyderabad';
        var otp = String(1000 + Math.floor(Math.random() * 9000));
        var meal = MEALS.filter(function (x) { return x.id === v.meal; })[0];
        var title = v.scope === 'Home food' ? (v.meal + ' meal to ' + g('rname')) : ('Parcel to ' + g('rname'));
        var sub = v.scope === 'Home food' ? (v.sv[0] + ' \u00B7 ' + v.meal + ' \u00B7 ' + (meal ? meal.window : '')) : (v.sv[0] + ' \u00B7 ' + v.ptype);
        var details = [['Parcel ID', pid], ['From', g('pfrom') + ' (' + g('sname') + ' ' + S.pretty(g('sphone')) + ')'], ['To', g('pto') + ', ' + city + ' (' + g('rname') + ' ' + S.pretty(g('rphone')) + ')'], ['Contents', g('what') + ' \u00B7 ' + v.ptype], ['Service', v.sv[0] + ' \u00B7 ' + v.sv[2]], ['Insurance', v.insure ? 'Up to \u20B95,000' : 'None'], ['Receiver OTP', otp]];
        if (v.scope === 'Home food') details.splice(4, 0, ['Meal slot', v.meal + (meal ? ' \u00B7 ' + meal.window : '')]);
        P.checkout({ title: title, paise: v.total + (v.disc.paise || 0), cat: 'parcel', allow: ['Wallet', 'UPI', 'Card'], booking: { type: 'parcel', pid: pid, title: title + (v.scope === 'Home food' ? '' : ', ' + city), sub: sub, when: Date.now(), stepMs: v.scope === 'To another city' ? 40000 : 25000, notified: 0, otp: otp, carrier: v.sv[0], meal: v.scope === 'Home food' ? v.meal : '', details: details }, after: function (b) { P.nav.parcel = b.id; }, goto: 'R48' });
      }
      draw();
    }
  });
  P.screen('R48', {
    title: function () { var b = S.booking(P.nav.parcel); return b ? 'Parcel ' + b.pid : 'Parcel tracking'; }, back: 'R54', nav: 'trips',
    reset: function (v) { var u = S.user(); if (!S.booking(P.nav.parcel)) { var l = u.bookings.filter(function (b) { return b.type === 'parcel'; })[0]; P.nav.parcel = l && l.id; } },
    build: function (body, v) {
      var b = S.booking(P.nav.parcel);
      if (!b) { body.appendChild(P.empty('No parcels yet. Send something and track it here.', 'box')); body.appendChild(P.btn('Send a parcel', '', function () { UI.go('R47'); })); return; }
      v.b = b; v.head = h('div', { class: 'card-m brand' }); v.bar = P.progress(5); v.tl = h('div', { class: 'p-timeline' }); body.appendChild(v.head); body.appendChild(v.bar); body.appendChild(v.tl);
      body.appendChild(h('div', { class: 'card-m' }, b.details.map(function (d) { return P.kv(d[0], String(d[1])); })));
      body.appendChild(h('div', { class: 'p-sticky-actions' }, [P.btn('Call carrier', 'soft sm', function () { UI.toast('Calling your carrier on a masked number (simulated).', 'sim'); }), P.btn('Share tracking', 'soft sm', function () { var link = 'https://track.ridenova.example/' + b.pid; try { if (navigator.clipboard) navigator.clipboard.writeText(link); } catch (e) { /* ignore */ } UI.toast('Tracking link copied: ' + link, 'info'); })]));
      v.act = h('div'); body.appendChild(v.act); v.refresh = refresh; refresh();
      function refresh() {
        var s = P.parcelStage(b); P.clear(v.head); P.clear(v.tl); P.clear(v.act);
        if (s < 0) { v.head.appendChild(h('b', null, 'Parcel cancelled')); v.head.appendChild(h('span', { class: 'xs' }, 'Refund added to your wallet.')); P.setWidth(v.bar, 0); return; }
        v.head.appendChild(h('span', { class: 'xs' }, b.carrier + ' \u00B7 ' + b.pid)); v.head.appendChild(h('b', { class: 'big-num' }, s === 5 ? 'Delivered' : PSTAGES[s])); v.head.appendChild(h('span', { class: 'xs' }, s === 5 ? 'Delivered with receiver OTP ' + b.otp + ' and photo proof' : 'Receiver OTP ' + b.otp + ' (shared with the receiver by SMS)'));
        P.setWidth(v.bar, (s + 1) / 6 * 100);
        PSTAGES.forEach(function (t, i) { v.tl.appendChild(h('div', { class: 'p-tstep' + (i <= s ? ' done' : '') + (i === s && s < 5 ? ' now' : '') }, [h('span', { class: 'p-dot' }), h('span', { class: 'tx' }, [h('b', null, t), h('span', { class: 'xs' }, i <= s ? P.ftime(b.createdAt + i * (b.stepMs || 30000)) : 'Pending')])])); });
        if (s < 1) v.act.appendChild(P.btn('Cancel parcel', 'ghost', function () { UI.confirm('Cancel this parcel before pick-up? You get a full refund.', 'Cancel parcel').then(function (y) { if (!y) return; b.status = 'Cancelled'; S.credit(S.user(), b.paise, 'Refund: ' + b.title, 'Refund'); P.applyUser(S.user()); S.save(); UI.toast('Parcel cancelled. ' + rs(b.paise) + ' refunded.', 'info'); refresh(); }); }));
        if (s === 5) v.act.appendChild(P.btn('Send another parcel', '', function () { UI.go('R47'); }));
      }
    },
    tick: function (v) { if (v.refresh && UI.sid === 'R48') v.refresh(); }
  });

  // ------------------------------------------------------------ R52 AI trip assistant
  var DAYS_OF = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function nextDate(text) {
    var now = new Date(), d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), t = text.toLowerCase();
    if (/tomorrow/.test(t)) d.setDate(d.getDate() + 1); else if (/weekend|saturday/.test(t)) d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); else if (/sunday/.test(t)) d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); else d.setDate(d.getDate() + 2);
    return P.isoDate(d.getTime());
  }
  function parseAsk(text, prev) {
    var t = text.toLowerCase(), found = [];
    P.CITIES.forEach(function (c) { var i = t.indexOf(c.n.toLowerCase().split(' ')[0]); if (i >= 0) found.push([i, c.n]); }); found.sort(function (a, b) { return a[0] - b[0]; });
    var q = Object.assign({ from: 'Hyderabad', to: 'Mysuru', pax: 2, days: 2, budget: 0, prio: 'saver', hotel: false }, prev || {});
    if (found.length >= 2) { q.from = found[0][1]; q.to = found[1][1]; } else if (found.length === 1) q.to = found[0][1];
    var m; if ((m = /(\d+)\s*(people|persons|pax|of us|friends|adults|travell)/.exec(t))) q.pax = Math.min(6, +m[1]); else if (/\b(couple|two of us|both)\b/.test(t)) q.pax = 2; else if (/\b(solo|alone|just me)\b/.test(t)) q.pax = 1;
    if ((m = /(\d+)\s*(day|night)/.exec(t))) q.days = Math.min(10, Math.max(1, +m[1]));
    if ((m = /(?:under|below|budget|within|max)\D{0,8}([\d,]{3,6})/.exec(t))) q.budget = +m[1].replace(/,/g, '');
    if (/fast|quick|urgent|hurry/.test(t)) q.prio = 'urgent'; if (/cheap|saver|budget|save/.test(t)) q.prio = 'saver';
    if (/hotel|stay|room/.test(t)) q.hotel = true; q.date = nextDate(t); return q;
  }
  function buildPlan(q) {
    var lt = { from: q.from, to: q.to, date: q.date, pax: q.pax }, opts = P.ltOptions(lt).filter(function (o) { return o.depart && (o.kind === 'bus' || o.kind === 'share'); });
    if (!opts.length) { lt.date = P.isoDate(P.parseIso(q.date) + 86400000); q.date = lt.date; opts = P.ltOptions(lt).filter(function (o) { return o.depart && (o.kind === 'bus' || o.kind === 'share'); }); }
    opts.sort(q.prio === 'urgent' ? function (a, b) { return a.mins - b.mins; } : function (a, b) { return a.paise - b.paise; }); var go = opts[0];
    var items = [{ type: go.kind, icon: go.icon, title: q.from + ' \u2192 ' + q.to, sub: go.title + ' \u00B7 ' + P.ftime(go.depart) + ' \u2192 ' + P.ftime(go.arrive), paise: go.paise * q.pax, when: go.depart, route: { from: q.from, to: q.to, km: P.roadKm(q.from, q.to) } }];
    var arrive = go.arrive;
    if (q.hotel || q.prio !== 'urgent' || q.days > 1) { var hs = P.hotelsFor(q.to).sort(function (a, b) { return a.price - b.price; }); var hx = q.prio === 'urgent' ? hs[hs.length - 2] : hs[0], nights = Math.max(1, q.days - 1), rooms = Math.ceil(q.pax / 2); items.push({ type: 'hotel', icon: 'bed', title: hx.n + ', ' + q.to, sub: nights + ' night' + (nights > 1 ? 's' : '') + ' \u00B7 ' + rooms + ' room' + (rooms > 1 ? 's' : ''), paise: Math.round(hx.price * nights * rooms * 1.12), when: arrive + 3600000 }); }
    var rent = q.prio === 'urgent' ? ['Hatchback self-drive', 180000] : ['Scooter rental', 45000]; items.push({ type: 'rental', icon: 'key', title: rent[0] + ' in ' + q.to, sub: q.days + ' day' + (q.days > 1 ? 's' : '') + ' \u00B7 pick up on arrival', paise: rent[1] * q.days, when: arrive + 7200000 });
    var back = P.ltOptions({ from: q.to, to: q.from, date: P.isoDate(P.parseIso(q.date) + (q.days - 1) * 86400000), pax: q.pax }).filter(function (o) { return o.kind === 'bus' && o.depart; }).sort(function (a, b) { return a.paise - b.paise; })[0];
    if (q.days > 1 && back) items.push({ type: 'bus', icon: 'bus', title: q.to + ' \u2192 ' + q.from, sub: back.title + ' \u00B7 ' + P.fdt(back.depart), paise: back.paise * q.pax, when: back.depart, route: { from: q.to, to: q.from, km: P.roadKm(q.from, q.to) } });
    return { q: q, items: items, total: items.reduce(function (s, i) { return s + i.paise; }, 0) };
  }
  var AI_LOG = [];
  P.screen('R52', {
    title: 'AI trip assistant', back: 'R29',
    reset: function (v) { v.last = null; v.typing = false; if (!AI_LOG.length) AI_LOG.push({ from: 'them', text: 'Hi ' + P.firstName(S.user()) + '! Tell me where and when. For example: "Weekend trip from Hyderabad to Mysuru for 2 people under 5000".', at: Date.now() }); v.last = (AI_LOG.filter(function (m) { return m.plan; }).pop() || {}).plan || null; },
    build: function (body, v) {
      var box = h('div', { class: 'p-chat' }); body.appendChild(box);
      function draw() {
        P.clear(box);
        AI_LOG.forEach(function (m) {
          var b = h('div', { class: 'bubble ' + m.from }, [m.text, h('time', null, P.ftime(m.at))]); box.appendChild(b);
          if (m.plan) { var c = h('div', { class: 'card-m' }, m.plan.items.map(function (i) { return h('div', { class: 'kv' }, [h('span', { class: 'tx' }, [h('b', null, i.title), h('span', { class: 'xs' }, i.sub)]), h('b', null, rs(i.paise))]); })); c.appendChild(h('div', { class: 'hr' })); c.appendChild(h('div', { class: 'kv' }, [h('b', null, 'Total for ' + m.plan.q.pax), h('b', { class: 'x-font-size-18px' }, rs(m.plan.total))])); box.appendChild(c); }
        });
        if (v.typing) box.appendChild(h('div', { class: 'bubble them p-typing' }, 'Planning...'));
        box.scrollTop = box.scrollHeight;
      }
      function say(text, plan) { AI_LOG.push({ from: 'them', text: text, at: Date.now(), plan: plan }); if (plan) v.last = plan; v.typing = false; if (UI.sid === 'R52') draw(); }
      function ask(text) {
        text = String(text || '').trim(); if (!text) return; AI_LOG.push({ from: 'me', text: text, at: Date.now() }); v.typing = true; draw();
        setTimeout(function () {
          var t = text.toLowerCase();
          if (/^(hi|hello|hey)\b/.test(t)) { say('Hello! Where would you like to go?'); return; }
          if (/faster|quicker|fastest/.test(t) && v.last) { var q = Object.assign({}, v.last.q, { prio: 'urgent' }), p = buildPlan(q); say('Here is a faster plan. It costs ' + rs(p.total - v.last.total < 0 ? 0 : p.total - v.last.total) + ' more than before.', p); return; }
          if (/cheap|saver|less|lower|budget/.test(t) && v.last && !/\d{3,}/.test(t)) { var q2 = Object.assign({}, v.last.q, { prio: 'saver' }), p2 = buildPlan(q2); say('Cheapest combination I found: ' + rs(p2.total) + '.', p2); return; }
          if (/hotel|stay/.test(t) && v.last && !/from|to /.test(t)) { var q3 = Object.assign({}, v.last.q, { hotel: true, days: Math.max(2, v.last.q.days) }), p3 = buildPlan(q3); say('Added a stay for you.', p3); return; }
          var q4 = parseAsk(text, v.last && v.last.q), p4 = buildPlan(q4);
          if (q4.from === q4.to) { say('Pick two different cities, for example "from Chennai to Kochi".'); return; }
          var over = q4.budget && p4.total > q4.budget * 100; say((over ? 'That comes to ' + rs(p4.total) + ', above your ' + rs(q4.budget * 100) + ' budget. Tap Cheaper? to trim it.' : 'Here is a ' + (q4.prio === 'urgent' ? 'fast' : 'Saver') + ' plan for ' + rs(p4.total) + ' for ' + q4.pax + ':'), p4);
        }, 900 + Math.random() * 600);
      }
      body.appendChild(h('div', { class: 'chips' }, [['Make it faster'], ['Cheaper?'], ['Add a hotel']].map(function (c) { return h('button', { type: 'button', class: 'chip', on: { click: function () { ask(c[0]); } } }, c[0]); })));
      body.appendChild(P.btn('Book this plan', '', function () {
        if (!v.last) { UI.toast('Ask me for a plan first, then book it.', 'info'); return; }
        var u = S.user(); v.last.items.forEach(function (i) { S.addBooking({ type: i.type, title: i.title, sub: i.sub, paise: i.paise, when: i.when, status: 'Planned', route: i.route, details: [['Plan', 'Made by the trip assistant'], ['Details', i.sub]] }); });
        S.notify(u, 'Trip plan saved', v.last.items.length + ' items \u00B7 ' + rs(v.last.total), 'Updates', 'R36'); UI.toast('Plan saved. Review and pay for it in your trip plan.', 'info'); UI.go('R36');
      }));
      var input = h('input', { class: 'p-search', type: 'text', maxlength: 160, placeholder: 'Ask in any language', 'aria-label': 'Message the trip assistant' });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { ask(input.value); input.value = ''; } });
      body.appendChild(h('div', { class: 'p-compose' }, [h('div', { class: 'inp' }, h('div', { class: 'box' }, input)), h('button', { type: 'button', class: 'p-send', 'aria-label': 'Send', on: { click: function () { if (!input.value.trim()) { UI.toast('Type a message first.', 'warn'); input.focus(); return; } ask(input.value); input.value = ''; input.focus(); } } }, ic('send', 18))]));
      draw();
    }
  });

  // ------------------------------------------------------------ R51 medical emergency
  var HOSP = [['City General Hospital', '24x7 casualty', 0.7], ['Apex Multi-speciality', 'cardiac care', 1.5], ['Govt. District Hospital', 'trauma centre', 2.1], ['Sunrise Children\'s Hospital', 'paediatric emergency', 2.8]];
  P.screen('R51', {
    title: 'Medical emergency', back: 'R29',
    reset: function (v) { v.sel = 0; },
    build: function (body, v) {
      var u = S.user(), here = P.pickup();
      body.appendChild(h('div', { class: 'row2' }, [h('a', { class: 'btn danger rn-blk', href: 'tel:112', on: { click: function () { UI.toast('Dialling 112... (a real phone would open the dialer)', 'warn'); } } }, 'Call 112'), h('a', { class: 'btn danger rn-blk', href: 'tel:108', on: { click: function () { UI.toast('Dialling ambulance 108...', 'warn'); } } }, 'Ambulance 108')]));
      body.appendChild(P.sec('NEAREST HOSPITALS WITH EMERGENCY'));
      var list = h('div', { class: 'list' }); body.appendChild(list);
      var hosp = HOSP.map(function (x, i) { var km = Math.round((x[2] + (i * 0.3)) * 10) / 10; return { n: x[0], note: x[1], km: km, mins: Math.round(km * 3.2 + 4), a: 'Emergency entrance', lat: here.lat + 0.004 * (i + 1), lon: here.lon + 0.006 * (i % 2 ? -1 : 1) * (i + 1) }; });
      function draw() { P.clear(list); hosp.forEach(function (x, i) { var r = P.row({ icon: 'shield', tone: 'red', title: x.n, sub: x.km + ' km \u00B7 ' + x.mins + ' min \u00B7 ' + x.note, on: i === v.sel, onClick: function () { v.sel = i; draw(); } }); r.setAttribute('aria-pressed', String(i === v.sel)); list.appendChild(r); }); go.textContent = 'Fastest ride to ' + hosp[v.sel].n; }
      var go = P.btn('', '', function () {
        var x = hosp[v.sel]; P.trip.pickup = P.pickup(); P.trip.drop = { n: x.n, a: x.a, lat: x.lat, lon: x.lon }; P.trip.vehicle = 'Cab'; P.trip.extras = []; P.trip.label = 'Emergency ride'; UI.toast('Priority cab to ' + x.n + '. Confirm to dispatch.', 'warn'); UI.go('R10');
      });
      body.appendChild(go);
      body.appendChild(P.btn('Share my location with contacts', 'soft', function () {
        if (!u.emergency.length) { UI.confirm('You have no emergency contacts yet. Add one now?', 'Add contact').then(function (y) { if (y) UI.go('R24'); }); return; }
        S.notify(u, 'Live location shared', 'Sent to ' + u.emergency.map(function (c) { return c.name; }).join(', ') + ' (simulated)', 'Updates'); UI.toast('Live location shared with ' + u.emergency.map(function (c) { return c.name; }).join(', ') + ' (simulated, nothing is actually sent).', 'warn');
      }));
      body.appendChild(P.btn('Open SOS', 'ghost sm', function () { UI.go('R16'); }));
      draw();
    }
  });

  // ------------------------------------------------------------ support
  P.raiseTicket = function (category, issue, ref, cb) {
    exec('support.ticket', { arg: issue, category: category, ref: ref || null }, null, { instant: true }).then(function (r) {
      var u = S.user(), id = (r && r.ticketId) || ('T' + S.uid('')); u.tickets = u.tickets || []; u.tickets.unshift({ id: id, issue: issue, ref: ref || '', at: Date.now(), state: 'Open' }); S.save();
      if (cb) cb(id);
    });
  };
  var BOT = [
    [/charg|fare|estimate|price|overcharg/i, 'I checked your latest booking. The final fare includes the estimate plus toll/waiting charges where they apply. If you still think it is wrong I can raise a review and refund any difference.', 'Raise a fare review'],
    [/refund|money back|cancel/i, 'Refunds for cancelled bookings go to your wallet instantly (full, 50% or none depending on how close the trip is). Open the booking from Trips to cancel it.', null, 'R54'],
    [/lost|forgot|left/i, 'Sorry about that. I can connect you with the driver by masked call for 24 hours.', null, 'R27'],
    [/payment|upi|card|debit|failed/i, 'Failed payments are reversed in 3-5 working days. Meanwhile you can pay with your wallet.', 'Raise a payment ticket'],
    [/safe|unsafe|harass|follow|danger|accident/i, 'Your safety comes first. Use SOS if you are in danger now.', null, 'R16'],
    [/driver|rude|behav/i, 'I am sorry about that. Please report the driver so our safety team reviews the trip.', null, 'R27']
  ];
  P.screen('R26', {
    title: 'Help & support', back: 'R28',
    right: function (v) { return h('button', { type: 'button', class: 'chip', on: { click: function () { var u = S.user(); if (u.agent) { UI.toast('You are already chatting with an agent.', 'info'); return; } u.agent = true; u.chat.push({ from: 'sys', text: 'Connecting you to an agent...', at: Date.now() }); S.save(); v.draw(); setTimeout(function () { u.chat.push({ from: 'them', text: 'Hi ' + P.firstName(u) + ', this is Meera from RideNova support. How can I help?', at: Date.now() }); S.save(); if (UI.sid === 'R26') v.draw(); }, 1800); } } }, 'Talk to agent'); },
    build: function (body, v) {
      var u = S.user(); if (!u.chat.length) u.chat.push({ from: 'them', text: 'Hi ' + P.firstName(u) + '! I can help with your rides, orders and bookings. What is wrong?', at: Date.now() });
      var last = u.bookings.filter(function (b) { return b.status !== 'Planned'; })[0];
      if (last) body.appendChild(h('button', { type: 'button', class: 'card-m p-restcard', on: { click: function () { P.nav.booking = last.id; UI.go('R62'); } } }, [h('span', { class: 'xs' }, P.nav.helpRef ? 'Asking about ' + P.nav.helpRef : 'Your latest booking'), h('b', null, last.title), h('span', { class: 'xs' }, last.sub + ' \u00B7 ' + rs(last.paise))]));
      var box = h('div', { class: 'p-chat' }), typing = false; body.appendChild(box);
      function draw() { P.clear(box); u.chat.forEach(function (m) { if (m.from === 'sys') box.appendChild(h('div', { class: 'xs center' }, m.text)); else { var b = h('div', { class: 'bubble ' + m.from }, [m.text, h('time', null, P.ftime(m.at))]); box.appendChild(b); if (m.act) box.appendChild(m.act === 'ticket' ? P.btn('Raise a ticket', 'soft sm', function () { mkTicket(m.topic); }) : P.btn('Open', 'soft sm', function () { UI.go(m.act); })); } }); if (typing) box.appendChild(h('div', { class: 'bubble them p-typing' }, 'Typing...')); box.scrollTop = box.scrollHeight; }
      v.draw2 = draw;
      function mkTicket(topic) { P.raiseTicket('booking', topic, P.nav.helpRef || (last && (last.code || last.id)), function (id) { u.chat.push({ from: 'them', text: 'Ticket ' + id + ' created for: ' + topic + '. We reply here within a few hours.', at: Date.now() }); S.save(); UI.toast('Ticket ' + id + ' created.', 'info'); draw(); }); }
      function send(text) {
        text = String(text || '').trim(); if (!text) return; u.chat.push({ from: 'me', text: text, at: Date.now() }); S.save(); typing = true; draw();
        setTimeout(function () {
          typing = false; var hit = BOT.filter(function (b) { return b[0].test(text); })[0], m;
          if (u.agent) m = { from: 'them', text: hit ? 'Thanks for explaining. ' + hit[1].replace(/^I /, 'I ') : 'Understood. Let me look into this and I will update you here in a moment.', at: Date.now() };
          else m = hit ? { from: 'them', text: hit[1], at: Date.now(), act: hit[2] ? 'ticket' : hit[3], topic: hit[2] || text } : { from: 'them', text: 'I can help with fares, refunds, lost items and safety. Tell me a bit more, or raise a ticket.', at: Date.now(), act: 'ticket', topic: text };
          u.chat.push(m); S.save(); if (UI.sid === 'R26') draw();
        }, 1000 + Math.random() * 800);
      }
      body.appendChild(h('div', { class: 'chips' }, ['Lost item', 'Payment issue', 'Safety concern', 'I was charged more than the estimate'].map(function (t) { return h('button', { type: 'button', class: 'chip', on: { click: function () { send(t); } } }, t); })));
      var input = h('input', { class: 'p-search', type: 'text', maxlength: 200, placeholder: 'Type your question', 'aria-label': 'Message support' });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { send(input.value); input.value = ''; } });
      body.appendChild(h('div', { class: 'p-compose' }, [h('div', { class: 'inp' }, h('div', { class: 'box' }, input)), h('button', { type: 'button', class: 'p-send', 'aria-label': 'Send', on: { click: function () { if (!input.value.trim()) { UI.toast('Type a message first.', 'warn'); input.focus(); return; } send(input.value); input.value = ''; input.focus(); } } }, ic('send', 18))]));
      if ((u.tickets || []).length) { body.appendChild(P.sec('YOUR TICKETS')); body.appendChild(P.list(u.tickets.slice(0, 4).map(function (t) { var ageMin = (Date.now() - t.at) / 60000; return P.row({ icon: 'help', title: t.id + ' \u00B7 ' + t.issue, sub: t.ref ? 'Ref ' + t.ref : P.fdt(t.at), right: ageMin > 3 ? 'In progress' : 'Open', rightKind: ageMin > 3 ? 'ok' : 'info' }); }))); }
      body.appendChild(P.btn('Report an issue with a booking', 'ghost sm', function () { UI.go('R27'); }));
      draw();
    }
  });
  P.screen('R27', {
    title: 'Report an issue', back: 'R26',
    reset: function (v) { v.cat = 'Fare or payment'; v.photo = ''; },
    build: function (body, v) {
      var u = S.user(), recent = u.bookings.filter(function (b) { return b.status !== 'Planned'; }).slice(0, 6);
      if (recent.length) body.appendChild(P.field({ name: 'rbk', label: 'Which booking?', select: recent.map(function (b) { return [b.code || b.id, b.title + ' \u00B7 ' + (b.when ? P.fdate(b.when) : '')]; }), value: recent.some(function (b) { return (b.code || b.id) === P.nav.helpRef; }) ? P.nav.helpRef : undefined }));
      body.appendChild(P.sec('WHAT HAPPENED?'));
      var cats = ['I lost an item', 'Driver behaviour', 'Fare or payment', 'Vehicle condition', 'Route taken'], g = h('div', { class: 'list' });
      cats.forEach(function (c) { var r = P.row({ title: c, on: c === v.cat, onClick: function () { v.cat = c; P.pickGroup(g)(r); lab.textContent = c === 'I lost an item' ? 'What did you lose? (required)' : 'Describe the issue (required)'; } }); r.setAttribute('aria-pressed', String(c === v.cat)); g.appendChild(r); }); body.appendChild(g);
      var f = P.field({ name: 'desc', label: 'What did you lose?', area: true, rows: 3, maxlength: 300, placeholder: 'e.g. Black backpack on the back seat' }), lab = UI.q('label', f); lab.textContent = 'Describe the issue (required)'; body.appendChild(f);
      var file = h('input', { type: 'file', accept: 'image/*', class: 'p-file', 'aria-label': 'Add a photo (optional)' }), fn = h('span', { class: 'xs' }, 'Add a photo (optional)');
      file.addEventListener('change', function () { var x = file.files && file.files[0]; if (!x) { v.photo = ''; fn.textContent = 'Add a photo (optional)'; return; } if (!/^image\//.test(x.type) || x.size > 4000000) { UI.toast('Choose an image under 4 MB.', 'error'); file.value = ''; return; } v.photo = x.name; fn.textContent = 'Attached: ' + x.name; });
      body.appendChild(h('label', { class: 'card-m' }, [fn, file]));
      body.appendChild(h('div', { class: 'xs' }, 'For a lost item we connect you to the driver by masked call for 24 hours.'));
      body.appendChild(P.btn('Submit', '', function () {
        P.clearErrors(); var d = UI.val('desc').trim(); if (d.length < 10) { UI.fieldError('desc', 'Please write at least 10 characters so we can help.'); return; }
        var ref = UI.val('rbk') || P.nav.helpRef || ''; P.raiseTicket({ 'I lost an item': 'safety', 'Driver behaviour': 'people', 'Fare or payment': 'payments', 'Vehicle condition': 'people', 'Route taken': 'people' }[v.cat], v.cat + ': ' + d.slice(0, 80), ref, function (id) { UI.toast('Report submitted: ticket ' + id + '.' + (v.cat === 'I lost an item' ? ' Masked call to the driver is open for 24 hours.' : ''), 'info'); P.nav.helpRef = null; UI.go('R26'); });
      }));
    }
  });
  // ------------------------------------------------------------ small fixes on original screens
  K.extend('R30', { init: function () {   // priority chooser is a map overlay: give it a way back
    var scr = UI.q('#mock .scr'); if (!scr || UI.q('.p-floatback', scr)) return;
    scr.appendChild(h('button', { type: 'button', class: 'ib p-floatback', 'aria-label': 'Back', 'data-back': true, 'data-back-to': '#/R29' }, ic('back', 18)));
  } });})();
