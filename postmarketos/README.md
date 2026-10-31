# LinsoftPhone OS ako vlastný systém telefónu (postmarketOS)

Tento priečinok urobí z LinsoftPhone OS **operačný systém telefónu**: Android sa
z telefónu zmaže a po zapnutí naštartuje priamo LinsoftPhone OS.

```
┌──────────────────────────────────────────┐
│  LinsoftPhone OS (rozhranie z pwa/)      │  plocha, zámok, aplikácie, klávesnica
├──────────────────────────────────────────┤
│  Chromium v kiosku Cage                  │  celá obrazovka, nič iné
├──────────────────────────────────────────┤
│  linsoft-sluzba (127.0.0.1:8640)         │  hovory, SMS, Wi-Fi, batéria, jas, vypnutie
├──────────────────────────────────────────┤
│  postmarketOS (Linux) + ovládače         │  displej, dotyk, modem, Wi-Fi
└──────────────────────────────────────────┘
```

## Na ktorých telefónoch to funguje

Na každom telefóne, ktorý podporuje postmarketOS. Je ich vyše 500 od rôznych
výrobcov (Samsung, Xiaomi, OnePlus, Google, Sony, Motorola, Fairphone, PINE64,
…): <https://wiki.postmarketos.org/wiki/Devices>

Koľko toho funguje, závisí od konkrétneho modelu. **Hovory a SMS** fungujú len
tam, kde postmarketOS ovláda modem (stĺpec *Mobile data / Calls* na wiki).
Najlepšie podporované sú napríklad PinePhone, PinePhone Pro, OnePlus 6/6T,
Xiaomi Poco F1, Fairphone 4/5 a Pixel 3a.

**iPhone nie je podporovaný:** Apple neumožňuje nainštalovať iný systém.

## ⚠️ Skôr než začneš

- Inštalácia **zmaže celý telefón** (fotky, aplikácie, Android). Najprv si sprav zálohu.
- Väčšina telefónov potrebuje **odomknutý bootloader**. Postup je pre každý model
  iný a je na wiki postmarketOS pri danom zariadení. Pri niektorých výrobcoch
  (Huawei, niektoré Samsungy v USA) sa odomknúť nedá vôbec.
- Pri chybe môže telefón prestať štartovať. Vyskúšaj to najprv na starom
  telefóne, nie na tom, ktorý denne používaš.

## Postup

Potrebuješ Linux alebo Windows s WSL (Ubuntu) a USB kábel.

```sh
# 1. nainštaluj pmbootstrap (nástroj na zostavenie postmarketOS)
sudo apt install pipx && pipx install pmbootstrap

# 2. prvé nastavenie: vyber výrobcu a model telefónu; UI zatiaľ hocijaké
pmbootstrap init

# 3. vlož balík LinsoftPhone OS do pmaports
sh postmarketos/priprav.sh

# 4. znova init a ako "User interface" zvoľ: linsoft
pmbootstrap init

# 5. zostav systém (prvýkrát trvá dlho, sťahuje ~1–2 GB)
pmbootstrap install

# 6. nahraj ho do telefónu (telefón v režime fastboot, pripojený cez USB)
pmbootstrap flasher flash_rootfs
pmbootstrap flasher flash_kernel
#    PinePhone a telefóny s SD kartou: pmbootstrap install --sdcard=/dev/sdX
```

Presné kroky na nahratie do konkrétneho telefónu (fastboot, Odin pri
Samsungu, SD karta) sú na wiki postmarketOS pri danom modeli.

### Vyskúšanie bez telefónu

V kroku 2 a 4 zvoľ zariadenie **qemu / amd64** a potom spusti `pmbootstrap qemu`.
LinsoftPhone OS naštartuje vo virtuálnom stroji.

### Vyskúšanie rozhrania na počítači

Rozhranie s ukážkovými dátami (hovor, SMS, Wi-Fi) sa dá pozrieť aj bez
postmarketOS:

```sh
LINSOFT_DEMO=1 python3 postmarketos/postmarketos-ui-linsoft/linsoft-sluzba.py pwa
# otvor http://127.0.0.1:8640/   (LINSOFT_DEMO_HOVOR=1 = ukážkový prichádzajúci hovor)
```

## Čo LinsoftPhone OS na telefóne vie

| Funkcia | Ako |
|---|---|
| volanie, prijatie a zloženie hovoru | ModemManager (`mmcli`) |
| posielanie a príjem SMS | ModemManager |
| Wi-Fi siete a pripojenie | NetworkManager (`nmcli`) |
| batéria, signál, operátor | `/sys/class/power_supply`, ModemManager |
| jas displeja | `/sys/class/backlight` |
| vypnutie, reštart | `poweroff` / `reboot` |
| Android aplikácie (Linsoft Store) | Waydroid; inštalácia z F-Droid (`sudo apk add waydroid && sudo waydroid init`) |
| písanie | vlastná klávesnica LinsoftPhone OS (slovenské QWERTZ, diakritika, čísla) |
| všetko ostatné | rovnako ako PWA verzia: zámok s PINom, budík, kalendár, poznámky, … |

## Súbory

- [postmarketos-ui-linsoft/APKBUILD](postmarketos-ui-linsoft/APKBUILD): balík
  pre postmarketOS (Alpine)
- [linsoft-sluzba.py](postmarketos-ui-linsoft/linsoft-sluzba.py): lokálna
  služba. Počúva len na `127.0.0.1` a prijíma iba požiadavky s hlavičkou
  `X-Linsoft` a správnym `Host`, takže ju nemôže ovládať cudzia webová stránka
- [linsoft-session](postmarketos-ui-linsoft/linsoft-session): spustí kiosk
  (Cage + Chromium; Cog/WPE v postmarketOS nie je). Zväčšenie pre displej sa
  nastavuje v `/etc/conf.d/linsoft-session` (`LINSOFT_SKALA=1.5`, predvolene 2)
- [priprav.sh](priprav.sh): skopíruje balík a rozhranie do pmaports
- [tests/](tests/): testy služby (`npm run test:sluzba`)

## Známe obmedzenia

- Obraz systému je zostavený a vyskúšaný len vo virtuálnom stroji
  (qemu-amd64, postmarketOS edge, OpenRC): služba aj zámková obrazovka
  naštartujú. Na skutočnom telefóne zatiaľ vyskúšaný nebol.
- Fotoaparát v prehliadači závisí od toho, či ho daný telefón podporuje v postmarketOS
  (na väčšine zatiaľ nefunguje).
- Displej, ktorý je od výroby na šírku, treba otočiť (výstup v Cage).
- Prichádzajúci hovor zazvoní, len keď je telefón zapnutý a LinsoftPhone OS
  beží. Úsporný režim (uspatie) zatiaľ nie je.
