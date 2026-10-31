"use strict";

/* Linsoft Store - katalog Android aplikaci.
 * Android telefon: odkaz do Google Play / F-Droid (instalaci dokonci Android).
 * LinsoftPhone OS na telefonu (postmarketOS): instalace z F-Droid primo do Waydroidu
 * pres lokalni sluzbu. iPhone: Android aplikace nejdou. */
const OBCHOD_KATALOG = [
  { b: "com.whatsapp", n: "WhatsApp", k: "komunikace", play: true,
    p: { cs: "Zprávy, hovory a videohovory.", sk: "Správy, hovory a videohovory.", en: "Messages, calls and video calls." } },
  { b: "org.thoughtcrime.securesms", n: "Signal", k: "komunikace", play: true,
    p: { cs: "Šifrované zprávy a hovory.", sk: "Šifrované správy a hovory.", en: "Encrypted messages and calls." } },
  { b: "org.telegram.messenger", n: "Telegram", k: "komunikace", play: true,
    p: { cs: "Rychlé zprávy a kanály.", sk: "Rýchle správy a kanály.", en: "Fast messaging and channels." } },
  { b: "com.facebook.katana", n: "Facebook", k: "komunikace", play: true,
    p: { cs: "Sociální síť.", sk: "Sociálna sieť.", en: "Social network." } },
  { b: "com.instagram.android", n: "Instagram", k: "komunikace", play: true,
    p: { cs: "Fotky a krátká videa.", sk: "Fotky a krátke videá.", en: "Photos and short videos." } },
  { b: "com.google.android.youtube", n: "YouTube", k: "zabava", play: true,
    p: { cs: "Videa a hudba.", sk: "Videá a hudba.", en: "Videos and music." } },
  { b: "com.spotify.music", n: "Spotify", k: "zabava", play: true,
    p: { cs: "Hudba a podcasty.", sk: "Hudba a podcasty.", en: "Music and podcasts." } },
  { b: "com.netflix.mediaclient", n: "Netflix", k: "zabava", play: true,
    p: { cs: "Filmy a seriály.", sk: "Filmy a seriály.", en: "Movies and series." } },
  { b: "org.schabi.newpipe", n: "NewPipe", k: "zabava", fdroid: true,
    p: { cs: "Videa z YouTube bez reklam a sledování.", sk: "Videá z YouTube bez reklám a sledovania.", en: "YouTube videos without ads or tracking." } },
  { b: "org.videolan.vlc", n: "VLC", k: "zabava", play: true, fdroid: true,
    p: { cs: "Přehrávač videa a hudby.", sk: "Prehrávač videa a hudby.", en: "Video and music player." } },
  { b: "com.google.android.apps.maps", n: "Google Mapy", k: "mapy", play: true,
    p: { cs: "Mapy a navigace.", sk: "Mapy a navigácia.", en: "Maps and navigation." } },
  { b: "app.organicmaps", n: "Organic Maps", k: "mapy", play: true, fdroid: true,
    p: { cs: "Mapy bez připojení, bez reklam.", sk: "Mapy bez pripojenia, bez reklám.", en: "Offline maps, no ads." } },
  { b: "org.mozilla.firefox", n: "Firefox", k: "nastroje", play: true,
    p: { cs: "Webový prohlížeč.", sk: "Webový prehliadač.", en: "Web browser." } },
  { b: "org.wikipedia", n: "Wikipedie", k: "nastroje", play: true, fdroid: true,
    p: { cs: "Encyklopedie v kapse.", sk: "Encyklopédia vo vrecku.", en: "The encyclopedia in your pocket." } },
  { b: "com.kunzisoft.keepass.libre", n: "KeePassDX", k: "nastroje", fdroid: true,
    p: { cs: "Bezpečný správce hesel.", sk: "Bezpečný správca hesiel.", en: "Secure password manager." } },
  { b: "org.fdroid.fdroid", n: "F-Droid", k: "nastroje", fdroid: true,
    p: { cs: "Obchod s otevřenými aplikacemi.", sk: "Obchod s otvorenými aplikáciami.", en: "Store for open-source apps." } }
];
const OBCHOD_KATEGORIE = ["vse", "komunikace", "zabava", "mapy", "nastroje"];
const obchodHlasene = {};   /* chyby instalaci, ktere uz byly oznameny */

function appObchod(c, detail) {
  const platforma = Core.platformaObchodu(navigator.userAgent, Nativ.aktivni);
  let kategorie = "vse", stavAndroid = { dostupne: false, nainstalovane: [], instalace: {} };
  c.scrollTop = 0;

  const popis = (a) => a.p[stav.jazyk] || a.p.en;
  const nainstalovana = (a) => stavAndroid.nainstalovane.indexOf(a.b) >= 0;
  const zdroje = (a) => (a.play ? `<span class="ob-stitek">Google Play</span>` : "") + (a.fdroid ? `<span class="ob-stitek fd">F-Droid</span>` : "");

  /* tlacitko podle platformy a stavu aplikace */
  function tlacitko(a, velke) {
    const tr = "btn" + (velke ? " full" : " sm ob-tl");
    const prubeh = stavAndroid.instalace[a.b];
    if (platforma === "ios") return `<button class="${tr}" disabled>${esc(t("ob_nejde"))}</button>`;
    if (platforma === "waydroid") {
      if (nainstalovana(a)) return `<button class="${tr}" data-spustit="${a.b}">${esc(t("ob_otevrit"))}</button>`;
      if (prubeh === "stahuje" || prubeh === "instaluje") return `<button class="${tr}" disabled>${esc(t("ob_instaluje"))}</button>`;
      if (!a.fdroid) return `<button class="${tr} ghost" disabled>${esc(t("ob_jen_play"))}</button>`;
      return `<button class="${tr}" data-instalovat="${a.b}">${esc(t("ob_instalovat"))}</button>`;
    }
    /* Android telefon nebo pocitac: otevrit stranku obchodu */
    return `<a class="${tr}" href="${esc(a.play ? Core.odkazPlay(a.b) : Core.odkazFdroid(a.b))}" target="_blank" rel="noopener">${esc(t("ob_instalovat"))}</a>`;
  }
  const napoj = () => {
    c.querySelectorAll("[data-instalovat]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      Nativ.api("android/instalovat", { balik: b.dataset.instalovat }).then(obnov, nativChyba);
    });
    c.querySelectorAll("[data-spustit]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      Nativ.api("android/spustit", { balik: b.dataset.spustit }).catch(nativChyba);
    });
    c.querySelectorAll("[data-detail]").forEach((b) => b.onclick = () => appObchod(c, b.dataset.detail));
  };

  /* poznamka nahore: jak se na tomto zarizeni instaluje */
  const INFO = { android: "ob_info_android", ios: "ob_info_ios", pc: "ob_info_pc", waydroid: "ob_info_waydroid" };
  const infoPanel = () => `<div class="ob-info ${platforma}">${Ikony.ikona(platforma === "ios" ? "zakaz" : "info")}<span>${esc(t(
    platforma === "waydroid" && !stavAndroid.dostupne ? "ob_bez_waydroid" : INFO[platforma]))}</span></div>`;

  function kresli() {
    /* ---- detail aplikace ---- */
    const a = detail && OBCHOD_KATALOG.find((x) => x.b === detail);
    if (a) {
      vnitrniZpet = () => appObchod(c);
      c.innerHTML = `
        <div class="ob-detail">
          ${avatar(a.n, "velky")}
          <h2>${esc(a.n)}</h2>
          <p class="ob-zdroje">${zdroje(a)}</p>
          ${tlacitko(a, true)}
          ${platforma === "waydroid" && nainstalovana(a) ? `<button class="btn ghost full" id="ob-odinstalovat">${esc(t("ob_odinstalovat"))}</button>` : ""}
          <p class="ob-popis">${esc(popis(a))}</p>
          <div class="nast-skupina info">
            <div class="nast-radek"><span class="nast-text">${esc(t("ob_kategorie"))}</span><span class="nast-hodnota">${esc(t("ob_k_" + a.k))}</span></div>
            <div class="nast-radek"><span class="nast-text">${esc(t("ob_balik"))}</span><span class="nast-hodnota">${esc(a.b)}</span></div>
            <div class="nast-radek"><span class="nast-text">${esc(t("ob_otevrena"))}</span><span class="nast-hodnota">${esc(t(a.fdroid ? "ano" : "ne"))}</span></div>
          </div>
          ${infoPanel()}
        </div>`;
      const od = $("#ob-odinstalovat");
      if (od) od.onclick = () => Nativ.api("android/odinstalovat", { balik: a.b }).then(obnov, nativChyba);
      return napoj();
    }

    /* ---- katalog ---- */
    const q = ($("#ob-q") && $("#ob-q").value || "").trim().toLowerCase();
    const vyber = OBCHOD_KATALOG.filter((x) => (kategorie === "vse" || x.k === kategorie) &&
      (!q || x.n.toLowerCase().indexOf(q) >= 0 || popis(x).toLowerCase().indexOf(q) >= 0));
    const seznam = vyber.map((x) => `
      <div class="nast-radek nast-akce ob-radek" data-detail="${x.b}">${avatar(x.n)}
        <span class="nast-text">${esc(x.n)}<small>${esc(popis(x))}</small><span class="ob-zdroje">${zdroje(x)}</span></span>
        ${tlacitko(x)}
      </div>`).join("");
    if (!$("#ob-seznam")) {
      c.innerHTML = `
        <div class="ob-hlava">
          <span class="ob-logo">${Ikony.ikona("obchod")}</span>
          <div><h2>Linsoft Store</h2><p>${esc(t("ob_podtitul"))}</p></div>
        </div>
        <div id="ob-info"></div>
        <div class="nast-skupina ob-apk-karta">
          <button class="nast-radek nast-akce" id="ob-apk">
            <span class="nast-ik" style="background:#0e7490">${Ikony.ikona("stahnout")}</span>
            <span class="nast-text">${esc(t("ob_apk"))}<small>${esc(t("ob_apk_info"))}</small></span>
            ${Ikony.ikona("sipka", "nast-sipka")}
          </button>
          <div id="ob-apk-navod" class="ob-navod" hidden></div>
        </div>
        <input type="file" id="ob-apk-subor" accept=".apk,application/vnd.android.package-archive" hidden>
        <div id="ob-nainstalovane"></div>
        <label class="kt-hledat">${Ikony.ikona("hledat")}
          <input id="ob-q" type="search" placeholder="${esc(t("kt_hledat"))}" aria-label="${esc(t("kt_hledat"))}" autocomplete="off">
        </label>
        <div class="chips ob-kategorie" id="ob-kategorie"></div>
        <div class="nast-skupina" id="ob-seznam"></div>`;
      $("#ob-q").oninput = kresli;
      $("#ob-apk").onclick = rucniApk;
      $("#ob-apk-subor").onchange = () => { const f = $("#ob-apk-subor").files[0]; $("#ob-apk-subor").value = ""; if (f) nahrajApk(f); };
    }
    /* poznamka se meni, az sluzba odpovi, jestli je Waydroid k dispozici */
    $("#ob-info").innerHTML = infoPanel();
    /* nainstalovane Android aplikace (i rucne z APK, ktere nejsou v katalogu) */
    $("#ob-nainstalovane").innerHTML = platforma === "waydroid" && stavAndroid.nainstalovane.length
      ? `<h3 class="nast-nadpis">${esc(t("ob_nainstalovane"))}</h3><div class="nast-skupina">${stavAndroid.nainstalovane.map((b) => {
          const x = OBCHOD_KATALOG.find((y) => y.b === b);
          const nazev = x ? x.n : b.split(".").pop();
          return `<div class="nast-radek">${avatar(nazev)}<span class="nast-text">${esc(nazev)}<small>${esc(b)}</small></span>
            <button class="btn sm ob-tl" data-spustit="${esc(b)}">${esc(t("ob_otevrit"))}</button>
            <button class="pr-tl" data-odinstalovat="${esc(b)}" aria-label="${esc(t("ob_odinstalovat"))}">${Ikony.ikona("kos")}</button></div>`;
        }).join("")}</div>`
      : "";
    $("#ob-nainstalovane").querySelectorAll("[data-odinstalovat]").forEach((b) => b.onclick = () => {
      if (confirm(t("ob_odinstalovat") + ": " + b.dataset.odinstalovat + "?"))
        Nativ.api("android/odinstalovat", { balik: b.dataset.odinstalovat }).then(obnov, nativChyba);
    });
    $("#ob-kategorie").innerHTML = OBCHOD_KATEGORIE.map((k) =>
      `<button class="btn sm${k === kategorie ? "" : " ghost"}" data-kategorie="${k}">${esc(t("ob_k_" + k))}</button>`).join("");
    $("#ob-kategorie").querySelectorAll("[data-kategorie]").forEach((b) => b.onclick = () => { kategorie = b.dataset.kategorie; kresli(); });
    $("#ob-seznam").innerHTML = seznam || `<p class="kt-nic">${esc(t("kt_nic"))}</p>`;
    napoj();
  }

  /* LinsoftPhone OS na telefonu: stav Waydroidu a prubeh instalaci (obnovuje se, dokud se instaluje) */
  function obnov() {
    if (platforma !== "waydroid") return;
    Nativ.api("android").then((s) => {
      if (stav.bezici !== "obchod") return;
      stavAndroid = s;
      kresli();
      const bezi = Object.keys(s.instalace).some((k) => s.instalace[k] === "stahuje" || s.instalace[k] === "instaluje");
      if (bezi) setTimeout(obnov, 1500);
      Object.keys(s.instalace).forEach((k) => {
        const v = String(s.instalace[k]);
        if (obchodHlasene[k] === v) return;
        if (v.indexOf("chyba") === 0) { obchodHlasene[k] = v; pridejNotif("Linsoft Store", v); }
        /* rucne nahrany APK hotov: "hotovo: nazev.baliku" */
        else if (k.indexOf("apk:") === 0 && v.indexOf("hotovo") === 0) {
          obchodHlasene[k] = v;
          pridejNotif("Linsoft Store", t("ob_apk_hotovo", v.replace(/^hotovo:?\s*/, "") || k.slice(4)));
        }
      });
    }).catch(() => {});
  }

  /* ---- rucni instalace stazeneho APK ---- */
  function rucniApk() {
    if (platforma === "waydroid") return $("#ob-apk-subor").click();
    /* Android / iPhone / pocitac: webova aplikace APK instalatoru predat nemuze - navod */
    const navod = $("#ob-apk-navod");
    navod.textContent = t(platforma === "android" ? "ob_apk_android" : platforma === "ios" ? "ob_info_ios" : "ob_apk_pc");
    navod.hidden = !navod.hidden;
  }
  function nahrajApk(f) {
    if (!/\.apk$/i.test(f.name)) return pridejNotif("Linsoft Store", t("ob_apk_zly"));
    if (f.size > 300 * 1024 * 1024) return pridejNotif("Linsoft Store", t("ob_apk_velky"));
    /* APK je ZIP: prvni dva bajty "PK" */
    const r = new FileReader();
    r.onload = () => {
      const b = new Uint8Array(r.result);
      if (b[0] !== 0x50 || b[1] !== 0x4b) return pridejNotif("Linsoft Store", t("ob_apk_zly"));
      if (!confirm(t("ob_apk_potvrd", f.name + " (" + Core.velikost(f.size, stav.jazyk) + ")") + "\n\n" + t("ob_apk_varovanie"))) return;
      $("#ob-apk").classList.add("nahrava");
      $("#ob-apk .nast-text small").textContent = t("ob_apk_nahrava");
      fetch("/api/android/apk", {
        method: "POST", body: f,
        headers: { "X-Linsoft": "1", "X-Nazev": encodeURIComponent(f.name), "Content-Type": "application/vnd.android.package-archive" }
      }).then((o) => o.json().then((j) => { if (!o.ok) throw new Error(j.chyba || o.status); return j; }))
        .then(obnov, nativChyba)
        .then(() => {
          const el = $("#ob-apk");
          if (!el) return;
          el.classList.remove("nahrava");
          $("#ob-apk .nast-text small").textContent = t("ob_apk_info");
        });
    };
    r.readAsArrayBuffer(f.slice(0, 4));
  }

  kresli();
  obnov();
}
