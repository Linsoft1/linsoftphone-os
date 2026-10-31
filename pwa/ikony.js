/* LinsoftPhone OS - vlastni sada ikon (SVG 24x24, zaoblene cary 2 px).
 * Stejny styl jako logo; nezavisle na emoji, ktere vypadaji na kazdem telefonu jinak. */
(function (glob) {
"use strict";

const IKONY = {
  /* aplikace */
  telefon: '<path fill="currentColor" stroke="none" d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  zpravy: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 9h8M8 12.5h5"/>',
  kontakty: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  kalk: '<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M8.5 7h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 19h.01M12 19h.01M15.5 19h.01" stroke-width="2.6"/>',
  hodiny: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M5 3 2.5 5.5M19 3l2.5 2.5"/>',
  kalendar: '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" stroke-width="2.6"/>',
  poznamky: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  fotak: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  galerie: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="15.5" cy="9" r="1.6"/><path d="m3.5 17 5-5.5 4 4 2.5-2.5 5.5 5"/>',
  terminal: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m6.5 9.5 3 2.5-3 2.5M12 15h5"/>',
  nastaveni: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/><circle cx="12" cy="12" r="6.5"/>',
  /* system */
  zpet: '<path d="m15 5-7 7 7 7"/>',
  domu: '<circle cx="12" cy="12" r="7"/>',
  nedavne: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  svitilna: '<path d="M8 2h8v4l-2 4v11h-4V10L8 6z"/><path d="M12 13v2"/>',
  motiv: '<circle cx="12" cy="12" r="8.5"/><path fill="currentColor" stroke="none" d="M12 3.5a8.5 8.5 0 0 0 0 17z"/>',
  cela: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  zamek: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  budik: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 1.5"/>',
  udalost: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a4.8 4.8 0 0 1 6.4 0"/><circle cx="12" cy="19.3" r=".9" fill="currentColor"/>',
  nahoru: '<path d="m6 15 6-6 6 6"/>',
  /* nastaveni */
  sipka: '<path d="m9 6 6 6-6 6"/>',
  jazyk: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  zvonek: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
  stahnout: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  nahrat: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  slunce: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  napajeni: '<path d="M12 3v8"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
  restart: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  kos: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  stit: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  /* kontakty */
  hledat: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upravit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'
};

function ikona(nazev, trida) {
  return '<svg class="ik' + (trida ? " " + trida : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IKONY[nazev] || "") + "</svg>";
}

/* sila signalu 0-4 jako ctyri stoupajici sloupce */
function signal(sila) {
  let s = "";
  for (let i = 0; i < 4; i++) {
    const v = 4 + i * 3;
    s += '<rect x="' + (2 + i * 5.5) + '" y="' + (20 - v) + '" width="3.6" height="' + v + '" rx="1" ' +
      'fill="currentColor" opacity="' + (i < sila ? 1 : 0.3) + '"/>';
  }
  return '<svg class="ik sb" viewBox="0 0 24 24" aria-hidden="true">' + s + "</svg>";
}

/* baterie s naplni podle urovne; pod 20 % cervena, pri nabijeni blesk */
function baterie(uroven, nabiji) {
  const w = Math.max(1.5, Math.round(15 * uroven / 100 * 10) / 10);
  const barva = nabiji ? "#4ade80" : uroven <= 20 ? "#f87171" : "currentColor";
  return '<svg class="ik sb bat" viewBox="0 0 28 24" aria-hidden="true">' +
    '<rect x="1.5" y="6" width="21" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/>' +
    '<rect x="24" y="10" width="2.2" height="4" rx="1" fill="currentColor" opacity=".6"/>' +
    '<rect x="4" y="8.5" width="' + w + '" height="7" rx="1.6" fill="' + barva + '"/>' +
    (nabiji ? '<path d="M12.5 7 9 12.5h3.2L11 17l4-6h-3.2z" fill="#fff" stroke="#0b1220" stroke-width=".6"/>' : "") +
    "</svg>";
}

glob.Ikony = { IKONY, ikona, signal, baterie };
})(this);
