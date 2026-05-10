(() => {
  window.__rankingEditInitCount = (window.__rankingEditInitCount || 0) + 1;
  console.log('ranking edit init count:', window.__rankingEditInitCount);

  const root = document.getElementById('ranking-edit-root');
  if (!root) return;

  const RANKING_ID = root.dataset.rankingId;
  const CSRF = root.dataset.csrf;

  let savingCriterion = false;

  console.log('ranking edit script loaded');

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
    console.log('saveCriterion called');

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
        const text = await resp.text();
        console.error('Non-JSON response:', text);
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

  document.getElementById('open-criterion-btn')?.addEventListener('click', openCriterionModal);

  const oldSaveBtn = document.getElementById('crit-save-btn');
  if (oldSaveBtn) {
    const newSaveBtn = oldSaveBtn.cloneNode(true);
    oldSaveBtn.parentNode.replaceChild(newSaveBtn, oldSaveBtn);
    newSaveBtn.addEventListener('click', saveCriterion);
  }

  document.querySelectorAll('.btn-edit-criterion').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = JSON.parse(btn.dataset.criterion);
      editCriterion(c);
    });
  });

  document.querySelectorAll('.btn-delete-criterion').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteCriterion(btn.dataset.id, btn.dataset.name);
    });
  });
})();
