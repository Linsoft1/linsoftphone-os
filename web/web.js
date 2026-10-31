/* LinsoftPhone OS - webova stranka: mobilne menu, karty instalacie, objavenie sekcii, rok v pate */
"use strict";
(function () {
  const $ = (s) => document.querySelector(s);

  /* mobilne menu */
  const tl = $("#menu-tl"), menu = $("#menu");
  tl.onclick = () => {
    const otvorene = menu.classList.toggle("otvorene");
    tl.setAttribute("aria-expanded", String(otvorene));
  };
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    menu.classList.remove("otvorene");
    tl.setAttribute("aria-expanded", "false");
  }));

  /* karty postupu instalacie */
  document.querySelectorAll("[data-karta]").forEach((b) => b.onclick = () => {
    document.querySelectorAll("[data-karta]").forEach((x) => {
      x.classList.toggle("on", x === b);
      x.setAttribute("aria-selected", String(x === b));
    });
    document.querySelectorAll("[data-postup]").forEach((p) => { p.hidden = p.dataset.postup !== b.dataset.karta; });
  });

  /* sekcie sa jemne objavia pri posuvani */
  const prvky = document.querySelectorAll(".karta, .podoba, .verzia, .postup, .vyzva");
  if ("IntersectionObserver" in window) {
    const pozorovatel = new IntersectionObserver((zaznamy) => zaznamy.forEach((z) => {
      if (z.isIntersecting) { z.target.classList.add("videt"); pozorovatel.unobserve(z.target); }
    }), { rootMargin: "0px 0px -40px 0px" });
    prvky.forEach((p) => { p.classList.add("zobraz"); pozorovatel.observe(p); });
  }

  $("#rok").textContent = new Date().getFullYear();

  /* stara verzia mala LinsoftPhone OS priamo v koreni stranky: jej service worker uz nepotrebujeme */
  if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then((r) => r.forEach((reg) => {
      if (new URL(reg.scope).pathname === location.pathname.replace(/index\.html$/, "")) reg.unregister();
    })).catch(() => {});
  }
})();
