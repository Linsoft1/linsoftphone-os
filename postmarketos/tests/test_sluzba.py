"""Testy lokalni sluzby LinsoftPhone OS (ukazkovy rezim, bez modemu).
Spusteni: python -m unittest discover -s postmarketos/tests"""
import importlib.util
import json
import os
import threading
import unittest
import urllib.error
import urllib.request

KOREN = os.path.join(os.path.dirname(__file__), "..", "..")
os.environ["LINSOFT_DEMO"] = "1"
os.environ["LINSOFT_PORT"] = "8641"
spec = importlib.util.spec_from_file_location(
    "sluzba", os.path.join(KOREN, "postmarketos", "postmarketos-ui-linsoft", "linsoft-sluzba.py"))
sluzba = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sluzba)
sluzba.WWW = os.path.join(KOREN, "pwa")

ADRESA = "http://127.0.0.1:8641"


def pozadavek(cesta, data=None, hlavicky=None):
    h = {"X-Linsoft": "1"} if hlavicky is None else hlavicky
    if data is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(ADRESA + cesta, data=None if data is None else json.dumps(data).encode(), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


class TestSluzba(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = sluzba.ThreadingHTTPServer(("127.0.0.1", 8641), sluzba.Obsluha)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def test_rozhrani_se_servizuje(self):
        kod, telo = pozadavek("/", hlavicky={})
        self.assertEqual(kod, 200)
        self.assertIn(b"LinsoftPhone OS", telo)

    def test_stav(self):
        kod, telo = pozadavek("/api/stav")
        self.assertEqual(kod, 200)
        s = json.loads(telo)
        self.assertTrue(s["demo"])
        self.assertIn("baterie", s)
        self.assertIn("modem", s)
        self.assertIn("jadro", s["system"])
        self.assertEqual(s["verze"], "2.3")

    def test_api_bez_hlavicky_je_zakazane(self):
        self.assertEqual(pozadavek("/api/stav", hlavicky={})[0], 403)
        self.assertEqual(pozadavek("/api/volat", {"cislo": "123"}, hlavicky={})[0], 403)

    def test_cizi_host_je_zakazany(self):
        """ochrana proti DNS rebinding: jiny Host nez 127.0.0.1/localhost"""
        kod, _ = pozadavek("/api/stav", hlavicky={"X-Linsoft": "1", "Host": "zly.example:8641"})
        self.assertEqual(kod, 403)

    def test_hovor_a_zaveseni(self):
        self.assertEqual(pozadavek("/api/volat", {"cislo": "+421900111222"})[0], 200)
        hovory = json.loads(pozadavek("/api/hovory")[1])
        self.assertEqual(hovory[0]["cislo"], "+421900111222")
        self.assertEqual(pozadavek("/api/hovor", {"id": "1", "akce": "hangup"})[0], 200)
        self.assertEqual(json.loads(pozadavek("/api/hovory")[1]), [])

    def test_neplatne_cislo(self):
        self.assertEqual(pozadavek("/api/volat", {"cislo": "123; reboot"})[0], 400)
        self.assertEqual(pozadavek("/api/sms", {"cislo": "--help", "text": "x"})[0], 400)

    def test_neznama_akce(self):
        self.assertEqual(pozadavek("/api/system", {"akce": "rm"})[0], 400)
        self.assertEqual(pozadavek("/api/neexistuje")[0], 404)


class TestPomocneFunkce(unittest.TestCase):
    def test_system_info(self):
        """na kazdem systemu vrati vsechny klice (co nejde zjistit, je None)"""
        info = sluzba.system_info()
        for k in ("jadro", "arch", "model", "distribuce", "pamet", "uloziste", "beh"):
            self.assertIn(k, info)
        self.assertTrue(info["jadro"])

    def test_cislo(self):
        self.assertTrue(sluzba.cislo_ok("+421900123456"))
        self.assertTrue(sluzba.cislo_ok("*100#"))
        self.assertFalse(sluzba.cislo_ok("12 34"))
        self.assertFalse(sluzba.cislo_ok("--send"))
        self.assertFalse(sluzba.cislo_ok(None))

    def test_text_sms_bez_apostrofu(self):
        self.assertNotIn("'", sluzba.text_sms("it's ok',number='999"))

    def test_cesta_z_mmcli(self):
        v = "Successfully created new call: /org/freedesktop/ModemManager1/Call/7\n"
        self.assertEqual(sluzba.cesta_z_vystupu(v, "Call"), "/org/freedesktop/ModemManager1/Call/7")
        with self.assertRaises(RuntimeError):
            sluzba.cesta_z_vystupu("error", "SMS")

    def test_nmcli_dvojtecka_v_nazvu(self):
        self.assertEqual(sluzba.rozdel_nmcli(r"*:Moja\:sie\:t:80:WPA2"), ["*", "Moja:sie:t", "80", "WPA2"])


if __name__ == "__main__":
    unittest.main()
