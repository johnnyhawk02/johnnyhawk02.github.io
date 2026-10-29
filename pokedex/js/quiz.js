// Field Pokédex · Who's That Pokémon?: silhouette quiz.
"use strict";
// ---------- who's that pokémon ----------
const QZ = { level:"easy", round:0, score:0, streak:0, answered:false, cur:null, timer:null, rounds:10, used:new Set() };
const QZ_LEVELS = { easy:p => p.gen === 1, medium:p => p.gen <= 4, hard:() => true };
const qzBest = () => getBest("wtp-best-" + QZ.level);
function qzPool(){ return ALL.filter(p => hasArt(p) && QZ_LEVELS[QZ.level](p)); }
function qzStart(){ QZ.round = 0; QZ.score = 0; QZ.streak = 0; QZ.used = new Set(); qzNext(); }
function qzNext(){
  clearInterval(QZ.timer);
  const pool = qzPool();
  if (!pool.length){ $("qTitle").textContent = "Loading pictures…"; return; }
  if (QZ.round >= QZ.rounds){ qzEnd(); return; }
  QZ.round++; QZ.answered = false;
  let p; do { p = pick(pool); } while (QZ.used.has(p.id) && QZ.used.size < pool.length);
  QZ.used.add(p.id); QZ.cur = p;
  // wrong answers: prefer ones that share a type, so the shape is the clue
  const same = shuffle(pool.filter(x => x.id !== p.id && x.types.some(t => p.types.includes(t))));
  const rest = shuffle(pool.filter(x => x.id !== p.id && !same.includes(x)));
  const choices = shuffle([p, ...same.slice(0,2), ...rest].slice(0,4).concat([]).filter((x,i,a)=>a.indexOf(x)===i).slice(0,4));
  if (!choices.includes(p)) choices[0] = p;
  $("qPic").classList.remove("show");
  $("qImg").src = SPRITES[p.id]; $("qImg").alt = "Mystery Pokémon silhouette";
  $("qTitle").className = "qtitle"; $("qTitle").textContent = "Who's that Pokémon?";
  $("qChoices").innerHTML = shuffle(choices).map(c => `<button data-id="${c.id}">${esc(c.name)}</button>`).join("");
  $("qChoices").querySelectorAll("button").forEach(b => b.onclick = () => qzAnswer(+b.dataset.id));
  $("qNext").hidden = true;
  qzHud();
  const on = $("qTimerOn").checked; $("qTimeBar").hidden = !on;
  if (on){
    const t0 = Date.now(), dur = 10000;
    QZ.timer = setInterval(() => { const left = Math.max(0, 1 - (Date.now()-t0)/dur);
      $("qTimeFill").style.width = (left*100)+"%"; if (!left) qzAnswer(null); }, 100);
  }
}
function qzAnswer(id){
  if (QZ.answered) return; QZ.answered = true; clearInterval(QZ.timer);
  const p = QZ.cur, ok = id === p.id;
  if (ok){ QZ.score++; QZ.streak++; } else QZ.streak = 0;
  $("qChoices").querySelectorAll("button").forEach(b => { b.disabled = true;
    if (+b.dataset.id === p.id) b.classList.add("right"); else if (+b.dataset.id === id) b.classList.add("wrong"); });
  $("qPic").classList.add("show"); $("qImg").alt = p.name;
  $("qTitle").className = "qtitle " + (ok ? "right" : "wrong");
  $("qTitle").textContent = ok ? `Yes! It's ${p.name}!` : id === null ? `Time's up! It's ${p.name}!` : `Oh no! It's ${p.name}!`;
  $("qNext").hidden = false; $("qNext").textContent = QZ.round >= QZ.rounds ? "See my score" : "Next Pokémon →";
  qzHud(); $("qNext").focus({preventScroll:true});
}
function qzHud(){
  $("qRound").textContent = `${QZ.round}/${QZ.rounds}`; $("qScore").textContent = QZ.score; $("qStreak").textContent = QZ.streak;
  $("qBest").textContent = Math.max(qzBest(), QZ.score);
}
function qzEnd(){
  const best = qzBest(), isBest = QZ.score > best; if (isBest) setBest("wtp-best-" + QZ.level, QZ.score);
  const stars = starsFor(QZ.score);
  const msg = ["Good try! Play again to get better.","Nice work, Trainer!","Great job! You really know your Pokémon!","Perfect score! You're a Pokémon Master!"][stars];
  $("qPic").classList.add("show");
  $("qTitle").className = "qtitle"; $("qTitle").textContent = `You got ${QZ.score} out of ${QZ.rounds}!`;
  $("qChoices").innerHTML = endCard(stars, msg, isBest ? `<div class="sub">New best score for ${QZ.level}!</div>` : "");
  $("qNext").hidden = false; $("qNext").textContent = "Play again"; QZ.round = QZ.rounds + 1; qzHud(); QZ.round = 0;
  $("qRound").textContent = `${QZ.rounds}/${QZ.rounds}`;
  $("qNext").onclick = () => { $("qNext").onclick = qzNext; qzStart(); };
}
function buildQuiz(){
  $("qNext").onclick = qzNext;
  $("qLevels").addEventListener("click", e => { const b = e.target.closest("[data-lv]"); if (!b) return;
    QZ.level = b.dataset.lv; $("qLevels").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x===b)); qzStart(); });
  $("qTimerOn").onchange = () => { if (!QZ.answered) { clearInterval(QZ.timer); QZ.round--; QZ.used.delete(QZ.cur?.id); qzNext(); } };
}
