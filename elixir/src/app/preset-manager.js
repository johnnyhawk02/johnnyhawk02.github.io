// ---- preset manager: load, favourite, delete; export favourites to bake them into a release ----
const pm = $('pm');
function drawManager() {
  const list = $('pm-list'); list.innerHTML = '';
  const cur = kitList[Number(kitSel.value)];
  const group = (label) => { const li = document.createElement('li'); li.className = 'group'; li.textContent = label; list.appendChild(li); };
  const row = (k) => {
    const li = document.createElement('li'); if (k === cur) li.className = 'current';
    const sub = k.song ? `${k.song.tempo} bpm` : 'sound only';
    li.innerHTML = `<span></span><button class="pm-name" type="button"></button><span class="pm-sub">${sub}</span><span></span>`;
    li.querySelector('.pm-name').textContent = k.name;
    li.querySelector('.pm-name').addEventListener('click', async () => { await startAudio(); loadPreset(k); drawManager(); });
    if (k.saved) {
      const f = document.createElement('button'); f.className = 'fav'; f.type = 'button'; f.textContent = '★';
      f.setAttribute('aria-pressed', !!k.fav); f.setAttribute('aria-label', `Favourite ${k.name}`);
      f.addEventListener('click', () => { k.fav = !k.fav; storePresets(); f.setAttribute('aria-pressed', k.fav); });
      li.firstChild.replaceWith(f);
      const d = document.createElement('button'); d.className = 'btn ghost pm-del'; d.type = 'button'; d.textContent = 'delete';
      d.addEventListener('click', () => {
        if (!confirm(`Delete ${k.name}?`)) return;
        const wasCur = k === kitList[Number(kitSel.value)];
        kitList.splice(kitList.indexOf(k), 1); storePresets(); fillKits();
        kitSel.value = wasCur ? 0 : kitList.indexOf(cur);
        drawManager();
      });
      li.lastChild.replaceWith(d);
    }
    list.appendChild(li);
  };
  const mine = kitList.filter((k) => k.saved);
  group('mine');
  if (mine.length) mine.forEach(row);
  else { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'None yet: save makes one.'; list.appendChild(li); }
  group('built in');
  kitList.filter((k) => k.builtin).forEach(row);
}
$('pm-open').addEventListener('click', () => { drawManager(); $('pm-msg').textContent = ''; pm.showModal(); });
$('pm-close').addEventListener('click', () => pm.close());
pm.addEventListener('click', (e) => { if (e.target === pm) pm.close(); }); // a click on the backdrop
$('pm-export').addEventListener('click', () => {
  const favs = kitList.filter((k) => k.saved && k.fav).map(presetData);
  if (!favs.length) { $('pm-msg').textContent = 'star some presets first'; return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ elixir: 1, presets: favs }, null, 1)], { type: 'application/json' }));
  a.download = 'elixir-favourites.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('pm-msg').textContent = `exported ${favs.length}`;
});
$('pm-import').addEventListener('change', async (e) => {
  let n = 0;
  for (const f of e.target.files) {
    try {
      const data = JSON.parse(await f.text());
      for (const p of data.presets || []) {
        if (!p.kit || kitList.some((k) => k.saved && k.name === p.name)) continue;
        kitList.push(fromStored(p, { saved: true })); n++;
      }
    } catch (err) { $('pm-msg').textContent = `${f.name}: not a presets file`; }
  }
  e.target.value = '';
  if (n) { const v = kitSel.value; storePresets(); fillKits(); kitSel.value = v; drawManager(); $('pm-msg').textContent = `imported ${n}`; }
});
// .SND: 8-character name, then one byte per sound parameter (crossfeed isn't part of the format)
$('kit-export').addEventListener('click', () => {
  const k = kitList[Number(kitSel.value)];
  const name = (k ? k.name : 'Elixir').replace(/[^\x20-\x7e]/g, '').slice(0, 8).padEnd(8, ' ');
  const bytes = new Uint8Array(8 + PAR.END_OF_SOUND_PARAMETERS);
  for (let i = 0; i < 8; i++) bytes[i] = name.charCodeAt(i);
  bytes.set(values.subarray(0, PAR.END_OF_SOUND_PARAMETERS), 8);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  a.download = name.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_') + '.SND';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('kit-file').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  let last = null;
  for (const f of files) {
    try {
      last = parseSnd(new Uint8Array(await f.arrayBuffer()));
    } catch (err) { kitNote(`${f.name}: ${err.message}`); }
  }
  e.target.value = '';
  // an opened kit replaces the sound (pattern and the rest stay); save makes it a preset
  if (last) { pm.close(); useKit(last); setDirty(true); kitNote(`opened ${last.name}`); }
});
// TEMP: delete-all-user-presets — remove when factory presets are done
// (elexir-presets-v2 holds only the presets saved here; the built-in ones are baked into the page)
{
  const btn = $('pm-del-all');
  const sync = () => { btn.disabled = !kitList.some((k) => k.saved); };
  $('pm-open').addEventListener('click', sync);
  btn.addEventListener('click', () => {
    const n = kitList.filter((k) => k.saved).length;
    if (!n || !confirm(`Delete all ${n} user preset${n > 1 ? 's' : ''}? Built-in presets are kept. This can't be undone.`)) return;
    const cur = kitList[Number(kitSel.value)];
    for (let i = kitList.length - 1; i >= 0; i--) if (kitList[i].saved) kitList.splice(i, 1);
    storePresets(); fillKits();
    kitSel.value = cur && cur.saved ? 0 : kitList.indexOf(cur);
    drawManager(); sync();
    $('pm-msg').textContent = `Deleted ${n} user preset${n > 1 ? 's' : ''}.`;
  });
}
// END TEMP

