# LinsoftPhone OS

Dvě podoby jednoho systému:

1. **Kernel** (kořen repa) — skutečný mini-OS pro ARM běžící v QEMU
2. **PWA** ([pwa/](./pwa)) — moderní telefonní prostředí, které funguje na
   **jakémkoli smartphonu** (Android i iPhone) přes prohlížeč a dá se
   nainstalovat jako aplikace („Přidat na plochu")

## PWA verze 2.0 — pro skutečné telefony

- zamykací obrazovka, moderní plocha s widgetem hodin, mřížka aplikací, dock
- stahovací panel notifikací s rychlými přepínači (Wi-Fi, Bluetooth, …)
- navigační lišta ◁ ◯ ▢ jako Android
- aplikace: Telefon (vytáčí přes `tel:`), Zprávy, Kontakty, Kalkulačka,
  Hodiny + stopky, Kalendář, Poznámky, **Fotoaparát (skutečná kamera)**,
  Galerie, Terminál (stejné příkazy jako kernel), Nastavení (světlý/tmavý motiv)
- skutečný stav baterie (Battery API), data v localStorage, offline režim
  přes service worker

Lokální spuštění: `.\pwa\serve.ps1` → http://localhost:8080

Na skutečný telefon: nahrát obsah [pwa/](./pwa) na libovolný HTTPS hosting
(např. GitHub Pages) a na telefonu otevřít adresu → „Přidat na plochu".

## Kernel verze 1.0 — skutečný OS v QEMU

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

## Co umí

Interaktivní shell na sériové konzoli s příkazy:

| Příkaz          | Popis                                  |
|-----------------|----------------------------------------|
| `pomoc`         | seznam příkazů                         |
| `info`          | informace o systému (CPU, UART, timer) |
| `cas`           | doba běhu systému (generic timer)      |
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
