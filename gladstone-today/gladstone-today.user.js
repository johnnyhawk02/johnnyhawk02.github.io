// ==UserScript==
// @name         Gladstone today
// @namespace    https://johnnyhawk02.github.io/gladstone-today/
// @version      1.0
// @description  Adds a "Today" button to Gladstone Centre Management that shows today's classes and gym bookings for every room.
// @match        https://activesefton.gladstonesoftware.cloud/*
// @downloadURL  https://johnnyhawk02.github.io/gladstone-today/gladstone-today.user.js
// @updateURL    https://johnnyhawk02.github.io/gladstone-today/gladstone-today.user.js
// @grant        none
// ==/UserScript==
(function () {
  function run() {
/* Gladstone Centre Management: today's classes and gym, all rooms at once.
 * Runs inside your own signed-in Gladstone360 tab. It only reads what the
 * booking sheet already shows you, by switching to Today and stepping through
 * the room dropdown. Pool rooms are skipped. Nothing is sent anywhere and
 * nothing is booked or changed.
 */
(async function () {
  var ID = 'gso-overview-panel';
  var old = document.getElementById(ID);
  if (old) old.parentNode.removeChild(old);

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var roomSelect = $('mat-select[dataqaid="location-select"]');
  if (!roomSelect) {
    alert('Open Centre Management (the booking sheet) first, then click the bookmark again.');
    return;
  }

  /* Which rooms count as what. Anything not gym or pool counts as a class room. */
  function category(room) {
    if (/fitness|gym/i.test(room)) return 'gym';
    if (/pool|swim|splash|lagoon|flume/i.test(room)) return 'pool';
    return 'classes';
  }

  /* ---------- panel ---------- */
  var panel = document.createElement('div');
  panel.id = ID;
  var P = '#' + ID;
  panel.innerHTML =
    '<style>' +
    P + '{position:fixed;inset:24px;z-index:2147483000;background:#fff;color:#1d2329;border-radius:12px;' +
    'box-shadow:0 10px 40px rgba(0,0,0,.35);display:flex;flex-direction:column;font:14px/1.4 system-ui,Segoe UI,Arial,sans-serif}' +
    P + ' header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px 18px;border-bottom:1px solid #e3e6ea}' +
    P + ' h2{margin:0 8px 0 0;font-size:18px}' +
    P + ' button{font:inherit;padding:6px 12px;border:1px solid #c4cad1;border-radius:6px;background:#fff;color:inherit;cursor:pointer}' +
    P + ' .switch{display:inline-flex;border:1px solid #0b5cad;border-radius:8px;overflow:hidden}' +
    P + ' .switch button{border:0;border-radius:0;padding:7px 18px;color:#0b5cad;font-weight:600}' +
    P + ' .switch button.on{background:#0b5cad;color:#fff}' +
    P + ' .status{color:#5a6570;margin-left:auto}' +
    P + ' .body{overflow:auto;flex:1;padding:0 18px 18px}' +
    P + ' table{border-collapse:collapse;width:100%;margin-top:10px}' +
    P + ' th,' + P + ' td{text-align:left;padding:7px 10px;border-bottom:1px solid #eef0f2;white-space:nowrap}' +
    P + ' th{position:sticky;top:0;background:#f6f7f9;z-index:1}' +
    P + ' tr.full td{background:#fdecec}' + P + ' tr.empty td{color:#8a949e}' +
    P + ' .bar{display:inline-block;width:60px;height:8px;border-radius:4px;background:#e3e6ea;vertical-align:middle;margin-right:6px;overflow:hidden}' +
    P + ' .bar i{display:block;height:100%;background:#2f8f4e}' + P + ' tr.full .bar i{background:#c0392b}' +
    P + ' .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}' +
    P + ' .sum{margin-top:10px;color:#5a6570}' +
    P + ' tr.roomhead td{background:#eaf1f9;font-weight:700;font-size:15px;padding-top:12px;border-bottom:2px solid #c9d8ea}' +
    P + ' tr.roomhead small{font-weight:400;color:#5a6570;margin-left:8px}' +
    '</style>' +
    '<header><h2 data-k="title">Today</h2>' +
    '<span class="switch"><button data-k="v-classes" class="on">Classes</button><button data-k="v-gym">Gym</button></span>' +
    '<button data-k="scan">Refresh</button>' +
    '<button data-k="close">Close</button>' +
    '<span class="status" data-k="status">Starting…</span></header>' +
    '<div class="body" data-k="body"><p class="sum">Reading today\'s rooms. Leave this tab open for a few seconds.</p></div>';
  document.body.appendChild(panel);
  var el = function (k) { return panel.querySelector('[data-k="' + k + '"]'); };
  var setStatus = function (s) { el('status').textContent = s; };
  el('close').onclick = function () { panel.parentNode.removeChild(panel); };
  el('title').textContent = 'Today, ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  /* ---------- reading the booking sheet ---------- */
  function readCards(room) {
    return $$('.booking').filter(function (b) { return b.querySelector('.booking__inner'); }).map(function (b) {
      var fields = {};
      $$('.booking__table p', b).forEach(function (p) {
        var strong = p.querySelector('strong');
        if (!strong) return;
        var label = txt(strong).replace(/:$/, '');
        var next = p.nextElementSibling;
        while (next && next.tagName !== 'P') next = next.nextElementSibling;
        fields[label] = txt(next);
      });
      var part = (fields['Participants'] || '').match(/(\d+)\s*\/\s*(\d+)/);
      var colour = (b.getAttribute('style') || '').match(/--activity-backcolor-hex:\s*([^;]+)/);
      return {
        room: room,
        start: fields['Start Time'] || '',
        name: txt($('.row-wrapper--title', b)),
        duration: txt($('.row-wrapper--duration', b)),
        booked: part ? +part[1] : null,
        capacity: part ? +part[2] : null,
        alert: fields['Alert List'] ? +fields['Alert List'] : 0,
        extra: Object.keys(fields).filter(function (k) {
          return ['Start Time', 'Participants', 'Alert List'].indexOf(k) < 0;
        }).map(function (k) { return k + ': ' + fields[k]; }).join('; '),
        colour: colour ? colour[1].trim() : '#999'
      };
    });
  }

  function signature() {
    return txt($('.locations__selected')) + '|' + $$('.booking').map(function (b) { return txt(b); }).join('|');
  }

  async function waitForSheet(before) {
    var start = Date.now(), last = signature(), stableSince = Date.now();
    while (Date.now() - start < 10000) {
      await sleep(250);
      var now = signature();
      if (now !== last) { last = now; stableSince = Date.now(); }
      var changed = now !== before;
      if (Date.now() - stableSince > (changed ? 700 : 1800) && Date.now() - start > 600) return;
    }
  }

  function openOptions(select) {
    (select.querySelector('.mat-mdc-select-trigger') || select).click();
    return sleep(350).then(function () {
      var id = select.getAttribute('aria-controls');
      var list = id && document.getElementById(id);
      return $$('mat-option', list || $('.cdk-overlay-container'));
    });
  }

  function closeOverlay() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    var bd = $('.cdk-overlay-backdrop');
    if (bd) bd.click();
  }

  function cleanName(o) {
    var c = o.cloneNode(true);
    $$('mat-icon, gso-icon, .material-icons, .mat-icon', c).forEach(function (i) { i.parentNode.removeChild(i); });
    return txt(c).replace(/^(favorite_border|favorite)\s+/, '');
  }

  async function roomNames() {
    var opts = await openOptions(roomSelect);
    var names = opts.map(cleanName);
    closeOverlay();
    await sleep(300);
    return names;
  }

  async function chooseRoom(index) {
    var before = signature();
    var opts = await openOptions(roomSelect);
    if (!opts[index]) { closeOverlay(); return false; }
    opts[index].click();
    await sleep(200);
    await waitForSheet(before);
    return true;
  }

  async function goToToday() {
    var btn = $('[dataqaid="today"] button') || $('[dataqaid="today"]');
    if (!btn) return;
    var before = signature();
    btn.click();
    await waitForSheet(before);
  }

  /* ---------- scanning ---------- */
  var rows = [];
  var roomOrder = [];
  var view = 'classes';
  var busy = false;

  async function scan() {
    if (busy) return;
    busy = true;
    el('scan').disabled = true;
    try {
      var originalRoom = txt($('.locations__selected'));
      await goToToday();
      var names = await roomNames();
      if (!names.length) throw new Error('could not open the room list.');
      roomOrder = names.slice();
      var wanted = names.map(function (n, i) { return { n: n, i: i }; }).filter(function (x) { return category(x.n) !== 'pool'; });
      var fresh = [];
      for (var k = 0; k < wanted.length; k++) {
        setStatus('Reading ' + wanted[k].n + ' (' + (k + 1) + '/' + wanted.length + ')…');
        if (!(await chooseRoom(wanted[k].i))) continue;
        fresh = fresh.concat(readCards(wanted[k].n));
        rows = fresh;
        render();
      }
      var back = names.indexOf(originalRoom);
      if (back >= 0) await chooseRoom(back);
      setStatus('Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.');
    } catch (e) {
      setStatus('Stopped: ' + e.message);
    }
    busy = false;
    el('scan').disabled = false;
    render();
  }

  function toMin(t) { var m = /(\d+):(\d+)/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 9999; }

  function render() {
    var ri = function (r) { var i = roomOrder.indexOf(r); return i < 0 ? 999 : i; };
    var list = rows.filter(function (x) { return category(x.room) === view; });
    list.sort(function (a, b) { return (ri(a.room) - ri(b.room)) || (toMin(a.start) - toMin(b.start)); });

    var booked = 0, cap = 0, full = 0, waiting = 0;
    list.forEach(function (x) { booked += x.booked || 0; cap += x.capacity || 0; waiting += x.alert || 0; if (x.capacity && x.booked >= x.capacity) full++; });

    if (!list.length) {
      el('body').innerHTML = '<p class="sum">' + (busy ? 'Reading rooms…' : 'Nothing in ' + (view === 'gym' ? 'the gym' : 'the class rooms') + ' today.') + '</p>';
      return;
    }
    var cols = ['Start', view === 'gym' ? 'Booking' : 'Class', 'Length', 'Booked', 'Alert list', 'Notes'];
    var sum = list.length + ' sessions';
    if (cap) sum += ' · ' + booked + ' of ' + cap + ' places booked · ' + full + ' full';
    if (waiting) sum += ' · ' + waiting + ' on alert lists';
    var html = '<p class="sum">' + sum + '</p><table><thead><tr>' +
      cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    var curRoom = null;
    list.forEach(function (x) {
      if (x.room !== curRoom) {
        curRoom = x.room;
        var inRoom = list.filter(function (y) { return y.room === curRoom; });
        var rb = 0, rc = 0; inRoom.forEach(function (y) { rb += y.booked || 0; rc += y.capacity || 0; });
        html += '<tr class="roomhead"><td colspan="' + cols.length + '">' + esc(curRoom) + ' <small>' + inRoom.length + ' sessions' + (rc ? ' · ' + rb + '/' + rc + ' booked' : '') + '</small></td></tr>';
      }
      var pct = x.capacity ? Math.min(100, Math.round(100 * x.booked / x.capacity)) : 0;
      var cls = x.capacity && x.booked >= x.capacity ? 'full' : (x.capacity && x.booked === 0) ? 'empty' : '';
      html += '<tr class="' + cls + '"><td>' + esc(x.start) + '</td>' +
        '<td><span class="dot" style="background:' + esc(x.colour) + '"></span>' + esc(x.name) + '</td>' +
        '<td>' + esc(x.duration) + '</td>' +
        '<td>' + (x.capacity != null ? '<span class="bar"><i style="width:' + pct + '%"></i></span>' + x.booked + '/' + x.capacity : '') + '</td>' +
        '<td>' + (x.alert || '') + '</td><td>' + esc(x.extra) + '</td></tr>';
    });
    el('body').innerHTML = html + '</tbody></table>';
  }

  function setView(v) {
    view = v;
    el('v-classes').className = v === 'classes' ? 'on' : '';
    el('v-gym').className = v === 'gym' ? 'on' : '';
    render();
  }
  el('v-classes').onclick = function () { setView('classes'); };
  el('v-gym').onclick = function () { setView('gym'); };
  el('scan').onclick = scan;

  scan();
})();
  }
  function addButton() {
    if (document.getElementById('gso-today-btn')) return;
    if (!document.querySelector('mat-select[dataqaid="location-select"]')) return;
    var b = document.createElement('button');
    b.id = 'gso-today-btn';
    b.textContent = 'Today view';
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147482999;padding:12px 20px;border:0;border-radius:24px;background:#0b5cad;color:#fff;font:600 16px system-ui,Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer';
    b.onclick = run;
    document.body.appendChild(b);
  }
  setInterval(addButton, 1500);
})();
