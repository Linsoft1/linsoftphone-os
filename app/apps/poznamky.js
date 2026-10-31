"use strict";

/* Poznamky: vic poznamek jako barevne karticky, hledani, editor s automatickym ukladanim.
 * Prvni radek poznamky je jeji nazev. */
const BARVY_POZNAMEK = ["", "#facc15", "#4ade80", "#38bdf8", "#f472b6", "#a78bfa"];

function nactiPoznamky() {
  let p = store.get("poznamkyV2", null);
  if (!p) {
    /* starsi verze mela jedinou poznamku jako text */
    const stara = store.get("poznamky", "");
    p = stara.trim() ? [{ id: Date.now(), text: stara, cas: Date.now(), barva: "" }] : [];
    store.set("poznamkyV2", p);
  }
  return p;
}

function appPoznamky(c, id) {
  const poznamky = nactiPoznamky();
  const uloz = () => store.set("poznamkyV2", poznamky);
  c.scrollTop = 0;

  /* ---- editor ---- */
  if (id !== undefined) {
    let p = poznamky.find((x) => x.id === id);
    if (!p) { p = { id, text: "", cas: Date.now(), barva: "" }; poznamky.unshift(p); }
    const zpet = () => {
      /* prazdna poznamka se nezachova */
      if (!p.text.trim()) { poznamky.splice(poznamky.indexOf(p), 1); uloz(); }
      appPoznamky(c);
    };
    vnitrniZpet = zpet;
    c.innerHTML = `
      <div class="pz-editor"${p.barva ? ` style="--pz:${p.barva}"` : ""}>
        <div class="pz-lista">
          <div class="pz-barvy" role="radiogroup" aria-label="${esc(t("pz_barva"))}">${BARVY_POZNAMEK.map((b) =>
            `<button class="pz-barva${b === p.barva ? " on" : ""}" data-barva="${b}" style="background:${b || "var(--panel)"}" aria-label="${esc(t("pz_barva"))}"></button>`).join("")}</div>
          <button class="pr-tl" id="pz-smazat" aria-label="${esc(t("smazat"))}">${Ikony.ikona("kos")}</button>
        </div>
        <textarea id="pz-text" placeholder="${esc(t("pz_ph"))}" aria-label="${esc(t("app_poznamky"))}">${esc(p.text)}</textarea>
        <p class="pz-stav">${esc(t("pz_ulozeno").replace(/\.$/, ""))} · ${esc(Core.kratkyCas(p.cas))}</p>
      </div>`;
    const pole = $("#pz-text");
    pole.oninput = () => { p.text = pole.value; p.cas = Date.now(); uloz(); };
    c.querySelectorAll("[data-barva]").forEach((b) => b.onclick = () => {
      p.barva = b.dataset.barva;
      uloz();
      appPoznamky(c, p.id);
    });
    $("#pz-smazat").onclick = () => {
      if (p.text.trim() && !confirm(t("pz_smazat_q"))) return;
      poznamky.splice(poznamky.indexOf(p), 1);
      uloz();
      vnitrniZpet = null;
      appPoznamky(c);
    };
    if (!p.text) pole.focus();
    return;
  }

  /* ---- seznam: hledani + mrizka karticek, nejnovejsi nahore ---- */
  c.innerHTML = `
    <label class="kt-hledat">${Ikony.ikona("hledat")}
      <input id="pz-q" type="search" placeholder="${esc(t("kt_hledat"))}" aria-label="${esc(t("kt_hledat"))}" autocomplete="off">
    </label>
    <div id="pz-seznam"></div>
    <button class="fab" id="pz-nova" aria-label="${esc(t("pz_nova"))}">${Ikony.ikona("plus")}</button>`;
  const kresli = () => {
    const q = $("#pz-q").value.trim().toLowerCase();
    const vyber = poznamky.slice().sort((a, b) => b.cas - a.cas)
      .filter((p) => !q || p.text.toLowerCase().indexOf(q) >= 0);
    $("#pz-seznam").innerHTML = vyber.length
      ? `<div class="pz-mriezka">${vyber.map((p) => {
          const r = Core.rozdelPoznamku(p.text);
          return `<button class="pz-karta" data-id="${p.id}"${p.barva ? ` style="--pz:${p.barva}"` : ""}>
            <b>${esc(r.nazev || t("pz_bez_nazvu"))}</b>
            ${r.nahled ? `<span>${esc(r.nahled)}</span>` : ""}
            <small>${esc(Core.kratkyCas(p.cas))}</small></button>`;
        }).join("")}</div>`
      : `<p class="kt-nic">${esc(t(poznamky.length ? "kt_nic" : "pz_zadne"))}</p>`;
    $("#pz-seznam").querySelectorAll("[data-id]").forEach((b) => b.onclick = () => appPoznamky(c, +b.dataset.id));
  };
  $("#pz-q").oninput = kresli;
  $("#pz-nova").onclick = () => appPoznamky(c, Date.now());
  kresli();
}
