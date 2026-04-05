const STORAGE_KEY = 'rollcalc_saved_rolls_v9';

document.addEventListener('DOMContentLoaded', () => {
  const els = {
    rollName: document.getElementById('rollName'),
    rollDate: document.getElementById('rollDate'),
    od: document.getElementById('od'),
    id: document.getElementById('id'),
    thickness: document.getElementById('thickness'),
    feetResult: document.getElementById('feetResult'),
    saveBtn: document.getElementById('saveBtn'),
    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),
    installBtn: document.getElementById('installBtn'),
    history: document.getElementById('history'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    warningText: document.getElementById('warningText'),
    saveNote: document.getElementById('saveNote'),
    captureNote: document.getElementById('captureNote'),
    chipOd: document.getElementById('chip-od'),
    chipId: document.getElementById('chip-id'),
    chipThickness: document.getElementById('chip-thickness')
  };

  let saveNoteTimer = null;
  const measurementFields = [els.od, els.id, els.thickness];

  function todayLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now - offset).toISOString().slice(0, 10);
  }

  function parseMeasurement(value) {
    if (value == null) return 0;
    const cleaned = String(value).trim().replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function calcLengthInches(od, id, thicknessInches) {
    if (!(od > 0) || !(id >= 0) || !(thicknessInches > 0) || od <= id) return 0;
    return (Math.PI * ((od * od) - (id * id))) / (4 * thicknessInches);
  }

  function currentValues() {
    const od = parseMeasurement(els.od.value);
    const id = parseMeasurement(els.id.value);
    const thickness = parseMeasurement(els.thickness.value);
    const inches = calcLengthInches(od, id, thickness);
    const feet = inches / 12;
    return { od, id, thickness, inches, feet };
  }

  function showSaveNote(text) {
    els.saveNote.textContent = text || '';
    if (saveNoteTimer) clearTimeout(saveNoteTimer);
    if (text) saveNoteTimer = setTimeout(() => { els.saveNote.textContent = ''; }, 1800);
  }

  function setCaptureHighlight(activeField) {
    measurementFields.forEach(f => f.classList.toggle('capture-ready', f === activeField));
    els.chipOd.classList.toggle('active', activeField === els.od);
    els.chipId.classList.toggle('active', activeField === els.id);
    els.chipThickness.classList.toggle('active', activeField === els.thickness);
  }

  function updateCaptureNote() {
    if (document.activeElement === els.od) {
      els.captureNote.textContent = 'OD is armed. New input replaces the value. Enter moves to ID.';
    } else if (document.activeElement === els.id) {
      els.captureNote.textContent = 'ID is armed. New input replaces the value. Enter moves to Thickness.';
    } else if (document.activeElement === els.thickness) {
      els.captureNote.textContent = 'Thickness is armed. New input replaces the value. Enter finishes.';
    } else {
      els.captureNote.textContent = 'Tap a field and the next caliper input will replace the current value. Pressing Enter moves to the next box.';
    }
  }

  function focusNextField(currentField) {
    const index = measurementFields.indexOf(currentField);
    const nextField = measurementFields[index + 1];
    if (nextField) {
      nextField.focus();
      if (nextField.select) nextField.select();
    } else {
      currentField.blur();
      setCaptureHighlight(null);
      updateCaptureNote();
    }
  }

  function armReplaceOnFocus(el) {
    el.addEventListener('focus', () => {
      setCaptureHighlight(el);
      updateCaptureNote();
      setTimeout(() => { if (el.select) el.select(); }, 0);
    });

    el.addEventListener('pointerdown', () => {
      setTimeout(() => { if (document.activeElement === el && el.select) el.select(); }, 0);
    });

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateResults();
        focusNextField(el);
      }
    });

    el.addEventListener('input', updateResults);
    el.addEventListener('change', updateResults);
  }

  function updateWarning(values) {
    let msg = '';
    if (values.od && values.id && values.od <= values.id) msg = 'OD must be larger than ID.';
    else if (values.od || values.id || values.thickness) {
      if (!values.thickness) msg = 'Enter a valid thickness.';
      else if (!values.feet) msg = 'Check the values.';
    }
    els.warningText.textContent = msg;
  }

  function updateResults() {
    const values = currentValues();
    els.feetResult.textContent = `${values.feet.toFixed(2)} ft`;
    updateWarning(values);
  }

  function loadRolls() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function saveRolls(rolls) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rolls));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderHistory() {
    const rolls = loadRolls().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!rolls.length) {
      els.history.innerHTML = '<div class="empty">No rolls saved yet.</div>';
      return;
    }

    els.history.innerHTML = rolls.map(roll => `
      <div class="history-item">
        <div class="name">${escapeHtml(roll.rollName || 'Untitled Roll')}</div>
        <div class="date">${escapeHtml(roll.rollDate || '')}</div>
        <div class="feet">${Number(roll.feet).toFixed(2)} ft</div>
        <div class="meta">
          <div>OD: ${Number(roll.od).toFixed(3)} in</div>
          <div>ID: ${Number(roll.id).toFixed(3)} in</div>
          <div>Thickness: ${Number(roll.thickness).toFixed(4)} in</div>
        </div>
        <div style="margin-top:10px;">
          <button class="ghost tiny" type="button" data-delete="${roll.createdAt}">Delete</button>
        </div>
      </div>
    `).join('');

    els.history.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const createdAt = btn.getAttribute('data-delete');
        const rolls = loadRolls().filter(r => r.createdAt !== createdAt);
        saveRolls(rolls);
        renderHistory();
        showSaveNote('Roll deleted');
      });
    });
  }

  function saveCurrentRoll() {
    const values = currentValues();
    const rollName = els.rollName.value.trim();
    const rollDate = els.rollDate.value || todayLocalDate();

    if (!rollName) {
      els.warningText.textContent = 'Enter a roll name.';
      els.rollName.focus();
      return;
    }
    if (!(values.feet > 0)) {
      els.warningText.textContent = 'Enter valid OD, ID, and thickness values.';
      return;
    }

    const rolls = loadRolls();
    rolls.push({
      rollName,
      rollDate,
      od: values.od,
      id: values.id,
      thickness: values.thickness,
      inches: values.inches,
      feet: values.feet,
      createdAt: new Date().toISOString()
    });
    saveRolls(rolls);
    renderHistory();
    showSaveNote('Roll saved');
    els.warningText.textContent = '';
  }

  function exportCSV() {
    const rolls = loadRolls().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!rolls.length) {
      showSaveNote('No saved rolls to export');
      return;
    }

    const headers = ['Roll Name', 'Date', 'OD (in)', 'ID (in)', 'Thickness (in)', 'Length (in)', 'Length (ft)'];
    const rows = rolls.map(r => [
      r.rollName, r.rollDate,
      Number(r.od).toFixed(3),
      Number(r.id).toFixed(3),
      Number(r.thickness).toFixed(4),
      Number(r.inches).toFixed(2),
      Number(r.feet).toFixed(2)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `rollcalc-export-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showSaveNote('CSV exported');
  }

  function clearInputs() {
    els.rollName.value = '';
    els.rollDate.value = todayLocalDate();
    els.od.value = '';
    els.id.value = '';
    els.thickness.value = '';
    els.warningText.textContent = '';
    updateResults();
    els.od.focus();
    setCaptureHighlight(els.od);
    updateCaptureNote();
    showSaveNote('');
  }

  function clearAllHistory() {
    if (!loadRolls().length) return;
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showSaveNote('All rolls cleared');
  }

  function showInstallHelp() {
    showSaveNote('Open in Safari, then Share → Add to Home Screen');
  }

  measurementFields.forEach(armReplaceOnFocus);

  els.saveBtn.addEventListener('click', saveCurrentRoll);
  els.exportBtn.addEventListener('click', exportCSV);
  els.clearBtn.addEventListener('click', clearInputs);
  els.installBtn.addEventListener('click', showInstallHelp);
  els.clearHistoryBtn.addEventListener('click', clearAllHistory);
  els.chipOd.addEventListener('click', () => els.od.focus());
  els.chipId.addEventListener('click', () => els.id.focus());
  els.chipThickness.addEventListener('click', () => els.thickness.focus());

  els.rollDate.value = todayLocalDate();
  renderHistory();
  updateResults();
  els.od.focus();
  setCaptureHighlight(els.od);
  updateCaptureNote();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
});
