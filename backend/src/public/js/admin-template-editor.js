/**
 * Template block editor — vizuálne rozhranie na skladanie šablón
 */
(function () {
  'use strict';

  var hiddenEl = document.getElementById('tpl-blocks-json');
  var listEl = document.getElementById('tpl-blocks-list');
  var countEl = document.getElementById('tpl-block-count');
  var addSelect = document.getElementById('tpl-add-type');
  var addBtn = document.getElementById('tpl-add-btn');
  if (!hiddenEl || !listEl) return;

  var blocks = [];
  try {
    blocks = JSON.parse(hiddenEl.value || '[]');
  } catch (e) {
    blocks = [];
  }

  var BLOCK_LABELS = {
    paragraph: 'Odsek',
    heading: 'Nadpis',
    image: 'Obrázok',
    section: 'Sekcia',
    divider: 'Oddeľovač',
    youtube: 'YouTube',
    quote: 'Citát',
    list: 'Zoznam',
    gallery: 'Galéria',
    banner: 'Banner',
    review_banner: 'Review banner',
    rating: 'Hodnotenie',
    rating_breakdown: 'Breakdown',
    pros_cons: 'Plusy / Mínusy',
    specs: 'Špecifikácie',
    color_variants: 'Farebné varianty',
    rvx_gallery_full: 'Galéria (všetky)',
    rvx_gallery_exif: 'Galéria EXIF',
    rvx_gallery_compare: 'Pred / Po',
    rvx_gallery_modes: 'Foto režimy',
    rvx_gallery_samples: 'Ukážky foto',
    rvx_gallery_hero: 'Hero galéria',
    rvx_glance: 'Na prvý pohľad',
    rvx_keyspecs: 'Kľúčové špec.',
    rvx_bench: 'Benchmark',
    rvx_battery: 'Batéria',
    rvx_software: 'Softvér',
    rvx_design: 'Dizajn',
    rvx_versus: 'Versus',
    rvx_box: 'Balenie',
    rvx_accessories: 'Príslušenstvo',
    rvx_buy: 'Kde kúpiť',
    rvx_alts: 'Alternatívy',
    rvx_faq: 'FAQ',
    rvx_timeline: 'Časová os',
    rvx_pricing: 'Cenník',
    rvx_hilo: 'Plusy/Mínusy (vizuálne)',
    rvx_experts: 'Expert citáty',
    rvx_usecases: 'Prípady použitia',
    rvx_awards: 'Ocenenia',
    rvx_editornote: 'Poznámka redakcie',
    rvx_method: 'Metodika',
    rvx_quickstrip: 'Quick strip',
    rvx_connect: 'Connect',
    rvx_quotes: 'Citáty',
    rvx_deepdive: 'Deep dive',
    rvx_generations: 'Generácie',
    rvx_profile: 'Profil',
    rvx_sustain: 'Udržateľnosť',
    rvx_repair: 'Opraviteľnosť',
    rvx_pricehist: 'Cenová história',
    rvx_buyers: 'Pre koho',
  };

  var BLOCK_ICONS = {
    paragraph: 'bi-paragraph',
    heading: 'bi-type-h1',
    image: 'bi-image',
    section: 'bi-layout-text-sidebar',
    divider: 'bi-hr',
    youtube: 'bi-youtube',
    quote: 'bi-quote',
    list: 'bi-list-ul',
    gallery: 'bi-images',
    banner: 'bi-badge-ad',
    review_banner: 'bi-badge-ad',
    rating: 'bi-star',
    rating_breakdown: 'bi-bar-chart',
    pros_cons: 'bi-hand-thumbs-up',
    specs: 'bi-table',
    color_variants: 'bi-palette',
  };

  // Fields that can be edited per block type
  var EDITABLE_FIELDS = {
    section: ['eyebrow', 'title'],
    heading: ['text'],
    paragraph: ['text'],
    quote: ['text', 'author'],
    rating: ['verdict_title', 'badge'],
    pros_cons: ['eyebrow', 'title'],
    specs: ['title'],
    youtube: ['caption'],
    rvx_glance: ['eyebrow', 'title'],
    rvx_keyspecs: ['eyebrow', 'title'],
    rvx_bench: ['eyebrow', 'title'],
    rvx_battery: ['eyebrow', 'title'],
    rvx_software: ['eyebrow', 'title'],
    rvx_design: ['eyebrow', 'title'],
    rvx_versus: ['eyebrow', 'title'],
    rvx_box: ['eyebrow', 'title'],
    rvx_accessories: ['eyebrow', 'title'],
    rvx_buy: ['eyebrow', 'title'],
    rvx_alts: ['eyebrow', 'title'],
    rvx_faq: ['eyebrow', 'title'],
    rvx_timeline: ['eyebrow', 'title'],
    rvx_pricing: ['eyebrow', 'title'],
    rvx_hilo: ['eyebrow', 'title'],
    rvx_experts: ['eyebrow', 'title'],
    rvx_usecases: ['eyebrow', 'title'],
    rvx_awards: ['eyebrow', 'title'],
    rvx_editornote: ['eyebrow', 'title'],
    rvx_method: ['eyebrow', 'title'],
    rvx_gallery_full: ['eyebrow', 'title'],
    rvx_gallery_exif: ['eyebrow', 'title'],
    rvx_gallery_compare: ['eyebrow', 'title'],
    rvx_gallery_modes: ['eyebrow', 'title'],
    rvx_gallery_samples: ['eyebrow', 'title'],
    rvx_gallery_hero: ['eyebrow', 'title'],
    rvx_deepdive: ['eyebrow', 'title'],
    rvx_buyers: ['eyebrow', 'title'],
    review_banner: ['title', 'subtitle'],
  };

  var FIELD_LABELS = {
    eyebrow: 'Eyebrow',
    title: 'Nadpis',
    text: 'Text',
    author: 'Autor',
    verdict_title: 'Nadpis verdiktu',
    badge: 'Badge',
    caption: 'Popis',
    subtitle: 'Podnadpis',
  };

  function sync() {
    hiddenEl.value = JSON.stringify(blocks);
    countEl.textContent = blocks.length + ' blokov';
  }

  function render() {
    listEl.innerHTML = '';
    blocks.forEach(function (block, idx) {
      var card = document.createElement('div');
      card.className = 'tpl-block-card';
      card.setAttribute('data-idx', idx);

      var label = BLOCK_LABELS[block.type] || block.type;
      var icon = BLOCK_ICONS[block.type] || 'bi-puzzle';

      // Header
      var header = document.createElement('div');
      header.className = 'tpl-block-head';
      header.innerHTML =
        '<span class="tpl-block-num">' +
        (idx + 1) +
        '</span>' +
        '<i class="bi ' +
        icon +
        '" style="opacity:0.5"></i> ' +
        '<strong>' +
        label +
        '</strong>' +
        '<span style="flex:1"></span>' +
        '<button type="button" class="tpl-act" data-action="up" title="Hore"><i class="bi bi-arrow-up"></i></button>' +
        '<button type="button" class="tpl-act" data-action="down" title="Dolu"><i class="bi bi-arrow-down"></i></button>' +
        '<button type="button" class="tpl-act tpl-act-del" data-action="del" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
      card.appendChild(header);

      // Editable fields
      var fields = EDITABLE_FIELDS[block.type];
      if (fields && fields.length) {
        var body = document.createElement('div');
        body.className = 'tpl-block-body';
        fields.forEach(function (key) {
          var row = document.createElement('div');
          row.className = 'tpl-field';
          var lbl = document.createElement('label');
          lbl.textContent = FIELD_LABELS[key] || key;
          lbl.className = 'tpl-field-label';
          var inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'form-control form-control-sm';
          inp.value = block[key] || '';
          inp.placeholder = FIELD_LABELS[key] || key;
          inp.addEventListener('input', function () {
            blocks[idx][key] = inp.value;
            sync();
          });
          row.appendChild(lbl);
          row.appendChild(inp);
          body.appendChild(row);
        });
        card.appendChild(body);
      }

      listEl.appendChild(card);
    });

    // Actions
    listEl.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var cardEl = btn.closest('.tpl-block-card');
        var i = Number(cardEl.getAttribute('data-idx'));
        var action = btn.getAttribute('data-action');
        if (action === 'del') {
          blocks.splice(i, 1);
        } else if (action === 'up' && i > 0) {
          var tmp = blocks[i];
          blocks[i] = blocks[i - 1];
          blocks[i - 1] = tmp;
        } else if (action === 'down' && i < blocks.length - 1) {
          var tmp2 = blocks[i];
          blocks[i] = blocks[i + 1];
          blocks[i + 1] = tmp2;
        }
        sync();
        render();
      });
    });

    sync();
  }

  // Add block
  addBtn.addEventListener('click', function () {
    var type = addSelect.value;
    if (!type) return;
    var block = { type: type };
    // Set default fields
    var fields = EDITABLE_FIELDS[type];
    if (fields)
      fields.forEach(function (k) {
        block[k] = '';
      });
    // Type-specific defaults
    if (type === 'paragraph') {
      block.format = 'html';
      block.text = '';
    }
    if (type === 'section') {
      block.show_divider = true;
      block.media_id = null;
    }
    if (type === 'heading') {
      block.level = 2;
      block.text = '';
    }
    if (type === 'pros_cons') {
      block.pros = [''];
      block.cons = [''];
      block.width = 'full';
    }
    if (type === 'specs') {
      block.rows = [];
    }
    if (type === 'rating') {
      block.total_score = null;
      block.verdict_text = '';
    }
    if (type === 'rating_breakdown') {
      block.criteria = [];
    }
    if (type === 'image') {
      block.media_id = null;
      block.alt = '';
      block.caption = '';
    }
    if (type === 'youtube') {
      block.video_id = '';
      block.caption = '';
    }
    if (type === 'quote') {
      block.text = '';
      block.author = '';
    }
    if (type === 'list') {
      block.items = [''];
      block.ordered = false;
    }
    if (type === 'gallery') {
      block.items = [];
    }
    if (type === 'review_banner') {
      block.background_media_id = null;
      block.slider_media_ids = [];
      block.score = null;
    }
    if (type === 'color_variants') {
      block.variants = [];
    }
    if (type.startsWith('rvx_') && !block.items) {
      block.items = [];
    }
    blocks.push(block);
    addSelect.value = '';
    sync();
    render();
    // Scroll to new block
    var last = listEl.lastElementChild;
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  render();
})();
