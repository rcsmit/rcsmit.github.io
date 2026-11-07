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
   ========================================================================= */
const version = "20261107-110000";

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
    center: null,               // [lat, lon] — required
    zoom: 12,
    maxZoom: 19,
    sheet: { id: '', dataTab: 'MASTER', layersTab: 'LAYERS' },
    fields: { id: 'Id', category: 'Layer', name: 'naam', address: 'address', lon: 'LON', lat: 'LAT', website: 'website', remarks: 'remarks' },
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
    qr: { enabled: false, url: '' },   // url = fixed base address; empty = the address of the current page
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
      loading: 'Loading data…',
      demoData: '⚠ Using demo data — sheet unreachable',
      loadError: 'Error loading data. Check console.',
      noLayers: 'No layers selected — choose one or more from the sidebar.',
      layerNotFound: 'Layer not found:',
      layersNotFound: 'Layers not found:',
      colName: 'Name',
      colAddress: 'Address',
      colWebsite: 'Website',
      colRemarks: 'Remarks',
      activeLayers: 'Active layers:',
      source: 'Source:',
      googleMaps: 'Google Maps',
      searchOnGoogleMaps: 'Search on Google Maps',
      showOnMap: 'Show on map',
      collapseSidebar: 'Collapse sidebar',
      expandSidebar: 'Expand sidebar',
      disclaimerLabel: 'Disclaimer:',
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
  function shortUrl(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }

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
  async function loadDependencies() {
    const css = [loadCss(BASE_URL + 'citymap.css'), ...LIB_CSS.map(loadCss)];
    const fonts = fontsUrl();
    if (fonts) css.push(loadCss(fonts));
    await Promise.all(css);
    for (const src of LIB_JS) await loadScript(src);
    // The QR library is optional: if it cannot be loaded the map still works, just without QR codes.
    if (cfg.qr.enabled) {
      try { await loadScript(LIB_QR); } catch (e) { console.warn(e); cfg.qr.enabled = false; hideQrUi(); }
    }
  }

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

          <div class="section-label">${escH(S.mapStyle)}</div>
          <select id="basemap-select"></select>

          <div class="section-label with-badge">${escH(S.layers)} <span id="count-badge"></span></div>
          <div id="sel-controls">
            <button class="sel-btn" id="btn-select-all" type="button">${escH(S.selectAll)}</button>
            <button class="sel-btn" id="btn-deselect-all" type="button">${escH(S.deselectAll)}</button>
          </div>
          <ul id="layer-list"></ul>
          <div id="loading-msg">${escH(S.loading)}</div>
          <button id="print-btn" type="button" title="${escH(S.printTitle)}">${escH(S.printButton)}</button>
          ${cfg.qr.enabled ? `<button id="qr-btn" class="side-btn" type="button">${escH(S.qrButton)}</button>` : ''}
        </div>
        ${cfg.disclaimer ? `<div id="disclaimer"><strong>⚠ ${escH(S.disclaimerLabel)}</strong> ${escH(cfg.disclaimer)}</div>` : ''}
      </aside>
      <div id="main">
        <div id="map"></div>
        <div id="no-layers-msg">${escH(S.noLayers)}</div>
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
  const activeLayers = new Set();
  const layerColors = {};
  let clusterGroups = {};
  const markersById = {};          // rowId -> { marker, cluster, lat, lon }
  let basemapLayer = null;         // L.maplibreGL layer
  let basemapSeq = 0;              // guards against out-of-order async style loads
  const sidebarCtl = {};           // filled by initSidebar()
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
      const data = csvToObjects(await res.text()).filter(r => r[F.name]);
      if (!data.length) throw new Error('Empty sheet response');
      return data;
    } catch (e) {
      console.warn('Sheet fetch failed:', e);
      if (cfg.fallbackData && cfg.fallbackData.length) {
        document.getElementById('loading-msg').textContent = S.demoData;
        return cfg.fallbackData;
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
    map = L.map('map', { center: cfg.center, zoom: cfg.zoom, maxZoom: cfg.maxZoom });
    // Keep the bottom table in sync with what is actually visible.
    map.on('moveend', () => buildTable(visibleTableData()));
    // Recompute popup width at the moment each popup opens (viewport may have been resized/rotated).
    map.on('popupopen', e => {
      const p = e.popup;
      if (!p || !p.options) return;
      p.options.maxWidth = popupMaxWidth();
      p.update();
    });
    initBasemap();
  }

  function fitMapToVisible(data) {
    const pts = data.filter(r => activeLayers.has(r[F.category]))
      .map(r => [toFloat(r[F.lat]), toFloat(r[F.lon])]).filter(([a, o]) => !isNaN(a) && !isNaN(o));
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], 15); return; }
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }

  // Exact coordinates give a precise pin; name + address is the fallback.
  function mapsUrlFor(row) {
    const lat = toFloat(row[F.lat]), lon = toFloat(row[F.lon]);
    if (!isNaN(lat) && !isNaN(lon)) return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    const q = [row[F.name], row[F.address]].filter(Boolean).join(' ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
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
    filteredData.forEach(r => { if (r[F.category]) activeLayers.add(r[F.category]); });
    render(true);
  }
  function deselectAll() { clearDeeplinkWarning(); activeLayers.clear(); render(true); }

  function layerNamesOf(data) { return [...new Set(data.map(r => r[F.category]).filter(Boolean))]; }

  // ── MARKERS ─────────────────────────────────────────────────────────────────
  function popupHtml(row) {
    const site = safeUrl(row[F.website]);
    return `<div class="popup-body">
        <div class="popup-name">${escH(row[F.name])}</div>
        <div class="popup-addr">${escH(row[F.address])}</div>
        ${row[F.remarks] ? `<div class="popup-remark">${escH(row[F.remarks])}</div>` : ''}
        ${site ? `<a class="popup-link" href="${escH(site)}" target="_blank" rel="noopener noreferrer">🌐 ${escH(row[F.website])}</a>` : ''}
        <a class="popup-link" href="${escH(mapsUrlFor(row))}" target="_blank" rel="noopener noreferrer">📍 ${escH(S.googleMaps)}</a>
        ${cfg.popupWarning ? `<div class="popup-warn">ℹ ${escH(cfg.popupWarning)}</div>` : ''}
        <div class="popup-cat">${escH(row[F.category])}</div>
      </div>`;
  }

  function buildLayers(data) {
    Object.values(clusterGroups).forEach(g => map.removeLayer(g));
    clusterGroups = {};
    Object.keys(markersById).forEach(k => delete markersById[k]);

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
          .bindPopup(popup).bindTooltip(row[F.name], { direction: 'top', offset: [0, -6] })
          .addTo(cluster);
        if (row[F.id]) markersById[row[F.id]] = { marker, cluster, lat, lon };
      });

      cluster.addTo(map);
      clusterGroups[layer] = cluster;
    });
  }

  // Called from the table row icon: zoom to the place and open its popup.
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
  function buildSidebar(data) {
    const ul = document.getElementById('layer-list');
    ul.innerHTML = '';
    layerNamesOf(data).forEach(layer => {
      const li = document.createElement('li');
      const on = activeLayers.has(layer);
      if (on) li.classList.add('active');
      li.innerHTML = `
        <span class="layer-dot" style="background:${layerColors[layer]}"></span>
        <span class="layer-name">${escH(layer)}</span>
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
  function buildTable(data) {
    const wrap = document.getElementById('table-wrap');
    wrap.innerHTML = '';
    layerNamesOf(data).forEach(layer => {
      if (!activeLayers.has(layer)) return;
      const rows = data.filter(r => r[F.category] === layer);
      if (!rows.length) return;
      const color = layerColors[layer] || '#333';
      const meta = layerMeta[layer] || {};

      const title = document.createElement('div');
      title.className = 'table-section-title';
      title.innerHTML =
        `<div class="ts-name" style="color:${color}">${escH(layer)}</div>` +
        (meta.description ? `<div class="ts-meta">${escH(meta.description)}</div>` : '') +
        (meta.source      ? `<div class="ts-source">${escH(S.source)} ${escH(meta.source)}</div>` : '');
      wrap.appendChild(title);

      const tbl = document.createElement('table');
      tbl.innerHTML = `<colgroup><col class="col-name"><col class="col-address"><col class="col-website"><col class="col-remarks"><col class="col-actions"></colgroup>
        <thead><tr><th>${escH(S.colName)}</th><th>${escH(S.colAddress)}</th><th>${escH(S.colWebsite)}</th><th>${escH(S.colRemarks)}</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      rows.forEach(r => {
        const lat = toFloat(r[F.lat]), lon = toFloat(r[F.lon]);
        const hasCoords = !isNaN(lat) && !isNaN(lon);
        const site = safeUrl(r[F.website]);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escH(r[F.name])}</td>
          <td>${escH(r[F.address])}</td>
          <td class="td-website" title="${escH(r[F.website])}">${site ? `<a href="${escH(site)}" target="_blank" rel="noopener noreferrer">${escH(shortUrl(site))}</a>` : ''}</td>
          <td>${escH(r[F.remarks])}</td>
          <td class="td-actions">
            <a class="row-icon" href="${escH(mapsUrlFor(r))}" target="_blank" rel="noopener noreferrer" title="${escH(S.searchOnGoogleMaps)}">🔍</a>
            ${hasCoords && r[F.id] ? `<button type="button" class="row-icon" data-show-id="${escH(r[F.id])}" title="${escH(S.showOnMap)}">📍</button>` : ''}
          </td>`;
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      wrap.appendChild(tbl);
    });
  }

  // Only rows inside the current map viewport are listed in the bottom panel.
  function visibleTableData() {
    let bounds;
    try { bounds = map.getBounds(); } catch (e) { return filteredData; }
    return filteredData.filter(r => {
      const lat = toFloat(r[F.lat]), lon = toFloat(r[F.lon]);
      return !isNaN(lat) && !isNaN(lon) && bounds.contains([lat, lon]);
    });
  }

  // ── QR CODE ─────────────────────────────────────────────────────────────────
  function hideQrUi() { ['qr-btn', 'qr-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); }); }

  // Address of this map including the active layers, so a scan reproduces what is on screen.
  function qrTargetUrl() {
    const base = cfg.qr.url || (window.location.origin + window.location.pathname);
    const u = new URL(base, window.location.href);
    u.search = '';
    if (activeLayers.size) u.searchParams.set('layer', [...activeLayers].join(','));
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
    layerNames.forEach(layer => {
      const color = layerColors[layer] || '#333';
      html += `<div class="pl-section"><div class="pl-section-title" style="color:${color}">${escH(layer)}</div><table class="pl-table"><tbody>`;
      list.filter(e => e.layer === layer).forEach(({ number, row }) => {
        html += `<tr>
          <td style="width:24px"><span class="pl-num" style="background:${color}">${number}</span></td>
          <td style="width:22%">${escH(row[F.name])}</td>
          <td style="width:30%">${escH(row[F.address])}</td>
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
  function applySearch() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const keys = [F.category, F.name, F.address, F.website, F.remarks];
    filteredData = q ? allData.filter(r => keys.some(k => (r[k] || '').toLowerCase().includes(q))) : [...allData];
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

  // ── DRAG TO RESIZE THE TABLE PANEL ──────────────────────────────────────────
  function initDragHandle() {
    const handle = document.getElementById('drag-handle');
    const panel  = document.getElementById('table-panel');
    const main   = document.getElementById('main');
    let dragging = false, startY = 0, startH = 0;

    function start(y) { dragging = true; startY = y; startH = panel.offsetHeight; }
    function move(y) {
      if (!dragging) return;
      const maxH = main.offsetHeight - 80;           // leave at least 80px for the map
      panel.style.height = Math.min(maxH, Math.max(40, startH + (startY - y))) + 'px';
      map.invalidateSize();
    }
    function stop() { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }

    handle.addEventListener('mousedown', e => {
      start(e.clientY);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    handle.addEventListener('touchstart', e => { start(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
    document.addEventListener('mousemove', e => move(e.clientY));
    document.addEventListener('touchmove', e => { if (dragging) move(e.touches[0].clientY); }, { passive: true });
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop);
  }

  // ── START ───────────────────────────────────────────────────────────────────
  async function init() {
    initSidebar();
    initMap();
    initDragHandle();

    document.getElementById('btn-select-all').addEventListener('click', selectAll);
    document.getElementById('btn-deselect-all').addEventListener('click', deselectAll);
    document.getElementById('print-btn').addEventListener('click', printMap);
    initQr();
    document.getElementById('table-wrap').addEventListener('click', e => {
      const btn = e.target.closest('[data-show-id]');
      if (btn) showOnMap(btn.dataset.showId);
    });
    document.addEventListener('touchstart', hideTip, { passive: true });   // touch devices fire no mouseleave
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', cleanupPrint);

    try {
      [allData, layerMeta] = await Promise.all([fetchSheet(), fetchLayerMeta()]);
      filteredData = [...allData];
      const allLayers = layerNamesOf(allData);
      assignLayerColors(allLayers);

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
