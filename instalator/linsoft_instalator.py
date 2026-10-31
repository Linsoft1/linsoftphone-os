#!/usr/bin/env python3
"""LinsoftPhone Installer - zapise obraz LinsoftPhone OS na USB kluc / SD kartu
alebo pripravi subor linsoftPhone.img pre virtualny stroj.

  * stiahne najnovsi obraz z GitHub Releases (alebo pouzije vlastny .img / .img.xz)
  * overi kontrolny sucet SHA256
  * ponukne iba vymenitelne disky (USB, SD) - nikdy systemovy disk
  * pred zapisom dvakrat potvrdi, ze sa disk cely zmaze

Spustenie: python linsoft_instalator.py   (okno)
           python linsoft_instalator.py --help   (prikazovy riadok)
Zapis na disk potrebuje spravcu (Windows: spustit ako spravca, Linux: sudo).
Iba standardna kniznica Pythonu 3.8+. (c) 2026 Linsoft
"""
import argparse
import hashlib
import json
import lzma
import os
import platform
import subprocess
import sys
import threading
import urllib.request

VERZIA = "1.0"
REPO = "Linsoft1/linsoftphone-os"
API_VYDANIE = "https://api.github.com/repos/%s/releases/latest" % REPO
NAZOV_IMG = "linsoftPhone.img"
BLOK = 4 * 1024 * 1024
SEKTOR = 512
MAX_DISK = 256 * 1024 ** 3   # vacsi "vymenitelny" disk je skor externy SSD so zalohami - radsej nie


# ---------------- obraz: stiahnutie, kontrola, rozbalenie ----------------

def najdi_obraz(vydanie):
    """Z JSON vydania GitHubu vyberie obraz (.img.xz) a SHA256SUMS: (url_obrazu, nazov, url_suctov)."""
    obraz = sucty = None
    for a in vydanie.get("assets", []):
        if a.get("name", "").endswith(".img.xz") and obraz is None:
            obraz = a
        elif a.get("name") == "SHA256SUMS":
            sucty = a
    if not obraz:
        raise RuntimeError("vo vydani nie je obraz .img.xz")
    return obraz["browser_download_url"], obraz["name"], sucty["browser_download_url"] if sucty else None


def ocakavany_sucet(text_suctov, nazov):
    """Z obsahu SHA256SUMS ('<sucet>  <subor>') vrati sucet pre dany subor."""
    for riadok in text_suctov.splitlines():
        casti = riadok.split()
        if len(casti) == 2 and casti[1].lstrip("*") == nazov and len(casti[0]) == 64:
            return casti[0].lower()
    return None


def stiahni(url, cil, priebeh=None):
    req = urllib.request.Request(url, headers={"User-Agent": "LinsoftPhone-Installer/" + VERZIA})
    with urllib.request.urlopen(req, timeout=60) as r, open(cil, "wb") as f:
        celkom = int(r.headers.get("Content-Length") or 0)
        hotovo = 0
        while True:
            kus = r.read(BLOK)
            if not kus:
                break
            f.write(kus)
            hotovo += len(kus)
            if priebeh:
                priebeh(hotovo, celkom)
    return cil


def sha256(cesta, priebeh=None):
    h = hashlib.sha256()
    celkom, hotovo = os.path.getsize(cesta), 0
    with open(cesta, "rb") as f:
        for kus in iter(lambda: f.read(BLOK), b""):
            h.update(kus)
            hotovo += len(kus)
            if priebeh:
                priebeh(hotovo, celkom)
    return h.hexdigest()


def otvor_obraz(cesta):
    """Otvori .img alebo .img.xz na citanie (xz sa rozbaluje priebezne)."""
    return lzma.open(cesta, "rb") if cesta.lower().endswith(".xz") else open(cesta, "rb")


def velkost_obrazu(cesta):
    """Velkost rozbaleneho obrazu (pri .xz z indexu archivu, bez rozbalovania)."""
    if not cesta.lower().endswith(".xz"):
        return os.path.getsize(cesta)
    with open(cesta, "rb") as f:
        f.seek(-12, 2)
        patka = f.read(12)
        if patka[10:12] != b"YZ":
            return None
        velkost_indexu = (int.from_bytes(patka[4:8], "little") + 1) * 4
        f.seek(-12 - velkost_indexu, 2)
        index = f.read(velkost_indexu)
    try:
        pozicia, pocet = 1, 0
        pocet, pozicia = _vli(index, pozicia)
        spolu = 0
        for _ in range(pocet):
            _, pozicia = _vli(index, pozicia)         # velkost bloku v archive
            rozbalene, pozicia = _vli(index, pozicia)
            spolu += rozbalene
        return spolu
    except IndexError:
        return None


def _vli(data, i):
    """Cislo s premenlivou dlzkou z indexu xz."""
    hodnota, posun = 0, 0
    while True:
        b = data[i]
        i += 1
        hodnota |= (b & 0x7F) << posun
        posun += 7
        if not b & 0x80:
            return hodnota, i


def zapis(obraz, cil, priebeh=None, zrusit=None):
    """Zapise obraz (.img / .img.xz) na cielove zariadenie alebo do suboru.
    Zapisuje po blokoch zarovnanych na sektor (512 B), na konci vyprazdni cache."""
    celkom = velkost_obrazu(obraz) or 0
    hotovo = 0
    zariadenie = cil.startswith("\\\\.\\") or cil.startswith("/dev/")
    with otvor_obraz(obraz) as zdroj, open(cil, "r+b" if zariadenie else "wb", buffering=0) as ciel:
        while True:
            if zrusit and zrusit():
                raise RuntimeError("zapis zruseny")
            kus = zdroj.read(BLOK)
            if not kus:
                break
            if len(kus) % SEKTOR:
                kus += b"\0" * (SEKTOR - len(kus) % SEKTOR)   # disk prijima iba cele sektory
            ciel.write(kus)
            hotovo += len(kus)
            if priebeh:
                priebeh(hotovo, celkom)
        ciel.flush()
        os.fsync(ciel.fileno())
    return hotovo


# ---------------- disky: iba vymenitelne, nikdy systemovy ----------------

def filtruj_windows(data):
    """Z vystupu Get-Disk (JSON) vyberie vymenitelne disky (USB, SD), nie systemove ani bootovacie."""
    if isinstance(data, dict):
        data = [data]
    disky = []
    for d in data or []:
        if d.get("IsSystem") or d.get("IsBoot"):
            continue
        if str(d.get("BusType")) not in ("USB", "SD", "MMC", "7", "12", "13"):
            continue
        velkost = int(d.get("Size") or 0)
        if not 0 < velkost <= MAX_DISK:
            continue
        disky.append({"cesta": "\\\\.\\PhysicalDrive%d" % int(d["Number"]), "cislo": int(d["Number"]),
                      "nazov": (d.get("FriendlyName") or "Disk %s" % d["Number"]).strip(), "velkost": velkost})
    return disky


def filtruj_linux(data):
    """Z vystupu lsblk -J vyberie vymenitelne disky bez pripojeneho systemu (/, /boot, /home)."""
    disky = []
    for d in (data or {}).get("blockdevices", []):
        if d.get("type") != "disk":
            continue
        vymenitelny = d.get("rm") in (True, "1", 1) or d.get("tran") in ("usb", "mmc")
        body = []
        for x in [d] + d.get("children", []):
            body += [m for m in (x.get("mountpoints") or [x.get("mountpoint")]) if m]
        systemovy = any(m in ("/", "/boot", "/boot/efi", "/home", "[SWAP]") for m in body)
        velkost = int(d.get("size") or 0)
        if vymenitelny and not systemovy and 0 < velkost <= MAX_DISK:
            disky.append({"cesta": "/dev/" + d["name"], "cislo": None,
                          "nazov": (d.get("model") or d["name"]).strip(), "velkost": velkost})
    return disky


def najdi_disky():
    if platform.system() == "Windows":
        vystup = subprocess.run(["powershell", "-NoProfile", "-Command",
                                 "Get-Disk | Select-Object Number,FriendlyName,Size,BusType,IsBoot,IsSystem | ConvertTo-Json"],
                                capture_output=True, text=True, timeout=60).stdout
        return filtruj_windows(json.loads(vystup) if vystup.strip() else [])
    vystup = subprocess.run(["lsblk", "-J", "-b", "-o", "NAME,SIZE,MODEL,RM,TRAN,TYPE,MOUNTPOINTS"],
                            capture_output=True, text=True, timeout=30).stdout
    return filtruj_linux(json.loads(vystup) if vystup.strip() else {})


def je_spravca():
    if platform.system() == "Windows":
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    return os.geteuid() == 0


def priprav_disk(disk):
    """Pred zapisom: Windows - diskpart 'clean' (odpoji a zmaze oddiely, inak Windows zapis zablokuje),
    Linux - odpojenie oddielov."""
    if platform.system() == "Windows":
        skript = "select disk %d\nclean\nrescan\n" % disk["cislo"]
        r = subprocess.run(["diskpart"], input=skript, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            raise RuntimeError("diskpart zlyhal: " + (r.stdout + r.stderr)[-300:])
    else:
        subprocess.run("lsblk -ln -o PATH %s | tail -n +2 | xargs -r -n1 umount" % disk["cesta"],
                       shell=True, capture_output=True, timeout=60)


def citatelne(b):
    for jednotka in ("B", "KB", "MB", "GB", "TB"):
        if b < 1024 or jednotka == "TB":
            return ("%.1f %s" % (b, jednotka)).replace(".0 ", " ")
        b /= 1024.0


# ---------------- ziskanie obrazu (spolocne pre okno aj prikazovy riadok) ----------------

def ziskaj_obraz(adresar, sprava, priebeh):
    """Stiahne najnovsi obraz z GitHubu do adresara a overi SHA256. Vrati cestu k .img.xz."""
    sprava("Hľadám najnovšie vydanie LinsoftPhone OS…")
    req = urllib.request.Request(API_VYDANIE, headers={"User-Agent": "LinsoftPhone-Installer/" + VERZIA,
                                                       "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        vydanie = json.load(r)
    url, nazov, url_suctov = najdi_obraz(vydanie)
    cesta = os.path.join(adresar, nazov)
    sprava("Sťahujem %s (%s)…" % (nazov, vydanie.get("tag_name", "")))
    stiahni(url, cesta, priebeh)
    if url_suctov:
        sprava("Overujem kontrolný súčet SHA256…")
        with urllib.request.urlopen(url_suctov, timeout=30) as r:
            ocakavany = ocakavany_sucet(r.read().decode(), nazov)
        if ocakavany and sha256(cesta, priebeh) != ocakavany:
            raise RuntimeError("kontrolný súčet nesedí - súbor je poškodený, stiahni ho znova")
    return cesta


# ---------------- okno (tkinter) ----------------

def okno():
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    PREPOZADIE, PANEL, TEXT, TLMENY, MODRA = "#0b1220", "#141d33", "#eef2fb", "#93a1bd", "#5b6cf0"
    hl = tk.Tk()
    hl.title("LinsoftPhone Installer")
    hl.geometry("560x520")
    hl.configure(bg=PREPOZADIE)
    hl.resizable(False, False)
    styl = ttk.Style()
    styl.theme_use("clam")
    styl.configure("TProgressbar", troughcolor=PANEL, background=MODRA, bordercolor=PANEL, lightcolor=MODRA, darkcolor=MODRA)

    stav = {"obraz": None, "disky": [], "bezi": False}
    lbl = lambda rodic, text, **k: tk.Label(rodic, text=text, bg=k.pop("bg", PREPOZADIE), fg=k.pop("fg", TEXT),
                                            font=k.pop("font", ("Segoe UI", 10)), **k)
    tl = lambda rodic, text, prikaz, hlavne=False: tk.Button(
        rodic, text=text, command=prikaz, relief="flat", cursor="hand2", padx=14, pady=7,
        bg=MODRA if hlavne else PANEL, fg="#ffffff" if hlavne else TEXT, activebackground="#7b3fe4",
        activeforeground="#fff", font=("Segoe UI", 10, "bold" if hlavne else "normal"))

    lbl(hl, "LinsoftPhone Installer", font=("Segoe UI", 20, "bold")).pack(pady=(22, 0))
    lbl(hl, "verzia %s · © 2026 Linsoft" % VERZIA, fg=TLMENY).pack()

    # 1. obraz
    r1 = tk.Frame(hl, bg=PANEL, padx=16, pady=12)
    r1.pack(fill="x", padx=22, pady=(20, 8))
    lbl(r1, "1. Obraz systému", bg=PANEL, font=("Segoe UI", 11, "bold")).pack(anchor="w")
    obraz_txt = lbl(r1, "zatiaľ nevybraný", bg=PANEL, fg=TLMENY)
    obraz_txt.pack(anchor="w", pady=(2, 8))
    r1b = tk.Frame(r1, bg=PANEL)
    r1b.pack(anchor="w")

    # 2. ciel
    r2 = tk.Frame(hl, bg=PANEL, padx=16, pady=12)
    r2.pack(fill="x", padx=22, pady=8)
    lbl(r2, "2. Kam zapísať", bg=PANEL, font=("Segoe UI", 11, "bold")).pack(anchor="w")
    volba = tk.StringVar(value="subor")
    tk.Radiobutton(r2, text="Pripraviť súbor %s (VirtualBox / QEMU)" % NAZOV_IMG, variable=volba, value="subor",
                   bg=PANEL, fg=TEXT, selectcolor=PREPOZADIE, activebackground=PANEL, activeforeground=TEXT).pack(anchor="w")
    tk.Radiobutton(r2, text="USB kľúč / SD karta (disk sa celý zmaže)", variable=volba, value="disk",
                   bg=PANEL, fg=TEXT, selectcolor=PREPOZADIE, activebackground=PANEL, activeforeground=TEXT).pack(anchor="w")
    disk_box = ttk.Combobox(r2, state="readonly", width=56)
    disk_box.pack(anchor="w", pady=(6, 0))

    # 3. priebeh
    pruh = ttk.Progressbar(hl, length=516, mode="determinate", style="TProgressbar")
    pruh.pack(padx=22, pady=(14, 4))
    sprava_txt = lbl(hl, "", fg=TLMENY, wraplength=516, justify="left")
    sprava_txt.pack(padx=22, anchor="w")

    def sprava(t):
        hl.after(0, lambda: sprava_txt.config(text=t))

    def priebeh(hotovo, celkom):
        hl.after(0, lambda: pruh.config(value=100.0 * hotovo / celkom if celkom else 0))

    def nastav_obraz(cesta):
        stav["obraz"] = cesta
        obraz_txt.config(text="%s  (%s po rozbalení)" % (os.path.basename(cesta), citatelne(velkost_obrazu(cesta) or 0)), fg=TEXT)

    def na_pozadi(praca, hotovo_msg):
        if stav["bezi"]:
            return
        stav["bezi"] = True

        def beh():
            try:
                vysledok = praca()
                sprava(hotovo_msg if not callable(hotovo_msg) else hotovo_msg(vysledok))
            except Exception as e:
                sprava("Chyba: %s" % e)
                hl.after(0, lambda: messagebox.showerror("LinsoftPhone Installer", str(e)))
            finally:
                stav["bezi"] = False
        threading.Thread(target=beh, daemon=True).start()

    def stiahnut():
        adresar = filedialog.askdirectory(title="Kam uložiť stiahnutý obraz?")
        if not adresar:
            return

        def praca():
            cesta = ziskaj_obraz(adresar, sprava, priebeh)
            hl.after(0, lambda: nastav_obraz(cesta))
            return cesta
        na_pozadi(praca, "Obraz stiahnutý a overený.")

    def vybrat():
        cesta = filedialog.askopenfilename(title="Vyber obraz", filetypes=[("Obraz LinsoftPhone OS", "*.img *.img.xz"), ("Všetko", "*.*")])
        if cesta:
            nastav_obraz(cesta)

    tl(r1b, "Stiahnuť najnovší", stiahnut, True).pack(side="left")
    tl(r1b, "Vybrať súbor…", vybrat).pack(side="left", padx=8)

    def obnov_disky():
        try:
            stav["disky"] = najdi_disky()
        except Exception as e:
            stav["disky"] = []
            sprava("Disky sa nepodarilo načítať: %s" % e)
        disk_box["values"] = ["%s — %s" % (d["nazov"], citatelne(d["velkost"])) for d in stav["disky"]] or ["(nenašiel sa žiadny USB kľúč ani SD karta)"]
        disk_box.current(0)
    obnov_disky()

    def spustit():
        if not stav["obraz"]:
            return messagebox.showwarning("LinsoftPhone Installer", "Najprv stiahni alebo vyber obraz.")
        if volba.get() == "subor":
            ciel = filedialog.asksaveasfilename(title="Uložiť ako", initialfile=NAZOV_IMG, defaultextension=".img")
            if not ciel:
                return
            sprava("Rozbaľujem do %s…" % ciel)
            na_pozadi(lambda: zapis(stav["obraz"], ciel, priebeh),
                      "Hotovo: %s je pripravený. Spusti ho vo VirtualBoxe alebo v QEMU." % ciel)
            return
        if not stav["disky"]:
            return messagebox.showwarning("LinsoftPhone Installer", "Pripoj USB kľúč alebo SD kartu a skús znova.")
        if not je_spravca():
            return messagebox.showwarning("LinsoftPhone Installer", "Zápis na disk potrebuje správcu: spusti inštalátor ako správca (Windows) alebo cez sudo (Linux).")
        d = stav["disky"][disk_box.current()]
        if not messagebox.askyesno("Zmazať disk?", "Disk „%s“ (%s) sa CELÝ ZMAŽE a zapíše sa naň LinsoftPhone OS.\n\nPokračovať?" % (d["nazov"], citatelne(d["velkost"])), icon="warning"):
            return
        if not messagebox.askyesno("Naozaj?", "Posledná otázka: všetky dáta na „%s“ budú nenávratne stratené. Zapísať?" % d["nazov"], icon="warning"):
            return

        def praca():
            sprava("Pripravujem disk…")
            priprav_disk(d)
            sprava("Zapisujem LinsoftPhone OS na %s…" % d["nazov"])
            return zapis(stav["obraz"], d["cesta"], priebeh)
        na_pozadi(praca, "Hotovo! LinsoftPhone OS je na „%s“. Disk môžeš bezpečne odpojiť." % d["nazov"])

    spodok = tk.Frame(hl, bg=PREPOZADIE)
    spodok.pack(side="bottom", fill="x", padx=22, pady=18)
    tl(spodok, "Obnoviť disky", obnov_disky).pack(side="left")
    tl(spodok, "Zapísať", spustit, True).pack(side="right")
    hl.mainloop()


# ---------------- prikazovy riadok ----------------

def hlavny(argv=None):
    p = argparse.ArgumentParser(description="LinsoftPhone Installer %s - zapise LinsoftPhone OS na USB/SD alebo do %s." % (VERZIA, NAZOV_IMG))
    p.add_argument("--obraz", help="vlastny obraz .img alebo .img.xz (inak sa stiahne najnovsi)")
    p.add_argument("--subor", metavar="CESTA", help="len rozbalit do suboru (napr. %s)" % NAZOV_IMG)
    p.add_argument("--disky", action="store_true", help="vypisat vymenitelne disky")
    p.add_argument("--disk", help="zapisat na disk (cesta z --disky, napr. \\\\.\\PhysicalDrive2 alebo /dev/sdb)")
    p.add_argument("--ano", action="store_true", help="potvrdit zmazanie disku bez otazky")
    a = p.parse_args(argv)
    if not any([a.obraz, a.subor, a.disky, a.disk]):
        return okno()
    # konzola Windows nemusi byt v UTF-8 - diakritika by sa rozbila
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    pis = lambda t: print(t, flush=True)
    ukaz = lambda hotovo, celkom: print("\r  %5.1f %%" % (100.0 * hotovo / celkom if celkom else 0), end="", flush=True)
    if a.disky:
        for d in najdi_disky():
            pis("%-24s %-30s %s" % (d["cesta"], d["nazov"], citatelne(d["velkost"])))
        return 0
    obraz = a.obraz or ziskaj_obraz(os.getcwd(), pis, ukaz)
    print()
    if a.subor:
        pis("Rozbaľujem do %s…" % a.subor)
        zapis(obraz, a.subor, ukaz)
        pis("\nHotovo: %s" % a.subor)
        return 0
    if a.disk:
        disk = next((d for d in najdi_disky() if d["cesta"] == a.disk), None)
        if not disk:
            sys.exit("Disk %s nie je vymeniteľný disk zo zoznamu --disky. Zápis odmietnutý." % a.disk)
        if not je_spravca():
            sys.exit("Zápis na disk potrebuje správcu (Windows: ako správca, Linux: sudo).")
        if not a.ano and input("Disk %s (%s, %s) sa CELÝ ZMAŽE. Napíš ZMAZAT pre pokračovanie: " % (
                disk["cesta"], disk["nazov"], citatelne(disk["velkost"]))).strip() != "ZMAZAT":
            sys.exit("Zrušené.")
        priprav_disk(disk)
        zapis(obraz, disk["cesta"], ukaz)
        pis("\nHotovo! LinsoftPhone OS je na %s." % disk["nazov"])
    return 0


if __name__ == "__main__":
    sys.exit(hlavny())
