/* LinsoftPhone OS - vstupni bod kernelu (ARMv7, QEMU virt) */

.section .text.boot
.global _start

_start:
    /* zasobnik pro IRQ rezim (0x12), preruseni zatim zakazana */
    cpsid   if, #0x12
    ldr     sp, =_irq_stack_top
    /* zasobnik pro abort/undef rezimy (sdileny, jen pro vypis chyby) */
    cps     #0x17
    ldr     sp, =_exc_stack_top
    cps     #0x1b
    ldr     sp, =_exc_stack_top
    /* zpet do SVC rezimu (0x13) a hlavni zasobnik */
    cps     #0x13
    ldr     sp, =_stack_top

    /* tabulka vektoru vyjimek -> VBAR (SCTLR.V = 0, nizke vektory) */
    ldr     r0, =vektory
    mcr     p15, 0, r0, c12, c0, 0
    mrc     p15, 0, r0, c1, c0, 0
    bic     r0, r0, #(1 << 13)
    mcr     p15, 0, r0, c1, c0, 0
    isb

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

/* ---------------- tabulka vektoru (zarovnani 32 B kvuli VBAR) ---------------- */

.balign 32
vektory:
    b       hang            /* reset */
    b       vyj_undef       /* nedefinovana instrukce */
    b       vyj_svc         /* svc */
    b       vyj_pabt        /* prefetch abort */
    b       vyj_dabt        /* data abort */
    b       hang            /* nepouzito */
    b       vyj_irq         /* IRQ */
    b       hang            /* FIQ */

/* IRQ: uloz volatile registry na IRQ zasobnik, zavolej C obsluhu, vrat se */
vyj_irq:
    sub     lr, lr, #4
    push    {r0-r3, r12, lr}
    bl      irq_obsluha
    pop     {r0-r3, r12, lr}
    movs    pc, lr          /* navrat + obnova CPSR ze SPSR */

/* fatalni vyjimky: vypis typu a adresy, pak stop */
vyj_undef:
    mov     r0, #1
    sub     r1, lr, #4
    b       vyj_fatal
vyj_svc:
    mov     r0, #2
    sub     r1, lr, #4
    b       vyj_fatal
vyj_pabt:
    mov     r0, #3
    sub     r1, lr, #4
    b       vyj_fatal
vyj_dabt:
    mov     r0, #4
    sub     r1, lr, #8
vyj_fatal:
    bl      vyjimka
    b       hang
