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
    gal_prazdna: "Galerie je prázdná. Vyfoť něco ve Fotoaparátu! 📷", gal_smaz_vse: "Smazat vše",
    gal_stahnout: "Stáhnout",
    st_motiv: "🌗 Světlý motiv", st_jazyk: "🌐 Jazyk", st_pin: "🔒 PIN zámek",
    st_pin_novy: "Zadej nový 4místný PIN", st_pin_znovu: "Zopakuj PIN", st_pin_neshoda: "PINy se neshodují",
    st_pin_nastaven: "PIN nastaven.", st_pin_zrusen: "PIN zrušen.",
    st_notif: "🔔 Systémové notifikace", st_notif_zakaz: "Notifikace jsou v prohlížeči zakázané.",
    st_zaloha: "💾 Zálohovat data", st_obnov: "📂 Obnovit ze zálohy",
    st_obnoveno: "Data obnovena.", st_obnov_chyba: "Neplatný soubor zálohy.",
    st_o: "📱 O systému",
    st_o_text: "Běží jako progresivní webová aplikace — funguje na Androidu, iPhonu i počítači.<br>Nainstaluj přes menu prohlížeče: „Přidat na plochu“.",
    st_reset: "🗑 Tovární nastavení (smazat data)", st_reset_q: "Opravdu smazat všechna data?",
    zap: "Zap", vyp: "Vyp",
    hovor_prichozi: "Příchozí hovor", hovor_volam: "Volám…", hovor_aktivni: "Probíhá hovor",
    prijmout: "Přijmout", zavesit: "Zavěsit", chyba_n: "Chyba: {n}",
    sms_info_nativ: "Zpráva se odešle přímo z modemu telefonu.",
    nativ_info: "Běží jako vlastní systém telefonu (postmarketOS).",
    st_jas: "☀️ Jas", st_wifi: "📶 Wi-Fi sítě", st_wifi_heslo: "Heslo Wi-Fi", st_pripojit: "Připojit",
    st_pripojeno: "Připojeno: {n}", st_vypnout: "⏻ Vypnout telefon", st_restart: "🔄 Restartovat",
    st_vypnout_q: "Opravdu vypnout telefon?", st_restart_q: "Opravdu restartovat telefon?",
    kb_skryt: "Skrýt klávesnici", mezera: "mezera",
    st_tapeta: "🖼️ Tapeta", tap_polar: "Polární záře", tap_zapad: "Západ slunce", tap_les: "Les",
    tap_noc: "Noc", tap_foto: "Fotka z Galerie", gal_tapeta: "Nastavit jako tapetu",
    tapeta_ok: "Tapeta nastavena.", w_volno: "Dnes nic v kalendáři", w_budik: "Budík"
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
    gal_prazdna: "Galéria je prázdna. Odfoť niečo vo Fotoaparáte! 📷", gal_smaz_vse: "Zmazať všetko",
    gal_stahnout: "Stiahnuť",
    st_motiv: "🌗 Svetlý motív", st_jazyk: "🌐 Jazyk", st_pin: "🔒 PIN zámok",
    st_pin_novy: "Zadaj nový 4-miestny PIN", st_pin_znovu: "Zopakuj PIN", st_pin_neshoda: "PIN-y sa nezhodujú",
    st_pin_nastaven: "PIN nastavený.", st_pin_zrusen: "PIN zrušený.",
    st_notif: "🔔 Systémové notifikácie", st_notif_zakaz: "Notifikácie sú v prehliadači zakázané.",
    st_zaloha: "💾 Zálohovať dáta", st_obnov: "📂 Obnoviť zo zálohy",
    st_obnoveno: "Dáta obnovené.", st_obnov_chyba: "Neplatný súbor zálohy.",
    st_o: "📱 O systéme",
    st_o_text: "Beží ako progresívna webová aplikácia — funguje na Androide, iPhone aj počítači.<br>Nainštaluj cez menu prehliadača: „Pridať na plochu“.",
    st_reset: "🗑 Továrenské nastavenia (zmazať dáta)", st_reset_q: "Naozaj zmazať všetky dáta?",
    zap: "Zap", vyp: "Vyp",
    hovor_prichozi: "Prichádzajúci hovor", hovor_volam: "Volám…", hovor_aktivni: "Prebieha hovor",
    prijmout: "Prijať", zavesit: "Zložiť", chyba_n: "Chyba: {n}",
    sms_info_nativ: "Správa sa odošle priamo z modemu telefónu.",
    nativ_info: "Beží ako vlastný systém telefónu (postmarketOS).",
    st_jas: "☀️ Jas", st_wifi: "📶 Wi-Fi siete", st_wifi_heslo: "Heslo Wi-Fi", st_pripojit: "Pripojiť",
    st_pripojeno: "Pripojené: {n}", st_vypnout: "⏻ Vypnúť telefón", st_restart: "🔄 Reštartovať",
    st_vypnout_q: "Naozaj vypnúť telefón?", st_restart_q: "Naozaj reštartovať telefón?",
    kb_skryt: "Skryť klávesnicu", mezera: "medzera",
    st_tapeta: "🖼️ Tapeta", tap_polar: "Polárna žiara", tap_zapad: "Západ slnka", tap_les: "Les",
    tap_noc: "Noc", tap_foto: "Fotka z Galérie", gal_tapeta: "Nastaviť ako tapetu",
    tapeta_ok: "Tapeta nastavená.", w_volno: "Dnes nič v kalendári", w_budik: "Budík"
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
    gal_prazdna: "Gallery is empty. Take a photo in Camera! 📷", gal_smaz_vse: "Delete all",
    gal_stahnout: "Download",
    st_motiv: "🌗 Light theme", st_jazyk: "🌐 Language", st_pin: "🔒 PIN lock",
    st_pin_novy: "Enter a new 4-digit PIN", st_pin_znovu: "Repeat PIN", st_pin_neshoda: "PINs do not match",
    st_pin_nastaven: "PIN set.", st_pin_zrusen: "PIN removed.",
    st_notif: "🔔 System notifications", st_notif_zakaz: "Notifications are blocked in the browser.",
    st_zaloha: "💾 Back up data", st_obnov: "📂 Restore from backup",
    st_obnoveno: "Data restored.", st_obnov_chyba: "Invalid backup file.",
    st_o: "📱 About",
    st_o_text: "Runs as a progressive web app — works on Android, iPhone and desktop.<br>Install it from the browser menu: “Add to Home screen”.",
    st_reset: "🗑 Factory reset (delete data)", st_reset_q: "Really delete all data?",
    zap: "On", vyp: "Off",
    hovor_prichozi: "Incoming call", hovor_volam: "Calling…", hovor_aktivni: "Call in progress",
    prijmout: "Answer", zavesit: "Hang up", chyba_n: "Error: {n}",
    sms_info_nativ: "The message is sent directly by the phone's modem.",
    nativ_info: "Running as the phone's own operating system (postmarketOS).",
    st_jas: "☀️ Brightness", st_wifi: "📶 Wi-Fi networks", st_wifi_heslo: "Wi-Fi password", st_pripojit: "Connect",
    st_pripojeno: "Connected: {n}", st_vypnout: "⏻ Power off", st_restart: "🔄 Restart",
    st_vypnout_q: "Really power off the phone?", st_restart_q: "Really restart the phone?",
    kb_skryt: "Hide keyboard", mezera: "space",
    st_tapeta: "🖼️ Wallpaper", tap_polar: "Aurora", tap_zapad: "Sunset", tap_les: "Forest",
    tap_noc: "Night", tap_foto: "Photo from Gallery", gal_tapeta: "Set as wallpaper",
    tapeta_ok: "Wallpaper set.", w_volno: "Nothing in the calendar today", w_budik: "Alarm"
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
  return !!b.zap && b.h === d.getHours() && b.m === d.getMinutes() && b.posledni !== denKlic(d);
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

const Core = {
  TEXTY, JAZYKY, vychoziJazyk, preklad, dva, hhmm, denKlic, datumText, mesicMrizka,
  budikMaZvonit, spocitej, cisloTel, smsOdkaz, pinHash, pinPlatny, platnaZaloha
};
if (typeof module !== "undefined" && module.exports) module.exports = Core;
else glob.Core = Core;
})(this);
