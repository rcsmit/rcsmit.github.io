/* ═══════════════════════════════════════════════════════════
   CONFIG  — one file for all tenants.
   ↓ THIS IS THE ONLY LINE THAT CHANGES PER TENANT ↓
   ═══════════════════════════════════════════════════════════ */
// const TENANT_CONFIG_FILE_ = 'acroinsiders.config.json';
const TENANT_CONFIG_FILE_ = 'karaokeevents.config.json';
// const TENANT_CONFIG_FILE_ = 'bailaconmigo.config.json';


const TENANT_CONFIG_FILE = window.TENANT_CONFIG_OVERRIDE || TENANT_CONFIG_FILE_;

/* ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ ↑ */

/**
 * Populated by loadTenantConfig() before any other script runs.
 * Shape mirrors the old CONFIG object so all existing JS works unchanged.
 */
let CONFIG = {};

/* ═══════════════════════════════════════════════════════════
   SHARED STATE  — mutated by data.js, read everywhere
   ═══════════════════════════════════════════════════════════ */
let rows            = [];
let actL            = new Set();
let actET           = new Set();
let lColors         = {};
let qStr            = '';
let dateFrom        = null;
let dateTo          = null;
const hideEnded     = true;
let filterContinent = '';
let filterCountry   = '';
let filterDeals     = false;
let listPage        = 1;
let calYear         = new Date().getFullYear();
let calMonth        = new Date().getMonth();
let currentView     = 'list';
let map             = null;
let cluster         = null;
let labelLayer      = null;
let mapInitialized  = false;
const markerLayerMap = new WeakMap();

/* ═══════════════════════════════════════════════════════════
   TENANT CONFIG LOADER
   ═══════════════════════════════════════════════════════════ */

/**
 * Fetch the tenant JSON, build the legacy CONFIG object from it,
 * apply CSS variables, load Google Fonts, and return the raw cfg.
 *
 * @param {string} [jsonPath='acroinsiders.config.json']
 * @returns {Promise<object>} the raw tenant config
 */
async function loadTenantConfig(jsonPath = TENANT_CONFIG_FILE) {
  /* Reset all shared state so switching tenants never shows stale data */
  rows            = [];
  actL            = new Set();
  actET           = new Set();
  lColors         = {};
  qStr            = '';
  dateFrom        = null;
  dateTo          = null;
  filterContinent = '';
  filterCountry   = '';
  filterDeals     = false;
  listPage        = 1;
  calYear         = new Date().getFullYear();
  calMonth        = new Date().getMonth();
  currentView     = 'list';
  map             = null;
  cluster         = null;
  labelLayer      = null;
  mapInitialized  = false;

  const cfg = await fetch(jsonPath).then(r => {
    if (!r.ok) throw new Error(`Config fetch failed: ${r.status}`);
    return r.json();
  });

  _buildLegacyConfig(cfg);
  _applyCSSVars(cfg);
  _loadGoogleFonts(cfg);

  return cfg;
}

/* ── Internal: map JSON → legacy CONFIG keys ─────────────── */
function _buildLegacyConfig(cfg) {
  const ds  = cfg.data_source;
  const col = ds.columns;
  const v   = cfg.views;

  CONFIG = {
    /* ── Data source ─────────────────────────────────────── */
    SHEET_ID_ENC:  ds.fallback_sheet_id  || '',
    SHEET_TAB_ENC: ds.fallback_sheet_tab || 'data',
    WORKER_URL:    ds.worker_url         || '',

    /* ── Column names ────────────────────────────────────── */
    COL_LAYER:        col.continent,
    COL_LAT:          col.lat,
    COL_LON:          col.lon,
    COL_NAME:         col.name,
    COL_REMARKS:      col.description,
    COL_CONTINENT:    col.continent,
    COL_COUNTRY:      col.country,
    COL_CITY:         col.city,
    COL_PROVINCE:     col.state,
    COL_SHORTLIST:    col.sticky,
    COL_START:        col.start_date,
    COL_END:          col.end_date,
    COL_CATEGORY:     col.category,
    COL_INSIDER_DEALS: col.insider_deals || '',  /* set in data_source.columns.insider_deals */
    COL_URL:          col.url,

    /* ── Map defaults ────────────────────────────────────── */
    MAP_CENTER:   [v.map.default_lat,  v.map.default_lon],
    MAP_ZOOM:     v.map.default_zoom,
    MAP_MIN_ZOOM: 2,
    MAP_MAX_ZOOM: 18,
    TILE_URL:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    TILE_ATTR: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    TILE_SUBS: 'abcd',
    TILE_MAXZ: 20,
    SHOW_LABELS:       true,
    LABEL_MIN_ZOOM:    6,
    CLUSTER_RADIUS:    60,
    CLUSTER_SPIDER:    true,
    CLUSTER_UNCLUSTR:  12,

    /* ── Colours ─────────────────────────────────────────── */
    COLORS: [
      '#f19072','#12807a','#9B59B6','#2980B9','#E74C3C',
      '#27AE60','#F0A500','#16A085','#8E44AD','#34495E',
      '#D35400','#1ABC9C','#C0392B','#6C7A89','#F39C12',
      '#6C3483','#1A5276','#117A65','#7D6608','#154360',
      '#922B21','#1E8449','#5B2C6F','#0E6655','#7E5109',
      '#4A235A','#0B5345','#784212','#2C3E50','#616A6B',
    ],
    SL_COLOR: cfg.branding.colors.primary,

    /* ── List / pagination ───────────────────────────────── */
    PAGE_SIZE:     v.list.page_size     || 9,
    MIN_PAGE_SIZE: v.list.min_page_size || 9,

    /* ── Categories (array for ET_ORDER, object for icons) ─ */
    CATEGORIES: cfg.categories,

    /* ── Content labels ──────────────────────────────────── */
    LABELS: cfg.content.labels,

    /* ── Sharing ─────────────────────────────────────────── */
    SHARING: cfg.sharing,

    /* ── Submission ──────────────────────────────────────── */
    SUBMISSION: cfg.submission,

    /* ── Tenant meta ─────────────────────────────────────── */
    TENANT: cfg.tenant,

    /* ── Views config ────────────────────────────────────── */
    VIEWS: cfg.views,

    /* ── Cat picks ───────────────────────────────────────── */
    CAT_PICKS_LABEL: v.list.cat_picks_label || "Picks",
    CAT_PICKS_FIELD: v.list.cat_picks_field || 'sticky',
    CAT_PICKS_ICON:  v.list.cat_picks_icon  || '⭐',
  };
}

/* ── Internal: write CSS custom properties from branding ─── */
function _applyCSSVars(cfg) {
  const b    = cfg.branding;
  const root = document.documentElement;

  root.style.setProperty('--p1',       b.colors.primary);
  root.style.setProperty('--p2',       b.colors.secondary);
  root.style.setProperty('--p5',       b.colors.muted);
  root.style.setProperty('--p6',       b.colors.border);
  root.style.setProperty('--p1-light', b.colors.primary_light);
  root.style.setProperty('--p2-dark',  b.colors.secondary_dark);
  root.style.setProperty('--card-bg',  b.colors.card_background);

  /* --p7: light primary tint used for header border, hover bg, cat-pick accents */
  root.style.setProperty('--p7',  b.colors.primary_light);

  /* --p8: page background — the warm off-white that defines the site feel */
  root.style.setProperty('--p8',  b.colors.background);
  root.style.setProperty('--bg',  b.colors.background);   /* alias kept for safety */

  /* --p9: card / surface background */
  root.style.setProperty('--p9',  b.colors.card_background);

  /* text colours */
  root.style.setProperty('--text', b.colors.text);

  root.style.setProperty('--font-heading', `'${b.fonts.heading}', serif`);
  root.style.setProperty('--font-body',    `'${b.fonts.body}', sans-serif`);

  /* page title — from tenant.name + tenant.tagline */
  document.title = cfg.tenant.name + ' – ' + (cfg.tenant.tagline || 'Events');

  /* overlay title — split CamelCase name into two tones, e.g. "Acro<span>Insiders</span>" */
  const ovTitle = document.getElementById('ov-title');
  if (ovTitle) {
    const name  = cfg.tenant.name;
    const split = name.slice(1).search(/[A-Z]/) + 1; // index of second capital
    if (split > 0) {
      ovTitle.innerHTML = name.slice(0, split) + '<span>' + name.slice(split) + '</span>';
    } else {
      ovTitle.textContent = name;
    }
  }
}

/* ── Internal: inject Google Fonts <link> dynamically ───── */
function _loadGoogleFonts(cfg) {
  const { heading, body } = cfg.branding.fonts;
  const encHead = heading.replace(/ /g, '+');
  const encBody = body.replace(/ /g, '+');
  const href = `https://fonts.googleapis.com/css2?family=${encHead}:wght@400;700&family=${encBody}:wght@300;400;600;700&display=swap`;

  /* Skip if already loaded */
  if (document.querySelector(`link[href="${href}"]`)) return;

  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
