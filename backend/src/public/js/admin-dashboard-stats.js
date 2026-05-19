/**
 * Admin Stats Dashboard — interaktivita
 *
 * Funkcie:
 *  1. Drag & drop preusporiadanie kariet
 *  2. Uloženie rozloženia do localStorage (poradie, veľkosti, skryté)
 *  3. Možnosť skryť/zobraziť kartu
 *  4. Prepínanie veľkostí S/M/L
 *  5. Panel „Správa kariet" — hromadné zapnutie/vypnutie
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'bz-stats-layout';
  var grid = document.querySelector('.astats-grid');
  if (!grid) return;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function getCards() {
    return Array.from(grid.querySelectorAll('.astats-card'));
  }

  function getCardId(el) {
    return el.getAttribute('data-card-id');
  }

  // -----------------------------------------------------------------------
  // Layout persistence
  // -----------------------------------------------------------------------
  function saveLayout() {
    var cards = getCards();
    var layout = {};
    cards.forEach(function (card, index) {
      layout[getCardId(card)] = {
        order: index,
        size: card.getAttribute('data-card-size'),
        hidden: card.classList.contains('astats-hidden'),
        tall: card.classList.contains('astats-tall'),
      };
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (e) {
      /* quota */
    }
  }

  function loadLayout() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function applyLayout() {
    var layout = loadLayout();
    if (!layout) return;

    var cards = getCards();
    var fragment = document.createDocumentFragment();

    // Zoradiť podľa uloženého poradia
    cards.sort(function (a, b) {
      var la = layout[getCardId(a)];
      var lb = layout[getCardId(b)];
      var oa = la ? la.order : 9999;
      var ob = lb ? lb.order : 9999;
      return oa - ob;
    });

    cards.forEach(function (card) {
      var cfg = layout[getCardId(card)];
      if (cfg) {
        // Veľkosť
        if (cfg.size) {
          card.classList.remove('astats-S', 'astats-M', 'astats-L');
          card.classList.add('astats-' + cfg.size);
          card.setAttribute('data-card-size', cfg.size);
          var btns = card.querySelectorAll('.astats-size-toggle button');
          btns.forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-size') === cfg.size);
          });
        }
        // Skryté
        if (cfg.tall) {
          card.classList.add('astats-tall');
          var hBtn = card.querySelector('.astats-height-toggle');
          if (hBtn) hBtn.classList.add('active');
        } else {
          card.classList.remove('astats-tall');
        }
        if (cfg.hidden) {
          card.classList.add('astats-hidden');
        } else {
          card.classList.remove('astats-hidden');
        }
      }
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  function resetLayout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* */
    }
    location.reload();
  }

  // -----------------------------------------------------------------------
  // Size toggle
  // -----------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.astats-size-toggle button');
    if (!btn) return;
    var card = btn.closest('.astats-card');
    var size = btn.getAttribute('data-size');

    card.classList.remove('astats-S', 'astats-M', 'astats-L');
    card.classList.add('astats-' + size);
    card.setAttribute('data-card-size', size);

    btn.parentElement.querySelectorAll('button').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    saveLayout();
  });

  // -----------------------------------------------------------------------
  // Hide card
  // -----------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.astats-card-hide');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.astats-card');
    card.classList.add('astats-hidden');
    saveLayout();
    updateManagePanel();
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.astats-height-toggle');
    if (!btn) return;
    e.preventDefault();
    var card = btn.closest('.astats-card');
    card.classList.toggle('astats-tall');
    btn.classList.toggle('active', card.classList.contains('astats-tall'));
    saveLayout();
  });

  // -----------------------------------------------------------------------
  // Drag & drop (HTML5 native)
  // -----------------------------------------------------------------------
  var dragCard = null;

  grid.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.astats-card');
    if (!card) return;
    dragCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', getCardId(card));
  });

  grid.addEventListener('dragend', function (e) {
    var card = e.target.closest('.astats-card');
    if (card) card.classList.remove('dragging');
    grid.querySelectorAll('.astats-card').forEach(function (c) {
      c.classList.remove('drop-over');
    });
    dragCard = null;
    saveLayout();
  });

  grid.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var target = e.target.closest('.astats-card');
    if (!target || target === dragCard) return;

    grid.querySelectorAll('.astats-card').forEach(function (c) {
      c.classList.remove('drop-over');
    });
    target.classList.add('drop-over');
  });

  grid.addEventListener('dragleave', function (e) {
    var target = e.target.closest('.astats-card');
    if (target) target.classList.remove('drop-over');
  });

  grid.addEventListener('drop', function (e) {
    e.preventDefault();
    var target = e.target.closest('.astats-card');
    if (!target || !dragCard || target === dragCard) return;

    // Určiť pozíciu: pred alebo za target
    var cards = getCards();
    var dragIdx = cards.indexOf(dragCard);
    var targetIdx = cards.indexOf(target);

    if (dragIdx < targetIdx) {
      grid.insertBefore(dragCard, target.nextSibling);
    } else {
      grid.insertBefore(dragCard, target);
    }

    target.classList.remove('drop-over');
  });

  // Nastav draggable na všetky karty
  function enableDrag() {
    getCards().forEach(function (card) {
      card.setAttribute('draggable', 'true');
      card.classList.add('edit-on');
    });
  }

  function disableDrag() {
    getCards().forEach(function (card) {
      card.removeAttribute('draggable');
      card.classList.remove('edit-on');
    });
  }

  // -----------------------------------------------------------------------
  // Manage panel (správa kariet)
  // -----------------------------------------------------------------------
  function buildManagePanel() {
    var panel = document.getElementById('astats-manage-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'astats-manage-panel';
    panel.className = 'astats-manage-panel';
    panel.innerHTML =
      '<div class="astats-manage-inner">' +
      '<div class="astats-manage-head">' +
      '<h3>Správa kariet</h3>' +
      '<button class="astats-card-act astats-manage-close" title="Zavrieť"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="astats-manage-body" id="astats-manage-list"></div>' +
      '<div class="astats-manage-foot">' +
      '<button class="bz-btn bz-btn-sm astats-manage-show-all">Zobraziť všetky</button>' +
      '<button class="bz-btn bz-btn-sm bz-btn-ghost astats-manage-reset">Obnoviť predvolené</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(panel);

    // Events
    panel.querySelector('.astats-manage-close').addEventListener('click', function () {
      panel.classList.remove('open');
    });
    panel.addEventListener('click', function (e) {
      if (e.target === panel) panel.classList.remove('open');
    });
    panel.querySelector('.astats-manage-show-all').addEventListener('click', function () {
      getCards().forEach(function (c) {
        c.classList.remove('astats-hidden');
      });
      saveLayout();
      updateManagePanel();
    });
    panel.querySelector('.astats-manage-reset').addEventListener('click', function () {
      if (confirm('Obnoviť predvolené rozloženie?')) resetLayout();
    });

    return panel;
  }

  function updateManagePanel() {
    var list = document.getElementById('astats-manage-list');
    if (!list) return;

    var cards = getCards();
    var groups = {};
    cards.forEach(function (card) {
      var g = card.getAttribute('data-card-group');
      if (!groups[g]) groups[g] = [];
      groups[g].push(card);
    });

    var html = '';
    Object.keys(groups).forEach(function (groupName) {
      html +=
        '<div class="astats-manage-group"><span class="astats-manage-group-label">' +
        groupName +
        '</span>';
      groups[groupName].forEach(function (card) {
        var id = getCardId(card);
        var title = card.querySelector('h3').textContent;
        var hidden = card.classList.contains('astats-hidden');
        html +=
          '<label class="astats-manage-item">' +
          '<input type="checkbox" ' +
          (hidden ? '' : 'checked') +
          ' data-manage-id="' +
          id +
          '"/>' +
          '<span>' +
          title +
          '</span>' +
          '</label>';
      });
      html += '</div>';
    });
    list.innerHTML = html;

    // Checkbox events
    list.querySelectorAll('input[data-manage-id]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-manage-id');
        var card = grid.querySelector('[data-card-id="' + id + '"]');
        if (!card) return;
        if (cb.checked) {
          card.classList.remove('astats-hidden');
        } else {
          card.classList.add('astats-hidden');
        }
        saveLayout();
      });
    });
  }

  function openManagePanel() {
    var panel = buildManagePanel();
    updateManagePanel();
    panel.classList.add('open');
  }

  // -----------------------------------------------------------------------
  // Edit mode toggle
  // -----------------------------------------------------------------------
  var editMode = false;

  function toggleEditMode() {
    editMode = !editMode;
    var btn = document.getElementById('astats-edit-btn');
    if (editMode) {
      enableDrag();
      if (btn) {
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Hotovo';
        btn.classList.add('bz-btn-accent');
      }
    } else {
      disableDrag();
      if (btn) {
        btn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i> Upraviť';
        btn.classList.remove('bz-btn-accent');
      }
      saveLayout();
    }
  }

  // -----------------------------------------------------------------------
  // Toolbar buttons — inject
  // -----------------------------------------------------------------------
  var tools = document.querySelector('.astats-tools');
  if (tools) {
    // Edit mode button
    var editBtn = document.createElement('button');
    editBtn.id = 'astats-edit-btn';
    editBtn.className = 'bz-btn bz-btn-sm';
    editBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i> Upraviť';
    editBtn.addEventListener('click', toggleEditMode);
    tools.appendChild(editBtn);

    // Manage button
    var manageBtn = document.createElement('button');
    manageBtn.className = 'bz-btn bz-btn-sm';
    manageBtn.innerHTML = '<i class="bi bi-sliders"></i> Karty';
    manageBtn.addEventListener('click', openManagePanel);
    tools.appendChild(manageBtn);
  }

  // -----------------------------------------------------------------------
  // Filter — doplniť o skryté karty
  // -----------------------------------------------------------------------
  var filters = document.querySelectorAll('.astats-filter');
  var emptyEl = document.getElementById('astats-empty');

  var groupMap = {
    obsah: 'Obsah',
    recenzie: 'Recenzie',
    komunita: 'Komunita',
    navstevnost: 'Návštevnosť',
    seo: 'SEO',
    monetizacia: 'Monetizácia',
    socialne: 'Sociálne siete',
    bezpecnost: 'Bezpečnosť',
    redakcia: 'Redakcia',
    pokrocile: 'Pokročilé',
  };

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      var key = btn.getAttribute('data-filter');

      var visible = 0;
      getCards().forEach(function (card) {
        var isHidden = card.classList.contains('astats-hidden');
        var matchGroup = key === 'all' || card.getAttribute('data-card-group') === groupMap[key];

        if (matchGroup && !isHidden) {
          card.style.display = '';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });

      if (emptyEl) emptyEl.style.display = visible === 0 ? '' : 'none';
    });
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  applyLayout();
})();
