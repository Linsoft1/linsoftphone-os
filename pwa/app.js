/* LinsoftPhone OS PWA - hlavni logika (DOM); cista logika a preklady jsou v core.js */
"use strict";
/* bez ?? ?. a catch{} - aby skript bezel i na starsich Androidech a iOS (hlida test) */

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) {
    try { const v = JSON.parse(localStorage.getItem("lp_" + k)); return v === null ? d : v; }
    catch (e) { return d; }
  },
  /* localStorage muze chybet (anonymni rezim) nebo byt plny - vraci uspech */
  set(k, v) {
    try { localStorage.setItem("lp_" + k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }
};

/* vyska displeje pro prohlizece bez jednotky dvh (iOS < 15.4, Android Chrome < 108) */
function nastavVysku() {
  document.documentElement.style.setProperty("--vh", window.innerHeight * 0.01 + "px");
}
nastavVysku();
window.addEventListener("resize", nastavVysku);
window.addEventListener("orientationchange", () => setTimeout(nastavVysku, 200));

/* iOS Safari aktivuje :active jen kdyz existuje touch listener */
document.addEventListener("touchstart", () => {}, { passive: true });

const JE_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* ---------------- stav ---------------- */
const VERZE_OS = "2.3";
const ZOSTAVENI = "2026.10.31";

const stav = {
  jazyk: store.get("jazyk", Core.vychoziJazyk(navigator.language)),
  bezici: null,
  zamceno: true,
  pin: store.get("pin", null),
  nedavne: store.get("nedavne", []),
  notifikace: store.get("notif", null),
  notifSys: store.get("notifsys", false),
  budiky: store.get("budiky", []),
  minutka: store.get("minutka", null),
  stopky: { beh: false, zac: 0, nab: 0 },
  kalVyber: null
};
const t = (k, p) => Core.preklad(stav.jazyk, k, p);
if (!stav.notifikace) stav.notifikace = [{ t: t("vitej_t"), s: t("vitej_s"), cas: Date.now() }];

function esc(x) {
  return String(x).replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* preklad statickeho HTML (data-i18n = text, data-i18n-label = popis pro ctecky) */
function prelozStranku() {
  document.documentElement.lang = stav.jazyk;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-label]").forEach((el) =>
    el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
}

/* ---------------- hodiny / datum ---------------- */
function tick() {
  const d = new Date(), c = Core.hhmm(d), dt = Core.datumText(stav.jazyk, d);
  $("#sb-time").textContent = c;
  $("#lock-clock").textContent = c;
  $("#lock-date").textContent = dt;
  $("#w-time").textContent = c;
  $("#w-date").textContent = dt;
  $("#sb-alarm").hidden = !stav.minutka && !stav.budiky.some((b) => b.zap);
  if (d.getSeconds() === 0 || !tick.hotovo) { kresliDnes(d); tick.hotovo = true; }
  hlidejBudiky(d);
}

/* nejblizsi zapnuty budik od ted (dnes nebo zitra) */
function dalsiBudik(d) {
  const ted = d.getHours() * 60 + d.getMinutes();
  let nej = null;
  stav.budiky.forEach((b) => {
    if (!b.zap) return;
    const za = (b.h * 60 + b.m - ted + 1440) % 1440;
    if (nej === null || za < nej.za) nej = { za, text: Core.dva(b.h) + ":" + Core.dva(b.m) };
  });
  return nej;
}
/* widget "Dnes" na plose a radek na zamykaci obrazovce */
function kresliDnes(d) {
  const b = dalsiBudik(d);
  const udalosti = store.get("udalosti", {})[Core.denKlic(d)] || [];
  const radek = (ik, text) => `<div class="w-radek">${Ikony.ikona(ik)}<span>${esc(text)}</span></div>`;
  $("#w-info").innerHTML =
    (b ? radek("budik", t("w_budik") + " " + b.text) : "") +
    (udalosti.length ? udalosti.slice(0, 2).map((u) => radek("udalost", u)).join("") : radek("udalost", t("w_volno")));
  $("#lock-info").innerHTML = b ? Ikony.ikona("budik") + " " + b.text : "";
}

/* ---------------- stavovy radek (vlastni ikony) ---------------- */
const sb = { sila: 4, wifi: navigator.onLine !== false, bat: null };
function kresliStavovyRadek() {
  $("#sb-net").innerHTML = sb.sila === null ? "" : Ikony.signal(sb.sila);
  $("#sb-wifi").innerHTML = sb.wifi ? Ikony.ikona("wifi", "sb") : "";
  $("#sb-batt").innerHTML = sb.bat ? `<span class="sb-pct">${sb.bat.uroven}</span>${Ikony.baterie(sb.bat.uroven, sb.bat.nabiji)}` : "";
}
window.addEventListener("online", () => { sb.wifi = true; kresliStavovyRadek(); });
window.addEventListener("offline", () => { sb.wifi = false; kresliStavovyRadek(); });

/* staticke ikony v HTML: data-ikona="nazev" */
document.querySelectorAll("[data-ikona]").forEach((el) =>
  el.insertAdjacentHTML("afterbegin", Ikony.ikona(el.dataset.ikona)));
$("#sb-alarm").innerHTML = Ikony.ikona("budik", "sb");
$("#lock-torch").innerHTML = Ikony.ikona("svitilna");
$("#lock-cam").innerHTML = Ikony.ikona("fotak");
$("#lock-sipka").innerHTML = Ikony.ikona("nahoru");

/* skutecna baterie, pokud ji prohlizec umi */
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const uk = () => {
      if (Nativ.aktivni) return; /* na LinsoftPhone OS hlasi baterii sluzba telefonu */
      sb.bat = { uroven: Math.round(b.level * 100), nabiji: b.charging };
      kresliStavovyRadek();
    };
    b.addEventListener("levelchange", uk);
    b.addEventListener("chargingchange", uk);
    uk();
  }).catch(() => {});
}

/* ---------------- zvuk, vibrace, budiky ---------------- */
let audio = null;
/* prohlizece pusti zvuk az po dotyku uzivatele - pripravime ho pri kazdem klepnuti */
function pripravZvuk() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) try { audio = new AC(); } catch (e) { audio = null; }
  }
  if (audio && audio.state === "suspended") audio.resume();
}
document.addEventListener("click", pripravZvuk);

function pipni() {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = 880;
  g.gain.value = 0.2;
  o.connect(g); g.connect(audio.destination);
  o.start(); o.stop(audio.currentTime + 0.25);
}

let zvoneni = null;
function zazvon(text) {
  if (zvoneni) return;
  $("#alarm-text").textContent = text;
  $("#alarm").hidden = false;
  pridejNotif("⏰ LinsoftOS", text, true);
  pipni();
  zvoneni = setInterval(() => { pipni(); if (navigator.vibrate) navigator.vibrate(300); }, 700);
}
$("#alarm-stop").onclick = () => {
  clearInterval(zvoneni); zvoneni = null;
  $("#alarm").hidden = true;
  if (navigator.vibrate) navigator.vibrate(0);
};

function hlidejBudiky(d) {
  stav.budiky.forEach((b) => {
    if (!Core.budikMaZvonit(b, d)) return;
    b.posledni = Core.denKlic(d);
    store.set("budiky", stav.budiky);
    zazvon(t("budik_zvoni", Core.dva(b.h) + ":" + Core.dva(b.m)));
  });
  if (stav.minutka && Date.now() >= stav.minutka.konec) {
    stav.minutka = null;
    store.set("minutka", null);
    zazvon(t("minutka_konec"));
  }
}

/* ---------------- notifikace ---------------- */
function pridejNotif(nadpis, s, vzdySystemove) {
  stav.notifikace.unshift({ t: nadpis, s, cas: Date.now() });
  stav.notifikace = stav.notifikace.slice(0, 20);
  store.set("notif", stav.notifikace);
  kresliNotif();
  if (vzdySystemove || document.hidden) systemNotif(nadpis, s);
}
/* skutecna notifikace telefonu (Android: pres service worker; iOS 16.4+ jen nainstalovana PWA) */
function systemNotif(nadpis, s) {
  if (!stav.notifSys || !("Notification" in window) || Notification.permission !== "granted") return;
  const opt = { body: s, icon: "icons/icon-192.png", badge: "icons/icon-192.png" };
  const primo = () => { try { new Notification(nadpis, opt); } catch (e) { /* Android bez SW */ } };
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistration)
    navigator.serviceWorker.getRegistration()
      .then((r) => r ? r.showNotification(nadpis, opt) : primo())
      .catch(primo);
  else primo();
}
function kresliNotif() {
  $("#notif-list").innerHTML = stav.notifikace.map((n) =>
    `<div class="notif"><strong>${esc(n.t)}</strong> ${esc(n.s)}<small>${Core.hhmm(new Date(n.cas))}</small></div>`
  ).join("") || `<div class="notif">${esc(t("notif_zadne"))}</div>`;
  /* na zamykaci obrazovce dve posledni */
  $("#lock-notif").innerHTML = stav.notifikace.slice(0, 2).map((n) =>
    `<div class="lock-karta"><strong>${esc(n.t)}</strong><span>${esc(n.s)}</span><small>${Core.hhmm(new Date(n.cas))}</small></div>`
  ).join("");
}
function panel(otevrit) { $("#notifpanel").classList.toggle("open", otevrit); }
const panelOtevreny = () => $("#notifpanel").classList.contains("open");

$("#statusbar").onclick = () => panel(!panelOtevreny());
$("#statusbar").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") panel(!panelOtevreny()); };
$("#notif-clear").onclick = () => { stav.notifikace = []; store.set("notif", []); kresliNotif(); };

/* ---------------- rychle dlazdice (vsechny skutecne funguji) ---------------- */
let svitilna = null;
const celaObrazovka = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

function stavDlazdic() {
  $("#lock-torch").classList.toggle("on", !!svitilna);
  const zap = { torch: !!svitilna, motiv: document.body.classList.contains("light"), full: celaObrazovka(), zamek: false };
  document.querySelectorAll(".tile").forEach((tl) => {
    tl.classList.toggle("on", zap[tl.dataset.tile]);
    tl.setAttribute("aria-pressed", String(zap[tl.dataset.tile]));
  });
}
function prepniSvitilnu() {
  if (svitilna) {
    svitilna.getTracks().forEach((x) => x.stop());
    svitilna = null;
    return stavDlazdic();
  }
  const ne = () => pridejNotif(t("tile_torch"), t("torch_ne"));
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return ne();
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
    const stop = () => s.getTracks().forEach((x) => x.stop());
    const tr = s.getVideoTracks()[0];
    const umi = tr && tr.getCapabilities ? tr.getCapabilities() : {};
    if (!umi.torch) { stop(); throw new Error("torch"); }
    return tr.applyConstraints({ advanced: [{ torch: true }] })
      .then(() => { svitilna = s; stavDlazdic(); }, (e) => { stop(); throw e; });
  }).catch(ne);
}
function prepniCelouObrazovku() {
  const el = document.documentElement;
  if (celaObrazovka()) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  const f = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!f) return pridejNotif(t("tile_full"), t("full_ne"));
  const p = f.call(el);
  if (p && p.catch) p.catch(() => pridejNotif(t("tile_full"), t("full_ne")));
}
function nastavMotiv(svetly) {
  document.body.classList.toggle("light", svetly);
  store.set("svetly", svetly);
  $('meta[name="theme-color"]').setAttribute("content", svetly ? "#e9eef6" : "#0b1220");
  stavDlazdic();
}
document.addEventListener("fullscreenchange", stavDlazdic);
document.addEventListener("webkitfullscreenchange", stavDlazdic);
document.querySelectorAll(".tile").forEach((tl) => {
  tl.onclick = () => ({
    torch: prepniSvitilnu,
    motiv: () => nastavMotiv(!document.body.classList.contains("light")),
    full: prepniCelouObrazovku,
    zamek: zamkni
  })[tl.dataset.tile]();
});

/* ---------------- tapety ---------------- */
const TAPETY = ["polar", "zapad", "les", "noc"];
function nastavTapetu(nazev, data) {
  TAPETY.concat("foto").forEach((x) => document.body.classList.toggle("tapeta-" + x, x === nazev));
  if (data) document.body.style.setProperty("--foto", `url("${data}")`);
  store.set("tapeta", nazev);
}
function nactiTapetu() {
  const nazev = store.get("tapeta", "polar");
  if (nazev !== "foto") return nastavTapetu(TAPETY.indexOf(nazev) >= 0 ? nazev : "polar");
  nastavTapetu("polar");
  Fotky.vse().then((f) => {
    const x = f.find((y) => String(y.id) === String(store.get("tapetaFoto", "")));
    if (x) nastavTapetu("foto", x.data);
  });
}

/* ---------------- gesta (potahnuti prstem) ---------------- */
function swipe(el, cb) {
  let x0 = null, y0 = 0;
  const zac = (x, y) => { x0 = x; y0 = y; };
  const kon = (x, y) => {
    if (x0 === null) return;
    const dx = x - x0, dy = y - y0;
    x0 = null;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) cb(dy < 0 ? "nahoru" : "dolu", y0);
  };
  el.addEventListener("touchstart", (e) => zac(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  el.addEventListener("touchend", (e) => kon(e.changedTouches[0].clientX, e.changedTouches[0].clientY));
  el.addEventListener("mousedown", (e) => zac(e.clientX, e.clientY));
  el.addEventListener("mouseup", (e) => kon(e.clientX, e.clientY));
}
const odHornihoOkraje = (y) => y - $("#phone").getBoundingClientRect().top;

swipe($("#statusbar"), (smer) => { if (smer === "dolu") panel(true); });
swipe($("#homescreen"), (smer, y) => { if (smer === "dolu" && odHornihoOkraje(y) < 220) panel(true); });
swipe($("#notifpanel"), (smer) => {
  const p = $("#notifpanel");
  if (smer === "nahoru" && p.scrollTop + p.clientHeight >= p.scrollHeight - 2) panel(false);
});
swipe($("#lockscreen"), (smer) => { if (smer === "nahoru") pokusOdemknout(); });

/* ---------------- zamek a PIN ---------------- */
/* klavesnice na PIN; po 4 cislicich zavola hotovo(pin) */
function pinPad(box, hotovo) {
  box.innerHTML = `<div class="pin-dots"></div><div class="pin-pad"></div>`;
  const tecky = box.querySelector(".pin-dots"), pad = box.querySelector(".pin-pad");
  let pin = "";
  const kresli = () => tecky.innerHTML =
    [0, 1, 2, 3].map((i) => `<span class="${i < pin.length ? "full" : ""}"></span>`).join("");
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].forEach((k) => {
    const b = document.createElement("button");
    b.textContent = k;
    if (!k) { b.disabled = true; b.className = "empty"; }
    if (k === "⌫") b.setAttribute("aria-label", t("smazat"));
    b.onclick = (e) => {
      e.stopPropagation();
      if (k === "⌫") pin = pin.slice(0, -1);
      else if (pin.length < 4) pin += k;
      kresli();
      if (pin.length === 4) { const p = pin; setTimeout(() => { pin = ""; kresli(); hotovo(p); }, 120); }
    };
    pad.appendChild(b);
  });
  kresli();
  return {
    chyba() {
      tecky.classList.remove("shake");
      void tecky.offsetWidth; /* restart animace */
      tecky.classList.add("shake");
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };
}

function zamkni() {
  stav.zamceno = true;
  panel(false);
  $("#lock-pin").hidden = true;
  $("#lockscreen").classList.remove("pin");
  $("#lockscreen").classList.add("visible");
  barvyListy();
}
let poOdemknuti = null; /* aplikace, ktera se otevre po odemknuti (tlacitko fotoaparatu) */
function odemkni() {
  stav.zamceno = false;
  $("#lockscreen").classList.add("unlocking");
  setTimeout(() => {
    $("#lockscreen").classList.remove("visible", "unlocking", "pin");
    $("#lock-pin").hidden = true;
    barvyListy();
    if (!stav.bezici) animujPlochu();
    if (poOdemknuti) { otevri(poOdemknuti); poOdemknuti = null; }
  }, 350);
}
function pokusOdemknout() {
  if (!stav.zamceno) return;
  if (!stav.pin) return odemkni();
  if (!$("#lock-pin").hidden) return;
  $("#lockscreen").classList.add("pin");
  $("#lock-pin").hidden = false;
  $("#lock-pin-title").textContent = t("pin_zadej");
  const pad = pinPad($("#lock-pin-box"), (p) => {
    if (Core.pinHash(p) === stav.pin) odemkni();
    else { $("#lock-pin-title").textContent = t("pin_spatne"); pad.chyba(); }
  });
}
$("#lockscreen").onclick = pokusOdemknout;
/* rychla tlacitka na zamykaci obrazovce: svitilna hned, fotoaparat po odemknuti */
$("#lock-torch").onclick = (e) => { e.stopPropagation(); prepniSvitilnu(); };
$("#lock-cam").onclick = (e) => { e.stopPropagation(); poOdemknuti = "fotak"; pokusOdemknout(); };
/* s PINem se telefon zamkne pri kazdem odchodu z aplikace */
document.addEventListener("visibilitychange", () => { if (document.hidden && stav.pin) zamkni(); });

/* ---------------- navigace ---------------- */
function ukazObrazovku(id) {
  ["#homescreen", "#appscreen", "#recents"].forEach((s) =>
    $(s).classList.toggle("visible", s === id));
  barvyListy();
}
/* stavovy radek a navigace: bile na tapete, v aplikaci podle motivu */
function barvyListy() {
  document.body.classList.toggle("v-app", !stav.zamceno && !$("#homescreen").classList.contains("visible"));
}
/* ikony na plose "priletí" po odemknuti a pri navratu z aplikace */
function animujPlochu() {
  const h = $("#homescreen");
  h.classList.remove("vstup");
  void h.offsetWidth;
  h.classList.add("vstup");
}
/* zaznam v historii -> systemove gesto/tlacitko Zpet na Androidu vrati na plochu */
function zapisHistorii(id) {
  if (history.state && history.state.app) history.replaceState({ app: id }, "");
  else history.pushState({ app: id }, "");
}
/* "Zpet" uvnitr aplikace (napr. z detailu kontaktu do seznamu) - nastavuje aplikace */
let vnitrniZpet = null;

function domu() {
  if (stav.bezici || nedavneOtevrene()) animujPlochu();
  stav.bezici = null;
  vnitrniZpet = null;
  kresliDnes(new Date());
  panel(false);
  ukazObrazovku("#homescreen");
}
function zavriApp() {
  if (history.state && history.state.app) history.back(); /* popstate zavola domu() */
  else domu();
}
const nedavneOtevrene = () => $("#recents").classList.contains("visible");
window.addEventListener("popstate", () => {
  if (stav.bezici || panelOtevreny() || nedavneOtevrene()) domu();
});

function otevri(id, param) {
  const app = najdiApp(id);
  if (!app) return;
  stav.bezici = id;
  vnitrniZpet = null;
  stav.nedavne = [id].concat(stav.nedavne.filter((x) => x !== id)).slice(0, 8);
  store.set("nedavne", stav.nedavne);
  $("#app-title").textContent = t("app_" + id);
  const c = $("#app-content");
  c.innerHTML = "";
  c.scrollTop = 0;
  app.render(c, param);
  panel(false);
  ukazObrazovku("#appscreen");
  zapisHistorii(id);
}

function ukazNedavne() {
  stav.bezici = null;
  panel(false);
  const l = $("#recents-list");
  const appky = stav.nedavne.map(najdiApp).filter(Boolean);
  l.innerHTML = appky.length ? "" : `<p class="muted">${esc(t("nedavne_zadne"))}</p>`;
  appky.forEach((a) => {
    const k = document.createElement("div");
    k.className = "recent-card";
    k.innerHTML = `<button class="recent-open">${glyph(a)}` +
      `<span>${esc(t("app_" + a.id))}</span></button>` +
      `<button class="recent-x" aria-label="${esc(t("smazat"))}">✕</button>`;
    k.querySelector(".recent-open").onclick = () => otevri(a.id);
    k.querySelector(".recent-x").onclick = () => {
      stav.nedavne = stav.nedavne.filter((x) => x !== a.id);
      store.set("nedavne", stav.nedavne);
      ukazNedavne();
    };
    l.appendChild(k);
  });
  ukazObrazovku("#recents");
  zapisHistorii("nedavne");
}
$("#recents-clear").onclick = () => { stav.nedavne = []; store.set("nedavne", []); zavriApp(); };

$("#nav-home").onclick = zavriApp;
$("#nav-back").onclick = $("#app-back").onclick = () => {
  if (panelOtevreny()) panel(false);
  else if (vnitrniZpet) { const f = vnitrniZpet; vnitrniZpet = null; f(); }
  else if (stav.bezici || nedavneOtevrene()) zavriApp();
};
$("#nav-recent").onclick = () => nedavneOtevrene() ? zavriApp() : ukazNedavne();

/* ---------------- fotky: IndexedDB (stovky MB), zalozne localStorage ---------------- */
const Fotky = (function () {
  let db = null;
  function otevriDb() {
    if (db) return Promise.resolve(db);
    return new Promise((ok, ko) => {
      if (!window.indexedDB) return ko(new Error("indexedDB"));
      let r;
      try { r = indexedDB.open("linsoftos", 1); } catch (e) { return ko(e); }
      r.onupgradeneeded = () => r.result.createObjectStore("fotky", { keyPath: "id", autoIncrement: true });
      r.onsuccess = () => { db = r.result; ok(db); };
      r.onerror = () => ko(r.error);
    });
  }
  function tx(rezim, fn) {
    return otevriDb().then((d) => new Promise((ok, ko) => {
      const x = d.transaction("fotky", rezim);
      const req = fn(x.objectStore("fotky"));
      x.oncomplete = () => ok(req ? req.result : undefined);
      x.onerror = x.onabort = () => ko(x.error);
    }));
  }
  const zLs = () => store.get("fotky", []);
  return {
    vse() { return tx("readonly", (s) => s.getAll()).then((a) => a.reverse()).catch(zLs); },
    pridej(data) {
      return tx("readwrite", (s) => s.add({ data, cas: Date.now() })).catch(() => {
        let f = [{ id: Date.now(), data, cas: Date.now() }].concat(zLs()).slice(0, 12);
        while (!store.set("fotky", f) && f.length > 1) f = f.slice(0, -1);
      });
    },
    smaz(id) {
      return tx("readwrite", (s) => s.delete(id))
        .catch(() => { store.set("fotky", zLs().filter((f) => f.id !== id)); });
    },
    smazVse() {
      return tx("readwrite", (s) => s.clear()).catch(() => { store.set("fotky", []); });
    },
    /* starsi verze ukladala fotky jako texty do localStorage - presun do IndexedDB */
    migrace() {
      const f = zLs();
      if (!f.length) return;
      const norm = f.map((x, i) => typeof x === "string" ? { id: i + 1, data: x, cas: 0 } : x);
      store.set("fotky", norm);
      tx("readwrite", (s) => { norm.slice().reverse().forEach((x) => s.add({ data: x.data, cas: x.cas })); })
        .then(() => localStorage.removeItem("lp_fotky"))
        .catch(() => {});
    }
  };
})();

/* ---------------- zaloha a obnova ---------------- */
function zalohuj() {
  Fotky.vse().then((f) => {
    const data = {};
    Object.keys(localStorage).forEach((k) => {
      if (k.indexOf("lp_") === 0 && k !== "lp_fotky") data[k] = localStorage.getItem(k);
    });
    const z = { app: "linsoftos", verze: 1, cas: Date.now(), data, fotky: f.map((x) => x.data) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(z)], { type: "application/json" }));
    a.download = "linsoftos-zaloha-" + Core.denKlic(new Date()) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });
}
function obnov(soubor, hotovo) {
  const r = new FileReader();
  r.onload = () => {
    let z;
    try { z = JSON.parse(r.result); } catch (e) { z = null; }
    if (!Core.platnaZaloha(z)) return hotovo(false);
    Object.keys(z.data).forEach((k) => { try { localStorage.setItem(k, z.data[k]); } catch (e) { /* plno */ } });
    Fotky.smazVse()
      .then(() => z.fotky.slice().reverse().reduce((p, d) => p.then(() => Fotky.pridej(d)), Promise.resolve()))
      .then(() => hotovo(true), () => hotovo(true));
  };
  r.onerror = () => hotovo(false);
  r.readAsText(soubor);
}

/* ---------------- nativni rezim: LinsoftPhone OS jako system telefonu ----------------
 * Na telefonu s postmarketOS bezi lokalni sluzba linsoft-sluzba (postmarketos/),
 * ktera pres /api/ zpristupni modem (hovory, SMS), Wi-Fi, baterii, jas a vypnuti. */
const Nativ = {
  aktivni: false,
  api(cesta, data) {
    const opt = { headers: { "X-Linsoft": "1" } };
    if (data !== undefined) {
      opt.method = "POST";
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(data);
    }
    return fetch("/api/" + cesta, opt).then((r) => r.json().then((j) => {
      if (!r.ok) throw new Error(j.chyba || r.status);
      return j;
    }));
  }
};
function nativChyba(e) { pridejNotif("LinsoftPhone OS", t("chyba_n", e && e.message ? e.message : e)); }

function volat(cislo) {
  if (!Nativ.aktivni) {
    pridejNotif(t("app_telefon"), t("volam", jmenoKCislu(cislo)));
    location.href = "tel:" + cislo; /* telefon s Androidem/iOS otevre sve vytaceni */
    return;
  }
  Nativ.api("volat", { cislo }).then(hlidejHovory, nativChyba);
}
/* odkazy tel: (napr. v Kontaktech) na LinsoftPhone OS voli pres modem */
document.addEventListener("click", (e) => {
  const a = Nativ.aktivni && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
  if (!a) return;
  e.preventDefault();
  volat(Core.cisloTel(a.getAttribute("href").slice(4)));
});

/* ---- hovor: prichozi / odchozi / probihajici ---- */
let hovorId = null, hovorZacatek = 0;
function hlidejHovory() {
  Nativ.api("hovory").then((seznam) => {
    const h = seznam.filter((x) => x.stav !== "terminated")[0];
    if (!h) { hovorId = null; $("#hovor").hidden = true; return; }
    if (h.id !== hovorId) { hovorId = h.id; hovorZacatek = 0; }
    const prichozi = h.stav === "ringing-in" || h.stav === "waiting";
    let text = t("hovor_volam");
    if (prichozi) text = t("hovor_prichozi");
    else if (h.stav === "active") {
      if (!hovorZacatek) hovorZacatek = Date.now();
      const s = Math.floor((Date.now() - hovorZacatek) / 1000);
      text = t("hovor_aktivni") + " · " + Core.dva(Math.floor(s / 60)) + ":" + Core.dva(s % 60);
    }
    const kdo = jmenoKCislu(h.cislo) || h.cislo;
    $("#hovor-avatar").textContent = kdo === h.cislo ? "👤" : kdo[0].toUpperCase();
    $("#hovor-kdo").textContent = kdo;
    $("#hovor-stav").textContent = text;
    $("#hovor-prijmout").hidden = !prichozi;
    if (prichozi) { pipni(); if (navigator.vibrate) navigator.vibrate(400); }
    if ($("#hovor").hidden) {
      $("#hovor").hidden = false;
      if (prichozi) pridejNotif(t("hovor_prichozi"), kdo, true);
    }
  }).catch(() => {});
}
$("#hovor-prijmout").onclick = () => Nativ.api("hovor", { id: hovorId, akce: "accept" }).then(hlidejHovory, nativChyba);
$("#hovor-zavesit").onclick = () => Nativ.api("hovor", { id: hovorId, akce: "hangup" })
  .then(() => { $("#hovor").hidden = true; hlidejHovory(); }, nativChyba);

/* ---- prijate SMS se ukladaji do Zprav ---- */
function hlidejSms() {
  Nativ.api("sms").then((seznam) => {
    const videne = store.get("smsVidene", []);
    const nove = seznam.filter((s) => videne.indexOf(s.id) < 0);
    if (!nove.length) return;
    const z = store.get("zpravy", []);
    nove.forEach((s) => {
      const cas = Date.parse(s.cas);
      z.push({ txt: s.text, komu: s.cislo, cas: isNaN(cas) ? Date.now() : cas, prijata: true });
      pridejNotif("💬 " + jmenoKCislu(s.cislo), s.text, true);
    });
    store.set("zpravy", z.slice(-200));
    store.set("smsVidene", videne.concat(nove.map((s) => s.id)).slice(-500));
    if (stav.bezici === "zpravy") appZpravy($("#app-content"));
  }).catch(() => {});
}

/* ---- stavovy radek: operator, signal, baterie ze skutecneho hardwaru ---- */
function obnovStav() {
  Nativ.api("stav").then((s) => {
    if (s.baterie) sb.bat = { uroven: s.baterie.uroven, nabiji: s.baterie.nabiji };
    $("#sb-operator").textContent = s.modem && s.modem.operator ? s.modem.operator : "LinsoftPhone OS";
    sb.sila = s.modem ? Math.min(4, Math.ceil(s.modem.signal / 25)) : null;
    kresliStavovyRadek();
    stav.jas = s.jas;
  }).catch(() => {});
}

function spustNativ() {
  /* sluzba bezi jen na telefonu s LinsoftPhone OS (127.0.0.1); jinde se nic nedeje */
  if (["127.0.0.1", "localhost"].indexOf(location.hostname) < 0) return;
  Nativ.api("stav").then(() => {
    Nativ.aktivni = true;
    document.body.classList.add("nativ");
    obnovStav();
    hlidejHovory();
    hlidejSms();
    setInterval(obnovStav, 20000);
    setInterval(hlidejHovory, 1500);
    setInterval(hlidejSms, 10000);
    Klavesnice.zapni();
  }).catch(() => {});
}

/* ---------------- vlastni klavesnice na obrazovce ----------------
 * V kiosku (Cage + Cog) neni systemova klavesnice, proto ma LinsoftPhone OS vlastni. */
const Klavesnice = (function () {
  /* rady: retezec = kazdy znak jedna klavesa; spodni rada jako seznam (prepinace vrstev) */
  const SPODNI = ["123", "áé", "␣", ".", "⏎", "▾"];
  const VRSTVY = {
    abc: ["qwertzuiop", "asdfghjkl", "⇧yxcvbnm⌫", SPODNI],
    ABC: ["QWERTZUIOP", "ASDFGHJKL", "⇧YXCVBNM⌫", SPODNI],
    dia: ["áäčďéíĺľňó", "ôŕšťúýž", "ÁČĎÉÍĽŠŤŽ⌫", ["abc", ",", "␣", ".", "⏎", "▾"]],
    num: ["1234567890", "+-*/()#@&", ":;'\"?!%=⌫", ["abc", ",", "␣", ".", "⏎", "▾"]]
  };
  const SPECIALNI = ["⇧", "⌫", "⏎", "␣", "123", "abc", "áé", "▾"];
  let vrstva = "abc", pole = null, skryt = null;
  const kb = $("#klavesnice");

  function kresli() {
    kb.innerHTML = VRSTVY[vrstva].map((radek) => {
      const klavesy = Array.isArray(radek) ? radek : radek.split("");
      return `<div class="kb-radek">${klavesy.map((k) => {
        const zvl = SPECIALNI.indexOf(k) >= 0;
        const popis = k === "␣" ? t("mezera") : k === "▾" ? t("kb_skryt") : k;
        return `<button class="kb-k${zvl ? " zvl" : ""}${k === "␣" ? " mezera" : ""}" data-k="${esc(k)}" aria-label="${esc(popis)}">${esc(k === "␣" ? " " : k)}</button>`;
      }).join("")}</div>`;
    }).join("");
  }

  /* pozice kurzoru; u nekterych typu poli (number, email) ji prohlizec nepovoli */
  function kurzor() {
    try { return typeof pole.selectionStart === "number" ? [pole.selectionStart, pole.selectionEnd] : null; }
    catch (e) { return null; }
  }
  function zmen(hodnota, novyKurzor) {
    pole.value = hodnota;
    try { if (novyKurzor !== null) pole.selectionStart = pole.selectionEnd = novyKurzor; } catch (e) { /* nejde */ }
    pole.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function vloz(s) {
    if (!pole) return;
    const v = pole.value, kz = kurzor();
    if (!kz) return zmen(v + s, null);
    zmen(v.slice(0, kz[0]) + s + v.slice(kz[1]), kz[0] + s.length);
  }
  function smaz() {
    if (!pole) return;
    const v = pole.value, kz = kurzor();
    if (!kz) return zmen(v.slice(0, -1), null);
    if (kz[0] !== kz[1]) return zmen(v.slice(0, kz[0]) + v.slice(kz[1]), kz[0]);
    if (kz[0] > 0) zmen(v.slice(0, kz[0] - 1) + v.slice(kz[0]), kz[0] - 1);
  }

  function stisk(k) {
    if (k === "⇧") vrstva = vrstva === "abc" ? "ABC" : "abc";
    else if (k === "123") vrstva = "num";
    else if (k === "abc") vrstva = "abc";
    else if (k === "áé") vrstva = "dia";
    else if (k === "⌫") return smaz();
    else if (k === "▾") return schovej();
    else if (k === "⏎") {
      if (pole && pole.tagName === "TEXTAREA") return vloz("\n");
      if (pole) pole.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      return;
    } else {
      vloz(k === "␣" ? " " : k);
      if (vrstva === "ABC") vrstva = "abc"; /* velke pismeno jen jednou, jako na telefonu */
      else return;
    }
    kresli();
  }

  function ukaz(el) {
    clearTimeout(skryt);
    pole = el;
    vrstva = el.type === "tel" || el.type === "number" ? "num" : "abc";
    kresli();
    kb.hidden = false;
    $("#phone").classList.add("kb");
    setTimeout(() => el.scrollIntoView({ block: "center" }), 50);
  }
  function schovej() {
    kb.hidden = true;
    $("#phone").classList.remove("kb");
    if (pole) pole.blur();
    pole = null;
  }

  return {
    zapni() {
      /* klepnuti do klavesnice nesmi vzit fokus textovemu poli */
      kb.addEventListener("pointerdown", (e) => e.preventDefault());
      kb.addEventListener("mousedown", (e) => e.preventDefault());
      kb.addEventListener("click", (e) => {
        const b = e.target.closest ? e.target.closest("[data-k]") : null;
        if (b) stisk(b.dataset.k);
      });
      document.addEventListener("focusin", (e) => {
        const el = e.target;
        const textove = el.tagName === "TEXTAREA" ||
          (el.tagName === "INPUT" && /^(text|tel|search|password|email|number|url)$/.test(el.type));
        if (textove) ukaz(el);
      });
      document.addEventListener("focusout", () => { skryt = setTimeout(schovej, 150); });
    }
  };
})();

/* ---------------- APLIKACE ---------------- */
const nactiKontakty = () => store.get("kontakty", [
  { j: "Máma", t: "+420 601 111 222" },
  { j: "Táta", t: "+420 602 333 444" },
  { j: "Linsoft HQ", t: "+420 800 123 456" }
]);
const jmenoKCislu = (cislo) => {
  const k = nactiKontakty().find((x) => Core.cisloTel(x.t) === Core.cisloTel(cislo));
  return k ? k.j : cislo;
};

/* Telefon */
function appTelefon(c) {
  c.innerHTML = `
    <div id="dial-num" aria-live="polite"></div>
    <div id="dial-grid"></div>
    <div id="dial-actions">
      <button id="dial-call" aria-label="${esc(t("app_telefon"))}">📞</button>
      <button id="dial-del" aria-label="${esc(t("smazat"))}">⌫</button>
    </div>`;
  const num = $("#dial-num");
  "123456789*0#".split("").forEach((d) => {
    const b = document.createElement("button");
    b.textContent = d;
    b.onclick = () => num.textContent += d;
    $("#dial-grid").appendChild(b);
  });
  $("#dial-del").onclick = () => num.textContent = num.textContent.slice(0, -1);
  $("#dial-call").onclick = () => {
    const n = Core.cisloTel(num.textContent);
    if (!n) return;
    volat(n);
  };
}

/* Zpravy - odesila skutecne SMS pres aplikaci telefonu */
function appZpravy(c, komu) {
  const z = store.get("zpravy", []);
  const kontakty = nactiKontakty();
  c.innerHTML = `
    <div id="zpr-list">${z.map((m) => m.prijata
      ? `<div class="bubble in">${esc(m.txt)}<small>← ${esc(jmenoKCislu(m.komu))} · ${Core.hhmm(new Date(m.cas))}</small></div>`
      : `<div class="bubble">${esc(m.txt)}<small>${m.komu ? "→ " + esc(jmenoKCislu(m.komu)) + " · " : ""}${Core.hhmm(new Date(m.cas))}</small></div>`).join("")
      || `<p class="muted">${esc(t("sms_zadne"))}</p>`}</div>
    <div id="zpr-form">
      <input id="zpr-komu" type="tel" list="zpr-kontakty" autocomplete="off"
        placeholder="${esc(t("sms_komu"))}" aria-label="${esc(t("sms_komu"))}" value="${esc(komu || "")}">
      <datalist id="zpr-kontakty">${kontakty.map((k) =>
        `<option value="${esc(k.t)}">${esc(k.j)}</option>`).join("")}</datalist>
      <div class="row">
        <input id="zpr-in" placeholder="${esc(t("sms_text"))}" aria-label="${esc(t("sms_text"))}">
        <button class="btn" id="zpr-send" aria-label="SMS">➤</button>
      </div>
      <p class="muted small">${esc(t(Nativ.aktivni ? "sms_info_nativ" : "sms_info"))}</p>
    </div>`;
  c.scrollTop = c.scrollHeight;
  const posli = () => {
    const text = $("#zpr-in").value.trim();
    const cislo = Core.cisloTel($("#zpr-komu").value);
    if (!cislo) return $("#zpr-komu").focus();
    if (!text) return $("#zpr-in").focus();
    const ulozeno = () => {
      z.push({ txt: text, komu: cislo, cas: Date.now() });
      store.set("zpravy", z.slice(-200));
      pridejNotif(t("app_zpravy"), t("sms_odeslano", jmenoKCislu(cislo)));
      if (stav.bezici === "zpravy") appZpravy(c, cislo);
    };
    /* LinsoftPhone OS na telefonu posila primo pres modem, jinak SMS aplikace telefonu */
    if (Nativ.aktivni) Nativ.api("sms", { cislo, text }).then(ulozeno, nativChyba);
    else { location.href = Core.smsOdkaz(cislo, text, JE_IOS); ulozeno(); }
  };
  $("#zpr-send").onclick = posli;
  $("#zpr-in").onkeydown = (e) => { if (e.key === "Enter") posli(); };
}

/* Kontakty */
/* avatar s inicialami; barva podle jmena, aby mel kazdy kontakt vzdy stejnou */
const BARVY_AVATARU = [["#60a5fa", "#2563eb"], ["#f472b6", "#db2777"], ["#34d399", "#059669"],
  ["#fbbf24", "#d97706"], ["#a78bfa", "#7c3aed"], ["#f87171", "#dc2626"], ["#2dd4bf", "#0d9488"]];
function avatar(jmeno, trida) {
  let h = 0;
  for (const ch of jmeno) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const b = BARVY_AVATARU[h % BARVY_AVATARU.length];
  const inicialy = jmeno.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
  return `<span class="avatar${trida ? " " + trida : ""}" style="background:linear-gradient(145deg,${b[0]},${b[1]})" aria-hidden="true">${esc(inicialy)}</span>`;
}

function appKontakty(c, rezim) {
  const k = nactiKontakty();
  const uloz = () => store.set("kontakty", k);
  rezim = rezim || {};
  c.scrollTop = 0;

  /* ---- detail kontaktu ---- */
  if (typeof rezim.detail === "number" && k[rezim.detail]) {
    const i = rezim.detail, x = k[i];
    vnitrniZpet = () => appKontakty(c);
    c.innerHTML = `
      <div class="kt-hlava">
        ${avatar(x.j, "velky")}
        <h2>${esc(x.j)}</h2>
        <p>${esc(x.t)}</p>
      </div>
      <div class="kt-akce">
        <a href="tel:${esc(Core.cisloTel(x.t))}">${Ikony.ikona("telefon")}<span>${esc(t("kt_volat"))}</span></a>
        <button id="kt-sms">${Ikony.ikona("zpravy")}<span>${esc(t("kt_zprava"))}</span></button>
        <button id="kt-upravit">${Ikony.ikona("upravit")}<span>${esc(t("kt_upravit"))}</span></button>
      </div>
      <div class="nast-skupina">
        <div class="nast-radek"><span class="nast-text"><small>${esc(t("kt_cislo"))}</small>${esc(x.t || "—")}</span></div>
      </div>
      <div class="nast-skupina" style="margin-top:16px">
        <button class="nast-radek nast-akce nast-cervena" id="kt-smazat">
          <span class="nast-ik" style="background:#ef4444">${Ikony.ikona("kos")}</span>
          <span class="nast-text">${esc(t("smazat"))}</span>
        </button>
      </div>`;
    $("#kt-sms").onclick = () => otevri("zpravy", x.t);
    $("#kt-upravit").onclick = () => appKontakty(c, { upravit: i });
    $("#kt-smazat").onclick = () => {
      if (!confirm(t("kt_smazat_q", x.j))) return;
      k.splice(i, 1);
      uloz();
      appKontakty(c);
    };
    return;
  }

  /* ---- novy kontakt / uprava ---- */
  if (typeof rezim.upravit === "number") {
    const i = rezim.upravit, x = k[i] || { j: "", t: "" };
    vnitrniZpet = () => i >= 0 ? appKontakty(c, { detail: i }) : appKontakty(c);
    c.innerHTML = `
      <div class="kt-hlava" id="kt-nahled">${avatar(x.j || "?", "velky")}</div>
      <div class="nast-skupina kt-formular">
        <input id="kt-j" value="${esc(x.j)}" placeholder="${esc(t("kt_jmeno"))}" aria-label="${esc(t("kt_jmeno"))}" autocomplete="off">
        <input id="kt-t" value="${esc(x.t)}" type="tel" placeholder="${esc(t("kt_cislo"))}" aria-label="${esc(t("kt_cislo"))}" autocomplete="off">
      </div>
      <div class="kt-tlacitka">
        <button class="btn ghost" id="kt-zrusit">${esc(t("zrusit"))}</button>
        <button class="btn" id="kt-ulozit">${esc(t("ulozit"))}</button>
      </div>`;
    /* avatar se meni s psanim jmena */
    $("#kt-j").oninput = () => { $("#kt-nahled").innerHTML = avatar($("#kt-j").value.trim() || "?", "velky"); };
    $("#kt-zrusit").onclick = vnitrniZpet;
    $("#kt-ulozit").onclick = () => {
      const j = $("#kt-j").value.trim();
      if (!j) return $("#kt-j").focus();
      const novy = { j, t: $("#kt-t").value.trim() };
      if (i >= 0) k[i] = novy; else k.push(novy);
      uloz();
      appKontakty(c, { detail: i >= 0 ? i : k.length - 1 });
    };
    if (i < 0) $("#kt-j").focus();
    return;
  }

  /* ---- seznam: hledani, abecedni skupiny ---- */
  const umiImport = "contacts" in navigator && "ContactsManager" in window;
  c.innerHTML = `
    <label class="kt-hledat">${Ikony.ikona("hledat")}
      <input id="kt-q" type="search" placeholder="${esc(t("kt_hledat"))}" aria-label="${esc(t("kt_hledat"))}" autocomplete="off">
    </label>
    <div id="kt-seznam"></div>
    ${umiImport ? `<div class="nast-skupina" style="margin-top:18px">
      <button class="nast-radek nast-akce" id="kt-import">
        <span class="nast-ik" style="background:#14b8a6">${Ikony.ikona("stahnout")}</span>
        <span class="nast-text">${esc(t("kt_import"))}</span>
      </button></div>` : ""}
    <button class="fab" id="kt-novy" aria-label="${esc(t("kt_novy"))}">${Ikony.ikona("plus")}</button>`;

  const kresli = () => {
    const q = $("#kt-q").value.trim().toLowerCase();
    const seznam = k.map((x, i) => ({ x, i }))
      .filter((o) => !q || o.x.j.toLowerCase().indexOf(q) >= 0 || Core.cisloTel(o.x.t).indexOf(Core.cisloTel(q) || "~") >= 0)
      .sort((a, b) => a.x.j.localeCompare(b.x.j, stav.jazyk));
    if (!seznam.length) {
      $("#kt-seznam").innerHTML = `<p class="kt-nic">${esc(t(k.length ? "kt_nic" : "kt_zadne"))}</p>`;
      return;
    }
    /* skupiny podle prvniho pismena */
    let html = "", pismeno = null;
    seznam.forEach((o) => {
      const p = (o.x.j[0] || "#").toUpperCase();
      if (p !== pismeno) {
        if (pismeno !== null) html += "</div>";
        html += `<h3 class="kt-pismeno">${esc(p)}</h3><div class="nast-skupina">`;
        pismeno = p;
      }
      html += `<button class="nast-radek nast-akce kt-radek" data-i="${o.i}">${avatar(o.x.j)}
        <span class="nast-text">${esc(o.x.j)}<small>${esc(o.x.t)}</small></span></button>`;
    });
    $("#kt-seznam").innerHTML = html + "</div>";
    $("#kt-seznam").querySelectorAll("[data-i]").forEach((b) =>
      b.onclick = () => appKontakty(c, { detail: +b.dataset.i }));
  };
  $("#kt-q").oninput = kresli;
  kresli();
  $("#kt-novy").onclick = () => appKontakty(c, { upravit: -1 });

  /* skutecne kontakty z telefonu (Contact Picker API - Android Chrome) */
  if (umiImport) $("#kt-import").onclick = () => {
    navigator.contacts.select(["name", "tel"], { multiple: true }).then((vyber) => {
      let n = 0;
      vyber.forEach((v) => {
        const tel = (v.tel && v.tel[0]) || "";
        const j = (v.name && v.name[0]) || tel;
        if (j) { k.push({ j, t: tel }); n++; }
      });
      uloz();
      pridejNotif(t("app_kontakty"), t("kt_importovano", n));
      appKontakty(c);
    }).catch(() => {});
  };
}

/* Kalkulacka */
function appKalk(c) {
  c.innerHTML = `<div id="calc-disp" aria-live="polite">0</div><div id="calc-grid"></div>`;
  const d = $("#calc-disp");
  let v = "";
  const tl = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ",", "⌫", "="];
  tl.forEach((x) => {
    const b = document.createElement("button");
    b.textContent = x;
    if ("÷×−+=C⌫".includes(x)) b.className = "op";
    b.onclick = () => {
      if (x === "C") v = "";
      else if (x === "⌫") v = v.slice(0, -1);
      else if (x === "=") {
        try { v = String(Core.spocitej(v)).replace(".", ","); } catch (e) { v = t("chyba"); }
      }
      else v = (v === t("chyba") ? "" : v) + x;
      d.textContent = v || "0";
    };
    $("#calc-grid").appendChild(b);
  });
}

/* Hodiny: hodiny, budik, minutka, stopky */
function appHodiny(c, karta) {
  karta = karta || store.get("hodinyKarta", "hodiny");
  store.set("hodinyKarta", karta);
  c.innerHTML = `<div class="tabs" role="tablist">${["hodiny", "budik", "minutka", "stopky"].map((x) =>
    `<button role="tab" class="tab${x === karta ? " on" : ""}" aria-selected="${x === karta}" data-karta="${x}">${esc(t("hd_" + x))}</button>`
  ).join("")}</div><div id="hd-obsah"></div>`;
  c.querySelectorAll(".tab").forEach((b) => b.onclick = () => appHodiny(c, b.dataset.karta));
  const o = $("#hd-obsah");
  /* obnovovani, dokud je karta na obrazovce */
  const opakuj = (fn, ms) => { fn(); const iv = setInterval(() => document.contains(o) ? fn() : clearInterval(iv), ms); };

  if (karta === "hodiny") {
    o.innerHTML = `<div class="big-time" id="hd-cas"></div><div class="muted center" id="hd-datum"></div>`;
    opakuj(() => {
      $("#hd-cas").textContent = new Date().toLocaleTimeString(stav.jazyk);
      $("#hd-datum").textContent = Core.datumText(stav.jazyk, new Date());
    }, 500);
  }
  else if (karta === "budik") {
    const uloz = () => { store.set("budiky", stav.budiky); appHodiny(c, "budik"); tick(); };
    /* vyber casu pres dva seznamy - funguje vsude, i bez systemove klavesnice */
    const moznosti = (n, vybrano) => Array.from({ length: n }, (_, i) =>
      `<option value="${i}"${i === vybrano ? " selected" : ""}>${Core.dva(i)}</option>`).join("");
    o.innerHTML = (stav.budiky.length ? stav.budiky.map((b, i) => `
      <div class="list-item">
        <div class="grow big">${Core.dva(b.h)}:${Core.dva(b.m)}</div>
        <button class="btn sm${b.zap ? "" : " ghost"}" data-prepni="${i}" aria-pressed="${b.zap}">${esc(t(b.zap ? "zap" : "vyp"))}</button>
        <button class="btn sm ghost" data-smaz="${i}" aria-label="${esc(t("smazat"))}">✕</button>
      </div>`).join("") : `<p class="muted">${esc(t("budik_zadny"))}</p>`) + `
      <div class="row" style="margin-top:12px">
        <select id="bd-h" aria-label="${esc(t("hd_budik"))} h">${moznosti(24, 7)}</select>
        <select id="bd-m" aria-label="${esc(t("hd_budik"))} min">${moznosti(60, 0)}</select>
        <button class="btn" id="bd-pridat">${esc(t("pridat"))}</button>
      </div>
      <p class="muted small">${esc(t("budik_info"))}</p>`;
    o.querySelectorAll("[data-prepni]").forEach((b) => b.onclick = () => {
      const x = stav.budiky[+b.dataset.prepni];
      x.zap = !x.zap; x.posledni = null;
      uloz();
    });
    o.querySelectorAll("[data-smaz]").forEach((b) => b.onclick = () => { stav.budiky.splice(+b.dataset.smaz, 1); uloz(); });
    $("#bd-pridat").onclick = () => {
      stav.budiky.push({ h: +$("#bd-h").value, m: +$("#bd-m").value, zap: true, posledni: null });
      stav.budiky.sort((a, b) => a.h * 60 + a.m - b.h * 60 - b.m);
      uloz();
    };
  }
  else if (karta === "minutka") {
    let delka = store.get("minutkaDelka", 5 * 60000);
    o.innerHTML = `
      <div class="big-time" id="mn-cas"></div>
      <div class="chips">${[1, 3, 5, 10, 15, 30].map((m) =>
        `<button class="btn ghost sm" data-min="${m}">${m} min</button>`).join("")}</div>
      <div class="chips"><button class="btn" id="mn-start"></button><button class="btn ghost" id="mn-reset">${esc(t("reset"))}</button></div>`;
    const uk = () => {
      const zbyva = stav.minutka ? Math.max(0, stav.minutka.konec - Date.now()) : delka;
      const s = Math.ceil(zbyva / 1000);
      $("#mn-cas").textContent = Core.dva(Math.floor(s / 60)) + ":" + Core.dva(s % 60);
      $("#mn-start").textContent = t(stav.minutka ? "stop" : "start");
    };
    const uloz = () => { store.set("minutka", stav.minutka); uk(); tick(); };
    o.querySelectorAll("[data-min]").forEach((b) => b.onclick = () => {
      if (stav.minutka) return;
      delka = +b.dataset.min * 60000;
      store.set("minutkaDelka", delka);
      uk();
    });
    $("#mn-start").onclick = () => {
      stav.minutka = stav.minutka ? null : { konec: Date.now() + delka };
      uloz();
    };
    $("#mn-reset").onclick = () => { stav.minutka = null; uloz(); };
    opakuj(uk, 250);
  }
  else {
    const st = stav.stopky;
    o.innerHTML = `
      <div class="big-time" id="st-cas"></div>
      <div class="chips"><button class="btn" id="st-start"></button><button class="btn ghost" id="st-reset">${esc(t("reset"))}</button></div>`;
    const uk = () => {
      const ms = st.nab + (st.beh ? Date.now() - st.zac : 0);
      $("#st-cas").textContent = (ms / 1000).toFixed(1).replace(".", ",") + " s";
      $("#st-start").textContent = t(st.beh ? "stop" : "start");
    };
    $("#st-start").onclick = () => {
      if (st.beh) { st.nab += Date.now() - st.zac; st.beh = false; }
      else { st.zac = Date.now(); st.beh = true; }
      uk();
    };
    $("#st-reset").onclick = () => { st.nab = 0; st.zac = Date.now(); uk(); };
    opakuj(uk, 100);
  }
}

/* Kalendar s udalostmi */
function appKalendar(c, posun) {
  posun = posun || 0;
  const T = Core.TEXTY[stav.jazyk];
  const dnes = new Date();
  const d = new Date(dnes.getFullYear(), dnes.getMonth() + posun, 1);
  const ud = store.get("udalosti", {});
  if (!stav.kalVyber) stav.kalVyber = Core.denKlic(dnes);
  const vyber = stav.kalVyber.split("-").map(Number);
  let h = `
    <div class="cal-head">
      <button class="btn ghost sm" id="kal-pred" aria-label="‹">‹</button>
      <h2>${esc(T.mesice[d.getMonth()])} ${d.getFullYear()}</h2>
      <button class="btn ghost sm" id="kal-dal" aria-label="›">›</button>
    </div><div id="cal-grid">`;
  T.dnyKratke.forEach((x) => h += `<div class="hd">${esc(x)}</div>`);
  Core.mesicMrizka(d.getFullYear(), d.getMonth()).forEach((n) => {
    if (n === null) { h += "<div></div>"; return; }
    const k = Core.denKlic(new Date(d.getFullYear(), d.getMonth(), n));
    let cls = "day";
    if (k === Core.denKlic(dnes)) cls += " today";
    if (k === stav.kalVyber) cls += " sel";
    if (ud[k] && ud[k].length) cls += " ma";
    h += `<button class="${cls}" data-den="${k}">${n}</button>`;
  });
  const seznam = ud[stav.kalVyber] || [];
  h += `</div>
    <h3 class="kal-den">${esc(Core.datumText(stav.jazyk, new Date(vyber[0], vyber[1] - 1, vyber[2])))}</h3>
    ${seznam.map((x, i) => `<div class="list-item"><div class="grow">${esc(x)}</div>
      <button class="btn sm ghost" data-smaz="${i}" aria-label="${esc(t("smazat"))}">✕</button></div>`).join("")
      || `<p class="muted">${esc(t("kal_zadne"))}</p>`}
    <div class="row" style="margin-top:10px">
      <input id="kal-in" placeholder="${esc(t("kal_udalost"))}" aria-label="${esc(t("kal_udalost"))}">
      <button class="btn" id="kal-add" aria-label="${esc(t("pridat"))}">+</button>
    </div>`;
  c.innerHTML = h;
  const uloz = () => { store.set("udalosti", ud); appKalendar(c, posun); };
  $("#kal-pred").onclick = () => appKalendar(c, posun - 1);
  $("#kal-dal").onclick = () => appKalendar(c, posun + 1);
  c.querySelectorAll("[data-den]").forEach((b) => b.onclick = () => { stav.kalVyber = b.dataset.den; appKalendar(c, posun); });
  c.querySelectorAll("[data-smaz]").forEach((b) => b.onclick = () => {
    seznam.splice(+b.dataset.smaz, 1);
    if (seznam.length) ud[stav.kalVyber] = seznam; else delete ud[stav.kalVyber];
    uloz();
  });
  const pridej = () => {
    const x = $("#kal-in").value.trim();
    if (!x) return;
    ud[stav.kalVyber] = seznam.concat([x]);
    uloz();
  };
  $("#kal-add").onclick = pridej;
  $("#kal-in").onkeydown = (e) => { if (e.key === "Enter") pridej(); };
}

/* Poznamky */
function appPoznamky(c) {
  c.innerHTML = `
    <textarea id="pz" rows="14" placeholder="${esc(t("pz_ph"))}" aria-label="${esc(t("app_poznamky"))}">${esc(store.get("poznamky", ""))}</textarea>
    <p class="muted small">${esc(t("pz_ulozeno"))}</p>`;
  $("#pz").oninput = () => store.set("poznamky", $("#pz").value);
}

/* Galerie */
function appGalerie(c, detail) {
  c.innerHTML = `<p class="muted">…</p>`;
  Fotky.vse().then((f) => {
    if (stav.bezici !== "galerie") return;
    const foto = detail && f.find((x) => String(x.id) === String(detail));
    if (foto) {
      c.innerHTML = `
        <img class="gal-big" src="${esc(foto.data)}" alt="">
        <div class="chips">
          <button class="btn ghost" id="gal-zpet" aria-label="${esc(t("zpet"))}">←</button>
          <a class="btn" id="gal-dl" download="linsoftos-foto.jpg">${esc(t("gal_stahnout"))}</a>
          <button class="btn ghost" id="gal-smaz">${esc(t("smazat"))}</button>
        </div>
        <button class="btn ghost full" id="gal-tapeta">${esc(t("gal_tapeta"))}</button>`;
      $("#gal-tapeta").onclick = () => {
        store.set("tapetaFoto", foto.id);
        nastavTapetu("foto", foto.data);
        pridejNotif(t("st_tapeta"), t("tapeta_ok"));
      };
      $("#gal-dl").href = foto.data;
      $("#gal-zpet").onclick = () => appGalerie(c);
      $("#gal-smaz").onclick = () => Fotky.smaz(foto.id).then(() => appGalerie(c));
      return;
    }
    c.innerHTML = f.length
      ? `<div class="gal-grid">${f.map((x) =>
          `<button class="gal-foto" data-id="${esc(x.id)}"><img src="${esc(x.data)}" alt=""></button>`).join("")}</div>
         <button class="btn ghost full" id="gal-del">${esc(t("gal_smaz_vse"))}</button>`
      : `<p class="muted">${esc(t("gal_prazdna"))}</p>`;
    c.querySelectorAll(".gal-foto").forEach((b) => b.onclick = () => appGalerie(c, b.dataset.id));
    const del = $("#gal-del");
    if (del) del.onclick = () => Fotky.smazVse().then(() => appGalerie(c));
  });
}

/* Fotoaparat (skutecna kamera pres getUserMedia) */
function appFotak(c) {
  if (svitilna) prepniSvitilnu(); /* kamera a svitilna se o zarizeni nedeli */
  c.innerHTML = `
    <video id="cam-video" autoplay playsinline muted></video>
    <button class="btn full" id="cam-snap">${esc(t("cam_vyfot"))}</button>
    <canvas id="cam-cv" hidden></canvas>
    <div id="cam-out"></div>`;
  const video = $("#cam-video");
  const chyba = () => c.insertAdjacentHTML("afterbegin", `<p class="muted">${esc(t("cam_ne"))}</p>`);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) chyba();
  else navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then((s) => {
      video.srcObject = s;
      const p = video.play(); /* iOS nekdy autoplay ignoruje */
      if (p && p.catch) p.catch(() => {});
      const stop = setInterval(() => {
        if (!document.contains(video)) { s.getTracks().forEach((x) => x.stop()); clearInterval(stop); }
      }, 500);
    })
    .catch(chyba);
  $("#cam-snap").onclick = () => {
    if (!video.videoWidth) return;
    /* zmenseni na max 1280 px */
    const k = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const cv = $("#cam-cv");
    cv.width = Math.round(video.videoWidth * k);
    cv.height = Math.round(video.videoHeight * k);
    cv.getContext("2d").drawImage(video, 0, 0, cv.width, cv.height);
    const data = cv.toDataURL("image/jpeg", .8);
    Fotky.pridej(data).then(() => pridejNotif(t("app_fotak"), t("cam_ulozeno")));
    $("#cam-out").innerHTML = `<img id="cam-shot" src="${data}" alt="">`;
  };
}

/* Terminal - stejne prikazy jako kernel verze */
function appTerminal(c) {
  c.innerHTML = `<div id="term" role="log"></div><input id="term-in" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="napis prikaz… (pomoc)" aria-label="linsoft>">`;
  const tm = $("#term");
  const start = Date.now();
  const w = (s) => { tm.textContent += s + "\n"; tm.scrollTop = tm.scrollHeight; };
  w("=== LinsoftPhone OS " + VERZE_OS + " (PWA) ===");
  w("Napis 'pomoc' pro seznam prikazu.\n");
  $("#term-in").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const cmd = $("#term-in").value.trim();
    $("#term-in").value = "";
    w("linsoft> " + cmd);
    if (cmd === "pomoc") w("pomoc, info, cas, datum, kalk <vyraz>, vymaz");
    else if (cmd === "info") w(`Verze: ${VERZE_OS} PWA\nPlatforma: ${navigator.platform}\nJazyk: ${navigator.language}\nOnline: ${navigator.onLine ? "ano" : "ne"}`);
    else if (cmd === "cas") w("Doba behu: " + Math.round((Date.now() - start) / 1000) + " s");
    else if (cmd === "datum") w(new Date().toLocaleString(stav.jazyk));
    else if (cmd === "vymaz") tm.textContent = "";
    else if (cmd.indexOf("kalk ") === 0) {
      try { w("= " + Core.spocitej(cmd.slice(5))); } catch (err) { w("Chyba: neplatny vyraz."); }
    }
    else if (cmd) w("Neznamy prikaz: '" + cmd + "'. Napis 'pomoc'.");
  };
}

/* Nastaveni */
function appNastaveni(c) {
  const svetly = document.body.classList.contains("light");
  const umiNotif = "Notification" in window;
  /* stavebni prvky: radek s barevnou ikonou, prepinac, skupina se zahlavim */
  const ik = (nazev, barva) => `<span class="nast-ik" style="background:${barva}">${Ikony.ikona(nazev)}</span>`;
  const prepinac = (id, zap, popis) =>
    `<button class="prepinac${zap ? " on" : ""}" id="${id}" role="switch" aria-checked="${zap}" aria-label="${esc(popis)}"><span></span></button>`;
  const radek = (ikona, barva, text, ovladani, extra) =>
    `<div class="nast-radek">${ik(ikona, barva)}<span class="nast-text">${esc(text)}${extra || ""}</span>${ovladani || ""}</div>`;
  /* cely radek jako tlacitko (akce) */
  const akce = (id, ikona, barva, text, trida) =>
    `<button class="nast-radek nast-akce${trida ? " " + trida : ""}" id="${id}">${ik(ikona, barva)}<span class="nast-text">${esc(text)}</span>${Ikony.ikona("sipka", "nast-sipka")}</button>`;
  const skupina = (nazev, obsah) =>
    `<h2 class="nast-nadpis">${esc(t(nazev))}</h2><div class="nast-skupina">${obsah}</div>`;
  const tapeta = store.get("tapeta", "polar");

  c.innerHTML = `
    <button class="nast-karta" id="st-info">
      <img src="icons/logo.svg" alt="">
      <div>
        <strong>LinsoftPhone OS</strong>
        <span>${esc(t("st_verze", VERZE_OS))} · ${esc(Nativ.aktivni ? "postmarketOS" : t("st_pwa"))}</span>
      </div>
      ${Ikony.ikona("sipka", "nast-sipka")}
    </button>

    ${skupina("sk_vzhled",
      radek("galerie", "#ec4899", t("st_tapeta"), "",
        `<small>${esc(t("tap_" + (TAPETY.indexOf(tapeta) >= 0 ? tapeta : "foto")))}</small>`) +
      `<div class="tapety">${TAPETY.map((x) =>
        `<button class="tapeta-vzor tapeta-${x}${tapeta === x ? " on" : ""}" data-tapeta="${x}" aria-label="${esc(t("tap_" + x))}"></button>`).join("")}</div>
      <p class="nast-pozn">${esc(t("tap_foto"))}: ${esc(t("app_galerie"))} → ${esc(t("gal_tapeta"))}</p>` +
      radek("motiv", "#6366f1", t("st_motiv"), prepinac("st-theme", svetly, t("st_motiv"))))}

    ${Nativ.aktivni ? skupina("sk_pripojeni",
      akce("st-wifi", "wifi", "#3b82f6", t("st_wifi")) +
      `<div id="st-wifi-seznam"></div>` +
      radek("slunce", "#f59e0b", t("st_jas"),
        `<input type="range" id="st-jas" min="5" max="100" value="${stav.jas || 70}" aria-label="${esc(t("st_jas"))}">`)) : ""}

    ${skupina("sk_zabezpeceni",
      radek("zamek", "#22c55e", t("st_pin"), prepinac("st-pin", !!stav.pin, t("st_pin"))) +
      `<div id="st-pin-box"></div>` +
      (umiNotif ? radek("zvonek", "#ef4444", t("st_notif"), prepinac("st-notif", stav.notifSys, t("st_notif"))) : ""))}

    ${skupina("sk_system",
      radek("jazyk", "#0ea5e9", t("st_jazyk"),
        `<select id="st-jazyk" aria-label="${esc(t("st_jazyk"))}">${Object.keys(Core.JAZYKY).map((k) =>
          `<option value="${k}"${k === stav.jazyk ? " selected" : ""}>${Core.JAZYKY[k]}</option>`).join("")}</select>`) +
      akce("st-zaloha", "stahnout", "#14b8a6", t("st_zaloha")) +
      akce("st-obnov", "nahrat", "#8b5cf6", t("st_obnov")) +
      `<input type="file" id="st-soubor" accept="application/json,.json" hidden>` +
      akce("st-o", "info", "#64748b", t("st_o")))}

    ${Nativ.aktivni ? skupina("sk_telefon",
      akce("st-restart", "restart", "#64748b", t("st_restart")) +
      akce("st-vypnout", "napajeni", "#ef4444", t("st_vypnout"), "nast-cervena")) : ""}

    <div class="nast-skupina" style="margin-top:22px">
      ${akce("st-reset", "kos", "#ef4444", t("st_reset"), "nast-cervena")}
    </div>

    <p class="nast-o">${Nativ.aktivni ? esc(t("nativ_info")) : t("st_o_text")}</p>`;

  if (Nativ.aktivni) {
    $("#st-jas").onchange = () => Nativ.api("jas", { hodnota: +$("#st-jas").value }).catch(nativChyba);
    $("#st-wifi").onclick = () => wifiSeznam($("#st-wifi-seznam"));
    $("#st-restart").onclick = () => {
      if (confirm(t("st_restart_q"))) Nativ.api("system", { akce: "restart" }).catch(nativChyba);
    };
    $("#st-vypnout").onclick = () => {
      if (confirm(t("st_vypnout_q"))) Nativ.api("system", { akce: "vypnout" }).catch(nativChyba);
    };
  }

  $("#st-theme").onclick = () => { nastavMotiv(!svetly); appNastaveni(c); };
  $("#st-info").onclick = $("#st-o").onclick = () => infoSystem(c);
  c.querySelectorAll("[data-tapeta]").forEach((b) => b.onclick = () => { nastavTapetu(b.dataset.tapeta); appNastaveni(c); });
  $("#st-jazyk").onchange = () => {
    stav.jazyk = $("#st-jazyk").value;
    store.set("jazyk", stav.jazyk);
    prelozStranku(); vykresliIkony(); kresliNotif(); tick();
    $("#app-title").textContent = t("app_nastaveni");
    appNastaveni(c);
  };

  $("#st-pin").onclick = () => {
    const box = $("#st-pin-box");
    box.innerHTML = `<p class="center pin-title"></p><div></div>`;
    const titulek = (s) => box.firstChild.textContent = s;
    let pad, prvni = null;
    if (stav.pin) {
      titulek(t("pin_zadej"));
      pad = pinPad(box.lastChild, (p) => {
        if (Core.pinHash(p) !== stav.pin) { titulek(t("pin_spatne")); return pad.chyba(); }
        stav.pin = null;
        store.set("pin", null);
        pridejNotif(t("st_pin"), t("st_pin_zrusen"));
        appNastaveni(c);
      });
    } else {
      titulek(t("st_pin_novy"));
      pad = pinPad(box.lastChild, (p) => {
        if (!prvni) { prvni = p; return titulek(t("st_pin_znovu")); }
        if (p !== prvni) { prvni = null; titulek(t("st_pin_neshoda")); return pad.chyba(); }
        stav.pin = Core.pinHash(p);
        store.set("pin", stav.pin);
        pridejNotif(t("st_pin"), t("st_pin_nastaven"));
        appNastaveni(c);
      });
    }
  };

  if (umiNotif) $("#st-notif").onclick = () => {
    if (stav.notifSys) { stav.notifSys = false; store.set("notifsys", false); return appNastaveni(c); }
    let hotovo = false;
    const vysledek = (perm) => {
      if (hotovo) return;
      hotovo = true;
      if (perm === "granted") {
        stav.notifSys = true;
        store.set("notifsys", true);
        systemNotif("LinsoftPhone OS", t("vitej_s"));
      } else pridejNotif(t("st_notif"), t("st_notif_zakaz"));
      appNastaveni(c);
    };
    /* starsi Safari zna jen callback, novejsi prohlizece Promise */
    const p = Notification.requestPermission(vysledek);
    if (p && p.then) p.then(vysledek);
  };

  $("#st-zaloha").onclick = zalohuj;
  $("#st-obnov").onclick = () => $("#st-soubor").click();
  $("#st-soubor").onchange = () => {
    const f = $("#st-soubor").files[0];
    if (!f) return;
    obnov(f, (ok) => {
      if (!ok) return pridejNotif(t("st_obnov"), t("st_obnov_chyba"));
      store.set("notif", [{ t: t("st_obnov"), s: t("st_obnoveno"), cas: Date.now() }]);
      location.reload();
    });
  };

  $("#st-reset").onclick = () => {
    if (!confirm(t("st_reset_q"))) return;
    Object.keys(localStorage).filter((k) => k.indexOf("lp_") === 0).forEach((k) => localStorage.removeItem(k));
    Fotky.smazVse().then(() => location.reload(), () => location.reload());
  };
}

/* Nastaveni -> O systemu: podrobnosti o LinsoftPhone OS a zarizeni */
function infoSystem(c) {
  vnitrniZpet = () => { $("#app-title").textContent = t("app_nastaveni"); appNastaveni(c); };
  $("#app-title").textContent = t("st_o");
  c.scrollTop = 0;
  const nezname = t("info_nezname");
  const pr = Core.prohlizec(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;
  const radek = (popis, hodnota, id) =>
    `<div class="nast-radek"><span class="nast-text">${esc(popis)}</span><span class="nast-hodnota"${id ? ` id="${id}"` : ""}>${esc(hodnota)}</span></div>`;
  const skupina = (nazev, obsah) =>
    `<h2 class="nast-nadpis">${esc(t(nazev))}</h2><div class="nast-skupina info">${obsah}</div>`;
  const bat = (b) => b ? b.uroven + " %" + (b.nabiji ? ", " + t("info_nabiji") : "") : nezname;

  c.innerHTML = `
    <div class="info-hlava">
      <img src="icons/logo.svg" alt="">
      <h2>LinsoftPhone OS</h2>
      <p>${esc(t("st_verze", VERZE_OS))}</p>
    </div>
    ${skupina("info_softver",
      radek(t("info_system"), "LinsoftPhone OS " + VERZE_OS) +
      radek(t("info_zostaveni"), ZOSTAVENI) +
      radek(t("info_rozhrani"), Nativ.aktivni ? t("info_nativ") : t("st_pwa")) +
      (Nativ.aktivni ? radek(t("info_distribuce"), "…", "in-distribuce") + radek(t("info_jadro"), "…", "in-jadro") : "") +
      radek(t("info_prohlizec"), pr.nazev + (pr.verze ? " " + pr.verze : "")))}
    ${skupina("info_zarizeni",
      (Nativ.aktivni ? radek(t("info_model"), "…", "in-model") : "") +
      radek(t("info_platforma"), Core.platforma(navigator.userAgent)) +
      radek(t("info_displej"), Math.round(screen.width * dpr) + " × " + Math.round(screen.height * dpr) + " px") +
      radek(t("info_procesor"), navigator.hardwareConcurrency ? t("info_jader", navigator.hardwareConcurrency) : nezname) +
      radek(t("info_pamet"), navigator.deviceMemory ? "≥ " + navigator.deviceMemory + " GB" : nezname, "in-pamet") +
      radek(t("info_uloziste"), "…", "in-uloziste"))}
    ${skupina("info_stav",
      radek(t("info_baterie"), bat(sb.bat), "in-baterie") +
      radek(t("info_sit"), navigator.onLine === false ? t("info_offline") : t("info_online")) +
      (Nativ.aktivni ? radek(t("info_operator"), "…", "in-operator") + radek(t("info_signal"), "…", "in-signal") : "") +
      radek(t("info_beh"), Core.trvani(performance.now() / 1000), "in-beh"))}
    ${skupina("info_data",
      radek(t("info_aplikace"), String(APPS.length)) +
      radek(t("app_kontakty"), String(nactiKontakty().length)) +
      radek(t("info_fotky"), "…", "in-fotky") +
      radek(t("st_jazyk"), Core.JAZYKY[stav.jazyk]))}
    <div class="nast-skupina" style="margin-top:22px">
      <a class="nast-radek nast-akce" href="https://github.com/Linsoft1/linsoftphone-os" target="_blank" rel="noopener">
        <span class="nast-ik" style="background:#334155">${Ikony.ikona("terminal")}</span>
        <span class="nast-text">${esc(t("info_zdroj"))}<small>github.com/Linsoft1/linsoftphone-os</small></span>
        ${Ikony.ikona("sipka", "nast-sipka")}
      </a>
    </div>`;

  /* hodnoty, ktere prijdou pozdeji */
  const nastav = (id, text) => { const el = $("#" + id); if (el) el.textContent = text; };
  const uloziste = (obsazeno, celkem) =>
    t("info_obsazeno", Core.velikost(obsazeno, stav.jazyk)) + " / " + Core.velikost(celkem, stav.jazyk);
  Fotky.vse().then((f) => nastav("in-fotky", String(f.length)));
  if (Nativ.aktivni) {
    /* skutecny telefon: udaje od sluzby linsoft-sluzba */
    Nativ.api("stav").then((s) => {
      const y = s.system || {};
      nastav("in-model", y.model || nezname);
      nastav("in-distribuce", y.distribuce || nezname);
      nastav("in-jadro", y.jadro ? y.jadro + (y.arch ? " (" + y.arch + ")" : "") : nezname);
      if (y.pamet) nastav("in-pamet", Core.velikost(y.pamet, stav.jazyk));
      nastav("in-uloziste", y.uloziste ? uloziste(y.uloziste.obsazeno, y.uloziste.celkem) : nezname);
      if (y.beh) nastav("in-beh", Core.trvani(y.beh));
      nastav("in-baterie", bat(s.baterie));
      nastav("in-operator", (s.modem && s.modem.operator) || nezname);
      nastav("in-signal", s.modem ? s.modem.signal + " %" + (s.modem.technologie ? " · " + s.modem.technologie.toUpperCase() : "") : nezname);
    }).catch(() => {});
  } else if (navigator.storage && navigator.storage.estimate) {
    /* PWA: kolik mista zabiraji data LinsoftOS v prohlizeci */
    navigator.storage.estimate().then((e) => nastav("in-uloziste", uloziste(e.usage, e.quota)),
      () => nastav("in-uloziste", nezname));
  } else nastav("in-uloziste", nezname);
}

/* Wi-Fi site (jen LinsoftPhone OS na telefonu) */
function wifiSeznam(box) {
  box.innerHTML = `<p class="muted">…</p>`;
  Nativ.api("wifi").then((site) => {
    box.innerHTML = site.map((s, i) => `
      <button class="list-item wifi" data-i="${i}">
        <div class="grow"><div>${s.zabezpeceni ? "🔒 " : ""}${esc(s.ssid)}</div></div>
        <span class="sub">${s.pripojeno ? "✓ " : ""}${s.signal} %</span>
      </button>`).join("") || `<p class="muted">—</p>`;
    box.querySelectorAll(".wifi").forEach((b) => b.onclick = () => {
      const s = site[+b.dataset.i];
      const pripoj = (heslo) => Nativ.api("wifi", { ssid: s.ssid, heslo }).then(() => {
        pridejNotif("Wi-Fi", t("st_pripojeno", s.ssid));
        wifiSeznam(box);
      }, nativChyba);
      if (!s.zabezpeceni || s.pripojeno) return pripoj("");
      const f = document.createElement("div");
      f.className = "row";
      f.innerHTML = `<input type="password" placeholder="${esc(t("st_wifi_heslo"))}" aria-label="${esc(t("st_wifi_heslo"))}">` +
        `<button class="btn">${esc(t("st_pripojit"))}</button>`;
      b.parentNode.insertBefore(f, b.nextSibling);
      f.querySelector("button").onclick = () => pripoj(f.querySelector("input").value);
      f.querySelector("input").focus();
    });
  }, (e) => { box.innerHTML = ""; nativChyba(e); });
}

/* ---------------- registr aplikaci ---------------- */
const APPS = [
  /* ikona = nazev v ikony.js, barvy = prechod podkladu */
  { id: "telefon", barvy: ["#4ade80", "#15a34a"], render: appTelefon, dock: true },
  { id: "zpravy", barvy: ["#38bdf8", "#2563eb"], render: appZpravy, dock: true },
  { id: "kontakty", barvy: ["#fdba74", "#ea580c"], render: appKontakty },
  { id: "kalk", barvy: ["#c4b5fd", "#7c3aed"], render: appKalk },
  { id: "hodiny", barvy: ["#fda4af", "#e11d48"], render: appHodiny },
  { id: "kalendar", barvy: ["#5eead4", "#0d9488"], render: appKalendar },
  { id: "poznamky", barvy: ["#fde047", "#ca8a04"], render: appPoznamky },
  { id: "fotak", barvy: ["#94a3b8", "#334155"], render: appFotak, dock: true },
  { id: "galerie", barvy: ["#f9a8d4", "#c026d3"], render: appGalerie },
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
function vykresliIkony() {
  $("#appgrid").innerHTML = "";
  $("#dock").innerHTML = "";
  APPS.forEach((a, i) => {
    const b = ikonka(a);
    b.style.setProperty("--i", i);
    $("#appgrid").appendChild(b);
  });
  APPS.filter((a) => a.dock).forEach((a) => $("#dock").appendChild(ikonka(a, true)));
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
