/* ═══════════════════════════════════════════════════════════
   DATA  — fetch, process, filter, redraw
   ═══════════════════════════════════════════════════════════ */

/* ── Loading overlay helpers ─────────────────────────────── */
const setMsg  = m => { document.getElementById('ov-msg').textContent  = m; };
const setStep = s => { document.getElementById('ov-step').textContent = s; };
const hideOv  = () => {
  const el = document.getElementById('ov');
  el.classList.add('gone');
  setTimeout(() => el.remove(), 500);
};

/* ── Visibility filter ───────────────────────────────────── */

/**
 * Returns true if a row should be shown given the current filter state.
 * Checks: layer toggle, hideEnded, event type, continent, country, search, date range.
 */
function visible(row) {
  if (!actL.has(row._layer)) return false;
  if (hideEnded) {
    const today   = dateOnly(new Date());
    const endDate = parseDate(row[CONFIG.COL_END]) || parseDate(row[CONFIG.COL_START]);
    if (endDate && dateOnly(endDate) < today) return false;
  }
  if (actET.size > 0 && !actET.has((row[CONFIG.COL_CATEGORY] || '').trim())) return false;
  if (filterContinent && (row[CONFIG.COL_CONTINENT] || '').trim() !== filterContinent) return false;
  if (filterCountry   && (row[CONFIG.COL_COUNTRY]   || '').trim() !== filterCountry)   return false;
  if (qStr) {
    const haystack = [CONFIG.COL_NAME, CONFIG.COL_COUNTRY, CONFIG.COL_PROVINCE, CONFIG.COL_CONTINENT]
      .map(k => (row[k] || '').toLowerCase()).join(' ');
    if (!haystack.includes(qStr.toLowerCase())) return false;
  }
  if (dateFrom || dateTo) {
    const rs  = parseDate(row[CONFIG.COL_START]);
    const re  = parseDate(row[CONFIG.COL_END]) || rs;
    if (!rs && !re) return false;
    const fd  = dateOnly(dateFrom), td = dateOnly(dateTo);
    const rsd = dateOnly(rs),      red = dateOnly(re);
    if (fd && red && red < fd) return false;
    if (td && rsd && rsd > td) return false;
  }
  return true;
}

/** Return the currently visible subset of rows. */
function visibleRows() { return rows.filter(visible); }

/* ── Rows used to populate geo dropdowns ─────────────────── */

/**
 * Returns rows that pass hideEnded + actET, but ignores geo/search/date.
 * Used to build continent/country dropdowns so only relevant options appear.
 */
function rowsForDropdowns() {
  const today = dateOnly(new Date());
  return rows.filter(row => {
    if (hideEnded) {
      const endDate = parseDate(row[CONFIG.COL_END]) || parseDate(row[CONFIG.COL_START]);
      if (endDate && dateOnly(endDate) < today) return false;
    }
    if (actET.size > 0 && !actET.has((row[CONFIG.COL_CATEGORY] || '').trim())) return false;
    return true;
  });
}

/* ── Geo filter UI ───────────────────────────────────────── */

/** Populate continent + country dropdowns on first load. */
function buildGeoFilters() {
  const base   = rowsForDropdowns();
  const cSet   = new Set();
  const ctrSet = new Set();
  base.forEach(r => {
    const c = (r[CONFIG.COL_CONTINENT] || '').trim(); if (c) cSet.add(c);
    const t = (r[CONFIG.COL_COUNTRY]   || '').trim(); if (t) ctrSet.add(t);
  });
  const cSel   = document.getElementById('filter-continent');
  const ctrSel = document.getElementById('filter-country');
  cSel.innerHTML   = '<option value="">All continents</option>';
  ctrSel.innerHTML = '<option value="">All countries</option>';
  Array.from(cSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o);
  });
  Array.from(ctrSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
}

/** Rebuild continent + country dropdowns, preserving valid selections. */
function refreshGeoDropdowns() {
  const prevContinent = filterContinent;
  const prevCountry   = filterCountry;
  const base = rowsForDropdowns();

  const cSet = new Set();
  base.forEach(r => { const c = (r[CONFIG.COL_CONTINENT] || '').trim(); if (c) cSet.add(c); });
  const cSel = document.getElementById('filter-continent');
  cSel.innerHTML = '<option value="">All continents</option>';
  Array.from(cSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o);
  });
  filterContinent = cSet.has(prevContinent) ? prevContinent : '';
  cSel.value = filterContinent;

  const ctrSet = new Set();
  base.forEach(r => {
    if (!filterContinent || (r[CONFIG.COL_CONTINENT] || '').trim() === filterContinent) {
      const c = (r[CONFIG.COL_COUNTRY] || '').trim(); if (c) ctrSet.add(c);
    }
  });
  const ctrSel = document.getElementById('filter-country');
  ctrSel.innerHTML = '<option value="">All countries</option>';
  Array.from(ctrSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
  filterCountry = ctrSet.has(prevCountry) ? prevCountry : '';
  ctrSel.value = filterCountry;
}

/** Fired when the continent dropdown changes. */
function onContinentChange() {
  filterContinent = document.getElementById('filter-continent').value;
  filterCountry   = '';
  const ctrSel = document.getElementById('filter-country');
  ctrSel.innerHTML = '<option value="">All countries</option>';
  const ctrs = new Set();
  rowsForDropdowns().forEach(r => {
    if (!filterContinent || (r[CONFIG.COL_CONTINENT] || '').trim() === filterContinent) {
      const c = (r[CONFIG.COL_COUNTRY] || '').trim(); if (c) ctrs.add(c);
    }
  });
  Array.from(ctrs).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
  document.getElementById('filter-country').value = '';
  redraw();
}

/** Fired when the country dropdown changes. */
function onFilterChange() {
  filterCountry = document.getElementById('filter-country').value;
  redraw();
}

/* ── Date filter UI ──────────────────────────────────────── */

function clearDates() {
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  dateFrom = null; dateTo = null;
  redraw();
}

document.getElementById('date-from').addEventListener('change', function () {
  dateFrom = this.value ? new Date(this.value + 'T00:00:00') : null;
  redraw();
});
document.getElementById('date-to').addEventListener('change', function () {
  dateTo = this.value ? new Date(this.value + 'T00:00:00') : null;
  redraw();
});

/* ── Clear all filters ───────────────────────────────────── */

function clearAllFilters() {
  clearDates();
  document.getElementById('filter-continent').value = '';
  document.getElementById('filter-country').value   = '';
  filterContinent = ''; filterCountry = '';
  const ctrs = new Set();
  rowsForDropdowns().forEach(r => { const c = (r[CONFIG.COL_COUNTRY] || '').trim(); if (c) ctrs.add(c); });
  const ctrSel = document.getElementById('filter-country');
  ctrSel.innerHTML = '<option value="">All countries</option>';
  Array.from(ctrs).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
  actET = new Set();
  document.querySelectorAll('.et').forEach(b => b.classList.remove('on'));
  document.getElementById('q').value = ''; qStr = '';
  redraw();
}

/* ── Event type filter UI ────────────────────────────────── */

const ET_ORDER   = ['Festival', 'Retreat', 'Intensive', 'Event', 'Training'];
const ET_PREMIUM = new Set([]);

function buildEventTypes() {
  const wrap = document.getElementById('et');
  wrap.innerHTML = '';
  ET_ORDER.forEach(type => {
    const locked = ET_PREMIUM.has(type);
    const btn = document.createElement('span');
    btn.className  = 'et' + (locked ? ' locked' : '');
    btn.dataset.et = type;
    btn.title      = locked ? 'Premium — coming soon' : type;
    btn.innerHTML  = `${etIcon(type)} ${escHtml(type)}${locked ? ` <span class="et-lock">🔒</span>` : ''}`;
    if (!locked) {
      btn.addEventListener('click', () => {
        if (actET.has(type)) { actET.delete(type); btn.classList.remove('on'); }
        else                 { actET.add(type);    btn.classList.add('on'); }
        refreshGeoDropdowns();
        redraw();
      });
    }
    wrap.appendChild(btn);
  });
}

/* ── Process raw CSV rows ────────────────────────────────── */

function processData(data) {
  const lSet = new Set();
  data.forEach(row => {
    row._layer = (row[CONFIG.COL_LAYER] || 'Other').trim() || 'Other';
    row._lat   = parseFloat((row[CONFIG.COL_LAT] || '').replace(',', '.'));
    row._lon   = parseFloat((row[CONFIG.COL_LON] || '').replace(',', '.'));
    lSet.add(row._layer);
  });
  rows = data;
  const layers = Array.from(lSet).sort();
  assignColors(layers);
  actL = new Set(layers);
  buildGeoFilters();
  buildEventTypes();
  document.getElementById('s-total').textContent = rowsForDropdowns().length;
  document.getElementById('s-vis').textContent   = rows.length;
  redraw();
}

/* ── Redraw all active views ─────────────────────────────── */

function redraw() {
  const vis = visibleRows();
  document.getElementById('s-vis').textContent = vis.length;
  if (currentView === 'map')  redrawMap();
  if (currentView === 'list') { listPage = 1; renderList(); }
  if (currentView === 'cal')  renderCalendar();
  updateClearButton();
  if (window.parentIFrame) window.parentIFrame.size(); // resize after every filter change
}

/**
 * Show the ✕ Clear button only when at least one filter is active.
 * Compares against the "everything visible" default state.
 */
function updateClearButton() {
  const btn = document.getElementById('btn-clear');
  if (!btn) return;
  const active =
    !!qStr ||
    !!filterContinent ||
    !!filterCountry ||
    !!dateFrom ||
    !!dateTo ||
    actET.size > 0;
  btn.style.display = active ? '' : 'none';
}

/* ── Fetch & init ────────────────────────────────────────── */

async function init() {
  setMsg('Fetching event data…');

  // ── Primary: Cloudflare Worker ───────────────────────────
  try {
    const workerURL = 'https://tiny-recipe-c86a.be-nomadicated.workers.dev/events';
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(workerURL, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rawData = json.rows;
    if (!rawData || !rawData.length) throw new Error('Empty response from worker');
    processData(rawData);
    hideOv();
    if (window.parentIFrame) window.parentIFrame.size();
    return;
  } catch (workerErr) {
    console.warn('Worker fetch failed, falling back to Google Sheets CSV:', workerErr.message);
    setStep('Retrying via Google Sheets…');
  }

  // ── Fallback: Google Sheets CSV ──────────────────────────
  try {
    const csvURL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID_ENC}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.SHEET_TAB_ENC)}`;
    const res = await fetch(csvURL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawCSV = await res.text();
    const data = parseCSV(rawCSV);
    if (!data.length) throw new Error('No rows parsed from CSV');
    processData(data);
    hideOv();
    if (window.parentIFrame) window.parentIFrame.size();
  } catch (csvErr) {
    setMsg('❌ Could not load data: ' + csvErr.message);
    setStep('Check the sheet is shared as "Anyone can view"');
  }
}