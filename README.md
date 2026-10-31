<p align="center"><img src="pwa/icons/logo.svg" width="128" alt="Logo LinsoftPhone OS"></p>

# LinsoftPhone OS

**Autor: Linsoft** · © 2026 Linsoft

Vlastní logo systému: písmeno **L** tvoří dvě osy a z jejich rohu se šíří
signál ([pwa/icons/logo.svg](pwa/icons/logo.svg)). Stejné logo vykresluje
i kernel přímo do framebufferu — bez obrázku, výpočtem ([gfx.c](gfx.c)).

Tři podoby jednoho systému:

1. **Kernel** (kořen repa) — skutečný mini-OS pro ARM běžící v QEMU
2. **PWA** ([pwa/](./pwa)) — moderní telefonní prostředí, které funguje na
   **jakémkoli smartphonu** (Android i iPhone) přes prohlížeč a dá se
   nainstalovat jako aplikace („Přidat na plochu")
3. **Vlastní systém telefonu** ([postmarketos/](./postmarketos)) — Android se
   z telefonu smaže a po zapnutí naběhne přímo LinsoftPhone OS (postmarketOS
   + kiosk + lokální služba pro hovory, SMS, Wi-Fi); funguje na telefonech,
   které podporuje postmarketOS. Návod: [postmarketos/README.md](./postmarketos/README.md)
   — ověřeno: obraz pro `qemu-amd64` se sestaví a naběhne rovnou do zamykací
   obrazovky LinsoftPhone OS (kiosk Cage + Chromium); na skutečném telefonu
   zatím nevyzkoušeno

## PWA verze 2.4 — pro skutečné telefony

- **nový vzhled**: vlastní sada ikon LinsoftPhone OS ([pwa/ikony.js](pwa/ikony.js),
  SVG místo emoji — na každém telefonu stejné), 4 tapety + vlastní fotka
  z Galerie, skleněný widget „Dnes" (budík, dnešní události), zamykací
  obrazovka s náhledem notifikací a tlačítky svítilny a fotoaparátu,
  stavový řádek s ikonami signálu, Wi-Fi a baterie, animace otevírání aplikací
- **Navigace**: skleněná lišta tlačítek ◁ ◯ ▢ s animací a krátkou vibrací,
  nebo **gesta** (Nastavení → Navigace): proužek dole, nahoru = plocha,
  dlouze nahoru = nedávné aplikace, do strany = zpět
- **Telefon**: karty Klávesnice / Nedávné / Kontakty, klávesy s písmeny,
  při vytáčení ukáže odpovídající kontakt, podržením 0 napíše „+",
  seznam hovorů (odchozí, příchozí, zmeškané)
- **Zprávy**: seznam konverzací s avatary a náhledem, vlákno s bublinami
  a oddělením podle dnů, pole na psaní dole, nová zpráva tlačítkem
- **Galerie**: mřížka náhledů seskupená podle dnů (Dnes, Včera, datum),
  prohlížeč přes celou obrazovku s posouváním prstem, sdílení fotky,
  nastavení jako tapety, stažení a mazání
- **Linsoft Store** — katalog Android aplikací (WhatsApp, Signal, YouTube,
  Spotify, VLC, NewPipe, Organic Maps, F-Droid…) s kategoriemi a hledáním.
  Na telefonu s Androidem otevře aplikaci v Google Play / F-Droid a instalaci
  dokončí Android; na vlastním systému LinsoftPhone OS (postmarketOS)
  instaluje aplikace z F-Droid přímo do **Waydroidu** (Android uvnitř Linuxu);
  na iPhonu Android aplikace nejdou
- **Linsoft Browser 2.1** — webový prohlížeč v doku: adresní řádek
  s našeptávačem (záložky, historie, hledání), volba vyhledávače (Google,
  Bing, Wikipédia), úvodní stránka s rychlým přístupem, karty i soukromé
  karty bez historie, záložky, historie, sdílení odkazu, „Otevřít mimo";
  YouTube videa hraje přímo (vložitelná verze), u blokovaných webů a bez
  připojení ukáže srozumitelnou stránku;
  stránky běží v sandboxu a nemohou ovládat systém. Weby, které vnoření
  zakazují (Facebook, GitHub, YouTube), se otevřou mimo LinsoftPhone OS
- **Nastavení → O systému**: verze a sestavení LinsoftPhone OS, rozhraní,
  prohlížeč, platforma, displej, procesor, paměť, úložiště, baterie, síť,
  doba běhu, počet kontaktů a fotek; na telefonu s postmarketOS navíc model,
  distribuce, jádro, operátor a signál (od služby `linsoft-sluzba`)

- **úvodní obrazovka s logem** při startu, logo v Nastavení → O systému,
  ikony aplikace a favicon z vlastního loga

- zamykací obrazovka s volitelným **PIN zámkem** (zamkne se při každém odchodu
  z aplikace), odemknutí klepnutím nebo potažením nahoru
- plocha s widgetem hodin, mřížka aplikací, dock; **gesta** (potažením dolů
  panel notifikací, nahoru zavřít)
- panel notifikací s rychlými přepínači, které **skutečně fungují**: svítilna
  (blesk fotoaparátu, Android), světlý/tmavý motiv, celá obrazovka, zamknout
- navigační lišta ◁ ◯ ▢: Zpět funguje i se systémovým gestem Androidu,
  ▢ = **přepínač nedávných aplikací**
- aplikace: Telefon (vytáčí přes `tel:`), **Zprávy — odesílá skutečné SMS**
  přes SMS aplikaci telefonu, Kontakty (volání, SMS, **import kontaktů
  z telefonu** na Androidu), Kalkulačka, **Hodiny: budík, minutka, stopky**,
  **Kalendář s událostmi** a listováním měsíců, Poznámky, Fotoaparát (skutečná
  kamera), Galerie (náhled, stažení, mazání), Terminál, Nastavení
- **systémové notifikace** telefonu (budík, minutka; na iPhonu jen v
  nainstalované PWA, iOS 16.4+)
- **čeština, slovenčina, angličtina** — jazyk se vybere podle telefonu,
  změna v Nastavení
- fotky v **IndexedDB** (stovky MB místo ~5 MB), **záloha a obnova** všech dat
  do souboru `.json`
- přístupnost: popisy tlačítek pro čtečky obrazovky, povolené zvětšení,
  viditelné ohraničení při ovládání klávesnicí
- maskovatelná ikona pro Android, ikona 180 px pro iPhone, zkratky
  Telefon/Fotoaparát po podržení ikony
- skutečný stav baterie, offline režim přes service worker

Budík a minutka zvoní jen tehdy, když je LinsoftOS otevřený — webová aplikace
nemůže probudit zamknutý telefon.

Test obrazovek v opravdovém prohlížeči (Chrome / Edge headless): `npm run test:obrazovky`
— otevře každou aplikaci ve třech jazycích na velkém i malém displeji, selže
při jakékoli chybě JavaScriptu a uloží snímky do `pwa/tests/snimky/`.

Testy (Node 18+, bez závislostí): `npm test` — logika, překlady všech jazyků,
kompatibilita se staršími telefony. Na GitHubu běží automaticky
([.github/workflows/test.yml](.github/workflows/test.yml)).

Lokální spuštění: `.\pwa\serve.ps1` → http://localhost:8080

Na skutečný telefon: po pushi do `main` se [pwa/](./pwa) samo nasadí na GitHub
Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)) — jednou je
třeba v repozitáři zapnout *Settings → Pages → Source: GitHub Actions*. Pak na
telefonu otevřít `https://<uživatel>.github.io/linsoftphone-os/` → „Přidat na plochu".

Podporované telefony: Android 7+ (Chrome / Samsung Internet / Firefox, i starší
WebView), iPhone s iOS 12+ (Safari). Ošetřeno: výřez displeje (notch), malé
displeje od 320 px, telefon na šířku, gesto Zpět na Androidu, zoom při psaní na
iOS, plné úložiště fotkami, aktualizace přes service worker.

## Kernel verze 1.3 — skutečný OS v QEMU

Při startu se na displeji ukáže **úvodní obrazovka s logem** a ukazatelem
načítání, v hlavičce zůstane malé logo; na sériové konzoli je logo v ASCII.

Mini operační systém (kernel) pro ARM, běžící v emulátoru QEMU. Napsaný v C a
assembleru, bez jakékoli knihovny — vlastní ovladač UART, shell a aplikace.

```
  .-----------.    _     _                  __ _
  | ========= |   | |   (_)_ __  ___  ___  / _| |_
  | |LINSOFT| |   | |   | | '_ \/ __|/ _ \| |_| __|
  | | PHONE | |   | |___| | | | \__ \ (_) |  _| |_
  | |  OS   | |   |_____|_|_| |_|___/\___/|_|  \__|
  | ========= |    ____  _                      ___  ____
  |    ___    |   |  _ \| |__   ___  _ __   ___ / _ \/ ___|
  |   (( ))   |   | |_) | '_ \ / _ \| '_ \ / _ \ | | \___ \
  '-----------'   |  __/| | | | (_) | | | |  __/ |_| |___) |
                  |_|   |_| |_|\___/|_| |_|\___| \___/|____/
```

### Novinky ve verzi 1.3

- grafická konzole zalamuje text po slovech (dlouhá slova se lámou natvrdo,
  pokračovací řádky jsou odsazené); sériový výstup je beze změny
- virtio klávesnice má rozložení `sk` (QWERTZ, výchozí) a `us`; přepíná se
  příkazem `klavesnica [sk|us]`, aktivní rozložení ukazuje `info`
- v `sk` dává číselná řada číslice, písmena s diakritikou se píšou bez ní,
  AltGr dává symboly `@ # & { } [ ] \ | < > *`
- opraveno zamrzání vstupu ze sériové linky při vložení delšího textu

### Novinky ve verzi 1.1–1.2

- **Hodiny reálného času** — RTC PL031 ([rtc.c](./rtc.c)); stavový řádek
  ukazuje skutečný čas HH:MM s blikající dvojtečkou, `run.ps1` spouští QEMU
  s `-rtc base=localtime`
- **Přerušení (GICv2)** ([irq.c](./irq.c)) — tabulka vektorů výjimek, virtuální
  generic timer tiká každých 100 ms, UART přijímá přes přerušení do kruhové
  fronty; nečinný procesor spí (`wfi`) místo aktivního čekání. Pády CPU se
  vypíšou na UART (`!!! Vyjimka: …`)
- **Klávesnice v okně QEMU** — virtio-keyboard ([virtio.c](./virtio.c),
  virtio-mmio legacy i 1.0): psát lze přímo do displeje, vstup jde do stejného
  shellu jako sériová linka (rozložení US)
- **Dotyk** — virtio-tablet: klik na spodní lištu `<` smaže rozepsaný řádek,
  `O` vrátí domovskou obrazovku, `[]` vypíše seznam příkazů
- bez ramfb nebo virtio zařízení systém dál funguje (jen sériová konzole)
- nový příkaz `datum`; `info` ukazuje RTC, přerušení a vstupní zařízení
- oprava: při posunu konzole (scroll) kernel padal na nezarovnaném přístupu do
  paměti — sestavuje se nyní s `+strict_align`

## Co umí

Interaktivní shell na sériové konzoli s příkazy:

| Příkaz          | Popis                                  |
|-----------------|----------------------------------------|
| `pomoc`         | seznam příkazů                         |
| `info`          | informace o systému (CPU, UART, timer) |
| `cas`           | doba běhu systému (generic timer)      |
| `datum`         | dnešní datum a čas (RTC)               |
| `kalk <výraz>`  | kalkulačka: `+ - * /` a závorky        |
| `zprava <text>` | uložit zprávu                          |
| `zpravy`        | vypsat uložené zprávy                  |
| `kontakty`      | seznam kontaktů                        |
| `vymaz`         | smazat obrazovku                       |
| `restart`       | restart přes PSCI                      |
| `vypni`         | vypnutí přes PSCI (ukončí QEMU)        |

## Grafické rozhraní

Kernel má vlastní grafický displej **480×800** (telefonní formát) přes QEMU
zařízení **ramfb**:

- vlastní ovladač **fw_cfg** (MMIO + DMA) nakonfiguruje ramfb — framebuffer je
  obyčejné pole v RAM
- stavový řádek: signál, operátor „Linsoft 5G", hodiny (doba běhu), baterie
- hlavička s logem, grafická konzole (8×8 font, 2× zvětšený, scrollování)
- spodní navigační lišta (zpět / domů / aplikace)
- výstup shellu jde **současně** na sériovou konzoli i na displej; vstup
  (klávesnice) zůstává na sériové lince
- bez `-device ramfb` systém normálně běží jen na sériové konzoli

## Technika

- **Cíl:** QEMU `-M virt`, CPU Cortex-A15 (ARMv7-A, 32bit)
- **Konzole:** PL011 UART na `0x09000000` (polled I/O)
- **Displej:** ramfb přes fw_cfg na `0x09020000` ([gfx.c](./gfx.c)), font
  [font8x8.h](./font8x8.h) (public domain)
- **Čas:** ARM generic timer (`CNTFRQ`/`CNTVCT`), vlastní 64bit dělení
- **Vypnutí/restart:** PSCI volání přes `hvc #0`
- **Boot:** [boot.S](./boot.S) nastaví zásobník, vynuluje `.bss`, skočí do
  `kmain` v [kernel.c](./kernel.c); rozložení paměti řídí [linker.ld](./linker.ld)
- **Toolchain:** `zig cc` jako cross-kompilátor (`arm-freestanding-eabi`),
  žádná libc (`-nostdlib -ffreestanding`)

## Sestavení

Vyžaduje [Zig](https://ziglang.org) (`winget install zig.zig`):

```powershell
.\build.ps1    # vytvoří kernel.elf
```

## Spuštění

Vyžaduje [QEMU](https://www.qemu.org) (`winget install SoftwareFreedomConservancy.QEMU`):

```powershell
.\run.ps1
```

Otevře se okno QEMU s displejem telefonu; příkazy se píšou do terminálu
(sériová konzole). Ukončení: příkaz `vypni` v shellu, nebo zavřít okno QEMU.
