/*
 * LinsoftPhone OS - virtio-input pres virtio-mmio (klavesnice a tablet/dotyk)
 *
 * QEMU virt ma 32 virtio-mmio slotu od 0x0a000000 (krok 0x200), slot i
 * ma preruseni SPI 16+i (= IRQ 48+i). Hledame zarizeni s ID 18 (input).
 * Podporujeme legacy (verze 1, vychozi v QEMU) i moderni (verze 2) rozhrani.
 * Zarizeni plni frontu udalosti (eventq, fronta 0) strukturami
 * { u16 typ, u16 kod, u32 hodnota } ve formatu Linux evdev.
 */

#include "hw.h"

#define VIRTIO_BASE   0x0a000000u
#define VIRTIO_KROK   0x200u
#define VIRTIO_SLOTU  32

/* registry virtio-mmio */
#define VM_MAGIC        0x000
#define VM_VERZE        0x004
#define VM_DEVICE_ID    0x008
#define VM_DEV_FEAT     0x010
#define VM_DEV_FEAT_SEL 0x014
#define VM_DRV_FEAT     0x020
#define VM_DRV_FEAT_SEL 0x024
#define VM_PAGE_SIZE    0x028   /* jen legacy */
#define VM_QUEUE_SEL    0x030
#define VM_QUEUE_MAX    0x034
#define VM_QUEUE_NUM    0x038
#define VM_QUEUE_ALIGN  0x03c   /* jen legacy */
#define VM_QUEUE_PFN    0x040   /* jen legacy */
#define VM_QUEUE_READY  0x044   /* jen moderni */
#define VM_QUEUE_NOTIFY 0x050
#define VM_INT_STATUS   0x060
#define VM_INT_ACK      0x064
#define VM_STATUS       0x070
#define VM_DESC_LO      0x080   /* adresy front - jen moderni */
#define VM_DESC_HI      0x084
#define VM_AVAIL_LO     0x090
#define VM_AVAIL_HI     0x094
#define VM_USED_LO      0x0a0
#define VM_USED_HI      0x0a4
#define VM_CONFIG       0x100

#define ST_ACK          1
#define ST_DRIVER       2
#define ST_DRIVER_OK    4
#define ST_FEATURES_OK  8

#define VIRTIO_ID_INPUT 18
#define DESC_F_WRITE    2

/* konfigurace virtio-input */
#define CFG_SELECT      (VM_CONFIG + 0)
#define CFG_SUBSEL      (VM_CONFIG + 1)
#define CFG_SIZE        (VM_CONFIG + 2)
#define CFG_DATA        (VM_CONFIG + 8)
#define CFG_ID_NAME     0x01

/* udalosti evdev */
#define EV_SYN 0
#define EV_KEY 1
#define EV_ABS 3
#define ABS_X  0
#define ABS_Y  1
#define BTN_LEFT  0x110
#define BTN_TOUCH 0x14a

#define QN 64                   /* delka fronty */
#define MAX_ZARIZENI 4

struct vq_desc  { u64 addr; u32 len; u16 flags; u16 next; };
struct vq_avail { u16 flags; u16 idx; u16 ring[QN]; u16 used_event; };
struct vq_used_elem { u32 id; u32 len; };
struct vq_used  { u16 flags; u16 idx; struct vq_used_elem ring[QN]; };
struct udalost  { u16 typ; u16 kod; u32 hodnota; };

/* legacy rozlozeni: deskriptory + avail na prvni strance, used na druhe */
struct fronta {
    struct vq_desc  desc[QN];                       /* 1024 B */
    struct vq_avail avail;                          /* 134 B */
    u8 vypln[4096 - sizeof(struct vq_desc) * QN - sizeof(struct vq_avail)];
    struct vq_used  used;                           /* od 4096 */
} __attribute__((aligned(4096)));

struct zarizeni {
    u32 base;
    u32 irq;
    u32 verze;
    u16 posledni_used;
    char jmeno[32];
};

static struct fronta fronty[MAX_ZARIZENI];
static struct udalost udalosti[MAX_ZARIZENI][QN];
static struct zarizeni zar[MAX_ZARIZENI];
static int pocet;

static inline u32 rd(u32 base, u32 off) { return REG32(base + off); }
static inline void wr(u32 base, u32 off, u32 v) { REG32(base + off) = v; }
static inline void bariera(void) { __asm__ volatile("dsb sy" ::: "memory"); }

/* ---------------- prevod klaves (Linux evdev kody) na ASCII ----------------
 * QEMU posila fyzicke pozice klaves (US), znak urcuje az zvolene rozlozeni:
 *   us - americke QWERTY
 *   sk - slovenske QWERTZ (vychozi): prohozene Y/Z, interpunkce podle SK.
 *        Ciselna rada dava cislice (jako "programatorska" varianta), se
 *        Shiftem znaky slovenske rady bez diakritiky: + l s c t z y a i e.
 *        Konzole je jen ASCII, proto pismena s diakritikou (u, a, o, n na
 *        klavesach [ ] ; \) davaji zakladni pismeno, mrtve klavesy (dlzen,
 *        makcen) a znaky mimo ASCII (paragraf, stupen) se ignoruji.
 *        Prave Alt (AltGr) dava symboly jako ve Windows: @ # & { } [ ] \ | < > * $ ~ ^ `
 */

static const char us_mapa[58] = {
    0, 27, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 0x7F, '\t',
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\r', 0,
    'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', '\'', '`', 0, '\\',
    'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 0, '*', 0, ' '
};
static const char us_mapa_shift[58] = {
    0, 27, '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', 0x7F, '\t',
    'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{', '}', '\r', 0,
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':', '"', '~', 0, '|',
    'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 0, '*', 0, ' '
};
static const char sk_mapa[58] = {
    0, 27, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '=', 0, 0x7F, '\t',
    'q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'u', 'a', '\r', 0,
    'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'o', 0, ';', 0, 'n',
    'y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-', 0, '*', 0, ' '
};
static const char sk_mapa_shift[58] = {
    0, 27, '+', 'l', 's', 'c', 't', 'z', 'y', 'a', 'i', 'e', '%', 0, 0x7F, '\t',
    'Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', '/', '(', '\r', 0,
    'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '"', '!', 0, 0, ')',
    'Y', 'X', 'C', 'V', 'B', 'N', 'M', '?', ':', '_', 0, '*', 0, ' '
};
/* SK AltGr: dvojice { kod klavesy, znak } */
static const u8 sk_altgr[][2] = {
    { 2, '~' }, { 4, '^' }, { 8, '`' },
    { 16, '\\' }, { 17, '|' }, { 33, '[' }, { 34, ']' }, { 39, '$' },
    { 45, '#' }, { 46, '&' }, { 47, '@' }, { 48, '{' }, { 49, '}' },
    { 51, '<' }, { 52, '>' }, { 53, '*' }, { 86, '<' },
};
/* numericka klavesnice: kody 71..83 */
static const char mapa_num[13] = {
    '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '0', '.'
};

#define KEY_LSHIFT  42
#define KEY_RSHIFT  54
#define KEY_102ND   86          /* klavesa vlevo od Y/Z na evropske klavesnici */
#define KEY_KPENTER 96
#define KEY_KPSLASH 98
#define KEY_RALT    100         /* AltGr */

static int shift, altgr;
static int rozlozeni_sk = 1;    /* vychozi: slovenske QWERTZ */

int klavesnice_nastav(const char *nazev)
{
    if (nazev[0] == 's' && nazev[1] == 'k' && !nazev[2]) { rozlozeni_sk = 1; return 1; }
    if (nazev[0] == 'u' && nazev[1] == 's' && !nazev[2]) { rozlozeni_sk = 0; return 1; }
    return 0;
}

const char *klavesnice_nazev(void)
{
    return rozlozeni_sk ? "sk (QWERTZ)" : "us (QWERTY)";
}

static void klavesa(u32 kod, u32 hodnota)
{
    if (kod == KEY_LSHIFT || kod == KEY_RSHIFT) { shift = hodnota != 0; return; }
    if (kod == KEY_RALT) { altgr = hodnota != 0; return; }
    if (hodnota == 0) return;               /* uvolneni klavesy */
    char c = 0;
    if (rozlozeni_sk && altgr) {
        for (u32 j = 0; j < sizeof(sk_altgr) / sizeof(sk_altgr[0]); j++)
            if (sk_altgr[j][0] == kod) c = (char)sk_altgr[j][1];
    }
    else if (kod < 58) {
        if (rozlozeni_sk) c = shift ? sk_mapa_shift[kod] : sk_mapa[kod];
        else              c = shift ? us_mapa_shift[kod] : us_mapa[kod];
    }
    else if (kod == KEY_102ND) {
        if (rozlozeni_sk) c = shift ? '*' : '&';
        else              c = shift ? '|' : '\\';
    }
    else if (kod >= 71 && kod <= 83) c = mapa_num[kod - 71];
    else if (kod == KEY_KPENTER)     c = '\r';
    else if (kod == KEY_KPSLASH)     c = '/';
    if (c) vstup_vloz((u8)c);
}

/* ---------------- tablet: dotyk na spodni liste ---------------- */

#define ABS_MAX   0x7FFF        /* QEMU tablet hlasi 0..32767 */
#define DISP_W    480
#define DISP_H    800
#define LISTA_Y   (DISP_H - 70)

static u32 dotyk_x, dotyk_y;
static int dotyk_stisk;

static void dotyk(void)
{
    u32 x = dotyk_x * DISP_W / (ABS_MAX + 1);
    u32 y = dotyk_y * DISP_H / (ABS_MAX + 1);
    if (y < LISTA_Y) return;
    /* lista je rozdelena na tretiny: zpet | domu | aplikace */
    if (x < DISP_W / 3)          vstup_vloz(VSTUP_ZPET);
    else if (x < 2 * DISP_W / 3) vstup_vloz(VSTUP_DOMU);
    else                         vstup_vloz(VSTUP_APLIKACE);
}

static void udalost(const struct udalost *u)
{
    if (u->typ == EV_KEY) {
        if (u->kod == BTN_LEFT || u->kod == BTN_TOUCH) {
            if (u->hodnota) dotyk_stisk = 1;
        } else {
            klavesa(u->kod, u->hodnota);
        }
    } else if (u->typ == EV_ABS) {
        if (u->kod == ABS_X) dotyk_x = u->hodnota;
        if (u->kod == ABS_Y) dotyk_y = u->hodnota;
    } else if (u->typ == EV_SYN && dotyk_stisk) {
        dotyk_stisk = 0;            /* poloha je platna az po SYN */
        dotyk();
    }
}

/* ---------------- obsluha fronty ---------------- */

static void zpracuj(int i)
{
    struct zarizeni *z = &zar[i];
    struct fronta *q = &fronty[i];
    bariera();
    while (z->posledni_used != q->used.idx) {
        u32 id = q->used.ring[z->posledni_used % QN].id;
        z->posledni_used++;
        if (id < QN) {
            udalost(&udalosti[i][id]);
            /* buffer vratime zarizeni */
            q->avail.ring[q->avail.idx % QN] = (u16)id;
            bariera();
            q->avail.idx++;
        }
        bariera();
    }
    wr(z->base, VM_QUEUE_NOTIFY, 0);
}

void virtio_irq(u32 id)
{
    for (int i = 0; i < pocet; i++) {
        if (zar[i].irq != id) continue;
        u32 st = rd(zar[i].base, VM_INT_STATUS);
        wr(zar[i].base, VM_INT_ACK, st);
        zpracuj(i);
    }
}

/* ---------------- inicializace ---------------- */

static void cti_jmeno(struct zarizeni *z)
{
    volatile u8 *cfg = (volatile u8 *)(z->base);
    cfg[CFG_SELECT] = CFG_ID_NAME;
    cfg[CFG_SUBSEL] = 0;
    bariera();
    u32 n = cfg[CFG_SIZE];
    if (n > sizeof(z->jmeno) - 1) n = sizeof(z->jmeno) - 1;
    for (u32 j = 0; j < n; j++) z->jmeno[j] = (char)cfg[CFG_DATA + j];
    z->jmeno[n] = 0;
}

static int nastav(int i, u32 base, u32 verze)
{
    struct fronta *q = &fronty[i];

    wr(base, VM_STATUS, 0);                 /* reset */
    wr(base, VM_STATUS, ST_ACK);
    wr(base, VM_STATUS, ST_ACK | ST_DRIVER);

    if (verze == 2) {
        /* moderni: potvrdit VIRTIO_F_VERSION_1 (bit 32), nic jineho */
        wr(base, VM_DRV_FEAT_SEL, 0);
        wr(base, VM_DRV_FEAT, 0);
        wr(base, VM_DRV_FEAT_SEL, 1);
        wr(base, VM_DRV_FEAT, 1);
        wr(base, VM_STATUS, ST_ACK | ST_DRIVER | ST_FEATURES_OK);
        if (!(rd(base, VM_STATUS) & ST_FEATURES_OK)) return 0;
    } else {
        wr(base, VM_DRV_FEAT_SEL, 0);
        wr(base, VM_DRV_FEAT, 0);
        wr(base, VM_PAGE_SIZE, 4096);
    }

    wr(base, VM_QUEUE_SEL, 0);
    u32 max = rd(base, VM_QUEUE_MAX);
    if (max < QN) return 0;                 /* nase rozlozeni pocita s QN */
    wr(base, VM_QUEUE_NUM, QN);

    /* vsechny buffery dame zarizeni k zapisu */
    for (int j = 0; j < QN; j++) {
        q->desc[j].addr  = (u32)&udalosti[i][j];
        q->desc[j].len   = sizeof(struct udalost);
        q->desc[j].flags = DESC_F_WRITE;
        q->desc[j].next  = 0;
        q->avail.ring[j] = (u16)j;
    }
    q->avail.flags = 0;
    q->avail.idx = QN;
    bariera();

    if (verze == 2) {
        wr(base, VM_DESC_LO,  (u32)q->desc);   wr(base, VM_DESC_HI, 0);
        wr(base, VM_AVAIL_LO, (u32)&q->avail); wr(base, VM_AVAIL_HI, 0);
        wr(base, VM_USED_LO,  (u32)&q->used);  wr(base, VM_USED_HI, 0);
        wr(base, VM_QUEUE_READY, 1);
        wr(base, VM_STATUS, ST_ACK | ST_DRIVER | ST_FEATURES_OK | ST_DRIVER_OK);
    } else {
        wr(base, VM_QUEUE_ALIGN, 4096);
        wr(base, VM_QUEUE_PFN, (u32)q / 4096);
        wr(base, VM_STATUS, ST_ACK | ST_DRIVER | ST_DRIVER_OK);
    }
    wr(base, VM_QUEUE_NOTIFY, 0);
    return 1;
}

int virtio_init(void)
{
    for (u32 s = 0; s < VIRTIO_SLOTU && pocet < MAX_ZARIZENI; s++) {
        u32 base = VIRTIO_BASE + s * VIRTIO_KROK;
        if (rd(base, VM_MAGIC) != 0x74726976u) continue;   /* "virt" */
        u32 verze = rd(base, VM_VERZE);
        if (verze != 1 && verze != 2) continue;
        if (rd(base, VM_DEVICE_ID) != VIRTIO_ID_INPUT) continue;

        struct zarizeni *z = &zar[pocet];
        z->base = base;
        z->irq = IRQ_VIRTIO0 + s;
        z->verze = verze;
        z->posledni_used = 0;
        if (!nastav(pocet, base, verze)) continue;
        cti_jmeno(z);
        pocet++;
        if (irq_aktivni()) irq_povol(z->irq);   /* jinak polling z hlavni smycky */
    }
    return pocet;
}

/* bez preruseni: obslouzit fronty rucne (volano z cekaci smycky) */
void virtio_poll(void)
{
    for (int i = 0; i < pocet; i++)
        zpracuj(i);
}

void virtio_info(void (*puts)(const char *), void (*putn)(u32))
{
    for (int i = 0; i < pocet; i++) {
        puts("\n  + ");
        puts(zar[i].jmeno[0] ? zar[i].jmeno : "virtio-input");
        puts(" (IRQ ");
        putn(zar[i].irq);
        puts(zar[i].verze == 2 ? ", virtio 1.0)" : ", legacy)");
    }
}
