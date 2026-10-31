/* LinsoftPhone OS - linuxovy shell pro Terminal v prohlizeci (bez skutecneho Linuxu).
 * Vlastni souborovy system ulozeny v telefonu, prikazy a hlasky jako v bashi,
 * roury |, presmerovani > >>, ; a &&, promenne $VAR, doplnovani Tabem.
 * Na telefonu s LinsoftPhone OS (postmarketOS) Terminal pouziva skutecny shell. Cista logika bez DOM. */
(function (glob) {
"use strict";

const UZIVATEL = "user", HOST = "linsoftphone", HOME = "/home/user";
const MESICE = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* uzly: adresar { t: "d", c: { jmeno: uzel }, m }, soubor { t: "f", d: "obsah", m } */
const adr = (c) => ({ t: "d", c: c || {}, m: Date.now() });
const sou = (d) => ({ t: "f", d: d || "", m: Date.now() });

function novyFs(verze) {
  return adr({
    bin: adr(), tmp: adr(), usr: adr({ bin: adr(), share: adr() }), var: adr({ log: adr() }),
    etc: adr({
      hostname: sou(HOST + "\n"),
      "os-release": sou('NAME="LinsoftPhone OS"\nVERSION="' + verze + '"\nID=linsoftphone\nPRETTY_NAME="LinsoftPhone OS ' + verze + '"\n')
    }),
    home: adr({
      user: adr({
        "README.txt": sou("Vitaj v LinsoftPhone OS!\nNapis 'help' pre zoznam prikazov.\n"),
        Dokumenty: adr(), Stiahnute: adr(), Obrazky: adr()
      })
    })
  });
}

const PRIKAZY = ["cat", "cd", "clear", "cp", "date", "df", "echo", "env", "exit", "export", "free", "grep", "head",
  "help", "history", "hostname", "kalk", "ls", "man", "mkdir", "mv", "neofetch", "ps", "pwd", "rm", "rmdir",
  "sudo", "tail", "touch", "uname", "uptime", "wc", "which", "whoami"];

class Shell {
  constructor(ulozeno, verze) {
    const u = ulozeno || {};
    this.verze = verze || "2.4";
    this.fs = u.fs || novyFs(this.verze);
    this.cwd = u.cwd || HOME;
    this.historie = u.historie || [];
    this.env = Object.assign({ HOME, USER: UZIVATEL, SHELL: "/bin/lsh", PATH: "/usr/bin:/bin", LANG: "sk_SK.UTF-8" }, u.env || {});
    this.start = Date.now();
    this.spocitej = null; /* kalkulacka z core.js (nepovinne) */
  }
  ulozit() { return { fs: this.fs, cwd: this.cwd, historie: this.historie.slice(-200), env: this.env }; }

  /* ---- vyzva: user@linsoftphone:~$ ---- */
  vyzva() { return { uzivatel: UZIVATEL, host: HOST, cesta: this.zkratit(this.cwd) }; }
  zkratit(p) { return p === HOME ? "~" : p.indexOf(HOME + "/") === 0 ? "~" + p.slice(HOME.length) : p; }

  /* ---- cesty ---- */
  cesta(p) {
    p = String(p || "");
    if (p === "~" || p.indexOf("~/") === 0) p = HOME + p.slice(1);
    const casti = (p[0] === "/" ? p : this.cwd + "/" + p).split("/");
    const vysledek = [];
    casti.forEach((x) => { if (!x || x === ".") return; if (x === "..") vysledek.pop(); else vysledek.push(x); });
    return "/" + vysledek.join("/");
  }
  uzel(abs) {
    let u = this.fs;
    const casti = abs.split("/").filter(Boolean);
    for (let i = 0; i < casti.length; i++) {
      if (!u || u.t !== "d") return null;
      u = u.c[casti[i]];
    }
    return u || null;
  }
  rodic(abs) {
    const i = abs.lastIndexOf("/");
    return { adr: this.uzel(abs.slice(0, i) || "/"), jmeno: abs.slice(i + 1) };
  }

  /* ---- rozklad radku: slova v uvozovkach, $PROMENNE, operatory | > >> ; && ---- */
  rozloz(radek) {
    const tokeny = [];
    let i = 0, slovo = null;
    const pridej = () => { if (slovo !== null) { tokeny.push({ s: slovo }); slovo = null; } };
    const promenna = (s, j) => {
      const m = s.slice(j).match(/^\$(\{(\w+)\}|(\w+)|\?)/);
      if (!m) return null;
      const jmeno = m[2] || m[3] || "?";
      return { hodnota: jmeno === "?" ? String(this.posledniKod || 0) : (this.env[jmeno] || ""), delka: m[0].length };
    };
    while (i < radek.length) {
      const ch = radek[i];
      if (ch === " " || ch === "\t") { pridej(); i++; continue; }
      if (ch === "|" || ch === ";") { pridej(); tokeny.push({ op: ch }); i++; continue; }
      if (ch === "&" && radek[i + 1] === "&") { pridej(); tokeny.push({ op: "&&" }); i += 2; continue; }
      if (ch === ">") { pridej(); const dvojite = radek[i + 1] === ">"; tokeny.push({ op: dvojite ? ">>" : ">" }); i += dvojite ? 2 : 1; continue; }
      if (ch === "'") {
        const k = radek.indexOf("'", i + 1);
        if (k < 0) throw new Error("unexpected EOF while looking for matching `''");
        slovo = (slovo || "") + radek.slice(i + 1, k); i = k + 1; continue;
      }
      if (ch === '"') {
        let k = i + 1, s = "";
        while (k < radek.length && radek[k] !== '"') {
          if (radek[k] === "\\" && k + 1 < radek.length) { s += radek[k + 1]; k += 2; continue; }
          const p = radek[k] === "$" ? promenna(radek, k) : null;
          if (p) { s += p.hodnota; k += p.delka; } else s += radek[k++];
        }
        if (k >= radek.length) throw new Error("unexpected EOF while looking for matching `\"'");
        slovo = (slovo || "") + s; i = k + 1; continue;
      }
      if (ch === "\\" && i + 1 < radek.length) { slovo = (slovo || "") + radek[i + 1]; i += 2; continue; }
      if (ch === "$") { const p = promenna(radek, i); if (p) { slovo = (slovo || "") + p.hodnota; i += p.delka; continue; } }
      if (ch === "~" && slovo === null && (radek[i + 1] === undefined || radek[i + 1] === "/" || radek[i + 1] === " ")) {
        slovo = HOME; i++; continue;
      }
      slovo = (slovo || "") + ch; i++;
    }
    pridej();
    return tokeny;
  }

  /* radek -> useky oddelene ; a && (mimo uvozovky); kazdy usek se rozlozi az tesne pred
   * spustenim, aby "export X=1; echo $X" videl novou hodnotu jako v bashi */
  useky(radek) {
    const vysledek = [];
    let zac = 0, uvoz = null, predchozi = ";";
    for (let i = 0; i < radek.length; i++) {
      const ch = radek[i];
      if (uvoz) { if (ch === "\\" && uvoz === '"') i++; else if (ch === uvoz) uvoz = null; continue; }
      if (ch === "'" || ch === '"') { uvoz = ch; continue; }
      if (ch === "\\") { i++; continue; }
      const op = ch === ";" ? ";" : ch === "&" && radek[i + 1] === "&" ? "&&" : null;
      if (!op) continue;
      vysledek.push({ text: radek.slice(zac, i), po: predchozi });
      predchozi = op;
      if (op === "&&") i++;
      zac = i + 1;
    }
    vysledek.push({ text: radek.slice(zac), po: predchozi });
    return vysledek;
  }

  /* ---- spusteni radku: vraci { vystup, vymazat } ---- */
  spust(radek) {
    radek = String(radek || "");
    if (radek.trim()) this.historie.push(radek);
    let vystup = "", vymazat = false, preskocit = false;
    const useky = this.useky(radek);
    for (let i = 0; i < useky.length; i++) {
      const u = useky[i];
      if (u.po === ";") preskocit = false;
      else preskocit = preskocit || this.posledniKod !== 0;   /* && po neuspechu */
      if (preskocit || !u.text.trim()) continue;
      let tokeny;
      try { tokeny = this.rozloz(u.text); } catch (e) { vystup += "lsh: " + e.message + "\n"; this.posledniKod = 2; continue; }
      const r = this.kolona(tokeny);
      vystup += r.out;
      if (r.vymazat) { vymazat = true; vystup = ""; }
    }
    return { vystup, vymazat };
  }

  /* jedna kolona: prikaz | prikaz > soubor */
  kolona(tokeny) {
    const prikazy = [[]];
    let presmerovani = null;
    for (let i = 0; i < tokeny.length; i++) {
      const tk = tokeny[i];
      if (tk.op === "|") prikazy.push([]);
      else if (tk.op === ">" || tk.op === ">>") {
        const cil = tokeny[i + 1];
        if (!cil || cil.op) return this.konec(2, "lsh: syntax error near unexpected token `newline'\n");
        presmerovani = { pripojit: tk.op === ">>", cesta: cil.s };
        i++;
      } else prikazy[prikazy.length - 1].push(tk.s);
    }
    let vstup = null, r = { out: "", kod: 0 };
    let chyby = "";
    for (let i = 0; i < prikazy.length; i++) {
      if (!prikazy[i].length) return this.konec(2, "lsh: syntax error near unexpected token `|'\n");
      /* vystup jde do roury nebo souboru (ne na obrazovku) - ls pak pise jednu polozku na radek */
      this.doRoury = i < prikazy.length - 1 || !!presmerovani;
      r = this.prikaz(prikazy[i][0], prikazy[i].slice(1), vstup);
      chyby += r.err || "";
      vstup = r.out;
      if (r.vymazat) return { out: "", vymazat: true };
    }
    this.posledniKod = r.kod || 0;
    if (presmerovani) {
      const chyba = this.zapis(presmerovani.cesta, r.out, presmerovani.pripojit);
      return { out: chyby + (chyba || "") };
    }
    return { out: chyby + r.out };
  }
  konec(kod, err) { this.posledniKod = kod; return { out: err }; }

  zapis(p, data, pripojit) {
    const abs = this.cesta(p), r = this.rodic(abs), u = this.uzel(abs);
    if (!r.adr || r.adr.t !== "d") return "lsh: " + p + ": No such file or directory\n";
    if (u && u.t === "d") return "lsh: " + p + ": Is a directory\n";
    if (u && pripojit) { u.d += data; u.m = Date.now(); }
    else r.adr.c[r.jmeno] = sou(data);
    return "";
  }

  /* ---- jednotlive prikazy: vraci { out, err, kod } ---- */
  prikaz(jmeno, argv, vstup) {
    const ok = (out) => ({ out: out || "", kod: 0 });
    const chyba = (err, kod) => ({ out: "", err, kod: kod || 1 });
    const prepinace = (a) => { const p = {}, z = []; a.forEach((x) => { if (/^-[a-zA-Z]+$/.test(x)) x.slice(1).split("").forEach((c) => { p[c] = true; }); else z.push(x); }); return { p, z }; };
    const cti = (p, prikaz) => {
      const u = this.uzel(this.cesta(p));
      if (!u) return { err: prikaz + ": " + p + ": No such file or directory\n" };
      if (u.t === "d") return { err: prikaz + ": " + p + ": Is a directory\n" };
      return { data: u.d };
    };
    /* vstup pro prikazy, ktere ctou soubory nebo rouru */
    const data = (soubory, prikaz) => {
      if (!soubory.length) return { data: vstup || "" };
      let d = "", e = "";
      soubory.forEach((s) => { const r = cti(s, prikaz); if (r.err) e += r.err; else d += r.data; });
      return { data: d, err: e };
    };
    const radky = (s) => { const r = s.split("\n"); if (r[r.length - 1] === "") r.pop(); return r; };
    const datum = (t) => { const d = new Date(t); return MESICE[d.getMonth()] + " " + String(d.getDate()).padStart(2) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

    switch (jmeno) {
      case "help": case "man":
        return ok("LinsoftPhone OS shell (lsh). Prikazy:\n  " + PRIKAZY.join("  ") +
          "\nOperatory: prikaz | prikaz, > subor, >> subor, ; , &&, $PREMENNA\nTab doplni prikaz alebo cestu, sipky listuju historiu.\n");
      case "pwd": return ok(this.cwd + "\n");
      case "whoami": return ok(UZIVATEL + "\n");
      case "hostname": return ok(HOST + "\n");
      case "clear": return { out: "", kod: 0, vymazat: true };
      case "exit": return ok("logout\n");
      case "uname": {
        const p = prepinace(argv).p;
        if (p.a) return ok("Linux " + HOST + " 6.12-linsoft #1 SMP LinsoftPhone OS " + this.verze + " aarch64 GNU/Linux\n");
        if (p.r) return ok("6.12-linsoft\n");
        if (p.m) return ok("aarch64\n");
        return ok("Linux\n");
      }
      case "date": return ok(new Date().toString() + "\n");
      case "uptime": {
        const m = Math.floor((Date.now() - this.start) / 60000);
        return ok(" " + new Date().toTimeString().slice(0, 8) + " up " + m + " min,  1 user,  load average: 0.08, 0.05, 0.01\n");
      }
      case "echo": {
        const n = argv[0] === "-n";
        return ok((n ? argv.slice(1) : argv).join(" ") + (n ? "" : "\n"));
      }
      case "env": return ok(Object.keys(this.env).map((k) => k + "=" + this.env[k]).join("\n") + "\n");
      case "export": {
        argv.forEach((a) => { const i = a.indexOf("="); if (i > 0) this.env[a.slice(0, i)] = a.slice(i + 1); });
        return ok();
      }
      case "history": return ok(this.historie.map((h, i) => String(i + 1).padStart(5) + "  " + h).join("\n") + "\n");
      case "which": return argv.length && PRIKAZY.indexOf(argv[0]) >= 0 ? ok("/bin/" + argv[0] + "\n") : { out: "", kod: 1 };
      case "sudo": return chyba("sudo: v LinsoftPhone OS v prehliadaci nie je root. Skutocny root shell je na telefone s postmarketOS.\n");
      case "ps": return ok("  PID TTY          TIME CMD\n    1 pts/0    00:00:00 lsh\n   " + (40 + this.historie.length) + " pts/0    00:00:00 ps\n");
      case "free": return ok("               total        used        free\nMem:         4038120     1265420     2772700\nSwap:              0           0           0\n");
      case "df": return ok("Filesystem     1K-blocks    Used Available Use% Mounted on\nlinsoftfs        5242880   " +
        String(JSON.stringify(this.fs).length >> 10).padStart(5) + "   5242000   1% /\n");
      case "kalk":
        if (!this.spocitej) return chyba("kalk: nie je k dispozicii\n");
        try { return ok("= " + this.spocitej(argv.join(" ")) + "\n"); } catch (e) { return chyba("kalk: neplatny vyraz\n"); }
      case "neofetch": return ok([
        "   ##            " + UZIVATEL + "@" + HOST,
        "   ##  .-.       ----------------",
        "   ## '   \\      OS: LinsoftPhone OS " + this.verze,
        "   ##  `.  |     Kernel: 6.12-linsoft",
        "   ########      Shell: lsh",
        "                 Uptime: " + Math.floor((Date.now() - this.start) / 60000) + " min", ""].join("\n"));

      case "cd": {
        const cil = argv[0] === "-" ? (this.env.OLDPWD || this.cwd) : this.cesta(argv[0] || HOME);
        const u = this.uzel(cil);
        if (!u) return chyba("lsh: cd: " + argv[0] + ": No such file or directory\n");
        if (u.t !== "d") return chyba("lsh: cd: " + argv[0] + ": Not a directory\n");
        this.env.OLDPWD = this.cwd;
        this.cwd = cil;
        return ok();
      }
      case "ls": {
        const a = prepinace(argv), cile = a.z.length ? a.z : ["."];
        let out = "", err = "";
        cile.forEach((p) => {
          const u = this.uzel(this.cesta(p));
          if (!u) { err += "ls: cannot access '" + p + "': No such file or directory\n"; return; }
          let polozky = u.t === "d" ? Object.keys(u.c).sort() : [p];
          if (u.t === "d" && !a.p.a) polozky = polozky.filter((x) => x[0] !== ".");
          if (u.t === "d" && a.p.a) polozky = [".", ".."].concat(polozky);
          if (cile.length > 1 && u.t === "d") out += p + ":\n";
          if (a.p.l) {
            out += (u.t === "d" ? "total " + polozky.length + "\n" : "") + polozky.map((x) => {
              const v = u.t === "d" ? (x === "." || x === ".." ? u : u.c[x]) : u;
              const vel = v.t === "d" ? 4096 : v.d.length;
              return (v.t === "d" ? "drwxr-xr-x" : "-rw-r--r--") + " 1 " + UZIVATEL + " " + UZIVATEL + " " +
                String(vel).padStart(6) + " " + datum(v.m) + " " + x + (v.t === "d" ? "/" : "");
            }).join("\n") + "\n";
          } else if (polozky.length && this.doRoury) out += polozky.join("\n") + "\n";
          else if (polozky.length) out += polozky.map((x) => u.t === "d" && x !== "." && x !== ".." && u.c[x].t === "d" ? x + "/" : x).join("  ") + "\n";
        });
        return { out, err, kod: err ? 2 : 0 };
      }
      case "cat": { const r = data(argv, "cat"); return { out: r.data, err: r.err, kod: r.err ? 1 : 0 }; }
      case "head": case "tail": {
        let n = 10;
        const z = [];
        for (let i = 0; i < argv.length; i++) {
          if (argv[i] === "-n") n = parseInt(argv[++i], 10) || 0;
          else if (/^-\d+$/.test(argv[i])) n = parseInt(argv[i].slice(1), 10);
          else z.push(argv[i]);
        }
        const r = data(z, jmeno), rr = radky(r.data);
        const vyber = jmeno === "head" ? rr.slice(0, n) : rr.slice(Math.max(0, rr.length - n));
        return { out: vyber.length ? vyber.join("\n") + "\n" : "", err: r.err, kod: r.err ? 1 : 0 };
      }
      case "wc": {
        const a = prepinace(argv), r = data(a.z, "wc"), d = r.data;
        const l = (d.match(/\n/g) || []).length, w = d.split(/\s+/).filter(Boolean).length, c = d.length;
        const hodnoty = a.p.l ? [l] : a.p.w ? [w] : a.p.c ? [c] : [l, w, c];
        return { out: hodnoty.map((x) => String(x).padStart(7)).join(" ") + (a.z.length === 1 ? " " + a.z[0] : "") + "\n", err: r.err };
      }
      case "grep": {
        const a = prepinace(argv);
        if (!a.z.length) return chyba("Usage: grep [-inv] PATTERN [FILE]...\n", 2);
        let vzor;
        try { vzor = new RegExp(a.z[0], a.p.i ? "i" : ""); } catch (e) { return chyba("grep: invalid pattern\n", 2); }
        const r = data(a.z.slice(1), "grep");
        const shody = radky(r.data).map((x, i) => ({ x, i })).filter((o) => vzor.test(o.x) !== !!a.p.v);
        return { out: shody.map((o) => (a.p.n ? (o.i + 1) + ":" : "") + o.x).join("\n") + (shody.length ? "\n" : ""), err: r.err, kod: shody.length ? 0 : 1 };
      }
      case "touch": {
        let err = "";
        argv.forEach((p) => {
          const abs = this.cesta(p), u = this.uzel(abs), r = this.rodic(abs);
          if (u) u.m = Date.now();
          else if (r.adr && r.adr.t === "d") r.adr.c[r.jmeno] = sou("");
          else err += "touch: cannot touch '" + p + "': No such file or directory\n";
        });
        return argv.length ? { out: "", err, kod: err ? 1 : 0 } : chyba("touch: missing file operand\n");
      }
      case "mkdir": {
        const a = prepinace(argv);
        if (!a.z.length) return chyba("mkdir: missing operand\n");
        let err = "";
        a.z.forEach((p) => {
          const abs = this.cesta(p);
          if (a.p.p) {
            let u = this.fs;
            abs.split("/").filter(Boolean).forEach((x) => {
              if (!u || u.t !== "d") return;
              if (!u.c[x]) u.c[x] = adr();
              u = u.c[x];
            });
            if (!u || u.t !== "d") err += "mkdir: cannot create directory '" + p + "': Not a directory\n";
            return;
          }
          const r = this.rodic(abs);
          if (this.uzel(abs)) err += "mkdir: cannot create directory '" + p + "': File exists\n";
          else if (!r.adr || r.adr.t !== "d") err += "mkdir: cannot create directory '" + p + "': No such file or directory\n";
          else r.adr.c[r.jmeno] = adr();
        });
        return { out: "", err, kod: err ? 1 : 0 };
      }
      case "rmdir": case "rm": {
        const a = prepinace(argv);
        if (!a.z.length) return chyba(jmeno + ": missing operand\n");
        let err = "";
        a.z.forEach((p) => {
          const abs = this.cesta(p), u = this.uzel(abs), r = this.rodic(abs);
          if (abs === "/" || abs === HOME) { err += jmeno + ": refusing to remove '" + p + "'\n"; return; }
          if (!u) { if (!a.p.f) err += jmeno + ": cannot remove '" + p + "': No such file or directory\n"; return; }
          if (u.t === "d" && jmeno === "rm" && !a.p.r) { err += "rm: cannot remove '" + p + "': Is a directory\n"; return; }
          if (u.t === "d" && jmeno === "rmdir" && Object.keys(u.c).length) { err += "rmdir: failed to remove '" + p + "': Directory not empty\n"; return; }
          if (u.t !== "d" && jmeno === "rmdir") { err += "rmdir: failed to remove '" + p + "': Not a directory\n"; return; }
          delete r.adr.c[r.jmeno];
          if (this.cwd === abs || this.cwd.indexOf(abs + "/") === 0) this.cwd = HOME;
        });
        return { out: "", err, kod: err ? 1 : 0 };
      }
      case "cp": case "mv": {
        const a = prepinace(argv);
        if (a.z.length < 2) return chyba(jmeno + ": missing destination file operand\n");
        const zdroj = this.cesta(a.z[0]), u = this.uzel(zdroj);
        if (!u) return chyba(jmeno + ": cannot stat '" + a.z[0] + "': No such file or directory\n");
        if (u.t === "d" && jmeno === "cp" && !a.p.r) return chyba("cp: -r not specified; omitting directory '" + a.z[0] + "'\n");
        let cil = this.cesta(a.z[1]);
        const cu = this.uzel(cil);
        if (cu && cu.t === "d") cil = cil + "/" + zdroj.slice(zdroj.lastIndexOf("/") + 1);
        if (cil === zdroj || cil.indexOf(zdroj + "/") === 0) return chyba(jmeno + ": cannot move '" + a.z[0] + "' into itself\n");
        const r = this.rodic(cil);
        if (!r.adr || r.adr.t !== "d") return chyba(jmeno + ": cannot create '" + a.z[1] + "': No such file or directory\n");
        r.adr.c[r.jmeno] = jmeno === "cp" ? JSON.parse(JSON.stringify(u)) : u;
        if (jmeno === "mv") { const z = this.rodic(zdroj); delete z.adr.c[z.jmeno]; }
        return ok();
      }
      default:
        return chyba("lsh: " + jmeno + ": command not found\n", 127);
    }
  }

  /* ---- doplnovani Tabem: { radek, moznosti } ---- */
  doplnit(radek) {
    const m = radek.match(/^(.*?)(\S*)$/);
    const zaklad = m[1], slovo = m[2];
    const prvni = !zaklad.trim() || /[|;&]\s*$/.test(zaklad);
    let moznosti;
    if (prvni) moznosti = PRIKAZY.filter((p) => p.indexOf(slovo) === 0).map((p) => p + " ");
    else {
      const i = slovo.lastIndexOf("/");
      const adresar = i >= 0 ? slovo.slice(0, i + 1) : "", zacatek = slovo.slice(i + 1);
      const u = this.uzel(this.cesta(adresar || "."));
      moznosti = u && u.t === "d" ? Object.keys(u.c).filter((x) => x.indexOf(zacatek) === 0 && (zacatek[0] === "." || x[0] !== "."))
        .sort().map((x) => adresar + x + (u.c[x].t === "d" ? "/" : " ")) : [];
    }
    if (moznosti.length === 1) return { radek: zaklad + moznosti[0], moznosti: [] };
    /* spolecny zacatek vic moznosti */
    let spol = moznosti[0] || "";
    moznosti.forEach((x) => { while (x.indexOf(spol) !== 0) spol = spol.slice(0, -1); });
    return { radek: zaklad + (spol.length > slovo.length ? spol : slovo), moznosti: moznosti.length > 1 ? moznosti.map((x) => x.trim()) : [] };
  }
}

const LinuxShell = { Shell, PRIKAZY, HOME, novyFs };
if (typeof module !== "undefined" && module.exports) module.exports = LinuxShell;
else glob.LinuxShell = LinuxShell;
})(this);
