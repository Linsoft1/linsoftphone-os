"use strict";

/* Kontakty */
function appKontakty(c, rezim) {
  const k = nactiKontakty();
  const uloz = () => store.set("kontakty", k);
  rezim = rezim || {};
  c.scrollTop = 0;

  /* ---- detail kontaktu ---- */
  if (typeof rezim.detail === "number" && k[rezim.detail]) {
    const i = rezim.detail, x = k[i];
    vnitrniZpet = () => appKontakty(c);
    c.innerHTML = `
      <div class="kt-hlava">
        ${avatar(x.j, "velky")}
        <h2>${esc(x.j)}</h2>
        <p>${esc(x.t)}</p>
      </div>
      <div class="kt-akce">
        <a href="tel:${esc(Core.cisloTel(x.t))}">${Ikony.ikona("telefon")}<span>${esc(t("kt_volat"))}</span></a>
        <button id="kt-sms">${Ikony.ikona("zpravy")}<span>${esc(t("kt_zprava"))}</span></button>
        <button id="kt-upravit">${Ikony.ikona("upravit")}<span>${esc(t("kt_upravit"))}</span></button>
      </div>
      <div class="nast-skupina">
        <div class="nast-radek"><span class="nast-text"><small>${esc(t("kt_cislo"))}</small>${esc(x.t || "—")}</span></div>
      </div>
      <div class="nast-skupina" style="margin-top:16px">
        <button class="nast-radek nast-akce nast-cervena" id="kt-smazat">
          <span class="nast-ik" style="background:#ef4444">${Ikony.ikona("kos")}</span>
          <span class="nast-text">${esc(t("smazat"))}</span>
        </button>
      </div>`;
    $("#kt-sms").onclick = () => otevri("zpravy", x.t);
    $("#kt-upravit").onclick = () => appKontakty(c, { upravit: i });
    $("#kt-smazat").onclick = () => {
      if (!confirm(t("kt_smazat_q", x.j))) return;
      k.splice(i, 1);
      uloz();
      appKontakty(c);
    };
    return;
  }

  /* ---- novy kontakt / uprava ---- */
  if (typeof rezim.upravit === "number") {
    const i = rezim.upravit, x = k[i] || { j: "", t: "" };
    vnitrniZpet = () => i >= 0 ? appKontakty(c, { detail: i }) : appKontakty(c);
    c.innerHTML = `
      <div class="kt-hlava" id="kt-nahled">${avatar(x.j || "?", "velky")}</div>
      <div class="nast-skupina kt-formular">
        <input id="kt-j" value="${esc(x.j)}" placeholder="${esc(t("kt_jmeno"))}" aria-label="${esc(t("kt_jmeno"))}" autocomplete="off">
        <input id="kt-t" value="${esc(x.t)}" type="tel" placeholder="${esc(t("kt_cislo"))}" aria-label="${esc(t("kt_cislo"))}" autocomplete="off">
      </div>
      <div class="kt-tlacitka">
        <button class="btn ghost" id="kt-zrusit">${esc(t("zrusit"))}</button>
        <button class="btn" id="kt-ulozit">${esc(t("ulozit"))}</button>
      </div>`;
    /* avatar se meni s psanim jmena */
    $("#kt-j").oninput = () => { $("#kt-nahled").innerHTML = avatar($("#kt-j").value.trim() || "?", "velky"); };
    $("#kt-zrusit").onclick = vnitrniZpet;
    $("#kt-ulozit").onclick = () => {
      const j = $("#kt-j").value.trim();
      if (!j) return $("#kt-j").focus();
      const novy = { j, t: $("#kt-t").value.trim() };
      if (i >= 0) k[i] = novy; else k.push(novy);
      uloz();
      appKontakty(c, { detail: i >= 0 ? i : k.length - 1 });
    };
    if (i < 0) $("#kt-j").focus();
    return;
  }

  /* ---- seznam: hledani, abecedni skupiny ---- */
  const umiImport = "contacts" in navigator && "ContactsManager" in window;
  c.innerHTML = `
    <label class="kt-hledat">${Ikony.ikona("hledat")}
      <input id="kt-q" type="search" placeholder="${esc(t("kt_hledat"))}" aria-label="${esc(t("kt_hledat"))}" autocomplete="off">
    </label>
    <div id="kt-seznam"></div>
    ${umiImport ? `<div class="nast-skupina" style="margin-top:18px">
      <button class="nast-radek nast-akce" id="kt-import">
        <span class="nast-ik" style="background:#14b8a6">${Ikony.ikona("stahnout")}</span>
        <span class="nast-text">${esc(t("kt_import"))}</span>
      </button></div>` : ""}
    <button class="fab" id="kt-novy" aria-label="${esc(t("kt_novy"))}">${Ikony.ikona("plus")}</button>`;

  const kresli = () => {
    const q = $("#kt-q").value.trim().toLowerCase();
    const seznam = k.map((x, i) => ({ x, i }))
      .filter((o) => !q || o.x.j.toLowerCase().indexOf(q) >= 0 || Core.cisloTel(o.x.t).indexOf(Core.cisloTel(q) || "~") >= 0)
      .sort((a, b) => a.x.j.localeCompare(b.x.j, stav.jazyk));
    if (!seznam.length) {
      $("#kt-seznam").innerHTML = `<p class="kt-nic">${esc(t(k.length ? "kt_nic" : "kt_zadne"))}</p>`;
      return;
    }
    /* skupiny podle prvniho pismena */
    let html = "", pismeno = null;
    seznam.forEach((o) => {
      const p = (o.x.j[0] || "#").toUpperCase();
      if (p !== pismeno) {
        if (pismeno !== null) html += "</div>";
        html += `<h3 class="kt-pismeno">${esc(p)}</h3><div class="nast-skupina">`;
        pismeno = p;
      }
      html += `<button class="nast-radek nast-akce kt-radek" data-i="${o.i}">${avatar(o.x.j)}
        <span class="nast-text">${esc(o.x.j)}<small>${esc(o.x.t)}</small></span></button>`;
    });
    $("#kt-seznam").innerHTML = html + "</div>";
    $("#kt-seznam").querySelectorAll("[data-i]").forEach((b) =>
      b.onclick = () => appKontakty(c, { detail: +b.dataset.i }));
  };
  $("#kt-q").oninput = kresli;
  kresli();
  $("#kt-novy").onclick = () => appKontakty(c, { upravit: -1 });

  /* skutecne kontakty z telefonu (Contact Picker API - Android Chrome) */
  if (umiImport) $("#kt-import").onclick = () => {
    navigator.contacts.select(["name", "tel"], { multiple: true }).then((vyber) => {
      let n = 0;
      vyber.forEach((v) => {
        const tel = (v.tel && v.tel[0]) || "";
        const j = (v.name && v.name[0]) || tel;
        if (j) { k.push({ j, t: tel }); n++; }
      });
      uloz();
      pridejNotif(t("app_kontakty"), t("kt_importovano", n));
      appKontakty(c);
    }).catch(() => {});
  };
}
