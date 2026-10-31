# LinsoftPhone Installer

Nahrá LinsoftPhone OS **priamo do telefónu** (USB kábel, fastboot), zapíše ho na
**USB kľúč alebo SD kartu**, alebo pripraví súbor **`linsoftPhone.img`** pre
VirtualBox / QEMU.

1. **Zariadenie a obraz:** vyber zariadenie a inštalátor stiahne jeho najnovší obraz
   z [GitHub Releases](https://github.com/Linsoft1/linsoftphone-os/releases)
   a overí SHA256. Alebo použi vlastný `.img` / `.img.xz`.
2. **Cieľ:**
   - **telefón cez USB kábel:** nahrá systém cez fastboot. Ak fastboot v počítači nie je,
     stiahne ho (Android platform-tools od Google).
   - **USB / SD:** ponúkne **iba vymeniteľné disky** do 256 GB, nikdy systémový
     ani bootovací disk.
   - Pred zmazaním sa vždy dvakrát opýta.
3. **Zápis** s priebehom. Telefón sa na konci sám reštartuje do LinsoftPhone OS.

## Podporované zariadenia

| Zariadenie | Ako sa inštaluje | `--zariadenie` |
|---|---|---|
| OnePlus 6 | USB kábel (fastboot) | `oneplus-enchilada` |
| OnePlus 6T | USB kábel (fastboot) | `oneplus-fajita` |
| Google Pixel 3a | USB kábel (fastboot) | `google-sargo` |
| Google Pixel 3a XL | USB kábel (fastboot) | `google-bonito` |
| Xiaomi Poco F1, displej Tianma | USB kábel (fastboot) | `xiaomi-beryllium-tianma` |
| Xiaomi Poco F1, displej EBBG | USB kábel (fastboot) | `xiaomi-beryllium-ebbg` |
| Fairphone 4 | USB kábel (fastboot) | `fairphone-fp4` |
| SHIFT6mq | USB kábel (fastboot) | `shift-axolotl` |
| PINE64 PinePhone | SD karta | `pine64-pinephone` |
| PINE64 PinePhone Pro | SD karta | `pine64-pinephonepro` |

Do telefónu sa nahráva presne to, čo odporúča `pmbootstrap`: systém do oddielu
`userdata`, jadro do `boot`, pri Pixeloch aj `vbmeta` s vypnutým overovaním.
| Počítač / virtuálny stroj | USB kľúč alebo `linsoftPhone.img` | `qemu-amd64` |

Iné telefóny podporované postmarketOS sa dajú zostaviť cez `pmbootstrap`, pozri
[postmarketos/README.md](../postmarketos/README.md).

## Telefón: skôr než začneš

- Inštalácia **zmaže celý telefón** (Android, fotky, aplikácie). Najprv si sprav zálohu.
- **Odomkni bootloader.** Návod je na [wiki postmarketOS](https://wiki.postmarketos.org/wiki/Devices)
  pri danom modeli.
- **Režim fastboot:** vypni telefón, drž **Hlasitosť +** (OnePlus) alebo **Hlasitosť −**
  (Pixel, Poco F1, Fairphone) a zapni ho. Potom ho pripoj USB káblom.
- **Poco F1** má dva druhy displeja (Tianma, EBBG). Vyber ten svoj, postup je na
  [wiki pri Poco F1](https://wiki.postmarketos.org/wiki/Xiaomi_Poco_F1_(xiaomi-beryllium)).
- **Windows** potrebuje ovládač fastboot
  ([Google USB Driver](https://developer.android.com/studio/run/win-usb)).
  **Linux:** spusti cez `sudo` alebo nastav pravidlá udev pre Android.

## Spustenie

- **Windows:** dvojklik na `LinsoftPhone-Installer.bat` (vypýta si správcu).
- **Linux:** `sudo python3 linsoft_instalator.py`
- Potrebuje iba Python 3.8+ (štandardná knižnica, okno cez tkinter).

Bez okna (príkazový riadok):

```sh
python linsoft_instalator.py --zariadenia                               # podporované zariadenia
python linsoft_instalator.py --telefon --zariadenie oneplus-enchilada   # do telefónu (napíš ZMAZAT)
python linsoft_instalator.py --disky                                    # vymeniteľné disky
python linsoft_instalator.py --zariadenie pine64-pinephone --disk /dev/sdb   # PinePhone na SD kartu
python linsoft_instalator.py --subor linsoftPhone.img                   # obraz pre virtuálny stroj
```

Testy (bez skutočného disku a telefónu): `python -m unittest discover -s instalator`

© 2026 Linsoft
