"use strict";

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
