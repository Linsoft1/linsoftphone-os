# LinsoftPhone OS - sestaveni kernelu pomoci zig cc (cross-kompilace pro ARM)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$zig = "zig"
if (-not (Get-Command $zig -ErrorAction SilentlyContinue)) {
    $zig = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter zig.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $zig) { Write-Host "CHYBA: zig nenalezen." -ForegroundColor Red; exit 1 }
}

# +strict_align: bez MMU je vsechna pamet typu Device/Strongly-ordered
# a nezarovnany pristup (napr. memcpy-like smycky v -O2) vyvola data abort
& $zig cc -target arm-freestanding-eabi -mcpu=cortex_a15+strict_align `
    -ffreestanding -nostdlib -fno-builtin -O2 -Wall `
    -T linker.ld `
    -o kernel.elf `
    boot.S kernel.c gfx.c rtc.c irq.c virtio.c

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: kernel.elf sestaven." -ForegroundColor Green
} else {
    Write-Host "CHYBA: sestaveni selhalo." -ForegroundColor Red
    exit 1
}
