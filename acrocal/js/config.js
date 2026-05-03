/* ═══════════════════════════════════════════════════════════
   CONFIG  — the only section you ever need to change
   ═══════════════════════════════════════════════════════════ */
const CONFIG = {
  /* Google Sheet */
  SHEET_ID_ENC:  '132gCPu46DkXTJk1Yy5RmuKcijMBm7_PPqQjRm_7AbG4',
  SHEET_TAB_ENC: 'data',

  /* Column names (must match sheet header row exactly) */
  COL_LAYER:     'CONTINENT',
  COL_LAT:       'LAT',
  COL_LON:       'LON',
  COL_NAME:      'EVENT NAME',
  COL_REMARKS:   'EVENT DESCRIPTION',
  COL_CONTINENT: 'CONTINENT',
  COL_COUNTRY:   'COUNTRY',
  COL_PROVINCE:  'STATE',
  COL_SHORTLIST: 'STICKY IN MONTH VIEW',
  COL_START:     'EVENT START DATE',
  COL_END:       'EVENT END DATE',
  COL_CATEGORY:  'EVENT CATEGORY',

  /* Map defaults */
  MAP_CENTER:   [20, 10],
  MAP_ZOOM:     2,
  MAP_MIN_ZOOM: 2,
  MAP_MAX_ZOOM: 18,
  TILE_URL:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  TILE_ATTR: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  TILE_SUBS: 'abcd',
  TILE_MAXZ: 20,
  SHOW_LABELS:      true,
  LABEL_MIN_ZOOM:   6,
  CLUSTER_RADIUS:   60,
  CLUSTER_SPIDER:   true,
  CLUSTER_UNCLUSTR: 12,

  /* Layer colours (30 fixed, cycles if more layers) */
  COLORS: [
    '#f19072','#12807a','#9B59B6','#2980B9','#E74C3C',
    '#27AE60','#F0A500','#16A085','#8E44AD','#34495E',
    '#D35400','#1ABC9C','#C0392B','#6C7A89','#F39C12',
    '#6C3483','#1A5276','#117A65','#7D6608','#154360',
    '#922B21','#1E8449','#5B2C6F','#0E6655','#7E5109',
    '#4A235A','#0B5345','#784212','#2C3E50','#616A6B',
  ],
  SL_COLOR:  '#f19072',   /* shortlisted event accent colour */
  PAGE_SIZE: 10,          /* list-view cards per page */
};

/* ═══════════════════════════════════════════════════════════
   SHARED STATE  — mutated by data.js, read everywhere
   ═══════════════════════════════════════════════════════════ */
let rows          = [];
let actL          = new Set();
let actET         = new Set();
let lColors       = {};
let qStr          = '';
let dateFrom      = null;
let dateTo        = null;
const hideEnded   = true;   // always hide past events
let filterContinent = '';
let filterCountry   = '';
let listPage      = 1;
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();
let currentView   = 'list';
let map           = null;
let cluster       = null;
let labelLayer    = null;
let mapInitialized = false;
const markerLayerMap = new WeakMap();
