// Field Pokédex · Shared data, helpers, note storage (db or browser), the moving sky.
"use strict";
const STAT_NAMES = ["HP","Atk","Def","SpA","SpD","Spe"];
const STAT_COLORS = ["#4caf50","#e8a33a","#e0c431","#4f8fe0","#7d62d6","#e2508a"];
const TYPES = ["Normal","Fire","Water","Grass","Electric","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
const ROMAN = ["","I","II","III","IV","V","VI","VII","VIII","IX"];
const tc = t => `var(--t-${t.toLowerCase()},#777)`;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

let ALL = [], SPRITES = {}, NOTES = {};

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
// a Pokémon we can show in the games: a main form with a sprite
const hasArt = p => !p.form && !!SPRITES[p.id];
const spriteImg = id => SPRITES[id] ? `<img alt="" src="${SPRITES[id]}">` : "";
const typeBadges = types => types.map(t => `<span class="tp" style="--tc:${tc(t)}">${t}</span>`).join("");
// the scene for a Pokémon: its main type, or its second type when the first is plain Normal
const envFor = types => types[0] === "Normal" && types[1] ? types[1] : types[0];
// red when low, amber in the middle, the default colour when healthy
const meterColor = (v, mid) => v < 25 ? "#e3262f" : v < mid ? "#f5a800" : "";
// restart a CSS animation by removing and re-adding its class
function replay(el, cls){ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
function getBest(key){ try { return +(localStorage.getItem(key) || 0); } catch { return 0; } }
function setBest(key, v){ try { localStorage.setItem(key, v); } catch {} }
const starsFor = score => score >= 10 ? 3 : score >= 7 ? 2 : score >= 4 ? 1 : 0;
const endCard = (stars, msg, extra = "") => `<div class="qend" style="grid-column:1/-1"><div class="stars">${[0,1,2].map(i=>`<span class="${i<stars?"":"off"}">★</span>`).join("")}</div><div>${msg}</div>${extra}</div>`;
const isEmptyNote = n => !n.note && !n.rating && !n.fav && !n.caught;
// ---------- notes storage: db when available, browser storage otherwise ----------
let notesCol = null, mode = "none";
const LS_KEY = "pokedex-notes-v1";
function setSync(cls, text){ const el=$("sync"); el.className="sync "+cls; el.querySelector("span").textContent=text; }
function loadLocal(){ try { NOTES = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { NOTES = {}; } }
function saveLocal(){ try { localStorage.setItem(LS_KEY, JSON.stringify(NOTES)); return true; } catch { return false; } }
function useLocal(msg){ mode="local"; loadLocal(); trLoadLocal(); bdLoadLocal(); setSync("local", msg); render(); renderTrainer(); renderBuddy(); renderBattleBuddy(); }

async function initNotes(){
  const timeout = new Promise(r => setTimeout(() => r(null), 11000));
  const ready = (async () => {
    if (!window.claude?.use) return null;
    const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
    if (!db || !user) return null;
    const uid = await user.id();
    if (!uid) return null;
    return db.collection("data/users/" + uid);
  })().catch(() => null);
  notesCol = await Promise.race([ready, timeout]);
  if (!notesCol){ useLocal("Notes saved in this browser only"); return; }
  mode = "db";
  setSync("ok", "Notes synced to your account");
  notesCol.onSnapshot(snap => {
    const next = {};
    snap.docs.forEach(d => { const b = d.data(); if (d.id === "trainer") trFromSnap(b); else if (d.id === "buddy") bdFromSnap(b); else if (b && b.pid) next[b.pid] = b; });
    // keep locally pending edits for the open note
    NOTES = next; renderTrainer();
    render(); if (state.sel && !document.activeElement?.closest?.("#drawer")) renderDrawer();
  }, () => useLocal("Sync unavailable, saving in this browser"));
}

const writing = {};
async function writeNote(pid){
  const n = NOTES[pid] || {};
  const ta = state.sel === pid ? $("noteText") : null;
  if (ta) n.note = ta.value;
  const body = { pid, note:n.note||"", rating:n.rating||0, fav:!!n.fav, caught:!!n.caught, updatedAt:Date.now() };
  NOTES[pid] = body;
  if (mode === "local"){ if (isEmptyNote(body)) delete NOTES[pid]; showSaved(saveLocal() ? "Saved" : "Could not save, browser storage is blocked"); render(); return; }
  if (mode !== "db") return;
  if (writing[pid]) { writing[pid].again = true; return; }
  writing[pid] = {};
  showSaved("Saving…");
  try {
    do {
      writing[pid].again = false;
      const cur = NOTES[pid] || body;
      if (isEmptyNote(cur)) await notesCol.doc("p"+pid).delete(); else await notesCol.doc("p"+pid).set(cur);
    } while (writing[pid].again);
    showSaved("Saved");
  } catch(e){ showSaved("Not saved: " + (e?.message || "try again")); }
  finally { delete writing[pid]; }
  render();
}
function showSaved(t){ const el = document.querySelector("#drawer .saved"); if (el) el.textContent = t; }
function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.tm); toast.tm = setTimeout(() => t.hidden = true, 2600); }

// ----- the sky: sun by day, moon by night, one full turn every 10 minutes (same clock for everyone) -----
function skyState(){
  const t = (Date.now() % 600000) / 600000, day = t < 0.5, p = day ? t/0.5 : (t-0.5)/0.5;
  const edge = Math.min(1, Math.min(p, 1-p) / 0.1);           // 0 at the horizon, 1 high up
  const night = day ? 1 - edge*1 : 1;
  const left = Math.round((0.5 - (t % 0.5)) * 1200);
  const label = day ? (edge < 0.6 ? (p < 0.5 ? "Sunrise" : "Sunset") : "Daytime") : "Night";
  return { day, x: 6 + 88*p, y: 44 - 34*Math.sin(Math.PI*p), night: Math.max(0, Math.min(1, day ? night*0.7 : 1)), label, left };
}
function applySky(){
  const s = skyState();
  document.querySelectorAll(".bfield").forEach(el => {
    if (el.offsetParent === null) return;
    el.style.setProperty("--cx", s.x.toFixed(2) + "%"); el.style.setProperty("--cy", s.y.toFixed(2) + "%");
    el.style.setProperty("--night", s.night.toFixed(2)); el.dataset.time = s.day ? "day" : "night";
    const tag = el.querySelector(".envtag"); if (tag && tag.dataset.base) tag.textContent = `${tag.dataset.base} · ${s.label}`;
  });
  return s;
}
setInterval(applySky, 1000);
// one write at a time per document; a write requested mid-flight is folded into one follow-up
function makeSaver(docId, lsKey, get){
  let busy = false, again = false;
  return async function save(){
    if (mode !== "db"){ try { localStorage.setItem(lsKey, JSON.stringify(get())); } catch {} return; }
    if (busy){ again = true; return; }
    busy = true;
    try { do { again = false; const v = get(); if (v) await notesCol.doc(docId).set(JSON.parse(JSON.stringify(v))); else await notesCol.doc(docId).delete(); } while (again); } catch {}
    busy = false;
  };
}
function caughtCount(){ return Object.values(NOTES).filter(n => n.caught).length; }
