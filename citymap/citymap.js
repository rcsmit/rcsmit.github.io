/* ============================================================================
   citymap.js — reusable curated city map (Leaflet + MapLibre vector tiles,
   data from a public Google Sheet).

   Usage in a location's index.html:
       <script>window.CITYMAP_CONFIG = { ...location specific settings... };</script>
       <script src="../citymap/citymap.js"></script>
   The script loads its own stylesheet (citymap.css, next to this file) and all
   third-party libraries, and builds the whole page inside <body>.
   Every option is documented in README.md.

   Version history (generic engine)
   # version : 20260607-120000 - Initial version
   # version : 20260607-130000 - Auto-fit, select all, disclaimer, compact website
   # version : 20260607-131000 - fitBounds on every layer change
   # version : 20260607-140000 - LAYERS tab fetch, layer meta
   # version : 20260607-260000 - 100dvh so Android nav buttons don't clip the layout
   # version : 20260607-270000 - Deeplinks: ?layer=Gelato or ?layer=Gelato,Pizza2; URL syncs with selection
   # version : 20260607-280000 - Warning banner when a deeplinked layer isn't found
   # version : 20260607-290000 - Warning clears on manual change; "no layers selected" overlay
   # version : 20260607-300000 - Table row actions: search on Google Maps, show on map
   # version : 20260622-090000 - Precise Google Maps links (lat/lon); print version with numbered pins + legend
   # version : 20260622-100000 - Basemap dropdown, preference saved in localStorage
   # version : 20260804-120000 - Narrower mobile popups; table only lists rows inside the viewport
   # version : 20260921-113202 - OpenFreeMap vector tiles via MapLibre GL (replaces CARTO raster tiles)
   # version : 20261107-102300 - Split into generic engine (citymap.js/css) + per-location config in index.html;
   #                             robust CSV parser (quoted newlines, escaped quotes); only http(s) links accepted
   #                             from the sheet; stable layer colours; event delegation instead of inline handlers
   # version : 20261107-110000 - Optional QR code (config.qr): sidebar button with modal + SVG download, and a QR
   #                             in the printed legend; show-on-map popup fix (markercluster zoomToShowLayer)
   # version : 20261107-130000 - A Google Maps place link in the name column is decoded: name, exact coordinates
   #                             (if LAT/LON are empty) and a clean direct Maps link (tracking parameters removed)
   # version : 20261107-132200 - "My location" button under the zoom control (config.locate): blue dot with accuracy
   #                             circle, one-shot (no tracking), clear messages when denied / unavailable / timed out
   # version : 20261107-140600 - Zoom + location buttons moved to the top right (no longer under the sidebar strip on
   #                             phones); own location marker is a pulsing diamond, distinct from the round place markers
   # version : 20261107-145500 - "Show names on map" toggle (permanent labels, remembered per browser) and a Status
   #                             dropdown (default ALL) built from the sheet's Status column; ?status= deeplink
   # version : 20261123-132500 - Clicking a place name in the bottom table zooms to its marker and opens the popup;
   #                             every row gets an internal key, so this also works for rows without an Id
   # version : 20261123-133500 - "Show all" button under the location button (config.resetView): zooms back out to
   #                             the opening view (all places of the active layers)
   # version : 20261123-134500 - citymap.css is loaded after the library CSS so its rules win; map button icons centred
   # version : 20261123-200000 - Address / Website columns are left out of the table (and the address out of the
   #                             printed legend) when no place in the sheet has one; empty address line hidden in popups
   # version : 20261124-145300 - Google Maps links: popup link = search/?api=1&query=<lat>,<lon>+<name>; table 🔍 = text
   #                             search "<name> <city>" (new config key `city`, falls back to `name`)
   # version : 20261124-152100 - Bottom table shows only name, remarks and actions; address and website are in the popup
   # version : 20261124-155600 - Place counts "(n)" after layer names (sidebar + list); Region dropdown from an optional
   #                             Region column (next to Status on desktop, ?region= deeplink); "ALL CITYMAPS" banner
   #                             under the QR button (config.allMapsLink); config.listPosition "right" puts the place
   #                             list in a third column on the right (name + icons, description below, separators)
   # version : 20261124-160900 - Place list: each layer is a tinted block with a coloured, sticky header; tidier rows
   #                             (icons in a column on the right). Region dropdown moved under the layers: its options
   #                             (with counts) come from the active layers only, it hides when they have no regions,
   #                             and the selection falls back to ALL when it no longer applies
   # version : 20261125-115100 - "Show names": labels no longer overlap. After every zoom/pan each label tries right,
   #                             left, above and below its dot and takes the first free spot (avoiding other labels,
   #                             dots and cluster bubbles); labels with no free spot are hidden until you zoom in or
   #                             hover the dot. Tooltip text is now HTML-escaped
   # version : 20261125-120000 - SVG export button: every active layer becomes two SVG layers ("<layer> – points" and
   #                             "<layer> – names", Illustrator/Inkscape/Affinity layers), plus an optional reference
   #                             layer (config.referencePoints, e.g. the four moat corners) for aligning on a base map
   # version : 20261125-121000 - SVG export: two more layers per map layer: "<layer> – numbers" (number centred in each
   #                             dot, same numbering as the printed map) and "<layer> – list" (one text element,
   #                             "1. Name" per line, placed in a column to the right of the map)
   # version : 20261125-121600 - SVG export: points in three sizes (small r5, medium r7, large r9; small and large start
   #                             hidden); numbers sized to fit the medium dot with padding; names clear the large dot
   # version : 20261125-122200 - SVG export is plain SVG 1.1 (no Inkscape namespace, CSS, <title>/<desc> or hidden
   #                             layers) so stricter importers such as Gravit Designer / Corel Vector can open it
   # version : 20261125-124900 - No flash of unstyled text: a loading screen (spinner + map name) is shown at once, the
   #                             stylesheets and fonts are loaded before the page is built, then the libraries
   # version : 20261127-150000 - Place list: thin "km" column (distance from "My location" once it is found, otherwise
   #                             from the city centre / config.distanceCenter), optional Google rating and review-count
   #                             columns and an optional Id column (only when the sheet has them). Click a column header
   #                             to sort within each layer (Id, name, distance, rating, reviews); the right-hand list
   #                             shows distance / rating / reviews under the name and gets a sort dropdown
   ========================================================================= */
const version = "20261127-150000";

(function () {
  'use strict';

  // Where this script lives, so citymap.css can be found next to it.
  const SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  const BASE_URL = SCRIPT_SRC ? new URL('.', SCRIPT_SRC).href : '';

  // ── DEFAULT CONFIG (every key can be overridden in window.CITYMAP_CONFIG) ───
  const DEFAULT_PALETTE = [
    "#E05A3A","#3ABF57","#3357AB","#D4845A","#2BB89A","#7B5EA7","#E8A838","#2E86C1","#C0392B","#27AE60",
    "#8E44AD","#D35400","#1A8CA0","#B7950B","#C0553A","#4A235A","#6E2F1A","#145A32","#1A5276","#784212",
    "#1B2631","#6C3483","#0E6655","#7D6608","#512E5F","#4D4512","#0B5345","#1F618D","#B03A8C","#5D6D7E"
  ];

  const DEFAULTS = {
    documentTitle: '',          // <title>; falls back to `name`
    name: 'City map',           // sidebar title
    accentWord: '',             // word inside `name` shown in italic gold, e.g. "in"
    tagline: '',                // small line under the title
    city: '',                   // city name added to the Google Maps text search; empty = `name`
    center: null,               // [lat, lon] — required
    zoom: 12,
    maxZoom: 19,
    sheet: { id: '', dataTab: 'MASTER', layersTab: 'LAYERS' },
    fields: { id: 'Id', category: 'Layer', name: 'naam', address: 'address', lon: 'LON', lat: 'LAT', website: 'website', remarks: 'remarks', status: 'Status', region: 'Region', rating: 'rating', reviews: 'reviews' },
    metaFields: { layer: 'Layer', description: 'Description', source: 'Source' },
    theme: {},                  // CSS colour overrides, see README.md
    fonts: { heading: 'Playfair Display', body: 'Lato', url: '' },
    palette: DEFAULT_PALETTE,   // colours handed out to layers in sheet order
    layerColors: {},            // optional { "Layer name": "#hex" } overrides
    disclaimer: '',             // text in the sidebar footer
    popupWarning: '',           // line at the bottom of every popup
    storageKey: 'citymap',      // localStorage prefix (basemap preference)
    defaultBasemap: 'positron',
    defaultLayers: 4,           // number (first N layers), array of layer names, or "all"
    clusterMaxRadius: 60,
    clusterDisableAtZoom: 13,
    fallbackData: null,         // rows used when the sheet can't be reached
    fallbackMeta: {},           // layer descriptions used with fallbackData
    showNames: false,           // initial state of the "show names" toggle (the visitor's choice is remembered)
    locate: true,               // "my location" button; the position is only requested when the button is pressed
    resetView: true,            // "show all" button under the location button: back to the opening view
    qr: { enabled: false, url: '' },   // url = fixed base address; empty = the address of the current page
    allMapsLink: { url: 'https://rcsmit.github.io/citymap/', text: 'ALL CITYMAPS' },   // banner in the sidebar; url '' hides it
    svgExport: true,            // "SVG export" button (points and names per layer, for Illustrator/Inkscape)
    referencePoints: { name: 'Reference points', points: [] },   // extra SVG layer, e.g. moat corners: [{ name, lat, lon }]
    listPosition: 'bottom',     // place list under the map ('bottom') or as a third column on the right ('right'); phones always use 'bottom'
    distanceCenter: null,       // [lat, lon] the km column measures from while "My location" is not used; null = `center`
    strings: {
      searchLabel: 'Search',
      searchPlaceholder: 'Filter by name, address, remarks…',
      mapStyle: 'Map style',
      layers: 'Layers',
      placesCount: '{n} places',
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
      printButton: '🖨 Print map',
      printTitle: 'Print the map with a numbered legend',
      svgButton: '⬇ SVG export',
      svgTitle: 'Download the places of the active layers as an SVG file with separate layers for points and names',
      svgPoints: 'points',
      svgSmall: 'small',
      svgMedium: 'medium',
      svgLarge: 'large',
      svgNames: 'names',
      svgNumbers: 'numbers',
      svgList: 'list',
      loading: 'Loading data…',
      loadingMap: 'Loading map…',
      demoData: '⚠ Using demo data — sheet unreachable',
      loadError: 'Error loading data. Check console.',
      noLayers: 'No layers selected — choose one or more from the sidebar.',
      layerNotFound: 'Layer not found:',
      layersNotFound: 'Layers not found:',
      colName: 'Name',
      colRemarks: 'Remarks',
      colId: '#',
      colIdTitle: 'Id',
      colDistance: 'km',
      distFromMe: 'Distance from your location (km)',
      distFromCenter: 'Distance from the city centre (km)',
      colRating: '★',
      colRatingTitle: 'Google rating',
      colReviews: 'Rev.',
      colReviewsTitle: 'Number of Google reviews',
      reviewsUnit: 'reviews',
      sortHint: 'click to sort',
      sortBy: 'Sort',
      sortSheet: 'Sheet order',
      sortId: 'Id',
      sortName: 'Name A–Z',
      sortDistance: 'Distance (nearest first)',
      sortRating: 'Rating (highest first)',
      sortReviews: 'Reviews (most first)',
      activeLayers: 'Active layers:',
      source: 'Source:',
      googleMaps: 'Google Maps',
      searchOnGoogleMaps: 'Search on Google Maps',
      showOnMap: 'Show on map',
      collapseSidebar: 'Collapse sidebar',
      expandSidebar: 'Expand sidebar',
      disclaimerLabel: 'Disclaimer:',
      showNames: 'Show names on map',
      statusLabel: 'Status',
      statusAll: 'ALL',
      regionLabel: 'Region',
      regionAll: 'ALL',
      locateTitle: 'Show my location',
      resetViewTitle: 'Show all places',
      locating: 'Finding your location…',
      youAreHere: 'You are here',
      accuracy: 'Accuracy: about {n} m',
      locateDenied: 'Location access was denied. Allow it in your browser settings to use this button.',
      locateUnavailable: 'Your location could not be determined.',
      locateTimeout: 'Finding your location took too long. Try again.',
      locateInsecure: 'Location only works on a secure (https) page.',
      qrButton: '▦ QR code',
      qrTitle: 'Scan to open this map',
      qrClose: 'Close',
      qrDownload: 'Download SVG',
      qrPrintCaption: 'Scan to open this map with the same layers',
      configError: 'Configuration error:'
    }
  };

  // ── CONFIG MERGE ────────────────────────────────────────────────────────────
  function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function deepMerge(base, extra) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    if (!isPlainObject(extra)) return out;
    Object.keys(extra).forEach(k => {
      out[k] = (isPlainObject(base[k]) && isPlainObject(extra[k])) ? deepMerge(base[k], extra[k]) : extra[k];
    });
    return out;
  }
  const cfg = deepMerge(DEFAULTS, window.CITYMAP_CONFIG || {});
  const S = cfg.strings;
  const F = cfg.fields;

  // ── SMALL HELPERS ───────────────────────────────────────────────────────────
  function escH(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function toFloat(v) { return v ? parseFloat(String(v).replace(',', '.')) : NaN; }
  function isMobile() { return window.innerWidth <= 640; }
  function popupMaxWidth() { return isMobile() ? Math.round(window.innerWidth * 0.75) : 340; }

  // Only http(s) links from the sheet are ever rendered as links. "www.x.com" gets https://.
  function safeUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u.replace(/^\/\//, '');
    try {
      const parsed = new URL(u);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
    } catch (e) { return ''; }
  }

  // A name cell may hold a pasted Google Maps place link, e.g.
  //   https://www.google.com/maps/place/Greentable+Vegan+Restaurant+Rathaus/@53.56,9.81,12357m/data=...!3d53.5494125!4d9.9928267...
  // /place/<NAME>/   -> the place name
  // !3d<lat>!4d<lon> -> the exact coordinates of the place
  // @lat,lon,<n>m|z  -> only the map view of whoever copied the link; used as a fallback when it is a close zoom (>= 14z)
  // Short links (maps.app.goo.gl) cannot be decoded in the browser and are left as they are.
  // The Google Maps links on the map are always rebuilt from name + coordinates (see mapsUrlFor).
  const GMAPS_PLACE_RE = /^https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/place\/([^/?#]+)/i;
  function parseGoogleMapsPlace(raw) {
    const url = String(raw || '').trim();
    const m = GMAPS_PLACE_RE.exec(url);
    if (!m) return null;
    let name = m[1].replace(/\+/g, ' ');
    try { name = decodeURIComponent(name); } catch (e) {}
    let lat = '', lon = '';
    const exact = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url);
    if (exact) { lat = exact[1]; lon = exact[2]; }
    else {
      const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/.exec(url);
      if (view && parseFloat(view[3]) >= 14) { lat = view[1]; lon = view[2]; }
    }
    return { name, lat, lon };
  }
  function normalizeRow(row) {
    const g = parseGoogleMapsPlace(row[F.name]);
    if (!g) return row;
    row[F.name] = g.name;
    if (isNaN(toFloat(row[F.lat])) || isNaN(toFloat(row[F.lon]))) {
      if (g.lat && g.lon) { row[F.lat] = g.lat; row[F.lon] = g.lon; }
    }
    return row;
  }

  function darken(hex, factor) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const ch = v => Math.max(0, Math.min(255, Math.round(v * (1 - factor))));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => ch(v).toString(16).padStart(2, '0')).join('');
  }

  function titleHtml() {
    const name = String(cfg.name), word = String(cfg.accentWord || '');
    if (word) {
      const m = new RegExp('(^|\\s)' + escRe(word) + '(?=\\s|$)').exec(name);
      if (m) {
        const start = m.index + m[1].length;
        return escH(name.slice(0, start)) + '<em>' + escH(word) + '</em>' + escH(name.slice(start + word.length));
      }
    }
    return escH(name);
  }

  // ── THEME + FONTS ───────────────────────────────────────────────────────────
  function applyTheme() {
    const root = document.documentElement.style;
    const theme = Object.assign({}, cfg.theme);
    if (theme.accent && !theme.accentDark) theme.accentDark = darken(theme.accent, 0.15);
    Object.keys(theme).forEach(k => {
      root.setProperty('--' + k.replace(/([A-Z])/g, '-$1').toLowerCase(), theme[k]);
    });
    if (cfg.fonts.heading) root.setProperty('--font-heading', `'${cfg.fonts.heading}', serif`);
    if (cfg.fonts.body)    root.setProperty('--font-body', `'${cfg.fonts.body}', sans-serif`);
  }

  function fontsUrl() {
    if (cfg.fonts.url) return cfg.fonts.url;
    const fam = n => encodeURIComponent(n).replace(/%20/g, '+');
    const parts = [];
    if (cfg.fonts.heading) parts.push(`family=${fam(cfg.fonts.heading)}:ital,wght@0,400;0,700;1,400`);
    if (cfg.fonts.body)    parts.push(`family=${fam(cfg.fonts.body)}:wght@300;400;700`);
    return parts.length ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : '';
  }

  // ── DEPENDENCY LOADING ──────────────────────────────────────────────────────
  const LIB_CSS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css'
  ];
  // Order matters: each script needs the previous ones.
  const LIB_JS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
    'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
  ];

  const LIB_QR = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js';

  function loadCss(href) {
    return new Promise(resolve => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      l.onload = l.onerror = () => resolve();   // a missing font/CSS must not block the map
      document.head.appendChild(l);
    });
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }
  // Step 1 (before the page is built): all stylesheets, then the web fonts, so nothing is ever shown unstyled.
  // Fonts get at most FONT_WAIT ms; after that the page shows with the fallback font and swaps when they arrive.
  const FONT_WAIT = 1500;
  async function loadStyles() {
    // citymap.css is appended last so it overrides Leaflet/MapLibre styles (equal specificity: last one wins).
    const css = [...LIB_CSS.map(loadCss), loadCss(BASE_URL + 'citymap.css')];
    const fonts = fontsUrl();
    if (fonts) css.push(loadCss(fonts));
    await Promise.all(css);
    if (document.fonts && document.fonts.load) {
      const wanted = [cfg.fonts.heading, cfg.fonts.body].filter(Boolean)
        .flatMap(f => [`400 16px '${f}'`, `700 16px '${f}'`].map(spec => document.fonts.load(spec).catch(() => {})));
      await Promise.race([Promise.all(wanted), new Promise(r => setTimeout(r, FONT_WAIT))]);
    }
  }

  // Step 2 (page already visible): the map libraries, in order.
  async function loadDependencies() {
    for (const src of LIB_JS) await loadScript(src);
    // The QR library is optional: if it cannot be loaded the map still works, just without QR codes.
    if (cfg.qr.enabled) {
      try { await loadScript(LIB_QR); } catch (e) { console.warn(e); cfg.qr.enabled = false; hideQrUi(); }
    }
  }

  function allMapsUrl() { return cfg.allMapsLink && cfg.allMapsLink.url ? safeUrl(cfg.allMapsLink.url) : ''; }

  // Place list on the right (third column) only when configured and the screen is wide enough.
  function listRight() { return cfg.listPosition === 'right' && !isMobile(); }

  // ── PAGE SHELL ──────────────────────────────────────────────────────────────
  function buildShell() {
    document.title = cfg.documentTitle || cfg.name;
    document.body.innerHTML = `
      <div id="float-tip"></div>
      <div id="sidebar-overlay"></div>
      <aside id="sidebar">
        <button id="sidebar-toggle" type="button" title="${escH(S.collapseSidebar)}">&#x25C4;</button>
        <div id="sidebar-header">
          <h1>${titleHtml()}</h1>
          ${cfg.tagline ? `<p>${escH(cfg.tagline)}</p>` : ''}
        </div>
        <div id="sidebar-body">
          <div id="deeplink-warning"></div>
          <div class="section-label">${escH(S.searchLabel)}</div>
          <input id="search-input" type="text" placeholder="${escH(S.searchPlaceholder)}" />

          ${F.status ? `<div id="status-wrap" style="display:none">
            <div class="section-label">${escH(S.statusLabel)}</div>
            <select id="status-select" class="side-select"></select>
          </div>` : ''}

          <div class="section-label">${escH(S.mapStyle)}</div>
          <select id="basemap-select"></select>
          <label id="names-row"><input type="checkbox" id="names-toggle" /> <span>${escH(S.showNames)}</span></label>

          <div class="section-label with-badge">${escH(S.layers)} <span id="count-badge"></span></div>
          <div id="sel-controls">
            <button class="sel-btn" id="btn-select-all" type="button">${escH(S.selectAll)}</button>
            <button class="sel-btn" id="btn-deselect-all" type="button">${escH(S.deselectAll)}</button>
          </div>
          <ul id="layer-list"></ul>
          ${F.region ? `<div id="region-wrap" style="display:none">
            <div class="section-label">${escH(S.regionLabel)}</div>
            <select id="region-select" class="side-select"></select>
          </div>` : ''}
          <div id="loading-msg">${escH(S.loading)}</div>
          <button id="print-btn" type="button" title="${escH(S.printTitle)}">${escH(S.printButton)}</button>
          ${cfg.svgExport ? `<button id="svg-btn" class="side-btn" type="button" title="${escH(S.svgTitle)}">${escH(S.svgButton)}</button>` : ''}
          ${cfg.qr.enabled ? `<button id="qr-btn" class="side-btn" type="button">${escH(S.qrButton)}</button>` : ''}
          ${allMapsUrl() ? `<a id="all-maps-link" href="${escH(allMapsUrl())}">${escH(cfg.allMapsLink.text || 'ALL CITYMAPS')}</a>` : ''}
        </div>
        ${cfg.disclaimer ? `<div id="disclaimer"><strong>⚠ ${escH(S.disclaimerLabel)}</strong> ${escH(cfg.disclaimer)}</div>` : ''}
      </aside>
      <div id="main">
        <div id="map-area">
          <div id="map"></div>
          <div id="no-layers-msg">${escH(S.noLayers)}</div>
          <div id="map-toast" role="status" aria-live="polite"></div>
        </div>
        <div id="drag-handle"></div>
        <div id="table-panel"><div id="table-wrap"></div></div>
        <div id="print-legend"><div id="print-legend-content"></div></div>
      </div>
      ${cfg.qr.enabled ? `<div id="qr-modal" role="dialog" aria-modal="true" aria-label="${escH(S.qrTitle)}">
        <div id="qr-card">
          <div id="qr-title">${escH(S.qrTitle)}</div>
          <div id="qr-img"></div>
          <div id="qr-url"></div>
          <div id="qr-actions">
            <a id="qr-download" class="sel-btn" download="${escH((cfg.storageKey || 'citymap') + '-qr.svg')}">${escH(S.qrDownload)}</a>
            <button id="qr-close" class="sel-btn" type="button">${escH(S.qrClose)}</button>
          </div>
        </div>
      </div>` : ''}`;
    const sel = document.getElementById('basemap-select');
    Object.keys(BASEMAPS).forEach(key => {
      const o = document.createElement('option');
      o.value = key; o.textContent = BASEMAPS[key].label;
      sel.appendChild(o);
    });
  }

  // Loading screen, shown immediately: only inline styles, so it needs no stylesheet. buildShell() replaces it.
  function showLoader() {
    const css = document.createElement('style');
    css.textContent =
      'html,body{margin:0;height:100%;background:var(--cream,#faf6f0)}' +
      '#cm-loader{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--muted,#6b5c4a);font-size:14px;z-index:99999}' +
      '#cm-loader .cm-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--border,#e2d9cc);' +
      'border-top-color:var(--accent,#c0533a);animation:cm-spin .8s linear infinite}' +
      '#cm-loader .cm-title{font-size:18px;font-weight:700;color:var(--deep,#1a1208)}' +
      '@keyframes cm-spin{to{transform:rotate(360deg)}}' +
      '@media (prefers-reduced-motion:reduce){#cm-loader .cm-spin{animation:none;border-color:var(--accent,#c0533a)}}';
    document.head.appendChild(css);
    document.body.innerHTML =
      `<div id="cm-loader" role="status" aria-live="polite"><div class="cm-spin"></div>` +
      `<div class="cm-title">${escH(cfg.documentTitle || cfg.name)}</div><div>${escH(S.loadingMap)}</div></div>`;
  }

  function showFatal(message) {
    document.body.innerHTML = `<div style="margin:auto;max-width:34rem;padding:24px;font-family:sans-serif;line-height:1.5">
      <strong>${escH(S.configError)}</strong> ${escH(message)}</div>`;
  }

  // ── BASEMAPS (OpenFreeMap vector tiles, free, no API key) ───────────────────
  // https://openfreemap.org/quick_start/ — styles are served from tiles.openfreemap.org/styles/<name>.
  // "No labels" variants don't exist upstream, so the style JSON is fetched and all symbol layers
  // (labels, POI icons, shields) are stripped client-side.
  const OFM_STYLE_BASE = 'https://tiles.openfreemap.org/styles/';
  const BASEMAPS = {
    positron:          { label: 'Light',             style: 'positron' },
    dark:              { label: 'Dark',              style: 'dark' },
    bright:            { label: 'Bright',            style: 'bright' },
    liberty:           { label: 'Liberty',           style: 'liberty' },
    fiord:             { label: 'Fiord',             style: 'fiord' },
    positron_nolabels: { label: 'Light (no labels)', style: 'positron', noLabels: true },
    dark_nolabels:     { label: 'Dark (no labels)',  style: 'dark',     noLabels: true }
  };
  // Preferences saved by the old CARTO-based version are migrated.
  const LEGACY_BASEMAP_KEYS = {
    light_all: 'positron', dark_all: 'dark', voyager: 'bright',
    light_nolabels: 'positron_nolabels', dark_nolabels: 'dark_nolabels'
  };

  // ── STATE ───────────────────────────────────────────────────────────────────
  let map = null;
  let allData = [], filteredData = [], layerMeta = {};
  let baseData = [];               // allData after search + status (before the region filter); drives the layer list
  const activeLayers = new Set();
  const layerColors = {};
  let clusterGroups = {};
  const markersById = {};          // row._key -> { marker, cluster, lat, lon }
  let basemapLayer = null;         // L.maplibreGL layer
  let showNames = false;           // permanent name labels on the markers
  let labelMarkers = [];           // markers with a permanent label, in priority order (layer order, then sheet order)
  let basemapSeq = 0;              // guards against out-of-order async style loads
  const sidebarCtl = {};           // filled by initSidebar()
  let myPos = null;                // { lat, lon } from the "My location" button; the km column measures from here
  let tableCols = { id: false, rating: false, reviews: false };   // optional place-list columns, set once the sheet is loaded
  const sortState = { key: '', dir: 1 };                           // place-list sort; key '' = sheet order
  const tip = () => document.getElementById('float-tip');

  // ── CSV ─────────────────────────────────────────────────────────────────────
  // RFC 4180 parser: quoted fields may contain commas, line breaks and "" escapes.
  function parseCSVRows(text) {
    const rows = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
  }
  function csvToObjects(text) {
    const rows = parseCSVRows(text);
    if (!rows.length) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
      return o;
    });
  }
  function sheetCsvUrl(tab) {
    return `https://docs.google.com/spreadsheets/d/${cfg.sheet.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  }

  async function fetchSheet() {
    try {
      const res = await fetch(sheetCsvUrl(cfg.sheet.dataTab));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = csvToObjects(await res.text()).filter(r => r[F.name]).map(normalizeRow);
      if (!data.length) throw new Error('Empty sheet response');
      return data;
    } catch (e) {
      console.warn('Sheet fetch failed:', e);
      if (cfg.fallbackData && cfg.fallbackData.length) {
        document.getElementById('loading-msg').textContent = S.demoData;
        return cfg.fallbackData.map(r => normalizeRow(Object.assign({}, r)));
      }
      throw e;
    }
  }

  async function fetchLayerMeta() {
    try {
      const res = await fetch(sheetCsvUrl(cfg.sheet.layersTab));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const mf = cfg.metaFields, meta = {};
      csvToObjects(await res.text()).forEach(row => {
        const name = row[mf.layer];
        if (!name) return;
        meta[name] = {
          description: row[mf.description] || '',
          source: row[mf.source] || row['Sourcce'] || ''   // 'Sourcce' = typo seen in an existing sheet
        };
      });
      return meta;
    } catch (e) {
      console.warn('LAYERS tab failed:', e);
      return cfg.fallbackMeta || {};
    }
  }

  // ── SIDEBAR ─────────────────────────────────────────────────────────────────
  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const main    = document.getElementById('main');

    function collapse() {
      sidebar.classList.add('collapsed');
      document.body.classList.remove('sidebar-open');
      toggle.innerHTML = '&#x25BA;';
      toggle.title = S.expandSidebar;
      overlay.classList.add('hidden');
    }
    function expand() {
      sidebar.classList.remove('collapsed');
      document.body.classList.add('sidebar-open');
      toggle.innerHTML = '&#x25C4;';
      toggle.title = S.collapseSidebar;
      if (isMobile()) overlay.classList.remove('hidden');
    }
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      sidebar.classList.contains('collapsed') ? expand() : collapse();
    });
    overlay.addEventListener('click', collapse);
    main.addEventListener('click', () => {
      if (isMobile() && !sidebar.classList.contains('collapsed')) collapse();
    });
    sidebarCtl.collapse = collapse;
    sidebarCtl.isOpen = () => !sidebar.classList.contains('collapsed');

    // Mobile starts collapsed, desktop expanded.
    isMobile() ? collapse() : expand();
  }

  // ── BASEMAP SWITCHER ────────────────────────────────────────────────────────
  async function resolveBasemapStyle(key) {
    const conf = BASEMAPS[key];
    const url = OFM_STYLE_BASE + conf.style;
    if (!conf.noLabels) return url;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Style fetch failed: HTTP ' + res.status);
    const style = await res.json();
    style.layers = (style.layers || []).filter(l => l.type !== 'symbol');
    return style;
  }

  async function setBasemap(key) {
    if (!BASEMAPS[key]) key = cfg.defaultBasemap in BASEMAPS ? cfg.defaultBasemap : 'positron';
    const seq = ++basemapSeq;
    let style;
    try {
      style = await resolveBasemapStyle(key);
    } catch (e) {
      console.warn('Basemap style could not be prepared, falling back to labelled style:', e);
      style = OFM_STYLE_BASE + BASEMAPS[key].style;
    }
    if (seq !== basemapSeq) return;   // a newer selection superseded this one

    const glMap = basemapLayer && basemapLayer.getMaplibreMap();
    if (glMap) {
      glMap.setStyle(style);          // reuse the WebGL context instead of recreating the layer
    } else {
      basemapLayer = L.maplibreGL({ style, preserveDrawingBuffer: true }).addTo(map);  // buffer kept so the canvas is printable
    }
    try { localStorage.setItem(cfg.storageKey + '-basemap', key); } catch (e) {}
  }

  function initBasemap() {
    const select = document.getElementById('basemap-select');
    let saved = cfg.defaultBasemap;
    try { saved = localStorage.getItem(cfg.storageKey + '-basemap') || saved; } catch (e) {}
    if (LEGACY_BASEMAP_KEYS[saved]) saved = LEGACY_BASEMAP_KEYS[saved];
    if (!BASEMAPS[saved]) saved = 'positron';
    select.value = saved;
    setBasemap(saved);
    select.addEventListener('change', () => setBasemap(select.value));
  }

  // ── MAP ─────────────────────────────────────────────────────────────────────
  function initMap() {
    // Controls sit at the top right: on phones the collapsed sidebar strip covers the left edge of the map.
    map = L.map('map', { center: cfg.center, zoom: cfg.zoom, maxZoom: cfg.maxZoom, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Keep the bottom table in sync with what is actually visible.
    map.on('moveend', () => buildTable(visibleTableData()));
    map.on('zoomend moveend resize', scheduleDeclutter);
    // Recompute popup width at the moment each popup opens (viewport may have been resized/rotated).
    map.on('popupopen', e => {
      const p = e.popup;
      if (!p || !p.options) return;
      p.options.maxWidth = popupMaxWidth();
      p.update();
    });
    initBasemap();
    initLocate();
    initResetView();
  }

  function fitMapToVisible(data) {
    const pts = data.filter(r => activeLayers.has(r[F.category]))
      .map(r => [toFloat(r[F.lat]), toFloat(r[F.lon])]).filter(([a, o]) => !isNaN(a) && !isNaN(o));
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], 15); return; }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }

  const GMAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';
  function cityName() { return String(cfg.city || cfg.name || '').trim(); }

  // Popup link: exact coordinates plus the place name, e.g.
  //   https://www.google.com/maps/search/?api=1&query=18.7932115,98.9821212+goodsouls%20kitchen
  // Without coordinates it falls back to the text search below.
  function mapsUrlFor(row) {
    const lat = toFloat(row[F.lat]), lon = toFloat(row[F.lon]);
    if (isNaN(lat) || isNaN(lon)) return mapsSearchUrlFor(row);
    const name = String(row[F.name] || '').trim();
    return GMAPS_SEARCH + lat + ',' + lon + (name ? '+' + encodeURIComponent(name) : '');
  }

  // Table 🔍: text search for the place name together with the city name.
  function mapsSearchUrlFor(row) {
    const q = [row[F.name], cityName()].map(v => String(v || '').trim()).filter(Boolean).join(' ');
    return GMAPS_SEARCH + encodeURIComponent(q);
  }

  // ── FLOATING TOOLTIP (layer descriptions on hover) ──────────────────────────
  function showTip(e, layer) {
    if (window.matchMedia('(hover: none)').matches) return;   // never on touch devices
    const m = layerMeta[layer];
    if (!m || (!m.description && !m.source)) return;
    const el = tip();
    el.innerHTML =
      `<div class="tip-name">${escH(layer)}</div>` +
      (m.description ? `<div class="tip-desc">${escH(m.description)}</div>` : '') +
      (m.source      ? `<div class="tip-src">${escH(S.source)} ${escH(m.source)}</div>` : '');
    el.style.display = 'block';
    moveTip(e);
  }
  function moveTip(e) {
    const el = tip(), x = e.clientX + 16, y = e.clientY + 12;
    el.style.left = (x + 250 > window.innerWidth  ? e.clientX - 260 : x) + 'px';
    el.style.top  = (y + 120 > window.innerHeight ? e.clientY - 130 : y) + 'px';
  }
  function hideTip() { tip().style.display = 'none'; }

  // ── LAYER SELECTION ─────────────────────────────────────────────────────────
  function selectAll() {
    clearDeeplinkWarning();
    baseData.forEach(r => { if (r[F.category]) activeLayers.add(r[F.category]); });
    render(true);
  }
  function deselectAll() { clearDeeplinkWarning(); activeLayers.clear(); render(true); }

  function layerNamesOf(data) { return [...new Set(data.map(r => r[F.category]).filter(Boolean))]; }

  // ── MARKERS ─────────────────────────────────────────────────────────────────
  function popupHtml(row) {
    const site = safeUrl(row[F.website]);
    return `<div class="popup-body">
        <div class="popup-name">${escH(row[F.name])}</div>
        ${row[F.address] ? `<div class="popup-addr">${escH(row[F.address])}</div>` : ''}
        ${row[F.remarks] ? `<div class="popup-remark">${escH(row[F.remarks])}</div>` : ''}
        ${site ? `<a class="popup-link" href="${escH(site)}" target="_blank" rel="noopener noreferrer">🌐 ${escH(row[F.website])}</a>` : ''}
        <a class="popup-link" href="${escH(mapsUrlFor(row))}" target="_blank" rel="noopener noreferrer">📍 ${escH(S.googleMaps)}</a>
        ${cfg.popupWarning ? `<div class="popup-warn">ℹ ${escH(cfg.popupWarning)}</div>` : ''}
        <div class="popup-cat">${[row[F.category], F.region && row[F.region], F.status && row[F.status]].filter(Boolean).map(escH).join(' · ')}</div>
      </div>`;
  }

  function buildLayers(data) {
    Object.values(clusterGroups).forEach(g => map.removeLayer(g));
    clusterGroups = {};
    Object.keys(markersById).forEach(k => delete markersById[k]);
    labelMarkers = [];

    layerNamesOf(data).forEach(layer => {
      if (!activeLayers.has(layer)) return;
      const color = layerColors[layer];
      const cluster = L.markerClusterGroup({
        maxClusterRadius: cfg.clusterMaxRadius,
        disableClusteringAtZoom: cfg.clusterDisableAtZoom,
        iconCreateFunction: c => L.divIcon({
          html: `<div class="cm-cluster" style="background:${color}">${c.getChildCount()}</div>`,
          className: '', iconSize: [32, 32]
        })
      });

      data.filter(r => r[F.category] === layer).forEach(row => {
        const lat = toFloat(row[F.lat]), lon = toFloat(row[F.lon]);
        if (isNaN(lat) || isNaN(lon)) return;
        const popup = L.popup({ maxWidth: popupMaxWidth() }).setContent(popupHtml(row));
        const marker = L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 })
          .bindPopup(popup).bindTooltip(escH(row[F.name]), showNames
            ? { permanent: true, direction: 'right', offset: [LABEL_GAP, 0], className: 'cm-label' }
            : { direction: 'top', offset: [0, -6] })
          .addTo(cluster);
        markersById[row._key] = { marker, cluster, lat, lon };
        if (showNames) {
          labelMarkers.push(marker);
          // A label hidden for lack of space still shows while the dot is hovered.
          marker.on('mouseover', () => { const el = marker.getTooltip() && marker.getTooltip().getElement(); if (el) el.classList.add('cm-label-hover'); });
          marker.on('mouseout',  () => { const el = marker.getTooltip() && marker.getTooltip().getElement(); if (el) el.classList.remove('cm-label-hover'); });
        }
      });

      cluster.on('animationend', scheduleDeclutter);   // markers (un)cluster after a zoom
      cluster.addTo(map);
      clusterGroups[layer] = cluster;
    });
    scheduleDeclutter();
  }

  // ── NAME LABELS WITHOUT OVERLAP ─────────────────────────────────────────────
  // Greedy placement: in priority order every label tries four spots around its dot and takes the first
  // one that touches no placed label, no dot and no cluster bubble (spots inside the map view first).
  // A label without a free spot is hidden; zooming in gives it room, hovering its dot shows it anyway.
  const LABEL_GAP = 10;            // px between the dot centre and the label (radius 7 + white border 2 + 1)
  const LABEL_PAD = 2;             // extra px kept free around every label
  let declutterQueued = false;

  function scheduleDeclutter() {
    if (declutterQueued) return;
    declutterQueued = true;
    requestAnimationFrame(() => { declutterQueued = false; declutterLabels(); });
  }

  function declutterLabels() {
    if (!map || !showNames || !labelMarkers.length) return;
    const size = map.getSize();

    // 1. Every label on the map (also just off-screen: its text can still reach into view); make it measurable.
    const items = [];
    labelMarkers.forEach(marker => {
      if (!map.hasLayer(marker)) return;           // inside a cluster: no label on the map
      const tt = marker.getTooltip(), el = tt && tt.getElement();
      if (!el) return;
      const p = map.latLngToContainerPoint(marker.getLatLng());
      el.classList.remove('cm-label-hidden');
      items.push({ tt, el, p });
    });
    items.forEach(it => { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; });   // one layout pass

    // 2. Obstacles: every visible dot and every cluster bubble.
    const obstacles = items.map(({ p }) => ({ x1: p.x - 9, y1: p.y - 9, x2: p.x + 9, y2: p.y + 9 }));
    const mapRect = map.getContainer().getBoundingClientRect();
    map.getContainer().querySelectorAll('.cm-cluster').forEach(c => {
      const r = c.getBoundingClientRect();
      obstacles.push({ x1: r.left - mapRect.left, y1: r.top - mapRect.top, x2: r.right - mapRect.left, y2: r.bottom - mapRect.top });
    });

    const hits = (b, list) => list.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    const inView = b => b.x1 >= 0 && b.y1 >= 0 && b.x2 <= size.x && b.y2 <= size.y;
    const placed = [];

    // 3. Place in priority order.
    items.forEach(it => {
      const { p, w, h } = it;
      const spots = [
        { dir: 'right',  offset: [LABEL_GAP, 0],  x1: p.x + LABEL_GAP,         y1: p.y - h / 2 },
        { dir: 'left',   offset: [-LABEL_GAP, 0], x1: p.x - LABEL_GAP - w,     y1: p.y - h / 2 },
        { dir: 'top',    offset: [0, -LABEL_GAP], x1: p.x - w / 2,             y1: p.y - LABEL_GAP - h },
        { dir: 'bottom', offset: [0, LABEL_GAP],  x1: p.x - w / 2,             y1: p.y + LABEL_GAP }
      ].map(s => Object.assign(s, { x2: s.x1 + w, y2: s.y1 + h }));
      spots.sort((a, b) => inView(b) - inView(a));  // stable: keeps right/left/top/bottom order within each group

      const spot = spots.find(s => {
        const padded = { x1: s.x1 - LABEL_PAD, y1: s.y1 - LABEL_PAD, x2: s.x2 + LABEL_PAD, y2: s.y2 + LABEL_PAD };
        return !hits(padded, placed) && !hits(s, obstacles);
      });
      if (!spot) { it.el.classList.add('cm-label-hidden'); return; }
      placed.push(spot);
      if (it.tt.options.direction !== spot.dir) {
        it.tt.options.direction = spot.dir;
        it.tt.options.offset = L.point(spot.offset);
        it.tt.update();
      }
    });
  }

  // Called from the table (place name or 📍 icon): zoom to the place and open its popup.
  // markercluster's zoomToShowLayer() waits for a marker icon element, which circle markers don't
  // have, so its callback may never fire. Instead zoom first (past the clustering zoom) and open
  // the popup directly on the map once the move has finished.
  function showOnMap(id) {
    const entry = markersById[id];
    if (!entry) return;
    const { marker, lat, lon } = entry;
    if (isMobile() && sidebarCtl.isOpen()) sidebarCtl.collapse();   // make the map visible on phones

    const zoom = Math.min(cfg.maxZoom, Math.max(17, cfg.clusterDisableAtZoom));
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      const popup = marker.getPopup();
      if (popup) popup.setLatLng([lat, lon]).openOn(map);
    };
    if (map.getZoom() === zoom && map.getCenter().distanceTo([lat, lon]) < 1) return open();
    map.once('moveend', () => setTimeout(open, 50));
    setTimeout(open, 1500);   // safety net if no moveend fires
    map.setView([lat, lon], zoom, { animate: true });
  }

  // ── SIDEBAR LIST ────────────────────────────────────────────────────────────
  // Layer names come from baseData (so a region can never hide a layer you might want to switch on);
  // the counts and the badge follow every filter, region included.
  function buildSidebar(data) {
    const ul = document.getElementById('layer-list');
    ul.innerHTML = '';
    layerNamesOf(baseData).forEach(layer => {
      const li = document.createElement('li');
      const on = activeLayers.has(layer);
      if (on) li.classList.add('active');
      li.innerHTML = `
        <span class="layer-dot" style="background:${layerColors[layer]}"></span>
        <span class="layer-name">${escH(layer)}</span>
        <span class="layer-count">(${data.filter(r => r[F.category] === layer).length})</span>
        <span class="layer-check">${on ? '✓' : ''}</span>`;
      li.addEventListener('click', () => {
        clearDeeplinkWarning();
        on ? activeLayers.delete(layer) : activeLayers.add(layer);
        render(true);
      });
      li.addEventListener('mouseenter', e => showTip(e, layer));
      li.addEventListener('mousemove', moveTip);
      li.addEventListener('mouseleave', hideTip);
      ul.appendChild(li);
    });
    const n = data.filter(r => activeLayers.has(r[F.category])).length;
    document.getElementById('count-badge').textContent = S.placesCount.replace('{n}', n);
  }

  // ── TABLE ───────────────────────────────────────────────────────────────────
  // Used by the printed legend: the address column is left out when no place in the sheet has one.
  function optionalColumns() {
    return {
      address: allData.some(r => (r[F.address] || '').trim() !== ''),
      website: allData.some(r => safeUrl(r[F.website]) !== '')
    };
  }

  // ── DISTANCE, RATING, REVIEWS, SORTING ──────────────────────────────────────
  // Distances are measured from the visitor's position once "My location" has found it, otherwise from the
  // city centre (config.distanceCenter, falling back to config.center).
  function distanceOrigin() {
    if (myPos) return myPos;
    const c = Array.isArray(cfg.distanceCenter) && cfg.distanceCenter.length === 2 ? cfg.distanceCenter : cfg.center;
    return { lat: Number(c[0]), lon: Number(c[1]) };
  }
  // Great-circle distance (haversine, earth radius 6371 km) — the same formula as the sheet version.
  function haversineKm(lat1, lon1, lat2, lon2) {
    const rad = d => d * Math.PI / 180;
    const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function distanceKm(r) {
    const lat = toFloat(r[F.lat]), lon = toFloat(r[F.lon]), o = distanceOrigin();
    if (isNaN(lat) || isNaN(lon) || isNaN(o.lat) || isNaN(o.lon)) return NaN;
    return haversineKm(o.lat, o.lon, lat, lon);
  }
  function fmtKm(d) { return isNaN(d) ? '' : d < 10 ? d.toFixed(1) : String(Math.round(d)); }

  // Rating: "4.6", "4,6", "4.6 ★" or "★ 4.6"; only 0–5 counts.
  function ratingOf(r) {
    if (!F.rating) return NaN;
    const v = toFloat(String(r[F.rating] || '').trim().replace(/^[^\d]+/, ''));
    return v >= 0 && v <= 5 ? v : NaN;
  }
  function fmtRating(v) { return isNaN(v) ? '' : v.toFixed(1); }

  // Review count: "1234", "1.234", "1,234", "(1234)" or "1.2k".
  function reviewsOf(r) {
    if (!F.reviews) return NaN;
    const s = String(r[F.reviews] || '').trim();
    if (!s) return NaN;
    const k = /^\(?\s*(\d+(?:[.,]\d+)?)\s*k\s*\)?$/i.exec(s);
    if (k) return Math.round(parseFloat(k[1].replace(',', '.')) * 1000);
    const digits = s.replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : NaN;
  }
  function fmtReviews(n) {
    if (isNaN(n)) return '';
    if (n < 1000) return String(n);
    if (n < 10000) return String(Math.round(n / 100) / 10) + 'k';
    return Math.round(n / 1000) + 'k';
  }

  // Which optional columns the sheet fills (checked once, on all rows).
  function detectTableCols() {
    tableCols = {
      id: !!F.id && allData.some(r => String(r[F.id] || '').trim() !== ''),
      rating: allData.some(r => !isNaN(ratingOf(r))),
      reviews: allData.some(r => !isNaN(reviewsOf(r)))
    };
  }

  const SORT_FIRST_DIR = { id: 1, name: 1, dist: 1, rating: -1, reviews: -1 };   // 1 = ascending
  function sortValue(r, key) {
    if (key === 'id') return String(r[F.id] || '').trim();
    if (key === 'name') return String(r[F.name] || '').trim();
    if (key === 'dist') return distanceKm(r);
    if (key === 'rating') return ratingOf(r);
    if (key === 'reviews') return reviewsOf(r);
    return '';
  }
  // Sorts the rows of one layer. Empty values always go last; ties keep the sheet order.
  function sortRows(rows) {
    const { key, dir } = sortState;
    if (!key) return rows;
    const text = key === 'id' || key === 'name';
    const empty = v => text ? v === '' : isNaN(v);
    return rows.map((r, i) => ({ r, i, v: sortValue(r, key) }))
      .sort((a, b) => {
        const ea = empty(a.v), eb = empty(b.v);
        if (ea !== eb) return ea ? 1 : -1;
        if (ea) return a.i - b.i;
        const c = text ? a.v.localeCompare(b.v, undefined, { numeric: true, sensitivity: 'base' }) : a.v - b.v;
        return c ? c * dir : a.i - b.i;
      })
      .map(x => x.r);
  }
  // A header click cycles: first direction -> reversed -> sheet order.
  function toggleSort(key) {
    const first = SORT_FIRST_DIR[key] || 1;
    if (sortState.key !== key) { sortState.key = key; sortState.dir = first; }
    else if (sortState.dir === first) sortState.dir = -first;
    else { sortState.key = ''; sortState.dir = 1; }
    buildTable(visibleTableData());
  }

  // The bottom table lists (Id), name, remarks, km, (rating), (reviews) and the action icons;
  // address and website are shown in the popup. Number columns are as narrow as their content allows.
  function tableColgroup() {
    return '<colgroup>' +
      (tableCols.id ? '<col style="width:40px">' : '') +
      '<col style="width:34%"><col>' +
      '<col style="width:40px">' +
      (tableCols.rating ? '<col style="width:32px">' : '') +
      (tableCols.reviews ? '<col style="width:40px">' : '') +
      '<col style="width:56px"></colgroup>';
  }
  function sortTh(key, label, title, numeric) {
    const on = sortState.key === key;
    const ind = on ? (sortState.dir > 0 ? '▲' : '▼') : '';
    return `<th${numeric ? ' class="th-num"' : ''} aria-sort="${on ? (sortState.dir > 0 ? 'ascending' : 'descending') : 'none'}">` +
      `<button type="button" class="sort-btn" data-sort="${key}" title="${escH(title + ' — ' + S.sortHint)}">` +
      `${escH(label)}<span class="sort-ind">${ind}</span></button></th>`;
  }
  function tableHead() {
    return '<tr>' +
      (tableCols.id ? sortTh('id', S.colId, S.colIdTitle, true) : '') +
      sortTh('name', S.colName, S.colName, false) +
      `<th>${escH(S.colRemarks)}</th>` +
      sortTh('dist', S.colDistance, myPos ? S.distFromMe : S.distFromCenter, true) +
      (tableCols.rating ? sortTh('rating', S.colRating, S.colRatingTitle, true) : '') +
      (tableCols.reviews ? sortTh('reviews', S.colReviews, S.colReviewsTitle, true) : '') +
      '<th></th></tr>';
  }
  // Right-hand list: a sort dropdown above the layer blocks.
  function sortBarHtml() {
    const opts = [['', S.sortSheet]];
    if (tableCols.id) opts.push(['id', S.sortId]);
    opts.push(['name', S.sortName], ['dist', S.sortDistance]);
    if (tableCols.rating) opts.push(['rating', S.sortRating]);
    if (tableCols.reviews) opts.push(['reviews', S.sortReviews]);
    return `<label class="sort-bar">${escH(S.sortBy)} <select id="sort-select">` +
      opts.map(([v, l]) => `<option value="${v}"${sortState.key === v ? ' selected' : ''}>${escH(l)}</option>`).join('') +
      '</select></label>';
  }
  // Right-hand list: "1.2 km · ★ 4.6 · (1.2k)" under the name.
  function poiMetaHtml(r) {
    const parts = [];
    const d = fmtKm(distanceKm(r));
    if (d) parts.push(`<span title="${escH(myPos ? S.distFromMe : S.distFromCenter)}">${d} km</span>`);
    const v = ratingOf(r);
    if (tableCols.rating && !isNaN(v)) parts.push(`<span title="${escH(S.colRatingTitle)}">★ ${fmtRating(v)}</span>`);
    const n = reviewsOf(r);
    if (tableCols.reviews && !isNaN(n)) parts.push(`<span title="${escH(n + ' ' + S.reviewsUnit)}">(${fmtReviews(n)})</span>`);
    return parts.length ? `<div class="poi-meta">${parts.join(' · ')}</div>` : '';
  }

  // Icons shared by the table and the list: Google Maps text search and "show on map".
  function rowIcons(r, hasCoords) {
    return `<a class="row-icon" href="${escH(mapsSearchUrlFor(r))}" target="_blank" rel="noopener noreferrer" title="${escH(S.searchOnGoogleMaps)}">🔍</a>` +
      (hasCoords ? `<button type="button" class="row-icon" data-show-id="${escH(r._key)}" title="${escH(S.showOnMap)}">📍</button>` : '');
  }
  function nameHtml(r, hasCoords) {
    return hasCoords
      ? `<button type="button" class="name-link" data-show-id="${escH(r._key)}" title="${escH(S.showOnMap)}">${escH(r[F.name])}</button>`
      : escH(r[F.name]);
  }

  // Right-hand list: name with the icons next to it (aligned on the right), the description on the next line.
  function buildPoiList(rows) {
    const ul = document.createElement('ul');
    ul.className = 'poi-list';
    rows.forEach(r => {
      const hasCoords = !isNaN(toFloat(r[F.lat])) && !isNaN(toFloat(r[F.lon]));
      const li = document.createElement('li');
      li.className = 'poi';
      li.innerHTML =
        `<div class="poi-name">${nameHtml(r, hasCoords)}</div><div class="poi-icons">${rowIcons(r, hasCoords)}</div>` +
        poiMetaHtml(r) +
        (r[F.remarks] ? `<div class="poi-desc">${escH(r[F.remarks])}</div>` : '');
      ul.appendChild(li);
    });
    return ul;
  }

  // Solid mix of a layer colour with the panel background (opaque, so sticky headers hide what scrolls under them).
  function tint(color, amount) {
    const parse = c => {
      let m = /^#?([0-9a-f]{3})$/i.exec(String(c).trim());
      if (m) return m[1].split('').map(x => parseInt(x + x, 16));
      m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
      return m ? [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)) : null;
    };
    const fg = parse(color);
    const bg = parse(getComputedStyle(document.documentElement).getPropertyValue('--warm-white')) || [255, 253, 249];
    if (!fg) return '';
    return '#' + fg.map((v, i) => Math.round(bg[i] + (v - bg[i]) * amount).toString(16).padStart(2, '0')).join('');
  }

  function buildTable(data) {
    const wrap = document.getElementById('table-wrap');
    const right = listRight();
    wrap.innerHTML = '';
    layerNamesOf(data).forEach(layer => {
      if (!activeLayers.has(layer)) return;
      const rows = sortRows(data.filter(r => r[F.category] === layer));
      if (!rows.length) return;
      const color = layerColors[layer] || '#333';
      const meta = layerMeta[layer] || {};

      // One tinted block per layer, with a coloured header that sticks while its block is in view.
      const group = document.createElement('section');
      group.className = 'layer-group';
      group.style.setProperty('--lc', color);
      const bgTint = tint(color, 0.07), headTint = tint(color, 0.18);
      if (bgTint) group.style.setProperty('--lc-bg', bgTint);
      if (headTint) group.style.setProperty('--lc-head', headTint);
      wrap.appendChild(group);

      const title = document.createElement('div');
      title.className = 'table-section-title';
      title.innerHTML =
        `<div class="ts-name"><span class="ts-dot"></span>${escH(layer)} <span class="ts-count">(${rows.length})</span></div>` +
        (meta.description ? `<div class="ts-meta">${escH(meta.description)}</div>` : '') +
        (meta.source      ? `<div class="ts-source">${escH(S.source)} ${escH(meta.source)}</div>` : '');
      group.appendChild(title);

      if (right) { group.appendChild(buildPoiList(rows)); return; }

      const tbl = document.createElement('table');
      tbl.innerHTML = `${tableColgroup()}<thead>${tableHead()}</thead>`;
      const tbody = document.createElement('tbody');
      rows.forEach(r => {
        const lat = toFloat(r[F.lat]), lon = toFloat(r[F.lon]);
        const hasCoords = !isNaN(lat) && !isNaN(lon);
        const tr = document.createElement('tr');
        const reviews = reviewsOf(r);
        tr.innerHTML =
          (tableCols.id ? `<td class="td-num td-id" title="${escH(r[F.id])}">${escH(r[F.id])}</td>` : '') +
          `<td>${nameHtml(r, hasCoords)}</td>` +
          `<td>${escH(r[F.remarks])}</td>` +
          `<td class="td-num">${fmtKm(distanceKm(r))}</td>` +
          (tableCols.rating ? `<td class="td-num">${fmtRating(ratingOf(r))}</td>` : '') +
          (tableCols.reviews ? `<td class="td-num"${isNaN(reviews) ? '' : ` title="${reviews} ${escH(S.reviewsUnit)}"`}>${fmtReviews(reviews)}</td>` : '') +
          `<td class="td-actions">${rowIcons(r, hasCoords)}</td>`;
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      group.appendChild(tbl);
    });
    if (right && wrap.firstChild) wrap.insertAdjacentHTML('afterbegin', sortBarHtml());
  }

  // Only rows inside the current map viewport are listed in the place list.
  function visibleTableData() {
    let bounds;
    try { bounds = map.getBounds(); } catch (e) { return filteredData; }
    return filteredData.filter(r => {
      const lat = toFloat(r[F.lat]), lon = toFloat(r[F.lon]);
      return !isNaN(lat) && !isNaN(lon) && bounds.contains([lat, lon]);
    });
  }

  // ── MY LOCATION ─────────────────────────────────────────────────────────────
  const LOCATE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';
  let locateLayers = [], toastTimer = null;

  function toast(message) {
    const el = document.getElementById('map-toast');
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  function locateMe(button) {
    if (!window.isSecureContext) return toast(S.locateInsecure);
    button.classList.add('busy');
    toast(S.locating);
    navigator.geolocation.getCurrentPosition(pos => {
      button.classList.remove('busy');
      document.getElementById('map-toast').style.display = 'none';
      const ll = [pos.coords.latitude, pos.coords.longitude], acc = Math.max(pos.coords.accuracy || 0, 1);
      locateLayers.forEach(l => map.removeLayer(l));
      const circle = L.circle(ll, { radius: acc, color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: 0.12, interactive: false });
      // A diamond with a pulsing ring: clearly different from the round place markers.
      const dot = L.marker(ll, {
        icon: L.divIcon({ className: '', html: '<div class="me-marker"></div>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -12] }),
        zIndexOffset: 1000, keyboard: false, title: S.youAreHere
      }).bindPopup(`<div class="popup-body"><div class="popup-name">${escH(S.youAreHere)}</div><div class="popup-addr">${escH(S.accuracy.replace('{n}', Math.round(acc)))}</div></div>`);
      locateLayers = [circle, dot];
      locateLayers.forEach(l => l.addTo(map));
      button.classList.add('active');
      myPos = { lat: ll[0], lon: ll[1] };   // the km column now measures from here
      map.fitBounds(circle.getBounds(), { maxZoom: 16, padding: [40, 40] });
      buildTable(visibleTableData());
    }, err => {
      button.classList.remove('busy');
      toast(err.code === 1 ? S.locateDenied : err.code === 3 ? S.locateTimeout : S.locateUnavailable);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }

  function initLocate() {
    if (!cfg.locate || !('geolocation' in navigator)) return;
    const LocateControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const bar = L.DomUtil.create('div', 'leaflet-bar locate-control');
        const a = L.DomUtil.create('a', '', bar);
        a.href = '#'; a.setAttribute('role', 'button');
        a.title = S.locateTitle; a.setAttribute('aria-label', S.locateTitle);
        a.innerHTML = LOCATE_ICON;
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); locateMe(a); });
        return bar;
      }
    });
    map.addControl(new LocateControl());
  }

  // ── SHOW ALL (back to the opening view) ─────────────────────────────────────
  // Same view as when the page opens: all places of the active layers in view, or the configured center/zoom.
  const RESET_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

  function resetView() {
    map.closePopup();
    const hasPoints = filteredData.some(r => activeLayers.has(r[F.category]) &&
      !isNaN(toFloat(r[F.lat])) && !isNaN(toFloat(r[F.lon])));
    if (hasPoints) fitMapToVisible(filteredData);
    else map.setView(cfg.center, cfg.zoom);
  }

  function initResetView() {
    if (!cfg.resetView) return;
    const ResetControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const bar = L.DomUtil.create('div', 'leaflet-bar locate-control reset-control');
        const a = L.DomUtil.create('a', '', bar);
        a.href = '#'; a.setAttribute('role', 'button');
        a.title = S.resetViewTitle; a.setAttribute('aria-label', S.resetViewTitle);
        a.innerHTML = RESET_ICON;
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); resetView(); });
        return bar;
      }
    });
    map.addControl(new ResetControl());
  }

  // ── QR CODE ─────────────────────────────────────────────────────────────────
  function hideQrUi() { ['qr-btn', 'qr-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); }); }

  // Address of this map including the active layers, so a scan reproduces what is on screen.
  function qrTargetUrl() {
    const base = cfg.qr.url || (window.location.origin + window.location.pathname);
    const u = new URL(base, window.location.href);
    u.search = '';
    if (activeLayers.size) u.searchParams.set('layer', [...activeLayers].join(','));
    if (currentStatus()) u.searchParams.set('status', currentStatus());
    if (currentRegion()) u.searchParams.set('region', currentRegion());
    return u.href;
  }

  function qrSvg(url) {
    const make = text => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); };
    try { return { svg: make(url), url }; }
    catch (e) {   // too many layers for one QR code: fall back to the plain map address
      const plain = qrTargetUrl().split('?')[0];
      return { svg: make(plain), url: plain };
    }
  }

  function openQr() {
    const { svg, url } = qrSvg(qrTargetUrl());
    document.getElementById('qr-img').innerHTML = svg;
    document.getElementById('qr-url').textContent = url;
    const dl = document.getElementById('qr-download');
    dl.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"'));
    document.getElementById('qr-modal').classList.add('open');
    document.getElementById('qr-close').focus();
  }
  function closeQr() { document.getElementById('qr-modal').classList.remove('open'); }

  function initQr() {
    if (!cfg.qr.enabled) return;
    document.getElementById('qr-btn').addEventListener('click', openQr);
    document.getElementById('qr-close').addEventListener('click', closeQr);
    document.getElementById('qr-modal').addEventListener('click', e => { if (e.target.id === 'qr-modal') closeQr(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQr(); });
  }

  // ── SVG EXPORT ──────────────────────────────────────────────────────────────
  // All places of the active layers (with the current filters), projected in Web Mercator at the current
  // zoom level, so 1 SVG unit = 1 screen pixel and the file lines up with a screenshot / tiles of that zoom.
  // Layer structure (bottom to top): every "<layer> – points", "– numbers", "– names", "– list", then the reference layer.
  // Numbers follow the printed map: 1, 2, 3… in layer order, then sheet order.
  // Every layer is a top-level <g> whose id is the layer name (Illustrator, Affinity, Gravit and Figma show it).
  function exportSvg() {
    const zoom = map.getZoom();
    const PAD = 40, FONT_SIZE = 11, LIST_GAP = 60, LIST_LINE = 1.4;
    // Three dot sizes, each its own layer (all visible: hide the two you don't need in the design program).
    const SIZES = [
      { key: S.svgSmall,  r: 5 },
      { key: S.svgMedium, r: 7 },
      { key: S.svgLarge,  r: 9 }
    ];
    const R = 9;                       // largest dot: names and the obstacle boxes keep clear of it
    const R_NUM = 7;                   // numbers are sized to fit the medium dot
    const GAP = R + 3;
    const fontFamily = (cfg.fonts && cfg.fonts.body) || 'sans-serif';

    const layers = layerNamesOf(filteredData).filter(l => activeLayers.has(l));
    const places = [];
    let number = 1;
    layers.forEach(layer => filteredData.filter(r => r[F.category] === layer).forEach(row => {
      const lat = toFloat(row[F.lat]), lon = toFloat(row[F.lon]);
      if (!isNaN(lat) && !isNaN(lon)) places.push({ layer, number: number++, name: String(row[F.name] || ''), pt: map.project([lat, lon], zoom) });
    }));
    const ref = cfg.referencePoints || {};
    const refPoints = (ref.points || []).map(p => ({ name: String(p.name || ''), lat: toFloat(p.lat), lon: toFloat(p.lon) }))
      .filter(p => !isNaN(p.lat) && !isNaN(p.lon))
      .map(p => Object.assign(p, { pt: map.project([p.lat, p.lon], zoom) }));
    if (!places.length && !refPoints.length) { toast(S.noLayers); return; }

    // Text widths, measured with the map's own font, for placing the names.
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${FONT_SIZE}px '${fontFamily}', sans-serif`;

    // Largest bold size (max 7.5px) at which a number keeps 2px free on each side inside the medium dot
    // (inner width = diameter minus the 1.5px white border on both sides).
    function numberFontSize(num) {
      const room = 2 * R_NUM - 2 * 1.5 - 2 * 2;
      // Measured in the map font and in Arial: a design program without that font falls back to a wider one.
      const w10 = Math.max(...[`'${fontFamily}', sans-serif`, 'Arial, Helvetica, sans-serif'].map(f => {
        ctx.font = `700 10px ${f}`;
        return ctx.measureText(String(num)).width;
      }));
      ctx.font = `${FONT_SIZE}px '${fontFamily}', sans-serif`;
      return Math.max(4, Math.min(7, Math.floor((room / w10) * 10 * 4) / 4));
    }

    const all = places.map(p => p.pt).concat(refPoints.map(p => p.pt));
    let minX = Math.min(...all.map(p => p.x)), minY = Math.min(...all.map(p => p.y));
    let maxX = Math.max(...all.map(p => p.x)), maxY = Math.max(...all.map(p => p.y));

    // Names: same idea as on screen (right, left, above, below; first free spot), but nothing is hidden:
    // a name without a free spot goes to the right of its dot.
    const dots = places.map(({ pt }) => ({ x1: pt.x - R - 1, y1: pt.y - R - 1, x2: pt.x + R + 1, y2: pt.y + R + 1 }));
    const placed = [];
    const hits = (b, list) => list.some(o => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    places.forEach(p => {
      const w = ctx.measureText(p.name).width, h = FONT_SIZE * 1.2, { x, y } = p.pt;
      const spots = [
        { anchor: 'start',  tx: x + GAP,     ty: y + FONT_SIZE * 0.35,  x1: x + GAP,         y1: y - h / 2 },
        { anchor: 'end',    tx: x - GAP,     ty: y + FONT_SIZE * 0.35,  x1: x - GAP - w,     y1: y - h / 2 },
        { anchor: 'middle', tx: x,           ty: y - GAP - h * 0.25,    x1: x - w / 2,       y1: y - GAP - h },
        { anchor: 'middle', tx: x,           ty: y + GAP + FONT_SIZE,   x1: x - w / 2,       y1: y + GAP }
      ].map(s => Object.assign(s, { x2: s.x1 + w, y2: s.y1 + h }));
      p.label = spots.find(s => !hits(s, placed) && !hits(s, dots)) || spots[0];
      placed.push(p.label);
      minX = Math.min(minX, p.label.x1); maxX = Math.max(maxX, p.label.x2);
      minY = Math.min(minY, p.label.y1); maxY = Math.max(maxY, p.label.y2);
    });

    // Lists: one block per layer, stacked in a column to the right of the map area.
    const listX = maxX + LIST_GAP, lineH = FONT_SIZE * LIST_LINE;
    let listY = minY, listW = 0;
    const lists = layers.map(layer => {
      const lines = places.filter(p => p.layer === layer).map(p => `${p.number}. ${p.name}`);
      const block = { layer, lines, x: listX, y: listY + FONT_SIZE };
      lines.forEach(l => { listW = Math.max(listW, ctx.measureText(l).width); });
      listY += lines.length * lineH + LIST_GAP / 2;
      return block;
    }).filter(b => b.lines.length);
    if (lists.length) { maxX = listX + listW; maxY = Math.max(maxY, listY - LIST_GAP / 2); }

    const ox = minX - PAD, oy = minY - PAD;
    const W = Math.ceil(maxX - minX + 2 * PAD), H = Math.ceil(maxY - minY + 2 * PAD);
    const n = v => (Math.round(v * 100) / 100).toString();
    const esc = v => escH(v);   // XML-safe text and attribute values

    const usedIds = new Set();
    const layerId = label => {
      let id = String(label).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'layer';
      if (/^[^A-Za-z_]/.test(id)) id = 'L_' + id;
      let unique = id, i = 2;
      while (usedIds.has(unique)) unique = id + '_' + i++;
      usedIds.add(unique);
      return unique;
    };
    // Plain SVG 1.1 for the widest compatibility (Gravit/Corel Vector, Illustrator, Affinity, Inkscape, Figma):
    // only <g>, <circle>, <path>, <text>/<tspan>; every style as a presentation attribute; no CSS, no foreign
    // namespaces, no <title>/<desc>, no hidden layers. The layer name is the group id.
    const group = (label, body) => `  <g id="${esc(layerId(label))}">\n${body}  </g>\n`;
    const FONT = esc(`${fontFamily}, Arial, Helvetica, sans-serif`.replace(/["']/g, ''));
    const TEXT = `font-family="${FONT}" font-weight="bold" fill="#1a1208"`;

    let pointLayers = '', numberLayers = '', nameLayers = '', listLayers = '';
    layers.forEach(layer => {
      const color = layerColors[layer] || '#333333';
      const items = places.filter(p => p.layer === layer);
      if (!items.length) return;
      SIZES.slice().reverse().forEach(sz => {   // large at the bottom, small on top
        pointLayers += group(`${layer} ${S.svgPoints} ${sz.key} r${sz.r}`, items.map(p =>
          `    <circle cx="${n(p.pt.x - ox)}" cy="${n(p.pt.y - oy)}" r="${sz.r}" fill="${esc(color)}" stroke="#ffffff" stroke-width="1.5"/>\n`).join(''));
      });
      numberLayers += group(`${layer} ${S.svgNumbers}`, items.map(p => {
        const size = numberFontSize(p.number);
        return `    <text x="${n(p.pt.x - ox)}" y="${n(p.pt.y - oy + size * 0.36)}" font-family="${FONT}" font-weight="bold" font-size="${n(size)}" fill="#ffffff" text-anchor="middle">${p.number}</text>\n`;
      }).join(''));
      nameLayers += group(`${layer} ${S.svgNames}`, items.map(p =>
        `    <text x="${n(p.label.tx - ox)}" y="${n(p.label.ty - oy)}" ${TEXT} font-size="${FONT_SIZE}" text-anchor="${p.label.anchor}">${esc(p.name)}</text>\n`).join(''));
    });
    // One text element per list, one "number. name" per line (tspans), so it edits as a single block.
    lists.forEach(b => {
      const x = n(b.x - ox);
      const tspans = b.lines.map((l, i) => `<tspan x="${x}"${i ? ` dy="${n(lineH)}"` : ''}>${esc(l)}</tspan>`).join('');
      listLayers += group(`${b.layer} ${S.svgList}`,
        `    <text x="${x}" y="${n(b.y - oy)}" font-family="${FONT}" font-size="${FONT_SIZE}" fill="#1a1208">${tspans}</text>\n`);
    });
    const refLayer = refPoints.length ? group(ref.name || 'Reference points', refPoints.map(p => {
      const x = p.pt.x - ox, y = p.pt.y - oy, a = 6;
      return `    <path d="M${n(x - a)} ${n(y)}H${n(x + a)}M${n(x)} ${n(y - a)}V${n(y + a)}" stroke="#000000" stroke-width="1" fill="none"/>\n`;
    }).join('')) : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${esc(cfg.documentTitle || cfg.name).replace(/-{2,}/g, '-')}. Web Mercator, zoom ${zoom}, 1 unit = 1 screen pixel; top-left = world pixel ${n(ox)}, ${n(oy)} at this zoom. -->
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${pointLayers}${numberLayers}${nameLayers}${listLayers}${refLayer}</svg>
`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (cfg.storageKey || 'citymap') + '-map.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ── PRINT ───────────────────────────────────────────────────────────────────
  let printNumberLayer = null;   // layer group holding the temporary numbered markers
  let printSavedClusters = [];   // cluster groups removed from the map while printing
  let printSavedView = null;     // { center, zoom } restored afterwards
  let printPrepared = false;

  // Numbers every visible row with valid coordinates, in legend order (layer by layer).
  function assignPrintNumbers(data) {
    const list = [];
    let n = 1;
    layerNamesOf(data).filter(l => activeLayers.has(l)).forEach(layer => {
      data.filter(r => r[F.category] === layer).forEach(row => {
        const lat = toFloat(row[F.lat]), lon = toFloat(row[F.lon]);
        if (isNaN(lat) || isNaN(lon)) return;
        list.push({ number: n++, layer, row, lat, lon });
      });
    });
    return list;
  }

  function buildPrintLegend(list) {
    const layerNames = [...new Set(list.map(e => e.layer))];
    let html = '';
    if (cfg.qr.enabled) {
      try { html += `<div class="pl-qr">${qrSvg(qrTargetUrl()).svg}<div>${escH(S.qrPrintCaption)}</div></div>`; } catch (e) { console.warn(e); }
    }
    html += `<div class="pl-active-layers"><strong>${escH(S.activeLayers)}</strong> ${layerNames.map(escH).join(', ') || '—'}</div>`;
    const showAddress = optionalColumns().address;
    layerNames.forEach(layer => {
      const color = layerColors[layer] || '#333';
      html += `<div class="pl-section"><div class="pl-section-title" style="color:${color}">${escH(layer)}</div><table class="pl-table"><tbody>`;
      list.filter(e => e.layer === layer).forEach(({ number, row }) => {
        html += `<tr>
          <td style="width:24px"><span class="pl-num" style="background:${color}">${number}</span></td>
          <td style="width:${showAddress ? 22 : 35}%">${escH(row[F.name])}</td>
          ${showAddress ? `<td style="width:30%">${escH(row[F.address])}</td>` : ''}
          <td>${escH(row[F.remarks])}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    });
    document.getElementById('print-legend-content').innerHTML = html;
  }

  function preparePrint() {
    if (printPrepared) return;   // printMap() may already have prepared the page
    printPrepared = true;
    const list = assignPrintNumbers(filteredData);

    // Swap clustered markers for plain numbered pins so every point is legible on paper.
    printSavedClusters = Object.values(clusterGroups).filter(g => map.hasLayer(g));
    printSavedClusters.forEach(g => map.removeLayer(g));

    printNumberLayer = L.layerGroup();
    list.forEach(({ number, layer, lat, lon }) => {
      L.marker([lat, lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="print-num-icon-inner" style="background:${layerColors[layer] || '#333'}">${number}</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11]
        })
      }).addTo(printNumberLayer);
    });
    printNumberLayer.addTo(map);

    printSavedView = { center: map.getCenter(), zoom: map.getZoom() };
    if (list.length) map.fitBounds(L.latLngBounds(list.map(e => [e.lat, e.lon])), { padding: [30, 30], maxZoom: 16, animate: false });
    map.invalidateSize();
    buildPrintLegend(list);
  }

  function cleanupPrint() {
    printPrepared = false;
    if (printNumberLayer) { map.removeLayer(printNumberLayer); printNumberLayer = null; }
    printSavedClusters.forEach(g => g.addTo(map));
    printSavedClusters = [];
    if (printSavedView) { map.setView(printSavedView.center, printSavedView.zoom, { animate: false }); printSavedView = null; }
    map.invalidateSize();
  }

  // Vector tiles need a moment to redraw at the print extent: prepare, wait, then print.
  // (Ctrl+P still works through the beforeprint handler, without the delay.)
  function printMap() { preparePrint(); setTimeout(() => window.print(), 1200); }

  // ── SEARCH, DEEPLINKS, RENDER ───────────────────────────────────────────────
  // Filtering happens in two steps:
  //   1. search + status            -> baseData  (decides which layers are listed)
  //   2. region (on the active layers) -> filteredData (markers, list, counts, print)
  function applySearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const keys = [F.category, F.name, F.address, F.website, F.remarks, F.status, F.region].filter(Boolean);
    const st = currentStatus();
    const rows = st ? allData.filter(r => (r[F.status] || '') === st) : allData;
    baseData = q ? rows.filter(r => keys.some(k => (r[k] || '').toLowerCase().includes(q))) : [...rows];
    updateRegionOptions();
    const rg = currentRegion();
    filteredData = rg ? baseData.filter(r => (r[F.region] || '') === rg) : [...baseData];
  }

  // Region options are the regions of the places in the active layers (after search + status), with counts.
  // The dropdown is hidden when those places have no region; a selection that no longer exists falls back to ALL.
  let pendingRegion = null;   // ?region= from the URL, applied once the options exist
  function updateRegionOptions() {
    const sel = document.getElementById('region-select');
    if (!sel || !F.region) return;
    const rows = baseData.filter(r => activeLayers.has(r[F.category]));
    const counts = new Map();
    rows.forEach(r => { const v = r[F.region]; if (v) counts.set(v, (counts.get(v) || 0) + 1); });
    const values = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    let current = sel.value;
    if (pendingRegion !== null) {
      current = values.find(v => v.toLowerCase() === pendingRegion.trim().toLowerCase()) || '';
      pendingRegion = null;
    }
    if (!counts.has(current)) current = '';

    sel.innerHTML = '';
    [['', `${S.regionAll} (${rows.length})`], ...values.map(v => [v, `${v} (${counts.get(v)})`])].forEach(([value, label]) => {
      const o = document.createElement('option');
      o.value = value; o.textContent = label;
      sel.appendChild(o);
    });
    sel.value = current;
    document.getElementById('region-wrap').style.display = values.length ? 'block' : 'none';
  }

  // Selected value of the Status / Region dropdowns ('' = ALL).
  function selectValue(id) { const sel = document.getElementById(id); return sel ? sel.value : ''; }
  function currentStatus() { return selectValue('status-select'); }
  function currentRegion() { return selectValue('region-select'); }

  // The sheet's column header may differ in case ("region" vs "Region"): use the header as it is in the sheet.
  function resolveFieldName(key) {
    if (!F[key] || !allData.length) return;
    const want = String(F[key]).toLowerCase();
    const actual = Object.keys(allData[0]).find(h => h.toLowerCase() === want);
    if (actual) F[key] = actual;
  }
  // Same, but also accepts common alternative headers ("Google rating", "Number of reviews", …).
  const FIELD_ALIASES = {
    rating: ['rating', 'google rating', 'googlerating', 'stars'],
    reviews: ['reviews', 'number reviews', 'number of reviews', 'nr reviews', 'num reviews', 'review count',
              'reviews count', 'google reviews', 'user ratings total']
  };
  function resolveFieldAny(key) {
    if (!F[key] || !allData.length) return;
    const norm = s => String(s).toLowerCase().replace(/[\s_\-]+/g, ' ').trim();
    const headers = Object.keys(allData[0]);
    for (const want of [F[key], ...(FIELD_ALIASES[key] || [])].map(norm)) {
      const actual = headers.find(h => norm(h) === want);
      if (actual) { F[key] = actual; return; }
    }
  }

  // Fills the Status dropdown from the distinct values in the sheet column (hidden when the column is empty or absent).
  function initFilterSelect(field, selectId, wrapId, allLabel, param) {
    const sel = document.getElementById(selectId);
    if (!sel || !field) return false;
    const values = [...new Set(allData.map(r => r[field]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (!values.length) return false;
    sel.innerHTML = '';
    [['', allLabel], ...values.map(v => [v, v])].forEach(([value, label]) => {
      const o = document.createElement('option');
      o.value = value; o.textContent = label;
      sel.appendChild(o);
    });
    const wanted = new URLSearchParams(window.location.search).get(param);
    const match = wanted && values.find(v => v.toLowerCase() === wanted.trim().toLowerCase());
    if (match) sel.value = match;
    document.getElementById(wrapId).style.display = 'block';
    sel.addEventListener('change', () => render(true));
    return true;
  }

  // Status (fixed options, top of the sidebar) and Region (options follow the active layers, under the layers).
  function initFilters() {
    resolveFieldName('status');
    resolveFieldName('region');
    initFilterSelect(F.status, 'status-select', 'status-wrap', S.statusAll, 'status');
    const regionSel = document.getElementById('region-select');
    if (regionSel) {
      pendingRegion = new URLSearchParams(window.location.search).get('region');
      regionSel.addEventListener('change', () => render(true));
    }
  }

  // "Show names on map" toggle; the choice is remembered in this browser.
  function initNamesToggle() {
    const box = document.getElementById('names-toggle');
    let saved = null;
    try { saved = localStorage.getItem(cfg.storageKey + '-names'); } catch (e) {}
    showNames = saved === null ? !!cfg.showNames : saved === '1';
    box.checked = showNames;
    box.addEventListener('change', () => {
      showNames = box.checked;
      try { localStorage.setItem(cfg.storageKey + '-names', showNames ? '1' : '0'); } catch (e) {}
      buildLayers(filteredData);   // markers are rebuilt with / without permanent labels
    });
  }

  function clearDeeplinkWarning() {
    const warn = document.getElementById('deeplink-warning');
    warn.style.display = 'none';
    warn.innerHTML = '';
  }

  function render(fitBounds) {
    applySearch();
    buildSidebar(filteredData);
    buildLayers(filteredData);
    buildTable(visibleTableData());
    if (fitBounds) fitMapToVisible(filteredData);
    syncURL();
    document.getElementById('no-layers-msg').style.display = activeLayers.size === 0 ? 'flex' : 'none';
  }

  // The address bar always reflects a shareable ?layer= deeplink.
  function syncURL() {
    const params = new URLSearchParams(window.location.search);
    activeLayers.size ? params.set('layer', [...activeLayers].join(',')) : params.delete('layer');
    params.delete('layers');
    currentStatus() ? params.set('status', currentStatus()) : params.delete('status');
    currentRegion() ? params.set('region', currentRegion()) : params.delete('region');
    history.replaceState(null, '', window.location.pathname + (params.toString() ? '?' + params.toString() : ''));
  }

  // ?layer=Gelato or ?layer=Gelato,Pizza2 (also ?layers=)
  function getLayersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('layer') || params.get('layers');
    return raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : null;
  }

  function defaultActiveLayers(allLayers) {
    const d = cfg.defaultLayers;
    if (d === 'all') return allLayers;
    if (Array.isArray(d)) return allLayers.filter(l => d.some(x => String(x).toLowerCase() === l.toLowerCase()));
    return allLayers.slice(0, Math.max(0, Number(d) || 0));
  }

  function assignLayerColors(allLayers) {
    const palette = cfg.palette.length ? cfg.palette : DEFAULT_PALETTE;
    const overrides = cfg.layerColors || {};
    allLayers.forEach((l, i) => { layerColors[l] = overrides[l] || palette[i % palette.length]; });
  }

  // ── PLACE LIST POSITION (bottom / right) ────────────────────────────────────
  let listRightActive = null;
  function applyListPosition() {
    const right = listRight();
    if (right === listRightActive) return;
    listRightActive = right;
    document.body.classList.toggle('list-right', right);
    const panel = document.getElementById('table-panel');
    panel.style.height = ''; panel.style.width = '';   // sizes dragged in the other layout don't apply
    if (map) {
      map.invalidateSize();
      if (allData.length) buildTable(visibleTableData());
    }
  }

  // ── DRAG TO RESIZE THE PLACE LIST ───────────────────────────────────────────
  // Bottom layout: drag up/down changes the height. Right layout: drag left/right changes the width.
  function initDragHandle() {
    const handle = document.getElementById('drag-handle');
    const panel  = document.getElementById('table-panel');
    const main   = document.getElementById('main');
    let dragging = false, startPos = 0, startSize = 0;

    function start(x, y) {
      dragging = true;
      startPos = listRight() ? x : y;
      startSize = listRight() ? panel.offsetWidth : panel.offsetHeight;
    }
    function move(x, y) {
      if (!dragging) return;
      if (listRight()) {
        const maxW = main.offsetWidth - 200;          // leave at least 200px for the map
        panel.style.width = Math.min(maxW, Math.max(200, startSize + (startPos - x))) + 'px';
      } else {
        const maxH = main.offsetHeight - 80;          // leave at least 80px for the map
        panel.style.height = Math.min(maxH, Math.max(40, startSize + (startPos - y))) + 'px';
      }
      map.invalidateSize();
    }
    function stop() { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }

    handle.addEventListener('mousedown', e => {
      start(e.clientX, e.clientY);
      document.body.style.cursor = listRight() ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    handle.addEventListener('touchstart', e => { start(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => { if (dragging) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop);
  }

  // ── START ───────────────────────────────────────────────────────────────────
  async function init() {
    initSidebar();
    applyListPosition();
    initMap();
    window.addEventListener('resize', applyListPosition);
    initDragHandle();

    document.getElementById('btn-select-all').addEventListener('click', selectAll);
    document.getElementById('btn-deselect-all').addEventListener('click', deselectAll);
    document.getElementById('print-btn').addEventListener('click', printMap);
    if (cfg.svgExport) document.getElementById('svg-btn').addEventListener('click', exportSvg);
    initQr();
    initNamesToggle();
    document.getElementById('table-wrap').addEventListener('click', e => {
      const btn = e.target.closest('[data-show-id]');
      if (btn) return showOnMap(btn.dataset.showId);
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) toggleSort(sortBtn.dataset.sort);
    });
    document.getElementById('table-wrap').addEventListener('change', e => {
      if (e.target.id !== 'sort-select') return;
      sortState.key = e.target.value;
      sortState.dir = SORT_FIRST_DIR[sortState.key] || 1;
      buildTable(visibleTableData());
    });
    document.addEventListener('touchstart', hideTip, { passive: true });   // touch devices fire no mouseleave
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', cleanupPrint);

    try {
      [allData, layerMeta] = await Promise.all([fetchSheet(), fetchLayerMeta()]);
      allData.forEach((r, i) => { r._key = 'r' + i; });   // internal key for table -> marker (works without an Id column)
      filteredData = [...allData];
      const allLayers = layerNamesOf(allData);
      assignLayerColors(allLayers);
      initFilters();
      resolveFieldName('id');
      resolveFieldAny('rating');
      resolveFieldAny('reviews');
      detectTableCols();

      const wanted = getLayersFromURL();
      if (wanted) {
        const notFound = [];
        wanted.forEach(d => {
          const match = allLayers.find(l => l.toLowerCase() === d.toLowerCase());
          match ? activeLayers.add(match) : notFound.push(d);
        });
        if (notFound.length) {
          const warn = document.getElementById('deeplink-warning');
          warn.innerHTML = `<strong>⚠ ${escH(notFound.length > 1 ? S.layersNotFound : S.layerNotFound)}</strong> ${notFound.map(escH).join(', ')}`;
          warn.style.display = 'block';
        }
      }
      if (!activeLayers.size) defaultActiveLayers(allLayers).forEach(l => activeLayers.add(l));

      if (document.getElementById('loading-msg').textContent === S.loading) document.getElementById('loading-msg').textContent = '';
      render(true);
      document.getElementById('search-input').addEventListener('input', () => render(true));
    } catch (e) {
      document.getElementById('loading-msg').textContent = S.loadError;
      console.error(e);
    }
  }

  async function boot() {
    if (!Array.isArray(cfg.center) || cfg.center.length !== 2 || cfg.center.some(v => typeof v !== 'number' || isNaN(v))) {
      return showFatal('"center" must be [latitude, longitude].');
    }
    if (!cfg.sheet.id && !(cfg.fallbackData && cfg.fallbackData.length)) {
      return showFatal('"sheet.id" (Google Sheet id) is missing.');
    }
    applyTheme();
    showLoader();
    await loadStyles();     // never throws: a missing stylesheet or font must not block the map
    buildShell();
    try {
      await loadDependencies();
    } catch (e) {
      document.getElementById('loading-msg').textContent = S.loadError;
      console.error(e);
      return;
    }
    init();
  }

  boot();
})();
