#!/usr/bin/env python3
"""LinsoftPhone OS - lokalni sluzba pro skutecny telefon (postmarketOS).

Servíruje rozhrani LinsoftPhone OS (PWA) a pres HTTP API na 127.0.0.1
zpristupnuje hardware telefonu:
  hovory a SMS  -> ModemManager (mmcli)
  Wi-Fi         -> NetworkManager (nmcli)
  baterie, jas  -> /sys/class/power_supply, /sys/class/backlight
  vypnuti       -> poweroff / reboot

Bez modemu nebo na pocitaci (LINSOFT_DEMO=1) bezi v ukazkovem rezimu
s vymyslenymi daty, aby slo rozhrani vyzkouset.

Pouze standardni knihovna Pythonu.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERZE = "2.4"
START = time.time()
PORT = int(os.environ.get("LINSOFT_PORT", "8640"))
WWW = os.environ.get("LINSOFT_WWW", "/usr/share/linsoftphone-os/www")
DEMO = os.environ.get("LINSOFT_DEMO") == "1" or shutil.which("mmcli") is None
POVOLENE_HOSTY = {"127.0.0.1:%d" % PORT, "localhost:%d" % PORT}


# ---------------- pomocne funkce ----------------

def spust(prikaz, vstup=None, casovac=15):
    """Spusti prikaz (seznam argumentu, bez shellu) a vrati stdout."""
    r = subprocess.run(prikaz, input=vstup, capture_output=True, text=True, timeout=casovac)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip() or "prikaz selhal")
    return r.stdout


def mmcli_json(*argumenty):
    return json.loads(spust(["mmcli", "-J"] + list(argumenty)))


def cti_soubor(cesta, vychozi=None):
    try:
        with open(cesta) as f:
            return f.read().strip()
    except OSError:
        return vychozi


def cislo_ok(cislo):
    """Telefonni cislo: jen cislice, +, *, # (nic, co by slo zneuzit v argumentech)."""
    return isinstance(cislo, str) and re.fullmatch(r"\+?[0-9*#]{1,20}", cislo) is not None


def text_sms(text):
    """mmcli bere text ve tvaru text='...'; apostrof by ho ukoncil."""
    return str(text).replace("'", "’")[:640]


# ---------------- baterie, jas ----------------

def baterie():
    for d in glob.glob("/sys/class/power_supply/*"):
        if cti_soubor(d + "/type") == "Battery":
            uroven = cti_soubor(d + "/capacity")
            stav = cti_soubor(d + "/status", "")
            if uroven is not None:
                return {"uroven": int(uroven), "nabiji": stav in ("Charging", "Full")}
    return None


def podsviceni():
    d = sorted(glob.glob("/sys/class/backlight/*"))
    return d[0] if d else None


def jas():
    d = podsviceni()
    if not d:
        return None
    akt, mx = int(cti_soubor(d + "/brightness", "0")), int(cti_soubor(d + "/max_brightness", "1"))
    return round(akt * 100 / max(mx, 1))


def nastav_jas(procenta):
    d = podsviceni()
    if not d:
        raise RuntimeError("displej nema ovladatelne podsviceni")
    mx = int(cti_soubor(d + "/max_brightness", "1"))
    hodnota = max(1, round(mx * max(5, min(100, int(procenta))) / 100))
    with open(d + "/brightness", "w") as f:
        f.write(str(hodnota))


# ---------------- informace o zarizeni (Nastaveni -> O systemu) ----------------

def system_info():
    import platform
    info = {"jadro": platform.release(), "arch": platform.machine(), "model": None,
            "distribuce": None, "pamet": None, "uloziste": None, "beh": None}
    # model telefonu: device tree (ARM telefony), jinak DMI (PC)
    model = cti_soubor("/proc/device-tree/model") or cti_soubor("/sys/class/dmi/id/product_name")
    if model:
        info["model"] = model.strip("\x00").strip()
    for radek in (cti_soubor("/etc/os-release", "") or "").splitlines():
        if radek.startswith("PRETTY_NAME="):
            info["distribuce"] = radek.split("=", 1)[1].strip('"')
    for radek in (cti_soubor("/proc/meminfo", "") or "").splitlines():
        if radek.startswith("MemTotal:"):
            info["pamet"] = int(radek.split()[1]) * 1024
    try:
        du = shutil.disk_usage("/")
        info["uloziste"] = {"celkem": du.total, "obsazeno": du.used}
    except OSError:
        pass
    beh = cti_soubor("/proc/uptime")
    if beh:
        info["beh"] = int(float(beh.split()[0]))
    return info


# ---------------- modem: stav, hovory, SMS ----------------

def modem():
    """Zakladni stav modemu, nebo None kdyz zadny neni."""
    try:
        m = mmcli_json("-m", "any")["modem"]
    except Exception:
        return None
    g = m.get("generic", {})
    op = m.get("3gpp", {})
    signal = g.get("signal-quality", {}).get("value", "0")
    return {
        "operator": op.get("operator-name") or "",
        "signal": int(signal) if str(signal).isdigit() else 0,
        "stav": g.get("state", ""),
        "technologie": ", ".join(g.get("access-technologies", [])),
    }


def cesta_z_vystupu(vystup, druh):
    """Z vystupu mmcli vytahne cestu noveho objektu (/org/freedesktop/ModemManager1/Call/3)."""
    m = re.search(r"(/org/freedesktop/ModemManager1/%s/\d+)" % druh, vystup)
    if not m:
        raise RuntimeError("modem nevratil novy objekt")
    return m.group(1)


def volej(cislo):
    vystup = spust(["mmcli", "-m", "any", "--voice-create-call=number=" + cislo])
    hovor = cesta_z_vystupu(vystup, "Call")
    spust(["mmcli", "-o", hovor, "--start"])
    return hovor


def hovory():
    seznam = mmcli_json("-m", "any", "--voice-list-calls").get("modem.voice.call", [])
    vysledek = []
    for cesta in seznam:
        try:
            p = mmcli_json("-o", cesta)["call"]["properties"]
        except Exception:
            continue
        vysledek.append({"id": cesta.rsplit("/", 1)[-1], "cislo": p.get("number", ""),
                         "smer": p.get("direction", ""), "stav": p.get("state", "")})
    return vysledek


def hovor_akce(cislo_hovoru, akce):
    if not str(cislo_hovoru).isdigit() or akce not in ("accept", "hangup"):
        raise ValueError("neplatny hovor")
    spust(["mmcli", "-o", "/org/freedesktop/ModemManager1/Call/" + str(cislo_hovoru), "--" + akce])


def posli_sms(cislo, text):
    vystup = spust(["mmcli", "-m", "any",
                    "--messaging-create-sms=text='%s',number='%s'" % (text_sms(text), cislo)])
    sms = cesta_z_vystupu(vystup, "SMS")
    spust(["mmcli", "-s", sms, "--send"], casovac=60)


def prijate_sms():
    seznam = mmcli_json("-m", "any", "--messaging-list-sms").get("modem.messaging.sms", [])
    vysledek = []
    for cesta in seznam:
        try:
            c = mmcli_json("-s", cesta)["sms"]
        except Exception:
            continue
        obsah, vlastnosti = c.get("content", {}), c.get("properties", {})
        if vlastnosti.get("pdu-type") not in ("deliver", "cdma-deliver"):
            continue
        vysledek.append({"id": cesta.rsplit("/", 1)[-1], "cislo": obsah.get("number", ""),
                         "text": obsah.get("text", ""), "cas": vlastnosti.get("timestamp", "")})
    return vysledek


# ---------------- Wi-Fi ----------------

def rozdel_nmcli(radek):
    """nmcli -t oddeluje dvojteckou a dvojtecku v hodnote escapuje jako \\:"""
    return [x.replace("\\:", ":") for x in re.split(r"(?<!\\):", radek)]


def wifi_seznam():
    vystup = spust(["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list"])
    site = {}
    for radek in vystup.splitlines():
        casti = rozdel_nmcli(radek)
        if len(casti) < 4 or not casti[1]:
            continue
        s = {"ssid": casti[1], "signal": int(casti[2] or 0), "zabezpeceni": casti[3],
             "pripojeno": casti[0] == "*"}
        if s["ssid"] not in site or s["signal"] > site[s["ssid"]]["signal"]:
            site[s["ssid"]] = s
    return sorted(site.values(), key=lambda s: (not s["pripojeno"], -s["signal"]))


def wifi_pripoj(ssid, heslo):
    prikaz = ["nmcli", "device", "wifi", "connect", str(ssid)[:64]]
    if heslo:
        prikaz += ["password", str(heslo)[:128]]
    spust(prikaz, casovac=45)


# ---------------- Android aplikace pres Waydroid (Linsoft Store) ----------------
# Instaluje se jen z F-Droid (otevrene aplikace, podepsane repozitarem) a jen
# podle nazvu baliku z bezpecneho tvaru; Google Play ve Waydroidu neni.

FDROID = "https://f-droid.org"
MAX_APK = 300 * 1024 * 1024
instalace = {}   # balik -> "stahuje" | "instaluje" | "hotovo" | "chyba: ..."


def balik_ok(balik):
    return isinstance(balik, str) and re.fullmatch(r"[a-zA-Z][\w]*(\.[a-zA-Z_][\w]*)+", balik) is not None


def waydroid_k_dispozici():
    return shutil.which("waydroid") is not None


def android_aplikace():
    """Nainstalovane Android aplikace ve Waydroidu (nazvy baliku)."""
    vystup = spust(["waydroid", "app", "list"], casovac=30)
    return sorted(set(re.findall(r"packageName:\s*(\S+)", vystup)))


def stahni_z_fdroid(balik, cil):
    import urllib.request
    with urllib.request.urlopen(FDROID + "/api/v1/packages/" + balik, timeout=30) as r:
        info = json.load(r)
    verze = info.get("suggestedVersionCode")
    if not isinstance(verze, int):
        raise RuntimeError("aplikace neni ve F-Droid")
    with urllib.request.urlopen("%s/repo/%s_%d.apk" % (FDROID, balik, verze), timeout=60) as r, open(cil, "wb") as f:
        nacteno = 0
        while True:
            kus = r.read(1 << 16)
            if not kus:
                break
            nacteno += len(kus)
            if nacteno > MAX_APK:
                raise RuntimeError("APK je prilis velky")
            f.write(kus)


def instaluj_android(balik):
    """Bezi ve vlakne: stahne APK z F-Droid a nainstaluje ho do Waydroidu."""
    import tempfile
    soubor = os.path.join(tempfile.mkdtemp(prefix="linsoft-apk-"), balik + ".apk")
    try:
        instalace[balik] = "stahuje"
        stahni_z_fdroid(balik, soubor)
        instalace[balik] = "instaluje"
        spust(["waydroid", "app", "install", soubor], casovac=300)
        instalace[balik] = "hotovo"
    except Exception as e:
        instalace[balik] = "chyba: " + str(e)[:200]
    finally:
        shutil.rmtree(os.path.dirname(soubor), ignore_errors=True)


# ---------------- ukazkovy rezim (pocitac bez modemu) ----------------

class Demo:
    sms = [{"id": "1", "cislo": "+421900123456", "text": "Ahoj, funguje LinsoftPhone OS?", "cas": ""}]
    # LINSOFT_DEMO_HOVOR=1: ukazkovy prichozi hovor (vyzkouseni obrazovky hovoru)
    hovory = ([{"id": "2", "cislo": "+421900123456", "smer": "incoming", "stav": "ringing-in"}]
              if os.environ.get("LINSOFT_DEMO_HOVOR") == "1" else [])
    jas = 70
    android = ["org.videolan.vlc"]

    @classmethod
    def stav(cls):
        return {"baterie": {"uroven": 76, "nabiji": False}, "jas": cls.jas,
                "modem": {"operator": "Linsoft 5G", "signal": 80, "stav": "registered", "technologie": "lte"},
                "system": {"model": "PINE64 PinePhone (ukazka)", "distribuce": "postmarketOS v24.12",
                           "jadro": "6.12.1", "arch": "aarch64", "pamet": 2 * 1024 ** 3,
                           "uloziste": {"celkem": 32 * 1024 ** 3, "obsazeno": 5 * 1024 ** 3},
                           "beh": int(time.time() - START)}}


# ---------------- HTTP ----------------

class Obsluha(SimpleHTTPRequestHandler):
    server_version = "LinsoftPhoneOS/" + VERZE
    extensions_map = dict(SimpleHTTPRequestHandler.extensions_map, **{
        ".webmanifest": "application/manifest+json", ".js": "text/javascript", ".svg": "image/svg+xml"})

    def __init__(self, *a, **k):
        super().__init__(*a, directory=WWW, **k)

    def log_message(self, fmt, *args):
        if os.environ.get("LINSOFT_LOG"):
            sys.stderr.write("linsoft: " + (fmt % args) + "\n")

    def end_headers(self):
        # pravidla, aby se nova verze rozhrani vzdy nacetla
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def odpoved(self, kod, data):
        telo = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(telo)))
        self.end_headers()
        self.wfile.write(telo)

    def overeni(self):
        """Jen pro rozhrani na tomto telefonu: spravny Host (proti DNS rebinding)
        a vlastni hlavicka (cizi web ji pres formular ani obrazek neposle)."""
        return self.headers.get("Host") in POVOLENE_HOSTY and self.headers.get("X-Linsoft") == "1"

    def telo(self):
        delka = min(int(self.headers.get("Content-Length") or 0), 65536)
        try:
            return json.loads(self.rfile.read(delka) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):
        if not self.path.startswith("/api/"):
            return super().do_GET()
        if not self.overeni():
            return self.odpoved(403, {"chyba": "zakazano"})
        try:
            self.odpoved(200, self.api_get(self.path.split("?")[0]))
        except KeyError:
            self.odpoved(404, {"chyba": "neznamy pozadavek"})
        except Exception as e:
            self.odpoved(500, {"chyba": str(e)})

    def do_POST(self):
        if not self.path.startswith("/api/") or not self.overeni():
            return self.odpoved(403, {"chyba": "zakazano"})
        try:
            self.odpoved(200, self.api_post(self.path.split("?")[0], self.telo()) or {"ok": True})
        except KeyError:
            self.odpoved(404, {"chyba": "neznamy pozadavek"})
        except ValueError as e:
            self.odpoved(400, {"chyba": str(e)})
        except Exception as e:
            self.odpoved(500, {"chyba": str(e)})

    # ---- GET ----
    def api_get(self, cesta):
        if cesta == "/api/stav":
            stav = Demo.stav() if DEMO else {"baterie": baterie(), "jas": jas(), "modem": modem(),
                                              "system": system_info()}
            stav.update({"verze": VERZE, "demo": DEMO, "cas": int(time.time())})
            return stav
        if cesta == "/api/hovory":
            return Demo.hovory if DEMO else hovory()
        if cesta == "/api/sms":
            return Demo.sms if DEMO else prijate_sms()
        if cesta == "/api/wifi":
            if DEMO:
                return [{"ssid": "Domov", "signal": 82, "zabezpeceni": "WPA2", "pripojeno": True},
                        {"ssid": "Kaviaren", "signal": 41, "zabezpeceni": "", "pripojeno": False}]
            return wifi_seznam()
        if cesta == "/api/android":
            if DEMO:
                return {"dostupne": True, "nainstalovane": Demo.android, "instalace": instalace}
            if not waydroid_k_dispozici():
                return {"dostupne": False, "nainstalovane": [], "instalace": {}}
            try:
                aplikace = android_aplikace()
            except Exception:
                aplikace = []   # Waydroid je nainstalovany, ale nebezi
            return {"dostupne": True, "nainstalovane": aplikace, "instalace": instalace}
        raise KeyError(cesta)

    # ---- POST ----
    def api_post(self, cesta, d):
        if cesta == "/api/volat":
            if not cislo_ok(d.get("cislo")):
                raise ValueError("neplatne cislo")
            if DEMO:
                Demo.hovory = [{"id": "1", "cislo": d["cislo"], "smer": "outgoing", "stav": "active"}]
                return {"ok": True}
            return {"ok": True, "hovor": volej(d["cislo"])}
        if cesta == "/api/hovor":
            if DEMO:
                Demo.hovory = [] if d.get("akce") == "hangup" else \
                    [dict(h, stav="active") for h in Demo.hovory]
                return None
            return hovor_akce(d.get("id"), d.get("akce"))
        if cesta == "/api/sms":
            if not cislo_ok(d.get("cislo")) or not str(d.get("text", "")).strip():
                raise ValueError("chybi cislo nebo text")
            return None if DEMO else posli_sms(d["cislo"], d["text"])
        if cesta == "/api/jas":
            if DEMO:
                Demo.jas = int(d.get("hodnota", 70))
                return None
            return nastav_jas(d.get("hodnota", 70))
        if cesta == "/api/wifi":
            if not d.get("ssid"):
                raise ValueError("chybi nazev site")
            return None if DEMO else wifi_pripoj(d["ssid"], d.get("heslo", ""))
        if cesta in ("/api/android/instalovat", "/api/android/spustit", "/api/android/odinstalovat"):
            balik = d.get("balik")
            if not balik_ok(balik):
                raise ValueError("neplatny nazev aplikace")
            if DEMO:
                if cesta.endswith("instalovat") and balik not in Demo.android:
                    Demo.android.append(balik)
                    instalace[balik] = "hotovo"
                elif cesta.endswith("odinstalovat") and balik in Demo.android:
                    Demo.android.remove(balik)
                return None
            if not waydroid_k_dispozici():
                raise RuntimeError("na telefonu chybi Waydroid")
            if cesta.endswith("/instalovat"):
                if instalace.get(balik) in ("stahuje", "instaluje"):
                    return None
                import threading
                threading.Thread(target=instaluj_android, args=(balik,), daemon=True).start()
            elif cesta.endswith("/spustit"):
                subprocess.Popen(["waydroid", "app", "launch", balik])
            else:
                spust(["waydroid", "app", "remove", balik], casovac=120)
            return None
        if cesta == "/api/system":
            akce = {"vypnout": ["poweroff"], "restart": ["reboot"]}.get(d.get("akce"))
            if not akce:
                raise ValueError("neznama akce")
            if not DEMO:
                subprocess.Popen(akce)
            return None
        raise KeyError(cesta)


def main():
    if len(sys.argv) > 1:
        global WWW
        WWW = sys.argv[1]
    if not os.path.isdir(WWW):
        sys.exit("linsoft-sluzba: chybi adresar s rozhranim: " + WWW)
    print("LinsoftPhone OS %s: http://127.0.0.1:%d/%s" % (VERZE, PORT, "  (ukazkovy rezim)" if DEMO else ""),
          flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Obsluha).serve_forever()


if __name__ == "__main__":
    main()
