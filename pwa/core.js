/* LinsoftPhone OS PWA - cista logika bez DOM (testuje se v Node: npm test) */
(function (glob) {
"use strict";

/* ---------------- preklady ---------------- */
const TEXTY = {
  cs: {
    dny: ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"],
    dnyKratke: ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"],
    mesice: ["leden", "únor", "březen", "duben", "květen", "červen",
      "červenec", "srpen", "září", "říjen", "listopad", "prosinec"],
    mesice2: ["ledna", "února", "března", "dubna", "května", "června",
      "července", "srpna", "září", "října", "listopadu", "prosince"],
    app_telefon: "Telefon", app_zpravy: "Zprávy", app_kontakty: "Kontakty",
    app_kalk: "Kalkulačka", app_hodiny: "Hodiny", app_kalendar: "Kalendář",
    app_poznamky: "Poznámky", app_fotak: "Fotoaparát", app_galerie: "Galerie",
    app_terminal: "Terminál", app_nastaveni: "Nastavení",
    lock_hint: "Přejeď nahoru nebo klepni", pin_zadej: "Zadej PIN", pin_spatne: "Špatný PIN",
    notif: "Notifikace", notif_vymaz: "Vymazat", notif_zadne: "Žádné notifikace",
    vitej_t: "Vítej v LinsoftPhone OS", vitej_s: "Systém je připraven.",
    tile_torch: "Svítilna", tile_motiv: "Motiv", tile_full: "Celá obrazovka", tile_zamek: "Zamknout",
    torch_ne: "Svítilnu tento telefon nebo prohlížeč nepodporuje.",
    full_ne: "Celou obrazovku tento prohlížeč nepodporuje.",
    nedavne: "Nedávné aplikace", nedavne_zadne: "Žádné nedávné aplikace", zavri_vse: "Zavřít vše",
    zpet: "Zpět", domu: "Domů",
    volam: "Volám {n}…",
    sms_komu: "Číslo příjemce", sms_text: "Napiš zprávu…", sms_zadne: "Žádné zprávy. Napiš první!",
    sms_odeslano: "Odesláno: {n}", sms_info: "Zpráva se odešle přes SMS aplikaci telefonu.",
    kt_jmeno: "Jméno", kt_cislo: "Číslo", kt_pridat: "Přidat kontakt",
    kt_import: "Importovat z telefonu", kt_importovano: "Importováno kontaktů: {n}",
    chyba: "Chyba",
    hd_hodiny: "Hodiny", hd_budik: "Budík", hd_minutka: "Minutka", hd_stopky: "Stopky",
    start: "Start", stop: "Stop", reset: "Reset", pridat: "Přidat", smazat: "Smazat",
    budik_pridat: "Přidat budík", budik_zvoni: "Budík {n}", vypnout: "Vypnout",
    minutka_konec: "Minutka skončila", budik_info: "Budík zvoní, jen když je LinsoftOS otevřený.",
    budik_zadny: "Žádné budíky",
    kal_udalost: "Nová událost…", kal_zadne: "Žádné události",
    pz_ph: "Piš si poznámky… ukládají se automaticky.", pz_ulozeno: "Uloženo v telefonu.",
    cam_vyfot: "📸 Vyfotit", cam_ne: "Kamera není dostupná (potřebuje HTTPS a povolení).",
    cam_ulozeno: "Fotka uložena do Galerie.",
    gal_prazdna: "Galerie je prázdná. Vyfoť něco ve Fotoaparátu!", gal_smaz_vse: "Smazat vše",
    gal_stahnout: "Stáhnout",
    st_motiv: "Světlý motiv", st_jazyk: "Jazyk", st_pin: "PIN zámek",
    st_pin_novy: "Zadej nový 4místný PIN", st_pin_znovu: "Zopakuj PIN", st_pin_neshoda: "PINy se neshodují",
    st_pin_nastaven: "PIN nastaven.", st_pin_zrusen: "PIN zrušen.",
    st_notif: "Systémové notifikace", st_notif_zakaz: "Notifikace jsou v prohlížeči zakázané.",
    st_zaloha: "Zálohovat data", st_obnov: "Obnovit ze zálohy",
    st_obnoveno: "Data obnovena.", st_obnov_chyba: "Neplatný soubor zálohy.",
    st_o: "O systému",
    st_o_text: "Běží jako progresivní webová aplikace — funguje na Androidu, iPhonu i počítači.<br>Nainstaluj přes menu prohlížeče: „Přidat na plochu“.",
    st_reset: "Tovární nastavení (smazat data)", st_reset_q: "Opravdu smazat všechna data?",
    zap: "Zap", vyp: "Vyp",
    hovor_prichozi: "Příchozí hovor", hovor_volam: "Volám…", hovor_aktivni: "Probíhá hovor",
    prijmout: "Přijmout", zavesit: "Zavěsit", chyba_n: "Chyba: {n}",
    sms_info_nativ: "Zpráva se odešle přímo z modemu telefonu.",
    nativ_info: "Běží jako vlastní systém telefonu (postmarketOS).",
    st_jas: "Jas", st_wifi: "Wi-Fi sítě", st_wifi_heslo: "Heslo Wi-Fi", st_pripojit: "Připojit",
    st_pripojeno: "Připojeno: {n}", st_vypnout: "Vypnout telefon", st_restart: "Restartovat",
    st_vypnout_q: "Opravdu vypnout telefon?", st_restart_q: "Opravdu restartovat telefon?",
    kb_skryt: "Skrýt klávesnici", mezera: "mezera",
    st_tapeta: "Tapeta", tap_polar: "Polární záře", tap_zapad: "Západ slunce", tap_les: "Les",
    tap_noc: "Noc", tap_foto: "Fotka z Galerie", gal_tapeta: "Nastavit jako tapetu",
    tapeta_ok: "Tapeta nastavena.", w_volno: "Dnes nic v kalendáři", w_budik: "Budík",
    sk_vzhled: "Vzhled", sk_pripojeni: "Připojení", sk_zabezpeceni: "Zabezpečení a soukromí",
    sk_system: "Systém", sk_telefon: "Telefon", st_verze: "Verze {n}", st_pwa: "Webová aplikace (PWA)",
    kt_hledat: "Hledat", kt_novy: "Nový kontakt", kt_upravit: "Upravit", kt_volat: "Volat", kt_zprava: "Zpráva",
    kt_nic: "Nic nenalezeno", kt_zadne: "Zatím žádné kontakty", kt_smazat_q: "Smazat kontakt {n}?",
    ulozit: "Uložit", zrusit: "Zrušit",
    info_softver: "Software", info_zarizeni: "Zařízení", info_stav: "Stav", info_data: "Data",
    info_system: "Systém", info_zostaveni: "Sestavení", info_rozhrani: "Rozhraní", info_nativ: "Vlastní systém telefonu",
    info_distribuce: "Distribuce", info_jadro: "Jádro", info_prohlizec: "Prohlížeč", info_model: "Model",
    info_platforma: "Platforma", info_displej: "Displej", info_procesor: "Procesor", info_jader: "{n} jader",
    info_pamet: "Paměť", info_uloziste: "Úložiště", info_obsazeno: "{n} obsazeno", info_baterie: "Baterie",
    info_nabiji: "nabíjí se", info_sit: "Síť", info_online: "připojeno", info_offline: "bez připojení",
    info_operator: "Operátor", info_signal: "Signál", info_beh: "Doba běhu", info_aplikace: "Aplikace",
    info_fotky: "Fotky", info_zdroj: "Zdrojový kód", info_nezname: "neznámé", info_autor: "Autor",
    app_prehliadac: "Linsoft Browser", pr_hledat: "Hledej nebo zadej adresu", pr_nova_karta: "Nová karta",
    pr_karty: "Karty", pr_zalozky: "Záložky", pr_historie: "Historie", pr_pridat_zalozku: "Přidat záložku",
    pr_odebrat_zalozku: "Odebrat záložku", pr_mimo: "Otevřít mimo LinsoftPhone OS", pr_o: "O prohlížeči",
    pr_vymazat: "Vymazat historii", pr_prazdne: "Zatím nic", pr_rychle: "Rychlý přístup",
    pr_zavrit_karty: "Zavřít všechny karty", pr_obnovit: "Obnovit", pr_vpred: "Vpřed", pr_menu: "Nabídka",
    pr_tip: "Některé weby (Facebook, GitHub, YouTube) nedovolí zobrazení uvnitř jiné aplikace. Pak použij „Otevřít mimo“.",
    pr_o_text: "Webový prohlížeč LinsoftPhone OS. Stránky běží odděleně (sandbox) a nemohou ovládat systém.",
    pr_sukromna: "Nová soukromá karta", pr_sukromna_info: "Soukromá karta: historie se neukládá.",
    pr_zdilet: "Sdílet odkaz", pr_skopirovano: "Odkaz zkopírován.", pr_nastaveni: "Nastavení prohlížeče",
    pr_hledac: "Vyhledávač", pr_hledat_v: "Hledat „{n}“", pr_blok_nadpis: "Tuto stránku tu nelze zobrazit",
    pr_blok_text: "Web {n} nedovoluje zobrazení uvnitř jiné aplikace.", pr_offline_nadpis: "Bez připojení",
    pr_offline_text: "Zkontroluj Wi-Fi nebo mobilní data.", pr_znovu: "Zkusit znovu",
    pr_vymazat_vse: "Vymazat všechna data prohlížeče", pr_vymazano: "Data prohlížeče vymazána.",
    tel_klavesnice: "Klávesnice", tel_nedavne: "Nedávné", tel_zadne: "Zatím žádné hovory",
    tel_odchozi: "Odchozí", tel_prichozi: "Příchozí", tel_zmeskany: "Zmeškaný hovor",
    zpr_nova: "Nová zpráva", zpr_zadne: "Zatím žádné zprávy", zpr_ty: "Ty",
    gal_dnes: "Dnes", gal_vcera: "Včera", gal_fotky: "Fotky · {n}", gal_zdilet: "Sdílet",
    gal_otevrit_fotak: "Otevřít fotoaparát", gal_smazat_q: "Smazat tuto fotku?", gal_smazat_vse_q: "Smazat všechny fotky?",
    cam_prepnout: "Přepnout fotoaparát", cam_blesk: "Blesk", cam_casovac: "Samospoušť", cam_posledni: "Poslední fotka",
    pz_nova: "Nová poznámka", pz_zadne: "Zatím žádné poznámky", pz_smazat_q: "Smazat poznámku?",
    pz_bez_nazvu: "Bez názvu", pz_barva: "Barva",
    hd_kolo: "Kolo", hd_pauza: "Pauza", hd_pokracovat: "Pokračovat", hd_svet: "Světový čas",
    budik_novy: "Nový budík", budik_kazdy: "Každý den", kal_cas: "Čas", kal_cely_den: "Celý den",
    kal_dnes: "Dnes", kal_nova: "Nová událost", ter_prikazy: "Příkazy",
    hl_hledat: "Hledat v telefonu", hl_web: "Hledat na webu „{n}“", st_plocha: "Plocha",
    st_plocha_info: "Pořadí aplikací na ploše a které jsou v doku (hvězdička, nejvýš 4).",
    st_auto_motiv: "Automatický motiv", st_auto_motiv_info: "Světlý přes den (7:00–19:00)",
    pl_dok: "V doku", pl_max: "Dok má nejvýš 4 aplikace.", pl_nahoru: "Posunout nahoru", pl_dolu: "Posunout dolů",
    st_navigace: "Navigace", nav_tlacitka: "Tlačítka", nav_gesta: "Gesta",
    nav_gesta_info: "Proužek dole: nahoru = plocha, dlouze nahoru = nedávné, do strany = zpět"
  },
  sk: {
    dny: ["nedeľa", "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota"],
    dnyKratke: ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"],
    mesice: ["január", "február", "marec", "apríl", "máj", "jún",
      "júl", "august", "september", "október", "november", "december"],
    mesice2: ["januára", "februára", "marca", "apríla", "mája", "júna",
      "júla", "augusta", "septembra", "októbra", "novembra", "decembra"],
    app_telefon: "Telefón", app_zpravy: "Správy", app_kontakty: "Kontakty",
    app_kalk: "Kalkulačka", app_hodiny: "Hodiny", app_kalendar: "Kalendár",
    app_poznamky: "Poznámky", app_fotak: "Fotoaparát", app_galerie: "Galéria",
    app_terminal: "Terminál", app_nastaveni: "Nastavenia",
    lock_hint: "Potiahni nahor alebo ťukni", pin_zadej: "Zadaj PIN", pin_spatne: "Nesprávny PIN",
    notif: "Notifikácie", notif_vymaz: "Vymazať", notif_zadne: "Žiadne notifikácie",
    vitej_t: "Vitaj v LinsoftPhone OS", vitej_s: "Systém je pripravený.",
    tile_torch: "Baterka", tile_motiv: "Motív", tile_full: "Celá obrazovka", tile_zamek: "Zamknúť",
    torch_ne: "Baterku tento telefón alebo prehliadač nepodporuje.",
    full_ne: "Celú obrazovku tento prehliadač nepodporuje.",
    nedavne: "Nedávne aplikácie", nedavne_zadne: "Žiadne nedávne aplikácie", zavri_vse: "Zavrieť všetko",
    zpet: "Späť", domu: "Domov",
    volam: "Volám {n}…",
    sms_komu: "Číslo príjemcu", sms_text: "Napíš správu…", sms_zadne: "Žiadne správy. Napíš prvú!",
    sms_odeslano: "Odoslané: {n}", sms_info: "Správa sa odošle cez SMS aplikáciu telefónu.",
    kt_jmeno: "Meno", kt_cislo: "Číslo", kt_pridat: "Pridať kontakt",
    kt_import: "Importovať z telefónu", kt_importovano: "Importované kontakty: {n}",
    chyba: "Chyba",
    hd_hodiny: "Hodiny", hd_budik: "Budík", hd_minutka: "Minútka", hd_stopky: "Stopky",
    start: "Štart", stop: "Stop", reset: "Reset", pridat: "Pridať", smazat: "Zmazať",
    budik_pridat: "Pridať budík", budik_zvoni: "Budík {n}", vypnout: "Vypnúť",
    minutka_konec: "Minútka skončila", budik_info: "Budík zvoní, len keď je LinsoftOS otvorený.",
    budik_zadny: "Žiadne budíky",
    kal_udalost: "Nová udalosť…", kal_zadne: "Žiadne udalosti",
    pz_ph: "Píš si poznámky… ukladajú sa automaticky.", pz_ulozeno: "Uložené v telefóne.",
    cam_vyfot: "📸 Odfotiť", cam_ne: "Kamera nie je dostupná (potrebuje HTTPS a povolenie).",
    cam_ulozeno: "Fotka uložená do Galérie.",
    gal_prazdna: "Galéria je prázdna. Odfoť niečo vo Fotoaparáte!", gal_smaz_vse: "Zmazať všetko",
    gal_stahnout: "Stiahnuť",
    st_motiv: "Svetlý motív", st_jazyk: "Jazyk", st_pin: "PIN zámok",
    st_pin_novy: "Zadaj nový 4-miestny PIN", st_pin_znovu: "Zopakuj PIN", st_pin_neshoda: "PIN-y sa nezhodujú",
    st_pin_nastaven: "PIN nastavený.", st_pin_zrusen: "PIN zrušený.",
    st_notif: "Systémové notifikácie", st_notif_zakaz: "Notifikácie sú v prehliadači zakázané.",
    st_zaloha: "Zálohovať dáta", st_obnov: "Obnoviť zo zálohy",
    st_obnoveno: "Dáta obnovené.", st_obnov_chyba: "Neplatný súbor zálohy.",
    st_o: "O systéme",
    st_o_text: "Beží ako progresívna webová aplikácia — funguje na Androide, iPhone aj počítači.<br>Nainštaluj cez menu prehliadača: „Pridať na plochu“.",
    st_reset: "Továrenské nastavenia (zmazať dáta)", st_reset_q: "Naozaj zmazať všetky dáta?",
    zap: "Zap", vyp: "Vyp",
    hovor_prichozi: "Prichádzajúci hovor", hovor_volam: "Volám…", hovor_aktivni: "Prebieha hovor",
    prijmout: "Prijať", zavesit: "Zložiť", chyba_n: "Chyba: {n}",
    sms_info_nativ: "Správa sa odošle priamo z modemu telefónu.",
    nativ_info: "Beží ako vlastný systém telefónu (postmarketOS).",
    st_jas: "Jas", st_wifi: "Wi-Fi siete", st_wifi_heslo: "Heslo Wi-Fi", st_pripojit: "Pripojiť",
    st_pripojeno: "Pripojené: {n}", st_vypnout: "Vypnúť telefón", st_restart: "Reštartovať",
    st_vypnout_q: "Naozaj vypnúť telefón?", st_restart_q: "Naozaj reštartovať telefón?",
    kb_skryt: "Skryť klávesnicu", mezera: "medzera",
    st_tapeta: "Tapeta", tap_polar: "Polárna žiara", tap_zapad: "Západ slnka", tap_les: "Les",
    tap_noc: "Noc", tap_foto: "Fotka z Galérie", gal_tapeta: "Nastaviť ako tapetu",
    tapeta_ok: "Tapeta nastavená.", w_volno: "Dnes nič v kalendári", w_budik: "Budík",
    sk_vzhled: "Vzhľad", sk_pripojeni: "Pripojenie", sk_zabezpeceni: "Zabezpečenie a súkromie",
    sk_system: "Systém", sk_telefon: "Telefón", st_verze: "Verzia {n}", st_pwa: "Webová aplikácia (PWA)",
    kt_hledat: "Hľadať", kt_novy: "Nový kontakt", kt_upravit: "Upraviť", kt_volat: "Volať", kt_zprava: "Správa",
    kt_nic: "Nič sa nenašlo", kt_zadne: "Zatiaľ žiadne kontakty", kt_smazat_q: "Zmazať kontakt {n}?",
    ulozit: "Uložiť", zrusit: "Zrušiť",
    info_softver: "Softvér", info_zarizeni: "Zariadenie", info_stav: "Stav", info_data: "Dáta",
    info_system: "Systém", info_zostaveni: "Zostavenie", info_rozhrani: "Rozhranie", info_nativ: "Vlastný systém telefónu",
    info_distribuce: "Distribúcia", info_jadro: "Jadro", info_prohlizec: "Prehliadač", info_model: "Model",
    info_platforma: "Platforma", info_displej: "Displej", info_procesor: "Procesor", info_jader: "{n} jadier",
    info_pamet: "Pamäť", info_uloziste: "Úložisko", info_obsazeno: "{n} obsadené", info_baterie: "Batéria",
    info_nabiji: "nabíja sa", info_sit: "Sieť", info_online: "pripojené", info_offline: "bez pripojenia",
    info_operator: "Operátor", info_signal: "Signál", info_beh: "Doba behu", info_aplikace: "Aplikácie",
    info_fotky: "Fotky", info_zdroj: "Zdrojový kód", info_nezname: "neznáme", info_autor: "Autor",
    app_prehliadac: "Linsoft Browser", pr_hledat: "Hľadaj alebo zadaj adresu", pr_nova_karta: "Nová karta",
    pr_karty: "Karty", pr_zalozky: "Záložky", pr_historie: "História", pr_pridat_zalozku: "Pridať záložku",
    pr_odebrat_zalozku: "Odobrať záložku", pr_mimo: "Otvoriť mimo LinsoftPhone OS", pr_o: "O prehliadači",
    pr_vymazat: "Vymazať históriu", pr_prazdne: "Zatiaľ nič", pr_rychle: "Rýchly prístup",
    pr_zavrit_karty: "Zavrieť všetky karty", pr_obnovit: "Obnoviť", pr_vpred: "Dopredu", pr_menu: "Ponuka",
    pr_tip: "Niektoré weby (Facebook, GitHub, YouTube) nedovolia zobrazenie vnútri inej aplikácie. Vtedy použi „Otvoriť mimo“.",
    pr_o_text: "Webový prehliadač LinsoftPhone OS. Stránky bežia oddelene (sandbox) a nemôžu ovládať systém.",
    pr_sukromna: "Nová súkromná karta", pr_sukromna_info: "Súkromná karta: história sa neukladá.",
    pr_zdilet: "Zdieľať odkaz", pr_skopirovano: "Odkaz skopírovaný.", pr_nastaveni: "Nastavenia prehliadača",
    pr_hledac: "Vyhľadávač", pr_hledat_v: "Hľadať „{n}“", pr_blok_nadpis: "Túto stránku tu nie je možné zobraziť",
    pr_blok_text: "Web {n} nedovoľuje zobrazenie vnútri inej aplikácie.", pr_offline_nadpis: "Bez pripojenia",
    pr_offline_text: "Skontroluj Wi-Fi alebo mobilné dáta.", pr_znovu: "Skúsiť znova",
    pr_vymazat_vse: "Vymazať všetky údaje prehliadača", pr_vymazano: "Údaje prehliadača vymazané.",
    tel_klavesnice: "Klávesnica", tel_nedavne: "Nedávne", tel_zadne: "Zatiaľ žiadne hovory",
    tel_odchozi: "Odchádzajúci", tel_prichozi: "Prichádzajúci", tel_zmeskany: "Zmeškaný hovor",
    zpr_nova: "Nová správa", zpr_zadne: "Zatiaľ žiadne správy", zpr_ty: "Ty",
    gal_dnes: "Dnes", gal_vcera: "Včera", gal_fotky: "Fotky · {n}", gal_zdilet: "Zdieľať",
    gal_otevrit_fotak: "Otvoriť fotoaparát", gal_smazat_q: "Zmazať túto fotku?", gal_smazat_vse_q: "Zmazať všetky fotky?",
    cam_prepnout: "Prepnúť fotoaparát", cam_blesk: "Blesk", cam_casovac: "Samospúšť", cam_posledni: "Posledná fotka",
    pz_nova: "Nová poznámka", pz_zadne: "Zatiaľ žiadne poznámky", pz_smazat_q: "Zmazať poznámku?",
    pz_bez_nazvu: "Bez názvu", pz_barva: "Farba",
    hd_kolo: "Kolo", hd_pauza: "Pauza", hd_pokracovat: "Pokračovať", hd_svet: "Svetový čas",
    budik_novy: "Nový budík", budik_kazdy: "Každý deň", kal_cas: "Čas", kal_cely_den: "Celý deň",
    kal_dnes: "Dnes", kal_nova: "Nová udalosť", ter_prikazy: "Príkazy",
    hl_hledat: "Hľadať v telefóne", hl_web: "Hľadať na webe „{n}“", st_plocha: "Plocha",
    st_plocha_info: "Poradie aplikácií na ploche a ktoré sú v doku (hviezdička, najviac 4).",
    st_auto_motiv: "Automatický motív", st_auto_motiv_info: "Svetlý cez deň (7:00–19:00)",
    pl_dok: "V doku", pl_max: "Dok má najviac 4 aplikácie.", pl_nahoru: "Posunúť nahor", pl_dolu: "Posunúť nadol",
    st_navigace: "Navigácia", nav_tlacitka: "Tlačidlá", nav_gesta: "Gestá",
    nav_gesta_info: "Pruh dole: nahor = plocha, dlho nahor = nedávne, do strany = späť"
  },
  en: {
    dny: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    dnyKratke: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
    mesice: ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"],
    mesice2: null,
    app_telefon: "Phone", app_zpravy: "Messages", app_kontakty: "Contacts",
    app_kalk: "Calculator", app_hodiny: "Clock", app_kalendar: "Calendar",
    app_poznamky: "Notes", app_fotak: "Camera", app_galerie: "Gallery",
    app_terminal: "Terminal", app_nastaveni: "Settings",
    lock_hint: "Swipe up or tap", pin_zadej: "Enter PIN", pin_spatne: "Wrong PIN",
    notif: "Notifications", notif_vymaz: "Clear", notif_zadne: "No notifications",
    vitej_t: "Welcome to LinsoftPhone OS", vitej_s: "System is ready.",
    tile_torch: "Torch", tile_motiv: "Theme", tile_full: "Fullscreen", tile_zamek: "Lock",
    torch_ne: "This phone or browser does not support the torch.",
    full_ne: "This browser does not support fullscreen.",
    nedavne: "Recent apps", nedavne_zadne: "No recent apps", zavri_vse: "Close all",
    zpet: "Back", domu: "Home",
    volam: "Calling {n}…",
    sms_komu: "Recipient number", sms_text: "Type a message…", sms_zadne: "No messages. Write the first one!",
    sms_odeslano: "Sent: {n}", sms_info: "The message is sent through the phone's SMS app.",
    kt_jmeno: "Name", kt_cislo: "Number", kt_pridat: "Add contact",
    kt_import: "Import from phone", kt_importovano: "Contacts imported: {n}",
    chyba: "Error",
    hd_hodiny: "Clock", hd_budik: "Alarm", hd_minutka: "Timer", hd_stopky: "Stopwatch",
    start: "Start", stop: "Stop", reset: "Reset", pridat: "Add", smazat: "Delete",
    budik_pridat: "Add alarm", budik_zvoni: "Alarm {n}", vypnout: "Dismiss",
    minutka_konec: "Timer finished", budik_info: "Alarms ring only while LinsoftOS is open.",
    budik_zadny: "No alarms",
    kal_udalost: "New event…", kal_zadne: "No events",
    pz_ph: "Write notes… they are saved automatically.", pz_ulozeno: "Saved on this phone.",
    cam_vyfot: "📸 Take photo", cam_ne: "Camera not available (needs HTTPS and permission).",
    cam_ulozeno: "Photo saved to Gallery.",
    gal_prazdna: "Gallery is empty. Take a photo in Camera!", gal_smaz_vse: "Delete all",
    gal_stahnout: "Download",
    st_motiv: "Light theme", st_jazyk: "Language", st_pin: "PIN lock",
    st_pin_novy: "Enter a new 4-digit PIN", st_pin_znovu: "Repeat PIN", st_pin_neshoda: "PINs do not match",
    st_pin_nastaven: "PIN set.", st_pin_zrusen: "PIN removed.",
    st_notif: "System notifications", st_notif_zakaz: "Notifications are blocked in the browser.",
    st_zaloha: "Back up data", st_obnov: "Restore from backup",
    st_obnoveno: "Data restored.", st_obnov_chyba: "Invalid backup file.",
    st_o: "About",
    st_o_text: "Runs as a progressive web app — works on Android, iPhone and desktop.<br>Install it from the browser menu: “Add to Home screen”.",
    st_reset: "Factory reset (delete data)", st_reset_q: "Really delete all data?",
    zap: "On", vyp: "Off",
    hovor_prichozi: "Incoming call", hovor_volam: "Calling…", hovor_aktivni: "Call in progress",
    prijmout: "Answer", zavesit: "Hang up", chyba_n: "Error: {n}",
    sms_info_nativ: "The message is sent directly by the phone's modem.",
    nativ_info: "Running as the phone's own operating system (postmarketOS).",
    st_jas: "Brightness", st_wifi: "Wi-Fi networks", st_wifi_heslo: "Wi-Fi password", st_pripojit: "Connect",
    st_pripojeno: "Connected: {n}", st_vypnout: "Power off", st_restart: "Restart",
    st_vypnout_q: "Really power off the phone?", st_restart_q: "Really restart the phone?",
    kb_skryt: "Hide keyboard", mezera: "space",
    st_tapeta: "Wallpaper", tap_polar: "Aurora", tap_zapad: "Sunset", tap_les: "Forest",
    tap_noc: "Night", tap_foto: "Photo from Gallery", gal_tapeta: "Set as wallpaper",
    tapeta_ok: "Wallpaper set.", w_volno: "Nothing in the calendar today", w_budik: "Alarm",
    sk_vzhled: "Appearance", sk_pripojeni: "Connections", sk_zabezpeceni: "Security & privacy",
    sk_system: "System", sk_telefon: "Phone", st_verze: "Version {n}", st_pwa: "Web app (PWA)",
    kt_hledat: "Search", kt_novy: "New contact", kt_upravit: "Edit", kt_volat: "Call", kt_zprava: "Message",
    kt_nic: "Nothing found", kt_zadne: "No contacts yet", kt_smazat_q: "Delete contact {n}?",
    ulozit: "Save", zrusit: "Cancel",
    info_softver: "Software", info_zarizeni: "Device", info_stav: "Status", info_data: "Data",
    info_system: "System", info_zostaveni: "Build", info_rozhrani: "Interface", info_nativ: "Phone's own system",
    info_distribuce: "Distribution", info_jadro: "Kernel", info_prohlizec: "Browser", info_model: "Model",
    info_platforma: "Platform", info_displej: "Display", info_procesor: "Processor", info_jader: "{n} cores",
    info_pamet: "Memory", info_uloziste: "Storage", info_obsazeno: "{n} used", info_baterie: "Battery",
    info_nabiji: "charging", info_sit: "Network", info_online: "connected", info_offline: "offline",
    info_operator: "Carrier", info_signal: "Signal", info_beh: "Uptime", info_aplikace: "Apps",
    info_fotky: "Photos", info_zdroj: "Source code", info_nezname: "unknown", info_autor: "Author",
    app_prehliadac: "Linsoft Browser", pr_hledat: "Search or type an address", pr_nova_karta: "New tab",
    pr_karty: "Tabs", pr_zalozky: "Bookmarks", pr_historie: "History", pr_pridat_zalozku: "Add bookmark",
    pr_odebrat_zalozku: "Remove bookmark", pr_mimo: "Open outside LinsoftPhone OS", pr_o: "About browser",
    pr_vymazat: "Clear history", pr_prazdne: "Nothing yet", pr_rychle: "Quick access",
    pr_zavrit_karty: "Close all tabs", pr_obnovit: "Reload", pr_vpred: "Forward", pr_menu: "Menu",
    pr_tip: "Some sites (Facebook, GitHub, YouTube) refuse to be shown inside another app. Use “Open outside” for them.",
    pr_o_text: "The LinsoftPhone OS web browser. Pages run isolated (sandbox) and cannot control the system.",
    pr_sukromna: "New private tab", pr_sukromna_info: "Private tab: history is not saved.",
    pr_zdilet: "Share link", pr_skopirovano: "Link copied.", pr_nastaveni: "Browser settings",
    pr_hledac: "Search engine", pr_hledat_v: "Search “{n}”", pr_blok_nadpis: "This page can't be shown here",
    pr_blok_text: "{n} does not allow being shown inside another app.", pr_offline_nadpis: "No connection",
    pr_offline_text: "Check Wi-Fi or mobile data.", pr_znovu: "Try again",
    pr_vymazat_vse: "Clear all browser data", pr_vymazano: "Browser data cleared.",
    tel_klavesnice: "Keypad", tel_nedavne: "Recents", tel_zadne: "No calls yet",
    tel_odchozi: "Outgoing", tel_prichozi: "Incoming", tel_zmeskany: "Missed call",
    zpr_nova: "New message", zpr_zadne: "No messages yet", zpr_ty: "You",
    gal_dnes: "Today", gal_vcera: "Yesterday", gal_fotky: "Photos · {n}", gal_zdilet: "Share",
    gal_otevrit_fotak: "Open camera", gal_smazat_q: "Delete this photo?", gal_smazat_vse_q: "Delete all photos?",
    cam_prepnout: "Switch camera", cam_blesk: "Flash", cam_casovac: "Self-timer", cam_posledni: "Last photo",
    pz_nova: "New note", pz_zadne: "No notes yet", pz_smazat_q: "Delete this note?",
    pz_bez_nazvu: "Untitled", pz_barva: "Color",
    hd_kolo: "Lap", hd_pauza: "Pause", hd_pokracovat: "Resume", hd_svet: "World clock",
    budik_novy: "New alarm", budik_kazdy: "Every day", kal_cas: "Time", kal_cely_den: "All day",
    kal_dnes: "Today", kal_nova: "New event", ter_prikazy: "Commands",
    hl_hledat: "Search phone", hl_web: "Search the web for “{n}”", st_plocha: "Home screen",
    st_plocha_info: "Order of apps on the home screen and which are in the dock (star, up to 4).",
    st_auto_motiv: "Automatic theme", st_auto_motiv_info: "Light during the day (7:00–19:00)",
    pl_dok: "In dock", pl_max: "The dock holds up to 4 apps.", pl_nahoru: "Move up", pl_dolu: "Move down",
    st_navigace: "Navigation", nav_tlacitka: "Buttons", nav_gesta: "Gestures",
    nav_gesta_info: "Bar at the bottom: up = home, long up = recents, sideways = back"
  }
};
const JAZYKY = { cs: "Čeština", sk: "Slovenčina", en: "English" };

/* jazyk podle telefonu: sk / cs, jinak anglictina */
function vychoziJazyk(lang) {
  const l = String(lang || "").toLowerCase().slice(0, 2);
  return TEXTY[l] ? l : "en";
}

function preklad(jazyk, klic, param) {
  const sada = TEXTY[jazyk] || TEXTY.en;
  let s = klic in sada ? sada[klic] : (klic in TEXTY.en ? TEXTY.en[klic] : klic);
  if (param !== undefined) s = String(s).replace("{n}", param);
  return s;
}

/* ---------------- datum a cas ---------------- */
function dva(n) { return String(n).padStart(2, "0"); }
function hhmm(d) { return dva(d.getHours()) + ":" + dva(d.getMinutes()); }
function denKlic(d) { return d.getFullYear() + "-" + dva(d.getMonth() + 1) + "-" + dva(d.getDate()); }

function datumText(jazyk, d) {
  const t = TEXTY[jazyk] || TEXTY.en;
  if (!t.mesice2) return `${t.dny[d.getDay()]}, ${t.mesice[d.getMonth()]} ${d.getDate()}`;
  return `${t.dny[d.getDay()]} ${d.getDate()}. ${t.mesice2[d.getMonth()]}`;
}

/* mrizka mesice: pole tydnu, null = prazdne pole; tyden zacina pondelim */
function mesicMrizka(rok, mesic) {
  const posun = (new Date(rok, mesic, 1).getDay() + 6) % 7;
  const dnu = new Date(rok, mesic + 1, 0).getDate();
  const pole = [];
  for (let i = 0; i < posun; i++) pole.push(null);
  for (let i = 1; i <= dnu; i++) pole.push(i);
  return pole;
}

/* ma budik zazvonit? budik = { h, m, zap, posledni: "YYYY-MM-DD" } */
function budikMaZvonit(b, d) {
  /* b.dny = dny v tydnu (0 = nedele, jako Date.getDay); prazdne = kazdy den */
  if (b.dny && b.dny.length && b.dny.indexOf(d.getDay()) < 0) return false;
  return !!b.zap && b.h === d.getHours() && b.m === d.getMinutes() && b.posledni !== denKlic(d);
}

/* udalost v kalendari: starsi verze ukladala jen text, nova { text, cas: "14:00" | "" } */
function udalost(u) {
  return typeof u === "string" ? { text: u, cas: "" } : { text: String(u.text || ""), cas: u.cas || "" };
}
function textUdalosti(u) {
  const x = udalost(u);
  return (x.cas ? x.cas + " " : "") + x.text;
}
/* udalosti dne serazene: cely den nahore, pak podle casu */
function seradUdalosti(seznam) {
  return (seznam || []).map(udalost).sort((a, b) => (a.cas || "") < (b.cas || "") ? -1 : (a.cas || "") > (b.cas || "") ? 1 : 0);
}

/* ---------------- kalkulacka ---------------- */
function spocitej(vyraz) {
  const ex = String(vyraz).replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/,/g, ".");
  if (!/^[0-9+\-*/(). ]+$/.test(ex)) throw new Error("neplatny vyraz");
  const v = Function('"use strict";return(' + ex + ")")();
  if (typeof v !== "number" || !isFinite(v)) throw new Error("neplatny vysledek");
  /* odstraneni chyb plovouci carky: 0.1+0.2 -> 0.3 */
  return parseFloat(v.toPrecision(12));
}

/* ---------------- SMS / telefon ---------------- */
function cisloTel(s) { return String(s || "").replace(/[^0-9+*#]/g, ""); }

/* iOS pouziva "sms:cislo&body=", ostatni "sms:cislo?body=" */
function smsOdkaz(cislo, text, jeIOS) {
  return "sms:" + cisloTel(cislo) + (jeIOS ? "&" : "?") + "body=" + encodeURIComponent(text);
}

/* ---------------- PIN ---------------- */
/* jen zamek proti nahodnemu pouziti - data v telefonu nejsou sifrovana */
function pinHash(pin) {
  let h = 5381;
  const s = "linsoft:" + pin;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
function pinPlatny(pin) { return /^[0-9]{4}$/.test(pin); }

/* ---------------- zaloha ---------------- */
function platnaZaloha(z) {
  return !!z && typeof z === "object" && z.app === "linsoftos" &&
    typeof z.data === "object" && z.data !== null && Array.isArray(z.fotky) &&
    z.fotky.every((f) => typeof f === "string" && f.indexOf("data:image/") === 0) &&
    Object.keys(z.data).every((k) => k.indexOf("lp_") === 0 && typeof z.data[k] === "string");
}

/* ---------------- informace o systemu ---------------- */
/* prohlizec z user agenta: { nazev, verze } */
function prohlizec(ua) {
  const PRAVIDLA = [
    [/Edg(?:A|iOS)?\/(\d+)/, "Edge"], [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/OPR\/(\d+)/, "Opera"], [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"], [/Version\/(\d+)[\d.]* .*Safari/, "Safari"],
    [/AppleWebKit\/(\d+)/, "WebKit"]
  ];
  for (let i = 0; i < PRAVIDLA.length; i++) {
    const m = String(ua || "").match(PRAVIDLA[i][0]);
    if (m) return { nazev: PRAVIDLA[i][1], verze: m[1] };
  }
  return { nazev: "?", verze: "" };
}

/* operacni system zarizeni z user agenta */
function platforma(ua) {
  ua = String(ua || "");
  let m = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (m) return "Android " + m[1];
  m = ua.match(/(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/);
  if (m) return "iOS " + m[1] + "." + m[2];
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return "?";
}

/* velikost v bajtech citelne: 1536 -> "1,5 KB" (desetinna carka v cs/sk) */
function velikost(b, jazyk) {
  const JEDNOTKY = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = Math.max(0, Number(b) || 0);
  while (v >= 1024 && i < JEDNOTKY.length - 1) { v /= 1024; i++; }
  const s = (i === 0 || v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toString();
  return (jazyk === "en" ? s : s.replace(".", ",")) + " " + JEDNOTKY[i];
}

/* doba behu ze sekund: "45 s", "12 min", "3 h 5 min", "2 d 4 h" */
function trvani(sekundy) {
  const s = Math.max(0, Math.floor(sekundy || 0));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return d + " d " + h + " h";
  if (h) return h + " h " + m + " min";
  if (m) return m + " min";
  return s + " s";
}

/* ---------------- Linsoft Browser ---------------- */
/* vyhledavace, ktere dovoli zobrazeni vysledku ve vnorenem okne prohlizece
 * (Google jen s igu=1; DuckDuckGo, Brave a Startpage vnoreni zakazuji) */
const HLEDACE = {
  google: { nazev: "Google", url: "https://www.google.com/search?igu=1&q=" },
  bing: { nazev: "Bing", url: "https://www.bing.com/search?q=" },
  wikipedia: { nazev: "Wikipédia", url: "https://sk.m.wikipedia.org/w/index.php?search=" }
};
const HLEDANI = HLEDACE.google.url;

/* text z adresniho radku -> adresa stranky, nebo vyhledavani zvolenym vyhledavacem */
function adresaZVstupu(vstup, hledac) {
  const hledej = (HLEDACE[hledac] || HLEDACE.google).url;
  const s = String(vstup || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^(about|data|javascript|file|blob):/i.test(s)) return hledej + encodeURIComponent(s);
  /* "sme.sk", "localhost:8080", "192.168.1.1/admin" - bez mezer a s teckou nebo portem */
  if (!/\s/.test(s) && (/^[^/]+\.[a-z]{2,}(?::\d+)?(\/.*)?$/i.test(s) || /^localhost(:\d+)?(\/.*)?$/i.test(s) ||
      /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(s)))
    return (/^(localhost|\d)/i.test(s) ? "http://" : "https://") + s;
  return hledej + encodeURIComponent(s);
}

/* adresa pro zobrazeni: domena bez "www.", u hledani hledany text */
function zobrazAdresu(url) {
  const s = String(url || "");
  const klice = Object.keys(HLEDACE);
  for (let i = 0; i < klice.length; i++) {
    const h = HLEDACE[klice[i]].url;
    if (s.indexOf(h) === 0) {
      try { return decodeURIComponent(s.slice(h.length).replace(/\+/g, " ")); } catch (e) { return s.slice(h.length); }
    }
  }
  const m = s.match(/^https?:\/\/(?:www\.|m\.)?([^/?#]+)/i);
  return m ? m[1] : s;
}

/* weby, ktere zobrazeni ve vnorenem okne zakazuji (X-Frame-Options / CSP) */
const BLOKOVANE = ["facebook.com", "instagram.com", "x.com", "twitter.com", "github.com", "linkedin.com",
  "duckduckgo.com", "search.brave.com", "startpage.com", "netflix.com", "tiktok.com", "reddit.com",
  "accounts.google.com", "mail.google.com", "web.whatsapp.com", "chatgpt.com", "claude.ai"];

/* pred nactenim: YouTube video -> vlozitelna verze, zname blokovane weby oznacit */
function upravAdresu(url) {
  const s = String(url || "");
  const yt = s.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { url: "https://www.youtube-nocookie.com/embed/" + yt[1] + "?autoplay=1", blokovane: false };
  const host = (s.match(/^https?:\/\/([^/?#:]+)/i) || [])[1];
  const blok = !!host && BLOKOVANE.some((d) => host.toLowerCase() === d || host.toLowerCase().slice(-d.length - 1) === "." + d);
  return { url: s, blokovane: blok };
}

/* navrhy pri psani adresy: zalozky, historie a rychly pristup podle shody */
function navrhy(vstup, zdroje, max) {
  const q = String(vstup || "").trim().toLowerCase();
  if (!q) return [];
  const videne = {}, vysledek = [];
  zdroje.forEach((p) => {
    if (!p || !p.url || videne[p.url]) return;
    const text = ((p.titulek || "") + " " + p.url).toLowerCase();
    if (text.indexOf(q) < 0) return;
    videne[p.url] = true;
    vysledek.push(p);
  });
  return vysledek.slice(0, max || 5);
}

/* ---------------- telefon a zpravy ---------------- */
/* pismena na klavesnici telefonu */
const T9 = { 2: "ABC", 3: "DEF", 4: "GHI", 5: "JKL", 6: "MNO", 7: "PQRS", 8: "TUV", 9: "WXYZ", 0: "+" };

/* kratky cas v seznamu: dnes "14:05", jinak "31. 10." */
function kratkyCas(cas, ted) {
  const d = new Date(cas), n = ted ? new Date(ted) : new Date();
  if (denKlic(d) === denKlic(n)) return hhmm(d);
  return d.getDate() + ". " + (d.getMonth() + 1) + ".";
}

/* nadpis skupiny v Galerii: "Dnes", "Včera", jinak datum */
function nadpisDne(jazyk, cas, ted) {
  const d = new Date(cas), n = ted ? new Date(ted) : new Date();
  const vcera = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
  if (denKlic(d) === denKlic(n)) return preklad(jazyk, "gal_dnes");
  if (denKlic(d) === denKlic(vcera)) return preklad(jazyk, "gal_vcera");
  return datumText(jazyk, d);
}

/* poznamka: prvni neprazdny radek je nazev, zbytek nahled */
function rozdelPoznamku(text) {
  const radky = String(text || "").split("\n").map((x) => x.trim());
  const i = radky.findIndex((x) => x);
  if (i < 0) return { nazev: "", nahled: "" };
  return { nazev: radky[i].slice(0, 80), nahled: radky.slice(i + 1).filter(Boolean).join(" ").slice(0, 140) };
}

/* zpravy -> konverzace podle cisla, nejnovejsi nahore: { komu, posledni, pocet } */
function konverzace(zpravy) {
  const mapa = {};
  (zpravy || []).forEach((z) => {
    const k = cisloTel(z.komu);
    const kon = mapa[k] || (mapa[k] = { komu: k, posledni: z, pocet: 0 });
    kon.pocet++;
    if (z.cas >= kon.posledni.cas) kon.posledni = z;
  });
  return Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => b.posledni.cas - a.posledni.cas);
}

const Core = {
  TEXTY, JAZYKY, vychoziJazyk, preklad, dva, hhmm, denKlic, datumText, mesicMrizka,
  budikMaZvonit, spocitej, cisloTel, smsOdkaz, pinHash, pinPlatny, platnaZaloha,
  prohlizec, platforma, velikost, trvani, HLEDACE, HLEDANI, adresaZVstupu, zobrazAdresu,
  upravAdresu, navrhy, T9, kratkyCas, konverzace, nadpisDne, rozdelPoznamku,
  udalost, textUdalosti, seradUdalosti
};
if (typeof module !== "undefined" && module.exports) module.exports = Core;
else glob.Core = Core;
})(this);
