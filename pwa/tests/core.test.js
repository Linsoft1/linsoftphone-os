/* testy ciste logiky (core.js) - spusteni: npm test */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const Core = require("../core.js");

test("vsechny jazyky maji stejne klice", () => {
  const klice = Object.keys(Core.TEXTY.cs).sort();
  for (const j of Object.keys(Core.TEXTY)) {
    assert.deepStrictEqual(Object.keys(Core.TEXTY[j]).sort(), klice, "jazyk " + j);
    assert.ok(Core.JAZYKY[j], "nazev jazyka " + j);
  }
});

test("vychozi jazyk podle telefonu", () => {
  assert.strictEqual(Core.vychoziJazyk("sk-SK"), "sk");
  assert.strictEqual(Core.vychoziJazyk("cs"), "cs");
  assert.strictEqual(Core.vychoziJazyk("de-DE"), "en");
  assert.strictEqual(Core.vychoziJazyk(undefined), "en");
});

test("preklad s parametrem a zalozni anglictinou", () => {
  assert.strictEqual(Core.preklad("sk", "volam", "Mama"), "Volám Mama…");
  assert.strictEqual(Core.preklad("xx", "app_telefon"), "Phone");
  assert.strictEqual(Core.preklad("cs", "neexistuje"), "neexistuje");
});

test("datum v cestine, slovencine a anglictine", () => {
  const d = new Date(2026, 9, 31);
  assert.strictEqual(Core.datumText("cs", d), "sobota 31. října");
  assert.strictEqual(Core.datumText("sk", d), "sobota 31. októbra");
  assert.strictEqual(Core.datumText("en", d), "Saturday, October 31");
  assert.strictEqual(Core.denKlic(new Date(2026, 0, 5)), "2026-01-05");
  assert.strictEqual(Core.hhmm(new Date(2026, 0, 5, 7, 3)), "07:03");
});

test("mrizka mesice zacina pondelim", () => {
  const rijen = Core.mesicMrizka(2026, 9); /* 1. 10. 2026 je ctvrtek */
  assert.deepStrictEqual(rijen.slice(0, 4), [null, null, null, 1]);
  assert.strictEqual(rijen.filter((x) => x !== null).length, 31);
  assert.strictEqual(Core.mesicMrizka(2028, 1).filter((x) => x !== null).length, 29); /* prestupny rok */
});

test("budik zazvoni jednou denne", () => {
  const d = new Date(2026, 9, 31, 7, 0, 30);
  const b = { h: 7, m: 0, zap: true, posledni: null };
  assert.ok(Core.budikMaZvonit(b, d));
  assert.ok(!Core.budikMaZvonit(Object.assign({}, b, { posledni: "2026-10-31" }), d));
  assert.ok(!Core.budikMaZvonit(Object.assign({}, b, { zap: false }), d));
  assert.ok(!Core.budikMaZvonit(Object.assign({}, b, { m: 1 }), d));
});

test("kalkulacka", () => {
  assert.strictEqual(Core.spocitej("1+2×3"), 7);
  assert.strictEqual(Core.spocitej("(1+2)×3"), 9);
  assert.strictEqual(Core.spocitej("0,1+0,2"), 0.3);
  assert.strictEqual(Core.spocitej("10÷4"), 2.5);
  assert.strictEqual(Core.spocitej("5−8"), -3);
  assert.throws(() => Core.spocitej("1÷0"));
  assert.throws(() => Core.spocitej("alert(1)"));
  assert.throws(() => Core.spocitej("1+"));
});

test("SMS odkaz pro Android a iPhone", () => {
  assert.strictEqual(Core.smsOdkaz("+420 601 111", "ahoj & cau", false), "sms:+420601111?body=ahoj%20%26%20cau");
  assert.strictEqual(Core.smsOdkaz("601-111", "x", true), "sms:601111&body=x");
  assert.strictEqual(Core.cisloTel("tel: +420 (601) 111"), "+420601111");
});

test("PIN", () => {
  assert.strictEqual(Core.pinHash("1234"), Core.pinHash("1234"));
  assert.notStrictEqual(Core.pinHash("1234"), Core.pinHash("1235"));
  assert.ok(Core.pinPlatny("0000"));
  assert.ok(!Core.pinPlatny("123"));
  assert.ok(!Core.pinPlatny("12a4"));
});

test("kontrola souboru zalohy", () => {
  const ok = { app: "linsoftos", verze: 1, data: { lp_jazyk: '"sk"' }, fotky: ["data:image/jpeg;base64,AA"] };
  assert.ok(Core.platnaZaloha(ok));
  assert.ok(!Core.platnaZaloha(null));
  assert.ok(!Core.platnaZaloha(Object.assign({}, ok, { app: "jine" })));
  assert.ok(!Core.platnaZaloha(Object.assign({}, ok, { data: { cizi: "1" } })));
  assert.ok(!Core.platnaZaloha(Object.assign({}, ok, { fotky: ["javascript:alert(1)"] })));
});

test("prohlizec a platforma z user agenta", () => {
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const samsung = "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
  const cog = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 Cog/0.18";
  assert.deepStrictEqual(Core.prohlizec(android), { nazev: "Chrome", verze: "126" });
  assert.deepStrictEqual(Core.prohlizec(iphone), { nazev: "Safari", verze: "17" });
  assert.strictEqual(Core.prohlizec(samsung).nazev, "Samsung Internet");
  assert.strictEqual(Core.platforma(android), "Android 14");
  assert.strictEqual(Core.platforma(iphone), "iOS 17.5");
  assert.strictEqual(Core.platforma(cog), "Linux");
  assert.strictEqual(Core.platforma(""), "?");
});

test("velikost a doba behu", () => {
  assert.strictEqual(Core.velikost(512, "sk"), "512 B");
  assert.strictEqual(Core.velikost(1536, "sk"), "1,5 KB");
  assert.strictEqual(Core.velikost(1536, "en"), "1.5 KB");
  assert.strictEqual(Core.velikost(4 * 1024 ** 3, "cs"), "4 GB");
  assert.strictEqual(Core.velikost(250 * 1024 ** 2, "cs"), "250 MB");
  assert.strictEqual(Core.trvani(45), "45 s");
  assert.strictEqual(Core.trvani(125), "2 min");
  assert.strictEqual(Core.trvani(3 * 3600 + 5 * 60), "3 h 5 min");
  assert.strictEqual(Core.trvani(2 * 86400 + 4 * 3600), "2 d 4 h");
});

test("Linsoft Browser: adresni radek", () => {
  const H = Core.HLEDANI;
  assert.strictEqual(Core.adresaZVstupu("sme.sk"), "https://sme.sk");
  assert.strictEqual(Core.adresaZVstupu("  sk.wikipedia.org/wiki/Bratislava "), "https://sk.wikipedia.org/wiki/Bratislava");
  assert.strictEqual(Core.adresaZVstupu("http://example.com"), "http://example.com");
  assert.strictEqual(Core.adresaZVstupu("localhost:8080"), "http://localhost:8080");
  assert.strictEqual(Core.adresaZVstupu("192.168.1.1"), "http://192.168.1.1");
  assert.strictEqual(Core.adresaZVstupu("počasie bratislava"), H + "po%C4%8Dasie%20bratislava");
  assert.strictEqual(Core.adresaZVstupu("linsoft"), H + "linsoft");
  assert.strictEqual(Core.adresaZVstupu("javascript:alert(1)"), H + "javascript%3Aalert(1)");
  assert.strictEqual(Core.adresaZVstupu(""), "");
  assert.strictEqual(Core.zobrazAdresu("https://www.sme.sk/clanok?id=1"), "sme.sk");
  assert.strictEqual(Core.zobrazAdresu(H + "po%C4%8Dasie"), "počasie");
});

test("Linsoft Browser: vyhledavace, YouTube, blokovane weby, navrhy", () => {
  assert.strictEqual(Core.adresaZVstupu("mapa", "bing"), "https://www.bing.com/search?q=mapa");
  assert.strictEqual(Core.adresaZVstupu("Bratislava", "wikipedia"), Core.HLEDACE.wikipedia.url + "Bratislava");
  assert.strictEqual(Core.adresaZVstupu("x", "neexistuje"), Core.HLEDANI + "x");
  assert.strictEqual(Core.zobrazAdresu("https://www.bing.com/search?q=po%C4%8Dasie+dnes"), "počasie dnes");
  assert.strictEqual(Core.zobrazAdresu("https://m.youtube.com/watch?v=x"), "youtube.com");

  const yt = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1";
  assert.deepStrictEqual(Core.upravAdresu("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), { url: yt, blokovane: false });
  assert.strictEqual(Core.upravAdresu("https://youtu.be/dQw4w9WgXcQ").url, yt);
  assert.strictEqual(Core.upravAdresu("https://m.youtube.com/shorts/dQw4w9WgXcQ").url, yt);
  assert.strictEqual(Core.upravAdresu("https://www.facebook.com/linsoft").blokovane, true);
  assert.strictEqual(Core.upravAdresu("https://github.com/Linsoft1").blokovane, true);
  assert.strictEqual(Core.upravAdresu("https://notgithub.com/").blokovane, false);
  assert.strictEqual(Core.upravAdresu("https://sk.wikipedia.org/").blokovane, false);

  const zdroje = [{ url: "https://sk.m.wikipedia.org/", titulek: "Wikipédia" }, { url: "https://sme.sk" },
    { url: "https://sk.m.wikipedia.org/" }, { url: "https://wttr.in/Bratislava", titulek: "Počasie" }];
  assert.deepStrictEqual(Core.navrhy("wiki", zdroje).map((p) => p.url), ["https://sk.m.wikipedia.org/"]);
  assert.strictEqual(Core.navrhy("poč", zdroje)[0].titulek, "Počasie");
  assert.deepStrictEqual(Core.navrhy("", zdroje), []);
});
