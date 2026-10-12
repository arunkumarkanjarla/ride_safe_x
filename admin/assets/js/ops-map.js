/* RideNova Admin portal – world map with live vehicles (used by A02 and A03).
   Hand-drawn equirectangular world map (no map service, no network). Vehicles are grouped per area and vehicle type;
   each group shows its vehicle image with a count badge like a notification number. Zoom in (wheel, buttons, double
   click or a click on a group) to split the groups down to single vehicles. Hovering a single vehicle shows the
   driver card. Only SVG attributes and CSSOM positions are set (allowed by the page's Content-Security-Policy). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData;
  var NS = 'http://www.w3.org/2000/svg', K = 4;   // 4 map units per degree
  var WORLD = [0, 24, 1440, 568];                 // longitude −180…180, latitude 84…−58

  // coarse coastlines [lng, lat, lng, lat, …]
  var LAND = [
    // North America
    [-168,66,-162,70,-156,71.5,-140,70,-128,70.5,-115,68,-95,72,-82,73,-80,63,-94,59,-88,56,-80,52,-78,58,-70,61,-64,60,-56,52,-60,47,-66,44,-70,42,-74,40,-76,35,-81,31,-80,25.5,-82,28,-84,30,-89,30,-94,29.5,-97,27,-97.5,22,-96,19,-91,18.5,-87,21,-88,16,-83,15,-83.5,10,-79,9,-77.5,7.5,-80,8,-85,10,-87,13,-92,14.5,-96,15.7,-105,20,-106,23,-110,24,-112,29,-114.5,31,-112,26,-110,23,-115,28,-117,32.5,-120.5,34.5,-124,40,-124,46,-123,49,-130,54.5,-136,58,-145,60,-152,59,-158,56,-165,54.5,-158,58,-162,60,-165,62,-166,64.5],
    // Canadian Arctic, Baffin, Greenland, Iceland
    [-125,72,-110,77,-90,80,-62,82.5,-80,76,-95,74.5,-105,73,-115,70.8],
    [-90,72,-80,74,-68,70.5,-62,66.5,-66,62,-71,63,-78,65],
    [-73,78,-60,82,-30,83.5,-20,81,-18,76,-22,70,-30,68,-40,65,-44,60,-50,62,-53,66,-55,70,-60,76],
    [-24,65.5,-22,66.4,-16,66.5,-13.5,65,-18,63.4,-22.5,63.8],
    // Caribbean
    [-85,21.8,-82,23.1,-77.5,21.8,-74.2,20.2,-77.5,19.9,-80.5,21.5],
    [-74.4,18.4,-72.8,19.9,-69.5,19.6,-68.4,18.5,-71.5,17.6],
    // South America
    [-77,8,-72,12,-63,10.5,-60,8,-52,5,-50,1,-44,-2.5,-35,-5,-35,-9,-39,-13,-39,-18,-41,-22,-48,-25.5,-48.5,-28,-53,-33.5,-58,-34.5,-57,-38,-62,-39,-65,-42,-67.5,-46,-66,-48,-69,-51,-68.5,-53,-71,-54.5,-75,-52,-75,-46,-73.5,-41,-73.5,-37,-71.5,-30,-70.5,-23,-70.3,-18,-75,-15,-77,-12,-79.5,-7,-81,-4.5,-80,-1,-80,1.5,-77.5,4],
    // Europe and Asia
    [-9,37,-9,43,-1.5,43.5,-1,46,-4.5,48,-1.5,49.5,2,51,4,52,8,54,8.5,57,10.5,57.7,10.5,54.5,13,54.3,19,54.5,21,57,24,57.5,24,59.4,29,60,22,60.3,21.5,63,25,65.5,22,65.8,17,62,18,59.5,16,56.2,12.5,56,11,59,6,58,5,62,10,64,14,67,20,70,28,71,33,69.5,41,67,44,68.5,54,68.5,60,69.8,68,69,73,72.5,80,72.5,87,74.5,100,76.5,112,73.7,127,73.5,140,72.5,150,71.5,160,70,170,70,180,68.5,180,65,175,64.5,178,62.5,170,60,163,59.8,162,57,156,51,156,57,150,59.5,142,59,136,54.5,141,52,140,48,133,43,129.5,42.5,129,35.5,126.5,34.5,126,37.5,124.5,39.5,121,40.8,122,39,119,37.2,122.5,37,120,34.5,121.5,32,122,30,120,26,116.5,22.8,110,21.5,108,21.5,106.5,20,106,18,109,15,109,11.5,105,8.7,103,10.5,100,13.5,100,9,102,6,103.5,1.5,101,2.8,98.5,8,98.5,15,97.5,16.5,94.5,16,94,19,92,21.5,90,22,86.5,20,85,19.5,80,15,80,10,77.5,8,76.5,9,74.5,14,73,19,72.6,21.5,70,21,68,23.5,66.5,25.5,61.5,25.2,57,25.7,56.3,27,54,26.7,51,29,48,30,48,28,50.5,25,51.5,24,56,26,57,23.5,59.8,22.5,57,19,52,16.5,45,13,43,13,42.5,15.5,39,21,35,28,34.9,29.5,34.2,31.3,35,33,36,35.5,36,36.6,32,36.2,29,36.6,26.5,38.5,26.5,40,23,40.5,24,38,22,36.5,21,38,19.5,40.5,19.5,42,16,43.5,13.5,45.5,12.3,45,12.5,44,14,42,16,41,18.5,40.2,16,38,15.6,40,12,42,10,44,8.5,44.3,6,43,3,43.3,3.2,42,0,39.5,-0.5,38,-2,36.7,-5.5,36,-6.5,37,-7.5,37],
    // Britain, Ireland
    [-5.5,50,1.5,51,1.7,52.7,0,53.5,-0.5,54.5,-2,55.8,-1.8,57.6,-3,58.6,-5,58.6,-6,57,-5.5,55.5,-4.8,54.8,-3,54,-3,53.3,-4.6,52.8,-5.2,51.7,-3,51.4],
    [-6,52.2,-6.2,53.8,-5.5,54.6,-7.3,55.3,-8.5,54.5,-10,53.5,-9.8,51.8,-8,51.6],
    // Africa, Madagascar
    [-17,21,-16.3,24,-13,27.8,-9.8,29.8,-9.5,32.5,-6.8,34,-5.9,35.8,-2,35.1,3,36.8,8.6,36.9,11,37.1,10.2,35,11,33.5,15.5,32.3,19.5,30.5,20.2,32.5,23,32.6,25,31.7,29,30.9,32.3,31.2,34.2,31.2,34.9,29.5,33.6,27.5,35.5,23.9,37,21,38.5,18,39.7,15.2,42.7,12.8,43.3,11.8,44.5,10.4,51.2,11.8,51,10.5,48,5,46,2,42,-1,40,-3.5,39.2,-6,39.6,-8.5,40.5,-10.5,40.5,-14.5,39.5,-16.8,35.5,-19,35.5,-22,32.9,-26,32.4,-28.6,31,-29.9,28,-32.8,25.6,-34,22.5,-33.9,20,-34.8,18.4,-34,17.5,-30,15.3,-27,14.5,-22.5,11.8,-17,12.3,-13,13.6,-10.7,12.2,-6,9.3,-1,9.5,1,9.8,3.2,8.5,4.6,6,4.3,4.5,6.3,1.5,6.2,-2,4.8,-4.5,5.2,-7.5,4.4,-9.3,5.5,-12.4,7.4,-13.3,9,-15,11,-16.7,12.4,-17.2,14.6,-16.5,16.5,-16.1,19.5],
    [49.3,-12,50.5,-15.5,49.5,-17,47,-25,45,-25.5,43.3,-22,44.3,-16.3,47.5,-14],
    // Japan, Taiwan, Sri Lanka, Philippines
    [130,31,131.5,31.5,132,33.8,135,34.3,136.8,34.6,139.8,35,141,37,142,40,141.4,41.4,140,40.5,139.8,38.5,136.8,37.2,133,35.5,131,34.4,130,33.5],
    [140,41.5,141.5,42.5,145.5,43.3,144,44.2,141.8,45.4,141,43.2],
    [120.2,22.6,121,22,122,25,121.2,25.2],
    [79.8,6.2,81.8,7,80.2,9.8],
    [120,16,120.6,18.5,122.3,18.5,122,16.2,124,13,121.5,13.8,120.6,14.4],
    [122,7,124,8.5,126.6,7.2,125.4,5.6,123.6,7.7],
    // Indonesia, New Guinea
    [95.2,5.6,98,4,104,-1,106,-3.5,105.8,-5.8,102.3,-4,100.3,-0.8,98.6,1.8],
    [105.2,-6.8,106,-6,111,-6.4,114.5,-7.7,114.4,-8.7,110,-8.1],
    [109,1.8,109.6,-1,110.5,-3,114.5,-3.5,116.5,-2,118,1,119,5,117,7,115.5,5,113,3.2,111,1.6],
    [119.5,-5.5,120.5,-1,121,1.3,125,1.5,123,-0.8,121.5,-1.8,122,-4.8,120.4,-5.6],
    [131,-1,134,-0.8,138,-1.6,141,-2.6,145,-4.5,147.5,-6,147.8,-8,150,-10.5,146,-8.8,143.5,-9,141,-9.2,138,-8.4,137.5,-5,134,-4,132,-2.8],
    // Australia, Tasmania, New Zealand
    [113,-22,114,-26.5,115,-34,118,-35,123,-33.8,129,-31.6,131.5,-31.5,135,-34.8,138,-35.6,140,-38,144,-38.3,146.5,-39,150,-37.5,153.2,-31,153.5,-28,153,-25,150.8,-22.5,149,-20.5,146.2,-19,145.4,-15,143.5,-14,142.5,-10.7,141.5,-13,141.6,-16.5,140.5,-17.6,139,-17,136,-15.5,135.8,-12,132.5,-11.4,130,-13,129.5,-15,127,-14,125,-15,122.5,-17,121,-19.5,117,-20.7],
    [145,-41,148.3,-41,147.5,-43.3,146,-43.5],
    [172.7,-34.5,174.5,-36.5,176,-37.6,178.5,-37.7,177,-39.3,176,-41.3,174.8,-41.3,175.2,-40,173.8,-39.2,174.6,-37.2],
    [172.7,-40.5,174.3,-41.2,173,-43.7,171,-44.6,169,-46.6,166.5,-46,168.3,-44,171.5,-41.5]
  ];
  var WATER = [   // inland seas drawn over the land
    [28,41.2,29,41.2,33,42,36,41.7,41.5,41.5,41.7,42.5,39,44.5,37.5,45.3,35,45,33.5,44.5,32.5,45.5,30.5,46.5,29.5,45,28.5,43.5],
    [47,45,49.5,46.5,53,47,54,45,51,44,53,42,53.5,40,54,37.5,50,37,49,38.5,49.5,40.5,47.5,42.5]
  ];
  var STATUS_COLOR = { AVAILABLE: '#12A386', ON_TRIP: '#2F6FDB', OFFER: '#E8A317', SOS: '#D93A1E', OFFLINE: '#8A99A6' };
  var TYPE_ORDER = ['cab', 'auto', 'bike', 'premium', 'suv', 'bus', 'delivery', 'van'];

  function px(lng) { return (lng + 180) * K; }
  function py(lat) { return (90 - lat) * K; }
  function num(v) { return typeof v === 'number' ? String(+v.toPrecision(7)) : v; }   // keeps tiny sizes when zoomed in
  function svg(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, num(attrs[k])); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function poly(a) { var s = ''; for (var i = 0; i < a.length; i += 2) s += (i ? ' ' : '') + px(a[i]).toFixed(1) + ',' + py(a[i + 1]).toFixed(1); return s; }
  function ago(sec) { return sec < 60 ? sec + ' s ago' : Math.round(sec / 60) + ' min ago'; }

  function create(host, opts) {
    opts = opts || {};
    UI.clear(host);
    host.classList.add('om');
    var root = svg('svg', { class: 'om-svg', role: 'img', 'aria-label': opts.label || 'Map of vehicles' }, host);
    var vb = WORLD.slice();
    svg('rect', { x: -2000, y: -2000, width: 6000, height: 4000, class: 'om-sea' }, root);
    var grat = svg('g', { class: 'om-grat' }, root);
    for (var lo = -150; lo <= 180; lo += 30) svg('line', { x1: px(lo), y1: 0, x2: px(lo), y2: 720 }, grat);
    for (var la = -60; la <= 90; la += 30) svg('line', { x1: 0, y1: py(la), x2: 1440, y2: py(la) }, grat);
    var land = svg('g', { class: 'om-land' }, root);
    LAND.forEach(function (a) { svg('polygon', { points: poly(a) }, land); });
    WATER.forEach(function (a) { svg('polygon', { points: poly(a), class: 'om-lake' }, land); });
    var cityLayer = svg('g', { class: 'om-cities' }, root);
    // vehicles are drawn on a pixel-based overlay so their images stay sharp at every zoom level
    var over = svg('svg', { class: 'om-over', 'aria-hidden': 'false' }, host);
    var layer = svg('g', { class: 'om-markers' }, over);

    var tools = UI.el('div', { class: 'om-tools' });
    [['+', 'Zoom in', function () { zoomBy(0.5); }], ['−', 'Zoom out', function () { zoomBy(2); }], ['⌂', 'Show the whole world', function () { setView(WORLD); }]].forEach(function (b) {
      var btn = UI.el('button', { type: 'button', class: 'om-tool', 'aria-label': b[1], title: b[1] }, b[0]);
      btn.addEventListener('click', b[2]); tools.appendChild(btn);
    });
    if (opts.fullscreen !== false && host.requestFullscreen) {
      var fs = UI.el('button', { type: 'button', class: 'om-tool', 'aria-label': 'Full screen', title: 'Full screen' }, '⛶');
      fs.addEventListener('click', function () { var t = opts.fullscreenTarget || host; if (document.fullscreenElement) document.exitFullscreen(); else t.requestFullscreen().catch(function () { UI.toast('Full screen is not available here.', 'error'); }); });
      tools.appendChild(fs);
    }
    host.appendChild(tools);
    var tip = UI.el('div', { class: 'om-tip', role: 'tooltip' }); tip.hidden = true; host.appendChild(tip);
    var card = UI.el('div', { class: 'om-card', role: 'dialog', 'aria-label': 'Driver details' }); card.hidden = true; host.appendChild(card);
    var scaleNote = UI.el('div', { class: 'om-scale' }); host.appendChild(scaleNote);

    var api = { host: host, render: render, focusGeo: focusGeo, setView: setView, destroy: destroy, closeCard: closeCard };
    var pinned = null, hideTimer = null, timer = null, data = [];

    // ---------------------------------------------------------------- view
    function apply() { root.setAttribute('viewBox', vb.map(function (v) { return String(+v.toPrecision(8)); }).join(' ')); }
    function unitsPerPx() { var w = root.clientWidth || host.clientWidth || 800, h = root.clientHeight || host.clientHeight || 400; return Math.max(vb[2] / w, vb[3] / h); }
    function clampView(v) {
      var w = Math.max(1.2, Math.min(WORLD[2] * 1.1, v[2])), h = w * (v[3] / v[2]);
      if (h > 900) { h = 900; w = h * (v[2] / v[3]); }
      return [Math.max(-200, Math.min(1440 + 200 - w, v[0])), Math.max(-200, Math.min(720 + 200 - h, v[1])), w, h];
    }
    function setView(v) { vb = fit(v); apply(); render(); }
    function fit(v) {
      // keep the box's aspect ratio equal to the element's so the map is not distorted
      var w = host.clientWidth || 800, h = host.clientHeight || 400, ar = w / h, bw = v[2], bh = v[3];
      if (bw / bh > ar) bh = bw / ar; else bw = bh * ar;
      return clampView([v[0] + v[2] / 2 - bw / 2, v[1] + v[3] / 2 - bh / 2, bw, bh]);
    }
    function zoomAt(f, cx, cy) { setView([cx - (cx - vb[0]) * f, cy - (cy - vb[1]) * f, vb[2] * f, vb[3] * f]); }
    function zoomBy(f) { zoomAt(f, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2); }
    function toMap(ev) { var r = root.getBoundingClientRect(), u = unitsPerPx(); return [vb[0] + (ev.clientX - r.left - (r.width - vb[2] / u) / 2) * u, vb[1] + (ev.clientY - r.top - (r.height - vb[3] / u) / 2) * u]; }
    function focusGeo(g) {
      var cities = OD.citiesIn(g);
      if (!cities.length || (!g.country && !g.state && !g.city)) { setView(WORLD); return; }
      var xs = cities.map(function (c) { return px(c.lng); }), ys = cities.map(function (c) { return py(c.lat); });
      var pad = g.city ? 0.75 : g.state ? 2.4 : 7, x0 = Math.min.apply(null, xs) - pad, x1 = Math.max.apply(null, xs) + pad, y0 = Math.min.apply(null, ys) - pad, y1 = Math.max.apply(null, ys) + pad;
      setView([x0, y0, x1 - x0, y1 - y0]);
    }
    host.addEventListener('wheel', function (ev) { if (ev.target.closest('.om-card,.om-tools')) return; ev.preventDefault(); var p = toMap(ev); zoomAt(ev.deltaY > 0 ? 1.25 : 0.8, p[0], p[1]); }, { passive: false });
    host.addEventListener('dblclick', function (ev) { if (ev.target.closest('.om-m,.om-card,.om-tools')) return; var p = toMap(ev); zoomAt(0.5, p[0], p[1]); });
    var drag = null;
    host.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.om-m,.om-card,.om-tools')) return; drag = { x: ev.clientX, y: ev.clientY, vb: vb.slice() }; root.classList.add('om-drag'); });
    function onMove(ev) {
      if (!drag) return; var u = unitsPerPx();
      vb = clampView([drag.vb[0] - (ev.clientX - drag.x) * u, drag.vb[1] - (ev.clientY - drag.y) * u, drag.vb[2], drag.vb[3]]); apply();
    }
    function onUp() { if (drag) { drag = null; root.classList.remove('om-drag'); render(); } }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    host.addEventListener('keydown', function (ev) {
      if (ev.target.closest && ev.target.closest('.om-card')) { if (ev.key === 'Escape') closeCard(); return; }
      var step = vb[2] * 0.15, k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (k) { ev.preventDefault(); setView([vb[0] + k[0], vb[1] + k[1], vb[2], vb[3]]); }
      else if (ev.key === '+' || ev.key === '=') zoomBy(0.6); else if (ev.key === '-') zoomBy(1.6); else if (ev.key === 'Escape') closeCard();
    });

    // ---------------------------------------------------------------- markers
    function render() {
      if (!document.body.contains(host)) return;
      data = opts.vehicles ? opts.vehicles() : [];
      UI.clear(layer); UI.clear(cityLayer);
      var u = unitsPerPx(), size = 26, inside = [];
      var W = root.clientWidth || host.clientWidth, H = root.clientHeight || host.clientHeight;
      var offX = (W - vb[2] / u) / 2, offY = (H - vb[3] / u) / 2;
      var sx = function (x) { return (x - vb[0]) / u + offX; }, sy = function (y) { return (y - vb[1]) / u + offY; };
      over.setAttribute('viewBox', '0 0 ' + W + ' ' + H); over.setAttribute('width', W); over.setAttribute('height', H);
      var x0 = vb[0] - size * u, x1 = vb[0] + vb[2] + size * u, y0 = vb[1] - size * u, y1 = vb[1] + vb[3] + size * u;
      data.forEach(function (v) { var x = px(v.lng), y = py(v.lat); if (x >= x0 && x <= x1 && y >= y0 && y <= y1) inside.push([v, x, y]); });
      var spreadPx0 = 0.11 * K / u;
      if (spreadPx0 >= 34) OD.CITY_LIST.forEach(function (c) {
        // city level: a light street pattern (ring roads and main roads) and the city name
        var x = px(c.lng), y = py(c.lat), R = 0.16 * K; if (x + R < x0 || x - R > x1 || y + R < y0 || y - R > y1) return;
        svg('circle', { cx: x, cy: y, r: 0.15 * K, class: 'om-area' }, cityLayer);
        [0.05, 0.1].forEach(function (rr) { svg('circle', { cx: x, cy: y, r: rr * K, class: 'om-road' }, cityLayer); });
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 + 0.3; svg('line', { x1: x, y1: y, x2: x + Math.cos(a) * 0.15 * K, y2: y + Math.sin(a) * 0.15 * K, class: 'om-road' }, cityLayer); }
        for (var j = -3; j <= 3; j++) { svg('line', { x1: x - 0.14 * K, y1: y + j * 0.035 * K, x2: x + 0.14 * K, y2: y + j * 0.035 * K, class: 'om-street' }, cityLayer); svg('line', { x1: x + j * 0.035 * K, y1: y - 0.14 * K, x2: x + j * 0.035 * K, y2: y + 0.14 * K, class: 'om-street' }, cityLayer); }
        var t = svg('text', { x: x, y: y - 0.155 * K, class: 'om-city', 'font-size': 13 * u }, cityLayer); t.textContent = c.name;
      });
      var groups = [], spreadPx = 0.11 * K / u;
      if (spreadPx < 34) {
        // zoomed out: one group per city, cities closer than ~90 px merge into one group
        var byCity = {};
        inside.forEach(function (it) { (byCity[it[0].city] = byCity[it[0].city] || []).push(it); });
        Object.keys(byCity).map(function (id) { var c = OD.CITIES[id]; return { x: px(c.lng), y: py(c.lat), items: byCity[id] }; })
          .sort(function (a, b) { return b.items.length - a.items.length; })
          .forEach(function (c) {
            var near = groups.filter(function (g) { return Math.abs(g.x - c.x) < 90 * u && Math.abs(g.y - c.y) < 90 * u; })[0];
            if (near) { var n = near.items.length + c.items.length; near.x = (near.x * near.items.length + c.x * c.items.length) / n; near.y = (near.y * near.items.length + c.y * c.items.length) / n; near.items = near.items.concat(c.items); }
            else groups.push(c);
          });
      } else {
        // city level: a grid of areas; street level: every vehicle on its own
        var cells = {}, cell = 52 * u;
        inside.forEach(function (it) { var key = Math.floor(it[1] / cell) + ':' + Math.floor(it[2] / cell); (cells[key] = cells[key] || []).push(it); });
        Object.keys(cells).forEach(function (k) { groups.push({ x: avg(cells[k], 1), y: avg(cells[k], 2), items: cells[k] }); });
      }
      var single = vb[2] < 2.2;
      groups.forEach(function (grp) {
        if (spreadPx < 34 && vb[2] < 700) {
          var names = {}; grp.items.forEach(function (it) { names[it[0].city] = (names[it[0].city] || 0) + 1; });
          var top = Object.keys(names).sort(function (a, b) { return names[b] - names[a]; }), lab = OD.CITIES[top[0]].name + (top.length > 1 ? ' +' + (top.length - 1) : '');
          var tt = svg('text', { x: grp.x, y: grp.y + (Math.max(15, 8 * 4.6) + 30) * u, class: 'om-city', 'font-size': 11 * u }, cityLayer); tt.textContent = lab;
        }
        var byType = {};
        grp.items.forEach(function (it) { (byType[it[0].type] = byType[it[0].type] || []).push(it); });
        var types = TYPE_ORDER.filter(function (t) { return byType[t]; }), n = types.length;
        var ring = n > 1 ? Math.max(15, n * 4.6) : 0;   // vehicle types in a small flower around the group's centre (pixels)
        types.forEach(function (t, i) {
          var list = byType[t], a = (i / n) * Math.PI * 2 - Math.PI / 2, x = sx(grp.x) + Math.cos(a) * ring, y = sy(grp.y) + Math.sin(a) * ring;
          if (single) list.forEach(function (it) { marker(it[0], sx(it[1]), sy(it[2]), size, 1); });
          else if (list.length === 1) marker(list[0][0], x, y, size * 0.92, 1);
          else cluster(t, list, x, y, size * (spreadPx < 34 ? 0.86 : 1), 1);
        });
      });
      var shown = inside.length;
      scaleNote.textContent = shown + ' of ' + data.length + ' vehicle' + (data.length === 1 ? '' : 's') + ' in view · scroll or use + / − to zoom';
      if (pinned && !OD.vehicle(pinned)) closeCard();
    }
    function avg(items, i) { return items.reduce(function (t, it) { return t + it[i]; }, 0) / items.length; }
    function icon(type, x, y, s, g) { svg('image', { href: 'assets/img/vehicles/' + type + '.svg', x: (x - s / 2), y: (y - s / 2), width: s, height: s }, g); }
    function badge(n, x, y, u, g, kind) {
      var label = n > 999 ? '999+' : String(n), w = Math.max(16, 7 * label.length + 8) * u, h = 16 * u;
      svg('rect', { x: (x - w / 2), y: (y - h / 2), width: w, height: h, rx: (h / 2), class: 'om-badge' + (kind ? ' ' + kind : '') }, g);
      var t = svg('text', { x: x, y: (y + 4 * u), class: 'om-badge-t', 'font-size': (10.5 * u) }, g); t.textContent = label;
    }
    function cluster(type, group, x, y, s, u) {
      var sos = group.filter(function (it) { return it[0].status === 'SOS'; }).length;
      var g = svg('g', { class: 'om-m om-cluster' + (sos ? ' om-sos' : ''), tabindex: '0', role: 'button', 'aria-label': group.length + ' ' + OD.TYPES[type].label + ' vehicles' + (sos ? ', ' + sos + ' SOS' : '') + '. Zoom in' }, layer);
      if (sos) svg('circle', { cx: x, cy: y, r: (s * 0.72), class: 'om-pulse' }, g);
      icon(type, x, y, s, g);
      badge(group.length, x + s * 0.46, y - s * 0.42, u, g, sos ? 'sos' : '');
      var counts = {}; group.forEach(function (it) { counts[it[0].status] = (counts[it[0].status] || 0) + 1; });
      var cities = {}; group.forEach(function (it) { cities[OD.CITIES[it[0].city].name] = 1; });
      var lines = [group.length + ' × ' + OD.TYPES[type].label + ' · ' + Object.keys(cities).slice(0, 3).join(', ') + (Object.keys(cities).length > 3 ? ' …' : ''),
        Object.keys(counts).map(function (k) { return counts[k] + ' ' + OD.STATUS[k].toLowerCase(); }).join(' · '), 'Click to zoom in'];
      var zoomIn = function () {
        var xs = group.map(function (it) { return it[1]; }), ys = group.map(function (it) { return it[2]; });
        var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs), by0 = Math.min.apply(null, ys), by1 = Math.max.apply(null, ys);
        var w = Math.max(bx1 - bx0, vb[2] * 0.06) * 1.4, h = Math.max(by1 - by0, vb[3] * 0.06) * 1.4;
        tip.hidden = true; setView([(bx0 + bx1) / 2 - w / 2, (by0 + by1) / 2 - h / 2, w, h]);
      };
      g.addEventListener('click', zoomIn);
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); zoomIn(); } });
      g.addEventListener('mouseenter', function (ev) { showTip(lines, ev); });
      g.addEventListener('mousemove', function (ev) { placeAt(tip, ev); });
      g.addEventListener('mouseleave', function () { tip.hidden = true; });
    }
    function marker(v, x, y, s, u) {
      var g = svg('g', { class: 'om-m om-one' + (v.status === 'SOS' ? ' om-sos' : '') + (pinned === v.id ? ' om-pinned' : ''), tabindex: '0', role: 'button', 'data-vehicle': v.id,
        'aria-label': OD.TYPES[v.type].label + ' ' + v.plate + ', ' + v.driver.name + ', ' + OD.STATUS[v.status] }, layer);
      if (v.status === 'SOS') svg('circle', { cx: x, cy: y, r: (s * 0.75), class: 'om-pulse' }, g);
      svg('circle', { cx: x, cy: y, r: (s * 0.6), fill: STATUS_COLOR[v.status], class: 'om-ring' }, g);
      icon(v.type, x, y, s * 0.92, g);
      g.addEventListener('mouseenter', function (ev) { clearTimeout(hideTimer); if (!pinned) showCard(v, ev); });
      g.addEventListener('mouseleave', function () { if (!pinned) hideTimer = setTimeout(function () { card.hidden = true; }, 300); });
      g.addEventListener('click', function (ev) { pinned = v.id; showCard(v, ev); render(); });
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pinned = v.id; showCard(v, null, g); render(); var b = card.querySelector('button'); if (b) b.focus(); } });
    }
    function showTip(lines, ev) { UI.clear(tip); lines.forEach(function (l, i) { tip.appendChild(UI.el(i ? 'span' : 'b', null, l)); }); tip.hidden = false; placeAt(tip, ev); }
    function placeAt(n, ev, el) {
      var r = host.getBoundingClientRect(), p;
      if (ev) p = [ev.clientX - r.left, ev.clientY - r.top];
      else { var b = el.getBoundingClientRect(); p = [b.left - r.left + b.width / 2, b.top - r.top + b.height / 2]; }
      var w = n.offsetWidth || 260, h = n.offsetHeight || 200, x = p[0] + 16, y = p[1] - 20;
      if (x + w > r.width - 8) x = p[0] - w - 16;
      if (y + h > r.height - 8) y = r.height - h - 8;
      n.style.left = Math.max(8, x) + 'px'; n.style.top = Math.max(8, y) + 'px';
    }
    card.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', function () { if (!pinned) hideTimer = setTimeout(function () { card.hidden = true; }, 300); });

    function showCard(v, ev, el) {
      var d = v.driver, r = v.rideId && OD.ride(v.rideId), o = v.orderId && OD.order(v.orderId), city = OD.CITIES[v.city];
      UI.clear(card);
      var head = UI.el('div', { class: 'om-card-hd' });
      head.appendChild(UI.el('b', null, 'Driver · ' + d.name));
      var x = UI.el('button', { type: 'button', class: 'om-x', 'aria-label': 'Close' }, '×'); x.addEventListener('click', closeCard); head.appendChild(x);
      card.appendChild(head);
      var who = UI.el('div', { class: 'om-who' });
      who.appendChild(UI.el('span', { class: 'av' }, d.initials));
      var nm = UI.el('div'); nm.appendChild(UI.el('b', null, d.name)); nm.appendChild(document.createTextNode(' ★ ' + d.rating));
      nm.appendChild(UI.el('div', { class: 'om-sub' }, v.plate + ' · ' + v.model)); who.appendChild(nm); card.appendChild(who);
      card.appendChild(UI.el('span', { class: 'st ' + ({ AVAILABLE: 'ok', ON_TRIP: 'info', OFFER: 'warn', SOS: 'err', OFFLINE: '' }[v.status]) }, OD.STATUS[v.status]));
      var kv = function (k, val) { var row = UI.el('div', { class: 'om-kv' }); row.appendChild(UI.el('span', null, k)); row.appendChild(UI.el('b', null, val)); card.appendChild(row); };
      kv(o ? 'Order' : 'Ride', r ? r.id : o ? o.id : '—');
      kv('Vehicle', OD.TYPES[v.type].label + ' · ' + city.name);
      kv('Speed', v.speed + ' km/h');
      kv('Last ping', ago(v.ping));
      kv('Today', d.trips + (d.trips === 1 ? ' trip · ' : ' trips · ') + OD.money(d.earned, city.currency));
      var acts = UI.el('div', { class: 'om-acts' });
      var btn = function (label, cls, fn, dis) { var b = UI.el('button', { type: 'button', class: 'dbtn ' + cls }, label); b.disabled = !!dis; b.addEventListener('click', function () { fn(b); }); acts.appendChild(b); };
      btn(o ? 'Open order' : 'Open ride', '', function () { if (opts.onOpen) opts.onOpen(v, r, o); }, !r && !o);
      btn('Call driver', 'g', function (b) { if (opts.onCall) opts.onCall(v, b); });
      btn('Message', 'g', function (b) { if (opts.onMessage) opts.onMessage(v, b); });
      card.appendChild(acts);
      card.hidden = false;
      placeAt(card, ev, el || layer.querySelector('[data-vehicle="' + v.id + '"]') || host);
    }
    function closeCard() { pinned = null; card.hidden = true; render(); }

    // ---------------------------------------------------------------- live movement
    if (opts.live) timer = setInterval(function () {
      if (!document.body.contains(host)) { destroy(); return; }
      if (document.hidden) return;
      OD.vehicles.forEach(function (v) {
        v.ping = v.status === 'OFFLINE' ? v.ping + 3 : OD.int(1, 6);
        if (v.status === 'ON_TRIP' || v.status === 'AVAILABLE') {
          var rad = v.heading * Math.PI / 180, step = v.speed / 3600 * 3 / 111 * 4;   // three seconds at the current speed
          v.lat += Math.cos(rad) * step; v.lng += Math.sin(rad) * step;
          if (OD.random() < 0.15) v.heading = (v.heading + OD.int(-60, 60) + 360) % 360;
          var c = OD.CITIES[v.city]; if (Math.abs(v.lat - c.lat) > 0.13 || Math.abs(v.lng - c.lng) > 0.15) v.heading = (v.heading + 180) % 360;
          v.speed = v.status === 'ON_TRIP' ? Math.max(5, Math.min(70, v.speed + OD.int(-6, 6))) : Math.max(0, Math.min(30, v.speed + OD.int(-4, 4)));
        }
      });
      if (!drag) render();
      if (pinned && !card.hidden) { var pv = OD.vehicle(pinned); if (pv) { var kvs = card.querySelectorAll('.om-kv b'); if (kvs[2]) kvs[2].textContent = pv.speed + ' km/h'; if (kvs[3]) kvs[3].textContent = ago(pv.ping); } }
    }, 3000);
    function destroy() {
      clearInterval(timer); timer = null;
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      if (ro) ro.disconnect();
    }

    var ro = window.ResizeObserver ? new ResizeObserver(function () { vb = fit(vb); apply(); render(); }) : null;
    if (ro) ro.observe(host);
    vb = fit(WORLD); apply();
    return api;
  }

  RN.opsMap = { create: create, STATUS_COLOR: STATUS_COLOR, TYPE_ORDER: TYPE_ORDER };
})();
