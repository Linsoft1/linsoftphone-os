/* LinsoftPhone OS - vstupni bod kernelu (ARMv7, QEMU virt) */

.section .text.boot
.global _start

_start:
    /* nastav zasobnik */
    ldr     sp, =_stack_top

    /* vynuluj .bss */
    ldr     r0, =__bss_start
    ldr     r1, =__bss_end
    mov     r2, #0
1:
    cmp     r0, r1
    bge     2f
    str     r2, [r0], #4
    b       1b
2:
    /* skok do C kodu */
    bl      kmain

hang:
    wfe
    b       hang
