"use strict";

/* Zpravy: konverzace -> vlakno; odesila skutecne SMS (modem nebo SMS aplikace telefonu) */
let zpravyVlakno = null;
function appZpravy(c, komu) {
  const z = store.get("zpravy", []);
  c.scrollTop = 0;
  vnitrniZpet = null;
  zpravyVlakno = null;
  $("#app-title").textContent = t("app_zpravy");

  function posli(cislo, text, hotovo) {
    const ulozeno = () => {
      z.push({ txt: text, komu: cislo, cas: Date.now() });
      store.set("zpravy", z.slice(-200));
      pridejNotif(t("app_zpravy"), t("sms_odeslano", jmenoKCislu(cislo)));
      hotovo();
    };
    if (Nativ.aktivni) Nativ.api("sms", { cislo, text }).then(ulozeno, nativChyba);
    else { location.href = Core.smsOdkaz(cislo, text, JE_IOS); ulozeno(); }
  }
  const pole = (id, zmistni) => `
    <div class="zpr-pole">
      ${zmistni || ""}
      <div class="zpr-psani">
        <input id="${id}" placeholder="${esc(t("sms_text"))}" aria-label="${esc(t("sms_text"))}" autocomplete="off">
        <button class="zpr-odeslat" id="zpr-odeslat" aria-label="SMS">${Ikony.ikona("odeslat")}</button>
      </div>
    </div>`;

  /* ---- nova zprava ---- */
  if (komu && komu.nova) {
    vnitrniZpet = () => appZpravy(c);
    $("#app-title").textContent = t("zpr_nova");
    c.innerHTML = `<div class="zpr-obal">
      <div class="zpr-komu">
        <input id="zpr-komu" type="tel" list="zpr-kontakty" autocomplete="off"
          placeholder="${esc(t("sms_komu"))}" aria-label="${esc(t("sms_komu"))}">
        <datalist id="zpr-kontakty">${nactiKontakty().map((k) =>
          `<option value="${esc(k.t)}">${esc(k.j)}</option>`).join("")}</datalist>
      </div>
      <div class="zpr-vlakno"></div>
      ${pole("zpr-text", `<p class="zpr-info">${esc(t(Nativ.aktivni ? "sms_info_nativ" : "sms_info"))}</p>`)}</div>`;
    const odesli = () => {
      const cislo = Core.cisloTel($("#zpr-komu").value), text = $("#zpr-text").value.trim();
      if (!cislo) return $("#zpr-komu").focus();
      if (!text) return $("#zpr-text").focus();
      posli(cislo, text, () => { if (stav.bezici === "zpravy") appZpravy(c, cislo); });
    };
    $("#zpr-odeslat").onclick = odesli;
    $("#zpr-text").onkeydown = (e) => { if (e.key === "Enter") odesli(); };
    $("#zpr-komu").focus();
    return;
  }

  /* ---- vlakno s jednim cislem ---- */
  if (komu) {
    const cislo = Core.cisloTel(komu);
    zpravyVlakno = cislo;
    vnitrniZpet = () => appZpravy(c);
    $("#app-title").textContent = jmenoKCislu(cislo);
    const vlakno = z.filter((m) => Core.cisloTel(m.komu) === cislo);
    let den = "";
    c.innerHTML = `<div class="zpr-obal">
      <div class="zpr-vlakno">${vlakno.map((m) => {
        const d = Core.datumText(stav.jazyk, new Date(m.cas));
        const oddel = d !== den ? `<div class="zpr-den">${esc(den = d)}</div>` : "";
        return oddel + `<div class="bubble${m.prijata ? " in" : ""}">${esc(m.txt)}<small>${Core.hhmm(new Date(m.cas))}</small></div>`;
      }).join("") || `<p class="kt-nic">${esc(t("sms_zadne"))}</p>`}</div>
      ${pole("zpr-text")}</div>`;
    const odesli = () => {
      const text = $("#zpr-text").value.trim();
      if (!text) return $("#zpr-text").focus();
      posli(cislo, text, () => { if (stav.bezici === "zpravy") appZpravy(c, cislo); });
    };
    $("#zpr-odeslat").onclick = odesli;
    $("#zpr-text").onkeydown = (e) => { if (e.key === "Enter") odesli(); };
    c.scrollTop = c.scrollHeight;
    return;
  }

  /* ---- seznam konverzaci ---- */
  const konv = Core.konverzace(z);
  c.innerHTML = (konv.length
    ? `<div class="nast-skupina">${konv.map((k) => {
        const p = k.posledni;
        const kdo = k.komu ? jmenoKCislu(k.komu) : "?";
        return `<button class="nast-radek nast-akce zpr-konv" data-komu="${esc(k.komu)}">${avatar(kdo)}
          <span class="nast-text">${esc(kdo)}<small>${p.prijata ? "" : esc(t("zpr_ty")) + ": "}${esc(p.txt)}</small></span>
          <span class="nast-hodnota zpr-cas">${esc(Core.kratkyCas(p.cas))}</span></button>`;
      }).join("")}</div>`
    : `<p class="kt-nic">${esc(t("zpr_zadne"))}</p>`) +
    `<button class="fab" id="zpr-nova" aria-label="${esc(t("zpr_nova"))}">${Ikony.ikona("upravit")}</button>`;
  c.querySelectorAll("[data-komu]").forEach((b) => b.onclick = () => { if (b.dataset.komu) appZpravy(c, b.dataset.komu); });
  $("#zpr-nova").onclick = () => appZpravy(c, { nova: true });
}
