/* ═══════════════════════════════════════════════════════════
   eventdetail-wp.js
   Standalone event detail renderer for WordPress pages.
   Zero hardcoded values — everything from the active tenant config.

   HOW IT WORKS:
   1. Calls loadTenantConfig() using TENANT_CONFIG_FILE set in config.js
   2. Reads ?id= from the URL (slug generated from name+date)
   3. Fetches event data from the worker / Google Sheets CSV
   4. Finds the matching row
   5. Renders the full event detail into #event-detail-root

   DEPENDENCIES (load before this script on the WP page):
     - css/style.css
     - js/config.js   ← provides loadTenantConfig()
     - js/utils.js
     - js/modal.js    ← provides buildICS, buildGCalURL, buildDeepLink, buildWhatsAppText

   USAGE IN WORDPRESS (HTML block):
     <div id="event-detail-root"></div>
     <link rel="stylesheet" href="URL/css/style.css">
     <script src="URL/js/config.js"></script>
     <script src="URL/js/utils.js"></script>
     <script src="URL/js/modal.js"></script>
     <script src="URL/js/eventdetail-wp.js"></script>
   ═══════════════════════════════════════════════════════════ */

/* ── Derive the events listing URL from config ───────────── */
function getEventsPageURL() {
  if (CONFIG && CONFIG.TENANT && CONFIG.TENANT.custom_domain) {
    return 'https://' + CONFIG.TENANT.custom_domain + '/events/';
  }
  return '/events/';
}

/* ── Generate a stable slug ID for a row ─────────────────── */
function rowID(row) {
  const name  = (row[CONFIG.COL_NAME]  || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const start = (row[CONFIG.COL_START] || '').trim();
  return encodeURIComponent(name + '-' + start);
}

/* ── Render the full event detail page ───────────────────── */
function renderEventDetail(row) {
  const root = document.getElementById('event-detail-root');
  if (!root) { console.error('[eventdetail-wp] #event-detail-root not found'); return; }

  const EVENTS_PAGE_URL = getEventsPageURL();

  const n      = (row[CONFIG.COL_NAME]          || '').trim() || '(unnamed)';
  const rem    = (row[CONFIG.COL_REMARKS]        || '').trim();
  const cty    = (row[CONFIG.COL_CITY]           || '').trim();
  const ctr    = (row[CONFIG.COL_COUNTRY]        || '').trim();
  const prv    = (row[CONFIG.COL_PROVINCE]       || '').trim();
  const cnt    = (row[CONFIG.COL_CONTINENT]      || '').trim();
  const cat    = (row[CONFIG.COL_CATEGORY]       || '').trim();
  const deals  = (row[CONFIG.COL_INSIDER_DEALS]  || '').trim();
  const sl     = ['yes','1','true','x','\u2713'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
  const loc    = [cty, prv, ctr, cnt].filter(Boolean).join(', ');
  const dr     = fmtDateRange(row);
  const url    = (row[CONFIG.COL_URL] || '').trim();

  /* Colour: layer map → CSS var → fallback */
  const c = (typeof lColors !== 'undefined' && lColors[row._layer])
          || getComputedStyle(document.documentElement).getPropertyValue('--p1').trim()
          || '#888888'; /* last-resort — config should always provide --p1 */

  const startDate = parseDate(row[CONFIG.COL_START]);
  const endDate   = parseDate(row[CONFIG.COL_END]);
  const hasDate   = !!startDate;

  /* Past / ongoing status */
  const effectiveEnd = endDate || startDate;
  const todayNum     = dateOnly(new Date());
  const isPast       = effectiveEnd && dateOnly(effectiveEnd) < todayNum;
  const isOngoing    = !isPast && startDate && dateOnly(startDate) <= todayNum;

  const pastWarning = isPast
    ? '<div class="edwp-status edwp-status-past">\u26a0\ufe0f This event has already taken place. The information below is kept for reference.</div>'
    : isOngoing
    ? '<div class="edwp-status edwp-status-ongoing">\uD83C\uDFAA This event has already started! Check the website for last-minute tickets.</div>'
    : '';

  /* Google Maps link */
  const hasCoords = isFinite(row._lat) && isFinite(row._lon);
  const gmapsURL  = hasCoords
    ? 'https://www.google.com/maps?q=' + row._lat + ',' + row._lon
    : loc ? 'https://www.google.com/maps/search/' + encodeURIComponent(loc) : '';
  const gmapsHtml = gmapsURL
    ? '<a class="tribe-gmaps-link" href="' + escHtml(gmapsURL) + '" target="_blank" rel="noopener noreferrer" title="Show on map">'
      + '<svg class="tribe-gmaps-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
      + 'Show on map <span class="tribe-gmaps-warn">\u26a0\ufe0f Estimated location</span></a>'
    : '';

  /* Deep link + WhatsApp text — fully config-driven via modal.js helpers */
  const deepLink = buildDeepLink(row);
  const waText   = buildWhatsAppText(row, deepLink);
  window._waTextDetail = waText;

  /* Google Calendar + ICS */
  const gcalURL = hasDate ? buildGCalURL(n, startDate, endDate, loc, rem, url) : '';
  const icsName = n.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics';
  window._downloadICS = function(filename) {
    downloadBlob(buildICS(n, startDate, endDate, loc, rem, url), filename, 'text/calendar;charset=utf-8');
  };

  /* Description */
  const descHtml = rem
    ? rem.split(/\n{2,}/).filter(Boolean).map(function(p) {
        return '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>';
      }).join('')
    : '';

  /* Insider Deals */
  const dealsHtml = deals
    ? '<div class="tribe-single-deals"><div class="tribe-deals-label">\uD83C\uDFF7\ufe0f Insider Deal</div>'
      + '<div class="tribe-deals-text">' + escHtml(deals).replace(/\n/g, '<br>') + '</div></div>'
    : '';

  /* Labels from JSON config */
  const L          = CONFIG.LABELS || {};
  const tenantName = (CONFIG.TENANT && CONFIG.TENANT.name) || '';
  const slLabel    = CONFIG.CAT_PICKS_LABEL || 'Shortlisted';
  const slIcon     = CONFIG.CAT_PICKS_ICON  || '\u2b50';
  const lblBack    = L.back_to_events  || '\u2190 All events';
  const lblWebsite = L.visit_website   || '\uD83D\uDD17 Visit website \u2192';
  const lblGcal    = L.add_to_calendar || '\uD83D\uDCC5 Add to Google Calendar';
  const lblWa      = L.share_whatsapp  || '\uD83D\uDCAC Share on WhatsApp';
  const lblCopy    = L.copy_link       || '\uD83D\uDD17 Copy link';

  /* Sharing flags from JSON */
  const sharing = CONFIG.SHARING || { whatsapp: true, gcal: true, copy_link: true };

  root.innerHTML =
    '<div class="tribe-modal-overlay" id="event-modal">'
    + '<div class="tribe-modal"><div class="tribe-modal-body edwp-body">'
    + '<div class="edwp-back"><a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-outline">' + escHtml(lblBack) + '</a></div>'
    + '<div class="tribe-single-cats">'
    + (cnt ? '<span class="tribe-single-cat" style="background:' + c + '22;color:' + c + '">' + escHtml(cnt) + '</span>' : '')
    + (cat ? '<span class="tribe-single-cat">' + etIcon(cat) + ' ' + escHtml(cat) + '</span>' : '')
    + '</div>'
    + '<h1 class="tribe-single-title">' + escHtml(n) + '</h1>'
    + pastWarning
    + (dr  ? '<div class="tribe-single-datetime">\uD83D\uDCC5 ' + escHtml(dr) + '</div>' : '')
    + (loc ? '<div class="tribe-single-location"><span>\uD83D\uDCCD</span><span><span class="tribe-single-location-name">' + escHtml(loc) + '</span></span></div>' : '')
    + gmapsHtml
    + (sl  ? '<div class="tribe-single-shortlisted">' + escHtml(slIcon) + ' ' + escHtml(slLabel) + ' by ' + escHtml(tenantName) + '</div>' : '')
    + dealsHtml
    + (descHtml ? '<div class="tribe-single-desc">' + descHtml + '</div>' : '')
    + '<div class="tribe-single-actions">'
    + (url                         ? '<a class="tribe-btn tribe-btn-primary" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(lblWebsite) + '</a>' : '')
    + (hasDate && sharing.gcal     ? '<a class="tribe-btn tribe-btn-outline tribe-btn-gcal" href="' + escHtml(gcalURL) + '" target="_blank" rel="noopener noreferrer">' + escHtml(lblGcal) + '</a>' : '')
    + (hasDate                     ? '<button class="tribe-btn tribe-btn-outline" onclick="window._downloadICS(\'' + escHtml(icsName) + '\')">&#x2B07; Download .ics</button>' : '')
    + (sharing.whatsapp            ? '<button class="tribe-btn tribe-btn-whatsapp" onclick="shareWhatsApp(window._waTextDetail)">' + escHtml(lblWa) + '</button>' : '')
    + (deepLink && sharing.copy_link ? '<button class="tribe-btn tribe-btn-outline" onclick="copyEventLink(\'' + escHtml(deepLink) + '\')">' + escHtml(lblCopy) + '</button>' : '')
    + '<a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-outline">' + escHtml(lblBack) + '</a>'
    + '</div></div></div></div>';
}

/* ── Error / loading states ──────────────────────────────── */

function hideOverlay() {
  const el = document.getElementById('ov');
  if (el) { el.classList.add('gone'); setTimeout(function() { el.remove(); }, 500); }
}

function renderNotFound(id) {
  hideOverlay();
  const root = document.getElementById('event-detail-root');
  if (!root) return;
  const EVENTS_PAGE_URL = getEventsPageURL();
  const lblBack = (CONFIG.LABELS && CONFIG.LABELS.back_to_events) || '\u2190 All events';
  root.innerHTML =
    '<style>#event-modal{opacity:1;pointer-events:all;position:relative;inset:auto;background:none;padding:2rem 1rem}body{overflow:auto!important}</style>'
    + '<div class="tribe-modal-body edwp-body">'
    + '<div class="edwp-back"><a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-outline">' + escHtml(lblBack) + '</a></div>'
    + '<div class="no-results"><div class="nr-icon">\uD83E\uDD38</div><h3>Event not found</h3>'
    + '<p>The event <strong>' + escHtml(decodeURIComponent(id)) + '</strong> could not be found.<br>It may have ended or been removed.</p>'
    + '<a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-primary" style="margin-top:1rem">' + escHtml(lblBack) + '</a>'
    + '</div></div>';
}

function renderNotID() {
  hideOverlay();
  const root = document.getElementById('event-detail-root');
  if (!root) return;
  const EVENTS_PAGE_URL = getEventsPageURL();
  const lblBack = (CONFIG.LABELS && CONFIG.LABELS.back_to_events) || '\u2190 All events';
  root.innerHTML =
    '<div class="tribe-modal-body edwp-body">'
    + '<div class="edwp-back"><a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-outline">' + escHtml(lblBack) + '</a></div>'
    + '<div class="no-results"><div class="nr-icon">\uD83E\uDD38</div><h3>No ID given</h3>'
    + '<p>No event ID was provided in the URL.<br>Please access this page via the "View details" link on an event card.</p>'
    + '<a href="' + escHtml(EVENTS_PAGE_URL) + '" class="tribe-btn tribe-btn-primary" style="margin-top:1rem">' + escHtml(lblBack) + '</a>'
    + '</div></div>';
}

function renderLoading() {
  const root = document.getElementById('event-detail-root');
  if (!root) return;
  root.innerHTML = '<div style="padding:3rem;text-align:center;font-family:var(--font-body);color:var(--p5)">'
    + '<div style="font-size:2rem;margin-bottom:1rem">\uD83C\uDFAA</div>Loading event\u2026</div>';
}

/* ── Find matching row by slug ID ────────────────────────── */
function findRow(data, targetID) {
  return data.find(function(row) { return rowID(row) === targetID; }) || null;
}

/* ── Data loading ────────────────────────────────────────── */
async function loadAndRender(targetID) {
  renderLoading();
  var data = null;

  /* Primary: Cloudflare Worker — URL from config */
  if (CONFIG.WORKER_URL) {
    try {
      var ctrl = new AbortController();
      var tid  = setTimeout(function() { ctrl.abort(); }, 5000);
      var res  = await fetch(CONFIG.WORKER_URL, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) throw new Error('Non-JSON response (' + ct.split(';')[0].trim() + ')');
      var json = await res.json();
      if (!json.rows || !json.rows.length) throw new Error('Empty response');
      data = json.rows;
    } catch(e) {
      console.warn('[eventdetail-wp] Worker failed, trying CSV:', e.message);
    }
  }

  /* Fallback: Google Sheets CSV — IDs from config */
  if (!data) {
    try {
      var csvURL = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID_ENC
                 + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(CONFIG.SHEET_TAB_ENC);
      var r2 = await fetch(csvURL);
      if (!r2.ok) throw new Error('HTTP ' + r2.status);
      data = parseCSV(await r2.text());
      if (!data.length) throw new Error('No rows parsed');
    } catch(e) {
      console.error('[eventdetail-wp] CSV also failed:', e.message);
      renderNotFound(targetID);
      return;
    }
  }

  /* Attach _layer / _lat / _lon */
  var lSet = new Set();
  data.forEach(function(row) {
    row._layer = (row[CONFIG.COL_LAYER] || 'Other').trim() || 'Other';
    row._lat   = parseFloat((row[CONFIG.COL_LAT] || '').replace(',', '.'));
    row._lon   = parseFloat((row[CONFIG.COL_LON] || '').replace(',', '.'));
    lSet.add(row._layer);
  });
  if (typeof assignColors === 'function') assignColors(Array.from(lSet).sort());

  var row = findRow(data, targetID);
  if (!row) { renderNotFound(targetID); return; }
  hideOverlay();
  renderEventDetail(row);
}

/* ── Entry point ─────────────────────────────────────────── */
(async function() {
  var params   = new URLSearchParams(window.location.search);
  var targetID = params.get('id');

  /* Always load config first — uses TENANT_CONFIG_FILE set in config.js */
  try {
    await loadTenantConfig();
  } catch(e) {
    console.warn('[eventdetail-wp] Config load failed, proceeding with defaults:', e.message);
  }

  if (!targetID) { renderNotID(); return; }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadAndRender(targetID); });
  } else {
    loadAndRender(targetID);
  }
})();
