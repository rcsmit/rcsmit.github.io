/* ═══════════════════════════════════════════════════════════
   DATA  — fetch, process, filter, redraw
   All event type labels come from CONFIG.CATEGORIES (JSON).
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
    const rsd = dateOnly(rs),       red = dateOnly(re);
    if (fd && red && red < fd) return false;
    if (td && rsd && rsd > td) return false;
  }
  if (filterDeals && !(row[CONFIG.COL_INSIDER_DEALS] || '').trim()) return false;
  return true;
}

function visibleRows() { return rows.filter(visible); }

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

function buildGeoFilters() {
  const base   = rowsForDropdowns();
  const cSet   = new Set();
  const ctrSet = new Set();
  base.forEach(r => {
    const c = (r[CONFIG.COL_CONTINENT] || '').trim(); if (c) cSet.add(c);
    const t = (r[CONFIG.COL_COUNTRY]   || '').trim(); if (t) ctrSet.add(t);
  });

  /* Labels from config */
  const lblAll  = (CONFIG.LABELS && CONFIG.LABELS.all_continents) || 'All continents';
  const lblAllC = (CONFIG.LABELS && CONFIG.LABELS.all_countries)  || 'All countries';

  const cSel   = document.getElementById('filter-continent');
  const ctrSel = document.getElementById('filter-country');
  cSel.innerHTML   = `<option value="">${lblAll}</option>`;
  ctrSel.innerHTML = `<option value="">${lblAllC}</option>`;
  Array.from(cSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; cSel.appendChild(o);
  });
  Array.from(ctrSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
}

function refreshGeoDropdowns() {
  const prevContinent = filterContinent;
  const prevCountry   = filterCountry;
  const base = rowsForDropdowns();
  const lblAll  = (CONFIG.LABELS && CONFIG.LABELS.all_continents) || 'All continents';
  const lblAllC = (CONFIG.LABELS && CONFIG.LABELS.all_countries)  || 'All countries';

  const cSet = new Set();
  base.forEach(r => { const c = (r[CONFIG.COL_CONTINENT] || '').trim(); if (c) cSet.add(c); });
  const cSel = document.getElementById('filter-continent');
  cSel.innerHTML = `<option value="">${lblAll}</option>`;
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
  ctrSel.innerHTML = `<option value="">${lblAllC}</option>`;
  Array.from(ctrSet).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
  filterCountry = ctrSet.has(prevCountry) ? prevCountry : '';
  ctrSel.value = filterCountry;
}

function onContinentChange() {
  filterContinent = document.getElementById('filter-continent').value;
  filterCountry   = '';
  const lblAllC = (CONFIG.LABELS && CONFIG.LABELS.all_countries) || 'All countries';
  const ctrSel = document.getElementById('filter-country');
  ctrSel.innerHTML = `<option value="">${lblAllC}</option>`;
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
  const lblAllC = (CONFIG.LABELS && CONFIG.LABELS.all_countries) || 'All countries';
  const ctrs = new Set();
  rowsForDropdowns().forEach(r => { const c = (r[CONFIG.COL_COUNTRY] || '').trim(); if (c) ctrs.add(c); });
  const ctrSel = document.getElementById('filter-country');
  ctrSel.innerHTML = `<option value="">${lblAllC}</option>`;
  Array.from(ctrs).sort().forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c; ctrSel.appendChild(o);
  });
  actET = new Set();
  document.querySelectorAll('.et').forEach(b => b.classList.remove('on'));
  filterDeals = false;
  const dealsPill = document.getElementById('pill-deals');
  if (dealsPill) dealsPill.classList.remove('on');
  document.getElementById('q').value = ''; qStr = '';
  redraw();
}

/* ── Event type filter UI ────────────────────────────────── */

/**
 * Build event type pills from CONFIG.CATEGORIES (JSON-driven).
 * Order follows the categories array order in the JSON.
 */
function buildEventTypes() {
  const wrap = document.getElementById('et');
  wrap.innerHTML = '';

  const categories = CONFIG.CATEGORIES || [];

  categories.forEach(cat => {
    const btn = document.createElement('span');
    btn.className  = 'et';
    btn.dataset.et = cat.label;
    btn.title      = cat.label;
    btn.innerHTML  = `${cat.icon || ''} ${escHtml(cat.label)}`;
    btn.addEventListener('click', () => {
      if (actET.has(cat.label)) { actET.delete(cat.label); btn.classList.remove('on'); }
      else                      { actET.add(cat.label);    btn.classList.add('on'); }
      refreshGeoDropdowns();
      redraw();
    });
    wrap.appendChild(btn);
  });
}

/* ── Deals filter pill ───────────────────────────────────── */

function buildDealsFilter() {
  const wrap = document.getElementById('pill-deals-wrap');
  if (!wrap) return;
  const today = dateOnly(new Date());
  const anyDeals = rows.some(row => {
    const endDate = parseDate(row[CONFIG.COL_END]) || parseDate(row[CONFIG.COL_START]);
    if (endDate && dateOnly(endDate) < today) return false;
    return !!(row[CONFIG.COL_INSIDER_DEALS] || '').trim();
  });
  wrap.style.display = anyDeals ? '' : 'none';
}

/* ── Process raw CSV rows ────────────────────────────────── */

function processData(data) {
  if (data.length) console.log(`[${(CONFIG.TENANT && CONFIG.TENANT.id) || 'events'}] Column keys:`, Object.keys(data[0]));
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
  buildDealsFilter();
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
  if (window.parentIFrame) window.parentIFrame.size();
}

function updateClearButton() {
  const btn = document.getElementById('btn-clear');
  if (!btn) return;
  const active =
    !!qStr ||
    !!filterContinent ||
    !!filterCountry ||
    !!dateFrom ||
    !!dateTo ||
    filterDeals ||
    actET.size > 0;
  btn.style.display = active ? '' : 'none';
}

/* ── Fetch & init ────────────────────────────────────────── */

async function init() {
  setMsg('Fetching event data…');

  /* ── Primary: Cloudflare Worker ─────────────────────────── */
  if (CONFIG.WORKER_URL) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(CONFIG.WORKER_URL, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) throw new Error(`Non-JSON response (${ct.split(';')[0].trim()})`);
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
  }

  /* ── Fallback: Google Sheets CSV ─────────────────────────── */
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
