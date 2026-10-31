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
  hlidejBudiky(d);
}

/* skutecna baterie, pokud ji prohlizec umi */
if (navigator.getBattery) {
  navigator.getBattery().then((b) => {
    const uk = () => $("#sb-batt").textContent =
      (b.charging ? "⚡ " : "🔋 ") + Math.round(b.level * 100) + " %";
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
  $("#lock-hint").hidden = false;
  $("#lockscreen").classList.add("visible");
}
function odemkni() {
  stav.zamceno = false;
  $("#lockscreen").classList.add("unlocking");
  setTimeout(() => {
    $("#lockscreen").classList.remove("visible", "unlocking");
    $("#lock-pin").hidden = true;
    $("#lock-hint").hidden = false;
  }, 350);
}
function pokusOdemknout() {
  if (!stav.zamceno) return;
  if (!stav.pin) return odemkni();
  if (!$("#lock-pin").hidden) return;
  $("#lock-hint").hidden = true;
  $("#lock-pin").hidden = false;
  $("#lock-pin-title").textContent = t("pin_zadej");
  const pad = pinPad($("#lock-pin-box"), (p) => {
    if (Core.pinHash(p) === stav.pin) odemkni();
    else { $("#lock-pin-title").textContent = t("pin_spatne"); pad.chyba(); }
  });
}
$("#lockscreen").onclick = pokusOdemknout;
/* s PINem se telefon zamkne pri kazdem odchodu z aplikace */
document.addEventListener("visibilitychange", () => { if (document.hidden && stav.pin) zamkni(); });

/* ---------------- navigace ---------------- */
function ukazObrazovku(id) {
  ["#homescreen", "#appscreen", "#recents"].forEach((s) =>
    $(s).classList.toggle("visible", s === id));
}
/* zaznam v historii -> systemove gesto/tlacitko Zpet na Androidu vrati na plochu */
function zapisHistorii(id) {
  if (history.state && history.state.app) history.replaceState({ app: id }, "");
  else history.pushState({ app: id }, "");
}
function domu() {
  stav.bezici = null;
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
    k.innerHTML = `<button class="recent-open"><span class="glyph" style="background:${a.barva}">${a.ikona}</span>` +
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
    pridejNotif(t("app_telefon"), t("volam", jmenoKCislu(n)));
    location.href = "tel:" + n; /* na skutecnem telefonu otevre vytaceni */
  };
}

/* Zpravy - odesila skutecne SMS pres aplikaci telefonu */
function appZpravy(c, komu) {
  const z = store.get("zpravy", []);
  const kontakty = nactiKontakty();
  c.innerHTML = `
    <div id="zpr-list">${z.map((m) =>
      `<div class="bubble">${esc(m.txt)}<small>${m.komu ? "→ " + esc(jmenoKCislu(m.komu)) + " · " : ""}${Core.hhmm(new Date(m.cas))}</small></div>`).join("")
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
      <p class="muted small">${esc(t("sms_info"))}</p>
    </div>`;
  c.scrollTop = c.scrollHeight;
  const posli = () => {
    const text = $("#zpr-in").value.trim();
    const cislo = Core.cisloTel($("#zpr-komu").value);
    if (!cislo) return $("#zpr-komu").focus();
    if (!text) return $("#zpr-in").focus();
    z.push({ txt: text, komu: cislo, cas: Date.now() });
    store.set("zpravy", z.slice(-200));
    pridejNotif(t("app_zpravy"), t("sms_odeslano", jmenoKCislu(cislo)));
    location.href = Core.smsOdkaz(cislo, text, JE_IOS);
    appZpravy(c, cislo);
  };
  $("#zpr-send").onclick = posli;
  $("#zpr-in").onkeydown = (e) => { if (e.key === "Enter") posli(); };
}

/* Kontakty */
function appKontakty(c) {
  const k = nactiKontakty();
  const umiImport = "contacts" in navigator && "ContactsManager" in window;
  c.innerHTML = `
    <div>${k.map((x, i) => `
      <div class="list-item">
        <div class="avatar">${esc(x.j[0] || "?")}</div>
        <div class="grow"><div>${esc(x.j)}</div><div class="sub">${esc(x.t)}</div></div>
        <a class="btn sm" href="tel:${esc(Core.cisloTel(x.t))}" aria-label="${esc(t("app_telefon"))}">📞</a>
        <button class="btn sm" data-sms="${i}" aria-label="SMS">💬</button>
        <button class="btn sm ghost" data-del="${i}" aria-label="${esc(t("smazat"))}">✕</button>
      </div>`).join("")}</div>
    <div class="row" style="margin-top:14px">
      <input id="kt-j" placeholder="${esc(t("kt_jmeno"))}" aria-label="${esc(t("kt_jmeno"))}">
      <input id="kt-t" type="tel" placeholder="${esc(t("kt_cislo"))}" aria-label="${esc(t("kt_cislo"))}">
    </div>
    <button class="btn full" id="kt-add">${esc(t("kt_pridat"))}</button>
    ${umiImport ? `<button class="btn ghost full" id="kt-import">📲 ${esc(t("kt_import"))}</button>` : ""}`;
  const uloz = () => { store.set("kontakty", k); appKontakty(c); };
  $("#kt-add").onclick = () => {
    if (!$("#kt-j").value.trim()) return $("#kt-j").focus();
    k.push({ j: $("#kt-j").value.trim(), t: $("#kt-t").value.trim() });
    uloz();
  };
  c.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { k.splice(+b.dataset.del, 1); uloz(); });
  c.querySelectorAll("[data-sms]").forEach((b) => b.onclick = () => otevri("zpravy", k[+b.dataset.sms].t));
  /* skutecne kontakty z telefonu (Contact Picker API - Android Chrome) */
  if (umiImport) $("#kt-import").onclick = () => {
    navigator.contacts.select(["name", "tel"], { multiple: true }).then((vyber) => {
      let n = 0;
      vyber.forEach((v) => {
        const tel = (v.tel && v.tel[0]) || "";
        const j = (v.name && v.name[0]) || tel;
        if (j) { k.push({ j, t: tel }); n++; }
      });
      pridejNotif(t("app_kontakty"), t("kt_importovano", n));
      uloz();
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
    o.innerHTML = (stav.budiky.length ? stav.budiky.map((b, i) => `
      <div class="list-item">
        <div class="grow big">${Core.dva(b.h)}:${Core.dva(b.m)}</div>
        <button class="btn sm${b.zap ? "" : " ghost"}" data-prepni="${i}" aria-pressed="${b.zap}">${esc(t(b.zap ? "zap" : "vyp"))}</button>
        <button class="btn sm ghost" data-smaz="${i}" aria-label="${esc(t("smazat"))}">✕</button>
      </div>`).join("") : `<p class="muted">${esc(t("budik_zadny"))}</p>`) + `
      <div class="row" style="margin-top:12px">
        <input type="time" id="bd-cas" value="07:00" aria-label="${esc(t("hd_budik"))}">
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
      const v = $("#bd-cas").value.split(":");
      if (v.length < 2) return;
      stav.budiky.push({ h: +v[0], m: +v[1], zap: true, posledni: null });
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
        </div>`;
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
  w("=== LinsoftPhone OS 2.1 (PWA) ===");
  w("Napis 'pomoc' pro seznam prikazu.\n");
  $("#term-in").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const cmd = $("#term-in").value.trim();
    $("#term-in").value = "";
    w("linsoft> " + cmd);
    if (cmd === "pomoc") w("pomoc, info, cas, datum, kalk <vyraz>, vymaz");
    else if (cmd === "info") w(`Verze: 2.1 PWA\nPlatforma: ${navigator.platform}\nJazyk: ${navigator.language}\nOnline: ${navigator.onLine ? "ano" : "ne"}`);
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
  const prepinac = (id, zap) =>
    `<button class="btn sm${zap ? "" : " ghost"}" id="${id}" aria-pressed="${zap}">${esc(t(zap ? "zap" : "vyp"))}</button>`;
  c.innerHTML = `
    <div class="list-item"><div class="grow">${esc(t("st_motiv"))}</div>${prepinac("st-theme", svetly)}</div>
    <div class="list-item"><div class="grow">${esc(t("st_jazyk"))}</div>
      <select id="st-jazyk" aria-label="${esc(t("st_jazyk"))}">${Object.keys(Core.JAZYKY).map((k) =>
        `<option value="${k}"${k === stav.jazyk ? " selected" : ""}>${Core.JAZYKY[k]}</option>`).join("")}</select></div>
    <div class="list-item"><div class="grow">${esc(t("st_pin"))}</div>${prepinac("st-pin", !!stav.pin)}</div>
    <div id="st-pin-box"></div>
    ${umiNotif ? `<div class="list-item"><div class="grow">${esc(t("st_notif"))}</div>${prepinac("st-notif", stav.notifSys)}</div>` : ""}
    <button class="btn ghost full" id="st-zaloha">${esc(t("st_zaloha"))}</button>
    <button class="btn ghost full" id="st-obnov">${esc(t("st_obnov"))}</button>
    <input type="file" id="st-soubor" accept="application/json,.json" hidden>
    <div class="list-item" style="margin-top:16px"><div class="grow">${esc(t("st_o"))}</div></div>
    <div class="muted about">LinsoftPhone OS 2.1 (PWA)<br>${t("st_o_text")}</div>
    <button class="btn ghost full danger" id="st-reset">${esc(t("st_reset"))}</button>`;

  $("#st-theme").onclick = () => { nastavMotiv(!svetly); appNastaveni(c); };
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

/* ---------------- registr aplikaci ---------------- */
const APPS = [
  { id: "telefon", ikona: "📞", barva: "#44cc66", render: appTelefon, dock: true },
  { id: "zpravy", ikona: "💬", barva: "#3fa7f5", render: appZpravy, dock: true },
  { id: "kontakty", ikona: "👤", barva: "#f5913f", render: appKontakty },
  { id: "kalk", ikona: "🧮", barva: "#8e6cf0", render: appKalk },
  { id: "hodiny", ikona: "⏰", barva: "#f0556c", render: appHodiny },
  { id: "kalendar", ikona: "📅", barva: "#2bb8a8", render: appKalendar },
  { id: "poznamky", ikona: "📝", barva: "#e8c441", render: appPoznamky },
  { id: "fotak", ikona: "📷", barva: "#5a6c87", render: appFotak, dock: true },
  { id: "galerie", ikona: "🖼️", barva: "#d05ac4", render: appGalerie },
  { id: "terminal", ikona: "🖥️", barva: "#1c7a3d", render: appTerminal },
  { id: "nastaveni", ikona: "⚙️", barva: "#6b7a90", render: appNastaveni, dock: true }
];
function najdiApp(id) { return APPS.find((a) => a.id === id); }

function ikonka(app, bezPopisku) {
  const b = document.createElement("button");
  const nazev = t("app_" + app.id);
  b.className = "appicon";
  b.setAttribute("aria-label", nazev);
  b.innerHTML = `<span class="glyph" style="background:${app.barva}" aria-hidden="true">${app.ikona}</span>` +
    (bezPopisku ? "" : `<span aria-hidden="true">${esc(nazev)}</span>`);
  b.onclick = () => otevri(app.id);
  return b;
}
function vykresliIkony() {
  $("#appgrid").innerHTML = "";
  $("#dock").innerHTML = "";
  APPS.forEach((a) => $("#appgrid").appendChild(ikonka(a)));
  APPS.filter((a) => a.dock).forEach((a) => $("#dock").appendChild(ikonka(a, true)));
}

/* ---------------- start ---------------- */
if (store.get("svetly", false)) nastavMotiv(true);
prelozStranku();
vykresliIkony();
kresliNotif();
stavDlazdic();
Fotky.migrace();
tick();
setInterval(tick, 1000);
/* zkratky z ikony na plose (manifest "shortcuts"): ./#telefon, ./#fotak */
if (najdiApp(location.hash.slice(1))) otevri(location.hash.slice(1));

if ("serviceWorker" in navigator && window.isSecureContext !== false)
  navigator.serviceWorker.register("sw.js").catch(() => {});
