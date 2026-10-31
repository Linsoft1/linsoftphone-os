/*
 * LinsoftPhone OS - mini kernel pro ARM (QEMU -M virt, Cortex-A15)
 * Seriova konzole PL011, interaktivni shell s aplikacemi.
 * Preruseni (GICv2): timer tika hodiny, UART a virtio klavesnice/tablet
 * plni vstupni frontu, mezi znaky procesor spi (wfi). Realny cas z RTC PL031.
 * Poznamka: cestina bez diakritiky kvuli seriove konzoli.
 */

#include "hw.h"
#include "gfx.h"

static u32 uptime_s(void);

#define VERZE "1.2"
static void obnov_hodiny(void);

/* ---------------- UART PL011 (QEMU virt: 0x09000000) ---------------- */

#define UART0_BASE  0x09000000u
#define UART_DR     (*(volatile u32 *)(UART0_BASE + 0x00))
#define UART_FR     (*(volatile u32 *)(UART0_BASE + 0x18))
#define UART_FR_TXFF (1u << 5)
#define UART_FR_RXFE (1u << 4)

static void uart_putc(char c)
{
    while (UART_FR & UART_FR_TXFF) { }
    UART_DR = (u32)c;
}

/* dalsi vstupni znak (UART nebo virtio klavesnice, pripadne kod tlacitka) */
static int cti_vstup(void)
{
    for (;;) {
        int c = vstup_cekej();     /* spi pres wfi, dokud neprijde preruseni */
        if (c >= 0) return c;
        obnov_hodiny();            /* tik timeru: aktualizuj hodiny na displeji */
    }
}

/* vystup na UART i na graficky displej */
static void kputc(char c)
{
    if (c == '\n')
        uart_putc('\r');
    uart_putc(c);
    gfx_putc(c);
}

static void puts_raw(const char *s)
{
    while (*s)
        kputc(*s++);
}

static void put_u32(u32 n)
{
    char buf[12];
    int i = 0;
    if (n == 0) { kputc('0'); return; }
    while (n) { buf[i++] = '0' + (n % 10); n /= 10; }
    while (i--) kputc(buf[i]);
}

static void put_i32(int n)
{
    if (n < 0) { kputc('-'); put_u32((u32)(-n)); }
    else put_u32((u32)n);
}

static void put_hex(u32 n)
{
    puts_raw("0x");
    for (int i = 28; i >= 0; i -= 4) {
        u32 d = (n >> i) & 0xF;
        kputc(d < 10 ? '0' + d : 'a' + d - 10);
    }
}

/* ---------------- retezce ---------------- */

static int str_eq(const char *a, const char *b)
{
    while (*a && *a == *b) { a++; b++; }
    return *a == *b;
}

static int str_starts(const char *s, const char *prefix)
{
    while (*prefix) {
        if (*s++ != *prefix++) return 0;
    }
    return 1;
}

static u32 str_len(const char *s)
{
    u32 n = 0;
    while (*s++) n++;
    return n;
}

static void str_copy(char *dst, const char *src, u32 max)
{
    u32 i = 0;
    while (src[i] && i + 1 < max) { dst[i] = src[i]; i++; }
    dst[i] = 0;
}

/* ---------------- generic timer (uptime) ---------------- */

static inline u32 read_cntfrq(void)
{
    u32 v;
    __asm__ volatile("mrc p15, 0, %0, c14, c0, 0" : "=r"(v));
    return v;
}

static inline u64 read_cntvct(void)
{
    u32 lo, hi;
    __asm__ volatile("mrrc p15, 1, %0, %1, c14" : "=r"(lo), "=r"(hi));
    return ((u64)hi << 32) | lo;
}

/* 64/32bit deleni bez knihovny (shift-subtract) */
static u64 udiv64_32(u64 n, u32 d, u32 *rem)
{
    u64 q = 0;
    u64 r = 0;
    for (int i = 63; i >= 0; i--) {
        r = (r << 1) | ((n >> i) & 1);
        if (r >= d) { r -= d; q |= (u64)1 << i; }
    }
    if (rem) *rem = (u32)r;
    return q;
}

static u32 uptime_s(void)
{
    u32 f = read_cntfrq();
    if (f == 0) return 0;
    return (u32)udiv64_32(read_cntvct(), f, 0);
}

/* ---------------- PSCI (restart / vypnuti) ---------------- */

#define PSCI_SYSTEM_OFF   0x84000008u
#define PSCI_SYSTEM_RESET 0x84000009u

static void psci_call(u32 fn)
{
    register u32 r0 __asm__("r0") = fn;
    __asm__ volatile("hvc #0" : "+r"(r0) : : "r1", "r2", "r3", "memory");
}

/* ---------------- cteni radku ---------------- */

#define PROMPT "linsoft> "

static void app_pomoc(void);
static void vymaz_obrazovku(void);

/* znovu vypise prompt a rozepsany radek (po akci tlacitka) */
static void obnov_radek(const char *buf, u32 n)
{
    puts_raw(PROMPT);
    for (u32 j = 0; j < n; j++) kputc(buf[j]);
}

static void read_line(char *buf, u32 max)
{
    u32 i = 0;
    for (;;) {
        int c = cti_vstup();
        /* tlacitka spodni listy na displeji (virtio tablet) */
        if (c == VSTUP_ZPET) {          /* zpet: smaze rozepsany radek */
            while (i > 0) { i--; puts_raw("\b \b"); }
            continue;
        }
        if (c == VSTUP_DOMU) {          /* domu: cista obrazovka */
            vymaz_obrazovku();
            gfx_domu();
            obnov_hodiny();
            obnov_radek(buf, i);
            continue;
        }
        if (c == VSTUP_APLIKACE) {      /* aplikace: seznam prikazu */
            puts_raw("\n");
            app_pomoc();
            obnov_radek(buf, i);
            continue;
        }
        if (c == '\r' || c == '\n') {
            puts_raw("\n");
            buf[i] = 0;
            return;
        }
        if (c == 0x7F || c == 0x08) {   /* backspace */
            if (i > 0) { i--; puts_raw("\b \b"); }
            continue;
        }
        if (c >= 32 && c < 127 && i + 1 < max) {
            buf[i++] = c;
            kputc(c);
        }
    }
}

/* ---------------- aplikace: kalkulacka ---------------- */
/* rekurzivni sestup: vyraz s + - * / a zavorkami */

static const char *kp;
static int kalk_err;

static int kalk_expr(void);

static void kalk_skip(void) { while (*kp == ' ') kp++; }

static int kalk_atom(void)
{
    kalk_skip();
    if (*kp == '(') {
        kp++;
        int v = kalk_expr();
        kalk_skip();
        if (*kp == ')') kp++; else kalk_err = 1;
        return v;
    }
    int neg = 0;
    if (*kp == '-') { neg = 1; kp++; }
    if (*kp < '0' || *kp > '9') { kalk_err = 1; return 0; }
    int v = 0;
    while (*kp >= '0' && *kp <= '9') { v = v * 10 + (*kp - '0'); kp++; }
    return neg ? -v : v;
}

static int kalk_term(void)
{
    int v = kalk_atom();
    for (;;) {
        kalk_skip();
        if (*kp == '*') { kp++; v *= kalk_atom(); }
        else if (*kp == '/') {
            kp++;
            int d = kalk_atom();
            if (d == 0) { kalk_err = 2; return 0; }
            v /= d;
        }
        else return v;
    }
}

static int kalk_expr(void)
{
    int v = kalk_term();
    for (;;) {
        kalk_skip();
        if (*kp == '+') { kp++; v += kalk_term(); }
        else if (*kp == '-') { kp++; v -= kalk_term(); }
        else return v;
    }
}

static void app_kalk(const char *vyraz)
{
    kp = vyraz;
    kalk_err = 0;
    int v = kalk_expr();
    kalk_skip();
    if (*kp != 0 && !kalk_err) kalk_err = 1;
    if (kalk_err == 2)      puts_raw("Chyba: deleni nulou!\n");
    else if (kalk_err)      puts_raw("Chyba: neplatny vyraz.\n");
    else { puts_raw("= "); put_i32(v); puts_raw("\n"); }
}

/* ---------------- aplikace: zpravy ---------------- */

#define MAX_ZPRAV 16
#define DELKA_ZPRAVY 96

static char zpravy[MAX_ZPRAV][DELKA_ZPRAVY];
static u32 pocet_zprav;

static void app_zprava(const char *text)
{
    if (!*text) { puts_raw("Pouziti: zprava <text>\n"); return; }
    if (pocet_zprav >= MAX_ZPRAV) {
        for (u32 i = 1; i < MAX_ZPRAV; i++)
            str_copy(zpravy[i - 1], zpravy[i], DELKA_ZPRAVY);
        pocet_zprav = MAX_ZPRAV - 1;
    }
    str_copy(zpravy[pocet_zprav++], text, DELKA_ZPRAVY);
    puts_raw("Zprava ulozena.\n");
}

static void app_zpravy(void)
{
    if (pocet_zprav == 0) { puts_raw("Zadne zpravy.\n"); return; }
    puts_raw("--- Zpravy ---\n");
    for (u32 i = 0; i < pocet_zprav; i++) {
        put_u32(i + 1);
        puts_raw(". ");
        puts_raw(zpravy[i]);
        puts_raw("\n");
    }
}

/* ---------------- aplikace: kontakty ---------------- */

static void app_kontakty(void)
{
    puts_raw("--- Kontakty ---\n");
    puts_raw("  Mama        +420 601 111 222\n");
    puts_raw("  Tata        +420 602 333 444\n");
    puts_raw("  Linsoft HQ  +420 800 123 456\n");
    puts_raw("  Tisnova linka        112\n");
}

/* ---------------- aplikace: info / cas ---------------- */

static void app_info(void)
{
    u32 midr;
    __asm__ volatile("mrc p15, 0, %0, c0, c0, 0" : "=r"(midr));
    puts_raw("--- LinsoftPhone OS ---\n");
    puts_raw("Verze:    " VERZE " (kernel)\n");
    puts_raw("Arch:     ARMv7-A (32bit)\n");
    puts_raw("Stroj:    QEMU virt\n");
    puts_raw("CPU MIDR: "); put_hex(midr); puts_raw("\n");
    puts_raw("UART:     PL011 @ "); put_hex(UART0_BASE); puts_raw("\n");
    puts_raw("Displej:  ");
    puts_raw(gfx_active() ? "ramfb 480x800 (aktivni)\n" : "neni (seriova konzole)\n");
    puts_raw("RTC:      ");
    puts_raw(rtc_aktivni() ? "PL031 @ 0x09010000\n" : "neni\n");
    puts_raw("Takt timeru: "); put_u32(read_cntfrq()); puts_raw(" Hz\n");
    puts_raw("Preruseni: ");
    if (irq_aktivni()) {
        puts_raw("GICv2, timer PPI 27, UART IRQ 33\n");
        puts_raw("  tiku: "); put_u32(irq_tiky());
        puts_raw(", IRQ celkem: "); put_u32(irq_pocet()); puts_raw("\n");
    } else {
        puts_raw("vypnuta (polling)\n");
    }
    puts_raw("Vstup:    UART");
    virtio_info(puts_raw, put_u32);
    puts_raw("\n");
}

static void app_cas(void)
{
    u32 s = uptime_s();
    puts_raw("Doba behu: ");
    put_u32(s / 60); puts_raw(" min ");
    put_u32(s % 60); puts_raw(" s\n");
}

/* dvouciferne cislo s nulou na zacatku */
static void put_2(u32 n)
{
    kputc('0' + (n / 10) % 10);
    kputc('0' + n % 10);
}

static void app_datum(void)
{
    static const char *dny[7] = { "nedele", "pondeli", "utery", "streda",
                                  "ctvrtek", "patek", "sobota" };
    if (!rtc_aktivni()) { puts_raw("RTC neni k dispozici.\n"); return; }
    struct datum_cas d;
    rtc_preved(rtc_sekundy(), &d);
    puts_raw("Dnes je "); puts_raw(dny[d.den_tydne]); puts_raw(" ");
    put_u32(d.den); puts_raw(". "); put_u32(d.mesic); puts_raw(". ");
    put_u32(d.rok); puts_raw("\nCas:     ");
    put_2(d.hod); kputc(':'); put_2(d.min); kputc(':'); put_2(d.sek);
    puts_raw("\n");
}

/* hodiny ve stavovem radku: realny cas z RTC, bez RTC aspon doba behu */
static void obnov_hodiny(void)
{
    if (!gfx_active()) return;
    if (rtc_aktivni()) {
        struct datum_cas d;
        rtc_preved(rtc_sekundy(), &d);
        gfx_tick(d.hod, d.min, (d.sek & 1) == 0);
    } else {
        u32 s = uptime_s();
        gfx_tick((s / 3600) % 24, (s / 60) % 60, (s & 1) == 0);
    }
}

/* ---------------- shell ---------------- */

static void app_pomoc(void)
{
    puts_raw("Dostupne prikazy:\n");
    puts_raw("  pomoc            - tento seznam\n");
    puts_raw("  info             - informace o systemu\n");
    puts_raw("  cas              - doba behu systemu\n");
    puts_raw("  datum            - dnesni datum a cas (RTC)\n");
    puts_raw("  kalk <vyraz>     - kalkulacka (+ - * / a zavorky)\n");
    puts_raw("  zprava <text>    - ulozit zpravu\n");
    puts_raw("  zpravy           - vypsat zpravy\n");
    puts_raw("  kontakty         - seznam kontaktu\n");
    puts_raw("  vymaz            - smazat obrazovku\n");
    puts_raw("  restart          - restart systemu\n");
    puts_raw("  vypni            - vypnout telefon\n");
    puts_raw("Psat lze i v okne QEMU (klavesnice).\n");
    puts_raw("Dotyk na spodni liste: < smaze radek,\n");
    puts_raw("  O domovska obrazovka, [] seznam prikazu.\n");
}

/* vystup pouze na UART (bez displeje) */
static void puts_uart(const char *s)
{
    while (*s) {
        if (*s == '\n')
            uart_putc('\r');
        uart_putc(*s++);
    }
}

static void logo(void)
{
    /* ASCII logo jen na seriovou konzoli - na displeji je graficka hlavicka */
    puts_uart("\n");
    puts_uart("  ##                _     _                  __ _\n");
    puts_uart("  ##               | |   (_)_ __  ___  ___  / _| |_\n");
    puts_uart("  ##\"\"\"--._        | |   | | '_ \\/ __|/ _ \\| |_| __|\n");
    puts_uart("  ##       `.      | |___| | | | \\__ \\ (_) |  _| |_\n");
    puts_uart("  ##\"\"\"-._  \\      |_____|_|_| |_|___/\\___/|_|  \\__|\n");
    puts_uart("  ##      `. \\      ____  _                      ___  ____\n");
    puts_uart("  ##        \\ |    |  _ \\| |__   ___  _ __   ___ / _ \\/ ___|\n");
    puts_uart("  ##        | |    | |_) | '_ \\ / _ \\| '_ \\ / _ \\ | | \\___ \\\n");
    puts_uart("  ##############   |  __/| | | | (_) | | | |  __/ |_| |___) |\n");
    puts_uart("                   |_|   |_| |_|\\___/|_| |_|\\___| \\___/|____/\n");
    puts_uart("\n");
}

static void vymaz_obrazovku(void)
{
    puts_uart("\x1b[2J\x1b[H");     /* ANSI jen na UART */
    gfx_clear();
}

/* fatalni vyjimka (volano z boot.S): vypis na UART a stop */
void vyjimka(u32 typ, u32 adresa)
{
    static const char *nazvy[5] = { "?", "nedefinovana instrukce", "svc",
                                     "prefetch abort", "data abort" };
    puts_uart("\n!!! Vyjimka: ");
    puts_uart(nazvy[typ < 5 ? typ : 0]);
    puts_uart(" na adrese ");
    put_hex(adresa);
    puts_uart("\nSystem zastaven.\n");
}

static void banner(void)
{
    logo();
    puts_raw("=== LinsoftPhone OS " VERZE " ===\n");
    puts_raw("Kernel nastartoval. Napis 'pomoc' pro seznam prikazu.\n\n");
}

void kmain(void)
{
    char radek[128];

    /* uvodni obrazovka s logem (~1,5 s, ceka se na generic timer - funguje i bez IRQ) */
    if (gfx_init()) {
        gfx_uvod(VERZE);
        u32 f = read_cntfrq();
        u64 start = read_cntvct();
        for (int p = 0; f && p <= 100; p += 4) {
            gfx_uvod_postup(p);
            while (read_cntvct() - start < udiv64_32((u64)f * (u32)p, 66, 0)) ;
        }
        gfx_domu();
    }
    rtc_init();
    irq_init();         /* GIC + timer + UART RX; pri chybe zustane polling */
    virtio_init();      /* klavesnice/tablet; bez nich jen seriovy vstup */
    obnov_hodiny();
    banner();

    for (;;) {
        puts_raw(PROMPT);
        read_line(radek, sizeof(radek));

        /* orez uvodni mezery */
        const char *cmd = radek;
        while (*cmd == ' ') cmd++;

        if (!*cmd)                       continue;
        else if (str_eq(cmd, "pomoc") || str_eq(cmd, "napoveda") || str_eq(cmd, "help"))
            app_pomoc();
        else if (str_eq(cmd, "info"))    app_info();
        else if (str_eq(cmd, "cas"))     app_cas();
        else if (str_eq(cmd, "datum"))   app_datum();
        else if (str_starts(cmd, "kalk ")) app_kalk(cmd + 5);
        else if (str_eq(cmd, "kalk"))    puts_raw("Pouziti: kalk <vyraz>, napr. kalk (2+3)*4\n");
        else if (str_starts(cmd, "zprava ")) app_zprava(cmd + 7);
        else if (str_eq(cmd, "zprava")) app_zprava("");
        else if (str_eq(cmd, "zpravy"))  app_zpravy();
        else if (str_eq(cmd, "kontakty")) app_kontakty();
        else if (str_eq(cmd, "vymaz"))   vymaz_obrazovku();
        else if (str_eq(cmd, "restart")) {
            logo();
            puts_raw("Restartuji LinsoftPhone OS...\n");
            psci_call(PSCI_SYSTEM_RESET);
            puts_raw("Restart selhal.\n");
        }
        else if (str_eq(cmd, "vypni")) {
            puts_raw("Vypinam telefon... Ahoj!\n");
            psci_call(PSCI_SYSTEM_OFF);
            puts_raw("Vypnuti selhalo.\n");
        }
        else {
            puts_raw("Neznamy prikaz: '");
            puts_raw(cmd);
            puts_raw("'. Napis 'pomoc'.\n");
        }

        (void)str_len;
    }
}
