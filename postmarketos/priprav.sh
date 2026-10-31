#!/bin/sh
# LinsoftPhone OS - pripravi balik postmarketos-ui-linsoft do pmaports,
# aby ho pmbootstrap nabidl jako rozhrani (UI) pri "pmbootstrap init".
# Spusteni (Linux nebo WSL, pmbootstrap uz nainstalovany a jednou inicializovany):
#   sh postmarketos/priprav.sh
set -e

KOREN=$(cd "$(dirname "$0")/.." && pwd)
BALIK="$KOREN/postmarketos/postmarketos-ui-linsoft"
PMAPORTS=$(pmbootstrap config aports)
CIL="$PMAPORTS/main/postmarketos-ui-linsoft"

echo "LinsoftPhone OS -> $CIL"
rm -rf "$CIL"
mkdir -p "$CIL"
cp "$BALIK"/APKBUILD "$BALIK"/*.post-install "$BALIK"/linsoft-* "$CIL"/

# rozhrani (PWA) bez testu jako jeden archiv s adresarem www/
TMP=$(mktemp -d)
mkdir "$TMP/www"
(cd "$KOREN/pwa" && tar --exclude=./tests -cf - .) | tar -C "$TMP/www" -xf -
tar -C "$TMP" -czf "$CIL/linsoftphone-www.tar.gz" www
rm -rf "$TMP"

pmbootstrap checksum postmarketos-ui-linsoft

cat <<KONEC

Hotovo. Dalsi kroky:
  pmbootstrap init        # vyber vyrobce a model telefonu, jako UI zvol "linsoft"
  pmbootstrap install     # sestavi system
  pmbootstrap flasher flash_rootfs && pmbootstrap flasher flash_kernel
                          # nebo: pmbootstrap install --sdcard=/dev/sdX (PinePhone)
Vyzkouseni bez telefonu: v "pmbootstrap init" zvol zarizeni qemu-amd64,
pak "pmbootstrap qemu".
KONEC
