# LinsoftPhone OS - spusteni v QEMU s grafickym displejem (ramfb)
# Seriova konzole zustava v tomto terminalu; displej se otevre v okne QEMU.
# Psat lze i primo do okna QEMU (virtio klavesnice), klik mysi na spodni
# listu displeje = dotyk (virtio tablet): < zpet, O domu, [] aplikace.
# Hodiny ve stavovem radku jdou podle RTC v mistnim case hostitele.
# Ukonceni: prikaz 'vypni' v shellu, nebo zavrit okno QEMU.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$qemu = "qemu-system-arm"
if (-not (Get-Command $qemu -ErrorAction SilentlyContinue)) {
    $qemu = "C:\Program Files\qemu\qemu-system-arm.exe"
}

& $qemu -M virt -cpu cortex-a15 -m 128M `
    -device ramfb `
    -device virtio-keyboard-device `
    -device virtio-tablet-device `
    -rtc base=localtime `
    -serial stdio `
    -kernel kernel.elf
