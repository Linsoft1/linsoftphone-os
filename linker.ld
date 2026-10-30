/* LinsoftPhone OS - linker skript pro QEMU -M virt (RAM od 0x40000000) */

ENTRY(_start)

SECTIONS
{
    . = 0x40010000;

    .text : {
        KEEP(*(.text.boot))
        *(.text*)
    }

    .rodata : {
        *(.rodata*)
    }

    .data : {
        *(.data*)
    }

    .bss (NOLOAD) : {
        . = ALIGN(4);
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        __bss_end = .;
    }

    /* 64 KiB zasobnik */
    . = ALIGN(16);
    . += 0x10000;
    _stack_top = .;
}
