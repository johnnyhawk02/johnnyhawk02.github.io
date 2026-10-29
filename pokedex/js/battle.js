// Field Pokédex · Type battles, worlds, trainer levels, Poké Balls and catching.
"use strict";
// ---------- type battle ----------
const CHART="111111111111h011h11hh212111112h1h12112hh1111211121h1111h2h111h2h1h21h1h1112hh111021111h1111hh21h1122111121h12111121h1hhh20122h1112111hh111hh1102121h2112101h2111211112h1211112h111h11111112211h11110h11h1211hh1h211h12hh121112h1h2121111h1011111111121121h111111111111111121h0111111h11121121h1h1hh1h21111112111h21h11112h11111122h1";
const MOVES = {Normal:"Tackle",Fire:"Flamethrower",Water:"Water Gun",Grass:"Vine Whip",Electric:"Thunderbolt",Ice:"Ice Beam",Fighting:"Karate Chop",Poison:"Poison Sting",Ground:"Dig",Flying:"Gust",Psychic:"Confusion",Bug:"Bug Bite",Rock:"Rock Throw",Ghost:"Shadow Ball",Dragon:"Dragon Breath",Dark:"Bite",Steel:"Iron Tail",Fairy:"Moonblast"};
const HINTS = {Normal:"Fighting moves are strong against Normal Pokémon!",Fire:"Water puts out fire! Rocks and ground smother it too.",Water:"Plants soak up water, and electricity zaps it!",Grass:"Fire burns plants, and birds and bugs nibble them!",Electric:"The ground soaks up electricity!",Ice:"Fire melts ice! Rock, fighting and steel smash it.",Fighting:"Flying, psychic and fairy power beat fighters!",Poison:"Dig into the ground, or use psychic power!",Ground:"Water and plants beat the ground. So does ice!",Flying:"Lightning, ice and rocks knock flyers down!",Psychic:"Bugs, ghosts and the dark scare psychics!",Bug:"Fire, birds and rocks beat bugs!",Rock:"Water, plants, fighting, ground and steel break rocks!",Ghost:"Ghosts and the dark beat ghosts!",Dragon:"Ice, fairies and other dragons beat dragons!",Dark:"Fighting, bugs and fairies beat the dark!",Steel:"Fire, fighting and ground beat steel!",Fairy:"Poison and steel beat fairies!"};
const ENVS = {Normal:"Grassy meadow",Fire:"Volcano",Water:"Ocean",Grass:"Sunny meadow",Electric:"Power plant",Ice:"Snowfield",Fighting:"Dojo",Poison:"Swamp",Ground:"Desert",Flying:"Up in the clouds",Psychic:"Dream world",Bug:"Forest",Rock:"Rocky mountain",Ghost:"Haunted night",Dragon:"Dragon peaks",Dark:"Midnight alley",Steel:"Factory",Fairy:"Flower garden"};
const WORLDS = [
  {gen:1,name:"Kanto",games:"Red & Blue",star:25,w1:"#e3262f",w2:"#ff9a5c"},
  {gen:2,name:"Johto",games:"Gold & Silver",star:250,w1:"#c9961a",w2:"#9aa3b5"},
  {gen:3,name:"Hoenn",games:"Ruby & Sapphire",star:384,w1:"#c0392b",w2:"#2e6fd8"},
  {gen:4,name:"Sinnoh",games:"Diamond & Pearl",star:483,w1:"#4a7bd8",w2:"#e48fb8"},
  {gen:5,name:"Unova",games:"Black & White",star:643,w1:"#2b2b38",w2:"#8a93a6"},
  {gen:6,name:"Kalos",games:"X & Y",star:716,w1:"#2f6fd8",w2:"#d6324a"},
  {gen:7,name:"Alola",games:"Sun & Moon",star:722,w1:"#f29a1f",w2:"#7a4bc9"},
  {gen:8,name:"Galar",games:"Sword & Shield",star:888,w1:"#2a9fd8",w2:"#d6326e"},
  {gen:9,name:"Paldea",games:"Scarlet & Violet",star:1007,w1:"#d63a2f",w2:"#7a3fc9"},
  {gen:0,name:"Every world",games:"All 1,025 Pokémon",star:151,w1:"#2fb05f",w2:"#2b8fd8"}];
// Abilities that block a whole type. The foe shows its ability, and kids learn the twist.
const FOE_ABILITIES = {"Levitate":["Ground","floats in the air, so Ground moves can't reach it!"],"Flash Fire":["Fire","soaks up fire and gets even stronger!"],"Water Absorb":["Water","drinks the water and feels better!"],"Storm Drain":["Water","pulls all the water away!"],"Dry Skin":["Water","loves water. It heals it!"],"Volt Absorb":["Electric","soaks up the electricity!"],"Lightning Rod":["Electric","catches the lightning like a lightning rod!"],"Motor Drive":["Electric","zooms faster when zapped!"],"Sap Sipper":["Grass","munches the plants!"],"Earth Eater":["Ground","eats the ground like a snack!"],"Well-Baked Body":["Fire","is baked hard, so fire can't hurt it!"]};
const BALLS = [["poke","Poké Ball",1],["great","Great Ball",1.6],["ultra","Ultra Ball",2.3],["master","Master Ball",99]];
const TITLES = [[1,"Rookie Trainer"],[2,"Bug Catcher"],[3,"Youngster"],[4,"Camper"],[5,"Ace Trainer"],[7,"Gym Challenger"],[9,"Gym Leader"],[12,"Elite Four"],[15,"Champion"],[20,"Pokémon Master"]];
const mult = (atk, defs) => defs.reduce((m,d) => m * ({"0":0,"h":0.5,"1":1,"2":2})[CHART[TYPES.indexOf(atk)*18 + TYPES.indexOf(d)]], 1);
const BT = { level:"easy", round:0, score:0, streak:0, done:false, foe:null, rounds:10, hp:100, legend:false, busy:false, ability:null, razz:false, assisted:false };
const emult = t => (BT.ability && FOE_ABILITIES[BT.ability][0] === t) ? 0 : mult(t, BT.foe.types);

// ----- trainer progress (saved with the notes: db doc "trainer", or browser storage) -----
let TR = { xp:0, level:1, balls:{poke:5, great:0, ultra:0, master:0}, items:{focus:3, razz:3}, world:null };
const TR_KEY = "pokedex-trainer-v1";
const xpNeed = lv => 40 + (lv-1)*20;
const titleFor = lv => TITLES.filter(([l]) => lv >= l).pop()[1];
function trMerge(t){ if (t) TR = {...TR, ...t, balls:{...TR.balls, ...t.balls}, items:{...TR.items, ...(t.items||{})}}; }
function trLoadLocal(){ try { trMerge(JSON.parse(localStorage.getItem(TR_KEY) || "null")); } catch {} }
const trSave = makeSaver("trainer", TR_KEY, () => TR);
function trFromSnap(b){ if (b && typeof b.xp === "number"){ trMerge(b); renderTrainer(); } }
function renderTrainer(){
  if (!$("tLevel")) return;
  $("tLevel").textContent = "Lv " + TR.level; $("tTitle").textContent = titleFor(TR.level);
  const need = xpNeed(TR.level);
  $("tXp").style.width = Math.min(100, TR.xp/need*100) + "%"; $("tXpText").textContent = `${TR.xp} / ${need} XP to next level`;
  $("tBag").innerHTML = BALLS.filter(([k]) => k === "poke" || TR.balls[k] > 0).map(([k,l]) => `<span title="${l}"><i class="pb ${k}"></i>×${TR.balls[k]}</span>`).join("") +
    `<span title="Razz Berries"><i class="berry"></i>×${TR.items.razz}</span>`;
  $("tCaught").textContent = "My Pokémon: " + caughtCount();
}
function showLevelUp(head, big, lines){
  $("lvHead").textContent = head; $("lvNum").textContent = big;
  $("lvText").innerHTML = lines.map(g => `<div>${esc(g)}</div>`).join(""); $("lvUp").hidden = false; $("lvOk").focus();
}
function gainXp(n){
  TR.xp += n; const rewards = [];
  while (TR.xp >= xpNeed(TR.level)){
    TR.xp -= xpNeed(TR.level); TR.level++;
    const lv = TR.level; const got = [];
    TR.balls.poke += 3; got.push("3 Poké Balls");
    TR.items.focus++; TR.items.razz++; got.push("1 Focus power and 1 Razz Berry");
    if (lv >= 3){ TR.balls.great += 2; got.push("2 Great Balls"); }
    if (lv >= 6){ TR.balls.ultra += 1; got.push("1 Ultra Ball"); }
    if (lv % 5 === 0){ TR.balls.master += 1; got.push("a Master Ball! It catches anything!"); }
    if (lv === 5) got.push("Legendary Pokémon can now appear!");
    if (titleFor(lv) !== titleFor(lv-1)) got.push(`New title: ${titleFor(lv)}`);
    rewards.push([lv, got]);
  }
  trSave(); renderTrainer();
  if (rewards.length){ const [lv, got] = rewards[rewards.length-1]; showLevelUp("Level up!", "Lv " + lv, got); }
}

// ----- worlds -----
function renderWorlds(){
  $("bWorlds").innerHTML = WORLDS.map(w => `<button class="world" style="--w1:${w.w1};--w2:${w.w2}" data-gen="${w.gen}" aria-pressed="${TR.world===w.gen}">${spriteImg(w.star)}<b>${w.name}</b><small>Pokémon ${w.games}</small></button>`).join("");
}
function showWorldPick(){ renderWorlds(); $("bWorldPick").hidden = false; $("bMain").hidden = true; }
function pickWorld(gen){
  TR.world = gen; trSave();
  $("bWorldPick").hidden = true; $("bMain").hidden = false;
  $("bWorldName").textContent = WORLDS.find(w => w.gen === gen).name;
  btStart(); applySky();
}

const btBest = () => getBest("battle-best-" + BT.level);
function inWorld(p){ return !TR.world || p.gen === TR.world; }
function btPool(){ return ALL.filter(p => hasArt(p) && inWorld(p) && (BT.level === "easy" ? p.types.length === 1 : p.types.length === 2)); }
function btStart(){ BT.round = 0; BT.score = 0; BT.streak = 0; $("bNext").onclick = btNext; btNext(); }
function btNext(){
  let pool = btPool();
  if (!pool.length){ $("bTitle").textContent = "Loading Pokémon…"; return; }
  if (BT.round >= BT.rounds){ btEnd(); return; }
  BT.round++; BT.done = false; BT.busy = false; BT.hp = 100; BT.razz = false; BT.assisted = false;
  const sky = skyState();
  // rare Legendary encounters once the trainer reaches level 5
  BT.legend = TR.level >= 5 && Math.random() < 0.1;
  if (BT.legend){ const lp = ALL.filter(p => hasArt(p) && (p.legendary || p.mythical)); pool = lp.filter(inWorld).length ? lp.filter(inWorld) : lp; }
  // at night, Ghost and Dark Pokémon come out more often
  else if (!sky.day && Math.random() < 0.45){ const np = pool.filter(p => p.types.includes("Ghost") || p.types.includes("Dark")); if (np.length) pool = np; }
  let foe, good, bad, tries = 0;
  do {
    foe = pick(pool);
    BT.foe = foe;
    const abil = foe.abilities.filter(a => !a[1]).map(a => a[0]);
    BT.ability = abil.find(a => FOE_ABILITIES[a]) || null;
    const scored = TYPES.map(t => [t, emult(t)]);
    good = scored.filter(([,m]) => m >= 2); bad = scored.filter(([,m]) => m < 2);
  } while ((!good.length || bad.length < 3) && ++tries < 200);
  const win = pick(good);
  // if the ability blocks a type that would normally win, always offer that type: it's the lesson
  const trick = BT.ability ? bad.filter(([t]) => t === FOE_ABILITIES[BT.ability][0] && mult(t, foe.types) >= 1) : [];
  const weak = shuffle(bad.filter(([t,m]) => m < 1 && !trick.some(x => x[0] === t))), meh = shuffle(bad.filter(([t,m]) => m >= 1 && !trick.some(x => x[0] === t)));
  const picks = shuffle([win, ...[...trick, ...weak.slice(0,1), ...shuffle([...weak.slice(1), ...meh])].slice(0,3)]);
  const f = $("bFoe"); f.className = "foe" + (BT.legend ? " legend" : "");
  $("bBall").hidden = true; $("bBall").className = "ball";
  $("bImg").src = SPRITES[foe.id]; $("bImg").alt = foe.name;
  $("bName").innerHTML = esc(foe.name) + (BT.legend ? '<span class="rare">RARE!</span>' : "") + (NOTES[foe.id]?.caught ? ' <span title="Already caught" style="color:#e3262f">◉</span>' : "");
  $("bAbility").hidden = !BT.ability; if (BT.ability) $("bAbility").textContent = "Ability: " + BT.ability;
  const env = envFor(foe.types);
  $("bField").dataset.env = env; $("bEnv").dataset.base = ENVS[env];
  $("bTypes").innerHTML = typeBadges(foe.types);
  setHp(100);
  $("bTitle").className = "qtitle"; $("bTitle").textContent = BT.legend ? `Whoa! A Legendary ${foe.name} appeared!` : `A wild ${foe.name} appeared!`;
  $("bSub").textContent = BT.ability ? `Look out, it has ${BT.ability}! Which attack should you use?` : "Which attack should you use?";
  $("bMoves").className = "moves";
  $("bMoves").innerHTML = picks.map(([t]) => `<button class="move" style="--tc:${tc(t)}" data-t="${t}">${MOVES[t]}<small>${t}</small></button>`).join("");
  $("bMoves").querySelectorAll(".move").forEach(b => b.onclick = () => btAttack(b.dataset.t));
  $("bHint").hidden = BT.level !== "easy" || BT.legend; $("bHint").disabled = false;
  $("bNext").hidden = true;
  renderPowers(); renderBattleBuddy(); applySky(); btHud();
}
function setHp(v){ BT.hp = v; $("bHp").style.width = v + "%"; $("bHp").style.background = meterColor(v, 70); }
function buddyHelpType(){
  const b = buddyMon(); if (!b || !BT.foe) return null;
  return b.types.find(t => emult(t) >= 2) || null;
}
function renderPowers(){
  const el = $("bPowers");
  if (BT.done){ el.innerHTML = ""; return; }
  const b = buddyMon(), help = buddyHelpType();
  el.innerHTML = `<button class="power" id="pwFocus" style="--c:#7a5be0" ${TR.items.focus>0?"":"disabled"}><i class="dot"></i>Focus ×${TR.items.focus} <span class="sub">hides 2 wrong moves</span></button>` +
    (b && help && !BT.assisted ? `<button class="power assist" id="pwAssist">${spriteImg(b.id)}${esc(BUDDY.nick)} can help!</button>` : "");
  if ($("pwFocus")) $("pwFocus").onclick = useFocus;
  if ($("pwAssist")) $("pwAssist").onclick = () => { BT.assisted = true; btAttack(help, true); };
}
function useFocus(){
  if (BT.done || TR.items.focus <= 0) return;
  const wrong = [...$("bMoves").querySelectorAll(".move:not(:disabled)")].filter(b => emult(b.dataset.t) < 2);
  shuffle(wrong).slice(0,2).forEach(b => { b.disabled = true; });
  TR.items.focus--; trSave(); renderTrainer();
  $("pwFocus").disabled = true; $("pwFocus").innerHTML = `<i class="dot"></i>Focused!`;
}
function renderBattleBuddy(){
  const b = buddyMon();
  $("bBuddy").hidden = !b;
  if (b) $("bBuddy").innerHTML = `${spriteImg(b.id)}${esc(BUDDY.nick)} is cheering!`;
}
function btAttack(t, byBuddy){
  if (BT.done) return; BT.done = true;
  const foe = BT.foe, m = emult(t), win = m >= 2, blocked = m === 0 && mult(t, foe.types) > 0 && BT.ability;
  if (win){ BT.score++; BT.streak++; } else BT.streak = 0;
  const f = $("bFoe");
  f.querySelector(".boom").style.background = `radial-gradient(circle,#fff,${tc(t)} 60%,transparent 70%)`;
  if (m > 0) replay(f, "hit"); else f.classList.remove("hit");
  setHp(win ? 12 : m === 1 ? 60 : m > 0 ? 82 : 100);
  $("bMoves").querySelectorAll(".move").forEach(b => { b.disabled = true;
    if (b.dataset.t === t) b.classList.add("picked");
    if (emult(b.dataset.t) >= 2) b.classList.add("right"); });
  $("bPowers").innerHTML = "";
  const who = byBuddy ? `${BUDDY.nick} used ${MOVES[t]}!` : `${MOVES[t]}!`;
  const words = blocked ? `But ${foe.name} has ${BT.ability}!` : m >= 4 ? "It's super-duper effective!" : m >= 2 ? "It's super effective!" : m === 0 ? `It doesn't affect ${foe.name}!` : m < 1 ? "It's not very effective…" : "It hit, but it wasn't super effective.";
  $("bTitle").className = "qtitle " + (win ? "right" : "wrong");
  $("bTitle").textContent = `${who} ${words}`;
  const best = $("bMoves").querySelector(".move.right") || {dataset:{t:buddyHelpType()||t}};
  const xp = win ? (BT.level === "hard" ? 20 : 10) + Math.min(10, (BT.streak-1)*2) + (BT.legend ? 30 : 0) : 2;
  $("bSub").textContent = blocked ? `${foe.name} ${FOE_ABILITIES[BT.ability][1]} Try ${MOVES[best.dataset.t]} instead. +${xp} XP.`
    : win ? `${foe.name} is worn out! ${t} beats ${foe.types.join(" and ")}. +${xp} XP.` : `Try ${MOVES[best.dataset.t]} next time. ${best.dataset.t} beats ${foe.types.join(" and ")}! +${xp} XP.`;
  $("bHint").hidden = true;
  if (win){ buddyGain(byBuddy ? 10 : 3, byBuddy ? 3 : 1); if (Math.random() < 0.25){ TR.items.razz++; setTimeout(() => toast("You found a Razz Berry!"), 900); } }
  setTimeout(() => { $("bMoves").classList.add("catchrow"); showCatchChoices(win); gainXp(xp); }, 700);
  btHud();
}
function showCatchChoices(win){
  const balls = BALLS.filter(([k]) => TR.balls[k] > 0);
  const throwBtns = balls.map(([k,l]) => `<button class="btn big throwbtn" data-ball="${k}"><i class="pb ${k}"></i>Throw ${l} (${TR.balls[k]})</button>`).join("");
  const razz = TR.items.razz > 0 && !BT.razz ? `<button class="btn big throwbtn" id="bRazz"><i class="berry"></i>Give a Razz Berry (${TR.items.razz})</button>` : "";
  $("bMoves").innerHTML = (throwBtns || `<span class="sub">You're out of Poké Balls! Win battles, level up or walk your buddy to get more.</span>`) + razz +
    `<button class="btn big" id="bSkip">${win ? "Let it go" : "Run away"}</button>`;
  $("bMoves").querySelectorAll("[data-ball]").forEach(b => b.onclick = () => throwBall(b.dataset.ball));
  if ($("bRazz")) $("bRazz").onclick = () => { if (BT.busy) return; BT.razz = true; TR.items.razz--; trSave(); renderTrainer();
    $("bTitle").className = "qtitle"; $("bTitle").textContent = `${BT.foe.name} is munching the Razz Berry!`; $("bSub").textContent = "It's calmer now and easier to catch."; showCatchChoices(win); };
  $("bSkip").onclick = finishEncounter;
  if (!$("bSub").dataset.keep && !BT.razz) $("bSub").textContent += win ? " Throw a ball to catch it!" : " It's still strong, but you can try to catch it.";
}
function catchChance(ball){
  if (ball === "master") return 1;
  const bonus = BALLS.find(b => b[0] === ball)[2] * (BT.razz ? 1.5 : 1);
  const rate = (BT.foe.capture ?? 45) / 255, hpf = 1 + (100 - BT.hp) / 40;   // weaker = easier
  return Math.min(0.97, rate * bonus * hpf * 0.9 + 0.15);
}
function throwBall(kind){
  if (BT.busy || TR.balls[kind] <= 0) return; BT.busy = true;
  TR.balls[kind]--; trSave(); renderTrainer();
  const ok = Math.random() < catchChance(kind);
  const shakes = ok ? 3 : 1 + Math.floor(Math.random()*3);
  const ball = $("bBall"), f = $("bFoe");
  ball.innerHTML = `<i class="pb ${kind}"></i>`; ball.hidden = false; ball.className = "ball throw";
  $("bMoves").querySelectorAll("button").forEach(b => b.disabled = true);
  $("bTitle").className = "qtitle"; $("bTitle").textContent = `You threw a ${BALLS.find(b=>b[0]===kind)[1]}!`; $("bSub").textContent = "";
  setTimeout(() => { f.classList.add("inball"); ball.className = "ball rest"; }, 700);
  for (let i = 0; i < shakes; i++) setTimeout(() => { ball.className = "ball rest"; void ball.offsetWidth; ball.className = "ball wobble"; $("bSub").textContent = "Wobble… ".repeat(i+1).trim(); }, 1100 + i*800);
  setTimeout(() => {
    const foe = BT.foe;
    if (ok){
      replay($("bStars"), "on");
      const isNew = !NOTES[foe.id]?.caught;
      NOTES[foe.id] = {...(NOTES[foe.id]||{}), caught:true}; writeNote(foe.id);
      $("bTitle").className = "qtitle right"; $("bTitle").textContent = `Gotcha! ${foe.name} was caught!`;
      const xp = (isNew ? 15 : 5) + (BT.legend ? 50 : 0);
      $("bSub").textContent = (isNew ? `New Pokémon for your collection! ` : `You already had one, but it's nice to have friends. `) + `+${xp} XP`;
      gainXp(xp);
      $("bMoves").innerHTML = ""; finishEncounter(true);
    } else {
      ball.hidden = true; f.classList.remove("inball"); f.classList.add("escape");
      $("bTitle").className = "qtitle wrong"; $("bTitle").textContent = ["Oh no! It broke free!","Aww! It was so close!","Argh! Almost had it!"][shakes-1];
      $("bSub").textContent = "Try again?"; $("bSub").dataset.keep = "1";
      BT.busy = false; showCatchChoices(false); delete $("bSub").dataset.keep;
      $("bSkip").textContent = "Run away";
    }
  }, 1100 + shakes*800 + 200);
}
function finishEncounter(caught){
  $("bMoves").innerHTML = ""; $("bMoves").className = "moves"; $("bPowers").innerHTML = "";
  if (caught !== true){ $("bTitle").className = "qtitle"; $("bTitle").textContent = BT.hp <= 12 ? `${BT.foe.name} ran back into the wild.` : `You got away safely!`; $("bSub").textContent = ""; }
  $("bNext").hidden = false; $("bNext").textContent = BT.round >= BT.rounds ? "See my score" : "Next battle →";
  $("bNext").focus({preventScroll:true});
}
function btHud(){
  $("bRound").textContent = `${Math.min(BT.round, BT.rounds)}/${BT.rounds}`; $("bScore").textContent = BT.score; $("bStreak").textContent = BT.streak;
  $("bBest").textContent = Math.max(btBest(), BT.score);
}
function btEnd(){
  const isBest = BT.score > btBest(); if (isBest) setBest("battle-best-" + BT.level, BT.score);
  const stars = starsFor(BT.score);
  const msg = ["Good try! Every trainer starts somewhere.","Nice battling, Trainer!","Great job! You know your types!","Perfect! You're a Type Master!"][stars];
  const bonus = stars * 10;
  $("bFoe").className = "foe"; $("bImg").removeAttribute("src"); $("bBall").hidden = true; $("bAbility").hidden = true; $("bPowers").innerHTML = "";
  $("bTitle").className = "qtitle"; $("bTitle").textContent = `You won ${BT.score} out of ${BT.rounds} battles!`;
  $("bSub").textContent = (isBest ? `New best score for ${BT.level}! ` : "") + (bonus ? `Star bonus: +${bonus} XP` : "");
  $("bMoves").className = "moves";
  $("bMoves").innerHTML = endCard(stars, msg);
  $("bHint").hidden = true;
  $("bNext").textContent = "Battle again"; $("bNext").onclick = btStart; btHud();
  if (bonus) gainXp(bonus);
}
function enterBattle(){
  if (TR.world === null || TR.world === undefined) showWorldPick();
  else { $("bWorldName").textContent = WORLDS.find(w => w.gen === TR.world).name; if (!BT.foe) btStart(); }
  applySky();
}
function buildBattle(){
  $("bNext").onclick = btNext;
  $("bHint").onclick = () => { if (BT.done || !BT.foe) return; $("bHint").disabled = true;
    $("bSub").innerHTML = `<span class="hintbox">${esc(BT.foe.types.map(t => HINTS[t]).join(" "))}${BT.ability?` And remember: ${esc(BT.foe.name)} ${esc(FOE_ABILITIES[BT.ability][1])}`:""}</span>`; };
  $("bLevels").addEventListener("click", e => { const b = e.target.closest("[data-lv]"); if (!b) return;
    BT.level = b.dataset.lv; $("bLevels").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x===b)); btStart(); });
  $("bWorlds").addEventListener("click", e => { const b = e.target.closest("[data-gen]"); if (b) pickWorld(+b.dataset.gen); });
  $("bWorldBtn").onclick = showWorldPick;
  $("lvOk").onclick = () => { $("lvUp").hidden = true; };
  $("tCaught").onclick = () => { state.mCaught = true; $("mCaught").checked = true; state.sort = "updated"; state.dir = "desc"; setTab("dex"); render(); };
  renderTrainer();
}
