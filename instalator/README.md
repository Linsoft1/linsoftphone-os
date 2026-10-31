# LinsoftPhone Installer

Zapíše LinsoftPhone OS na **USB kľúč alebo SD kartu**, alebo pripraví súbor
**`linsoftPhone.img`** pre VirtualBox / QEMU.

1. **Obraz:** stiahne najnovší obraz z [GitHub Releases](https://github.com/Linsoft1/linsoftphone-os/releases)
   a overí SHA256, alebo použije vlastný `.img` / `.img.xz`.
2. **Cieľ:** ponúkne **iba vymeniteľné disky** (USB, SD) do 256 GB — nikdy
   systémový ani bootovací disk. Pred zápisom sa dvakrát opýta.
3. **Zápis** s priebehom, na konci vyprázdni vyrovnávaciu pamäť disku.

## Spustenie

- **Windows:** dvojklik na `LinsoftPhone-Installer.bat` (vypýta si správcu).
- **Linux:** `sudo python3 linsoft_instalator.py`
- Potrebuje iba Python 3.8+ (štandardná knižnica, okno cez tkinter).

Bez okna (príkazový riadok):

```sh
python linsoft_instalator.py --disky                      # vymeniteľné disky
python linsoft_instalator.py --subor linsoftPhone.img     # stiahne obraz a rozbalí ho
python linsoft_instalator.py --obraz obraz.img.xz --disk /dev/sdb   # zápis (napíš ZMAZAT)
```

> Obraz je pre počítač x86-64 / virtuálny stroj. Telefón sa nahráva cez
> `pmbootstrap` — pozri [postmarketos/README.md](../postmarketos/README.md).

Testy (bez skutočného disku): `python -m unittest discover -s instalator`

© 2026 Linsoft
