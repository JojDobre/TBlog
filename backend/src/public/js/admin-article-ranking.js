/**
 * admin-article-ranking.js — Phase 9
 *
 * Ranking widget v editore článku.
 * Dáta sa serializujú do jedného hidden inputu (ranking_json)
 * kvôli express.urlencoded({ extended: false }).
 */

(function () {
  'use strict';

  const widget = document.getElementById('ranking-widget');
  if (!widget) return;

  const jsonInput = document.getElementById('rw-json');
  const entriesDiv = document.getElementById('rw-entries');
  const emptyMsg = document.getElementById('rw-empty');
  const addSelect = document.getElementById('rw-add-select');
  const addBtn = document.getElementById('rw-add-btn');

  if (!jsonInput) return;

  // State — pole ranking entries
  let entries = [];
  try {
    entries = JSON.parse(jsonInput.value) || [];
  } catch (e) {
    entries = [];
  }

  // Cache
  const criteriaCache = {};
  let allRankings = [];

  // ---- Init ----
  init();

  async function init() {
    // Načítaj zoznam rebríčkov
    try {
      const resp = await fetch('/api/rankings');
      const data = await resp.json();
      allRankings = data.rankings || [];
    } catch (err) {
      console.error('Failed to load rankings', err);
    }

    // Pre-load kritériá pre existujúce entries a renderuj
    for (const entry of entries) {
      await getCriteria(entry.ranking_id);
    }
    renderAll();

    // Event listeners
    if (addSelect)
      addSelect.addEventListener('change', () => {
        addBtn.disabled = !addSelect.value;
      });
    if (addBtn) addBtn.addEventListener('click', addEntry);
  }

  // ---- Rendering ----

  function renderAll() {
    entriesDiv.innerHTML = '';
    entries.forEach((entry, idx) => renderEntry(entry, idx));
    updateEmptyMsg();
    populateSelect();
    syncJson();
  }

  function renderEntry(entry, idx) {
    const ranking = allRankings.find((r) => String(r.id) === String(entry.ranking_id));
    const name = entry.ranking_name || (ranking ? ranking.name : 'Rebríček #' + entry.ranking_id);
    const criteria = criteriaCache[entry.ranking_id] || [];
    const isNew = !entry.item_id;

    const div = document.createElement('div');
    div.className = 'rw-entry mb-3 pb-3 border-bottom';
    div.dataset.idx = idx;

    // Header
    let html = `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <strong class="small">
          <i class="bi bi-trophy text-warning me-1"></i>${esc(name)}
          ${isNew ? '<span class="badge text-bg-success ms-1" style="font-size:9px">NOVÝ</span>' : ''}
        </strong>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 rw-remove" data-idx="${idx}" title="Odobrať">
          <i class="bi bi-x-lg" style="font-size:10px"></i>
        </button>
      </div>`;

    // Kritériá
    if (criteria.length > 0) {
      html += '<div class="row g-1">';
      criteria.forEach((c) => {
        const isNumeric = ['score_1_10', 'decimal', 'integer', 'price'].includes(c.field_type);
        const type = isNumeric ? 'number' : 'text';
        const val = entry.values && entry.values[c.id] != null ? entry.values[c.id] : '';
        const minMax = c.field_type === 'score_1_10' ? 'min="1" max="10" step="0.1"' : '';
        const step = c.field_type === 'decimal' || c.field_type === 'price' ? 'step="0.01"' : '';
        const ph = c.field_type === 'score_1_10' ? '1–10' : c.unit || '';

        html += `
          <div class="col-6 mb-1">
            <label class="form-label mb-0" style="font-size:11px; color:#6b7280;">
              ${esc(c.name)}${c.unit ? ' <span class="text-muted">(' + esc(c.unit) + ')</span>' : ''}
            </label>
            <input type="${type}" class="form-control form-control-sm rw-crit-input"
                   data-idx="${idx}" data-crit-id="${c.id}"
                   value="${val}" ${minMax} ${step}
                   placeholder="${esc(ph)}" style="font-size:12px">
          </div>`;
      });
      html += '</div>';
    } else {
      html += '<span class="text-muted small">Žiadne kritériá v tomto rebríčku.</span>';
    }

    // Override score
    // Brand + Custom name + Override score
    const brand = entry.custom_brand || '';
    const cname = entry.custom_name || '';
    const ov = entry.override_score != null ? entry.override_score : '';
    html += `
      <div class="row g-2 mt-2">
        <div class="col-6">
          <label class="form-label mb-0" style="font-size:11px; color:#6b7280;">Značka</label>
          <input type="text" class="form-control form-control-sm rw-brand-input"
                 data-idx="${idx}" value="${esc(brand)}"
                 placeholder="napr. Samsung" maxlength="100" style="font-size:12px">
        </div>
        <div class="col-6">
          <label class="form-label mb-0" style="font-size:11px; color:#6b7280;">Vlastný názov <span class="text-muted">(voliteľné)</span></label>
          <input type="text" class="form-control form-control-sm rw-cname-input"
                 data-idx="${idx}" value="${esc(cname)}"
                 placeholder="prepíše názov článku" maxlength="200" style="font-size:12px">
        </div>
      </div>
      <div class="mt-2">
        <label class="form-label small mb-1 text-muted">Celkové skóre (override)</label>
        <input type="number" class="form-control form-control-sm rw-override-input"
               data-idx="${idx}" value="${ov}"
               min="0" max="10" step="0.1" placeholder="auto priemer"
               style="max-width:120px">
      </div>`;

    div.innerHTML = html;
    entriesDiv.appendChild(div);

    // Event: remove
    div.querySelector('.rw-remove').addEventListener('click', () => {
      entries.splice(idx, 1);
      renderAll();
    });

    // Event: brand change
    const brandInput = div.querySelector('.rw-brand-input');
    if (brandInput) {
      brandInput.addEventListener('change', () => {
        entries[idx].custom_brand = brandInput.value.trim() || null;
        syncJson();
      });
    }

    // Event: custom name change
    const cnameInput = div.querySelector('.rw-cname-input');
    if (cnameInput) {
      cnameInput.addEventListener('change', () => {
        entries[idx].custom_name = cnameInput.value.trim() || null;
        syncJson();
      });
    }

    // Events: criterion value change
    div.querySelectorAll('.rw-crit-input').forEach((input) => {
      input.addEventListener('change', () => {
        const i = Number(input.dataset.idx);
        const critId = input.dataset.critId;
        if (!entries[i].values) entries[i].values = {};
        entries[i].values[critId] =
          input.value !== '' ? parseFloat(input.value) || input.value : null;
        syncJson();
      });
    });

    // Event: override change
    const ovInput = div.querySelector('.rw-override-input');
    if (ovInput) {
      ovInput.addEventListener('change', () => {
        entries[idx].override_score = ovInput.value !== '' ? parseFloat(ovInput.value) : null;
        syncJson();
      });
    }
  }

  function populateSelect() {
    if (!addSelect) return;
    const usedIds = new Set(entries.map((e) => String(e.ranking_id)));
    addSelect.innerHTML = '<option value="">— Vyber rebríček —</option>';
    allRankings.forEach((r) => {
      if (usedIds.has(String(r.id))) return;
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      addSelect.appendChild(opt);
    });
    if (addBtn) addBtn.disabled = true;
  }

  function updateEmptyMsg() {
    if (emptyMsg) emptyMsg.style.display = entries.length === 0 ? 'block' : 'none';
  }

  function syncJson() {
    jsonInput.value = JSON.stringify(entries);
  }

  // ---- Actions ----

  async function addEntry() {
    const rankingId = addSelect.value;
    if (!rankingId) return;
    const ranking = allRankings.find((r) => String(r.id) === rankingId);
    if (!ranking) return;

    await getCriteria(rankingId);

    entries.push({
      ranking_id: Number(rankingId),
      ranking_name: ranking.name,
      item_id: null,
      override_score: null,
      values: {},
    });

    renderAll();
  }

  async function getCriteria(rankingId) {
    if (criteriaCache[rankingId]) return criteriaCache[rankingId];
    try {
      const resp = await fetch('/api/rankings/' + rankingId + '/criteria');
      const data = await resp.json();
      criteriaCache[rankingId] = data.criteria || [];
      return criteriaCache[rankingId];
    } catch (err) {
      console.error('Failed to load criteria for ranking', rankingId, err);
      criteriaCache[rankingId] = [];
      return [];
    }
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
})();
