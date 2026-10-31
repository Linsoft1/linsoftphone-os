"use strict";

/* Kalendar: mesic s tecka u dnu s udalostmi, udalosti s casem nebo na cely den */
function appKalendar(c, posun) {
  posun = posun || 0;
  const T = Core.TEXTY[stav.jazyk];
  const dnes = new Date();
  const d = new Date(dnes.getFullYear(), dnes.getMonth() + posun, 1);
  const ud = store.get("udalosti", {});
  if (!stav.kalVyber) stav.kalVyber = Core.denKlic(dnes);
  const vyber = stav.kalVyber.split("-").map(Number);
  const seznam = Core.seradUdalosti(ud[stav.kalVyber]);

  let h = `
    <div class="cal-head">
      <button class="pr-tl" id="kal-pred" aria-label="‹">${Ikony.ikona("zpet")}</button>
      <h2>${esc(T.mesice[d.getMonth()])} ${d.getFullYear()}</h2>
      <button class="pr-tl" id="kal-dal" aria-label="›">${Ikony.ikona("sipka")}</button>
    </div>
    <div id="cal-grid">`;
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
  h += `</div>
    <div class="kal-den-hlava">
      <h3 class="kal-den">${esc(Core.datumText(stav.jazyk, new Date(vyber[0], vyber[1] - 1, vyber[2])))}</h3>
      ${posun || stav.kalVyber !== Core.denKlic(dnes) ? `<button class="btn ghost sm" id="kal-dnes">${esc(t("kal_dnes"))}</button>` : ""}
    </div>
    ${seznam.length ? `<div class="kal-udalosti">${seznam.map((u, i) => `
      <div class="kal-udalost">
        <span class="kal-cas">${esc(u.cas || t("kal_cely_den"))}</span>
        <span class="kal-text">${esc(u.text)}</span>
        <button class="pr-tl" data-smaz="${i}" aria-label="${esc(t("smazat"))}">${Ikony.ikona("zavrit")}</button>
      </div>`).join("")}</div>` : `<p class="kt-nic kal-nic">${esc(t("kal_zadne"))}</p>`}
    <div class="kal-nova">
      <input id="kal-in" placeholder="${esc(t("kal_nova"))}" aria-label="${esc(t("kal_nova"))}" autocomplete="off">
      <div class="kal-nova-radek">
        <select id="kal-cas" aria-label="${esc(t("kal_cas"))}">
          <option value="">${esc(t("kal_cely_den"))}</option>
          ${Array.from({ length: 24 }, (_, hod) => `<option value="${Core.dva(hod)}:00">${Core.dva(hod)}:00</option><option value="${Core.dva(hod)}:30">${Core.dva(hod)}:30</option>`).join("")}
        </select>
        <button class="btn" id="kal-add">${esc(t("pridat"))}</button>
      </div>
    </div>`;
  c.innerHTML = h;

  const uloz = (novy) => {
    if (novy.length) ud[stav.kalVyber] = novy; else delete ud[stav.kalVyber];
    store.set("udalosti", ud);
    appKalendar(c, posun);
  };
  $("#kal-pred").onclick = () => appKalendar(c, posun - 1);
  $("#kal-dal").onclick = () => appKalendar(c, posun + 1);
  const dnesTl = $("#kal-dnes");
  if (dnesTl) dnesTl.onclick = () => { stav.kalVyber = Core.denKlic(dnes); appKalendar(c, 0); };
  c.querySelectorAll("[data-den]").forEach((b) => b.onclick = () => { stav.kalVyber = b.dataset.den; appKalendar(c, posun); });
  c.querySelectorAll("[data-smaz]").forEach((b) => b.onclick = () => {
    seznam.splice(+b.dataset.smaz, 1);
    uloz(seznam);
  });
  const pridej = () => {
    const text = $("#kal-in").value.trim();
    if (!text) return $("#kal-in").focus();
    uloz(seznam.concat([{ text, cas: $("#kal-cas").value }]));
  };
  $("#kal-add").onclick = pridej;
  $("#kal-in").onkeydown = (e) => { if (e.key === "Enter") pridej(); };
}
