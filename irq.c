/*
 * LinsoftPhone OS - preruseni: GICv2, generic timer a UART RX
 *
 * GICv2 na QEMU virt: distributor 0x08000000, CPU rozhrani 0x08010000.
 * Virtualni timer (PPI 27) tika kazdych 100 ms, PL011 (SPI 1 = IRQ 33)
 * plni vstupni frontu shellu. Hlavni smycka mezi znaky spi pres wfi.
 */

#include "hw.h"

/* ---------------- registry GIC ---------------- */

#define GICD_CTLR        REG32(GICD_BASE + 0x000)
#define GICD_TYPER       REG32(GICD_BASE + 0x004)
#define GICD_ISENABLER(n) REG32(GICD_BASE + 0x100 + 4 * (n))
#define GICD_ICENABLER(n) REG32(GICD_BASE + 0x180 + 4 * (n))

#define GICC_CTLR        REG32(GICC_BASE + 0x00)
#define GICC_PMR         REG32(GICC_BASE + 0x04)
#define GICC_BPR         REG32(GICC_BASE + 0x08)
#define GICC_IAR         REG32(GICC_BASE + 0x0C)
#define GICC_EOIR        REG32(GICC_BASE + 0x10)

/* ---------------- PL011 (jen registry pro preruseni) ---------------- */

#define UART_BASE   0x09000000u
#define UART_DR     REG32(UART_BASE + 0x00)
#define UART_FR     REG32(UART_BASE + 0x18)
#define UART_LCRH   REG32(UART_BASE + 0x2C)
#define UART_IMSC   REG32(UART_BASE + 0x38)
#define UART_ICR    REG32(UART_BASE + 0x44)
#define UART_FR_RXFE (1u << 4)
#define UART_INT_RX  (1u << 4)
#define UART_INT_RT  (1u << 6)

/* ---------------- virtualni generic timer ---------------- */

static inline u32 cntfrq(void)
{
    u32 v;
    __asm__ volatile("mrc p15, 0, %0, c14, c0, 0" : "=r"(v));
    return v;
}

static inline void cntv_tval(u32 v)
{
    __asm__ volatile("mcr p15, 0, %0, c14, c3, 0" :: "r"(v));
}

static inline void cntv_ctl(u32 v)
{
    __asm__ volatile("mcr p15, 0, %0, c14, c3, 1" :: "r"(v));
    __asm__ volatile("isb");
}

/* ---------------- stav ---------------- */

static int aktivni;
static u32 interval;                /* tiky citace na 100 ms */
static volatile u32 tiky;
static volatile u32 pocet_irq;
static volatile int tik_cekajici;

/* kruhova fronta vstupu: zapisuje jen preruseni, cte jen hlavni smycka */
#define FRONTA 128
static volatile u16 fronta[FRONTA];
static volatile u32 f_hlava, f_ocas;

void vstup_vloz(u32 c)
{
    u32 dalsi = (f_hlava + 1) % FRONTA;
    if (dalsi == f_ocas) return;    /* plna fronta - znak zahodime */
    fronta[f_hlava] = (u16)c;
    f_hlava = dalsi;
}

static int vstup_vezmi(void)
{
    if (f_ocas == f_hlava) return -1;
    int c = fronta[f_ocas];
    f_ocas = (f_ocas + 1) % FRONTA;
    return c;
}

/* blokujici cteni: bez preruseni (fallback) aktivne cte UART */
int vstup_cekej(void)
{
    for (;;) {
        int c = vstup_vezmi();
        if (c >= 0) return c;
        if (!aktivni) {
            virtio_poll();
            if (!(UART_FR & UART_FR_RXFE))
                return (int)(UART_DR & 0xFF);
            return -1;          /* volajici si mezitim obnovi hodiny */
        }
        /* zakaz IRQ, over frontu a spi - wfi se probudi i s maskovanym IRQ */
        __asm__ volatile("cpsid i" ::: "memory");
        if (f_ocas == f_hlava && !tik_cekajici)
            __asm__ volatile("wfi");
        __asm__ volatile("cpsie i" ::: "memory");
        if (tik_cekajici) {             /* dej volajicimu sanci prekreslit hodiny */
            tik_cekajici = 0;
            return -1;
        }
    }
}

int irq_aktivni(void) { return aktivni; }
u32 irq_tiky(void)    { return tiky; }
u32 irq_pocet(void)   { return pocet_irq; }

void irq_povol(u32 id)
{
    /* priorita 0xA0, cil CPU0 (u PPI jen pro cteni) */
    volatile u8 *prio = (volatile u8 *)(GICD_BASE + 0x400);
    volatile u8 *cil  = (volatile u8 *)(GICD_BASE + 0x800);
    prio[id] = 0xA0;
    if (id >= 32) cil[id] = 0x01;
    GICD_ISENABLER(id / 32) = 1u << (id % 32);
}

/* ---------------- obsluha (volana z boot.S v IRQ rezimu) ---------------- */

void irq_obsluha(void)
{
    u32 iar = GICC_IAR;
    u32 id = iar & 0x3FF;
    if (id >= 1020) return;         /* spurious */
    pocet_irq++;

    if (id == IRQ_VTIMER) {
        cntv_tval(interval);        /* dalsi tik za 100 ms (zrusi i uroven) */
        tiky++;
        tik_cekajici = 1;
    } else if (id == IRQ_UART0) {
        while (!(UART_FR & UART_FR_RXFE))
            vstup_vloz(UART_DR & 0xFF);
        UART_ICR = UART_INT_RX | UART_INT_RT;
    } else if (id >= IRQ_VIRTIO0 && id < IRQ_VIRTIO0 + 32) {
        virtio_irq(id);
    }

    GICC_EOIR = iar;
}

int irq_init(void)
{
    /* GICv2? (TYPER nesmi byt 0 ani same jednicky) */
    u32 typer = GICD_TYPER;
    if (typer == 0 || typer == 0xFFFFFFFFu) return 0;
    u32 radky = (typer & 0x1F) + 1;  /* pocet 32bitovych skupin preruseni */

    GICD_CTLR = 0;
    for (u32 i = 0; i < radky; i++)
        GICD_ICENABLER(i) = 0xFFFFFFFFu;
    GICD_CTLR = 1;

    GICC_PMR  = 0xFF;               /* propust vsechny priority */
    GICC_BPR  = 0;
    GICC_CTLR = 1;

    /* timer: 10x za sekundu */
    u32 f = cntfrq();
    if (f == 0) f = 62500000;
    interval = f / TIKU_ZA_S;
    cntv_tval(interval);
    cntv_ctl(1);                    /* ENABLE=1, IMASK=0 */
    irq_povol(IRQ_VTIMER);

    /* UART: FIFO + preruseni pri prijmu (a receive timeout) */
    UART_LCRH |= (1u << 4);
    UART_ICR  = 0x7FF;
    UART_IMSC = UART_INT_RX | UART_INT_RT;
    irq_povol(IRQ_UART0);

    aktivni = 1;
    __asm__ volatile("cpsie i" ::: "memory");
    return 1;
}
