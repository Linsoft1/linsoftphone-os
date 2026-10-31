/* Zostavi web na GitHub Pages do _site/: stranka projektu (web/) v koreni
 * a LinsoftPhone OS (pwa/ bez testov) v app/. Spustenie: node web/zostav.mjs */
import { cpSync, rmSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIL = join(KOREN, "_site");

/* vyprazdnit obsah (samotny priecinok moze mat otvoreny lokalny server) */
if (existsSync(CIL)) for (const f of readdirSync(CIL)) rmSync(join(CIL, f), { recursive: true, force: true });
else mkdirSync(CIL);
for (const f of readdirSync(join(KOREN, "web"))) {
  if (f === "zostav.mjs") continue;
  cpSync(join(KOREN, "web", f), join(CIL, f), { recursive: true });
}
cpSync(join(KOREN, "pwa"), join(CIL, "app"), {
  recursive: true,
  filter: (zdroj) => !/[\\/]pwa[\\/]tests([\\/]|$)/.test(zdroj) && !/serve\.ps1$/.test(zdroj)
});
console.log("Web zostaveny v " + CIL);
