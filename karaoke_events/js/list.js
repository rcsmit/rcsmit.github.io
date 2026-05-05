/* ═══════════════════════════════════════════════════════════
   LIST VIEW  — card grid + pagination
   ═══════════════════════════════════════════════════════════ */

/**
 * Set to false to hide the Cat's Picks strip even when shortlisted
 * events are present. Flip to true to re-enable.
 */
const CAT_PICKS_STICKY = true;

/** Minimum number of card rows to show per page. */
const MIN_ROWS = 3;

/** Card minimum width must match the CSS minmax() value on .lv-grid. */
const CARD_MIN_WIDTH = 320;

/**
 * Calculate how many cards fit per page based on the actual grid width.
 * Columns = floor(gridWidth / CARD_MIN_WIDTH), minimum 1.
 * Page size = columns × MIN_ROWS.
 * Falls back to CONFIG.PAGE_SIZE if the grid isn't in the DOM yet.
 */
function calcPageSize() {
  const grid = document.getElementById('lv-grid');
  if (!grid) return CONFIG.PAGE_SIZE;
  const gridWidth = grid.parentElement.clientWidth || grid.clientWidth;
  const cols = Math.max(1, Math.floor(gridWidth / CARD_MIN_WIDTH));
  return cols * MIN_ROWS;
}

// Rerender the list on resize so page size stays in sync with columns.
window.addEventListener('resize', () => {
  if (currentView === 'list') { listPage = 1; renderList(); }
});

/** Sort key for a row: parsed start date as ms, or Infinity for undated events. */
function rowSortKey(row) {
  const d = parseDate(row[CONFIG.COL_START]);
  return d ? d.getTime() : Infinity;
}

/* ── Cat's Picks strip ───────────────────────────────────── */

/** Render (or clear) the 🎤 Staff Picks horizontal-scroll strip. */
function renderCatPicks(vis) {
  // Ensure the container exists; create it once and insert before #lv-grid.
  let strip = document.getElementById('cat-picks-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'cat-picks-strip';
    const inner = document.getElementById('lv-inner');
    inner.insertBefore(strip, inner.querySelector('#lv-grid'));
  }

  if (!CAT_PICKS_STICKY) { strip.innerHTML = ''; strip.className = ''; return; }

  const SL_VALUES = new Set(['yes', '1', 'true', 'x', '✓']);
  const picks = vis.filter(row =>
    SL_VALUES.has(String(row[CONFIG.COL_SHORTLIST] || '').trim().toLowerCase())
  );

  if (!picks.length) { strip.innerHTML = ''; strip.className = ''; return; }

  strip.className = 'cat-picks-strip';

  let html = `<div class="cp-header"><span class="cp-title">🎤 Staff Picks</span></div>
<div class="cp-scroll">`;

  picks.forEach(row => {
    const c   = lColors[row._layer] || '#f19072';
    const n   = (row[CONFIG.COL_NAME]      || '').trim() || '(unnamed)';
    const cty = (row[CONFIG.COL_CITY]      || '').trim();
    const ctr = (row[CONFIG.COL_COUNTRY]   || '').trim();
    const prv = (row[CONFIG.COL_PROVINCE]  || '').trim();
    const cnt = (row[CONFIG.COL_CONTINENT] || '').trim();
    const cat = (row[CONFIG.COL_CATEGORY]  || '').trim();
    const loc = [cty, prv, ctr, cnt].filter(Boolean).join(', ');
    const dr  = fmtDateRange(row);
    const idx = rows.indexOf(row);

    html += `<div class="cp-card" onclick="openEventFromCatPicks(${idx})">
      <div class="cp-card-accent" style="background:${c}"></div>
      <div class="cp-card-body">
        ${cat ? `<div class="cp-card-cat">${etIcon(cat)} ${escHtml(cat)}</div>` : ''}
        <div class="cp-card-name">${escHtml(n)}</div>
        ${dr  ? `<div class="cp-card-date">📅 ${escHtml(dr)}</div>`  : ''}
        ${loc ? `<div class="cp-card-loc">📍 ${escHtml(loc)}</div>`  : ''}
      </div>
    </div>`;
  });

  html += '</div>';
  strip.innerHTML = html;
}

/** Open the event modal from a Cat's Picks card click. */
function openEventFromCatPicks(idx) { openEventModal(rows[idx]); }

/* ── Main list render ────────────────────────────────────── */

/** Render the current page of event cards into #lv-grid. */
function renderList() {
  // Sort visible rows by start date ascending; undated rows go to the end.
  const vis = visibleRows().slice().sort((a, b) => rowSortKey(a) - rowSortKey(b));

  // Cat's Picks strip (above the grid)
  renderCatPicks(vis);

  const pages = Math.max(1, Math.ceil(vis.length / calcPageSize()));
  if (listPage > pages) listPage = pages;
  const slice = vis.slice((listPage - 1) * calcPageSize(), listPage * calcPageSize());
  const grid  = document.getElementById('lv-grid');
  grid.innerHTML = '';

  if (!vis.length) {
    grid.innerHTML = `<div class="no-results">
      <div class="nr-icon">🤸</div>
      <h3>No events found</h3>
      <p>No upcoming karaoke events match your filters.<br>Try a different event type, continent, or wider date range.</p>
    </div>`;
  } else {
    slice.forEach(row => {
      const c   = lColors[row._layer] || '#f19072';
      const n   = (row[CONFIG.COL_NAME]      || '').trim() || '(unnamed)';
      const cty = (row[CONFIG.COL_CITY]      || '').trim();
      const ctr = (row[CONFIG.COL_COUNTRY]   || '').trim();
      const prv = (row[CONFIG.COL_PROVINCE]  || '').trim();
      const cnt = (row[CONFIG.COL_CONTINENT] || '').trim();
      const cat = (row[CONFIG.COL_CATEGORY]  || '').trim();
      const rem = (row[CONFIG.COL_REMARKS]   || '').trim();
      const sl  = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
      const loc = [cty, prv, ctr, cnt].filter(Boolean).join(', ');
      const dr  = fmtDateRange(row);

      const card = document.createElement('div');
      card.className = 'ev-card';
      card.innerHTML = `
        <div class="ev-card-badges">
          ${cnt ? `<span class="ev-card-badge" style="background:${c}22;color:${c}">${escHtml(cnt)}</span>` : ''}
          ${cat ? `<span class="ev-card-cat">${etIcon(cat)} ${escHtml(cat)}</span>`                         : ''}
        </div>
        <div class="ev-card-name">${escHtml(n)}</div>
        ${loc ? `<div class="ev-card-loc">📍 ${escHtml(loc)}</div>`    : ''}
        ${dr  ? `<div class="ev-card-date">📅 ${escHtml(dr)}</div>`    : ''}
        ${sl  ? `<div class="ev-card-sl">⭐ Featured</div>`          : ''}
        ${rem ? `<div class="ev-card-desc">${escHtml(rem)}</div>`       : ''}
      `;
      card.addEventListener('click', () => openEventModal(row));
      grid.appendChild(card);
    });
  }

  renderPagination(pages, vis.length);
}

/** Render pagination controls below the card grid. */
function renderPagination(pages, total) {
  const pg = document.getElementById('pagination');

  // Always show the count, even on a single page.
  const start = total ? (listPage - 1) * calcPageSize() + 1 : 0;
  const end   = Math.min(listPage * calcPageSize(), total);
  const countHtml = `<span class="pg-info pg-info-always">${start}–${end} of ${total}</span>`;

  if (pages <= 1) {
    pg.innerHTML = total ? countHtml : '';
    return;
  }

  let html = `<button class="pg-btn" onclick="goPage(${listPage - 1})" ${listPage <= 1 ? 'disabled' : ''}>‹</button>`;
  const range = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= listPage - 2 && i <= listPage + 2)) range.push(i);
    else if (range[range.length - 1] !== '…') range.push('…');
  }
  range.forEach(p => {
    if (p === '…') html += `<span class="pg-ellipsis">…</span>`;
    else           html += `<button class="pg-btn ${p === listPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  });
  html += `<button class="pg-btn" onclick="goPage(${listPage + 1})" ${listPage >= pages ? 'disabled' : ''}>›</button>`;
  html += countHtml;
  pg.innerHTML = html;
}

/** Navigate to a specific page number. */
function goPage(p) {
  const vis   = visibleRows();
  const pages = Math.max(1, Math.ceil(vis.length / calcPageSize()));
  listPage = Math.max(1, Math.min(p, pages));
  renderList();
  document.getElementById('lv-inner').scrollTo(0, 0);
}
