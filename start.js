/* LinsoftPhone OS - registr aplikaci a start systemu (nacita se posledni) */
"use strict";

/* ---------------- registr aplikaci ---------------- */
const APPS = [
  /* ikona = nazev v ikony.js, barvy = prechod podkladu */
  { id: "telefon", barvy: ["#4ade80", "#15a34a"], render: appTelefon, dock: true, plna: true },
  { id: "zpravy", barvy: ["#38bdf8", "#2563eb"], render: appZpravy, dock: true },
  { id: "kontakty", barvy: ["#fdba74", "#ea580c"], render: appKontakty },
  { id: "kalk", barvy: ["#c4b5fd", "#7c3aed"], render: appKalk },
  { id: "hodiny", barvy: ["#fda4af", "#e11d48"], render: appHodiny },
  { id: "kalendar", barvy: ["#5eead4", "#0d9488"], render: appKalendar },
  { id: "poznamky", barvy: ["#fde047", "#ca8a04"], render: appPoznamky },
  { id: "fotak", barvy: ["#94a3b8", "#334155"], render: appFotak, plna: true },
  { id: "galerie", barvy: ["#f9a8d4", "#c026d3"], render: appGalerie },
  { id: "prehliadac", barvy: ["#38bdf8", "#6d28d9"], render: appPrehliadac, dock: true, plna: true },
  { id: "terminal", barvy: ["#475569", "#0f172a"], render: appTerminal },
  { id: "nastaveni", barvy: ["#cbd5e1", "#475569"], render: appNastaveni, dock: true }
];
function najdiApp(id) { return APPS.find((a) => a.id === id); }
/* podklad ikony: zaobleny ctverec s prechodem + bily symbol z ikony.js */
const glyph = (a) =>
  `<span class="glyph" style="background:linear-gradient(145deg,${a.barvy[0]},${a.barvy[1]})" aria-hidden="true">${Ikony.ikona(a.id)}</span>`;

function ikonka(app, bezPopisku) {
  const b = document.createElement("button");
  const nazev = t("app_" + app.id);
  b.className = "appicon";
  b.setAttribute("aria-label", nazev);
  b.innerHTML = glyph(app) +
    (bezPopisku ? "" : `<span aria-hidden="true">${esc(nazev)}</span>`);
  b.onclick = () => otevri(app.id);
  return b;
}
/* poradi ikon na plose a obsah doku (Nastaveni -> Plocha); nove aplikace se pridaji na konec */
function rozlozeniPlochy() {
  const p = store.get("plocha", {}), ids = APPS.map((a) => a.id);
  const poradi = (p.poradi || []).filter((id) => ids.indexOf(id) >= 0);
  ids.forEach((id) => { if (poradi.indexOf(id) < 0) poradi.push(id); });
  const dok = p.dok ? p.dok.filter((id) => ids.indexOf(id) >= 0) : APPS.filter((a) => a.dock).map((a) => a.id);
  return { poradi, dok };
}
function vykresliIkony() {
  const r = rozlozeniPlochy();
  $("#appgrid").innerHTML = "";
  $("#dock").innerHTML = "";
  r.poradi.forEach((id, i) => {
    const b = ikonka(najdiApp(id));
    b.style.setProperty("--i", i);
    $("#appgrid").appendChild(b);
  });
  r.dok.forEach((id) => $("#dock").appendChild(ikonka(najdiApp(id), true)));
}

/* ---------------- start ---------------- */
/* uvodni obrazovka s logem zmizi po dobehnuti animace (jako start telefonu) */
setTimeout(() => {
  $("#boot").classList.add("hotovo");
  setTimeout(() => $("#boot").remove(), 450);
}, 1300);

if (store.get("svetly", false)) nastavMotiv(true);
nactiTapetu();
kresliStavovyRadek();
prelozStranku();
vykresliIkony();
kresliNotif();
stavDlazdic();
Fotky.migrace();
tick();
setInterval(tick, 1000);
spustNativ();
/* zkratky z ikony na plose (manifest "shortcuts"): ./#telefon, ./#fotak */
if (najdiApp(location.hash.slice(1))) otevri(location.hash.slice(1));

if ("serviceWorker" in navigator && window.isSecureContext !== false)
  navigator.serviceWorker.register("sw.js").catch(() => {});
