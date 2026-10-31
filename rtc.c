/*
 * LinsoftPhone OS - hodiny realneho casu PL031 (QEMU virt: 0x09010000)
 * RTCDR obsahuje sekundy od 1.1.1970; QEMU je bere z hostitele
 * (s -rtc base=localtime v mistnim case, jinak UTC).
 */

#include "hw.h"

#define RTC_DR      REG32(RTC_BASE + 0x000)
#define RTC_PERIPH0 REG32(RTC_BASE + 0xFE0)
#define RTC_PERIPH1 REG32(RTC_BASE + 0xFE4)

static int aktivni;

int rtc_init(void)
{
    /* PrimeCell ID: PL031 ma periph ID 0x31, 0x10 */
    aktivni = (RTC_PERIPH0 & 0xFF) == 0x31 && (RTC_PERIPH1 & 0xFF) == 0x10;
    return aktivni;
}

int rtc_aktivni(void) { return aktivni; }

u32 rtc_sekundy(void)
{
    return aktivni ? RTC_DR : 0;
}

/* prevod sekund od epochy na kalendarni datum (algoritmus "civil from days") */
void rtc_preved(u32 t, struct datum_cas *d)
{
    u32 dny = t / 86400, zbytek = t % 86400;
    d->hod = zbytek / 3600;
    d->min = (zbytek / 60) % 60;
    d->sek = zbytek % 60;
    d->den_tydne = (dny + 4) % 7;           /* 1.1.1970 byl ctvrtek */

    u32 z   = dny + 719468;                 /* posun na 1.3.0000 */
    u32 era = z / 146097;
    u32 doe = z - era * 146097;             /* den v 400letem cyklu */
    u32 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    u32 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    u32 mp  = (5 * doy + 2) / 153;          /* mesic od brezna */
    d->den   = doy - (153 * mp + 2) / 5 + 1;
    d->mesic = mp < 10 ? mp + 3 : mp - 9;
    d->rok   = yoe + era * 400 + (d->mesic <= 2);
}
