/* testy linuxoveho shellu Terminalu (shell.js) - chova se jako bash */
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { Shell } = require("../shell.js");

const novy = () => new Shell(null, "2.4");
const out = (sh, radek) => sh.spust(radek).vystup;

test("pwd, cd, ~ a ..", () => {
  const sh = novy();
  assert.strictEqual(out(sh, "pwd"), "/home/user\n");
  out(sh, "cd /etc");
  assert.strictEqual(out(sh, "pwd"), "/etc\n");
  out(sh, "cd ../home/user/Dokumenty");
  assert.strictEqual(sh.vyzva().cesta, "~/Dokumenty");
  out(sh, "cd");
  assert.strictEqual(sh.vyzva().cesta, "~");
  assert.strictEqual(out(sh, "cd neexistuje"), "lsh: cd: neexistuje: No such file or directory\n");
  out(sh, "cd /tmp"); out(sh, "cd -");
  assert.strictEqual(out(sh, "pwd"), "/home/user\n");
});

test("subory: touch, echo >, >>, cat, mkdir -p, cp, mv, rm -r", () => {
  const sh = novy();
  out(sh, "echo ahoj > a.txt");
  out(sh, 'echo "druhy riadok" >> a.txt');
  assert.strictEqual(out(sh, "cat a.txt"), "ahoj\ndruhy riadok\n");
  out(sh, "mkdir -p x/y/z && touch x/y/z/b.txt");
  assert.strictEqual(out(sh, "ls x/y/z"), "b.txt\n");
  out(sh, "cp a.txt x/kopia.txt");
  out(sh, "mv x/kopia.txt x/y/");
  assert.strictEqual(out(sh, "cat x/y/kopia.txt"), "ahoj\ndruhy riadok\n");
  assert.strictEqual(out(sh, "rm x"), "rm: cannot remove 'x': Is a directory\n");
  out(sh, "rm -r x");
  assert.strictEqual(out(sh, "ls x"), "ls: cannot access 'x': No such file or directory\n");
  assert.strictEqual(out(sh, "cat nic"), "cat: nic: No such file or directory\n");
  assert.strictEqual(out(sh, "rm -rf ~"), "rm: refusing to remove '/home/user'\n");
});

test("ls -l a -a", () => {
  const sh = novy();
  assert.strictEqual(out(sh, "ls"), "Dokumenty/  Obrazky/  README.txt  Stiahnute/\n");
  assert.match(out(sh, "ls -la"), /^total \d+\ndrwxr-xr-x 1 user user\s+4096 .+ \.\//);
  assert.match(out(sh, "ls -l README.txt"), /^-rw-r--r-- 1 user user\s+\d+ .+ README\.txt\n$/);
});

test("roury, grep, head, tail, wc", () => {
  const sh = novy();
  out(sh, "echo jablko > o.txt; echo hruska >> o.txt; echo Jahoda >> o.txt");
  assert.strictEqual(out(sh, "cat o.txt | grep -i ja"), "jablko\nJahoda\n");
  assert.strictEqual(out(sh, "grep -n hruska o.txt"), "2:hruska\n");
  assert.strictEqual(out(sh, "grep -v a o.txt"), "");
  assert.strictEqual(out(sh, "head -n 1 o.txt"), "jablko\n");
  assert.strictEqual(out(sh, "tail -1 o.txt"), "Jahoda\n");
  assert.strictEqual(out(sh, "cat o.txt | wc -l"), "      3\n");
  assert.strictEqual(out(sh, "ls | grep README > zoznam.txt; cat zoznam.txt"), "README.txt\n");
});

test("premenne, uvodzovky, && a ;", () => {
  const sh = novy();
  assert.strictEqual(out(sh, "echo $HOME"), "/home/user\n");
  assert.strictEqual(out(sh, "echo '$HOME'"), "$HOME\n");
  assert.strictEqual(out(sh, 'export MENO=Linsoft; echo "ahoj $MENO"'), "ahoj Linsoft\n");
  assert.strictEqual(out(sh, "cd nic && echo nie"), "lsh: cd: nic: No such file or directory\n");
  assert.strictEqual(out(sh, "false_prikaz; echo dalej"), "lsh: false_prikaz: command not found\ndalej\n");
  assert.strictEqual(out(sh, "echo $?"), "0\n");
  assert.strictEqual(out(sh, 'echo "neukoncene'), "lsh: unexpected EOF while looking for matching `\"'\n");
});

test("clear, history, uname, doplnovanie Tabom", () => {
  const sh = novy();
  assert.strictEqual(sh.spust("clear").vymazat, true);
  out(sh, "whoami");
  assert.match(out(sh, "history"), /2 {2}whoami/);
  assert.match(out(sh, "uname -a"), /^Linux linsoftphone .*GNU\/Linux\n$/);
  assert.deepStrictEqual(sh.doplnit("unam"), { radek: "uname ", moznosti: [] });
  assert.deepStrictEqual(sh.doplnit("cat READ"), { radek: "cat README.txt ", moznosti: [] });
  assert.deepStrictEqual(sh.doplnit("cd Dok"), { radek: "cd Dokumenty/", moznosti: [] });
  assert.deepStrictEqual(sh.doplnit("h").moznosti, ["head", "help", "history", "hostname"]);
});

test("stav sa da ulozit a obnovit", () => {
  const sh = novy();
  out(sh, "mkdir projekt; cd projekt; echo x > s.txt");
  const sh2 = new Shell(JSON.parse(JSON.stringify(sh.ulozit())), "2.4");
  assert.strictEqual(out(sh2, "pwd"), "/home/user/projekt\n");
  assert.strictEqual(out(sh2, "cat s.txt"), "x\n");
});
