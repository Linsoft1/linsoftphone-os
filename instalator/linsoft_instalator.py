#!/usr/bin/env python3
"""LinsoftPhone Installer - nahra LinsoftPhone OS priamo do telefonu (fastboot),
zapise obraz na USB kluc / SD kartu alebo pripravi subor linsoftPhone.img.

  * stiahne najnovsi obraz pre zvolene zariadenie z GitHub Releases
    (alebo pouzije vlastny .img / .img.xz)
  * overi kontrolny sucet SHA256
  * telefon: nahra system cez USB kabel (fastboot), fastboot si stiahne sam
  * ponukne iba vymenitelne disky (USB, SD) - nikdy systemovy disk
  * pred zapisom dvakrat potvrdi, ze sa telefon / disk cely zmaze

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
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.request
import zipfile

VERZIA = "1.1"
REPO = "Linsoft1/linsoftphone-os"
API_VYDANIE = "https://api.github.com/repos/%s/releases/latest" % REPO
NAZOV_IMG = "linsoftPhone.img"
BLOK = 4 * 1024 * 1024
SEKTOR = 512
MAX_DISK = 256 * 1024 ** 3   # vacsi "vymenitelny" disk je skor externy SSD so zalohami - radsej nie

# Zariadenia, pre ktore vydanie obsahuje hotovy obraz. Subory vo vydani:
#   linsoftphone-os-<verzia>-<id>.img.xz      system (pri fastboot telefonoch oddiel rootfs)
#   linsoftphone-os-<verzia>-<id>-boot.img    jadro (iba fastboot telefony)
# sposob: "fastboot" = telefon cez USB kabel, "sd" = obraz na SD kartu, "pc" = pocitac / virtualny stroj
# rootfs / boot: oddiely telefonu podla deviceinfo postmarketOS, vymaz: oddiely, ktore treba vyprazdnit
ZARIADENIA = [
    {"id": "qemu-amd64", "nazov": "Počítač / virtuálny stroj (x86-64)", "sposob": "pc"},
    {"id": "oneplus-enchilada", "nazov": "OnePlus 6", "sposob": "fastboot", "rootfs": "userdata", "boot": "boot", "vymaz": ["dtbo"]},
    {"id": "oneplus-fajita", "nazov": "OnePlus 6T", "sposob": "fastboot", "rootfs": "userdata", "boot": "boot", "vymaz": ["dtbo"]},
    {"id": "pine64-pinephone", "nazov": "PINE64 PinePhone (SD karta)", "sposob": "sd"},
]
PLATFORM_TOOLS = "https://dl.google.com/android/repository/platform-tools-latest-%s.zip"


def zariadenie(id_):
    for z in ZARIADENIA:
        if z["id"] == id_:
            return z
    raise RuntimeError("neznáme zariadenie %s (pozri --zariadenia)" % id_)


# ---------------- obraz: stiahnutie, kontrola, rozbalenie ----------------

def najdi_obraz(vydanie, id_="qemu-amd64"):
    """Z JSON vydania GitHubu vyberie obraz zariadenia (.img.xz), jeho boot.img (ak je) a SHA256SUMS:
    (url_obrazu, nazov, url_suctov, url_boot, nazov_boot)."""
    obraz = boot = sucty = None
    for a in vydanie.get("assets", []):
        meno = a.get("name", "")
        if meno.endswith("-%s.img.xz" % id_):
            obraz = a
        elif meno.endswith("-%s-boot.img" % id_):
            boot = a
        elif meno == "SHA256SUMS":
            sucty = a
    if not obraz:
        raise RuntimeError("vo vydaní nie je obraz pre zariadenie %s" % id_)
    return (obraz["browser_download_url"], obraz["name"], sucty["browser_download_url"] if sucty else None,
            boot["browser_download_url"] if boot else None, boot["name"] if boot else None)


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

def ziskaj_obraz(adresar, sprava, priebeh, id_="qemu-amd64"):
    """Stiahne najnovsi obraz zariadenia z GitHubu do adresara a overi SHA256.
    Vrati cestu k .img.xz (boot.img fastboot telefonu sa ulozi vedla neho, pozri boot_k_obrazu)."""
    sprava("Hľadám najnovšie vydanie LinsoftPhone OS…")
    req = urllib.request.Request(API_VYDANIE, headers={"User-Agent": "LinsoftPhone-Installer/" + VERZIA,
                                                       "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        vydanie = json.load(r)
    url, nazov, url_suctov, url_boot, nazov_boot = najdi_obraz(vydanie, id_)
    subory = [(url, nazov)] + ([(url_boot, nazov_boot)] if url_boot else [])
    text_suctov = None
    if url_suctov:
        with urllib.request.urlopen(url_suctov, timeout=30) as r:
            text_suctov = r.read().decode()
    for u, n in subory:
        cesta = os.path.join(adresar, n)
        sprava("Sťahujem %s (%s)…" % (n, vydanie.get("tag_name", "")))
        stiahni(u, cesta, priebeh)
        ocakavany = ocakavany_sucet(text_suctov or "", n)
        if ocakavany:
            sprava("Overujem kontrolný súčet SHA256…")
            if sha256(cesta, priebeh) != ocakavany:
                raise RuntimeError("kontrolný súčet %s nesedí - súbor je poškodený, stiahni ho znova" % n)
    return os.path.join(adresar, nazov)


def boot_k_obrazu(obraz):
    """K obrazu ...-<id>.img(.xz) vrati cestu k ...-<id>-boot.img vedla neho (alebo None)."""
    zaklad = obraz[:-3] if obraz.lower().endswith(".xz") else obraz
    boot = zaklad[:-4] + "-boot.img" if zaklad.lower().endswith(".img") else None
    return boot if boot and os.path.isfile(boot) else None


def id_z_obrazu(obraz):
    """Zariadenie podla nazvu obrazu (linsoftphone-os-2.4-oneplus-enchilada.img.xz -> oneplus-enchilada)."""
    meno = os.path.basename(obraz).lower()
    for z in sorted(ZARIADENIA, key=lambda z: -len(z["id"])):
        if meno.endswith("-%s.img.xz" % z["id"]) or meno.endswith("-%s.img" % z["id"]):
            return z["id"]
    return None


# ---------------- telefon: nahratie cez fastboot ----------------

def najdi_fastboot(adresar_nastrojov=None, sprava=print):
    """Cesta k fastboot: zo systemu, z predtym stiahnutych platform-tools, inak ich stiahne od Google."""
    cesta = shutil.which("fastboot")
    if cesta:
        return cesta
    adresar_nastrojov = adresar_nastrojov or os.path.join(os.path.expanduser("~"), ".linsoftphone")
    exe = os.path.join(adresar_nastrojov, "platform-tools", "fastboot" + (".exe" if platform.system() == "Windows" else ""))
    if not os.path.isfile(exe):
        system = {"Windows": "windows", "Darwin": "darwin"}.get(platform.system(), "linux")
        os.makedirs(adresar_nastrojov, exist_ok=True)
        archiv = os.path.join(adresar_nastrojov, "platform-tools.zip")
        sprava("Sťahujem fastboot (Android platform-tools od Google)…")
        stiahni(PLATFORM_TOOLS % system, archiv)
        with zipfile.ZipFile(archiv) as z:
            z.extractall(adresar_nastrojov)
        os.remove(archiv)
        if system != "windows":
            os.chmod(exe, 0o755)
    return exe


def fastboot_telefony(fastboot):
    """Seriove cisla telefonov v rezime fastboot."""
    r = subprocess.run([fastboot, "devices"], capture_output=True, text=True, timeout=30)
    return [riadok.split()[0] for riadok in r.stdout.splitlines() if riadok.strip().endswith("fastboot")]


def prikazy_nahratia(z, rootfs, boot):
    """Prikazy fastboot na nahratie systemu do telefonu (bez cesty k fastboot)."""
    prikazy = [["flash", z["rootfs"], rootfs], ["flash", z["boot"], boot]]
    prikazy += [["erase", oddiel] for oddiel in z.get("vymaz", [])]
    return prikazy + [["reboot"]]


def nahraj_do_telefonu(fastboot, z, obraz, boot, sprava, priebeh=None, seriove=None):
    """Nahra LinsoftPhone OS do telefonu v rezime fastboot. Obraz .xz najprv rozbali do docasneho suboru."""
    docasny = None
    try:
        rootfs = obraz
        if obraz.lower().endswith(".xz"):
            docasny = tempfile.NamedTemporaryFile(suffix=".img", delete=False)
            docasny.close()
            rootfs = docasny.name
            sprava("Rozbaľujem obraz systému…")
            zapis(obraz, rootfs, priebeh)
        zaklad = [fastboot] + (["-s", seriove] if seriove else [])
        kroky = prikazy_nahratia(z, rootfs, boot)
        for i, prikaz in enumerate(kroky):
            sprava({"flash": "Nahrávam oddiel %s (%d/%d)…", "erase": "Vymazávam oddiel %s (%d/%d)…",
                    "reboot": "Reštartujem telefón%s (%d/%d)…"}[prikaz[0]]
                   % ((prikaz[1] if len(prikaz) > 1 else ""), i + 1, len(kroky)))
            if priebeh:
                priebeh(i, len(kroky))
            r = subprocess.run(zaklad + prikaz, capture_output=True, text=True, timeout=3600)
            if r.returncode != 0:
                raise RuntimeError("fastboot %s zlyhal: %s" % (" ".join(prikaz[:2]), (r.stdout + r.stderr).strip()[-400:]))
        if priebeh:
            priebeh(1, 1)
    finally:
        if docasny:
            os.remove(docasny.name)


# ---------------- okno (tkinter) ----------------

def okno():
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    PREPOZADIE, PANEL, TEXT, TLMENY, MODRA = "#0b1220", "#141d33", "#eef2fb", "#93a1bd", "#5b6cf0"
    hl = tk.Tk()
    hl.title("LinsoftPhone Installer")
    hl.geometry("560x620")
    hl.configure(bg=PREPOZADIE)
    hl.resizable(False, False)
    styl = ttk.Style()
    styl.theme_use("clam")
    styl.configure("TProgressbar", troughcolor=PANEL, background=MODRA, bordercolor=PANEL, lightcolor=MODRA, darkcolor=MODRA)

    stav = {"obraz": None, "boot": None, "disky": [], "bezi": False}
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
    lbl(r1, "1. Zariadenie a obraz systému", bg=PANEL, font=("Segoe UI", 11, "bold")).pack(anchor="w")
    zar_box = ttk.Combobox(r1, state="readonly", width=56, values=[z["nazov"] for z in ZARIADENIA])
    zar_box.current(0)
    zar_box.pack(anchor="w", pady=(6, 0))
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
    tk.Radiobutton(r2, text="Telefón cez USB kábel – fastboot (Android sa zmaže)", variable=volba, value="telefon",
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
        stav["boot"] = boot_k_obrazu(cesta)
        id_ = id_z_obrazu(cesta)
        if id_:
            zar_box.current([z["id"] for z in ZARIADENIA].index(id_))
            if zariadenie(id_)["sposob"] == "fastboot":
                volba.set("telefon")
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

        id_ = ZARIADENIA[zar_box.current()]["id"]

        def praca():
            cesta = ziskaj_obraz(adresar, sprava, priebeh, id_)
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
        if volba.get() == "telefon":
            return nahrat_telefon()
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

    def nahrat_telefon():
        z = ZARIADENIA[zar_box.current()]
        if z["sposob"] != "fastboot":
            return messagebox.showwarning("LinsoftPhone Installer", "„%s“ sa nenahráva cez USB kábel. Vyber telefón zo zoznamu (napr. OnePlus 6), alebo zvoľ USB kľúč / SD kartu." % z["nazov"])
        if id_z_obrazu(stav["obraz"]) != z["id"] or not stav["boot"]:
            return messagebox.showwarning("LinsoftPhone Installer", "Vybraný obraz nie je pre %s. Zvoľ telefón a klikni „Stiahnuť najnovší“." % z["nazov"])
        if not messagebox.askyesno("Nahrať do telefónu?", (
                "Telefón %s sa CELÝ ZMAŽE (Android, fotky, aplikácie) a nahrá sa doň LinsoftPhone OS.\n\n"
                "Predtým:\n• odomkni bootloader (návod na wiki postmarketOS pri tvojom modeli)\n"
                "• vypni telefón, drž Hlasitosť + a zapni ho – naštartuje do režimu fastboot\n"
                "• pripoj ho USB káblom k počítaču\n\nPokračovať?") % z["nazov"], icon="warning"):
            return
        if not messagebox.askyesno("Naozaj?", "Posledná otázka: všetky dáta v telefóne budú nenávratne stratené. Nahrať?", icon="warning"):
            return

        def praca():
            fastboot = najdi_fastboot(sprava=sprava)
            telefony = fastboot_telefony(fastboot)
            if not telefony:
                raise RuntimeError("Nenašiel sa žiadny telefón v režime fastboot. Skontroluj kábel a režim fastboot"
                                   " (na Windows aj ovládač „Google USB Driver“).")
            if len(telefony) > 1:
                raise RuntimeError("Pripojených je viac telefónov - nechaj pripojený iba jeden.")
            nahraj_do_telefonu(fastboot, z, stav["obraz"], stav["boot"], sprava, priebeh, telefony[0])
        na_pozadi(praca, "Hotovo! Telefón sa reštartuje do LinsoftPhone OS (prvé spustenie trvá dlhšie).")

    spodok = tk.Frame(hl, bg=PREPOZADIE)
    spodok.pack(side="bottom", fill="x", padx=22, pady=18)
    tl(spodok, "Obnoviť disky", obnov_disky).pack(side="left")
    tl(spodok, "Zapísať", spustit, True).pack(side="right")
    hl.mainloop()


# ---------------- prikazovy riadok ----------------

def hlavny(argv=None):
    p = argparse.ArgumentParser(description="LinsoftPhone Installer %s - nahra LinsoftPhone OS do telefonu (fastboot), na USB/SD alebo do %s." % (VERZIA, NAZOV_IMG))
    p.add_argument("--obraz", help="vlastny obraz .img alebo .img.xz (inak sa stiahne najnovsi)")
    p.add_argument("--subor", metavar="CESTA", help="len rozbalit do suboru (napr. %s)" % NAZOV_IMG)
    p.add_argument("--disky", action="store_true", help="vypisat vymenitelne disky")
    p.add_argument("--disk", help="zapisat na disk (cesta z --disky, napr. \\\\.\\PhysicalDrive2 alebo /dev/sdb)")
    p.add_argument("--zariadenie", default="qemu-amd64", help="pre ktore zariadenie stiahnut obraz (zoznam: --zariadenia)")
    p.add_argument("--zariadenia", action="store_true", help="vypisat zariadenia s hotovym obrazom")
    p.add_argument("--telefon", action="store_true", help="nahrat do telefonu v rezime fastboot (zariadenie z --zariadenie)")
    p.add_argument("--ano", action="store_true", help="potvrdit zmazanie disku / telefonu bez otazky")
    a = p.parse_args(argv)
    if not any([a.obraz, a.subor, a.disky, a.disk, a.zariadenia, a.telefon]):
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
    if a.zariadenia:
        for z in ZARIADENIA:
            pis("%-20s %-10s %s" % (z["id"], z["sposob"], z["nazov"]))
        return 0
    z = zariadenie(a.zariadenie)
    if a.telefon and z["sposob"] != "fastboot":
        sys.exit("%s sa nenahráva cez fastboot (pozri --zariadenia)." % z["nazov"])
    if a.telefon:
        fastboot = najdi_fastboot(sprava=pis)   # skor nez sa stiahnu stovky MB
        telefony = fastboot_telefony(fastboot)
        if len(telefony) != 1:
            sys.exit("Pripoj práve jeden telefón v režime fastboot (nájdené: %d)." % len(telefony))
    obraz = a.obraz or ziskaj_obraz(os.getcwd(), pis, ukaz, z["id"])
    print()
    if a.telefon:
        boot = boot_k_obrazu(obraz)
        if not boot:
            sys.exit("Vedľa obrazu chýba %s-boot.img." % os.path.basename(obraz).split(".img")[0])
        if not a.ano and input("Telefón %s (%s) sa CELÝ ZMAŽE. Napíš ZMAZAT pre pokračovanie: " % (
                z["nazov"], telefony[0])).strip() != "ZMAZAT":
            sys.exit("Zrušené.")
        nahraj_do_telefonu(fastboot, z, obraz, boot, lambda t: pis("\n" + t), ukaz, telefony[0])
        pis("\nHotovo! Telefón sa reštartuje do LinsoftPhone OS.")
        return 0
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
