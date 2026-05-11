(() => {
  window.__rankingEditInitCount = (window.__rankingEditInitCount || 0) + 1;

  const root = document.getElementById('ranking-edit-root');
  if (!root) return;

  const RANKING_ID = root.dataset.rankingId;
  const CSRF = root.dataset.csrf;

  let savingCriterion = false;

  // =========================================================================
  // CRITERIA
  // =========================================================================

  function openCriterionModal() {
    document.getElementById('crit-id').value = '';
    document.getElementById('crit-name').value = '';
    document.getElementById('crit-field-type').value = 'score_1_10';
    document.getElementById('crit-unit').value = '';
    document.getElementById('crit-filterable').checked = false;
    document.getElementById('crit-total').checked = false;
    document.getElementById('crit-errors').style.display = 'none';
    document.getElementById('criterionModalTitle').textContent = 'Pridať kritérium';
  }

  function editCriterion(c) {
    document.getElementById('crit-id').value = c.id;
    document.getElementById('crit-name').value = c.name;
    document.getElementById('crit-field-type').value = c.field_type;
    document.getElementById('crit-unit').value = c.unit || '';
    document.getElementById('crit-filterable').checked = !!c.is_filterable;
    document.getElementById('crit-total').checked = !!c.is_total;
    document.getElementById('crit-errors').style.display = 'none';
    document.getElementById('criterionModalTitle').textContent = 'Upraviť kritérium';
    new bootstrap.Modal(document.getElementById('criterionModal')).show();
  }

  async function saveCriterion(e) {
    if (e) e.preventDefault();
    if (savingCriterion) return;
    savingCriterion = true;

    const saveBtn = document.getElementById('crit-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const id = document.getElementById('crit-id').value;
      const body = new URLSearchParams({
        _csrf: CSRF,
        name: document.getElementById('crit-name').value,
        field_type: document.getElementById('crit-field-type').value,
        unit: document.getElementById('crit-unit').value,
        is_filterable: document.getElementById('crit-filterable').checked ? '1' : '0',
        is_total: document.getElementById('crit-total').checked ? '1' : '0',
      });

      const url = id
        ? `/admin/rankings/${RANKING_ID}/criteria/${id}`
        : `/admin/rankings/${RANKING_ID}/criteria`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const contentType = resp.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await resp.json();
      } else {
        throw new Error('Server nevrátil JSON.');
      }

      if (!resp.ok) {
        const errEl = document.getElementById('crit-errors');
        errEl.textContent = data.errors
          ? Object.values(data.errors).join(', ')
          : data.error || 'Chyba';
        errEl.style.display = 'block';
        return;
      }
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Chyba pri ukladaní kritéria.');
    } finally {
      savingCriterion = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function deleteCriterion(id, name) {
    if (!confirm('Naozaj zmazať kritérium „' + name + '"? Zmažú sa aj všetky hodnoty.')) return;
    try {
      const resp = await fetch(`/admin/rankings/${RANKING_ID}/criteria/${id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '_csrf=' + encodeURIComponent(CSRF),
      });
      if (resp.ok) location.reload();
      else alert('Chyba pri mazaní.');
    } catch (err) {
      console.error(err);
      alert('Chyba pri mazaní kritéria.');
    }
  }

  // Criteria event listeners
  document.getElementById('open-criterion-btn')?.addEventListener('click', openCriterionModal);

  const oldSaveBtn = document.getElementById('crit-save-btn');
  if (oldSaveBtn) {
    const newSaveBtn = oldSaveBtn.cloneNode(true);
    oldSaveBtn.parentNode.replaceChild(newSaveBtn, oldSaveBtn);
    newSaveBtn.addEventListener('click', saveCriterion);
  }

  document.querySelectorAll('.btn-edit-criterion').forEach((btn) => {
    btn.addEventListener('click', () => editCriterion(JSON.parse(btn.dataset.criterion)));
  });

  document.querySelectorAll('.btn-delete-criterion').forEach((btn) => {
    btn.addEventListener('click', () => deleteCriterion(btn.dataset.id, btn.dataset.name));
  });

  // =========================================================================
  // ITEMS — article search autocomplete
  // =========================================================================

  const searchInput = document.getElementById('item-article-search');
  const resultsDiv = document.getElementById('item-search-results');
  const hiddenArticleId = document.getElementById('item-article-id');
  const selectedDiv = document.getElementById('item-selected-article');
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

    document.addEventListener('click', (e) => {
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
      resultsDiv.innerHTML = data.results
        .map(
          (a) =>
            '<button type="button" class="dropdown-item d-flex align-items-center gap-2 py-2" ' +
            'data-article-id="' +
            a.id +
            '" data-article-title="' +
            esc(a.title) +
            '">' +
            '<span class="badge text-bg-' +
            (a.type === 'review' ? 'warning' : 'secondary') +
            '">' +
            (a.type === 'review' ? 'Recenzia' : 'Článok') +
            '</span>' +
            '<span class="text-truncate">' +
            esc(a.title) +
            '</span>' +
            '<span class="ms-auto small text-muted">#' +
            a.id +
            '</span></button>'
        )
        .join('');
      resultsDiv.style.display = 'block';
      resultsDiv.querySelectorAll('[data-article-id]').forEach((btn) => {
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
      '<span><i class="bi bi-file-earmark-text me-2"></i><strong>' +
      esc(title) +
      '</strong> (#' +
      id +
      ')</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" id="clear-selected-article">×</button></div>';
    searchInput.value = '';
    resultsDiv.style.display = 'none';
    document.getElementById('item-custom-panel').style.display = 'none';
    document
      .getElementById('clear-selected-article')
      .addEventListener('click', clearSelectedArticle);
  }

  function clearSelectedArticle() {
    hiddenArticleId.value = '';
    selectedDiv.innerHTML = '';
    document.getElementById('item-custom-panel').style.display = 'block';
  }

  // Tab switching: Article vs Custom
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
      hiddenArticleId.value = '';
      selectedDiv.innerHTML = '';
    });
  }

  // =========================================================================
  // ITEMS — Save new item
  // =========================================================================

  document.getElementById('add-item-btn')?.addEventListener('click', async () => {
    const form = document.getElementById('add-item-form');
    const fd = new URLSearchParams();
    form.querySelectorAll('input[name], select[name]').forEach((el) => {
      fd.set(el.name, el.value);
    });
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
      errEl.textContent = 'Sieťová chyba.';
      errEl.style.display = 'block';
    }
  });

  // =========================================================================
  // ITEMS — Edit item modal
  // =========================================================================

  document.querySelectorAll('.btn-edit-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset;
      const modal = document.getElementById('editItemModal');
      modal.querySelector('#edit-item-id').value = d.itemId;
      modal.querySelector('#edit-custom-name').value = d.customName || '';
      modal.querySelector('#edit-custom-brand').value = d.customBrand || '';
      modal.querySelector('#edit-override-score').value = d.overrideScore || '';

      // Criterion values from data attributes
      modal.querySelectorAll('[data-edit-crit]').forEach((input) => {
        input.value = d['crit' + input.dataset.editCrit] || '';
      });

      new bootstrap.Modal(modal).show();
    });
  });

  document.getElementById('save-edit-item')?.addEventListener('click', async () => {
    const modal = document.getElementById('editItemModal');
    const itemId = modal.querySelector('#edit-item-id').value;
    const form = modal.querySelector('#edit-item-form');
    const fd = new URLSearchParams();
    form.querySelectorAll('input[name], select[name]').forEach((el) => {
      fd.set(el.name, el.value);
    });
    fd.set('_csrf', CSRF);

    try {
      const resp = await fetch('/admin/rankings/' + RANKING_ID + '/items/' + itemId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(),
      });
      if (resp.ok) location.reload();
      else alert('Chyba pri ukladaní.');
    } catch (err) {
      alert('Sieťová chyba.');
    }
  });

  // =========================================================================
  // ITEMS — Delete item
  // =========================================================================

  document.querySelectorAll('.btn-delete-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.name;
      if (!confirm('Naozaj odobrať „' + name + '" z rebríčka?')) return;
      try {
        const resp = await fetch(
          '/admin/rankings/' + RANKING_ID + '/items/' + btn.dataset.itemId + '/delete',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: '_csrf=' + encodeURIComponent(CSRF),
          }
        );
        if (resp.ok) location.reload();
        else alert('Chyba pri mazaní.');
      } catch (err) {
        alert('Sieťová chyba.');
      }
    });
  });

  // =========================================================================
  // ITEMS — Drag & drop reorder
  // =========================================================================

  const itemsTbody = document.getElementById('items-tbody');
  if (itemsTbody) {
    let dragItem = null;
    itemsTbody.querySelectorAll('tr[data-item-id]').forEach((tr) => {
      const grip = tr.querySelector('.bi-grip-vertical');
      if (!grip) return;
      const cell = grip.closest('td');
      cell.setAttribute('draggable', 'true');
      cell.style.cursor = 'grab';
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
      const target = e.target.closest('tr[data-item-id]');
      if (target && target !== dragItem && itemsTbody.contains(target)) {
        const rect = target.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        itemsTbody.insertBefore(dragItem, after ? target.nextSibling : target);
      }
    });

    itemsTbody.addEventListener('drop', async (e) => {
      e.preventDefault();
      const rows = itemsTbody.querySelectorAll('tr[data-item-id]');
      const order = Array.from(rows).map((r) => r.dataset.itemId);

      // Update rank numbers visually
      rows.forEach((r, i) => {
        const num = r.querySelector('.item-rank-num');
        if (num) num.textContent = i + 1;
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

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
