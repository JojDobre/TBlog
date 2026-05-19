/**
 * Admin Dashboard Index — drag & drop + správa kariet
 *
 * Rovnaký systém ako stats dashboard, ale:
 *  - Iný localStorage kľúč (bz-dash-index-layout)
 *  - Všetky karty skryté po prvom načítaní (používateľ si pridá)
 *  - Pracuje s gridom #bz-dash-grid
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'bz-dash-index-layout';
  var grid = document.getElementById('bz-dash-grid');
  if (!grid) return;

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
    var layout = { _init: true };
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
    } catch (e) {}
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

    if (!layout) {
      // Prvé načítanie — Dashboard karty viditeľné, ostatné skryté
      getCards().forEach(function (c) {
        if (c.getAttribute('data-card-group') === 'Dashboard') {
          c.classList.remove('astats-hidden');
        } else {
          c.classList.add('astats-hidden');
        }
      });
      return;
    }

    var cards = getCards();
    var fragment = document.createDocumentFragment();

    cards.sort(function (a, b) {
      var la = layout[getCardId(a)];
      var lb = layout[getCardId(b)];
      return (la ? la.order : 9999) - (lb ? lb.order : 9999);
    });

    cards.forEach(function (card) {
      var cfg = layout[getCardId(card)];
      if (cfg) {
        if (cfg.size) {
          card.classList.remove('astats-S', 'astats-M', 'astats-L');
          card.classList.add('astats-' + cfg.size);
          card.setAttribute('data-card-size', cfg.size);
          card.querySelectorAll('.astats-size-toggle button').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-size') === cfg.size);
          });
        }
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
      } else {
        // Karta nie je v uloženom layoute — Dashboard viditeľná, ostatné skryť
        if (card.getAttribute('data-card-group') !== 'Dashboard') {
          card.classList.add('astats-hidden');
        }
      }
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  function resetLayout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
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
  // Drag & drop
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
  // Manage panel
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
      '<h3>Pridať karty na dashboard</h3>' +
      '<button class="astats-card-act astats-manage-close" title="Zavrieť"><i class="bi bi-x-lg"></i></button>' +
      '</div>' +
      '<div class="astats-manage-body" id="astats-manage-list"></div>' +
      '<div class="astats-manage-foot">' +
      '<button class="bz-btn bz-btn-sm astats-manage-show-all">Zobraziť všetky</button>' +
      '<button class="bz-btn bz-btn-sm bz-btn-ghost astats-manage-hide-all">Skryť všetky</button>' +
      '<button class="bz-btn bz-btn-sm bz-btn-ghost astats-manage-reset">Obnoviť predvolené</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(panel);

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
    panel.querySelector('.astats-manage-hide-all').addEventListener('click', function () {
      getCards().forEach(function (c) {
        c.classList.add('astats-hidden');
      });
      saveLayout();
      updateManagePanel();
    });
    panel.querySelector('.astats-manage-reset').addEventListener('click', function () {
      if (confirm('Obnoviť predvolené rozloženie? Všetky karty budú skryté.')) resetLayout();
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

    list.querySelectorAll('input[data-manage-id]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var card = grid.querySelector('[data-card-id="' + cb.getAttribute('data-manage-id') + '"]');
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
  var editBtn = document.getElementById('bz-dash-edit-btn');
  var manageBtn = document.getElementById('bz-dash-manage-btn');

  if (editBtn) {
    editBtn.addEventListener('click', function () {
      editMode = !editMode;
      if (editMode) {
        enableDrag();
        editBtn.innerHTML = '<i class="bi bi-check-lg"></i> Hotovo';
        editBtn.classList.add('bz-btn-accent');
      } else {
        disableDrag();
        editBtn.innerHTML = '<i class="bi bi-grid-3x3-gap"></i> Upraviť';
        editBtn.classList.remove('bz-btn-accent');
        saveLayout();
      }
    });
  }

  if (manageBtn) {
    manageBtn.addEventListener('click', openManagePanel);
  }

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  applyLayout();
})();
