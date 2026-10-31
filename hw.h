/* LinsoftPhone OS - spolecne deklarace hardwaru (RTC, preruseni, vstup, virtio) */

#ifndef HW_H
#define HW_H

typedef unsigned char  u8;
typedef unsigned short u16;
typedef unsigned int   u32;
typedef unsigned long long u64;

#define REG32(a) (*(volatile u32 *)(a))

/* ---------------- RTC PL031 (rtc.c) ---------------- */

#define RTC_BASE 0x09010000u

struct datum_cas {
    u32 rok, mesic, den;        /* 1970.., 1-12, 1-31 */
    u32 hod, min, sek;
    u32 den_tydne;              /* 0 = nedele */
};

int  rtc_init(void);            /* 1 = PL031 nalezen */
int  rtc_aktivni(void);
u32  rtc_sekundy(void);         /* sekundy od 1.1.1970 */
void rtc_preved(u32 t, struct datum_cas *d);

/* ---------------- preruseni: GICv2 + timer + UART RX (irq.c) ---------------- */

#define GICD_BASE 0x08000000u
#define GICC_BASE 0x08010000u

#define IRQ_VTIMER  27          /* PPI: virtualni generic timer */
#define IRQ_UART0   33          /* SPI 1: PL011 */
#define IRQ_VIRTIO0 48          /* SPI 16: prvni virtio-mmio slot */

#define TIKU_ZA_S   10          /* timer tika kazdych 100 ms */

int  irq_init(void);            /* GIC + timer + UART RX; 1 = preruseni bezi */
int  irq_aktivni(void);
void irq_povol(u32 id);         /* povoleni jednoho preruseni v distributoru */
u32  irq_tiky(void);            /* pocet tiku timeru od startu */
u32  irq_pocet(void);           /* celkovy pocet obslouzenych preruseni */

/* vstupni fronta pro shell (plni UART i virtio klavesnice z preruseni) */
#define VSTUP_ZPET      0x100   /* specialni kody tlacitek spodni listy */
#define VSTUP_DOMU      0x101
#define VSTUP_APLIKACE  0x102

void vstup_vloz(u32 c);         /* volat z preruseni */
int  vstup_cekej(void);         /* znak/kod, nebo -1 po tiku timeru; mezitim wfi */

/* ---------------- virtio-input (virtio.c) ---------------- */

int  virtio_init(void);         /* vraci pocet nalezenych vstupnich zarizeni (volat po irq_init) */
void virtio_poll(void);        /* bez preruseni: rucni obsluha front */
void virtio_irq(u32 id);        /* obsluha preruseni virtio-mmio */
void virtio_info(void (*puts)(const char *), void (*putn)(u32));
int  klavesnice_nastav(const char *nazev);  /* "sk" / "us"; 1 = ok */
const char *klavesnice_nazev(void);         /* aktivni rozlozeni */

#endif
