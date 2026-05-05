/* ═══════════════════════════════════════════════════════════
   MODALS  — event detail, info, credits
   ═══════════════════════════════════════════════════════════ */

/** Open the full event detail modal for a given data row. */
function openEventModal(row) {
  const n   = (row[CONFIG.COL_NAME]      || '').trim() || '(unnamed)';
  const rem = (row[CONFIG.COL_REMARKS]   || '').trim();
  const cty = (row[CONFIG.COL_CITY]      || '').trim();
  const ctr = (row[CONFIG.COL_COUNTRY]   || '').trim();
  const prv = (row[CONFIG.COL_PROVINCE]  || '').trim();
  const cnt = (row[CONFIG.COL_CONTINENT] || '').trim();
  const cat = (row[CONFIG.COL_CATEGORY]  || '').trim();
  const sl  = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
  const loc = [cty, prv, ctr, cnt].filter(Boolean).join(', ');
  const dr  = fmtDateRange(row);
  const c   = lColors[row._layer] || '#f19072';

  const url = (row[CONFIG.COL_URL] || '').trim();

  // Escape first, then convert single newlines to <br> — safe order.
  const descHtml = rem
    ? rem.split(/\n{2,}/).filter(Boolean)
        .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';

  document.getElementById('event-modal-body').innerHTML = `
    <div class="tribe-single-cats">
      ${cnt ? `<span class="tribe-single-cat" style="background:${c}22;color:${c}">${escHtml(cnt)}</span>` : ''}
      ${cat ? `<span class="tribe-single-cat">${etIcon(cat)} ${escHtml(cat)}</span>`                       : ''}
    </div>
    <h1 class="tribe-single-title">${escHtml(n)}</h1>
    ${dr  ? `<div class="tribe-single-datetime">📅 ${escHtml(dr)}</div>` : ''}
    ${loc ? `<div class="tribe-single-location">
      <span>📍</span>
      <span><span class="tribe-single-location-name">${escHtml(loc)}</span></span>
    </div>` : ''}
    ${sl  ? `<div class="tribe-single-shortlisted">⭐ Shortlisted by AcroInsiders</div>` : ''}
    ${descHtml ? `<div class="tribe-single-desc">${descHtml}</div>` : ''}
    <div class="tribe-single-actions">
      ${url ? `<a class="tribe-btn tribe-btn-primary" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">🔗 Visit website →</a>` : ''}
      <button class="tribe-btn tribe-btn-outline" onclick="closeEventModal()">← Back</button>
    </div>
  `;

  document.getElementById('event-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

/** Close the event detail modal. */
function closeEventModal() {
  document.getElementById('event-modal').classList.remove('open');
  document.body.style.overflow = '';
}

/** Close the event modal when the backdrop is clicked. */
function closeEventModalBg(e) { if (e.target === e.currentTarget) closeEventModal(); }

/* ── Info / Credits modals ───────────────────────────────── */

function openModal(id)     { document.getElementById('modal-' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id)    { document.getElementById('modal-' + id).classList.remove('open'); document.body.style.overflow = ''; }
function closeModalBg(e, id) { if (e.target === e.currentTarget) closeModal(id); }
