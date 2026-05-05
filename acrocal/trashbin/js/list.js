/* ═══════════════════════════════════════════════════════════
   LIST VIEW  — card grid + pagination
   ═══════════════════════════════════════════════════════════ */

/** Render the current page of event cards into #lv-grid. */
function renderList() {
  const vis   = visibleRows();
  const pages = Math.max(1, Math.ceil(vis.length / CONFIG.PAGE_SIZE));
  if (listPage > pages) listPage = pages;
  const slice = vis.slice((listPage - 1) * CONFIG.PAGE_SIZE, listPage * CONFIG.PAGE_SIZE);
  const grid  = document.getElementById('lv-grid');
  grid.innerHTML = '';

  if (!vis.length) {
    grid.innerHTML = `<div class="no-results">
      <div class="nr-icon">🤸</div>
      <h3>No events found</h3>
      <p>No upcoming events match your current filters.<br>Try a different event type, continent, or wider date range.</p>
    </div>`;
  } else {
    slice.forEach(row => {
      const c   = lColors[row._layer] || '#f19072';
      const n   = (row[CONFIG.COL_NAME]      || '').trim() || '(unnamed)';
      const ctr = (row[CONFIG.COL_COUNTRY]   || '').trim();
      const prv = (row[CONFIG.COL_PROVINCE]  || '').trim();
      const cnt = (row[CONFIG.COL_CONTINENT] || '').trim();
      const cat = (row[CONFIG.COL_CATEGORY]  || '').trim();
      const rem = (row[CONFIG.COL_REMARKS]   || '').trim();
      const sl  = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
      const loc = [prv, ctr, cnt].filter(Boolean).join(', ');
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
        ${sl  ? `<div class="ev-card-sl">⭐ Shortlisted</div>`          : ''}
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
  if (pages <= 1) { pg.innerHTML = ''; return; }

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
  const start = (listPage - 1) * CONFIG.PAGE_SIZE + 1;
  const end   = Math.min(listPage * CONFIG.PAGE_SIZE, total);
  html += `<span class="pg-info">${start}–${end} of ${total}</span>`;
  pg.innerHTML = html;
}

/** Navigate to a specific page number. */
function goPage(p) {
  const vis   = visibleRows();
  const pages = Math.max(1, Math.ceil(vis.length / CONFIG.PAGE_SIZE));
  listPage = Math.max(1, Math.min(p, pages));
  renderList();
  document.getElementById('lv-inner').scrollTo(0, 0);
}
