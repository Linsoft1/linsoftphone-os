"use strict";

/* Poznamky */
function appPoznamky(c) {
  c.innerHTML = `
    <textarea id="pz" rows="14" placeholder="${esc(t("pz_ph"))}" aria-label="${esc(t("app_poznamky"))}">${esc(store.get("poznamky", ""))}</textarea>
    <p class="muted small">${esc(t("pz_ulozeno"))}</p>`;
  $("#pz").oninput = () => store.set("poznamky", $("#pz").value);
}
