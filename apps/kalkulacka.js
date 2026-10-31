"use strict";

/* Kalkulacka: kulata tlacitka, prubezny vysledek pri psani, procenta */
function appKalk(c) {
  c.innerHTML = `
    <div class="kalk">
      <div class="kalk-displej">
        <div class="kalk-vyraz" id="kalk-vyraz" aria-live="polite">0</div>
        <div class="kalk-vysledek" id="kalk-vysledek"></div>
      </div>
      <div class="kalk-mriezka" id="kalk-mriezka"></div>
    </div>`;
  const TLACITKA = ["C", "(", ")", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "%", "0", ",", "="];
  const OPERATORY = "÷×−+=";
  let v = "";
  /* procenta jako na telefonu: "12+5%" = 12 + 5 % z 12; jinak "50%" = 0,5 */
  const vypocet = (x) => {
    const m = x.match(/^(.+)([+−])(\d+(?:,\d+)?)%$/);
    if (m) {
      const zaklad = Core.spocitej(m[1]);
      const podil = zaklad * Core.spocitej(m[3]) / 100;
      return Core.spocitej(String(zaklad) + (m[2] === "+" ? "+" : "-") + String(podil));
    }
    return Core.spocitej(x.replace(/(\d+(?:,\d+)?)%/g, "($1÷100)"));
  };
  const cislo = (n) => String(n).replace(".", ",");

  const kresli = () => {
    $("#kalk-vyraz").textContent = v || "0";
    let prubezne = "";
    if (/[÷×−+%]/.test(v)) { try { prubezne = "= " + cislo(vypocet(v)); } catch (e) { prubezne = ""; } }
    $("#kalk-vysledek").textContent = prubezne;
  };
  TLACITKA.forEach((x) => {
    const b = document.createElement("button");
    b.textContent = x;
    b.className = "kalk-k" + (OPERATORY.indexOf(x) >= 0 ? " op" : "C()%".indexOf(x) >= 0 ? " fn" : "");
    b.onclick = () => {
      if (x === "C") v = "";
      else if (x === "=") {
        try { v = cislo(vypocet(v)); } catch (e) { v = t("chyba"); }
        $("#kalk-vysledek").textContent = "";
        $("#kalk-vyraz").textContent = v;
        return;
      }
      else v = (v === t("chyba") ? "" : v) + x;
      kresli();
    };
    $("#kalk-mriezka").appendChild(b);
  });
  /* mazani jednoho znaku klepnutim na displej (jako na telefonu) */
  $("#kalk-vyraz").onclick = () => { v = v.slice(0, -1); kresli(); };
  kresli();
}
