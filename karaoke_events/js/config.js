/* ═══════════════════════════════════════════════════════════
   CONFIG  — KaraokeEvents
   ═══════════════════════════════════════════════════════════ */
const CONFIG = {
  /* Google Sheet — replace SHEET_ID_ENC with your sheet's ID */
  SHEET_ID_ENC:  '1NPhe1oeFG0LvlyJ8O6N9ZeUlLmdS5TrEfcbwl087PKo',
  SHEET_TAB_ENC: 'data',

  /* Column names (must match sheet header row exactly) */
  COL_LAYER:     'CONTINENT',
  COL_LAT:       'LAT',
  COL_LON:       'LON',
  COL_NAME:      'EVENT NAME',
  COL_REMARKS:   'EVENT DESCRIPTION',
  COL_CONTINENT: 'CONTINENT',
  COL_COUNTRY:   'COUNTRY',
  COL_CITY:      'CITY',
  COL_PROVINCE:  'STATE',
  COL_SHORTLIST: 'FEATURED',
  COL_START:     'EVENT START DATE',
  COL_END:       'EVENT END DATE',
  COL_CATEGORY:  'EVENT CATEGORY',
  COL_INSIDER_DEALS: 'SPECIAL OFFER',
  COL_URL:       'URL',

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

  /* Purple/neon colour palette — 30 fixed */
  COLORS: [
    '#c850c0','#7b2ff7','#ff6b6b','#ffd93d','#6bcb77',
    '#4d96ff','#ff922b','#be4bdb','#2f9e44','#e64980',
    '#0ca678','#f76707','#4263eb','#a61e4d','#0b7285',
    '#862e9c','#5c940d','#c92a2a','#1864ab','#d9480f',
    '#5f3dc4','#087f5b','#a61e4d','#364fc7','#66a80f',
    '#c92a2a','#1864ab','#e67700','#343a40','#868e96',
  ],
  SL_COLOR:  '#c850c0',   /* featured event accent — hot purple */
  PAGE_SIZE: 12,
};

/* ═══════════════════════════════════════════════════════════
   SHARED STATE
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
