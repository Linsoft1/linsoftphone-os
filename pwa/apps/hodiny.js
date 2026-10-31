"use strict";

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
