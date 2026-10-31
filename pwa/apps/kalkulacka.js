"use strict";

/* Kalkulacka */
function appKalk(c) {
  c.innerHTML = `<div id="calc-disp" aria-live="polite">0</div><div id="calc-grid"></div>`;
  const d = $("#calc-disp");
  let v = "";
  const tl = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ",", "⌫", "="];
  tl.forEach((x) => {
    const b = document.createElement("button");
    b.textContent = x;
    if ("÷×−+=C⌫".includes(x)) b.className = "op";
    b.onclick = () => {
      if (x === "C") v = "";
      else if (x === "⌫") v = v.slice(0, -1);
      else if (x === "=") {
        try { v = String(Core.spocitej(v)).replace(".", ","); } catch (e) { v = t("chyba"); }
      }
      else v = (v === t("chyba") ? "" : v) + x;
      d.textContent = v || "0";
    };
    $("#calc-grid").appendChild(b);
  });
}
