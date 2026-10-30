/* LinsoftPhone OS - graficke rozhrani (ramfb pres fw_cfg) */

#ifndef GFX_H
#define GFX_H

/* inicializace displeje; vraci 1 pri uspechu, 0 kdyz ramfb neni k dispozici */
int gfx_init(void);

/* vypis znaku do graficke konzole (scrolluje automaticky) */
void gfx_putc(char c);

/* smazani graficke konzole */
void gfx_clear(void);

/* aktualizace stavoveho radku (hodiny doby behu) */
void gfx_tick(unsigned int uptime_s);

/* je displej aktivni? */
int gfx_active(void);

#endif
