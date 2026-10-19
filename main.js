import { work, releases, links } from "./data.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- featured ----------
const f = work.find((w) => w.featured);
if (f) {
  $("#featured").innerHTML = `
    <div class="featured-top reveal">
      <span class="eyebrow">Featured · ${esc(f.kind)} · ${f.year}</span>
      <span class="eyebrow">01</span>
    </div>
    <div class="featured-body">
      <div class="featured-text reveal">
        <img class="featured-logo" src="img/ephem-logo.png" alt="${esc(f.title)}">
        <p>${esc(f.blurb)}</p>
        <a class="button" href="${f.link}">${esc(f.cta)} <span>→</span></a>
      </div>
      <a class="frame reveal" href="${f.link}"><img src="${f.image}" alt="${esc(f.title)} screenshot"></a>
    </div>`;
}

// ---------- work grid ----------
$("#work-grid").innerHTML = work.map((w) => `
  <article class="card reveal" data-kind="${w.kind}">
    <a class="frame" href="${w.link}"><img src="${w.image}" alt="${esc(w.title)}" loading="lazy"></a>
    <div class="card-meta"><h3>${esc(w.title)}</h3><span class="eyebrow">${w.kind} · ${w.year}</span></div>
    <p>${esc(w.blurb)}</p>
    <a class="go" href="${w.link}">${esc(w.cta)} →</a>
  </article>`).join("");

// ---------- marquee ----------
const words = ["EpHeM", "Active Sefton", "Global Goon", ...releases.filter((r) => r.type === "Album").map((r) => r.title)];
const strip = words.map((w) => `<span>${esc(w)}</span>`).join("");
$("#marquee").innerHTML = strip + strip;   // twice, so the loop is seamless

// ---------- Global Goon ----------
const albums = releases.filter((r) => r.type === "Album").length;
const eps = releases.length - albums;
const first = releases[0].year, last = releases[releases.length - 1].year;
$("[data-count=releases]").textContent = releases.length;
$("#stats").innerHTML = [
  [albums, "Albums"], [eps, "EPs"], [last - first + 1, `Years, ${first}–${last}`],
].map(([n, l]) => `<li><b data-to="${n}">0</b><span>${l}</span></li>`).join("");

// a made-up cover per release, the same every time
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function art(title) {
  const h = hash(title), r = (n) => (h >>> n) % 100, hue = h % 360;
  return `radial-gradient(circle at ${r(3)}% ${r(9)}%, hsl(${hue} 85% 62%), transparent 55%),
          radial-gradient(circle at ${r(15)}% ${r(21)}%, hsl(${(hue + 140) % 360} 75% 50%), transparent 60%),
          conic-gradient(from ${r(5) * 3.6}deg at 70% 70%, hsl(${(hue + 60) % 360} 50% 22%), hsl(${(hue + 220) % 360} 45% 12%), hsl(${(hue + 60) % 360} 50% 22%))`;
}
const listen = (r) => r.link || `https://www.discogs.com/search/?q=${encodeURIComponent("Global Goon " + r.title)}&type=all`;
const cover = (r) => r.cover
  ? `<div class="cover has-art"><img src="img/covers/${r.cover}.jpg" alt="" loading="lazy"><small>${r.type}</small></div>`
  : `<div class="cover" style="--art:${art(r.title)}"><small>${r.type}</small><strong>${esc(r.title)}</strong></div>`;

const years = [...new Set(releases.map((r) => r.year))].sort((a, b) => b - a);   // newest first
$("#timeline").innerHTML = years.map((y) => `
  <li class="year reveal">
    <div class="year-num">${y}</div>
    <ul class="rels">${releases.filter((r) => r.year === y).map((r) => `
      <li class="rel" data-type="${r.type}">
        <a href="${listen(r)}" target="_blank" rel="noopener">
          ${cover(r)}
          <div class="rel-meta"><h4>${esc(r.title)}</h4><span>${esc(r.label)}</span></div>
        </a>
      </li>`).join("")}
    </ul>
  </li>`).join("");

// ---------- filter tabs ----------
function tabs(id, apply) {
  const box = $(id);
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    apply(b.dataset.filter);
  });
}
tabs("#work-tabs", (f) => document.querySelectorAll(".card").forEach((c) =>
  c.classList.toggle("hide", f !== "all" && c.dataset.kind !== f)));
tabs("#music-tabs", (f) => {
  document.querySelectorAll(".rel").forEach((r) => r.classList.toggle("hide", f !== "all" && r.dataset.type !== f));
  document.querySelectorAll(".year").forEach((y) => y.classList.toggle("hide", !y.querySelector(".rel:not(.hide)")));
});

// ---------- scroll reveal + counters ----------
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add("in");
  e.target.querySelectorAll("[data-to]").forEach(count);
  io.unobserve(e.target);
}), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function count(el) {
  const to = +el.dataset.to, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / 1200);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- menu bar: solid once scrolled, dark over the music section ----------
const nav = $(".nav"), music = $("#music");
function navState() {
  nav.classList.toggle("scrolled", scrollY > 10);
  nav.classList.toggle("on-dark", music.getBoundingClientRect().top <= nav.offsetHeight);
}
addEventListener("scroll", navState, { passive: true });
navState();

document.querySelectorAll("[data-link]").forEach((a) => (a.href = links[a.dataset.link]));
$("#year").textContent = new Date().getFullYear();
