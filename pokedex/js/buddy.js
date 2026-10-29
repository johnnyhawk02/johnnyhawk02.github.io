// Field Pokédex · Buddy: choose a partner Pokémon, look after it and help it evolve.
"use strict";
// ---------- buddy: raise a partner Pokémon ----------
const BD_KEY = "pokedex-buddy-v1";
const STARTERS = [25,133,1,4,7,152,155,158,252,255,258,387,390,393,495,498,501,650,653,656,722,725,728,810,813,816,906,909,912,39,52,54,172,175,216,447];
const FOODS = { oran:["Oran Berry","+25 full",{food:25}], sitrus:["Sitrus Berry","+40 full",{food:40,happy:2}], puff:["Poké Puff","a sweet treat",{food:10,happy:12}] };
let BUDDY = null, bdPick = null, bdToyTimer = null;
const bdSave = makeSaver("buddy", BD_KEY, () => BUDDY);
function bdLoadLocal(){ try { const b = JSON.parse(localStorage.getItem(BD_KEY) || "null"); if (b && b.id) BUDDY = b; } catch {} }
function bdFromSnap(b){ if (b && b.id){ BUDDY = b; renderBuddy(); renderBattleBuddy(); } }
const buddyMon = () => BUDDY ? ALL.find(p => p.id === BUDDY.id) : null;
const bdNeed = lv => 30 + (lv-1)*15;
// stats drift with real time; we only write when the player does something
function bdNow(){
  if (!BUDDY) return null;
  const mins = Math.max(0, (Date.now() - (BUDDY.last || Date.now())) / 60000);
  return { happy: clamp(BUDDY.happy - mins*0.2), food: clamp(BUDDY.food - mins*0.33),
           energy: clamp(BUDDY.energy + (BUDDY.asleep ? mins*2 : -mins*0.15)) };
}
function bdCommit(delta){
  const n = bdNow();
  for (const k of ["happy", "food", "energy"]) BUDDY[k] = clamp(n[k] + (delta[k] || 0));
  BUDDY.last = Date.now();
}
function evoStage(p){ let s = 1, cur = p; while (cur && cur.evolvesFrom){ s++; cur = ALL.find(x => !x.form && x.name === cur.evolvesFrom); } return s; }
function evolutionsOf(p){ return ALL.filter(x => !x.form && x.evolvesFrom === p.name && SPRITES[x.id]); }
function evoReady(){ const p = buddyMon(); if (!p) return []; const opts = evolutionsOf(p); const need = evoStage(p) === 1 ? 6 : 14; return BUDDY.level >= need ? opts : []; }
function buddyGain(xp, love){
  if (!BUDDY) return;
  BUDDY.xp += xp; let up = false;
  while (BUDDY.xp >= bdNeed(BUDDY.level)){ BUDDY.xp -= bdNeed(BUDDY.level); BUDDY.level++; up = true; }
  if (love) bdCommit({happy: love}); else BUDDY.last = BUDDY.last || Date.now();
  bdSave(); renderBuddy();
  if (up){ const ev = evoReady().length ? " It's ready to evolve!" : ""; toast(`${BUDDY.nick} grew to friendship level ${BUDDY.level}!${ev}`); }
}
function say(text){ $("bdSpeech").textContent = text; }
function moodLine(){
  const n = bdNow(), p = buddyMon(), sky = skyState(), nm = BUDDY.nick;
  if (BUDDY.asleep) return sky.day ? `${nm} is having a nap. Shh!` : `${nm} is sleeping under the moon.`;
  if (n.food < 25) return "I'm hungry! Can I have a berry?";
  if (n.energy < 20) return sky.day ? "I'm so sleepy…" : "It's night time. Can we go to sleep?";
  if (n.happy < 30) return "Let's play together!";
  if (!sky.day && Math.random() < 0.5) return "Look at the moon! It's so pretty.";
  return pick([`${p.name}! ${p.name}!`, "I'm happy you're here!", "What shall we do today?", "Let's go for a walk!", "You're the best trainer!"]);
}
function renderBuddy(){
  if (!$("bdMain")) return;
  const has = !!BUDDY && !!buddyMon();
  $("pbWrap").hidden = has; $("bdMain").hidden = !has;
  if (!has){ renderBuddyPicker(); return; }
  const p = buddyMon(), n = bdNow();
  $("bdName").textContent = BUDDY.nick;
  $("bdSpecies").textContent = `${p.name} · ${p.types.join(" / ")} type`;
  $("bdLevel").textContent = "Lv " + BUDDY.level;
  $("bdXp").style.width = Math.min(100, BUDDY.xp / bdNeed(BUDDY.level) * 100) + "%";
  $("bdImg").src = SPRITES[p.id] || ""; $("bdImg").alt = p.name;
  const env = envFor(p.types);
  $("bdField").dataset.env = env; $("bdEnv").dataset.base = ENVS[env];
  const bar = (id, v) => { $(id).style.width = v + "%"; $(id).style.background = meterColor(v, 55); };
  bar("mHappy", n.happy); bar("mFood", n.food); bar("mEnergy", n.energy);
  $("bdPal").classList.toggle("asleep", !!BUDDY.asleep);
  $("bdSleep").innerHTML = BUDDY.asleep ? "<b>Wake up</b><small>Time to play</small>" : "<b>Sleep</b><small>Rest and recharge</small>";
  $("bdActs").querySelectorAll(".act").forEach(b => { if (b.dataset.act !== "sleep" && b.dataset.act !== "pet") b.disabled = !!BUDDY.asleep; });
  const evo = evoReady();
  $("bdEvolve").hidden = !evo.length;
  if (evo.length) $("bdEvolve").innerHTML = `<b style="font:600 20px var(--display)">${esc(BUDDY.nick)} is ready to evolve!</b>
    <div class="opts2">${evo.map(e => `<button data-evo="${e.id}">${spriteImg(e.id)}Evolve into ${esc(e.name)}</button>`).join("")}</div>
    <span class="sub">Or keep playing. You can evolve any time.</span>`;
  applySky();
}
function renderBuddyPicker(){
  const q = $("pbSearch").value.trim().toLowerCase();
  const list = q ? ALL.filter(p => hasArt(p) && p.name.toLowerCase().includes(q)).slice(0, 30) : STARTERS.map(id => ALL.find(p => p.id === id)).filter(Boolean);
  $("pbGrid").innerHTML = list.map(p => `<button data-id="${p.id}" aria-pressed="${bdPick===p.id}">${spriteImg(p.id)}${esc(p.name)}</button>`).join("") || `<span class="sub">No Pokémon with that name.</span>`;
  $("pbConfirm").hidden = !bdPick;
  if (bdPick){ const p = ALL.find(x => x.id === bdPick); $("pbImg").src = SPRITES[p.id] || ""; $("pbNick").placeholder = p.name; }
}
function hearts(n){
  const h = $("bdHearts");
  for (let i = 0; i < n; i++){ const e = document.createElement("i"); e.textContent = "♥"; e.style.left = (25 + Math.random()*50) + "%"; e.style.animationDelay = (i*0.12) + "s"; h.appendChild(e); setTimeout(() => e.remove(), 1600); }
  replay($("bdPal"), "happy");
}
function bdAct(act){
  if (!BUDDY) return;
  const n = bdNow(), nm = BUDDY.nick, p = buddyMon();
  $("bdFeed").hidden = act !== "feed";
  if (act === "pet"){ bdCommit({happy: 6}); hearts(3); say(BUDDY.asleep ? `${nm} smiles in its sleep.` : `${nm} loves that!`); buddyGain(2); return; }
  if (act === "sleep"){ bdCommit({}); BUDDY.asleep = !BUDDY.asleep; say(BUDDY.asleep ? "Goodnight! Zzz…" : "Good morning! I feel great!"); bdSave(); renderBuddy(); return; }
  if (act === "feed"){
    $("bdFeed").innerHTML = Object.entries(FOODS)
      .map(([k,[l,s]]) => `<button class="btn big throwbtn" data-food="${k}"><i class="berry ${k}"></i>${l}<span class="sub">${s}</span></button>`).join("");
    $("bdFeed").querySelectorAll("[data-food]").forEach(b => b.onclick = () => {
      const f = FOODS[b.dataset.food][2];
      if (bdNow().food >= 95 && b.dataset.food !== "puff"){ say(`${nm} is too full to eat any more!`); return; }
      bdCommit(f); hearts(1); say(b.dataset.food === "puff" ? "Yummy! My favourite!" : "Munch munch… thank you!"); buddyGain(3); $("bdFeed").hidden = true;
    });
    say("What shall I eat?"); return;
  }
  if (act === "train"){
    if (n.energy < 15){ say("I'm too tired to train. Can I rest?"); return; }
    if (n.food < 10){ say("I need a snack first!"); return; }
    const mv = MOVES[p.types[0]];
    bdCommit({energy:-15, food:-5, happy:2}); say(`${nm} practised ${mv}! It's getting stronger.`); replay($("bdPal"), "happy"); buddyGain(15); return;
  }
  if (act === "walk"){
    if (n.energy < 10){ say("My legs are tired. Let's rest first."); return; }
    bdCommit({energy:-10, food:-5, happy:4});
    const r = Math.random(); let msg;
    if (r < 0.35){ TR.balls.poke++; msg = `${nm} found a Poké Ball! It's in your battle bag.`; }
    else if (r < 0.55){ TR.items.razz++; msg = `${nm} found a Razz Berry for your battles!`; }
    else if (r < 0.65){ TR.items.focus++; msg = `${nm} learned to focus! You got a Focus power.`; }
    else { const s = pick(ALL.filter(x => hasArt(x) && x.gen === (TR.world || p.gen) && !x.legendary && !x.mythical)); msg = `On your walk, ${nm} saw a wild ${s.name}!`; }
    if (r < 0.65){ trSave(); renderTrainer(); }
    say(msg); buddyGain(8); return;
  }
  if (act === "play"){
    if (n.energy < 15){ say("I'm too sleepy to play right now."); return; }
    startToyGame(); return;
  }
}
function startToyGame(){
  const toy = $("bdToy"); let hits = 0, left = 12;
  $("bdActs").querySelectorAll(".act").forEach(b => b.disabled = true);
  const move = () => { toy.style.left = (15 + Math.random()*70) + "%"; toy.style.top = (20 + Math.random()*55) + "%"; };
  toy.hidden = false; move(); say(`Tap the ball 5 times! ${left}s`);
  toy.onclick = () => { hits++; move(); say(`${hits} / 5! Keep going!`); if (hits >= 5) end(true); };
  clearInterval(bdToyTimer);
  bdToyTimer = setInterval(() => { left--; if (left <= 0) end(false); else if (left % 2 === 0) move(); }, 1000);
  function end(won){
    clearInterval(bdToyTimer); toy.hidden = true; toy.onclick = null;
    if (won){ bdCommit({happy:15, energy:-12, food:-5}); hearts(5); say("That was so much fun! Again!"); buddyGain(12); }
    else { bdCommit({happy:5, energy:-8}); say("That was fun, even if the ball got away!"); buddyGain(4); }
    renderBuddy();
  }
}
function evolveTo(id){
  const from = buddyMon(), to = ALL.find(p => p.id === id); if (!to) return;
  $("bdEvolve").hidden = true; $("bdPal").classList.add("evolving"); say(`What? ${BUDDY.nick} is evolving!`);
  setTimeout(() => {
    const keepNick = BUDDY.nick !== from.name;
    BUDDY.id = to.id; if (!keepNick) BUDDY.nick = to.name; bdCommit({happy:10}); bdSave();
    $("bdPal").classList.remove("evolving"); renderBuddy(); hearts(6);
    say(`Congratulations! ${from.name} evolved into ${to.name}!`);
    showLevelUp("It evolved!", to.name, [`${from.name} evolved into ${to.name}!`, `${to.types.join(" / ")} type`]);
  }, 2400);
}
function enterBuddy(){ renderBuddy(); if (BUDDY && buddyMon()) say(moodLine()); }
function buildBuddy(){
  $("pbSearch").addEventListener("input", renderBuddyPicker);
  $("pbGrid").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (!b) return; bdPick = +b.dataset.id; renderBuddyPicker(); $("pbNick").focus({preventScroll:true}); $("pbConfirm").scrollIntoView({block:"nearest", behavior:"smooth"}); });
  $("pbGo").onclick = () => {
    const p = ALL.find(x => x.id === bdPick); if (!p) return;
    BUDDY = { id:p.id, nick:($("pbNick").value.trim() || p.name).slice(0,16), xp:0, level:1, happy:70, food:70, energy:80, asleep:false, last:Date.now(), since:Date.now() };
    bdPick = null; $("pbNick").value = ""; bdSave(); renderBuddy(); hearts(4); say(`Hi! I'm ${BUDDY.nick}! Let's be best friends!`); renderBattleBuddy();
  };
  $("bdActs").addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b && !b.disabled) bdAct(b.dataset.act); });
  $("bdPal").onclick = () => bdAct("pet");
  $("bdEvolve").addEventListener("click", e => { const b = e.target.closest("[data-evo]"); if (b) evolveTo(+b.dataset.evo); });
  $("bdChange").onclick = () => { $("bdBye").hidden = false; $("bdByeText").textContent = `Say goodbye to ${BUDDY.nick}? Your new buddy starts at level 1.`; };
  $("bdByeNo").onclick = () => { $("bdBye").hidden = true; };
  $("bdByeYes").onclick = () => { BUDDY = null; $("bdBye").hidden = true; bdSave(); renderBuddy(); renderBattleBuddy(); };
  setInterval(() => { if (!$("buddy").hidden && BUDDY) { renderBuddy(); if (Math.random() < 0.15) say(moodLine()); } }, 20000);
}
