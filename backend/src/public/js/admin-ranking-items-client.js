/**
 * admin-ranking-items.js — Phase 9
 *
 * Klientský JS pre správu položiek rebríčka na edit stránke.
 * Závisí na Bootstrap 5.3+, globálne premenné RANKING_ID a CSRF.
 */

(function () {
  'use strict';

  // Tieto premenné nastaví inline script v edit.ejs
  if (typeof window.__bzRanking === 'undefined') return;
  const RANKING_ID = window.__bzRanking.id;
  const CSRF = window.__bzRanking.csrf;

  // ---------------------------------------------------------------------------
  // Article search autocomplete
  // ---------------------------------------------------------------------------
  const searchInput = document.getElementById('item-article-search');
  const resultsDiv = document.getElementById('item-search-results');
  const selectedDiv = document.getElementById('item-selected-article');
  const hiddenArticleId = document.getElementById('item-article-id');
  let searchTimeout = null;

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      const q = this.value.trim();
      if (q.length < 2) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
        return;
      }
      searchTimeout = setTimeout(() => doSearch(q), 300);
    });

    // Kliknutie mimo zavrieresults
    document.addEventListener('click', function (e) {
      if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.style.display = 'none';
      }
    });
  }

  async function doSearch(q) {
    try {
      const resp = await fetch('/api/articles/search?q=' + encodeURIComponent(q));
      const data = await resp.json();
      if (!data.results || data.results.length === 0) {
        resultsDiv.innerHTML = '<div class="p-2 text-muted small">Žiadne výsledky.</div>';
        resultsDiv.style.display = 'block';
        return;
      }
      resultsDiv.innerHTML = data.results.map(a =>
        '<button type="button" class="dropdown-item d-flex align-items-center gap-2 py-2" ' +
        'data-article-id="' + a.id + '" data-article-title="' + escHtml(a.title) + '">' +
        '<span class="badge text-bg-' + (a.type === 'review' ? 'warning' : 'secondary') + ' me-1">' +
          (a.type === 'review' ? 'Recenzia' : 'Článok') +
        '</span>' +
        '<span class="text-truncate">' + escHtml(a.title) + '</span>' +
        '<span class="ms-auto small text-muted">#' + a.id + '</span>' +
        '</button>'
      ).join('');
      resultsDiv.style.display = 'block';

      // Click handler
      resultsDiv.querySelectorAll('[data-article-id]').forEach(btn => {
        btn.addEventListener('click', function () {
          selectArticle(this.dataset.articleId, this.dataset.articleTitle);
        });
      });
    } catch (err) {
      console.error('Search failed', err);
    }
  }

  function selectArticle(id, title) {
    hiddenArticleId.value = id;
    selectedDiv.innerHTML =
      '<div class="alert alert-info py-2 mb-0 d-flex align-items-center justify-content-between">' +
      '<span><i class="bi bi-file-earmark-text me-2"></i><strong>' + escHtml(title) + '</strong> (#' + id + ')</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" onclick="clearSelectedArticle()">×</button>' +
      '</div>';
    searchInput.value = '';
    resultsDiv.style.display = 'none';
    // Skry custom fields
    document.getElementById('custom-product-fields').style.display = 'none';
  }

  window.clearSelectedArticle = function () {
    hiddenArticleId.value = '';
    selectedDiv.innerHTML = '';
    document.getElementById('custom-product-fields').style.display = 'block';
  };

  // Prepínanie: článok vs. vlastný produkt
  const tabArticle = document.getElementById('tab-item-article');
  const tabCustom = document.getElementById('tab-item-custom');
  if (tabArticle && tabCustom) {
    tabArticle.addEventListener('click', function () {
      tabArticle.classList.add('active');
      tabCustom.classList.remove('active');
      document.getElementById('item-article-panel').style.display = 'block';
      document.getElementById('item-custom-panel').style.display = 'none';
    });
    tabCustom.addEventListener('click', function () {
      tabCustom.classList.add('active');
      tabArticle.classList.remove('active');
      document.getElementById('item-article-panel').style.display = 'none';
      document.getElementById('item-custom-panel').style.display = 'block';
    });
  }

  // ---------------------------------------------------------------------------
  // Save new item
  // ---------------------------------------------------------------------------
  window.saveNewItem = async function () {
    const form = document.getElementById('add-item-form');
    const fd = new URLSearchParams(new FormData(form));
    fd.set('_csrf', CSRF);

    const errEl = document.getElementById('item-add-errors');
    errEl.style.display = 'none';

    try {
      const resp = await fetch('/admin/rankings/' + RANKING_ID + '/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) {
        errEl.textContent = data.error || 'Chyba pri pridávaní.';
        errEl.style.display = 'block';
        return;
      }
      location.reload();
    } catch (err) {
      console.error(err);
      errEl.textContent = 'Sieťová chyba.';
      errEl.style.display = 'block';
    }
  };

  // ---------------------------------------------------------------------------
  // Edit item (inline modal)
  // ---------------------------------------------------------------------------
  window.openEditItemModal = function (itemId) {
    const row = document.querySelector('[data-item-row="' + itemId + '"]');
    if (!row) return;

    // Naplň modal z data atribútov
    const modal = document.getElementById('editItemModal');
    modal.querySelector('#edit-item-id').value = itemId;
    modal.querySelector('#edit-custom-name').value = row.dataset.customName || '';
    modal.querySelector('#edit-custom-brand').value = row.dataset.customBrand || '';
    modal.querySelector('#edit-override-score').value = row.dataset.overrideScore || '';

    // Naplň kritériá
    const criteriaContainer = modal.querySelector('#edit-criteria-values');
    criteriaContainer.querySelectorAll('[data-edit-crit]').forEach(input => {
      const critId = input.dataset.editCrit;
      input.value = row.dataset['crit' + critId] || '';
    });

    new bootstrap.Modal(modal).show();
  };

  window.saveEditItem = async function () {
    const modal = document.getElementById('editItemModal');
    const itemId = modal.querySelector('#edit-item-id').value;
    const form = modal.querySelector('#edit-item-form');
    const fd = new URLSearchParams(new FormData(form));
    fd.set('_csrf', CSRF);

    try {
      const resp = await fetch('/admin/rankings/' + RANKING_ID + '/items/' + itemId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.error || 'Chyba pri ukladaní.');
        return;
      }
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Sieťová chyba.');
    }
  };

  // ---------------------------------------------------------------------------
  // Delete item
  // ---------------------------------------------------------------------------
  window.deleteRankingItem = async function (itemId, name) {
    if (!confirm('Naozaj odobrať „' + name + '" z rebríčka?')) return;
    try {
      const resp = await fetch('/admin/rankings/' + RANKING_ID + '/items/' + itemId + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '_csrf=' + encodeURIComponent(CSRF),
      });
      if (resp.ok) location.reload();
      else alert('Chyba pri mazaní.');
    } catch (err) {
      console.error(err);
      alert('Sieťová chyba.');
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & drop reorder items
  // ---------------------------------------------------------------------------
  const itemsTbody = document.getElementById('items-tbody');
  if (itemsTbody) {
    let dragItem = null;
    itemsTbody.querySelectorAll('tr[data-item-row]').forEach(tr => {
      const grip = tr.querySelector('.bi-grip-vertical');
      if (!grip) return;
      const cell = grip.closest('td');
      cell.setAttribute('draggable', 'true');
      cell.addEventListener('dragstart', (e) => {
        dragItem = tr;
        tr.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      cell.addEventListener('dragend', () => {
        tr.style.opacity = '';
        dragItem = null;
      });
    });

    itemsTbody.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('tr[data-item-row]');
      if (target && target !== dragItem && itemsTbody.contains(target)) {
        const rect = target.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        itemsTbody.insertBefore(dragItem, after ? target.nextSibling : target);
      }
    });

    itemsTbody.addEventListener('drop', async (e) => {
      e.preventDefault();
      const rows = itemsTbody.querySelectorAll('tr[data-item-row]');
      const order = Array.from(rows).map(r => r.dataset.itemRow);

      // Update rank numbers
      rows.forEach((r, i) => {
        const numCell = r.querySelector('.item-rank-num');
        if (numCell) numCell.textContent = i + 1;
      });

      try {
        await fetch('/admin/rankings/' + RANKING_ID + '/items/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _csrf: CSRF, order }),
        });
      } catch (err) {
        console.error('reorder failed', err);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
