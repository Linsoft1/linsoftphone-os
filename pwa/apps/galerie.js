"use strict";

/* Galerie: mrizka podle dni + prohlizec pres celou obrazovku (posouvani prstem) */
function appGalerie(c) {
  c.innerHTML = `<p class="kt-nic">…</p>`;
  Fotky.vse().then((fotky) => {
    if (stav.bezici !== "galerie") return;

    if (!fotky.length) {
      c.innerHTML = `
        <div class="pr-hlaska">
          <span class="pr-hlaska-ik">${Ikony.ikona("galerie")}</span>
          <h2>${esc(t("app_galerie"))}</h2>
          <p>${esc(t("gal_prazdna"))}</p>
          <button class="btn" id="gal-fotak">${esc(t("gal_otevrit_fotak"))}</button>
        </div>`;
      $("#gal-fotak").onclick = () => otevri("fotak");
      return;
    }

    /* skupiny podle dne porizeni (fotky jsou od nejnovejsi) */
    let html = `<div class="gal-hlava"><span>${esc(t("gal_fotky", fotky.length))}</span>
      <button class="pr-tl" id="gal-smaz-vse" aria-label="${esc(t("gal_smaz_vse"))}">${Ikony.ikona("kos")}</button></div>`;
    let den = null;
    fotky.forEach((f, i) => {
      const d = f.cas ? Core.nadpisDne(stav.jazyk, f.cas) : "";
      if (d !== den) {
        if (den !== null) html += "</div>";
        html += (d ? `<h3 class="gal-den">${esc(d)}</h3>` : "") + `<div class="gal-mriezka">`;
        den = d;
      }
      html += `<button class="gal-nahled" data-i="${i}"><img src="${esc(f.data)}" alt="" loading="lazy"></button>`;
    });
    c.innerHTML = html + "</div>";
    c.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => prohlizec(+b.dataset.i));
    $("#gal-smaz-vse").onclick = () => {
      if (confirm(t("gal_smazat_vse_q"))) Fotky.smazVse().then(() => appGalerie(c));
    };

    /* ---- prohlizec jedne fotky ---- */
    function prohlizec(i) {
      const p = document.createElement("div");
      p.className = "gal-prohlizec";
      p.innerHTML = `
        <div class="gal-lista">
          <button class="pr-tl" id="gp-zpet" aria-label="${esc(t("zpet"))}">${Ikony.ikona("zpet")}</button>
          <span class="gal-popis"><b id="gp-den"></b><small id="gp-pocet"></small></span>
          <span style="width:40px"></span>
        </div>
        <div class="gal-plocha" id="gp-plocha"><img id="gp-img" alt=""></div>
        <div class="gal-akce">
          <button id="gp-zdilet">${Ikony.ikona("zdilet")}<span>${esc(t("gal_zdilet"))}</span></button>
          <button id="gp-tapeta">${Ikony.ikona("galerie")}<span>${esc(t("st_tapeta"))}</span></button>
          <button id="gp-stahnout">${Ikony.ikona("stahnout")}<span>${esc(t("gal_stahnout"))}</span></button>
          <button id="gp-smazat">${Ikony.ikona("kos")}<span>${esc(t("smazat"))}</span></button>
        </div>`;
      c.appendChild(p);
      const zavri = () => { p.remove(); vnitrniZpet = null; };
      vnitrniZpet = zavri;

      const ukaz = () => {
        const f = fotky[i];
        $("#gp-img").src = f.data;
        $("#gp-den").textContent = f.cas ? Core.nadpisDne(stav.jazyk, f.cas) + " · " + Core.hhmm(new Date(f.cas)) : "";
        $("#gp-pocet").textContent = (i + 1) + " / " + fotky.length;
      };
      const posun = (o) => {
        if (i + o < 0 || i + o >= fotky.length) return;
        i += o;
        $("#gp-img").classList.remove("posun-l", "posun-p");
        void $("#gp-img").offsetWidth;
        $("#gp-img").classList.add(o > 0 ? "posun-l" : "posun-p");
        ukaz();
      };

      /* posouvani prstem (i mysi) mezi fotkami */
      let x0 = null;
      const plocha = $("#gp-plocha");
      plocha.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
      plocha.addEventListener("pointerup", (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 50) posun(dx < 0 ? 1 : -1);
      });

      const stahni = (f) => {
        const a = document.createElement("a");
        a.href = f.data;
        a.download = "linsoftos-foto-" + (f.id || Date.now()) + ".jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      $("#gp-zpet").onclick = zavri;
      $("#gp-stahnout").onclick = () => stahni(fotky[i]);
      $("#gp-zdilet").onclick = () => {
        /* systemove sdileni fotky (Android, iOS), jinak stazeni */
        const f = fotky[i];
        fetch(f.data).then((r) => r.blob()).then((b) => {
          const soubor = new File([b], "linsoftos-foto.jpg", { type: "image/jpeg" });
          if (navigator.canShare && navigator.canShare({ files: [soubor] })) return navigator.share({ files: [soubor] });
          stahni(f);
        }).catch(() => {});
      };
      $("#gp-tapeta").onclick = () => {
        store.set("tapetaFoto", fotky[i].id);
        nastavTapetu("foto", fotky[i].data);
        pridejNotif(t("st_tapeta"), t("tapeta_ok"));
      };
      $("#gp-smazat").onclick = () => {
        if (!confirm(t("gal_smazat_q"))) return;
        Fotky.smaz(fotky[i].id).then(() => { vnitrniZpet = null; appGalerie(c); });
      };
      ukaz();
    }
  });
}
