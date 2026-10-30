# LinsoftPhone OS - spusteni v QEMU s grafickym displejem (ramfb)
# Seriova konzole zustava v tomto terminalu; displej se otevre v okne QEMU.
# Ukonceni: prikaz 'vypni' v shellu, nebo zavrit okno QEMU.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$qemu = "qemu-system-arm"
if (-not (Get-Command $qemu -ErrorAction SilentlyContinue)) {
    $qemu = "C:\Program Files\qemu\qemu-system-arm.exe"
}

& $qemu -M virt -cpu cortex-a15 -m 128M -device ramfb -serial stdio -kernel kernel.elf
