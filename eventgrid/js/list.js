/* ═══════════════════════════════════════════════════════════
   LIST VIEW  — card grid + pagination
   Cat's Picks label, icon and sticky field come from JSON config.
   ═══════════════════════════════════════════════════════════ */

/**
 * Set to false to hide the Cat's Picks strip globally.
 * Normally driven by CONFIG.VIEWS.list.show_cat_picks from the JSON.
 */
const CAT_PICKS_STICKY = true;

/**
 * When set, clicking an event card navigates the parent WP page to
 * this URL + ?id=SLUG instead of opening the modal.
 * Set to '' to always use the modal (standalone / non-WP use).
 */
const EVENTS_DETAIL_URL = '';

function openEventOrNavigate(row) {
  openEventModal(row);
}

/** Minimum number of card rows to show per page. */
const MIN_ROWS = 3;

/** Minimum total cards per page. */
const MIN_PAGE_SIZE = 9;

/** Card minimum width must match the CSS minmax() value on .lv-grid. */
const CARD_MIN_WIDTH = 320;
/** Gap between cards — must match the CSS gap value on .lv-grid. */
const CARD_GAP = 16;

function calcPageSize() {
  const grid = document.getElementById('lv-grid');
  if (!grid) return CONFIG.PAGE_SIZE;
  const inner     = grid.parentElement;
  const style     = window.getComputedStyle(inner);
  const padL      = parseFloat(style.paddingLeft)  || 0;
  const padR      = parseFloat(style.paddingRight) || 0;
  const gridWidth = (inner.clientWidth || grid.clientWidth) - padL - padR;
  const cols      = Math.max(1, Math.floor((gridWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)));
  const rowCount  = Math.max(MIN_ROWS, Math.ceil(MIN_PAGE_SIZE / cols));
  return cols * rowCount;
}

window.addEventListener('resize', () => {
  if (currentView === 'list') { listPage = 1; renderList(); }
});

function rowSortKey(row) {
  const d = parseDate(row[CONFIG.COL_START]);
  return d ? d.getTime() : Infinity;
}

/* ── Cat's Picks strip ───────────────────────────────────── */

function renderCatPicks(vis) {
  let strip = document.getElementById('cat-picks-strip');
  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'cat-picks-strip';
    const inner = document.getElementById('lv-inner');
    inner.insertBefore(strip, inner.querySelector('#lv-grid'));
  }

  /* Read label/icon/field from JSON config */
  const showPicks  = CAT_PICKS_STICKY && (CONFIG.VIEWS && CONFIG.VIEWS.list && CONFIG.VIEWS.list.show_cat_picks !== false);
  const picksLabel = CONFIG.CAT_PICKS_LABEL || "Cat's Picks";
  const picksIcon  = CONFIG.CAT_PICKS_ICON  || '⭐';
  /* Always use COL_SHORTLIST — that's the actual sheet column header.
     CAT_PICKS_FIELD from JSON is the logical name, not the row key. */
  const picksField = CONFIG.COL_SHORTLIST;

  if (!showPicks) { strip.innerHTML = ''; strip.className = ''; return; }

  const SL_VALUES = new Set(['yes', '1', 'true', 'x', '✓']);
  const picks = vis.filter(row =>
    SL_VALUES.has(String(row[picksField] || '').trim().toLowerCase())
  );

  if (!picks.length) { strip.innerHTML = ''; strip.className = ''; return; }

  strip.className = 'cat-picks-strip';

  let html = `<div class="cp-header"><span class="cp-title">${picksIcon} ${escHtml(picksLabel)}</span></div>
<div class="cp-scroll">`;

  picks.forEach(row => {
    const c   = lColors[row._layer] || getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || '#888';
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

function openEventFromCatPicks(idx) { openEventOrNavigate(rows[idx]); }

/* ── Main list render ────────────────────────────────────── */

function renderList() {
  const vis = visibleRows().slice().sort((a, b) => rowSortKey(a) - rowSortKey(b));

  renderCatPicks(vis);

  const pages = Math.max(1, Math.ceil(vis.length / calcPageSize()));
  if (listPage > pages) listPage = pages;
  const slice = vis.slice((listPage - 1) * calcPageSize(), listPage * calcPageSize());
  const grid  = document.getElementById('lv-grid');
  grid.innerHTML = '';

  const noEventsMsg = (CONFIG.LABELS && CONFIG.LABELS.no_events) || 'No events found';

  if (!vis.length) {
    grid.innerHTML = `<div class="no-results">
      <div class="nr-icon">🤸</div>
      <h3>${escHtml(noEventsMsg)}</h3>
      <p>Try a different event type, continent, or wider date range.</p>
    </div>`;
  } else {
    slice.forEach(row => {
      const c   = lColors[row._layer] || getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || '#888';
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
        ${sl  ? `<div class="ev-card-sl">${escHtml(CONFIG.CAT_PICKS_ICON || '⭐')} ${escHtml(CONFIG.CAT_PICKS_LABEL || 'Shortlisted')}</div>` : ''}
        ${rem ? `<div class="ev-card-desc">${escHtml(rem)}</div>`       : ''}
      `;
      card.addEventListener('click', () => openEventOrNavigate(row));
      grid.appendChild(card);
    });
  }

  renderPagination(pages, vis.length);
}

function renderPagination(pages, total) {
  const pg = document.getElementById('pagination');
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

function goPage(p) {
  const vis   = visibleRows();
  const pages = Math.max(1, Math.ceil(vis.length / calcPageSize()));
  listPage = Math.max(1, Math.min(p, pages));
  renderList();
  document.getElementById('lv-inner').scrollTo(0, 0);
}
