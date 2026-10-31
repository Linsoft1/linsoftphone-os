"use strict";

/* Hodiny: cifernik a svetovy cas, budiky po dnech, kruhova minutka, stopky s koly */
const SVETOVE_CASY = [["Londýn", "Europe/London"], ["New York", "America/New_York"], ["Tokio", "Asia/Tokyo"]];
/* poradi dnu v tydnu od pondeli (hodnoty jako Date.getDay) */
const DNY_TYDNE = [1, 2, 3, 4, 5, 6, 0];

function appHodiny(c, karta) {
  karta = karta || store.get("hodinyKarta", "hodiny");
  store.set("hodinyKarta", karta);
  const NAZVY = { hodiny: t("hd_hodiny"), budik: t("hd_budik"), minutka: t("hd_minutka"), stopky: t("hd_stopky") };
  c.innerHTML = `<div class="tabs" role="tablist">${Object.keys(NAZVY).map((x) =>
    `<button role="tab" class="tab${x === karta ? " on" : ""}" aria-selected="${x === karta}" data-karta="${x}">${esc(NAZVY[x])}</button>`
  ).join("")}</div><div id="hd-obsah"></div>`;
  c.querySelectorAll(".tab").forEach((b) => b.onclick = () => appHodiny(c, b.dataset.karta));
  const o = $("#hd-obsah");
  /* obnovovani, dokud je karta na obrazovce */
  const opakuj = (fn, ms) => { fn(); const iv = setInterval(() => document.contains(o) ? fn() : clearInterval(iv), ms); };
  const T = Core.TEXTY[stav.jazyk];

  if (karta === "hodiny") {
    /* analogovy cifernik: rucicky se otaceji pres transform */
    const ryska = (i) => `<line x1="100" y1="${i % 3 ? 14 : 12}" x2="100" y2="${i % 3 ? 20 : 26}" transform="rotate(${i * 30} 100 100)"/>`;
    o.innerHTML = `
      <div class="hd-cifernik">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="94" class="hd-kruh"/>
          <g class="hd-rysky">${Array.from({ length: 12 }, (_, i) => ryska(i)).join("")}</g>
          <line id="hd-h" x1="100" y1="100" x2="100" y2="52" class="hd-hod"/>
          <line id="hd-m" x1="100" y1="100" x2="100" y2="30" class="hd-min"/>
          <line id="hd-s" x1="100" y1="114" x2="100" y2="24" class="hd-sek"/>
          <circle cx="100" cy="100" r="5" class="hd-stred"/>
        </svg>
      </div>
      <div class="big-time" id="hd-cas"></div>
      <div class="muted center" id="hd-datum"></div>
      <h3 class="nast-nadpis">${esc(t("hd_svet"))}</h3>
      <div class="nast-skupina info" id="hd-svet"></div>`;
    opakuj(() => {
      const d = new Date();
      const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60;
      $("#hd-h").setAttribute("transform", `rotate(${h * 30} 100 100)`);
      $("#hd-m").setAttribute("transform", `rotate(${m * 6} 100 100)`);
      $("#hd-s").setAttribute("transform", `rotate(${s * 6} 100 100)`);
      $("#hd-cas").textContent = Core.hhmm(d);
      $("#hd-datum").textContent = Core.datumText(stav.jazyk, d);
      $("#hd-svet").innerHTML = SVETOVE_CASY.map((z) => {
        let cas = "–";
        try { cas = d.toLocaleTimeString(stav.jazyk, { timeZone: z[1], hour: "2-digit", minute: "2-digit" }); } catch (e) { /* stary prohlizec */ }
        return `<div class="nast-radek"><span class="nast-text">${esc(z[0])}</span><span class="nast-hodnota hd-svet-cas">${esc(cas)}</span></div>`;
      }).join("");
    }, 1000);
  }

  else if (karta === "budik") {
    const uloz = () => { store.set("budiky", stav.budiky); appHodiny(c, "budik"); tick(); };
    const dnyText = (b) => !b.dny || !b.dny.length || b.dny.length === 7 ? t("budik_kazdy")
      : DNY_TYDNE.filter((x) => b.dny.indexOf(x) >= 0).map((x) => T.dnyKratke[(x + 6) % 7]).join(" ");
    const moznosti = (n, vybrano) => Array.from({ length: n }, (_, i) =>
      `<option value="${i}"${i === vybrano ? " selected" : ""}>${Core.dva(i)}</option>`).join("");
    o.innerHTML = (stav.budiky.length ? `<div class="hd-budiky">${stav.budiky.map((b, i) => `
      <div class="hd-budik${b.zap ? "" : " vyp"}">
        <div class="hd-budik-hlava">
          <b>${Core.dva(b.h)}:${Core.dva(b.m)}</b>
          <button class="prepinac${b.zap ? " on" : ""}" data-prepni="${i}" role="switch" aria-checked="${b.zap}" aria-label="${esc(t("hd_budik"))}"><span></span></button>
        </div>
        <div class="hd-budik-dny">
          ${DNY_TYDNE.map((x) => `<button class="hd-den${b.dny && b.dny.indexOf(x) >= 0 ? " on" : ""}" data-budik="${i}" data-den="${x}">${esc(T.dnyKratke[(x + 6) % 7])}</button>`).join("")}
          <button class="pr-tl hd-smaz" data-smaz="${i}" aria-label="${esc(t("smazat"))}">${Ikony.ikona("kos")}</button>
        </div>
        <small>${esc(dnyText(b))}</small>
      </div>`).join("")}</div>` : `<p class="kt-nic">${esc(t("budik_zadny"))}</p>`) + `
      <h3 class="nast-nadpis">${esc(t("budik_novy"))}</h3>
      <div class="hd-novy">
        <select id="bd-h" aria-label="${esc(t("hd_budik"))} h">${moznosti(24, 7)}</select><b>:</b>
        <select id="bd-m" aria-label="${esc(t("hd_budik"))} min">${moznosti(60, 0)}</select>
        <button class="btn" id="bd-pridat">${esc(t("pridat"))}</button>
      </div>
      <p class="pr-tip">${esc(t("budik_info"))}</p>`;
    o.querySelectorAll("[data-prepni]").forEach((b) => b.onclick = () => {
      const x = stav.budiky[+b.dataset.prepni];
      x.zap = !x.zap; x.posledni = null;
      uloz();
    });
    o.querySelectorAll("[data-den]").forEach((b) => b.onclick = () => {
      const x = stav.budiky[+b.dataset.budik], den = +b.dataset.den;
      x.dny = x.dny || [];
      const i = x.dny.indexOf(den);
      if (i >= 0) x.dny.splice(i, 1); else x.dny.push(den);
      uloz();
    });
    o.querySelectorAll("[data-smaz]").forEach((b) => b.onclick = () => { stav.budiky.splice(+b.dataset.smaz, 1); uloz(); });
    $("#bd-pridat").onclick = () => {
      stav.budiky.push({ h: +$("#bd-h").value, m: +$("#bd-m").value, zap: true, posledni: null, dny: [] });
      stav.budiky.sort((a, b) => a.h * 60 + a.m - b.h * 60 - b.m);
      uloz();
    };
  }

  else if (karta === "minutka") {
    let delka = store.get("minutkaDelka", 5 * 60000);
    const OBVOD = 2 * Math.PI * 88;
    o.innerHTML = `
      <div class="hd-kruh-minutka">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="88" class="hd-mn-pozadi"/>
          <circle cx="100" cy="100" r="88" class="hd-mn-postup" id="mn-kruh" stroke-dasharray="${OBVOD}"/>
        </svg>
        <div class="hd-mn-cas" id="mn-cas"></div>
      </div>
      <div class="chips" id="mn-volby">${[1, 3, 5, 10, 15, 30].map((m) =>
        `<button class="btn ghost sm" data-min="${m}">${m} min</button>`).join("")}</div>
      <div class="hd-ovladani">
        <button class="hd-kulate ghost" id="mn-reset">${esc(t("reset"))}</button>
        <button class="hd-kulate" id="mn-start"></button>
      </div>`;
    /* stav.minutka: { konec } bezi, { zbyva } pozastavena, null = pripravena */
    const zbyva = () => !stav.minutka ? delka : stav.minutka.konec ? Math.max(0, stav.minutka.konec - Date.now()) : stav.minutka.zbyva;
    const uk = () => {
      const ms = zbyva(), s = Math.ceil(ms / 1000);
      $("#mn-cas").textContent = Core.dva(Math.floor(s / 60)) + ":" + Core.dva(s % 60);
      $("#mn-kruh").style.strokeDashoffset = OBVOD * (1 - ms / (stav.minutka && stav.minutka.delka || delka));
      const bezi = stav.minutka && stav.minutka.konec;
      $("#mn-start").textContent = t(bezi ? "hd_pauza" : stav.minutka ? "hd_pokracovat" : "start");
      $("#mn-start").classList.toggle("pauza", !!bezi);
      $("#mn-volby").style.visibility = stav.minutka ? "hidden" : "visible";
    };
    const uloz = () => { store.set("minutka", stav.minutka); uk(); tick(); };
    o.querySelectorAll("[data-min]").forEach((b) => b.onclick = () => {
      delka = +b.dataset.min * 60000;
      store.set("minutkaDelka", delka);
      uk();
    });
    $("#mn-start").onclick = () => {
      if (stav.minutka && stav.minutka.konec) stav.minutka = { zbyva: zbyva(), delka: stav.minutka.delka };
      else stav.minutka = { konec: Date.now() + zbyva(), delka: stav.minutka ? stav.minutka.delka : delka };
      pripravZvuk();
      uloz();
    };
    $("#mn-reset").onclick = () => { stav.minutka = null; uloz(); };
    opakuj(uk, 250);
  }

  else {
    const st = stav.stopky;
    st.kola = st.kola || [];
    o.innerHTML = `
      <div class="hd-stopky" id="st-cas"></div>
      <div class="hd-ovladani">
        <button class="hd-kulate ghost" id="st-kolo"></button>
        <button class="hd-kulate" id="st-start"></button>
      </div>
      <div class="nast-skupina info" id="st-kola"></div>`;
    const cas = () => st.nab + (st.beh ? Date.now() - st.zac : 0);
    const format = (ms) => {
      const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000);
      return Core.dva(m) + ":" + Core.dva(s) + "," + Core.dva(cs);
    };
    const kresliKola = () => {
      $("#st-kola").innerHTML = st.kola.map((k, i) =>
        `<div class="nast-radek"><span class="nast-text">${esc(t("hd_kolo"))} ${st.kola.length - i}</span><span class="nast-hodnota">${format(k)}</span></div>`).join("");
      $("#st-kola").hidden = !st.kola.length;
    };
    const uk = () => {
      $("#st-cas").textContent = format(cas());
      $("#st-start").textContent = t(st.beh ? "stop" : "start");
      $("#st-start").classList.toggle("pauza", st.beh);
      $("#st-kolo").textContent = t(st.beh || !cas() ? "hd_kolo" : "reset");
    };
    $("#st-start").onclick = () => {
      if (st.beh) { st.nab += Date.now() - st.zac; st.beh = false; }
      else { st.zac = Date.now(); st.beh = true; }
      uk();
    };
    $("#st-kolo").onclick = () => {
      if (st.beh) { st.kola.unshift(cas()); kresliKola(); return; }
      st.nab = 0; st.kola = []; kresliKola(); uk();
    };
    kresliKola();
    opakuj(uk, 50);
  }
}
