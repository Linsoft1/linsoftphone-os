/*
 * LinsoftPhone OS - graficky displej pres QEMU ramfb
 *
 * ramfb se konfiguruje zapisem struktury do fw_cfg souboru "etc/ramfb"
 * (fw_cfg MMIO na QEMU virt: 0x09020000, DMA rozhrani).
 * Framebuffer je obycejne pole v RAM, QEMU ho periodicky vykresluje.
 */

#include "gfx.h"
#include "font8x8.h"

typedef unsigned char  u8;
typedef unsigned short u16;
typedef unsigned int   u32;
typedef unsigned long long u64;

/* ---------------- fw_cfg (QEMU virt) ---------------- */

#define FWCFG_BASE   0x09020000u
#define FWCFG_DATA   (*(volatile u8  *)(FWCFG_BASE + 0x00))
#define FWCFG_SEL    (*(volatile u16 *)(FWCFG_BASE + 0x08))
#define FWCFG_DMA_HI (*(volatile u32 *)(FWCFG_BASE + 0x10))
#define FWCFG_DMA_LO (*(volatile u32 *)(FWCFG_BASE + 0x14))

#define FWCFG_FILE_DIR 0x19

#define FWCFG_DMA_ERROR  0x01u
#define FWCFG_DMA_READ   0x02u
#define FWCFG_DMA_SELECT 0x08u
#define FWCFG_DMA_WRITE  0x10u

static u16 bswap16(u16 v) { return (u16)((v >> 8) | (v << 8)); }
static u32 bswap32(u32 v)
{
    return (v >> 24) | ((v >> 8) & 0xFF00u) | ((v << 8) & 0xFF0000u) | (v << 24);
}
static u64 bswap64(u64 v)
{
    return ((u64)bswap32((u32)v) << 32) | bswap32((u32)(v >> 32));
}

struct fwcfg_dma {
    u32 control;    /* big-endian */
    u32 length;     /* big-endian */
    u64 address;    /* big-endian */
} __attribute__((packed));

/* DMA prenos: select polozky + cteni/zapis bufferu */
static int fwcfg_dma(u16 select, u32 ctrl_rw, void *buf, u32 len)
{
    static volatile struct fwcfg_dma dma __attribute__((aligned(16)));
    dma.control = bswap32(((u32)select << 16) | FWCFG_DMA_SELECT | ctrl_rw);
    dma.length  = bswap32(len);
    dma.address = bswap64((u32)buf);
    __asm__ volatile("dsb sy" ::: "memory");
    FWCFG_DMA_HI = 0;
    FWCFG_DMA_LO = bswap32((u32)&dma);
    while (bswap32(dma.control) & ~FWCFG_DMA_ERROR) { }
    return (bswap32(dma.control) & FWCFG_DMA_ERROR) ? 0 : 1;
}

struct fwcfg_file {
    u32 size;       /* big-endian */
    u16 select;     /* big-endian */
    u16 reserved;
    char name[56];
} __attribute__((packed));

static int fwcfg_find(const char *name, u16 *select_out)
{
    u32 count_be;
    if (!fwcfg_dma(FWCFG_FILE_DIR, FWCFG_DMA_READ, &count_be, 4))
        return 0;
    u32 count = bswap32(count_be);
    if (count > 256) return 0;

    for (u32 i = 0; i < count; i++) {
        /* polozky cteme postupne dalsimi DMA cteni (pokracuje v souboru) */
        struct fwcfg_file f;
        /* bez SELECT flagu pokracuje cteni tam, kde skoncilo */
        static volatile struct fwcfg_dma dma __attribute__((aligned(16)));
        dma.control = bswap32(FWCFG_DMA_READ);
        dma.length  = bswap32(sizeof(f));
        dma.address = bswap64((u32)&f);
        __asm__ volatile("dsb sy" ::: "memory");
        FWCFG_DMA_HI = 0;
        FWCFG_DMA_LO = bswap32((u32)&dma);
        while (bswap32(dma.control) & ~FWCFG_DMA_ERROR) { }
        if (bswap32(dma.control) & FWCFG_DMA_ERROR) return 0;

        int match = 1;
        for (int j = 0; j < 56; j++) {
            if (f.name[j] != name[j]) { match = 0; break; }
            if (!name[j]) break;
        }
        if (match) { *select_out = bswap16(f.select); return 1; }
    }
    return 0;
}

/* ---------------- ramfb ---------------- */

#define SIRKA  480
#define VYSKA  800
#define DRM_FORMAT_XRGB8888 0x34325258u

struct ramfb_cfg {
    u64 addr;
    u32 fourcc;
    u32 flags;
    u32 width;
    u32 height;
    u32 stride;
} __attribute__((packed));

static u32 fb[SIRKA * VYSKA];
static int aktivni;

/* ---------------- kresleni ---------------- */

#define BARVA_POZADI   0x101828u
#define BARVA_PANEL    0x1c2a44u
#define BARVA_AKCENT   0x3fa7f5u
#define BARVA_TEXT     0xe8f0f8u
#define BARVA_ZELENA   0x44cc66u

static void pixel(int x, int y, u32 c)
{
    if (x >= 0 && x < SIRKA && y >= 0 && y < VYSKA)
        fb[y * SIRKA + x] = c;
}

static void obdelnik(int x, int y, int w, int h, u32 c)
{
    for (int j = 0; j < h; j++)
        for (int i = 0; i < w; i++)
            pixel(x + i, y + j, c);
}

/* znak 8x8 zvetseny na scale */
static void znak(int x, int y, char ch, int scale, u32 barva)
{
    if ((unsigned char)ch > 127) ch = '?';
    const char *g = font8x8_basic[(int)ch];
    for (int ry = 0; ry < 8; ry++)
        for (int rx = 0; rx < 8; rx++)
            if (g[ry] & (1 << rx))
                obdelnik(x + rx * scale, y + ry * scale, scale, scale, barva);
}

static void text(int x, int y, const char *s, int scale, u32 barva)
{
    while (*s) {
        znak(x, y, *s++, scale, barva);
        x += 8 * scale;
    }
}

/* ---------------- graficka konzole ---------------- */

#define KONZ_X      16
#define KONZ_Y      120
#define KONZ_SCALE  2
#define ZNAK_PX     (8 * KONZ_SCALE)
#define SLOUPCE     ((SIRKA - 2 * KONZ_X) / ZNAK_PX)      /* 28 */
#define RADKY       ((VYSKA - KONZ_Y - 90) / ZNAK_PX)     /* ~36 */

static char mrizka[RADKY][SLOUPCE];
static int kx, ky;

static void kresli_znak_mrizky(int cx, int cy)
{
    int px = KONZ_X + cx * ZNAK_PX;
    int py = KONZ_Y + cy * ZNAK_PX;
    obdelnik(px, py, ZNAK_PX, ZNAK_PX, BARVA_POZADI);
    char c = mrizka[cy][cx];
    if (c > ' ')
        znak(px, py, c, KONZ_SCALE, BARVA_TEXT);
}

static void scroll(void)
{
    for (int y = 0; y < RADKY - 1; y++)
        for (int x = 0; x < SLOUPCE; x++)
            mrizka[y][x] = mrizka[y + 1][x];
    for (int x = 0; x < SLOUPCE; x++)
        mrizka[RADKY - 1][x] = ' ';
    for (int y = 0; y < RADKY; y++)
        for (int x = 0; x < SLOUPCE; x++)
            kresli_znak_mrizky(x, y);
}

static void kurzor(int zap)
{
    int px = KONZ_X + kx * ZNAK_PX;
    int py = KONZ_Y + ky * ZNAK_PX;
    obdelnik(px, py + ZNAK_PX - 3, ZNAK_PX, 3, zap ? BARVA_AKCENT : BARVA_POZADI);
}

void gfx_putc(char c)
{
    if (!aktivni) return;
    kurzor(0);
    if (c == '\n') {
        kx = 0;
        if (++ky >= RADKY) { ky = RADKY - 1; scroll(); }
    } else if (c == '\r') {
        kx = 0;
    } else if (c == '\b') {
        if (kx > 0) { kx--; mrizka[ky][kx] = ' '; kresli_znak_mrizky(kx, ky); }
    } else if (c >= 32 && c < 127) {
        mrizka[ky][kx] = c;
        kresli_znak_mrizky(kx, ky);
        if (++kx >= SLOUPCE) {
            kx = 0;
            if (++ky >= RADKY) { ky = RADKY - 1; scroll(); }
        }
    }
    kurzor(1);
}

void gfx_clear(void)
{
    if (!aktivni) return;
    for (int y = 0; y < RADKY; y++)
        for (int x = 0; x < SLOUPCE; x++) {
            mrizka[y][x] = ' ';
            kresli_znak_mrizky(x, y);
        }
    kx = 0;
    ky = 0;
    kurzor(1);
}

/* ---------------- stavovy radek + ramecek telefonu ---------------- */

static void stavovy_radek(unsigned int uptime_s)
{
    obdelnik(0, 0, SIRKA, 36, BARVA_PANEL);

    /* signal - stoupajici sloupce */
    for (int i = 0; i < 4; i++)
        obdelnik(14 + i * 9, 24 - i * 5, 6, 6 + i * 5, BARVA_ZELENA);

    text(70, 10, "Linsoft 5G", 2, BARVA_TEXT);

    /* hodiny (doba behu mm:ss) */
    unsigned int m = uptime_s / 60, s = uptime_s % 60;
    char cas[6] = { (char)('0' + (m / 10) % 10), (char)('0' + m % 10), ':',
                    (char)('0' + s / 10), (char)('0' + s % 10), 0 };
    text(SIRKA - 170, 10, cas, 2, BARVA_TEXT);

    /* baterie */
    obdelnik(SIRKA - 70, 10, 44, 18, BARVA_TEXT);
    obdelnik(SIRKA - 68, 12, 40, 14, BARVA_PANEL);
    obdelnik(SIRKA - 66, 14, 36, 10, BARVA_ZELENA);
    obdelnik(SIRKA - 26, 15, 5, 8, BARVA_TEXT);
}

static void hlavicka(void)
{
    obdelnik(0, 36, SIRKA, 64, BARVA_POZADI);
    text(KONZ_X, 52, "LinsoftPhone OS", 3, BARVA_AKCENT);
    obdelnik(KONZ_X, 92, SIRKA - 2 * KONZ_X, 2, BARVA_AKCENT);
}

static void spodni_listra(void)
{
    int y = VYSKA - 70;
    obdelnik(0, y, SIRKA, 70, BARVA_PANEL);
    /* domu - kruh (ctverec s rohy) */
    obdelnik(SIRKA / 2 - 16, y + 20, 32, 32, BARVA_PANEL);
    for (int j = 0; j < 32; j++)
        for (int i = 0; i < 32; i++) {
            int dx = i - 16, dy = j - 16;
            if (dx * dx + dy * dy <= 256 && dx * dx + dy * dy >= 169)
                pixel(SIRKA / 2 - 16 + i, y + 20 + j, BARVA_TEXT);
        }
    /* zpet - sipka */
    text(70, y + 24, "<", 3, BARVA_TEXT);
    /* aplikace - ctverecek */
    obdelnik(SIRKA - 94, y + 22, 24, 24, BARVA_TEXT);
    obdelnik(SIRKA - 90, y + 26, 16, 16, BARVA_PANEL);
}

/* ---------------- verejne API ---------------- */

static unsigned int posledni_s = 0xFFFFFFFFu;

void gfx_tick(unsigned int uptime_s)
{
    if (!aktivni || uptime_s == posledni_s) return;
    posledni_s = uptime_s;
    stavovy_radek(uptime_s);
}

int gfx_active(void) { return aktivni; }

int gfx_init(void)
{
    u16 sel;
    if (!fwcfg_find("etc/ramfb", &sel))
        return 0;

    static struct ramfb_cfg cfg __attribute__((aligned(16)));
    cfg.addr   = bswap64((u32)fb);
    cfg.fourcc = bswap32(DRM_FORMAT_XRGB8888);
    cfg.flags  = 0;
    cfg.width  = bswap32(SIRKA);
    cfg.height = bswap32(VYSKA);
    cfg.stride = bswap32(SIRKA * 4);

    if (!fwcfg_dma(sel, FWCFG_DMA_WRITE, &cfg, sizeof(cfg)))
        return 0;

    obdelnik(0, 0, SIRKA, VYSKA, BARVA_POZADI);
    for (int y = 0; y < RADKY; y++)
        for (int x = 0; x < SLOUPCE; x++)
            mrizka[y][x] = ' ';

    aktivni = 1;
    stavovy_radek(0);
    hlavicka();
    spodni_listra();
    kurzor(1);
    return 1;
}
