"use strict";

/* Linsoft Browser - webovy prohlizec LinsoftPhone OS.
 * Stranky bezi ve vnorenem okne se sandboxem: nemohou prejit na jinou adresu
 * misto systemu ani cist data LinsoftPhone OS. Weby, ktere vnoreni zakazuji
 * (X-Frame-Options), se daji otevrit mimo. */
const PREHLIADAC_VERZE = "2.1.0";
const RYCHLY_PRISTUP = [
  { t: "Google", u: "https://www.google.com/webhp?igu=1" },
  { t: "Wikipédia", u: "https://sk.m.wikipedia.org/" },
  { t: "Mapy", u: "https://www.openstreetmap.org/export/embed.html?bbox=16.95,48.08,17.25,48.22&layer=mapnik" },
  { t: "Počasie", u: "https://wttr.in/Bratislava" },
  { t: "YouTube", u: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
  { t: "LinsoftPhone OS", u: "https://github.com/Linsoft1/linsoftphone-os" }
];

function appPrehliadac(c, adresa) {
  const novaKarta = (sukromna) => ({ url: "", zpet: [], vpred: [], sukromna: !!sukromna });
  const P = store.get("prehliadac", { karty: [novaKarta()], aktivni: 0 });
  if (!P.karty.length) P.karty = [novaKarta()];
  if (!P.karty[P.aktivni]) P.aktivni = 0;
  const zalozky = store.get("zalozky", []);
  let historie = store.get("historie", []);
  let hledac = store.get("prehliadacHledac", "google");
  const uloz = () => {
    /* soukrome karty se neukladaji vubec */
    const verejne = P.karty.filter((k) => !k.sukromna);
    store.set("prehliadac", { karty: verejne.length ? verejne : [novaKarta()],
      aktivni: Math.max(0, verejne.indexOf(P.karty[P.aktivni])) });
    store.set("zalozky", zalozky);
    store.set("historie", historie);
  };
  const karta = () => P.karty[P.aktivni];
  const tl = (id, ikona, popis) => `<button type="button" class="pr-tl" id="${id}" aria-label="${esc(t(popis))}">${Ikony.ikona(ikona)}</button>`;

  c.innerHTML = `
    <div class="pr">
      <div class="pr-adresa" id="pr-adresa">
        <span class="pr-ikona" id="pr-ikona"></span>
        <input id="pr-url" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false"
          placeholder="${esc(t("pr_hledat"))}" aria-label="${esc(t("pr_hledat"))}">
        ${tl("pr-vymaz", "zavrit", "smazat")}
        ${tl("pr-obnov", "restart", "pr_obnovit")}
      </div>
      <div class="pr-pruh" id="pr-pruh"></div>
      <div class="pr-telo">
        <iframe id="pr-ram" title="Linsoft Browser" hidden
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
          referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen; geolocation; autoplay; encrypted-media"></iframe>
        <div id="pr-start" class="pr-start"></div>
        <div id="pr-navrhy" class="pr-navrhy" hidden></div>
        <div id="pr-vrstva" class="pr-vrstva" hidden></div>
      </div>
      <nav class="pr-lista">
        ${tl("pr-zpet", "zpet", "zpet")}
        ${tl("pr-vpred", "sipka", "pr_vpred")}
        ${tl("pr-domu", "dum", "domu")}
        <button type="button" class="pr-tl pr-karty-tl" id="pr-karty" aria-label="${esc(t("pr_karty"))}">${Ikony.ikona("karty")}<span id="pr-pocet"></span></button>
        ${tl("pr-menu", "menu", "pr_menu")}
      </nav>
    </div>`;

  const ram = $("#pr-ram"), start = $("#pr-start"), vrstva = $("#pr-vrstva"), url = $("#pr-url"), navrhy = $("#pr-navrhy");

  /* ---- navigace ---- */
  function jdi(adresa) {
    const k = karta();   /* adresa "" = uvodni stranka */
    if (adresa === k.url) return zobraz();
    k.zpet.push(k.url);
    k.vpred = [];
    k.url = adresa;
    if (adresa && !k.sukromna)
      historie = [{ url: adresa, cas: Date.now() }].concat(historie.filter((h) => h.url !== adresa)).slice(0, 100);
    uloz();
    zobraz();
  }
  function zpet() { const k = karta(); if (!k.zpet.length) return; k.vpred.push(k.url); k.url = k.zpet.pop(); uloz(); zobraz(); }
  function vpred() { const k = karta(); if (!k.vpred.length) return; k.zpet.push(k.url); k.url = k.vpred.pop(); uloz(); zobraz(); }

  /* informacni stranka misto webu (blokovany web, bez pripojeni) */
  function hlaska(ikona, nadpis, text, tlacitko, akce) {
    start.innerHTML = `
      <div class="pr-hlaska">
        <span class="pr-hlaska-ik">${Ikony.ikona(ikona)}</span>
        <h2>${esc(nadpis)}</h2>
        <p>${esc(text)}</p>
        <button class="btn" id="pr-hlaska-tl">${esc(tlacitko)}</button>
      </div>`;
    $("#pr-hlaska-tl").onclick = akce;
  }

  function zobraz() {
    const k = karta();
    vrstva.hidden = true;
    navrhy.hidden = true;
    url.value = k.url ? Core.zobrazAdresu(k.url) : "";
    $("#pr-adresa").classList.toggle("sukromna", !!k.sukromna);
    $("#pr-ikona").innerHTML = Ikony.ikona(k.sukromna ? "sukromne" : /^https:/.test(k.url) ? "zamek" : "hledat");
    const uprava = Core.upravAdresu(k.url);
    const offline = navigator.onLine === false;
    if (!k.url || uprava.blokovane || offline) {
      ram.hidden = true;
      ram.removeAttribute("src");
      ram.dataset.url = "";
      $("#pr-pruh").classList.remove("nacita");
      start.hidden = false;
      start.scrollTop = 0;
      if (!k.url) kresliStart();
      else if (offline) hlaska("bezsite", t("pr_offline_nadpis"), t("pr_offline_text"), t("pr_znovu"), zobraz);
      else hlaska("zakaz", t("pr_blok_nadpis"), t("pr_blok_text", Core.zobrazAdresu(k.url)), t("pr_mimo"), otevritMimo);
    } else {
      start.hidden = true;
      ram.hidden = false;
      if (ram.dataset.url !== uprava.url) {
        ram.dataset.url = uprava.url;
        $("#pr-pruh").classList.add("nacita");
        ram.src = uprava.url;
      }
    }
    $("#pr-zpet").disabled = !k.zpet.length;
    $("#pr-vpred").disabled = !k.vpred.length;
    $("#pr-pocet").textContent = P.karty.length;
    /* systemove "Zpet" (lista, gesto) jde nejdriv zpet v prohlizeci */
    vnitrniZpet = k.zpet.length ? zpet : null;
  }
  ram.onload = () => $("#pr-pruh").classList.remove("nacita");
  function otevritMimo() { if (karta().url) window.open(karta().url, "_blank", "noopener"); }

  /* ---- adresni radek s navrhy ---- */
  function kresliNavrhy() {
    const q = url.value.trim();
    if (!q || q === karta().url) { navrhy.hidden = true; return; }
    const zdroje = zalozky.concat(
      historie.map((h) => ({ url: h.url, titulek: Core.zobrazAdresu(h.url) })),
      RYCHLY_PRISTUP.map((r) => ({ url: r.u, titulek: r.t })));
    const cil = Core.adresaZVstupu(q, hledac);
    const jeHledani = cil.indexOf(Core.HLEDACE[hledac] ? Core.HLEDACE[hledac].url : Core.HLEDANI) === 0;
    navrhy.innerHTML = `
      <button class="pr-navrh" data-url="${esc(cil)}">${Ikony.ikona(jeHledani ? "hledat" : "prehliadac")}
        <span class="nast-text">${esc(jeHledani ? t("pr_hledat_v", q) : Core.zobrazAdresu(cil))}
          <small>${esc(jeHledani ? (Core.HLEDACE[hledac] || Core.HLEDACE.google).nazev : cil)}</small></span></button>` +
      Core.navrhy(q, zdroje, 5).map((p) => `
      <button class="pr-navrh" data-url="${esc(p.url)}">${Ikony.ikona(zalozky.some((z) => z.url === p.url) ? "hvezda" : "budik")}
        <span class="nast-text">${esc(p.titulek || Core.zobrazAdresu(p.url))}<small>${esc(p.url)}</small></span></button>`).join("");
    navrhy.hidden = false;
    /* pointerdown: vybrat drive, nez adresni radek ztrati fokus */
    navrhy.querySelectorAll("[data-url]").forEach((b) => b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      url.blur();
      jdi(b.dataset.url);
    }));
  }
  url.onfocus = () => {
    $("#pr-adresa").classList.add("pise");
    if (karta().url) url.value = karta().url;
    setTimeout(() => url.select(), 0);
  };
  url.onblur = () => {
    $("#pr-adresa").classList.remove("pise");
    setTimeout(() => { if (document.activeElement !== url) navrhy.hidden = true; }, 150);
    url.value = karta().url ? Core.zobrazAdresu(karta().url) : "";
  };
  url.oninput = kresliNavrhy;
  url.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const adresa = Core.adresaZVstupu(url.value, hledac);
    url.blur();
    jdi(adresa);
  };
  $("#pr-vymaz").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    url.value = "";
    navrhy.hidden = true;
    url.focus();
  });
  $("#pr-obnov").onclick = () => {
    if (!karta().url) return;
    ram.dataset.url = "";
    zobraz();
  };
  $("#pr-zpet").onclick = zpet;
  $("#pr-vpred").onclick = vpred;
  $("#pr-domu").onclick = () => jdi("");

  /* ---- uvodni stranka ---- */
  const polozka = (u, nazev, extra) => `
    <div class="nast-radek pr-polozka">
      <button class="pr-otevrit" data-url="${esc(u)}">${avatar(nazev)}
        <span class="nast-text">${esc(nazev)}<small>${esc(Core.zobrazAdresu(u))}</small></span></button>${extra || ""}
    </div>`;
  function kresliStart() {
    const sukromna = karta().sukromna;
    start.innerHTML = `
      <div class="pr-logo${sukromna ? " sukromna" : ""}">
        <span class="pr-logo-ik">${Ikony.ikona(sukromna ? "sukromne" : "prehliadac")}</span>
        <h2>Linsoft Browser</h2>
        <p>${esc(sukromna ? t("pr_sukromna_info") : t("st_verze", PREHLIADAC_VERZE))}</p>
      </div>
      <button class="pr-hledat" id="pr-hledat">${Ikony.ikona("hledat")}<span>${esc(t("pr_hledat"))}</span>
        <small>${esc((Core.HLEDACE[hledac] || Core.HLEDACE.google).nazev)}</small></button>
      <h3 class="nast-nadpis">${esc(t("pr_rychle"))}</h3>
      <div class="pr-rychle">${RYCHLY_PRISTUP.map((r) =>
        `<button class="pr-otevrit" data-url="${esc(r.u)}">${avatar(r.t)}<span>${esc(r.t)}</span></button>`).join("")}</div>
      ${zalozky.length ? `<h3 class="nast-nadpis">${esc(t("pr_zalozky"))}</h3>
        <div class="nast-skupina">${zalozky.slice(0, 5).map((z) => polozka(z.url, z.titulek)).join("")}</div>` : ""}
      ${historie.length && !sukromna ? `<h3 class="nast-nadpis">${esc(t("pr_historie"))}</h3>
        <div class="nast-skupina">${historie.slice(0, 4).map((h) => polozka(h.url, Core.zobrazAdresu(h.url))).join("")}</div>` : ""}
      <p class="pr-tip">${esc(t("pr_tip"))}</p>`;
    $("#pr-hledat").onclick = () => url.focus();
    napojOdkazy(start);
  }
  function napojOdkazy(box) {
    box.querySelectorAll(".pr-otevrit").forEach((b) => b.onclick = () => jdi(b.dataset.url));
  }

  /* ---- vrstvy: menu, karty, zalozky, historie, nastaveni, o prohlizeci ---- */
  function ukazVrstvu(nadpis, obsah) {
    vrstva.innerHTML = `
      <div class="pr-vrstva-hlava">
        <h2>${esc(nadpis)}</h2>
        <button class="pr-tl" id="pr-zavrit" aria-label="${esc(t("zpet"))}">${Ikony.ikona("zavrit")}</button>
      </div>${obsah}`;
    vrstva.hidden = false;
    navrhy.hidden = true;
    vrstva.scrollTop = 0;
    $("#pr-zavrit").onclick = zobraz;
    vnitrniZpet = zobraz;
  }
  const akce = (id, ikona, barva, text) =>
    `<button class="nast-radek nast-akce" id="${id}"><span class="nast-ik" style="background:${barva}">${Ikony.ikona(ikona)}</span><span class="nast-text">${esc(text)}</span></button>`;
  const otevriKartu = (sukromna) => { P.karty.push(novaKarta(sukromna)); P.aktivni = P.karty.length - 1; uloz(); zobraz(); url.focus(); };

  $("#pr-menu").onclick = () => {
    const k = karta();
    const jeZalozka = k.url && zalozky.some((z) => z.url === k.url);
    ukazVrstvu("Linsoft Browser", `
      <div class="nast-skupina">
        ${akce("pm-nova", "plus", "#3b82f6", t("pr_nova_karta"))}
        ${akce("pm-sukromna", "sukromne", "#7c3aed", t("pr_sukromna"))}
      </div>
      <div class="nast-skupina" style="margin-top:14px">
        ${k.url ? akce("pm-zalozka", "hvezda", "#f59e0b", t(jeZalozka ? "pr_odebrat_zalozku" : "pr_pridat_zalozku")) : ""}
        ${k.url ? akce("pm-zdilet", "zdilet", "#0ea5e9", t("pr_zdilet")) : ""}
        ${k.url ? akce("pm-mimo", "venku", "#14b8a6", t("pr_mimo")) : ""}
        ${akce("pm-zalozky", "hvezda", "#eab308", t("pr_zalozky"))}
        ${akce("pm-historie", "budik", "#8b5cf6", t("pr_historie"))}
      </div>
      <div class="nast-skupina" style="margin-top:14px">
        ${akce("pm-nastaveni", "nastaveni", "#64748b", t("pr_nastaveni"))}
        ${akce("pm-o", "info", "#64748b", t("pr_o"))}
      </div>`);
    $("#pm-nova").onclick = () => otevriKartu(false);
    $("#pm-sukromna").onclick = () => otevriKartu(true);
    if (k.url) {
      $("#pm-zalozka").onclick = () => {
        const i = zalozky.findIndex((z) => z.url === k.url);
        if (i >= 0) zalozky.splice(i, 1);
        else zalozky.unshift({ url: k.url, titulek: Core.zobrazAdresu(k.url) });
        uloz();
        zobraz();
      };
      $("#pm-zdilet").onclick = () => {
        /* systemove sdileni telefonu, jinak zkopirovat do schranky */
        if (navigator.share) navigator.share({ url: k.url, title: Core.zobrazAdresu(k.url) }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(k.url)
          .then(() => pridejNotif("Linsoft Browser", t("pr_skopirovano")), () => {});
        zobraz();
      };
      $("#pm-mimo").onclick = () => { otevritMimo(); zobraz(); };
    }
    $("#pm-zalozky").onclick = ukazZalozky;
    $("#pm-historie").onclick = ukazHistorii;
    $("#pm-nastaveni").onclick = ukazNastaveni;
    $("#pm-o").onclick = () => {
      const jadro = Core.prohlizec(navigator.userAgent);
      const radek = (popis, hodnota) =>
        `<div class="nast-radek"><span class="nast-text">${esc(popis)}</span><span class="nast-hodnota">${esc(hodnota)}</span></div>`;
      ukazVrstvu(t("pr_o"), `
        <div class="pr-logo">
          <span class="pr-logo-ik">${Ikony.ikona("prehliadac")}</span>
          <h2>Linsoft Browser</h2>
          <p>${esc(t("st_verze", PREHLIADAC_VERZE))}</p>
        </div>
        <div class="nast-skupina info">
          ${radek(t("info_system"), "LinsoftPhone OS " + VERZE_OS)}
          ${radek(t("info_jadro"), jadro.nazev + " " + jadro.verze)}
          ${radek(t("pr_hledac"), (Core.HLEDACE[hledac] || Core.HLEDACE.google).nazev)}
          ${radek(t("pr_zalozky"), String(zalozky.length))}
          ${radek(t("pr_historie"), String(historie.length))}
        </div>
        <p class="pr-tip">${esc(t("pr_o_text"))}</p>`);
    };
  };

  function ukazNastaveni() {
    ukazVrstvu(t("pr_nastaveni"), `
      <h3 class="nast-nadpis">${esc(t("pr_hledac"))}</h3>
      <div class="nast-skupina">${Object.keys(Core.HLEDACE).map((k) => `
        <button class="nast-radek nast-akce" data-hledac="${k}">${avatar(Core.HLEDACE[k].nazev)}
          <span class="nast-text">${esc(Core.HLEDACE[k].nazev)}</span>
          ${k === hledac ? Ikony.ikona("hotovo", "pr-vybrano") : ""}</button>`).join("")}</div>
      <div class="nast-skupina" style="margin-top:22px">${akce("pr-vymazat-vse", "kos", "#ef4444", t("pr_vymazat_vse"))}</div>`);
    vrstva.querySelectorAll("[data-hledac]").forEach((b) => b.onclick = () => {
      hledac = b.dataset.hledac;
      store.set("prehliadacHledac", hledac);
      ukazNastaveni();
    });
    $("#pr-vymazat-vse").onclick = () => {
      historie = [];
      zalozky.length = 0;
      P.karty = [novaKarta()];
      P.aktivni = 0;
      uloz();
      pridejNotif("Linsoft Browser", t("pr_vymazano"));
      zobraz();
    };
  }

  function ukazZalozky() {
    ukazVrstvu(t("pr_zalozky"), zalozky.length
      ? `<div class="nast-skupina">${zalozky.map((z, i) => polozka(z.url, z.titulek,
          `<button class="pr-tl pr-smaz" data-i="${i}" aria-label="${esc(t("smazat"))}">${Ikony.ikona("zavrit")}</button>`)).join("")}</div>`
      : `<p class="kt-nic">${esc(t("pr_prazdne"))}</p>`);
    napojOdkazy(vrstva);
    vrstva.querySelectorAll(".pr-smaz").forEach((b) => b.onclick = () => { zalozky.splice(+b.dataset.i, 1); uloz(); ukazZalozky(); });
  }
  function ukazHistorii() {
    ukazVrstvu(t("pr_historie"), historie.length
      ? `<div class="nast-skupina">${historie.slice(0, 50).map((h) => polozka(h.url, Core.zobrazAdresu(h.url),
          `<span class="nast-hodnota">${Core.hhmm(new Date(h.cas))}</span>`)).join("")}</div>
         <div class="nast-skupina" style="margin-top:14px">${akce("pr-vymazat", "kos", "#ef4444", t("pr_vymazat"))}</div>`
      : `<p class="kt-nic">${esc(t("pr_prazdne"))}</p>`);
    napojOdkazy(vrstva);
    const v = $("#pr-vymazat");
    if (v) v.onclick = () => { historie = []; uloz(); ukazHistorii(); };
  }

  $("#pr-karty").onclick = function ukazKarty() {
    ukazVrstvu(t("pr_karty"), `
      <div class="pr-karty">${P.karty.map((k, i) => `
        <div class="pr-karta${i === P.aktivni ? " on" : ""}${k.sukromna ? " sukromna" : ""}">
          <button class="pr-karta-otevrit" data-i="${i}">${k.sukromna
            ? `<span class="avatar pr-maska">${Ikony.ikona("sukromne")}</span>`
            : avatar(k.url ? Core.zobrazAdresu(k.url) : "+")}
            <span>${esc(k.url ? Core.zobrazAdresu(k.url) : t(k.sukromna ? "pr_sukromna" : "pr_nova_karta"))}</span></button>
          <button class="pr-tl pr-karta-x" data-x="${i}" aria-label="${esc(t("smazat"))}">${Ikony.ikona("zavrit")}</button>
        </div>`).join("")}
        <button class="pr-karta pr-karta-nova" id="pr-nova">${Ikony.ikona("plus")}<span>${esc(t("pr_nova_karta"))}</span></button>
      </div>
      <div class="nast-skupina" style="margin-top:14px">${akce("pr-zavrit-vse", "kos", "#ef4444", t("pr_zavrit_karty"))}</div>`);
    vrstva.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { P.aktivni = +b.dataset.i; uloz(); zobraz(); });
    vrstva.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => {
      P.karty.splice(+b.dataset.x, 1);
      if (!P.karty.length) P.karty.push(novaKarta());
      P.aktivni = Math.min(P.aktivni, P.karty.length - 1);
      uloz();
      ukazKarty();
      $("#pr-pocet").textContent = P.karty.length;
    });
    $("#pr-nova").onclick = () => otevriKartu(false);
    $("#pr-zavrit-vse").onclick = () => { P.karty = [novaKarta()]; P.aktivni = 0; uloz(); zobraz(); };
  };

  /* pripojeni se vratilo -> znovu nacist stranku */
  window.addEventListener("online", function obnov() {
    if (!document.contains(ram)) return window.removeEventListener("online", obnov);
    if (karta().url) { ram.dataset.url = ""; zobraz(); }
  });

  zobraz();
  /* otevreni s adresou (napr. z hledani v telefonu) */
  if (adresa) jdi(adresa);
}
