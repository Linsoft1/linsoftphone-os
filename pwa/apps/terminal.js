"use strict";

/* Terminal - stejne prikazy jako kernel verze */
function appTerminal(c) {
  c.innerHTML = `<div id="term" role="log"></div><input id="term-in" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="napis prikaz… (pomoc)" aria-label="linsoft>">`;
  const tm = $("#term");
  const start = Date.now();
  const w = (s) => { tm.textContent += s + "\n"; tm.scrollTop = tm.scrollHeight; };
  w("=== LinsoftPhone OS " + VERZE_OS + " (PWA) ===");
  w("Napis 'pomoc' pro seznam prikazu.\n");
  $("#term-in").onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const cmd = $("#term-in").value.trim();
    $("#term-in").value = "";
    w("linsoft> " + cmd);
    if (cmd === "pomoc") w("pomoc, info, cas, datum, kalk <vyraz>, vymaz");
    else if (cmd === "info") w(`Verze: ${VERZE_OS} PWA\nPlatforma: ${navigator.platform}\nJazyk: ${navigator.language}\nOnline: ${navigator.onLine ? "ano" : "ne"}`);
    else if (cmd === "cas") w("Doba behu: " + Math.round((Date.now() - start) / 1000) + " s");
    else if (cmd === "datum") w(new Date().toLocaleString(stav.jazyk));
    else if (cmd === "vymaz") tm.textContent = "";
    else if (cmd.indexOf("kalk ") === 0) {
      try { w("= " + Core.spocitej(cmd.slice(5))); } catch (err) { w("Chyba: neplatny vyraz."); }
    }
    else if (cmd) w("Neznamy prikaz: '" + cmd + "'. Napis 'pomoc'.");
  };
}
