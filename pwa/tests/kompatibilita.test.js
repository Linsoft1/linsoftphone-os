/* hlida, aby PWA bezela i na starsich telefonech a aby nechybel zadny preklad */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../core.js");

const PWA = path.join(__dirname, "..");
const cti = (f) => fs.readFileSync(path.join(PWA, f), "utf8");
const bezKomentaru = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

for (const f of ["core.js", "app.js", "sw.js"]) {
  test(f + ": platna syntaxe", () => { new vm.Script(cti(f), { filename: f }); });

  test(f + ": bez syntaxe, kterou starsi Android/iOS neumi", () => {
    const kod = bezKomentaru(cti(f));
    assert.doesNotMatch(kod, /\?\?/, "?? (Chrome 80+, iOS 13.4+)");
    assert.doesNotMatch(kod, /\?\.(?!\d)/, "?. (Chrome 80+, iOS 13.4+)");
    assert.doesNotMatch(kod, /catch\s*\{/, "catch bez parametru (Chrome 66+, iOS 11.3+)");
    assert.doesNotMatch(kod, /\.flat(Map)?\(|Object\.fromEntries|\.at\(|replaceAll\(/, "ES2019+ metody");
  });
}

test("kazdy text v app.js a index.html ma preklad ve vsech jazycich", () => {
  const klice = new Set();
  const app = cti("app.js");
  for (const m of app.matchAll(/\bt\("([a-z0-9_]+)"[),]/g)) klice.add(m[1]);
  /* dynamicke klice: t("app_" + id), t("hd_" + karta) */
  for (const m of app.matchAll(/\{ id: "([a-z]+)"/g)) klice.add("app_" + m[1]);
  for (const k of ["hodiny", "budik", "minutka", "stopky"]) klice.add("hd_" + k);
  for (const m of app.matchAll(/t\(\w+ \? "([a-z0-9_]+)" : "([a-z0-9_]+)"\)/g)) { klice.add(m[1]); klice.add(m[2]); }
  for (const m of cti("index.html").matchAll(/data-i18n(?:-label)?="([a-z0-9_]+)"/g)) klice.add(m[1]);
  assert.ok(klice.size > 40, "nalezeno klicu: " + klice.size);
  for (const j of Object.keys(Core.TEXTY))
    for (const k of klice) assert.ok(k in Core.TEXTY[j], `chybi preklad "${k}" v jazyce ${j}`);
});

test("service worker cachuje vsechny soubory aplikace", () => {
  const sw = cti("sw.js");
  for (const f of ["index.html", "app.css", "core.js", "app.js", "manifest.webmanifest"])
    assert.ok(sw.includes(`"${f}"`), "sw.js necachuje " + f);
  for (const m of sw.matchAll(/"(icons\/[^"]+)"/g))
    assert.ok(fs.existsSync(path.join(PWA, m[1])), "chybi soubor " + m[1]);
});

test("manifest: ikony existuji, vcetne maskovatelne", () => {
  const m = JSON.parse(cti("manifest.webmanifest"));
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(PWA, i.src)), "chybi " + i.src);
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  assert.ok(fs.existsSync(path.join(PWA, "icons/apple-touch-icon.png")));
});
