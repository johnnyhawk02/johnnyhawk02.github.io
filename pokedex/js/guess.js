// Field Pokédex · Guess my Pokémon: an Akinator-style game with kid-friendly questions.
"use strict";
// ---------- guessing game ----------
const GAMES = ["","Red & Blue","Gold & Silver","Ruby & Sapphire","Diamond & Pearl","Black & White","X & Y","Sun & Moon","Sword & Shield","Scarlet & Violet"];
const SWATCH = {Red:"#e0393e",Orange:"#f5862a",Yellow:"#f2cf2a",Green:"#45a849",Blue:"#3b7de0",Purple:"#8d55c6",Pink:"#f28dbb",Brown:"#9a6a3a",Black:"#2b2b2b",White:"#f7f7f7",Gray:"#9aa0a8"};
const SIZES = [["Tiny","Smaller than a cat",0,0.5],["Medium","About as tall as a kid",0.5,1.3],["Big","Taller than a grown-up",1.3,2.5],["Giant","Bigger than a car or a house",2.5,1e9]];
const G = { pool:[], w:null, asked:new Set(), history:[], trail:[], q:null, guess:null, wrong:new Set(), n:0, done:false, forms:false, firstType:null };
let QUESTIONS = [];
// A question is either yes/no ({f}) or picture choices ({options:[{label, f, near?}]}).
function buildQuestions(){
  const evolvesInto = new Set(ALL.filter(p=>p.evolvesFrom).map(p=>p.evolvesFrom));
  const base = n => n.replace(/ \(.*\)$/, "");
  const Q = [];
  const yn = (key, text, f, pen=1, hint="") => Q.push({key, text, f, pen, hint});
  const ch = (key, text, options, pen=1, hint="", miss=0.05) => Q.push({key, text, options, pen, hint, miss});
  ch("color", "What colour is it?", Object.keys(SWATCH).map(c => ({label:c, swatch:SWATCH[c], f:p => p.color === c || (p.cols||[]).includes(c)})), 1.15, "Pick the colour you see the most.", 0.12);
  ch("type", "What type is it?", TYPES.map(t => ({label:t, type:t, f:p => p.types.includes(t)})), 1.15, "If it has two types, pick either one.");
  ch("size", "How big is it?", SIZES.map(([l,h,lo,hi],i) => ({label:l, sub:h, f:p => p.height >= lo && p.height < hi, idx:i})), 0.9, "", 0.08);
  ch("game", "Which games did it first appear in?", GAMES.slice(1).map((g,i) => ({label:"Pokémon "+g, f:p => p.gen === i+1, idx:i})), 0.55, "Tap Not sure if you don't know.");
  yn("dual", "Does it have two types?", p => p.types.length === 2, 0.9);
  yn("legmyth", "Is it a Legendary Pokémon?", p => p.legendary || p.mythical, 1, "Legendary Pokémon are super rare and powerful, like Mewtwo.");
  yn("baby", "Is it a baby Pokémon, like Pichu or Togepi?", p => p.baby);
  yn("evfrom", "Did it evolve from a smaller Pokémon?", p => !!p.evolvesFrom, 1, "Like how Charmeleon evolved from Charmander.");
  yn("evinto", "Can it still evolve into something bigger?", p => evolvesInto.has(base(p.name)), 1, "Like how Pikachu can evolve into Raichu.");
  yn("fast", "Is it super fast?", p => p.stats[5] >= 100, 0.6);
  yn("heavy", "Is it really heavy, heavier than a grown-up?", p => p.weight > 80, 0.6);
  yn("light", "Is it really light, light enough to pick up easily?", p => p.weight < 10, 0.6);
  yn("genderless", "Is it a robot, a ghost or an object, with no boys or girls?", p => p.gender === -1, 0.6);
  yn("mega", "Is it a Mega Evolution?", p => /\(Mega/.test(p.name));
  yn("regional", "Is it a special regional form, like Alolan Vulpix?", p => /\((Alola|Galar|Hisui|Paldea)/.test(p.name));
  [["A–F",/^[a-f]/i],["A–L",/^[a-l]/i],["A–R",/^[a-r]/i]].forEach(([r,re]) => yn("abc:"+r, `Does its name start with a letter from ${r}?`, p => re.test(p.name), 0.55));
  QUESTIONS = Q;
}
function type2Question(t){
  return {key:"type2", text:`Does it have another type as well as ${t}?`, hint:"Pick the second type, or tap Just one type.", pen:1.1, miss:0.05,
    options:[{label:"Just one type", f:p => p.types.length === 1}, ...TYPES.filter(x=>x!==t).map(x => ({label:x, type:x, f:p => p.types.includes(x)}))]};
}
function gStart(){
  G.pool = ALL.filter(p => G.forms || !p.form);
  G.w = new Float64Array(G.pool.length).fill(1);
  G.asked = new Set(); G.history = []; G.trail = []; G.wrong = new Set(); G.n = 0; G.done = false; G.guess = null; G.firstType = null;
  gNext();
}
function gMass(){ let s=0; for (const x of G.w) s+=x; return s; }
function gRanked(){ const tot = gMass(); return G.pool.map((p,i)=>({p, s:G.w[i]/tot})).sort((a,b)=>b.s-a.s); }
// Expected information of a question: entropy of how the remaining weight splits across its answers.
function gScore(q, tot){
  const fs = q.options ? q.options.map(o=>o.f) : [q.f];
  const mass = new Array(q.options ? fs.length : 2).fill(0);
  G.pool.forEach((p,i) => { const w = G.w[i]; if (!w) return;
    if (!q.options) mass[q.f(p)?0:1] += w;
    else fs.forEach((f,j) => { if (f(p)) mass[j] += w; }); });
  let h = 0; mass.forEach(m => { const x = Math.min(1, m/tot); if (x>0 && x<1) h -= x*Math.log2(x); });
  return Math.min(h, 2.2) * q.pen;   // cap so a huge picker doesn't always win over a simple yes/no
}
function gNext(){
  const ranked = gRanked(), top = ranked[0];
  const live = ranked.filter(r => r.s >= top.s * 0.02).length;
  let best = null, bestScore = 0;
  if (!(top.s >= 0.8 && G.n >= 3)) {
    const tot = gMass();
    const pool = QUESTIONS.filter(q => !G.asked.has(q.key));
    if (G.firstType && !G.asked.has("type2")) pool.push(type2Question(G.firstType));
    for (const q of pool){ const sc = gScore(q, tot); if (sc > bestScore){ bestScore = sc; best = q; } }
  }
  if (!best || bestScore < 0.08 || top.s >= 0.8 && G.n >= 3 || G.n >= 30 || live <= 1) { G.q = null; G.guess = top.p; }
  else { G.q = best; G.guess = null; }
  renderGame();
}
function gSnap(){ G.history.push({w:G.w.slice(), asked:new Set(G.asked), n:G.n, trail:G.trail.length, wrong:new Set(G.wrong), firstType:G.firstType}); }
// answer: for yes/no 0 = yes, 1 = no; for choices the option index; -1 = not sure
function gAnswer(a){
  const q = G.q; gSnap();
  G.asked.add(q.key); G.n++;
  if (a === -1){ G.trail.push([q.text, "Not sure"]); gNext(); return; }
  if (!q.options){
    G.trail.push([q.text, a===0?"Yes":"No"]);
    G.pool.forEach((p,i) => { if (q.f(p) !== (a===0)) G.w[i] *= 0.05; });
  } else {
    const o = q.options[a];
    G.trail.push([q.text, o.label]);
    if (q.key === "type") G.firstType = o.type;
    G.pool.forEach((p,i) => {
      if (o.f(p)) return;
      // a neighbouring size or game is a smaller mistake
      const near = o.idx !== undefined && q.options.some(x => x.idx !== undefined && Math.abs(x.idx - o.idx) === 1 && x.f(p));
      G.w[i] *= near ? 0.35 : q.miss;
    });
  }
  gNext();
}
function gWrong(){
  const i = G.pool.indexOf(G.guess); gSnap();
  G.wrong.add(G.guess.id); G.trail.push([`Is it ${G.guess.name}?`, "No"]); G.w[i] = 0;
  if (gMass() === 0 || G.wrong.size >= 5){ G.done = "lost"; G.q = null; renderGame(); return; }
  G.n = Math.min(G.n, 26); gNext();
}
function gUndo(){
  const h = G.history.pop(); if (!h) return;
  G.w = h.w; G.asked = h.asked; G.n = h.n; G.trail.length = h.trail; G.wrong = h.wrong; G.firstType = h.firstType; G.done = false; gNext();
}
function renderGame(){
  const scr = $("gScreen"), ans = $("gAnswers");
  const ranked = gRanked();
  const conf = Math.round(ranked[0].s*100);
  const tools = `<div class="gtools"><button class="btn" id="gBack" ${G.history.length?"":"disabled"}>↩ Undo</button><button class="btn" id="gAgain">Start again</button></div>`;
    if (G.done === "win"){
    const p = G.guess;
    scr.innerHTML = `<div class="qn">Got it in ${G.n} question${G.n===1?"":"s"}!</div><div class="guess">${spriteImg(p.id)}<p class="qt">It was ${esc(p.name)}!</p></div>`;
    ans.innerHTML = `<div class="gtools"><button class="btn primary big" id="gAgain">Play again</button><button class="btn big" id="gOpen">See its Pokédex page</button></div>`;
    $("gOpen").onclick = () => { setTab("dex"); openP(p.id); };
  } else if (G.done === "lost"){
    scr.innerHTML = `<div class="qn">You win!</div><p class="qt">You stumped me! Who was it?</p><div class="hint">Look at your answers below. If one was a little off, tap Undo and try a different answer.</div>`;
    ans.innerHTML = `<div class="gtools"><button class="btn primary big" id="gAgain">Play again</button><button class="btn big" id="gBack">↩ Undo</button></div>`;
  } else if (G.guess){
    const p = G.guess;
    scr.innerHTML = `<div class="qn">I think I know!</div><div class="guess">${spriteImg(p.id)}<div><p class="qt">Is it ${esc(p.name)}?</p></div></div>`;
    ans.innerHTML = `<div class="yn"><button class="ans yes" id="gRight">Yes!</button><button class="ans no" id="gNope">No</button></div>${tools}`;
    $("gRight").onclick = () => { G.done = "win"; G.trail.push([`Is it ${p.name}?`, "Yes"]); renderGame(); };
    $("gNope").onclick = gWrong;
  } else {
    const q = G.q;
    scr.innerHTML = `${G.n===0?`<div class="hint">Think of any Pokémon. Don't tell me! Answer my questions and I'll guess it.</div>`:""}<div class="qn">Question ${G.n+1}</div><p class="qt">${esc(q.text)}</p>${q.hint?`<div class="hint">${esc(q.hint)}</div>`:""}`;
    if (!q.options){
      ans.innerHTML = `<div class="yn"><button class="ans yes" data-a="0">Yes</button><button class="ans no" data-a="1">No</button><button class="ans" data-a="-1">Not sure</button></div>${tools}`;
    } else {
      ans.innerHTML = `<div class="opts ${q.options.length>8?"many":""}">${q.options.map((o,i) => {
        const deco = o.swatch ? `<i class="sw" style="background:${o.swatch}"></i>` : o.type ? `<i class="sw" style="background:${tc(o.type)}"></i>` : "";
        return `<button class="opt" data-a="${i}">${deco}<span>${esc(o.label)}${o.sub?`<small>${esc(o.sub)}</small>`:""}</span></button>`;
      }).join("")}<button class="opt unsure" data-a="-1"><span>Not sure</span></button></div>${tools}`;
    }
    ans.querySelectorAll("[data-a]").forEach(b => b.onclick = () => gAnswer(+b.dataset.a));
  }
  if ($("gBack")) $("gBack").onclick = gUndo;
  $("gAgain").onclick = gStart;
  $("gTrail").hidden = !G.trail.length;
  $("gTrailList").innerHTML = G.trail.map(([q,a]) => `<li>${esc(q)} <b>${esc(a)}</b></li>`).join("");
  $("gMind").innerHTML = ranked.slice(0,6).map(r => `<div class="row">${spriteImg(r.p.id) || "<span></span>"}<span>${esc(r.p.name)}</span><span class="pct">${(r.s*100).toFixed(r.s<0.1?1:0)}%</span><div class="bar"><i style="width:${r.s*100}%"></i></div></div>`).join("");
  $("gLeft").textContent = `${ranked.filter(r=>r.s>=ranked[0].s*0.1).length.toLocaleString()} Pokémon still in the running`;
}
function buildGuess(){
  $("gPeek").onchange = e => $("gMind").classList.toggle("blur", !e.target.checked);
  $("gForms").onchange = e => { G.forms = e.target.checked; gStart(); };
}
