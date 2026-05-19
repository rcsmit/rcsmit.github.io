/* ═══════════════════════════════════════════════════════════
   MODALS  — event detail, info, credits
   WhatsApp template and copy-link URL pattern from JSON config.
   ═══════════════════════════════════════════════════════════ */

/** Copy an event's shareable link to clipboard and show a toast. */
function copyEventLink(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied! 🔗')).catch(() => _copyFallback(url));
  } else {
    _copyFallback(url);
  }
}
function _copyFallback(url) {
  const ta = document.createElement('textarea');
  ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); toast('Link copied! 🔗'); } catch(e) { toast('Copy failed — try manually'); }
  document.body.removeChild(ta);
}

/* ── WhatsApp share ──────────────────────────────────────── */

function shareWhatsApp(text) {
  const encoded = encodeURIComponent(text);
  const isIOS   = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (isIOS) {
    const native = 'whatsapp://send?text=' + encoded;
    const web    = 'https://wa.me/?text=' + encoded;
    const start  = Date.now();
    window.location.href = native;
    setTimeout(() => { if (Date.now() - start < 1500) window.open(web, '_blank', 'noopener,noreferrer'); }, 1000);
  } else {
    window.open('https://wa.me/?text=' + encoded, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Build the WhatsApp share text for a row.
 * Uses SHARING.whatsapp_template from the JSON config when available,
 * falling back to the legacy hardcoded format.
 */
function buildWhatsAppText(row, deepLink) {
  const sharing = CONFIG.SHARING;
  if (sharing && sharing.whatsapp_template) {
    const n   = (row[CONFIG.COL_NAME]    || '').trim();
    const cty = (row[CONFIG.COL_CITY]    || '').trim();
    const ctr = (row[CONFIG.COL_COUNTRY] || '').trim();
    const dr  = fmtDateRange(row);
    const sd  = (row[CONFIG.COL_START]   || '').trim();
    const ed  = (row[CONFIG.COL_END]     || '').trim();
    return sharing.whatsapp_template
      .replace('{name}',       n)
      .replace('{city}',       cty)
      .replace('{country}',    ctr)
      .replace('{start_date}', sd)
      .replace('{end_date}',   ed)
      .replace('{url}',        deepLink);
  }
  /* Legacy format */
  const n   = (row[CONFIG.COL_NAME]    || '').trim();
  const cty = (row[CONFIG.COL_CITY]    || '').trim();
  const ctr = (row[CONFIG.COL_COUNTRY] || '').trim();
  const dr  = fmtDateRange(row);
  return [
    (CONFIG.TENANT && CONFIG.TENANT.name ? `Look at this event on ${CONFIG.TENANT.custom_domain || CONFIG.TENANT.name}!` : 'Check out this event!'),
    `${n},`,
    dr ? `${dr},` : '',
    cty ? `at ${cty}` : '',
    ctr ? `(${ctr})` : '',
    deepLink,
  ].filter(Boolean).join('\n');
}

/**
 * Build the shareable deep-link URL for an event row.
 * Uses SHARING.copy_link_template from JSON when available.
 */
function buildDeepLink(row) {
  const sharing = CONFIG.SHARING;
  if (sharing && sharing.copy_link_template) {
    const slug = (typeof rowID === 'function') ? rowID(row) : '';
    const sd   = (row[CONFIG.COL_START] || '').trim();
    const domain = (CONFIG.TENANT && CONFIG.TENANT.custom_domain) || window.location.hostname;
    return sharing.copy_link_template
      .replace('{domain}',     domain)
      .replace('{slug}',       slug)
      .replace('{start_date}', sd);   /* no-op if template doesn't use it */
  }
  /* Legacy fallback */
  const slug = (typeof rowID === 'function') ? rowID(row) : '';
  const domain = (CONFIG.TENANT && CONFIG.TENANT.custom_domain) ? CONFIG.TENANT.custom_domain : window.location.hostname;
  return slug ? `https://${domain}/show-event/?id=${slug}` : '';
}

/* ── iCal helpers ────────────────────────────────────────── */

function fmtICalDate(d) {
  if (!d) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dy}`;
}

function buildGCalURL(n, startDate, endDate, loc, desc, url) {
  const ds = fmtICalDate(startDate);
  const de = endDate
    ? fmtICalDate(new Date(endDate.getTime() + 86400000))
    : fmtICalDate(new Date(startDate.getTime() + 86400000));
  const details = [desc, url ? `\n\nMore info: ${url}` : ''].join('').trim();
  const params = new URLSearchParams({ action: 'TEMPLATE', text: n, dates: `${ds}/${de}`, location: loc, details });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildICS(n, startDate, endDate, loc, desc, url) {
  const ds  = fmtICalDate(startDate);
  const de  = endDate
    ? fmtICalDate(new Date(endDate.getTime() + 86400000))
    : fmtICalDate(new Date(startDate.getTime() + 86400000));
  const tenantId = (typeof CONFIG !== 'undefined' && CONFIG.TENANT && CONFIG.TENANT.id) || 'events';
  const uid = `${ds}-${Math.random().toString(36).slice(2)}@${tenantId}`;
  const now = fmtICalDate(new Date()).replace(/-/g, '') + 'T000000Z';
  function fold(line) {
    const out = [];
    while (line.length > 75) { out.push(line.slice(0, 75)); line = ' ' + line.slice(75); }
    out.push(line); return out.join('\r\n');
  }
  function prop(name, val) {
    return fold(`${name}:${String(val).replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')}`);
  }
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${(typeof CONFIG !== 'undefined' && CONFIG.TENANT && CONFIG.TENANT.name) || 'Events'}//EventMap//EN`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    prop('UID', uid), prop('DTSTAMP', now),
    prop('DTSTART;VALUE=DATE', ds), prop('DTEND;VALUE=DATE', de),
    prop('SUMMARY', n),
    loc  ? prop('LOCATION', loc)    : '',
    desc ? prop('DESCRIPTION', desc): '',
    url  ? prop('URL', url)         : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ── Main event modal ────────────────────────────────────── */

function openEventModal(row) {
  const n     = (row[CONFIG.COL_NAME]          || '').trim() || '(unnamed)';
  const rem   = (row[CONFIG.COL_REMARKS]       || '').trim();
  const cty   = (row[CONFIG.COL_CITY]          || '').trim();
  const ctr   = (row[CONFIG.COL_COUNTRY]       || '').trim();
  const prv   = (row[CONFIG.COL_PROVINCE]      || '').trim();
  const cnt   = (row[CONFIG.COL_CONTINENT]     || '').trim();
  const cat   = (row[CONFIG.COL_CATEGORY]      || '').trim();
  const deals = (row[CONFIG.COL_INSIDER_DEALS] || '').trim();
  const sl    = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
  const loc   = [cty, prv, ctr, cnt].filter(Boolean).join(', ');
  const dr    = fmtDateRange(row);
  const c     = lColors[row._layer] || getComputedStyle(document.documentElement).getPropertyValue('--p1').trim() || '#888';
  const url   = (row[CONFIG.COL_URL] || '').trim();

  const startDate = parseDate(row[CONFIG.COL_START]);
  const endDate   = parseDate(row[CONFIG.COL_END]);
  const hasDate   = !!startDate;

  const hasCoords = isFinite(row._lat) && isFinite(row._lon);
  const gmapsURL  = hasCoords
    ? `https://www.google.com/maps?q=${row._lat},${row._lon}`
    : loc ? `https://www.google.com/maps/search/${encodeURIComponent(loc)}` : '';
  const gmapsHtml = gmapsURL
    ? `<a class="tribe-gmaps-link" href="${gmapsURL}" target="_blank" rel="noopener noreferrer"
          title="Show on map — ⚠️ Location is an estimation (city-level, not exact venue)">
        <svg class="tribe-gmaps-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Show on map
        <span class="tribe-gmaps-warn">⚠️ Estimated location</span>
      </a>`
    : '';

  window._modalRow = row;

  const descHtml = rem
    ? rem.split(/\n{2,}/).filter(Boolean)
        .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
    : '';

  /* Deep link + WhatsApp text built from JSON config */
  const deepLink  = buildDeepLink(row);
  const waText    = buildWhatsAppText(row, deepLink);
  window._waText  = waText;

  const gcalURL   = hasDate ? buildGCalURL(n, startDate, endDate, loc, rem, url) : '';
  const icsName   = n.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics';

  const dealsHtml = deals
    ? `<div class="tribe-single-deals">
        <div class="tribe-deals-label">🏷️ Insider Deal</div>
        <div class="tribe-deals-text">${escHtml(deals).replace(/\n/g, '<br>')}</div>
      </div>`
    : '';

  /* Labels from JSON */
  const L = (CONFIG.LABELS) || {};
  const lblWebsite  = L.visit_website      || '🔗 Visit website →';
  const lblGcal     = L.add_to_calendar    || '📅 Add to Google Calendar';
  const lblWa       = L.share_whatsapp     || '💬 Share on WhatsApp';
  const lblCopyLink = L.copy_link          || '🔗 Copy link';
  const lblBack     = L.back_to_events     || '← Back';
  const slLabel     = CONFIG.CAT_PICKS_LABEL || 'Shortlisted';
  const slIcon      = CONFIG.CAT_PICKS_ICON  || '⭐';

  /* Show/hide sharing buttons based on JSON config */
  const sharing = CONFIG.SHARING || { whatsapp: true, gcal: true, copy_link: true };

  document.getElementById('event-modal-body').innerHTML = `
    <div class="tribe-single-cats">
      ${cnt ? `<span class="tribe-single-cat" style="background:${c}22;color:${c}">${escHtml(cnt)}</span>` : ''}
      ${cat ? `<span class="tribe-single-cat">${etIcon(cat)} ${escHtml(cat)}</span>`                       : ''}
    </div>
    <h1 class="tribe-single-title">${escHtml(n)}</h1>
    ${dr    ? `<div class="tribe-single-datetime">📅 ${escHtml(dr)}</div>` : ''}
    ${loc   ? `<div class="tribe-single-location">
      <span>📍</span>
      <span><span class="tribe-single-location-name">${escHtml(loc)}</span></span>
    </div>` : ''}
    ${gmapsHtml}
    ${sl    ? `<div class="tribe-single-shortlisted">${escHtml(slIcon)} ${escHtml(slLabel)}${(CONFIG.TENANT && CONFIG.TENANT.name) ? ` by ${escHtml(CONFIG.TENANT.name)}` : ''}</div>` : ''}
    ${dealsHtml}
    ${descHtml ? `<div class="tribe-single-desc">${descHtml}</div>` : ''}
    <div class="tribe-single-actions">
      ${url                   ? `<a class="tribe-btn tribe-btn-primary" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">${escHtml(lblWebsite)}</a>` : ''}
      ${hasDate && sharing.gcal ? `<a class="tribe-btn tribe-btn-outline tribe-btn-gcal" href="${escHtml(gcalURL)}" target="_blank" rel="noopener noreferrer">${escHtml(lblGcal)}</a>` : ''}
      ${hasDate               ? `<button class="tribe-btn tribe-btn-outline" onclick="window._downloadICS('${escHtml(icsName)}')">⬇ Download .ics</button>` : ''}
      ${sharing.whatsapp      ? `<button class="tribe-btn tribe-btn-whatsapp" onclick="shareWhatsApp(window._waText)">${escHtml(lblWa)}</button>` : ''}
      ${deepLink && sharing.copy_link ? `<button class="tribe-btn tribe-btn-outline" onclick="copyEventLink('${escHtml(deepLink)}')">${escHtml(lblCopyLink)}</button>` : ''}
      <button class="tribe-btn tribe-btn-outline" onclick="closeEventModal()">${escHtml(lblBack)}</button>
    </div>
  `;

  window._downloadICS = function(filename) {
    const ics = buildICS(n, startDate, endDate, loc, rem, url);
    downloadBlob(ics, filename, 'text/calendar;charset=utf-8');
  };

  document.getElementById('event-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEventModal() {
  document.getElementById('event-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeEventModalBg(e) { if (e.target === e.currentTarget) closeEventModal(); }

/* ── Info / Credits modals ───────────────────────────────── */
function openModal(id)       { document.getElementById('modal-' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id)      { document.getElementById('modal-' + id).classList.remove('open'); document.body.style.overflow = ''; }
function closeModalBg(e, id) { if (e.target === e.currentTarget) closeModal(id); }
