// Field Pokédex · Tabs and start-up. Loaded last.
"use strict";
// [section id, tab button id, link hash that opens it]
const TABS = [["dex","tabDex",""],["game","tabGame","#guess"],["quiz","tabQuiz","#whos-that"],["battle","tabBattle","#battle"],["buddy","tabBuddy","#buddy"]];
function setTab(t){
  TABS.forEach(([v,b]) => { $(b).setAttribute("aria-selected", t===v); $(v).hidden = t!==v; });
  if (t!=="quiz") clearInterval(QZ.timer);
  if (t==="game" && !G.w){ buildQuestions(); gStart(); }
  if (t==="quiz" && !QZ.cur) qzStart();
  if (t==="battle") enterBattle();
  if (t==="buddy") enterBuddy();
}
function buildTabs(){
  TABS.forEach(([v,b]) => { $(b).onclick = () => setTab(v); });
  buildGuess(); buildQuiz(); buildBattle(); buildBuddy();
  const linked = TABS.find(([,,h]) => h && h === location.hash);
  if (linked) setTab(linked[0]);
}
// sprites arrive after the data; redraw whatever is on screen
function onSprites(){
  render(); if (state.sel) renderDrawer(); if (G.w) renderGame();
  if (!$("quiz").hidden && !QZ.cur) qzStart();
  if (!$("battle").hidden) enterBattle();
  if (!$("buddy").hidden) enterBuddy();
}
async function boot(){
  try {
    const r = await fetch("pokemon.json"); ALL = await r.json();
  } catch(e){ $("tbody").innerHTML = `<tr><td class="empty" colspan="14">Could not load the Pokédex data. Reload the page to try again.</td></tr>`; return; }
  buildControls(); render(); buildTabs();
  fetch("sprites.json").then(r=>r.json()).then(s => { SPRITES = s; onSprites(); }).catch(()=>{});
  initNotes();
}
boot();
