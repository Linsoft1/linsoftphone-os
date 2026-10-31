"use strict";

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
