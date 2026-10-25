function setTab(t) {
  // the steps tab plays its own grid; the perform tab builds its pattern from the dials
  if (t === 'steps' && view !== 'steps') setView('steps');
  if (t === 'perform' && view === 'steps') setView('perform');
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t));
  document.querySelectorAll('[data-panel]').forEach((el) => { el.hidden = el.dataset.panel !== t; });
  try { localStorage.setItem('elexir-tab', t); } catch (e) {}
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

let view = 'perform';
function setView(v) {
  view = v;
  if (v === 'steps') { cells.forEach((row, r) => row.forEach((_, s) => drawCell(r, s))); sendSeq(); }
  else generate();
}
drawUserTools();
$('style-prev').addEventListener('click', () => { setStyle(styleIdx - 1); generate(); });
$('style-next').addEventListener('click', () => { setStyle(styleIdx + 1); generate(); });
try { const t = localStorage.getItem('elexir-tab'); if (t && document.querySelector(`[data-tab="${t}"]`)) setTab(t); } catch (e) {}

function markStep(s) {
  if (nowStep >= 0) cells.forEach((r) => r[nowStep].classList.remove('now'));
  nowStep = s;
  if (s >= 0) cells.forEach((r) => r[s].classList.add('now'));
}
const barLeds = document.querySelectorAll('.bars i');
function markBar(b) {
  barLeds.forEach((l, i) => l.classList.toggle('lit', b >= 0 && b % barLeds.length === i));
  const now = b >= 0 && source === 'steps' ? b % pageCount : -1;
  document.querySelectorAll('[data-page]').forEach((x) => x.classList.toggle('now', Number(x.dataset.page) === now));
}
function onEvent(ev) {
  if (ev.type === 'rec' || ev.type === 'recData') return recEvent(ev);
  const delay = ctx && ctx.outputLatency ? ctx.outputLatency * 1000 : 0;
  if (ev.type === 'lvl') { if (delay) setTimeout(() => lvmFeed(ev.l), delay); else lvmFeed(ev.l); return; }
  if (ev.type !== 'step' || !playing) return;
  setTimeout(() => {
    if (!playing) return;
    markStep(ev.step); markBar(ev.bar);
    grVu.set(master.comp ? ev.gr : 0);
    duckVu.set(-20 * Math.log10(Math.max(ev.duck, 0.001)));
    for (const t of ev.hits) { flash(voicesEl.children[t]); if (t === track) flash(pad); }
  }, delay);
}

// ---- about ----
const aboutDlg = $('about');
$('about-open').addEventListener('click', () => aboutDlg.showModal());
$('about-close').addEventListener('click', () => aboutDlg.close());
aboutDlg.addEventListener('click', (e) => { if (e.target === aboutDlg) aboutDlg.close(); }); // a click on the backdrop

// ---- source viewer ----
const code = $('code'), pick = $('src-pick');
const showSrc = () => { code.textContent = SOURCES[pick.value]; };
pick.addEventListener('change', showSrc);
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(SOURCES[pick.value]); $('copy').textContent = 'COPIED'; }
  catch { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copy').textContent = 'SELECTED'; }
  setTimeout(() => { $('copy').textContent = 'COPY'; }, 1500);
});
showSrc();
setView('perform');

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawScope);
new MutationObserver(drawScope).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

buildKnobs();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawScope); else drawScope();
drawScope();
