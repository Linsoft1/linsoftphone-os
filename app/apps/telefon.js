"use strict";

/* Telefon: klavesnice, nedavne hovory, kontakty */
function appTelefon(c, karta) {
  karta = karta || "klavesnice";
  const NAZVY = { klavesnice: t("tel_klavesnice"), nedavne: t("tel_nedavne"), kontakty: t("app_kontakty") };
  /* bez hlavicky aplikace: karty nahore jako v Androidu, klavesnice se vejde i na maly displej */
  c.innerHTML = `<div class="tel"><div class="tabs" role="tablist">${Object.keys(NAZVY).map((x) =>
    `<button role="tab" class="tab${x === karta ? " on" : ""}" aria-selected="${x === karta}" data-karta="${x}">${esc(NAZVY[x])}</button>`
  ).join("")}</div><div id="tel-obsah"></div></div>`;
  c.querySelectorAll(".tab").forEach((b) => b.onclick = () => appTelefon(c, b.dataset.karta));
  const o = $("#tel-obsah");
  const radekVolani = (cislo, popis, vpravo) => `
    <button class="nast-radek nast-akce tel-radek" data-cislo="${esc(cislo)}">${avatar(jmenoKCislu(cislo))}
      <span class="nast-text">${esc(jmenoKCislu(cislo))}<small>${popis}</small></span>${vpravo || ""}</button>`;
  const napoj = () => o.querySelectorAll("[data-cislo]").forEach((b) => b.onclick = () => volat(b.dataset.cislo));

  if (karta === "nedavne") {
    const hovory = store.get("hovory", []);
    const SMER = { odchozi: ["odchozi", "tel_odchozi"], prichozi: ["prichozi", "tel_prichozi"], zmeskany: ["prichozi", "tel_zmeskany"] };
    o.innerHTML = hovory.length
      ? `<div class="nast-skupina">${hovory.map((h) => {
          const s = SMER[h.smer] || SMER.odchozi;
          return radekVolani(h.cislo,
            `<span class="tel-smer ${h.smer}">${Ikony.ikona(s[0])}${esc(t(s[1]))}</span>`,
            `<span class="nast-hodnota">${esc(Core.kratkyCas(h.cas))}</span>`);
        }).join("")}</div>`
      : `<p class="kt-nic">${esc(t("tel_zadne"))}</p>`;
    return napoj();
  }

  if (karta === "kontakty") {
    const k = nactiKontakty().slice().sort((a, b) => a.j.localeCompare(b.j, stav.jazyk));
    o.innerHTML = k.length
      ? `<div class="nast-skupina">${k.map((x) => radekVolani(x.t, esc(x.t), Ikony.ikona("telefon", "tel-ik-volat"))).join("")}</div>`
      : `<p class="kt-nic">${esc(t("kt_zadne"))}</p>`;
    return napoj();
  }

  /* klavesnice s pismeny, podrzenim 0 se napise + */
  let cislo = "";
  o.innerHTML = `
    <div class="tel-displej">
      <div class="tel-cislo" id="tel-cislo" aria-live="polite"></div>
      <button class="tel-kdo" id="tel-kdo"></button>
    </div>
    <div class="tel-klavesy">${"123456789*0#".split("").map((d) =>
      `<button class="tel-k" data-d="${d}"><b>${d}</b><small>${Core.T9[d] || "&nbsp;"}</small></button>`).join("")}</div>
    <div class="tel-akce">
      <span></span>
      <button class="tel-volat" id="tel-volat" aria-label="${esc(t("kt_volat"))}">${Ikony.ikona("telefon")}</button>
      <button class="tel-mazat" id="tel-mazat" aria-label="${esc(t("smazat"))}">${Ikony.ikona("mazat")}</button>
    </div>`;
  const kresli = () => {
    $("#tel-cislo").textContent = cislo;
    $("#tel-mazat").style.visibility = cislo ? "visible" : "hidden";
    /* kontakt, jehoz cislo odpovida (nebo zacina) napsanym cislicim */
    const n = Core.cisloTel(cislo);
    const shoda = n.length >= 3 && nactiKontakty().find((x) => {
      const kc = Core.cisloTel(x.t);
      return kc === n || kc.indexOf(n) >= 0;
    });
    const kdo = $("#tel-kdo");
    kdo.innerHTML = shoda ? `${avatar(shoda.j)}<span>${esc(shoda.j)}<small>${esc(shoda.t)}</small></span>` : "";
    kdo.onclick = shoda ? () => { cislo = Core.cisloTel(shoda.t); kresli(); } : null;
  };
  let drzeni = null, plus = false;
  o.querySelectorAll(".tel-k").forEach((b) => {
    const d = b.dataset.d;
    b.addEventListener("pointerdown", () => {
      plus = false;
      if (d === "0") drzeni = setTimeout(() => { plus = true; cislo += "+"; kresli(); if (navigator.vibrate) navigator.vibrate(20); }, 550);
    });
    b.addEventListener("pointerup", () => clearTimeout(drzeni));
    b.addEventListener("pointerleave", () => clearTimeout(drzeni));
    b.onclick = () => { if (plus) { plus = false; return; } cislo += d; kresli(); };
  });
  $("#tel-mazat").onclick = () => { cislo = cislo.slice(0, -1); kresli(); };
  $("#tel-volat").onclick = () => {
    const n = Core.cisloTel(cislo);
    /* prazdne cislo: doplnit posledni volane, jako na telefonu */
    if (!n) { const posledni = store.get("hovory", [])[0]; if (posledni) { cislo = posledni.cislo; kresli(); } return; }
    volat(n);
  };
  kresli();
}
