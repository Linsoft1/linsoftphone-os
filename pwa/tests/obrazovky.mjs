/* Test obrazovek LinsoftPhone OS v opravdovem prohlizeci (Chrome / Edge, headless).
 * Spusti PWA na mistnim serveru, odemkne telefon, otevre kazdou aplikaci v cestine,
 * slovencine i anglictine, na malem i velkem displeji, a selze pri jakekoli chybe
 * JavaScriptu. Snimky uklada do pwa/tests/snimky/.
 * Spusteni: npm run test:obrazovky  (PROHLIZEC=cesta k chrome/msedge, jinak se hleda sam) */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, extname, dirname, delimiter } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const PWA = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNIMKY = join(PWA, "tests", "snimky");
const APLIKACE = ["telefon", "zpravy", "kontakty", "kalk", "hodiny", "kalendar", "poznamky", "fotak",
  "galerie", "prehliadac", "terminal", "nastaveni"];
const DISPLEJE = [{ w: 360, h: 720 }, { w: 320, h: 568 }];
const JAZYKY = ["sk", "cs", "en"];

const PROHLIZECE = [process.env.PROHLIZEC, "google-chrome", "chromium", "chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
/* holy nazev hledat v PATH, cestu primo */
const vPath = (n) => (process.env.PATH || "").split(delimiter).some((d) => existsSync(join(d, n)) || existsSync(join(d, n + ".exe")));
const najdi = () => PROHLIZECE.find((p) => p.includes("/") ? existsSync(p) : vPath(p));
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- mistni server s PWA ---- */
const TYPY = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let cesta = decodeURIComponent(req.url.split("?")[0]);
  if (cesta.endsWith("/")) cesta += "index.html";
  const soubor = join(PWA, cesta);
  if (!soubor.startsWith(PWA) || !existsSync(soubor)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPY[extname(soubor)] || "application/octet-stream" });
  res.end(readFileSync(soubor));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ADRESA = `http://127.0.0.1:${server.address().port}/`;

/* ---- prohlizec pres DevTools protokol ---- */
const prohlizec = najdi();
if (!prohlizec) { console.log("Prohlizec (Chrome/Edge) nenalezen - test preskocen."); server.close(); process.exit(0); }
const profil = join(tmpdir(), "linsoftos-test-" + process.pid);
const port = 9400 + (process.pid % 500);
const proces = spawn(prohlizec, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-sandbox",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream", "about:blank"], { stdio: "ignore" });

let cil;
for (let i = 0; i < 75 && !cil; i++) {
  await pauza(200);
  try { cil = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === "page"); } catch (e) { /* jeste nebezi */ }
}
if (!cil) { console.error("Prohlizec se nespustil."); proces.kill(); server.close(); process.exit(1); }
const ws = new WebSocket(cil.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const cekajici = new Map(), chyby = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && cekajici.has(m.id)) { cekajici.get(m.id)(m); cekajici.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") chyby.push(m.params.exceptionDetails.exception
    ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    chyby.push("console.error: " + m.params.args.map((a) => a.value || a.description).join(" "));
});
const cmd = (method, params = {}) => new Promise((r) => { const i = ++id; cekajici.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => {
  const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 60) + ": " + r.result.exceptionDetails.exception.description);
  return r.result.result.value;
};
await cmd("Runtime.enable");
await cmd("Page.enable");

/* ---- prubeh testu ---- */
rmSync(SNIMKY, { recursive: true, force: true });
mkdirSync(SNIMKY, { recursive: true });
let selhani = 0, kroku = 0;
const over = (popis) => {
  kroku++;
  if (chyby.length) { selhani++; console.log("✖ " + popis + "\n    " + chyby.join("\n    ")); chyby.length = 0; }
};
const snimek = async (nazev) => {
  const s = await cmd("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SNIMKY, nazev + ".png"), Buffer.from(s.result.data, "base64"));
};

for (const d of DISPLEJE) {
  await cmd("Emulation.setDeviceMetricsOverride", { width: d.w, height: d.h, deviceScaleFactor: 1, mobile: true });
  for (const jazyk of JAZYKY) {
    await cmd("Page.navigate", { url: ADRESA });
    await pauza(800);
    await js(`localStorage.clear(); localStorage.setItem("lp_jazyk", JSON.stringify("${jazyk}")); location.reload()`).catch(() => {});
    await pauza(2200);
    over(`${d.w}x${d.h} ${jazyk}: start`);
    await js(`document.querySelector("#lockscreen").click()`);
    await pauza(600);
    const plocha = await js(`[document.querySelectorAll("#appgrid .appicon").length, document.querySelectorAll("#dock .appicon").length]`);
    if (plocha[0] !== APLIKACE.length || plocha[1] !== 4) { selhani++; console.log(`✖ ${d.w}x${d.h} ${jazyk}: plocha ma ${plocha}`); }
    if (jazyk === "sk") await snimek(`${d.w}x${d.h}-plocha`);
    over(`${d.w}x${d.h} ${jazyk}: odemknuti`);
    for (const app of APLIKACE) {
      await js(`otevri("${app}")`);
      await pauza(app === "fotak" ? 900 : 250);
      over(`${d.w}x${d.h} ${jazyk}: ${app}`);
      if (jazyk === "sk") await snimek(`${d.w}x${d.h}-${app}`);
      await js(`document.querySelector("#nav-home").click()`);
      await pauza(150);
    }
    /* systemove obrazovky */
    for (const [popis, kod] of [["hledani", `document.querySelector("#hledat-plocha").click()`],
      ["panel", `document.querySelector("#statusbar").click()`], ["nedavne", `document.querySelector("#nav-recent").click()`]]) {
      await js(`domu()`);
      await js(kod);
      await pauza(300);
      over(`${d.w}x${d.h} ${jazyk}: ${popis}`);
      if (jazyk === "sk") await snimek(`${d.w}x${d.h}-${popis}`);
    }
  }
}

ws.close();
proces.kill();
server.close();
setTimeout(() => rmSync(profil, { recursive: true, force: true }), 500);
console.log(`${kroku} kroku, ${selhani} selhani, snimky v ${SNIMKY}`);
process.exitCode = selhani ? 1 : 0;
