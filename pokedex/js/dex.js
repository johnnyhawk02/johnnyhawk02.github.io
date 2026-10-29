// Field Pokédex · The Pokédex tab: filters, ranked table, field-notes drawer.
"use strict";
const SORTS = [
  ["dex","Pokédex number"],["name","Name"],["total","Base stat total"],
  ["s0","HP"],["s1","Attack"],["s2","Defense"],["s3","Sp. Attack"],["s4","Sp. Defense"],["s5","Speed"],
  ["height","Height"],["weight","Weight"],["bmi","Weight per height"],["exp","Base experience"],["capture","Catch rate"],
  ["happiness","Base friendship"],["gen","Generation"],["rating","My rating"],["updated","Recently noted"]
];
const RANGES = [["total","Total",0,800],["s0","HP",0,255],["s1","Atk",0,255],["s2","Def",0,255],["s3","SpA",0,255],["s4","SpD",0,255],["s5","Spe",0,255],["height","Ht m",0,100],["weight","Wt kg",0,1000],["capture","Catch",0,255]];

const state = {
  q:"", types:new Set(), typeAll:false, gens:new Set(), ability:"", color:"", habitat:"", egg:"", growth:"",
  ranges:{}, leg:false, myth:false, baby:false, notLeg:false, forms:false,
  mNotes:false, mFav:false, mCaught:false, mNotCaught:false, mRating:0,
  sort:"dex", dir:"asc", limit:150, sel:null
};

function val(p, k){
  if (k[0]==="s" && k.length===2) return p.stats[+k[1]];
  if (k==="bmi") return p.height ? p.weight/(p.height*p.height) : null;
  if (k==="rating") return NOTES[p.id]?.rating || 0;
  if (k==="updated") return NOTES[p.id]?.updatedAt || 0;
  return p[k];
}
// ---------- filter + sort ----------
function filtered(){
  const q = state.q.trim().toLowerCase();
  const qn = q.replace(/^#/, "");
  const ab = state.ability.trim().toLowerCase();
  const out = ALL.filter(p => {
    if (!state.forms && p.form) return false;
    if (q){
      const num = /^\d+$/.test(qn) ? +qn : null;
      if (num !== null ? p.dex !== num : !(p.name.toLowerCase().includes(q) || p.genus.toLowerCase().includes(q) || p.abilities.some(a => a[0].toLowerCase().includes(q)) || p.types.some(t=>t.toLowerCase()===q) || p.flavor.toLowerCase().includes(q) || (NOTES[p.id]?.note||"").toLowerCase().includes(q))) return false;
    }
    if (state.types.size){
      const hit = [...state.types].filter(t => p.types.includes(t)).length;
      if (state.typeAll ? hit < state.types.size : hit === 0) return false;
    }
    if (state.gens.size && !state.gens.has(p.gen)) return false;
    if (ab && !p.abilities.some(a => a[0].toLowerCase() === ab || (ab.length>2 && a[0].toLowerCase().includes(ab)))) return false;
    if (state.color && p.color !== state.color) return false;
    if (state.habitat && p.habitat !== state.habitat) return false;
    if (state.egg && !p.eggs.includes(state.egg)) return false;
    if (state.growth && p.growth !== state.growth) return false;
    for (const k in state.ranges){
      const [lo, hi] = state.ranges[k], v = val(p, k);
      if (lo !== null && (v == null || v < lo)) return false;
      if (hi !== null && (v == null || v > hi)) return false;
    }
    if (state.leg || state.myth || state.baby){
      if (!((state.leg && p.legendary) || (state.myth && p.mythical) || (state.baby && p.baby))) return false;
    }
    if (state.notLeg && (p.legendary || p.mythical)) return false;
    const n = NOTES[p.id];
    if (state.mNotes && !n?.note) return false;
    if (state.mFav && !n?.fav) return false;
    if (state.mCaught && !n?.caught) return false;
    if (state.mNotCaught && n?.caught) return false;
    if (state.mRating && (n?.rating||0) < state.mRating) return false;
    return true;
  });
  const k = state.sort, d = state.dir === "asc" ? 1 : -1;
  out.sort((a,b) => {
    let va = val(a,k), vb = val(b,k);
    if (k === "name") return d * a.name.localeCompare(b.name);
    if (va == null) return 1; if (vb == null) return -1;
    return (va - vb) * d || a.dex - b.dex || a.id - b.id;
  });
  return out;
}

// ---------- render ----------
const COLS = [
  ["rank","#",null,"rank"],["",""],["name","Pokémon","l"],["types","Type","l hide-sm",null,true],
  ["total","Total","tot"],["s0","HP","hide-sm"],["s1","Atk","hide-sm"],["s2","Def","hide-sm"],["s3","SpA","hide-sm hide-md"],["s4","SpD","hide-sm hide-md"],["s5","Spe","hide-sm"],
  ["height","Ht","hide-sm hide-md"],["weight","Wt","hide-sm hide-md"],["marks","Mine","l",null,true]
];
function renderHead(){
  $("thead").innerHTML = COLS.map(([k,label,cls]) => {
    const sortable = k && k!=="rank" && k!=="types" && k!=="marks";
    const s = state.sort===k ? ` aria-sort="${state.dir==="asc"?"ascending":"descending"}"` : "";
    return `<th class="${cls||""}" ${sortable?`data-k="${k}"`:""}${s} scope="col">${label}</th>`;
  }).join("");
}
let lastList = [];
function render(){
  if (!ALL.length) return;
  const list = filtered(); lastList = list;
  const nf = (state.q?1:0)+state.types.size+state.gens.size+(state.ability?1:0)+["color","habitat","egg","growth"].filter(k=>state[k]).length+Object.keys(state.ranges).length+["leg","myth","baby","notLeg","forms","mNotes","mFav","mCaught","mNotCaught"].filter(k=>state[k]).length+(state.mRating?1:0);
  $("fcount").textContent = nf; $("fcount").classList.toggle("on", nf>0);
  renderHead();
  $("count").textContent = list.length.toLocaleString();
  $("avg").textContent = list.length ? Math.round(list.reduce((s,p)=>s+p.total,0)/list.length) : "–";
  $("caughtN").textContent = caughtCount();
  $("sortBy").value = state.sort;
  $("sortDir").textContent = state.sort==="name" ? (state.dir==="asc"?"A → Z":"Z → A") : (state.dir==="desc" ? "High → low" : "Low → high");
  const rows = list.slice(0, state.limit).map((p,i) => {
    const n = NOTES[p.id];
    const marks = n ? `${n.fav?"♥ ":""}${n.rating?"★".repeat(n.rating):""}${n.caught?' <span title="Caught">◉</span>':""}${n.note?' <span class="n" title="Has note">✎</span>':""}` : "";
    const img = SPRITES[p.id] ? `<img class="sprite" alt="" loading="lazy" src="${SPRITES[p.id]}">` : "";
    return `<tr data-id="${p.id}" class="${state.sel===p.id?"sel":""}" tabindex="0">
      <td class="rank">${i+1}</td><td>${img}</td>
      <td class="l pname">${esc(p.name)}<small>#${String(p.dex).padStart(4,"0")} · Gen ${ROMAN[p.gen]}</small></td>
      <td class="l hide-sm">${typeBadges(p.types)}</td>
      <td class="num tot">${p.total}</td>${p.stats.map((s,i)=>`<td class="num hide-sm${i===3||i===4?" hide-md":""}">${s}</td>`).join("")}
      <td class="num hide-sm hide-md">${p.height}</td><td class="num hide-sm hide-md">${p.weight}</td>
      <td class="l marks">${marks}</td></tr>`;
  }).join("");
  $("tbody").innerHTML = rows || `<tr><td class="empty" colspan="14">No Pokémon match these filters. Try removing one, or press Reset all.</td></tr>`;
  $("more").hidden = list.length <= state.limit;
  $("more").textContent = `Show more (${(list.length - state.limit).toLocaleString()} left)`;
}

function renderDrawer(){
  const p = ALL.find(x => x.id === state.sel); const dr = $("drawer");
  if (!p){ dr.hidden = true; $("scrim").hidden = true; return; }
  const n = NOTES[p.id] || {};
  const idx = lastList.findIndex(x=>x.id===p.id);
  const gender = p.gender < 0 ? "Genderless" : `${(100 - p.gender*12.5).toFixed(1).replace(".0","")}% ♂`;
  dr.innerHTML = `
    <div class="d-head">
      <div class="art">${SPRITES[p.id]?`<img alt="${esc(p.name)} sprite" src="${SPRITES[p.id]}">`:""}</div>
      <div style="min-width:0">
        <div class="no">#${String(p.dex).padStart(4,"0")} · Gen ${ROMAN[p.gen]}${idx>=0?` · rank ${idx+1} by ${esc(SORTS.find(s=>s[0]===state.sort)[1].toLowerCase())}`:""}</div>
        <h2>${esc(p.name)}</h2>
        <div>${typeBadges(p.types)}</div>
        <div class="sub" style="margin-top:4px">${esc(p.genus)}</div>
      </div>
      <button class="close" id="close" aria-label="Close">×</button>
    </div>
    ${p.flavor?`<p class="flavor">${esc(p.flavor)}</p>`:""}
    <section class="notes">
      <h3 class="sec-t" style="margin:0">My field notes</h3>
      <div class="notes-row">
        <div class="stars" role="group" aria-label="My rating">${[1,2,3,4,5].map(i=>`<button data-star="${i}" class="${(n.rating||0)>=i?"on":""}" aria-label="${i} star${i>1?"s":""}">★</button>`).join("")}</div>
        <button class="pill" id="favBtn" aria-pressed="${!!n.fav}">♥ Favourite</button>
        <button class="pill" id="caughtBtn" aria-pressed="${!!n.caught}">◉ Caught</button>
      </div>
      <label for="noteText" class="sr" hidden>Note</label>
      <textarea id="noteText" placeholder="Where you found it, nickname, moveset ideas, team plans…">${esc(n.note||"")}</textarea>
      <div class="notes-row"><span class="sub">${mode==="db"?"Synced to your account":"Saved in this browser"}</span><span class="saved">${n.updatedAt?"Last saved "+new Date(n.updatedAt).toLocaleString():""}</span></div>
    </section>
    <section>
      <h3 class="sec-t">Base stats · total ${p.total}</h3>
      <div class="statbars">${p.stats.map((s,i)=>`<span>${STAT_NAMES[i]}</span><span style="text-align:right">${s}</span><div class="bar"><i style="width:${Math.min(100,s/255*100)}%;background:${STAT_COLORS[i]}"></i></div>`).join("")}</div>
    </section>
    <section>
      <h3 class="sec-t">Profile</h3>
      <dl class="facts">
        <div><dt>Abilities</dt><dd>${p.abilities.map(a=>esc(a[0])+(a[1]?' <span class="sub">(hidden)</span>':"")).join("<br>")}</dd></div>
        <div><dt>Height / weight</dt><dd>${p.height} m · ${p.weight} kg</dd></div>
        <div><dt>Evolves from</dt><dd>${esc(p.evolvesFrom||"None")}</dd></div>
        <div><dt>Egg groups</dt><dd>${esc(p.eggs.join(", ")||"–")}</dd></div>
        <div><dt>Catch rate</dt><dd>${p.capture ?? "–"} / 255</dd></div>
        <div><dt>Base friendship</dt><dd>${p.happiness ?? "–"}</dd></div>
        <div><dt>Base experience</dt><dd>${p.exp ?? "–"}</dd></div>
        <div><dt>Growth rate</dt><dd>${esc(p.growth||"–")}</dd></div>
        <div><dt>Gender</dt><dd>${gender}</dd></div>
        <div><dt>Colour · habitat</dt><dd>${esc(p.color||"–")} · ${esc(p.habitat||"Unknown")}</dd></div>
        <div><dt>Status</dt><dd>${[p.legendary&&"Legendary",p.mythical&&"Mythical",p.baby&&"Baby",p.form&&"Alternate form"].filter(Boolean).join(", ")||"Standard"}</dd></div>
      </dl>
    </section>
    <div class="notes-row"><button class="btn" id="prevP">← Previous</button><button class="btn" id="nextP">Next →</button></div>`;
  dr.hidden = false; $("scrim").hidden = false;
  const t = $("noteText"); let timer;
  t.addEventListener("input", () => {
    NOTES[p.id] = {...(NOTES[p.id]||{}), note:t.value};
    showSaved("Typing…"); clearTimeout(timer); timer = setTimeout(()=>writeNote(p.id), 700);
  });
  t.addEventListener("blur", () => { if (timer){ clearTimeout(timer); timer=null; writeNote(p.id); } });
  dr.querySelectorAll("[data-star]").forEach(b => b.onclick = () => {
    const v = +b.dataset.star; const cur = NOTES[p.id]?.rating || 0;
    NOTES[p.id] = {...(NOTES[p.id]||{}), note:t.value, rating: cur===v?0:v};
    dr.querySelectorAll("[data-star]").forEach(x => x.classList.toggle("on", +x.dataset.star <= NOTES[p.id].rating));
    writeNote(p.id);
  });
  const flip = (id, key) => $(id).onclick = () => {
    NOTES[p.id] = {...(NOTES[p.id]||{}), note:t.value, [key]: !NOTES[p.id]?.[key]};
    $(id).setAttribute("aria-pressed", String(!!NOTES[p.id][key])); writeNote(p.id);
  };
  flip("favBtn","fav"); flip("caughtBtn","caught");
  $("close").onclick = closeDrawer;
  const step = d => { const i = lastList.findIndex(x=>x.id===p.id); const nx = lastList[i+d]; if (nx){ state.sel = nx.id; renderDrawer(); render(); } };
  $("prevP").onclick = () => step(-1); $("nextP").onclick = () => step(1);
}
function openP(id){ state.sel = id; renderDrawer(); render(); }
function closeDrawer(){ const t = $("noteText"); if (t) t.blur(); state.sel = null; renderDrawer(); render(); }

// ---------- controls ----------
function buildControls(){
  const uniq = f => [...new Set(ALL.flatMap(f).filter(Boolean))].sort();
  $("types").innerHTML = TYPES.map(t=>`<button class="chip type" style="--tc:${tc(t)}" data-t="${t}" aria-pressed="false">${t}</button>`).join("");
  $("gens").innerHTML = ROMAN.slice(1).map((r,i)=>`<button class="chip" data-g="${i+1}" aria-pressed="false">${r}</button>`).join("");
  $("abilityList").innerHTML = uniq(p=>p.abilities.map(a=>a[0])).map(a=>`<option value="${esc(a)}">`).join("");
  const sel = (id, opts, any) => $(id).innerHTML = `<option value="">${any}</option>` + opts.map(o=>`<option>${esc(o)}</option>`).join("");
  sel("color", uniq(p=>[p.color]), "Any colour"); sel("habitat", uniq(p=>[p.habitat]), "Any habitat");
  sel("egg", uniq(p=>p.eggs), "Any egg group"); sel("growth", uniq(p=>[p.growth]), "Any growth rate");
  $("sortBy").innerHTML = SORTS.map(([k,l])=>`<option value="${k}">${l}</option>`).join("");
  $("ranges").innerHTML = RANGES.map(([k,l,lo,hi])=>`<span>${l}</span><input id="rmin-${k}" type="number" inputmode="decimal" min="${lo}" max="${hi}" placeholder="${lo}" aria-label="${l} minimum"><input id="rmax-${k}" type="number" inputmode="decimal" min="${lo}" max="${hi}" placeholder="${hi}" aria-label="${l} maximum">`).join("");

  const go = () => { state.limit = 150; render(); };
  $("q").addEventListener("input", e => { state.q = e.target.value; go(); });
  $("ability").addEventListener("input", e => { state.ability = e.target.value; go(); });
  ["color","habitat","egg","growth"].forEach(k => $(k).addEventListener("change", e => { state[k] = e.target.value; go(); }));
  $("types").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; const t=b.dataset.t;
    state.types.has(t) ? state.types.delete(t) : state.types.add(t); b.setAttribute("aria-pressed", state.types.has(t)); go(); });
  $("gens").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (!b) return; const g=+b.dataset.g;
    state.gens.has(g) ? state.gens.delete(g) : state.gens.add(g); b.setAttribute("aria-pressed", state.gens.has(g)); go(); });
  const setTA = all => { state.typeAll = all; $("tAny").setAttribute("aria-pressed", !all); $("tAll").setAttribute("aria-pressed", all); go(); };
  $("tAny").onclick = () => setTA(false); $("tAll").onclick = () => setTA(true);
  $("ranges").addEventListener("input", () => {
    state.ranges = {};
    RANGES.forEach(([k]) => { const a=$("rmin-"+k).value, b=$("rmax-"+k).value;
      if (a!=="" || b!=="") state.ranges[k] = [a===""?null:+a, b===""?null:+b]; });
    go();
  });
  const ck = {fLeg:"leg",fMyth:"myth",fBaby:"baby",fNotLeg:"notLeg",fForms:"forms",mNotes:"mNotes",mFav:"mFav",mCaught:"mCaught",mNotCaught:"mNotCaught"};
  Object.entries(ck).forEach(([id,k]) => $(id).addEventListener("change", e => { state[k] = e.target.checked; go(); }));
  $("mRating").addEventListener("change", e => { state.mRating = +e.target.value; go(); });
  const defDir = k => (k==="dex"||k==="name"||k==="gen") ? "asc" : "desc";
  $("sortBy").addEventListener("change", e => { state.sort = e.target.value; state.dir = defDir(state.sort); go(); });
  $("sortDir").onclick = () => { state.dir = state.dir==="asc"?"desc":"asc"; go(); };
  $("thead").addEventListener("click", e => { const th = e.target.closest("[data-k]"); if (!th) return; const k = th.dataset.k;
    if (state.sort === k) state.dir = state.dir==="asc"?"desc":"asc"; else { state.sort = k; state.dir = defDir(k); } go(); });
  $("tbody").addEventListener("click", e => { const tr = e.target.closest("tr[data-id]"); if (tr) openP(+tr.dataset.id); });
  $("tbody").addEventListener("keydown", e => { if (e.key==="Enter"){ const tr = e.target.closest("tr[data-id]"); if (tr) openP(+tr.dataset.id); } });
  $("more").onclick = () => { state.limit += 300; render(); };
  $("scrim").onclick = closeDrawer;
  document.addEventListener("keydown", e => { if (e.key==="Escape" && state.sel) closeDrawer(); });
  $("toggleRail").onclick = () => { const r=$("rail"); const c = r.classList.toggle("closed"); $("toggleRail").textContent = c?"Show":"Hide"; $("toggleRail").setAttribute("aria-expanded", !c); };
  if (matchMedia("(max-width:860px)").matches) $("toggleRail").click();
  $("reset").onclick = () => {
    Object.assign(state, {q:"",typeAll:false,ability:"",color:"",habitat:"",egg:"",growth:"",ranges:{},leg:false,myth:false,baby:false,notLeg:false,forms:false,mNotes:false,mFav:false,mCaught:false,mNotCaught:false,mRating:0,limit:150});
    state.types.clear(); state.gens.clear();
    document.querySelectorAll("#rail input").forEach(i => i.type==="checkbox" ? i.checked=false : i.value="");
    document.querySelectorAll("#rail select").forEach(s => s.selectedIndex = 0);
    document.querySelectorAll("#rail .chip").forEach(c => c.setAttribute("aria-pressed","false"));
    setTA(false);
  };
}
