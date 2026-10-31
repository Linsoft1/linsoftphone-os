"""Testy LinsoftPhone Installer (bez skutocneho disku). Spustenie: python -m unittest discover -s instalator"""
import importlib.util
import lzma
import os
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("ins", os.path.join(os.path.dirname(__file__), "linsoft_instalator.py"))
ins = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ins)


class TestObraz(unittest.TestCase):
    def setUp(self):
        self.adr = tempfile.mkdtemp()
        self.data = os.urandom(3000) + b"LinsoftPhone" * 100000   # nie nasobok 512 B
        self.img = os.path.join(self.adr, "a.img")
        self.xz = os.path.join(self.adr, "a.img.xz")
        with open(self.img, "wb") as f:
            f.write(self.data)
        with lzma.open(self.xz, "wb", format=lzma.FORMAT_XZ) as f:
            f.write(self.data)

    def test_najdi_obraz_vo_vydani(self):
        v = {"assets": [{"name": "linsoftphone-kernel-1.3.elf", "browser_download_url": "k"},
                        {"name": "linsoftphone-os-2.4-qemu-amd64.img.xz", "browser_download_url": "o"},
                        {"name": "SHA256SUMS", "browser_download_url": "s"}]}
        self.assertEqual(ins.najdi_obraz(v), ("o", "linsoftphone-os-2.4-qemu-amd64.img.xz", "s"))
        with self.assertRaises(RuntimeError):
            ins.najdi_obraz({"assets": []})

    def test_sucet_zo_suboru_suctov(self):
        text = "a" * 64 + "  linsoftphone-kernel-1.3.elf\n" + "b" * 64 + "  obraz.img.xz\n"
        self.assertEqual(ins.ocakavany_sucet(text, "obraz.img.xz"), "b" * 64)
        self.assertIsNone(ins.ocakavany_sucet(text, "iny.img.xz"))

    def test_velkost_z_indexu_xz(self):
        self.assertEqual(ins.velkost_obrazu(self.xz), len(self.data))
        self.assertEqual(ins.velkost_obrazu(self.img), len(self.data))

    def test_zapis_z_xz_aj_img_zarovnany_na_sektor(self):
        for zdroj in (self.xz, self.img):
            ciel = os.path.join(self.adr, "linsoftPhone.img")
            zapisane = ins.zapis(zdroj, ciel)
            with open(ciel, "rb") as f:
                obsah = f.read()
            self.assertEqual(zapisane % 512, 0)
            self.assertEqual(obsah[:len(self.data)], self.data)
            self.assertEqual(obsah[len(self.data):], b"\0" * (len(obsah) - len(self.data)))

    def test_sha256(self):
        import hashlib
        self.assertEqual(ins.sha256(self.img), hashlib.sha256(self.data).hexdigest())

    def test_prikazovy_riadok_subor(self):
        ciel = os.path.join(self.adr, "linsoftPhone.img")
        self.assertEqual(ins.hlavny(["--obraz", self.xz, "--subor", ciel]), 0)
        self.assertTrue(os.path.getsize(ciel) >= len(self.data))


class TestDisky(unittest.TestCase):
    """Najdolezitejsie: systemovy disk sa nesmie nikdy ponuknut."""
    def test_windows(self):
        data = [
            {"Number": 0, "FriendlyName": "Samsung SSD 980", "Size": 500107862016, "BusType": "NVMe", "IsBoot": True, "IsSystem": True},
            {"Number": 1, "FriendlyName": "SanDisk Ultra USB", "Size": 32010928128, "BusType": "USB", "IsBoot": False, "IsSystem": False},
            {"Number": 2, "FriendlyName": "SD karta", "Size": 63864569856, "BusType": 12, "IsBoot": False, "IsSystem": False},
            {"Number": 3, "FriendlyName": "USB s Windows", "Size": 64000000000, "BusType": "USB", "IsBoot": True, "IsSystem": False},
            {"Number": 4, "FriendlyName": "Externy SSD 2TB", "Size": 2000398934016, "BusType": "USB", "IsBoot": False, "IsSystem": False},
            {"Number": 5, "FriendlyName": "SATA HDD", "Size": 1000204886016, "BusType": "SATA", "IsBoot": False, "IsSystem": False},
        ]
        d = ins.filtruj_windows(data)
        self.assertEqual([x["cislo"] for x in d], [1, 2])
        self.assertEqual(d[0]["cesta"], "\\\\.\\PhysicalDrive1")
        self.assertEqual(ins.filtruj_windows({"Number": 7, "FriendlyName": "USB", "Size": 8e9, "BusType": "USB"})[0]["cislo"], 7)

    def test_linux(self):
        data = {"blockdevices": [
            {"name": "sda", "size": 512110190592, "model": "SSD", "rm": False, "tran": "sata", "type": "disk",
             "mountpoints": [None], "children": [{"name": "sda1", "mountpoints": ["/boot/efi"]}, {"name": "sda2", "mountpoints": ["/"]}]},
            {"name": "sdb", "size": 31914983424, "model": "Ultra USB 3.0", "rm": True, "tran": "usb", "type": "disk",
             "mountpoints": [None], "children": [{"name": "sdb1", "mountpoints": ["/media/user/USB"]}]},
            {"name": "mmcblk0", "size": 63864569856, "model": None, "rm": False, "tran": "mmc", "type": "disk", "mountpoints": [None]},
            {"name": "sdc", "size": 63864569856, "model": "Live USB", "rm": True, "tran": "usb", "type": "disk",
             "mountpoints": [None], "children": [{"name": "sdc1", "mountpoints": ["/"]}]},
            {"name": "sr0", "size": 1073741312, "model": "DVD", "rm": True, "tran": "sata", "type": "rom", "mountpoints": [None]},
        ]}
        self.assertEqual([x["cesta"] for x in ins.filtruj_linux(data)], ["/dev/sdb", "/dev/mmcblk0"])

    def test_zapis_na_disk_mimo_zoznamu_odmietnuty(self):
        ins_najdi = ins.najdi_disky
        ins.najdi_disky = lambda: [{"cesta": "/dev/sdb", "cislo": None, "nazov": "USB", "velkost": 8 * 1024 ** 3}]
        try:
            with self.assertRaises(SystemExit) as e:
                ins.hlavny(["--obraz", __file__, "--disk", "/dev/sda", "--ano"])
            self.assertIn("odmietnut", str(e.exception))
        finally:
            ins.najdi_disky = ins_najdi


if __name__ == "__main__":
    unittest.main()
