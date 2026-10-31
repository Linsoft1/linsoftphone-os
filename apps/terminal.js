"use strict";

/* Terminal - stejne prikazy jako kernel verze; historie sipkou nahoru, rychle prikazy pro dotyk */
function appTerminal(c) {
  c.innerHTML = `
    <div class="ter">
      <div class="ter-okno">
        <div class="ter-lista"><i></i><i></i><i></i><span>linsoft@phone: ~</span></div>
        <div id="term" class="ter-vystup" role="log"></div>
        <div class="ter-radek"><span class="ter-prompt">linsoft&gt;</span>
          <input id="term-in" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="linsoft&gt;"></div>
      </div>
      <div class="chips ter-rychle">${["pomoc", "info", "datum", "cas", "kalk 6*7", "vymaz"].map((p) =>
        `<button class="btn ghost sm" data-prikaz="${p}">${p}</button>`).join("")}</div>
    </div>`;
  const tm = $("#term"), vstup = $("#term-in");
  const start = Date.now();
  const historie = [];
  let pozice = 0;
  const w = (s, trida) => {
    const r = document.createElement("div");
    if (trida) r.className = trida;
    r.textContent = s;
    tm.appendChild(r);
    tm.scrollTop = tm.scrollHeight;
  };
  w("=== LinsoftPhone OS " + VERZE_OS + " (PWA) ===", "ter-nadpis");
  w("Napis 'pomoc' pro seznam prikazu.");

  function proved(cmd) {
    w("linsoft> " + cmd, "ter-zadani");
    if (cmd) { historie.push(cmd); pozice = historie.length; }
    if (cmd === "pomoc") w("pomoc, info, cas, datum, kalk <vyraz>, vymaz");
    else if (cmd === "info") w(`Verze: ${VERZE_OS} PWA\nPlatforma: ${Core.platforma(navigator.userAgent)}\nJazyk: ${navigator.language}\nOnline: ${navigator.onLine ? "ano" : "ne"}`);
    else if (cmd === "cas") w("Doba behu: " + Core.trvani((Date.now() - start) / 1000));
    else if (cmd === "datum") w(new Date().toLocaleString(stav.jazyk));
    else if (cmd === "vymaz") tm.textContent = "";
    else if (cmd.indexOf("kalk ") === 0) {
      try { w("= " + Core.spocitej(cmd.slice(5)), "ter-ok"); } catch (err) { w("Chyba: neplatny vyraz.", "ter-chyba"); }
    }
    else if (cmd) w("Neznamy prikaz: '" + cmd + "'. Napis 'pomoc'.", "ter-chyba");
  }
  vstup.onkeydown = (e) => {
    if (e.key === "Enter") { const cmd = vstup.value.trim(); vstup.value = ""; proved(cmd); }
    else if (e.key === "ArrowUp" && pozice > 0) { vstup.value = historie[--pozice]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { pozice = Math.min(historie.length, pozice + 1); vstup.value = historie[pozice] || ""; }
  };
  c.querySelectorAll("[data-prikaz]").forEach((b) => b.onclick = () => proved(b.dataset.prikaz));
}
