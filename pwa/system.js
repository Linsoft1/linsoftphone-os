/* LinsoftPhone OS - jadro systemu: stav, zamek, plocha, notifikace, navigace,
 * fotky, zaloha, nativni rezim, klavesnice. Aplikace jsou v apps/, start v start.js;
 * cista logika a preklady jsou v core.js. Vsechny skripty sdileji globalni rozsah. */
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
  /* aplikace s vlastni horni listou (prohlizec) bezi pres celou plochu */
  $("#appscreen").classList.toggle("plna", !!app.plna);
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

/* zaznam do Telefon -> Nedavne; smer: odchozi / prichozi / zmeskany */
function zapisHovor(cislo, smer) {
  store.set("hovory", [{ cislo, smer, cas: Date.now() }].concat(store.get("hovory", [])).slice(0, 100));
}

function volat(cislo) {
  zapisHovor(cislo, "odchozi");
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
let prichoziHovor = null; /* { id, cislo, prijat } - po skonceni se zapise jako prijaty / zmeskany */
function hlidejHovory() {
  Nativ.api("hovory").then((seznam) => {
    const h = seznam.filter((x) => x.stav !== "terminated")[0];
    if (prichoziHovor && (!h || h.id !== prichoziHovor.id)) {
      zapisHovor(prichoziHovor.cislo, prichoziHovor.prijat ? "prichozi" : "zmeskany");
      if (!prichoziHovor.prijat) pridejNotif(t("tel_zmeskany"), jmenoKCislu(prichoziHovor.cislo), true);
      prichoziHovor = null;
    }
    if (!h) { hovorId = null; $("#hovor").hidden = true; return; }
    if (h.id !== hovorId) { hovorId = h.id; hovorZacatek = 0; }
    const prichozi = h.stav === "ringing-in" || h.stav === "waiting";
    if (prichozi && !prichoziHovor) prichoziHovor = { id: h.id, cislo: h.cislo, prijat: false };
    if (h.stav === "active" && prichoziHovor && prichoziHovor.id === h.id) prichoziHovor.prijat = true;
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
    /* pri psani nove zpravy neprekreslovat (prisel by napsany text) */
    if (stav.bezici === "zpravy" && !$("#zpr-komu")) appZpravy($("#app-content"), zpravyVlakno);
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

/* ---------------- spolecne pro aplikace ---------------- */
const nactiKontakty = () => store.get("kontakty", [
  { j: "Máma", t: "+420 601 111 222" },
  { j: "Táta", t: "+420 602 333 444" },
  { j: "Linsoft HQ", t: "+420 800 123 456" }
]);
const jmenoKCislu = (cislo) => {
  const k = nactiKontakty().find((x) => Core.cisloTel(x.t) === Core.cisloTel(cislo));
  return k ? k.j : cislo;
};

/* avatar s inicialami; barva podle jmena, aby mel kazdy kontakt vzdy stejnou */
const BARVY_AVATARU = [["#60a5fa", "#2563eb"], ["#f472b6", "#db2777"], ["#34d399", "#059669"],
  ["#fbbf24", "#d97706"], ["#a78bfa", "#7c3aed"], ["#f87171", "#dc2626"], ["#2dd4bf", "#0d9488"]];
function avatar(jmeno, trida) {
  let h = 0;
  for (const ch of jmeno) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const b = BARVY_AVATARU[h % BARVY_AVATARU.length];
  /* cislo bez kontaktu -> "#" */
  const inicialy = /^[+\d]/.test(jmeno) ? "#" :
    jmeno.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
  return `<span class="avatar${trida ? " " + trida : ""}" style="background:linear-gradient(145deg,${b[0]},${b[1]})" aria-hidden="true">${esc(inicialy)}</span>`;
}
