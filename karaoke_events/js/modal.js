/* ═══════════════════════════════════════════════════════════
   MODALS  — event detail, info, credits
   ═══════════════════════════════════════════════════════════ */

/* ── iCal helpers ────────────────────────────────────────── */

/**
 * Format a Date as YYYYMMDD (all-day iCal / Google Calendar format).
 * Returns '' if d is falsy.
 */
function fmtICalDate(d) {
  if (!d) return '';
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dy}`;
}

/**
 * Build a Google Calendar "Add event" URL for an all-day event.
 * https://calendar.google.com/calendar/render?action=TEMPLATE&...
 */
function buildGCalURL(n, startDate, endDate, loc, desc, url) {
  const ds = fmtICalDate(startDate);
  // Google Calendar all-day end date is exclusive, so add 1 day.
  const de = endDate
    ? fmtICalDate(new Date(endDate.getTime() + 86400000))
    : fmtICalDate(new Date(startDate.getTime() + 86400000));
  const details = [desc, url ? `\n\nMore info: ${url}` : ''].join('').trim();
  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     n,
    dates:    `${ds}/${de}`,
    location: loc,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate a minimal valid iCalendar (.ics) string for one all-day event.
 * Fold lines longer than 75 octets per RFC 5545 §3.1.
 */
function buildICS(n, startDate, endDate, loc, desc, url) {
  const ds = fmtICalDate(startDate);
  // iCal all-day DTEND is exclusive.
  const de = endDate
    ? fmtICalDate(new Date(endDate.getTime() + 86400000))
    : fmtICalDate(new Date(startDate.getTime() + 86400000));
  const uid  = `${ds}-${Math.random().toString(36).slice(2)}@karaokeevents`;
  const now  = fmtICalDate(new Date()).replace(/-/g, '') + 'T000000Z';

  // Fold a property line at 75 octets (simple ASCII fold — sufficient for event data).
  function fold(line) {
    const out = [];
    while (line.length > 75) { out.push(line.slice(0, 75)); line = ' ' + line.slice(75); }
    out.push(line);
    return out.join('\r\n');
  }
  function prop(name, val) {
    return fold(`${name}:${String(val).replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')}`);
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaraokeEvents//KaraokeMap//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    prop('UID',         uid),
    prop('DTSTAMP',     now),
    prop('DTSTART;VALUE=DATE', ds),
    prop('DTEND;VALUE=DATE',   de),
    prop('SUMMARY',     n),
    loc  ? prop('LOCATION',    loc)  : '',
    desc ? prop('DESCRIPTION', desc) : '',
    url  ? prop('URL',         url)  : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/** Trigger a client-side download of a text blob. */
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ── Main event modal ────────────────────────────────────── */

/** Open the full event detail modal for a given data row. */
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
  const c     = lColors[row._layer] || '#f19072';
  const url   = (row[CONFIG.COL_URL] || '').trim();

  // Parse dates for calendar/ics buttons.
  const startDate = parseDate(row[CONFIG.COL_START]);
  const endDate   = parseDate(row[CONFIG.COL_END]);
  const hasDate   = !!startDate;

  // Google Maps link — uses lat/lon if available, falls back to text search.
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

  // Escape first, then convert single newlines to <br> — safe order.
  const descHtml = rem
    ? rem.split(/\n{2,}/).filter(Boolean)
        .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';

  // WhatsApp share text — plain ASCII separators, no HTML entities.
  const waLines = [
    n,
    dr  ? `Dates: ${dr}`    : '',
    loc ? `Location: ${loc}` : '',
    url || '',
  ].filter(Boolean);
  const waURL = `https://wa.me/?text=${encodeURIComponent(waLines.join('\n'))}`;

  // Google Calendar URL (built once, stored for the onclick).
  const gcalURL = hasDate
    ? buildGCalURL(n, startDate, endDate, loc, rem, url)
    : '';

  // Safe filename from event name.
  const icsName = n.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics';

  // Insider Deals block.
  const dealsHtml = deals
    ? `<div class="tribe-single-deals">
        <div class="tribe-deals-label">🏷️ Special Offer</div>
        <div class="tribe-deals-text">${escHtml(deals).replace(/\n/g, '<br>')}</div>
      </div>`
    : '';

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
    ${sl    ? `<div class="tribe-single-shortlisted">⭐ Featured by KaraokeEvents</div>` : ''}
    ${dealsHtml}
    ${descHtml ? `<div class="tribe-single-desc">${descHtml}</div>` : ''}
    <div class="tribe-single-actions">
      ${url     ? `<a class="tribe-btn tribe-btn-primary" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">🔗 Visit website →</a>` : ''}
      ${hasDate ? `<a class="tribe-btn tribe-btn-outline tribe-btn-gcal" href="${escHtml(gcalURL)}" target="_blank" rel="noopener noreferrer">📅 Add to Google Calendar</a>` : ''}
      ${hasDate ? `<button class="tribe-btn tribe-btn-outline" onclick="window._downloadICS('${escHtml(icsName)}')">⬇ Download .ics</button>` : ''}
      <a class="tribe-btn tribe-btn-whatsapp" href="${waURL}" target="_blank" rel="noopener noreferrer">💬 Share on WhatsApp</a>
      <button class="tribe-btn tribe-btn-outline" onclick="closeEventModal()">← Back</button>
    </div>
  `;

  // ICS download handler — uses closure over row data at the moment of open.
  window._downloadICS = function(filename) {
    const ics = buildICS(n, startDate, endDate, loc, rem, url);
    downloadBlob(ics, filename, 'text/calendar;charset=utf-8');
  };

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

function openModal(id)       { document.getElementById('modal-' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id)      { document.getElementById('modal-' + id).classList.remove('open'); document.body.style.overflow = ''; }
function closeModalBg(e, id) { if (e.target === e.currentTarget) closeModal(id); }
