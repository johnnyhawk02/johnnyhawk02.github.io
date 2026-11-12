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
    P + ' *{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-sizing:border-box}' +
    P + '{position:fixed;inset:0;z-index:2147483000;background:#fff;color:#1d2329;border-radius:0;' +
    'display:flex;flex-direction:column;font:14px/1.4 system-ui,Segoe UI,Arial,sans-serif}' +
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
    P + ' .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:middle;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}' +
    P + ' .sum{margin-top:10px;color:#5a6570}' +
    P + ' .stale{background:#fff4ce;color:#5c4400;border-bottom:1px solid #f0d77a;padding:10px 18px;font-weight:600;cursor:pointer}' +
    P + ' .stale[hidden]{display:none}' +
    P + ' tr.tap{cursor:pointer}' + P + ' tr.tap:hover td{background:#f3f7fc}' +
    P + ' tr.ppl-row td{background:#fafbfc;white-space:normal;padding:8px 14px}' +
    P + ' ul.ppl{margin:0;padding:0;list-style:none}' + P + ' ul.ppl li{padding:3px 0}' +
    P + ' ul.ppl span{color:#5a6570;margin-left:8px;font-size:13px}' +
    P + ' ul.ppl span.yes{color:#2f8f4e}' + P + ' ul.ppl span.no{color:#c0392b}' +
    P + ' .cols{display:flex;gap:16px;align-items:flex-start;margin-top:10px}' +
    P + ' .room{flex:1 1 0;min-width:0;border:1px solid #e3e6ea;border-radius:10px;overflow:hidden}' +
    P + ' .room h3{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;padding:10px 12px;background:#eaf1f9;font-size:16px;border-bottom:2px solid #c9d8ea}' +
    P + ' .room h3 small{font-weight:400;color:#5a6570;margin-left:6px;font-size:13px}' +
    P + ' .room table{margin-top:0;table-layout:fixed}' +
    P + ' .room td{overflow:hidden;text-overflow:ellipsis}' +
    P + ' .room th,' + P + ' .room td{padding:7px 5px}' + P + ' .room th:first-child,' + P + ' .room td:first-child{padding-left:10px}' + P + ' .room th:last-child,' + P + ' .room td:last-child{padding-right:10px}' + P + ' .room th.c-start{width:5em}' + P + ' .room th.c-length{width:3.9em}' + P + ' .room td.len{color:#5a6570;white-space:nowrap}' + P + ' .room th.c-booked{width:5.2em}' +
    P + ' .room th.c-alert{width:3.9em}' + P + ' .room th.c-payment{width:5.4em}' + P + ' .room th.c-notes{width:7em}' +
    P + ' .room th.c-booked,' + P + ' .room th.c-alert,' + P + ' .room td.num{text-align:right}' +
    P + ' .room thead th{font-size:.85em;color:#5a6570;font-weight:600;text-transform:uppercase;letter-spacing:.03em}' +
    P + ' .room td.time{font-variant-numeric:tabular-nums;color:#3a444e}' +
    P + ' .room td.num{font-variant-numeric:tabular-nums}' +
    P + ' .stack{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:16px}' + P + ' .stack .room{flex:none}' +
    P + ' .room tr.ppl-row td{overflow:visible}' +
    '@media (max-width:760px){' + P + ' .cols{flex-direction:column}' + P + ' .room,' + P + ' .stack{width:100%;flex:none}}' +
    P + ' tr.roomhead td{background:#eaf1f9;font-weight:700;font-size:15px;padding-top:12px;border-bottom:2px solid #c9d8ea}' +
    P + ' tr.roomhead small{font-weight:400;color:#5a6570;margin-left:8px}' +
    '</style>' +
    '<header><h2 data-k="title">Today</h2>' +
    '<button data-k="scan">Refresh</button>' +
    '<button data-k="close">Close</button>' +
    '<span class="status" data-k="status">Starting…</span></header>' +
    '<div class="stale" data-k="stale" hidden></div>' +
    '<div class="body" data-k="body"><p class="sum">Reading today\'s rooms. Leave this tab open for a few seconds.</p></div>';
  document.body.appendChild(panel);
  var el = function (k) { return panel.querySelector('[data-k="' + k + '"]'); };
  var setStatus = function (s) { el('status').textContent = s; };
  el('close').onclick = function () { panel.parentNode.removeChild(panel); };
  el('title').textContent = 'Today, ' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  var uidSeq = 0;

  /* ---------- reading the booking sheet ---------- */
  function readCards(room) {
    return $$('.booking').filter(function (b) { return b.querySelector('.booking__inner'); }).map(function (b, idx) {
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
        srcRoom: room,
        idx: idx,
        uid: ++uidSeq,
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
  var lastUpdated = 0;
  var STALE_MS = 15 * 60 * 1000;
  function checkStale() {
    if (!document.body.contains(panel)) { clearInterval(staleTimer); return; }
    var box = el('stale');
    var age = lastUpdated ? Date.now() - lastUpdated : 0;
    if (lastUpdated && age > STALE_MS) {
      box.textContent = '⚠ This information is ' + Math.floor(age / 60000) + ' minutes old and may be out of date. Tap here or Refresh to update.';
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }
  var staleTimer = setInterval(checkStale, 30000);
  var people = {}; // uid -> {state, list, cap}

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
      var wanted = names.map(function (n, i) { return { n: n, i: i }; });
      var fresh = [];
      people = {};
      for (var k = 0; k < wanted.length; k++) {
        setStatus('Reading ' + wanted[k].n + ' (' + (k + 1) + '/' + wanted.length + ')…');
        if (!(await chooseRoom(wanted[k].i))) continue;
        var got = readCards(wanted[k].n);
        if (category(wanted[k].n) === 'pool') {
          // Pool: only Aqua classes, merged into one Pool section, lane duplicates removed.
          got = got.filter(function (x) { return /aqua/i.test(x.name); }).map(function (x) { x.room = 'Pool'; return x; });
          got = got.filter(function (x) {
            return !fresh.some(function (y) { return y.room === 'Pool' && y.start === x.start && y.name === x.name && y.booked === x.booked && y.capacity === x.capacity; });
          }).filter(function (x, i, arr) {
            return arr.findIndex(function (y) { return y.start === x.start && y.name === x.name && y.booked === x.booked && y.capacity === x.capacity; }) === i;
          });
        }
        fresh = fresh.concat(got);
        rows = fresh;
        render();
      }
      var back = names.indexOf(originalRoom);
      if (back >= 0) await chooseRoom(back);
      lastUpdated = Date.now();
      checkStale();
      setStatus('Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '.');
    } catch (e) {
      setStatus('Stopped: ' + e.message);
    }
    busy = false;
    el('scan').disabled = false;
    render();
  }

  function readDetails() {
    var box = $('app-booking-details');
    if (!box) return null;
    var list = $$('tbody tr.mat-mdc-row, tbody tr[mat-row]', box).map(function (tr) {
      var icon = function (col) { var i = tr.querySelector('.cdk-column-' + col + ' mat-icon'); return i ? txt(i) : ''; };
      return {
        name: txt(tr.querySelector('.cdk-column-name')),
        id: txt(tr.querySelector('.cdk-column-memberId')),
        attended: icon('attended') === 'check_circle',
        paid: icon('paid') === 'check_circle'
      };
    }).filter(function (r) { return r.name; });
    return { list: list, cap: txt($('.booking-detail__capacity', box)), title: txt($('.booking-detail__header', box)) };
  }

  function closeDetails() {
    var c = $('.drawer-header .close') || $('.drawer-header gso-icon[icon="close"]');
    if (c) c.click();
    closeOverlay();
  }

  async function loadPeople(x) {
    if (busy) return;
    busy = true;
    people[x.uid] = { state: 'loading' };
    render();
    try {
      if (txt($('.locations__selected')) !== x.srcRoom) {
        var ri = roomOrder.indexOf(x.srcRoom);
        if (ri < 0 || !(await chooseRoom(ri))) throw new Error('room not found');
      }
      var cards = $$('.booking').filter(function (b) { return b.querySelector('.booking__inner'); });
      var match = cards.filter(function (b) {
        return txt($('.row-wrapper--title', b)) === x.name && txt(b).indexOf(x.start) >= 0;
      });
      var card = match.length === 1 ? match[0] : (cards[x.idx] || match[0]);
      if (!card) throw new Error('booking not found');
      card.click();
      var got = null, last = '', stable = 0, t0 = Date.now();
      while (Date.now() - t0 < 8000) {
        await sleep(250);
        var d = readDetails();
        if (!d || d.title.indexOf(x.name) < 0) continue;
        var sig = JSON.stringify(d);
        if (sig === last) { stable += 250; } else { stable = 0; last = sig; }
        got = d;
        if (stable >= 500) break;
      }
      closeDetails();
      if (!got) throw new Error('details did not open');
      people[x.uid] = { state: 'done', list: got.list, cap: got.cap };
    } catch (e) {
      closeDetails();
      people[x.uid] = { state: 'error', msg: e.message };
    }
    busy = false;
    render();
  }

  function shortLen(d) { return String(d || '').replace(/(\d+)\s*hrs?\s*(\d+)\s*m/, '$1h$2').replace(/(\d+)\s*hrs?\b/, '$1h'); }

  function toMin(t) { var m = /(\d+):(\d+)/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 9999; }

  function render() {
    var ri = function (r) { var i = roomOrder.indexOf(r); return i < 0 ? 999 : i; };
    var rank = function (r) { return r === 'Pool' ? 2 : category(r) === 'gym' ? 1 : 0; };
    var list = rows.slice();
    list.sort(function (a, b) { return (rank(a.room) - rank(b.room)) || (ri(a.room) - ri(b.room)) || (toMin(a.start) - toMin(b.start)); });

    var booked = 0, cap = 0, full = 0, waiting = 0;
    list.forEach(function (x) { booked += x.booked || 0; cap += x.capacity || 0; waiting += x.alert || 0; if (x.capacity && x.booked >= x.capacity) full++; });

    if (!list.length) {
      el('body').innerHTML = '<p class="sum">' + (busy ? 'Reading rooms…' : 'Nothing booked today.') + '</p>';
      return;
    }
    var sum = list.length + (list.length === 1 ? ' session' : ' sessions');
    if (cap) sum += ' · ' + booked + ' of ' + cap + ' places booked · ' + full + ' full';
    if (waiting) sum += ' · ' + waiting + ' on alert lists';
    var rooms = [];
    list.forEach(function (x) { if (rooms.indexOf(x.room) < 0) rooms.push(x.room); });
    var html = '<p class="sum">' + sum + '</p><div class="cols">';
    var stackOpen = false;
    rooms.forEach(function (room) {
      // gym and pool share the last column, pool underneath
      if (rank(room) >= 1 && !stackOpen) { html += '<div class="stack">'; stackOpen = true; }
      var inRoom = list.filter(function (y) { return y.room === room; });
      var rb = 0, rc = 0; inRoom.forEach(function (y) { rb += y.booked || 0; rc += y.capacity || 0; });
      var hasAlert = inRoom.some(function (y) { return y.alert; });
      var hasNotes = inRoom.some(function (y) { return y.extra; });
      var payOnly = hasNotes && inRoom.every(function (y) { return !y.extra || /^Payment: [^;]*$/.test(y.extra); });
      var hasBooked = inRoom.some(function (y) { return y.capacity != null; });
      var cols = ['Start', category(room) === 'gym' ? 'Booking' : 'Class', 'Length'];
      if (hasBooked) cols.push('Booked');
      if (hasAlert) cols.push('Alert');
      if (payOnly) hasNotes = false; // payment-only notes are not shown
      if (hasNotes) cols.push('Notes');
      html += '<section class="room"><h3>' + esc(room) + ' <small>' + inRoom.length + (inRoom.length === 1 ? ' session' : ' sessions') + (rc ? ' · ' + rb + '/' + rc + ' booked' : '') + '</small></h3>' +
        '<table><thead><tr>' + cols.map(function (c, ci) { return '<th class="c-' + (ci === 1 ? 'name' : c.toLowerCase()) + '">' + (c === 'Length' ? 'Len' : c === 'Booked' ? 'Booked' : c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      inRoom.forEach(function (x) {
        var pct = x.capacity ? Math.min(100, Math.round(100 * x.booked / x.capacity)) : 0;
        var cls = x.capacity && x.booked >= x.capacity ? 'full' : (x.capacity && x.booked === 0) ? 'empty' : '';
        html += '<tr class="' + cls + ' tap" data-uid="' + x.uid + '" title="Tap to see who is booked"><td class="time">' + esc(x.start) + '</td>' +
          '<td class="name" title="' + esc(x.name) + '"><span class="dot" style="background:' + esc(x.colour) + '"></span>' + esc(x.name) + '</td>' +
          
          '<td class="len">' + esc(shortLen(x.duration)) + '</td>' +
          (hasBooked ? '<td class="num">' + (x.capacity != null ? x.booked + '/' + x.capacity : '') + '</td>' : '') +
          (hasAlert ? '<td class="num">' + (x.alert || '') + '</td>' : '') +
          (hasNotes ? '<td title="' + esc(x.extra) + '">' + esc(payOnly ? x.extra.replace(/^Payment:\s*/, '') : x.extra) + '</td>' : '') + '</tr>';
        var pp = people[x.uid];
        if (pp && pp.open !== false) {
          var inner;
          if (pp.state === 'loading') inner = 'Loading who\'s booked…';
          else if (pp.state === 'error') inner = 'Couldn\'t load: ' + esc(pp.msg) + '. Tap the row to try again.';
          else if (!pp.list.length) inner = 'Nobody booked.';
          else inner = '<ul class="ppl">' + pp.list.map(function (r) {
            return '<li><b>' + esc(r.name) + '</b>' + (r.id ? ' <span>#' + esc(r.id) + '</span>' : '') +
              ' <span class="' + (r.attended ? 'yes' : 'no') + '">' + (r.attended ? 'Attended' : 'Not attended') + '</span>' +
              ' <span class="' + (r.paid ? 'yes' : 'no') + '">' + (r.paid ? 'Paid' : 'Not paid') + '</span></li>';
          }).join('') + '</ul>';
          html += '<tr class="ppl-row"><td colspan="' + cols.length + '">' + inner + '</td></tr>';
        }
      });
      html += '</tbody></table></section>';
    });
    if (stackOpen) html += '</div>';
    el('body').innerHTML = html + '</div>';
    $$('tr.tap', el('body')).forEach(function (tr) {
      tr.onclick = function () {
        var uid = +tr.getAttribute('data-uid');
        var x = rows.filter(function (r) { return r.uid === uid; })[0];
        var pp = people[uid];
        if (pp && pp.state === 'done') { pp.open = pp.open === false; render(); return; }
        if (x && !busy) loadPeople(x);
      };
    });
  }

  el('scan').onclick = scan;
  el('stale').onclick = scan;

  scan();
})();
