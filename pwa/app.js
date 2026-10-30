/* LinsoftPhone OS PWA - hlavni logika */
"use strict";

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("lp_" + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem("lp_" + k, JSON.stringify(v)); }
};

/* ---------------- stav ---------------- */
const stav = {
  odemceno: false,
  bezici: null,
  tiles: store.get("tiles", { wifi: true, bt: false, torch: false, plane: false }),
  notifikace: store.get("notif", [
    { t: "Vítej v LinsoftPhone OS", s: "Systém je připraven.", cas: Date.now() }
  ])
};

/* ---------------- hodiny / datum ---------------- */
const DNY = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
const MESICE = ["ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince"];

function hhmm(d = new Date()) {
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function datumText(d = new Date()) {
  return `${DNY[d.getDay()]} ${d.getDate()}. ${MESICE[d.getMonth()]}`;
}
function tick() {
  const t = hhmm();
  $("#sb-time").textContent = t;
  $("#lock-clock").textContent = t;
  $("#lock-date").textContent = datumText();
  $("#w-time").textContent = t;
  $("#w-date").textContent = datumText();
}
setInterval(tick, 1000); tick();

/* skutecna baterie, pokud ji prohlizec umi */
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const uk = () => $("#sb-batt").textContent =
      (b.charging ? "⚡ " : "🔋 ") + Math.round(b.level * 100) + " %";
    b.addEventListener("levelchange", uk);
    b.addEventListener("chargingchange", uk);
    uk();
  });
}

/* ---------------- notifikace ---------------- */
function pridejNotif(t, s) {
  stav.notifikace.unshift({ t, s, cas: Date.now() });
  stav.notifikace = stav.notifikace.slice(0, 20);
  store.set("notif", stav.notifikace);
  kresliNotif();
}
function kresliNotif() {
  $("#notif-list").innerHTML = stav.notifikace.map((n) =>
    `<div class="notif"><strong>${esc(n.t)}</strong> ${esc(n.s)}<small>${hhmm(new Date(n.cas))}</small></div>`
  ).join("") || `<div class="notif">Žádné notifikace</div>`;
}
function esc(x) {
  return String(x).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

$("#statusbar").onclick = () => $("#notifpanel").classList.toggle("open");
$("#notif-clear").onclick = () => { stav.notifikace = []; store.set("notif", []); kresliNotif(); };
document.querySelectorAll(".tile").forEach((tl) => {
  const k = tl.dataset.tile;
  const uk = () => tl.classList.toggle("on", !!stav.tiles[k]);
  tl.onclick = () => { stav.tiles[k] = !stav.tiles[k]; store.set("tiles", stav.tiles); uk(); };
  uk();
});

/* ---------------- navigace ---------------- */
function ukazObrazovku(id) {
  ["#lockscreen", "#homescreen", "#appscreen"].forEach((s) =>
    $(s).classList.toggle("visible", s === id));
}
function domu() {
  stav.bezici = null;
  $("#notifpanel").classList.remove("open");
  ukazObrazovku("#homescreen");
}
function otevri(id) {
  const app = APPS.find((a) => a.id === id);
  if (!app) return;
  stav.bezici = id;
  $("#app-title").textContent = app.nazev;
  const c = $("#app-content");
  c.innerHTML = "";
  app.render(c);
  ukazObrazovku("#appscreen");
}

$("#lockscreen").onclick = () => {
  $("#lockscreen").classList.add("unlocking");
  setTimeout(() => { stav.odemceno = true; domu(); $("#lockscreen").classList.remove("unlocking"); }, 350);
};
$("#nav-home").onclick = domu;
$("#nav-back").onclick = $("#app-back").onclick = () => stav.bezici ? domu() : null;
$("#nav-recent").onclick = () => pridejNotif("Nedávné aplikace", stav.bezici ? "Běží: " + stav.bezici : "Nic neběží.");

/* ---------------- APLIKACE ---------------- */

/* Telefon */
function appTelefon(c) {
  c.innerHTML = `
    <div id="dial-num"></div>
    <div id="dial-grid"></div>
    <button id="dial-call">📞</button>`;
  const num = $("#dial-num");
  "123456789*0#".split("").forEach((d) => {
    const b = document.createElement("button");
    b.textContent = d;
    b.onclick = () => num.textContent += d;
    $("#dial-grid").appendChild(b);
  });
  $("#dial-call").onclick = () => {
    const n = num.textContent.trim();
    if (!n) return;
    /* na skutecnem telefonu otevre vytaceni */
    location.href = "tel:" + n;
    pridejNotif("Telefon", "Volám " + n + "…");
  };
}

/* Zpravy */
function appZpravy(c) {
  const z = store.get("zpravy", []);
  c.innerHTML = `
    <div id="zpr-list">${z.map((m) =>
      `<div class="bubble">${esc(m.txt)}<small>${hhmm(new Date(m.cas))}</small></div>`).join("")
      || `<p style="color:var(--muted)">Žádné zprávy. Napiš první!</p>`}</div>
    <div class="row" style="margin-top:12px">
      <input id="zpr-in" placeholder="Napiš zprávu…">
      <button class="btn" id="zpr-send">➤</button>
    </div>`;
  const posli = () => {
    const t = $("#zpr-in").value.trim();
    if (!t) return;
    z.push({ txt: t, cas: Date.now() });
    store.set("zpravy", z);
    pridejNotif("Zprávy", "Odesláno: " + t.slice(0, 30));
    appZpravy(c);
  };
  $("#zpr-send").onclick = posli;
  $("#zpr-in").onkeydown = (e) => e.key === "Enter" && posli();
}

/* Kontakty */
function appKontakty(c) {
  const k = store.get("kontakty", [
    { j: "Máma", t: "+420 601 111 222" },
    { j: "Táta", t: "+420 602 333 444" },
    { j: "Linsoft HQ", t: "+420 800 123 456" }
  ]);
  c.innerHTML = `
    <div>${k.map((x, i) => `
      <div class="list-item">
        <div class="avatar">${esc(x.j[0] || "?")}</div>
        <div style="flex:1"><div>${esc(x.j)}</div><div class="sub">${esc(x.t)}</div></div>
        <a class="btn" style="text-decoration:none" href="tel:${esc(x.t.replace(/ /g, ""))}">📞</a>
        <button class="btn ghost" data-del="${i}">🗑</button>
      </div>`).join("")}</div>
    <div class="row" style="margin-top:14px"><input id="kt-j" placeholder="Jméno"><input id="kt-t" placeholder="Číslo"></div>
    <button class="btn" id="kt-add" style="width:100%">Přidat kontakt</button>`;
  $("#kt-add").onclick = () => {
    if (!$("#kt-j").value.trim()) return;
    k.push({ j: $("#kt-j").value.trim(), t: $("#kt-t").value.trim() });
    store.set("kontakty", k);
    appKontakty(c);
  };
  c.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
    k.splice(+b.dataset.del, 1);
    store.set("kontakty", k);
    appKontakty(c);
  });
}

/* Kalkulacka */
function appKalk(c) {
  c.innerHTML = `<div id="calc-disp">0</div><div id="calc-grid"></div>`;
  const d = $("#calc-disp");
  let v = "";
  const tl = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ",", "⌫", "="];
  tl.forEach((t) => {
    const b = document.createElement("button");
    b.textContent = t;
    if ("÷×−+=C⌫".includes(t)) b.className = "op";
    b.onclick = () => {
      if (t === "C") v = "";
      else if (t === "⌫") v = v.slice(0, -1);
      else if (t === "=") {
        try {
          const ex = v.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/,/g, ".");
          if (!/^[0-9+\-*/(). ]+$/.test(ex)) throw 0;
          v = String(Function('"use strict";return(' + ex + ")")()).replace(".", ",");
        } catch { v = "Chyba"; }
      }
      else v = (v === "Chyba" ? "" : v) + t;
      d.textContent = v || "0";
    };
    $("#calc-grid").appendChild(b);
  });
}

/* Hodiny + stopky */
function appHodiny(c) {
  c.innerHTML = `
    <div style="text-align:center;font-size:64px;font-weight:200" id="hd-cas"></div>
    <div style="text-align:center;color:var(--muted)" id="hd-datum"></div>
    <hr style="margin:20px 0;border-color:var(--muted)">
    <div style="text-align:center;font-size:42px" id="st-cas">0,0 s</div>
    <div class="row" style="justify-content:center;margin-top:12px">
      <button class="btn" id="st-start">Start</button>
      <button class="btn ghost" id="st-reset">Reset</button>
    </div>`;
  let beh = null, zac = 0, nab = 0;
  const uk = () => {
    $("#hd-cas").textContent = new Date().toLocaleTimeString("cs");
    $("#hd-datum").textContent = datumText();
    if (beh) $("#st-cas").textContent = ((nab + Date.now() - zac) / 1000).toFixed(1).replace(".", ",") + " s";
  };
  const iv = setInterval(() => { if (!document.contains(c)) return clearInterval(iv); uk(); }, 100);
  uk();
  $("#st-start").onclick = () => {
    if (beh) { nab += Date.now() - zac; beh = null; $("#st-start").textContent = "Start"; }
    else { zac = Date.now(); beh = true; $("#st-start").textContent = "Stop"; }
  };
  $("#st-reset").onclick = () => { nab = 0; zac = Date.now(); $("#st-cas").textContent = "0,0 s"; };
}

/* Kalendar */
function appKalendar(c) {
  const d = new Date();
  const prvni = new Date(d.getFullYear(), d.getMonth(), 1);
  const dnu = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const posun = (prvni.getDay() + 6) % 7; /* pondeli prvni */
  let b = `<h3 style="text-align:center;margin-bottom:12px">${MESICE[d.getMonth()]} ${d.getFullYear()}</h3><div id="cal-grid">`;
  ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].forEach((x) => b += `<div class="hd">${x}</div>`);
  for (let i = 0; i < posun; i++) b += "<div></div>";
  for (let i = 1; i <= dnu; i++)
    b += `<div class="day${i === d.getDate() ? " today" : ""}">${i}</div>`;
  c.innerHTML = b + "</div>";
}

/* Poznamky */
function appPoznamky(c) {
  const p = store.get("poznamky", "");
  c.innerHTML = `
    <textarea id="pz" rows="14" placeholder="Piš si poznámky… ukládají se automaticky.">${esc(p)}</textarea>
    <p style="color:var(--muted);font-size:12px;margin-top:8px">Uloženo v telefonu (localStorage).</p>`;
  $("#pz").oninput = () => store.set("poznamky", $("#pz").value);
}

/* Galerie */
function appGalerie(c) {
  const fotky = store.get("fotky", []);
  c.innerHTML = fotky.length
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${fotky.map((f) =>
        `<img src="${f}" style="width:100%;border-radius:12px">`).join("")}</div>
       <button class="btn ghost" id="gal-del" style="width:100%;margin-top:12px">Smazat vše</button>`
    : `<p style="color:var(--muted)">Galerie je prázdná. Vyfoť něco ve Fotoaparátu! 📷</p>`;
  const del = $("#gal-del");
  if (del) del.onclick = () => { store.set("fotky", []); appGalerie(c); };
}

/* Fotoaparat (skutecna kamera pres getUserMedia) */
function appFotak(c) {
  c.innerHTML = `
    <video id="cam-video" autoplay playsinline></video>
    <button class="btn" id="cam-snap" style="width:100%;margin-top:10px">📸 Vyfotit</button>
    <canvas id="cam-cv" hidden></canvas>
    <div id="cam-out"></div>`;
  const video = $("#cam-video");
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
    .then((s) => {
      video.srcObject = s;
      const stop = setInterval(() => {
        if (!document.contains(video)) { s.getTracks().forEach((t) => t.stop()); clearInterval(stop); }
      }, 500);
    })
    .catch(() => c.insertAdjacentHTML("afterbegin",
      `<p style="color:var(--muted)">Kamera není dostupná (potřebuje HTTPS a povolení).</p>`));
  $("#cam-snap").onclick = () => {
    const cv = $("#cam-cv");
    cv.width = video.videoWidth || 320;
    cv.height = video.videoHeight || 240;
    cv.getContext("2d").drawImage(video, 0, 0);
    const data = cv.toDataURL("image/jpeg", .8);
    const fotky = store.get("fotky", []);
    fotky.unshift(data);
    store.set("fotky", fotky.slice(0, 12));
    pridejNotif("Fotoaparát", "Fotka uložena do Galerie.");
    $("#cam-out").innerHTML = `<img id="cam-shot" src="${data}">`;
  };
}

/* Terminal - stejne prikazy jako kernel verze */
function appTerminal(c) {
  c.innerHTML = `<div id="term"></div><input id="term-in" placeholder="napis prikaz… (pomoc)">`;
  const t = $("#term");
  const start = Date.now();
  const w = (s) => { t.textContent += s + "\n"; t.scrollTop = t.scrollHeight; };
  w("=== LinsoftPhone OS 2.0 (PWA) ===");
  w("Napis 'pomoc' pro seznam prikazu.\n");
  $("#term-in").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const cmd = $("#term-in").value.trim();
    $("#term-in").value = "";
    w("linsoft> " + cmd);
    if (cmd === "pomoc") w("pomoc, info, cas, kalk <vyraz>, vymaz");
    else if (cmd === "info") w(`Verze: 2.0 PWA\nPlatforma: ${navigator.platform}\nJazyk: ${navigator.language}\nOnline: ${navigator.onLine ? "ano" : "ne"}`);
    else if (cmd === "cas") w("Doba behu: " + Math.round((Date.now() - start) / 1000) + " s");
    else if (cmd === "vymaz") t.textContent = "";
    else if (cmd.startsWith("kalk ")) {
      try {
        const ex = cmd.slice(5);
        if (!/^[0-9+\-*/(). ]+$/.test(ex)) throw 0;
        w("= " + Function('"use strict";return(' + ex + ")")());
      } catch { w("Chyba: neplatny vyraz."); }
    }
    else if (cmd) w("Neznamy prikaz: '" + cmd + "'. Napis 'pomoc'.");
  };
}

/* Nastaveni */
function appNastaveni(c) {
  const svetly = document.body.classList.contains("light");
  c.innerHTML = `
    <div class="list-item"><div style="flex:1">🌗 Světlý motiv</div>
      <button class="btn ${svetly ? "" : "ghost"}" id="st-theme">${svetly ? "Zap" : "Vyp"}</button></div>
    <div class="list-item"><div style="flex:1">📱 O systému</div></div>
    <div style="color:var(--muted);font-size:14px;padding:0 6px;line-height:1.7">
      LinsoftPhone OS 2.0 (PWA)<br>
      Běží jako progresivní webová aplikace — funguje na Androidu, iPhonu i počítači.<br>
      Nainstaluj přes menu prohlížeče: „Přidat na plochu".
    </div>
    <button class="btn ghost" id="st-reset" style="width:100%;margin-top:16px">🗑 Tovární nastavení (smazat data)</button>`;
  $("#st-theme").onclick = () => {
    document.body.classList.toggle("light");
    store.set("svetly", document.body.classList.contains("light"));
    appNastaveni(c);
  };
  $("#st-reset").onclick = () => {
    if (confirm("Opravdu smazat všechna data?")) {
      Object.keys(localStorage).filter((k) => k.startsWith("lp_")).forEach((k) => localStorage.removeItem(k));
      location.reload();
    }
  };
}

/* ---------------- registr aplikaci ---------------- */
const APPS = [
  { id: "telefon", nazev: "Telefon", ikona: "📞", barva: "#44cc66", render: appTelefon, dock: true },
  { id: "zpravy", nazev: "Zprávy", ikona: "💬", barva: "#3fa7f5", render: appZpravy, dock: true },
  { id: "kontakty", nazev: "Kontakty", ikona: "👤", barva: "#f5913f", render: appKontakty },
  { id: "kalk", nazev: "Kalkulačka", ikona: "🧮", barva: "#8e6cf0", render: appKalk },
  { id: "hodiny", nazev: "Hodiny", ikona: "⏰", barva: "#f0556c", render: appHodiny },
  { id: "kalendar", nazev: "Kalendář", ikona: "📅", barva: "#2bb8a8", render: appKalendar },
  { id: "poznamky", nazev: "Poznámky", ikona: "📝", barva: "#e8c441", render: appPoznamky },
  { id: "fotak", nazev: "Fotoaparát", ikona: "📷", barva: "#5a6c87", render: appFotak, dock: true },
  { id: "galerie", nazev: "Galerie", ikona: "🖼", barva: "#d05ac4", render: appGalerie },
  { id: "terminal", nazev: "Terminál", ikona: "🖥", barva: "#1c7a3d", render: appTerminal },
  { id: "nastaveni", nazev: "Nastavení", ikona: "⚙️", barva: "#6b7a90", render: appNastaveni, dock: true }
];

function ikonka(app, bezPopisku) {
  const b = document.createElement("button");
  b.className = "appicon";
  b.innerHTML = `<span class="glyph" style="background:${app.barva}">${app.ikona}</span>` +
    (bezPopisku ? "" : `<span>${app.nazev}</span>`);
  b.onclick = () => otevri(app.id);
  return b;
}
APPS.forEach((a) => $("#appgrid").appendChild(ikonka(a)));
APPS.filter((a) => a.dock).forEach((a) => $("#dock").appendChild(ikonka(a, true)));

/* ---------------- start ---------------- */
if (store.get("svetly", false)) document.body.classList.add("light");
kresliNotif();

if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("sw.js").catch(() => {});
