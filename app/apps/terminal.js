"use strict";

/* Terminal ako v Linuxe: vyzva user@linsoftphone:~$, historie sipkami, Tab doplnuje,
 * Ctrl+C zrusi radek, Ctrl+L vymaze obrazovku.
 * Na telefonu s LinsoftPhone OS (postmarketOS) bezi skutecny shell telefonu (linsoft-sluzba),
 * jinde vestaveny linuxovy shell s vlastnim souborovym systemem (shell.js). */
function appTerminal(c) {
  c.innerHTML = `
    <div class="ter">
      <div class="ter-okno">
        <div class="ter-lista"><i></i><i></i><i></i><span id="ter-titulek"></span></div>
        <div id="term" class="ter-vystup" role="log" aria-live="polite"></div>
      </div>
      <div class="chips ter-rychle">${["Tab", "↑", "Ctrl+C", "ls -la", "cd ..", "clear", "help"].map((p) =>
        `<button class="btn ghost sm" data-klavesa="${p}">${p}</button>`).join("")}</div>
    </div>`;
  const tm = $("#term");
  /* vestaveny shell: stav (souborovy system, cesta, historie) se uklada v telefonu */
  const sh = new LinuxShell.Shell(store.get("terminalShell", null), VERZE_OS);
  sh.spocitej = (x) => Core.spocitej(x);
  const uloz = () => store.set("terminalShell", sh.ulozit());
  /* skutecny shell: cesta a jmeno se vraci ze sluzby */
  let skutecny = Nativ.aktivni, nativ = { cwd: "", uzivatel: "user", host: "linsoftphone", home: "" };
  let pozice = sh.historie.length, ceka = false;

  const vyzva = () => {
    if (!skutecny) return sh.vyzva();
    const cesta = nativ.home && nativ.cwd.indexOf(nativ.home) === 0 ? "~" + nativ.cwd.slice(nativ.home.length) : nativ.cwd || "~";
    return { uzivatel: nativ.uzivatel, host: nativ.host, cesta };
  };
  const vyzvaHtml = () => {
    const v = vyzva();
    return `<span class="ter-uz">${esc(v.uzivatel)}@${esc(v.host)}</span>:<span class="ter-cesta">${esc(v.cesta)}</span>$ `;
  };
  const pis = (text, trida) => {
    if (!text) return;
    const r = document.createElement("div");
    r.className = "ter-text" + (trida ? " " + trida : "");
    r.textContent = text.replace(/\n$/, "");
    tm.insertBefore(r, radek);
  };

  /* radek s vyzvou a vstupem je vzdy posledni */
  const radek = document.createElement("div");
  radek.className = "ter-radek";
  radek.innerHTML = `<span class="ter-vyzva"></span><input id="term-in" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="shell">`;
  tm.appendChild(radek);
  const vstup = $("#term-in");
  const obnovVyzvu = () => {
    radek.querySelector(".ter-vyzva").innerHTML = vyzvaHtml();
    $("#ter-titulek").textContent = vyzva().uzivatel + "@" + vyzva().host + ": " + vyzva().cesta + (skutecny ? "  (postmarketOS)" : "");
    tm.scrollTop = tm.scrollHeight;
  };
  const historie = () => sh.historie;

  function proved(prikaz) {
    const zadani = document.createElement("div");
    zadani.className = "ter-text";
    zadani.innerHTML = vyzvaHtml() + esc(prikaz);
    tm.insertBefore(zadani, radek);
    pozice = historie().length + (prikaz.trim() ? 1 : 0);
    if (prikaz.trim() === "clear") {
      if (skutecny) sh.historie.push(prikaz);
      vymazat();
      return uloz();
    }
    if (!skutecny) {
      const r = sh.spust(prikaz);
      if (r.vymazat) vymazat(); else pis(r.vystup, /^(\S+: )/.test(r.vystup) && sh.posledniKod ? "ter-chyba" : "");
      uloz();
      return obnovVyzvu();
    }
    /* skutecny shell telefonu */
    if (prikaz.trim()) sh.historie.push(prikaz);
    uloz();
    if (!prikaz.trim()) return obnovVyzvu();
    ceka = true;
    radek.classList.add("ceka");
    Nativ.api("terminal", { prikaz, cwd: nativ.cwd }).then((r) => {
      nativ = r;
      pis(r.vystup, r.kod ? "ter-chyba" : "");
    }, (e) => {
      /* sluzba skutecny shell nema (napr. ukazkovy rezim) -> vestaveny shell */
      skutecny = false;
      pis(String(e.message || e) + "\n→ " + t("ter_vstavany"), "ter-chyba");
      proved(prikaz);
    }).then(() => { ceka = false; radek.classList.remove("ceka"); obnovVyzvu(); });
  }
  function vymazat() {
    Array.from(tm.children).forEach((x) => { if (x !== radek) x.remove(); });
    obnovVyzvu();
  }
  function doplnit() {
    if (skutecny) return;   /* doplnovani umi jen vestaveny shell */
    const r = sh.doplnit(vstup.value);
    if (r.moznosti.length) {
      const z = document.createElement("div");
      z.className = "ter-text";
      z.innerHTML = vyzvaHtml() + esc(vstup.value);
      tm.insertBefore(z, radek);
      pis(r.moznosti.join("  "));
    }
    vstup.value = r.radek;
  }
  function klavesa(k) {
    if (ceka) return;
    if (k === "Enter") { const p = vstup.value; vstup.value = ""; proved(p); }
    else if (k === "Tab") doplnit();
    else if (k === "ArrowUp" || k === "↑") { if (pozice > 0) vstup.value = historie()[--pozice]; }
    else if (k === "ArrowDown") { pozice = Math.min(historie().length, pozice + 1); vstup.value = historie()[pozice] || ""; }
    else if (k === "Ctrl+C") {
      const z = document.createElement("div");
      z.className = "ter-text";
      z.innerHTML = vyzvaHtml() + esc(vstup.value) + "^C";
      tm.insertBefore(z, radek);
      vstup.value = "";
    }
    else if (k === "Ctrl+L") vymazat();
    else return false;
    return true;
  }
  vstup.onkeydown = (e) => {
    const k = e.ctrlKey && (e.key === "c" || e.key === "C") ? "Ctrl+C" : e.ctrlKey && (e.key === "l" || e.key === "L") ? "Ctrl+L" : e.key;
    if (klavesa(k)) e.preventDefault();
    obnovVyzvu();
  };
  /* rychla tlacitka pro dotyk (na telefonu chybi Tab a sipky) */
  c.querySelectorAll("[data-klavesa]").forEach((b) => b.onclick = () => {
    const k = b.dataset.klavesa;
    if (!klavesa(k)) { vstup.value = k; klavesa("Enter"); }
    vstup.focus();
  });
  tm.onclick = () => vstup.focus();

  /* uvodni radek az podle toho, jestli sluzba skutecny shell opravdu ma */
  const uvod = () => {
    pis("LinsoftPhone OS " + VERZE_OS + " — " + t(skutecny ? "ter_telefon" : "ter_vstavany") + "\n" +
      (skutecny ? "" : t("ter_napoveda") + "\n"), "ter-nadpis");
    obnovVyzvu();
  };
  if (skutecny) Nativ.api("terminal", { prikaz: "true", cwd: "" }).then((r) => { nativ = r; uvod(); },
    () => { skutecny = false; uvod(); });
  else uvod();
  obnovVyzvu();
}
