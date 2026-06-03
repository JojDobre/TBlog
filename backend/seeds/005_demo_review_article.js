/**
 * 005_demo_review_article.js
 *
 * Vloží ukážkový review článok so VŠETKÝMI block typmi.
 * Spustenie: npx knex seed:run --specific=005_demo_review_article.js
 */

exports.seed = async function (knex) {
  // Nájdi prvého admin usera
  const admin = await knex('users').where('role', 'admin').first();
  if (!admin) {
    console.log('⚠ Žiadny admin user — preskakujem demo článok.');
    return;
  }

  const slug = 'demo-recenzia-samsung-galaxy-s26-ultra';

  // Ak už existuje, preskočíme
  const exists = await knex('articles').where('slug', slug).first();
  if (exists) {
    console.log('⚠ Demo článok už existuje (slug: ' + slug + ')');
    return;
  }

  const content = [
    // 1. Heading
    { type: 'heading', level: 2, text: 'Samsung Galaxy S26 Ultra — Kompletná recenzia' },

    // 2. Paragraph
    {
      type: 'paragraph',
      text: 'Samsung Galaxy S26 Ultra je najnovší vlajkový smartfón od Samsungu. Prináša revolučný dizajn, výkonný čipset a fotoaparát, ktorý posúva hranice mobilnej fotografie. V tejto recenzii sa pozrieme na všetky aspekty tohto zariadenia.\n\nTestovali sme ho 14 dní v bežnom používaní, aby sme vám priniesli čo najobjektívnejší pohľad.',
    },

    // 3. rvx_quickstrip — Rýchly verdikt
    {
      type: 'rvx_quickstrip',
      items: [
        { label: 'Cena', value: '1 399 €', style: '' },
        { label: 'Displej', value: '6.9" QHD+', style: 'great' },
        { label: 'Batéria', value: '5 500 mAh', style: 'good' },
        { label: 'Fotoaparát', value: '200 MPx', style: 'great' },
        { label: 'Nabíjanie', value: '45W', style: 'bad' },
        { label: 'Váha', value: '218 g', style: '' },
      ],
    },

    // 4. rvx_glance — V skratke
    {
      type: 'rvx_glance',
      eyebrow: 'V skratke',
      title: 'Prečo si ho zaslúži pozornosť',
      items: [
        {
          icon: 'star',
          title: 'Prémiový dizajn',
          text: 'Titánový rám a Gorilla Glass Armor na prednej aj zadnej strane.',
        },
        {
          icon: 'image',
          title: 'Špičkový fotoaparát',
          text: '200 MPx hlavný senzor s vylepšeným nočným režimom a 5× optickým zoomom.',
        },
        {
          icon: 'rocket',
          title: 'Snapdragon 8 Gen 4',
          text: 'Najrýchlejší mobilný čipset na trhu s AI akcelerátorom.',
        },
      ],
    },

    // 5. rvx_keyspecs — Kľúčové parametre
    {
      type: 'rvx_keyspecs',
      eyebrow: 'Špecifikácie',
      title: 'Kľúčové parametre',
      items: [
        { num: '200 MPx', label: 'Hlavná kamera' },
        { num: '6.9"', label: 'AMOLED displej' },
        { num: '5 500', label: 'mAh batéria' },
        { num: '12 GB', label: 'RAM' },
        { num: '256/512', label: 'GB úložisko' },
        { num: 'IP68', label: 'Odolnosť' },
        { num: '218 g', label: 'Hmotnosť' },
        { num: 'S Pen', label: 'Stylus v balení' },
      ],
    },

    // 6. Divider
    { type: 'divider' },

    // 7. rvx_profile — Profil zariadenia
    {
      type: 'rvx_profile',
      eyebrow: 'Identita',
      title: 'Profil zariadenia',
      items: [
        { label: 'Výrobca', value: 'Samsung Electronics' },
        { label: 'Séria', value: 'Galaxy S' },
        { label: 'Generácia', value: '26. (2026)' },
        { label: 'Operačný systém', value: 'Android 16 + One UI 8' },
        { label: 'Procesor', value: 'Snapdragon 8 Gen 4 for Galaxy' },
        { label: 'Dátum uvedenia', value: 'Január 2026' },
        { label: 'Cena pri uvedení', value: 'od 1 399 €' },
      ],
    },

    // 8. rvx_design — Dizajn a materiály
    {
      type: 'rvx_design',
      eyebrow: 'Dizajn',
      title: 'Dizajn a materiály',
      text: 'Samsung Galaxy S26 Ultra pokračuje v evolúcii dizajnu s titánovým rámom a plochým displejom. Zaoblené rohy sú jemnejšie než u predchodcu, čo zlepšuje pocit v ruke.\n\nZadná strana je z matného skla Gorilla Glass Armor, ktoré výborne odolává odtlačkom prstov. Celkovo pôsobí zariadenie veľmi prémiovo a kvalitne.',
      items: [
        { label: 'Rám', value: 'Titán Grade 5' },
        { label: 'Predné sklo', value: 'Gorilla Glass Armor' },
        { label: 'Zadné sklo', value: 'Gorilla Glass Armor (matné)' },
        { label: 'Rozmery', value: '162.8 × 77.6 × 8.6 mm' },
        { label: 'Odolnosť', value: 'IP68 (prach + voda)' },
        { label: 'Farby', value: 'Titanium Black, Silver, Blue, Natural' },
      ],
    },

    // 9. Section block
    {
      type: 'section',
      layout: 'default',
      title: 'Displej na novej úrovni',
      eyebrow: 'Displej',
      number: '01',
      title_style: 'xl',
      show_divider: true,
      text: 'Nový 6.9-palcový Dynamic AMOLED 2X displej s rozlíšením QHD+ a obnovovacou frekvenciou 1-120 Hz ponúka neuveriteľnú ostrosť a plynulosť. Maximálny jas dosahuje 3 000 nitov, čo zabezpečuje výbornú čitateľnosť aj na priamom slnku.\n\nAnti-reflective coating znižuje odrazy o 75 % oproti predchádzajúcej generácii.',
      media_id: null,
      media_style: 'normal',
      video_url: '',
      caption: '',
      width: 'full',
      grid_title_side: 'right',
    },

    // 10. rvx_bench — Benchmarky
    {
      type: 'rvx_bench',
      eyebrow: 'Výkon',
      title: 'Benchmarky',
      items: [
        { name: 'AnTuTu v10', score: 2150000, max: 2500000, label: 'bodov' },
        { name: 'Geekbench 6 (single)', score: 2890, max: 3500, label: 'bodov' },
        { name: 'Geekbench 6 (multi)', score: 7650, max: 9000, label: 'bodov' },
        { name: '3DMark Wild Life', score: 18500, max: 20000, label: 'bodov' },
        { name: 'PCMark Work 3.0', score: 19200, max: 22000, label: 'bodov' },
        { name: 'Čítanie (sekv.)', score: 4200, max: 5000, label: 'MB/s' },
      ],
    },

    // 11. rvx_battery — Výdrž batérie
    {
      type: 'rvx_battery',
      eyebrow: 'Batéria',
      title: 'Výdrž batérie',
      items: [
        { scenario: 'YouTube (Wi-Fi, 50%)', hours: '18h 30m', pct: 92 },
        { scenario: 'Webové prehliadanie', hours: '15h 45m', pct: 79 },
        { scenario: 'Instagram scrolling', hours: '12h 10m', pct: 61 },
        { scenario: 'Hranie hier (Genshin)', hours: '7h 20m', pct: 37 },
        { scenario: 'GPS navigácia', hours: '9h 50m', pct: 49 },
        { scenario: 'Pohotovostný režim', hours: '96h', pct: 100 },
      ],
    },

    // 12. rvx_connect — Konektivita
    {
      type: 'rvx_connect',
      eyebrow: 'Pripojenie',
      title: 'Konektivita',
      items: [
        'Wi-Fi 7 (802.11be)',
        '5G (sub-6 + mmWave)',
        'Bluetooth 5.4',
        'NFC',
        'UWB 2.0',
        'USB 3.2 (Type-C)',
        'DeX (bezdrôtový)',
        'Satelitná SOS',
        'eSIM (dual)',
      ],
    },

    // 13. rvx_software — Softvérové funkcie
    {
      type: 'rvx_software',
      eyebrow: 'Softvér',
      title: 'Softvérové funkcie',
      items: [
        {
          title: 'Galaxy AI 2.0',
          text: 'Nová generácia AI funkcií vrátane real-time prekladu hovorov, sumarizácie textov a generatívnych úprav fotiek.',
        },
        {
          title: 'Circle to Search',
          text: 'Zakrúžkujte čokoľvek na obrazovke a okamžite vyhľadajte. Teraz s podporou videa.',
        },
        {
          title: 'Note Assist',
          text: 'AI automaticky organizuje poznámky, vytvára zhrnutia a prepíše ručne písaný text.',
        },
        {
          title: 'Sketch to Image',
          text: 'Nakreslite hrubý náčrt a AI ho premení na realistický obrázok.',
        },
      ],
    },

    // 14. rvx_deepdive — Hĺbkový rozbor
    {
      type: 'rvx_deepdive',
      eyebrow: 'Deep Dive',
      title: 'Hĺbkový rozbor',
      items: [
        {
          tab_title: 'Fotoaparát',
          text: 'Hlavný 200 MPx senzor ISOCELL HP3 s optickou stabilizáciou zachytáva neuveriteľné množstvo detailov. Pixel binning 16-in-1 produkuje 12.5 MPx fotky s výnimočnou svetelnosťou.\n\nNočný režim je výrazne vylepšený — fotky v tme sú jasnejšie a s menším šumom. Ultra-široký 12 MPx objektív má teraz autofokus, čo oceníte pri makro fotografii.',
        },
        {
          tab_title: 'Video',
          text: '8K video pri 30 fps je teraz stabilizované — konečne použiteľné v praxi. 4K pri 120 fps umožňuje plynulé spomalené zábery.\n\nNový codec AV1 hardvérovo enkóduje video, čo znamená menšie súbory pri rovnakej kvalite. Audio Eraser dokáže odstrániť nežiaduce zvuky z videa.',
        },
        {
          tab_title: 'Výkon',
          text: 'Snapdragon 8 Gen 4 for Galaxy je exkluzívna verzia optimalizovaná pre Samsung. V benchmarkoch dominuje nad konkurenciou.\n\nVapor chamber chladenie je o 40 % väčšie, čo znamená udržateľný výkon aj pri dlhšom hraní. Throttling je minimálny — po 30 minútach Genshin Impact klesne výkon len o 8 %.',
        },
        {
          tab_title: 'Displej',
          text: 'LTPO 4.0 technológia umožňuje dynamickú obnovovaciu frekvenciu 1-120 Hz. Pri statickom obsahu šetrí batériu, pri scrollovaní je plynulý.\n\nNový anti-glare coating je revolučný — displej je čitateľný aj v priamom slnku bez toho, aby ste museli zvyšovať jas na maximum.',
        },
      ],
    },

    // 15. Pros/Cons
    {
      type: 'pros_cons',
      pros: [
        'Prémiový titánový dizajn',
        'Špičkový fotoaparát (200 MPx)',
        'Vynikajúca výdrž batérie',
        'Najlepší displej na trhu',
        'S Pen v balení',
        '7 rokov aktualizácií',
      ],
      cons: [
        'Pomalé nabíjanie (45W)',
        'Vysoká cena (od 1 399 €)',
        'Veľký a ťažký (218 g)',
        'Bez jack 3.5 mm konektora',
      ],
      width: 'full',
    },

    // 16. rvx_quotes — Citácie
    {
      type: 'rvx_quotes',
      eyebrow: 'Citácie',
      title: 'Čo hovoria iní',
      items: [
        {
          text: 'Galaxy S26 Ultra je najlepší smartfón, aký sme kedy testovali. Fotoaparát je v úplne inej lige.',
          author: 'TechRadar',
        },
        {
          text: 'Samsung konečne vyriešil problém s prehrievaním. Tento telefón zvládne všetko, čo naňho hodíte.',
          author: 'GSMArena',
        },
        {
          text: 'Cena je vysoká, ale za túto kvalitu to stojí. Je to investícia na minimálne 4 roky.',
          author: 'The Verge',
        },
      ],
    },

    // 17. rvx_versus — Porovnanie s konkurenciou
    {
      type: 'rvx_versus',
      eyebrow: 'Versus · 3 konkurenti',
      title: 'Ako sa drží proti rivalom',
      items: [
        {
          name: 'iPhone 17 Pro Max',
          score: 9.2,
          pros: ['Lepšie video', 'Menšia veľkosť', 'Lepší ekosystém'],
          cons: ['Drahší', 'Menej RAM', 'Žiadny S Pen'],
        },
        {
          name: 'Pixel 10 Pro',
          score: 8.8,
          pros: ['Čistý Android', 'Lepšia AI fotografia', 'Lacnejší'],
          cons: ['Horší displej', 'Menej výkonu', 'Plastový rám'],
        },
        {
          name: 'OnePlus 14 Ultra',
          score: 8.5,
          pros: ['Rýchle nabíjanie (100W)', 'Výborná cena', 'Alert slider'],
          cons: ['Horšie fotky v tme', 'Menej aktualizácií', 'Žiadny S Pen'],
        },
      ],
    },

    // 18. rvx_generations — Porovnanie generácií
    {
      type: 'rvx_generations',
      eyebrow: 'Evolúcia',
      title: 'Porovnanie generácií',
      headers: ['Vlastnosť', 'S24 Ultra', 'S25 Ultra', 'S26 Ultra'],
      rows: [
        { cells: ['Procesor', 'SD 8 Gen 3', 'SD 8 Elite', 'SD 8 Gen 4'] },
        { cells: ['RAM', '12 GB', '12 GB', '12 GB'] },
        { cells: ['Hlavná kamera', '200 MPx', '200 MPx', '200 MPx'] },
        { cells: ['Batéria', '5 000 mAh', '5 000 mAh', '5 500 mAh'] },
        { cells: ['Displej', '6.8" QHD+', '6.9" QHD+', '6.9" QHD+'] },
        { cells: ['Nabíjanie', '45W', '45W', '45W'] },
        { cells: ['Cena', '1 299 €', '1 349 €', '1 399 €'] },
      ],
    },

    // 19. rvx_hilo — Najviac a najmenej
    {
      type: 'rvx_hilo',
      eyebrow: 'Hodnotenie',
      title: 'Najviac a najmenej',
      highs: [
        'Fotoaparát — najlepší na trhu, špeciálne nočný režim',
        'Displej — 3 000 nitov, anti-glare, perfektné farby',
        'Výdrž batérie — 5 500 mAh vydrží celý deň a viac',
        'S Pen — stále unikátny v segmente',
      ],
      lows: [
        'Nabíjanie — 45W je v roku 2026 pomalé',
        'Cena — od 1 399 € nie je pre každého',
        'Hmotnosť — 218 g sa po čase prejaví',
      ],
    },

    // 20. rvx_timeline — Denník testovania
    {
      type: 'rvx_timeline',
      eyebrow: 'Testovanie',
      title: 'Denník testovania',
      items: [
        {
          day: 'Deň 1',
          title: 'Prvé dojmy a nastavenie',
          text: 'Rozbalenie, nastavenie, migrácia dát z predchodcu. Telefón je krásny, ale ťažký. Smart Switch fungoval bezchybne.',
        },
        {
          day: 'Deň 3',
          title: 'Fotoaparát v akcii',
          text: 'Prvé fotky v rôznych podmienkach. Nočný režim je dramaticky lepší. Zoom 5× je ostrý aj pri slabom svetle.',
        },
        {
          day: 'Deň 7',
          title: 'Herný test',
          text: 'Týždeň hrania Genshin Impact, Diablo Immortal a Call of Duty. Minimálny throttling, zariadenie sa nehreje tak ako predchodca.',
        },
        {
          day: 'Deň 10',
          title: 'Batériový maratón',
          text: 'Testovanie výdrže v rôznych scenároch. 5 500 mAh je citeľný upgrade — vždy dôjdem domov s 20 %+ batérie.',
        },
        {
          day: 'Deň 14',
          title: 'Záverečné hodnotenie',
          text: 'Po dvoch týždňoch je jasné: toto je najlepší Android smartfón na trhu. Ale za vysokú cenu.',
        },
      ],
    },

    // 21. rvx_usecases — Scenáre použitia
    {
      type: 'rvx_usecases',
      eyebrow: 'Scenáre',
      title: 'Scenáre použitia',
      items: [
        {
          icon: 'image',
          title: 'Mobilná fotografia',
          text: '200 MPx senzor, 5× zoom, nočný režim — ideálny pre fotografov.',
          verdict: 'yes',
        },
        {
          icon: 'rocket',
          title: 'Hranie hier',
          text: 'SD 8 Gen 4 zvládne všetko, ale 45W nabíjanie je pri dlhom hraní limitujúce.',
          verdict: 'maybe',
        },
        {
          icon: 'edit',
          title: 'Produktivita',
          text: 'S Pen, DeX, veľký displej — perfektný pre prácu na cestách.',
          verdict: 'yes',
        },
        {
          icon: 'user',
          title: 'Bežné používanie',
          text: 'Výborný, ale zbytočne drahý ak nepotrebujete prémiové funkcie.',
          verdict: 'maybe',
        },
        {
          icon: 'clock',
          title: 'Dlhá výdrž',
          text: '5 500 mAh pohodlne vydrží celý deň intenzívneho používania.',
          verdict: 'yes',
        },
      ],
    },

    // 22. rvx_buyers — Pre koho
    {
      type: 'rvx_buyers',
      eyebrow: 'Verdikt',
      title: 'Pre koho je tento telefón',
      yes: [
        'Mobilných fotografov a videografov',
        'Power userov, ktorí chcú najlepší Android',
        'Biznis profesionálov (S Pen + DeX)',
        'Ľudí, ktorí hľadajú dlhodobú investíciu (7 rokov aktualizácií)',
      ],
      maybe: [
        'Hráčov — výkon je top, ale nabíjanie pomalé',
        'Ľudí s menšími rukami — 6.9" je naozaj veľký',
      ],
      no: [
        'Ľudí s rozpočtom do 800 €',
        'Tých, čo chcú kompaktný telefón',
        'Fanúšikov rýchleho nabíjania (100W+ u konkurencie)',
      ],
    },

    // 23. rvx_experts — Hlasy odborníkov
    {
      type: 'rvx_experts',
      eyebrow: 'Odborníci',
      title: 'Hlasy odborníkov',
      items: [
        {
          name: 'Marko Brownlee (MKBHD)',
          role: 'Tech YouTuber',
          text: 'Samsung konečne urobil telefón, kde nič neprekáža. Fotoaparát je na úrovni profesionálnych kompaktov.',
          score: 9.3,
        },
        {
          name: 'Lisa Gade',
          role: 'MobileTechReview',
          text: 'S Pen a DeX robia z S26 Ultra najproduktívnejší smartfón na trhu. Pre biznis je neprekonateľný.',
          score: 9.0,
        },
        {
          name: 'Dave Lee (Dave2D)',
          role: 'Tech Reviewer',
          text: 'Batéria a displej sú perfektné. Jediná výhrada je nabíjanie — v roku 2026 by malo byť rýchlejšie.',
          score: 8.8,
        },
      ],
    },

    // 24. rvx_awards — Ocenenia
    {
      type: 'rvx_awards',
      eyebrow: 'Ocenenia',
      title: 'Získané ocenenia',
      items: [
        { title: 'Best Smartphone 2026', org: 'MWC Barcelona', year: '2026' },
        { title: "Editor's Choice", org: 'Bytezone.sk', year: '2026' },
        { title: 'Best Camera Phone', org: 'TIPA Awards', year: '2026' },
        { title: 'Innovation Award', org: 'CES Las Vegas', year: '2026' },
      ],
    },

    // 25. rvx_box — Balenie
    {
      type: 'rvx_box',
      eyebrow: 'V balení',
      title: 'Obsah balenia',
      items: [
        'Samsung Galaxy S26 Ultra',
        'S Pen s hrotmi',
        'USB-C kábel (1m)',
        'SIM eject nástroj',
        'Rýchly návod na použitie',
        'Záručný list',
      ],
    },

    // 26. rvx_sustain — Udržateľnosť
    {
      type: 'rvx_sustain',
      eyebrow: 'Ekológia',
      title: 'Udržateľnosť',
      items: [
        { label: 'Recyklovaný materiál', value: '60 % recyklovaný hliník + plast' },
        { label: 'Balenie', value: '100 % recyklovaný papier, bez nabíjačky' },
        { label: 'Aktualizácie', value: '7 rokov OS + security updates' },
        { label: 'Certifikácia', value: 'UL 2809 Eco Label' },
        { label: 'Uhlíková stopa', value: '-15 % vs S25 Ultra' },
      ],
    },

    // 27. rvx_repair — Opraviteľnosť
    {
      type: 'rvx_repair',
      eyebrow: 'Opravy',
      title: 'Opraviteľnosť',
      score: 6.5,
      items: [
        { label: 'iFixit skóre', value: '6/10' },
        { label: 'Výmena batérie', value: 'Stredne náročná (lepidlo)' },
        { label: 'Výmena displeja', value: 'Dostupná — ~180 €' },
        { label: 'Dostupnosť dielov', value: 'Samsung iFixit partnership' },
        { label: 'Nástroje', value: 'Bežný set + ohrievačka' },
      ],
    },

    // 28. rvx_accessories — Príslušenstvo
    {
      type: 'rvx_accessories',
      eyebrow: 'Doplnky',
      title: 'Odporúčané príslušenstvo',
      items: [
        {
          name: 'Samsung 45W nabíjačka',
          price: '49 €',
          url: 'https://www.heureka.sk',
          note: 'V balení nie je — nutné dokúpiť',
        },
        {
          name: 'Samsung Clear Case',
          price: '29 €',
          url: 'https://www.heureka.sk',
          note: 'Originálny priehľadný kryt',
        },
        {
          name: 'Galaxy Buds 4 Pro',
          price: '249 €',
          url: 'https://www.heureka.sk',
          note: 'Najlepšie TWS slúchadlá pre Galaxy',
        },
        {
          name: 'Samsung Wireless Charger Duo',
          price: '69 €',
          url: 'https://www.heureka.sk',
          note: '15W bezdrôtové nabíjanie',
        },
      ],
    },

    // 29. rvx_pricing — Varianty a ceny
    {
      type: 'rvx_pricing',
      eyebrow: 'Ceny',
      title: 'Varianty a ceny',
      items: [
        {
          name: 'S26 Ultra 256 GB',
          price: '1 399 €',
          specs: '12 GB RAM, Titanium Black/Silver',
          url: 'https://www.heureka.sk',
        },
        {
          name: 'S26 Ultra 512 GB',
          price: '1 569 €',
          specs: '12 GB RAM, všetky farby',
          url: 'https://www.heureka.sk',
        },
        {
          name: 'S26 Ultra 1 TB',
          price: '1 819 €',
          specs: '12 GB RAM, Titanium Black only',
          url: 'https://www.heureka.sk',
        },
      ],
    },

    // 30. rvx_buy — Kde kúpiť
    {
      type: 'rvx_buy',
      eyebrow: 'Kúpa',
      title: 'Kde kúpiť',
      items: [
        { shop: 'Samsung.com', price: '1 399 €', url: 'https://samsung.com/sk' },
        { shop: 'Alza.sk', price: '1 379 €', url: 'https://alza.sk' },
        { shop: 'Datart.sk', price: '1 389 €', url: 'https://datart.sk' },
        { shop: 'Heureka.sk', price: 'od 1 365 €', url: 'https://heureka.sk' },
      ],
    },

    // 31. rvx_pricehist — Vývoj ceny
    {
      type: 'rvx_pricehist',
      eyebrow: 'Cenový vývoj',
      title: 'Vývoj ceny',
      note: 'Cena za 256 GB verziu od uvedenia na trh. Očakávame pokles o ~15 % do 6 mesiacov.',
      url: 'https://www.heureka.sk/samsung-galaxy-s26-ultra/',
    },

    // 32. rvx_alts — Alternatívy
    {
      type: 'rvx_alts',
      eyebrow: 'Alternatívy',
      title: 'Zvážte aj tieto',
      items: [
        {
          name: 'Samsung Galaxy S26+',
          score: 8.8,
          reason: 'Rovnaký softvér za menej. Chýba S Pen a 200 MPx fotoaparát.',
          url: '',
        },
        {
          name: 'iPhone 17 Pro Max',
          score: 9.2,
          reason: 'Lepší ekosystém, lepšie video. Drahší, bez S Pen.',
          url: '',
        },
        {
          name: 'Google Pixel 10 Pro',
          score: 8.8,
          reason: 'Najlepšia AI fotografia, čistý Android. Menej prémiový pocit.',
          url: '',
        },
        {
          name: 'OnePlus 14 Ultra',
          score: 8.5,
          reason: 'Výborná hodnota za peniaze, 100W nabíjanie. Menej aktualizácií.',
          url: '',
        },
      ],
    },

    // 33. rvx_faq — Časté otázky
    {
      type: 'rvx_faq',
      eyebrow: 'FAQ',
      title: 'Časté otázky',
      items: [
        {
          q: 'Je S26 Ultra vodoodolný?',
          a: 'Áno, má certifikáciu IP68 — vydrží ponorenie do 1.5m vody po dobu 30 minút.',
        },
        {
          q: 'Má slot na microSD kartu?',
          a: 'Nie, Samsung odstránil slot na microSD kartu od série S21. K dispozícii sú varianty 256 GB, 512 GB a 1 TB.',
        },
        {
          q: 'Ako dlho bude dostávať aktualizácie?',
          a: 'Samsung sľubuje 7 rokov aktualizácií OS aj bezpečnostných záplat, teda do roku 2033.',
        },
        {
          q: 'Oplatí sa upgrade z S25 Ultra?',
          a: 'Ak vám záleží na fotoaparáte a výdrži batérie, áno. Ak máte S25 Ultra a ste spokojní, pokojne počkajte na S27.',
        },
        { q: 'Podporuje eSIM?', a: 'Áno, podporuje dual eSIM aj fyzickú nano-SIM kartu.' },
      ],
    },

    // 34. Rating
    {
      type: 'rating',
      total_score: 9.2,
      badge: "Editor's Choice",
      verdict_title: 'Kráľ Androidu si drží trón',
      verdict_text:
        'Samsung Galaxy S26 Ultra je bezpochyby najlepší Android smartfón na trhu. Kombinuje špičkový fotoaparát, výborný displej, dlhú výdrž batérie a unikátny S Pen do jedného balíka. Jedinou výhradou zostáva pomalé nabíjanie a vysoká cena.',
    },

    // 35. Rating breakdown
    {
      type: 'rating_breakdown',
      criteria: [
        { name: 'Displej', score: 9.8 },
        { name: 'Fotoaparát', score: 9.5 },
        { name: 'Výkon', score: 9.4 },
        { name: 'Batéria', score: 9.0 },
        { name: 'Softvér', score: 9.0 },
        { name: 'Dizajn', score: 9.3 },
        { name: 'Nabíjanie', score: 7.0 },
        { name: 'Hodnota za peniaze', score: 8.0 },
      ],
      width: 'full',
    },

    // 36. rvx_method — Ako sme testovali
    {
      type: 'rvx_method',
      eyebrow: 'Metodika',
      title: 'Ako sme testovali',
      text: 'Zariadenie sme testovali 14 dní v bežnom používaní. Batériové testy boli vykonané pri jasnosti displeja 200 nitov a Wi-Fi pripojení. Benchmarky boli spustené 3× a spriemerované.\n\nFotoaparát sme testovali v rôznych svetelných podmienkach — denné svetlo, zlatá hodinka, nočné scény a interiér s umelým osvetlením.',
      items: [
        'Batériový test: PCMark Battery 3.0 + vlastné scenáre',
        'Výkonový test: AnTuTu v10, Geekbench 6, 3DMark',
        'Fotoaparát: DxOMark protokol + vlastné porovnania',
        'Displej: Meranie jasu, farebnej presnosti (CalMAN)',
        'Tepelný test: 30-minútový záťažový test s meraním teploty',
      ],
    },

    // 37. rvx_editornote — Poznámka editora
    {
      type: 'rvx_editornote',
      text: 'Táto recenzia bola vytvorená na základe 14-dňového testovania zariadenia, ktoré nám zapožičal Samsung Slovakia. Samsung nemal žiadny vplyv na obsah ani hodnotenie recenzie. Zariadenie bolo po testovaní vrátené.',
      author: 'Adam Kováč, šéfredaktor Bytezone',
    },
  ];

  // Vložíme článok
  const searchText = content
    .map((b) => {
      if (b.text) return b.text;
      if (b.title) return b.title;
      if (b.items && Array.isArray(b.items)) {
        return b.items
          .map((it) =>
            typeof it === 'string' ? it : it.title || it.text || it.name || it.label || it.q || ''
          )
          .join(' ');
      }
      return '';
    })
    .join('\n')
    .slice(0, 100000);

  await knex('articles').insert({
    type: 'review',
    title: 'Samsung Galaxy S26 Ultra — Kompletná recenzia 2026',
    slug,
    excerpt:
      'Najkomplexnejšia recenzia Samsung Galaxy S26 Ultra. 200 MPx fotoaparát, Snapdragon 8 Gen 4, 5 500 mAh batéria a S Pen. Stojí za tú cenu?',
    author_id: admin.id,
    status: 'published',
    published_at: knex.fn.now(),
    is_featured: true,
    allow_comments: true,
    content: JSON.stringify(content),
    search_text: searchText,
  });

  console.log('✓ Demo review článok vytvorený: /' + slug);
};
