/* ═══════════════════════════════════════════════════════════
   MAP  — Leaflet initialisation, markers, clusters, labels
   ═══════════════════════════════════════════════════════════ */

/** Convert a hex colour + alpha to rgba(). */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Lazy-initialise the Leaflet map (called the first time the Map tab is opened). */
function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  map = L.map('map', {
    center:  CONFIG.MAP_CENTER,
    zoom:    CONFIG.MAP_ZOOM,
    minZoom: CONFIG.MAP_MIN_ZOOM,
    maxZoom: CONFIG.MAP_MAX_ZOOM,
  });

  L.tileLayer(CONFIG.TILE_URL, {
    attribution: CONFIG.TILE_ATTR,
    subdomains:  CONFIG.TILE_SUBS,
    maxZoom:     CONFIG.TILE_MAXZ,
  }).addTo(map);

  cluster = L.markerClusterGroup({
    maxClusterRadius:       CONFIG.CLUSTER_RADIUS,
    spiderfyOnMaxZoom:      CONFIG.CLUSTER_SPIDER,
    showCoverageOnHover:    false,
    zoomToBoundsOnClick:    true,
    disableClusteringAtZoom: CONFIG.CLUSTER_UNCLUSTR,
    chunkedLoading: true,
    iconCreateFunction(cl) {
      const children = cl.getAllChildMarkers();
      const count    = children.length;
      const tally    = {};
      children.forEach(m => {
        const l = markerLayerMap.get(m) || '_';
        tally[l] = (tally[l] || 0) + 1;
      });
      let dom = null, mx = 0;
      for (const [l, c] of Object.entries(tally)) { if (c > mx) { mx = c; dom = l; } }
      const color = dom ? (lColors[dom] || CONFIG.COLORS[0]) : CONFIG.COLORS[0];
      const size  = count < 10 ? 36 : count < 100 ? 44 : 52;
      const inner = size - 10;
      return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${hexToRgba(color, .18)};display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px ${hexToRgba(color, .35)};"><div style="width:${inner}px;height:${inner}px;border-radius:50%;background:${hexToRgba(color, .85)};display:flex;align-items:center;justify-content:center;font-family:var(--font-body);font-size:${count >= 100 ? 10 : 12}px;font-weight:700;color:#fff;">${count}</div></div>`,
        className: '',
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    },
  });

  labelLayer = L.layerGroup();
  map.addLayer(cluster);
  map.addLayer(labelLayer);
  map.on('zoomend', syncLabels);
  redrawMap();
}

/** Create a small SVG dot icon for a single marker. */
function mkDotIcon(color, big) {
  const r  = big ? 7 : 5;
  const sw = big ? 2 : 1.5;
  const d  = (r + sw) * 2;
  return L.divIcon({
    html: `<div style="filter:drop-shadow(0 1px 4px rgba(0,0,0,.3))"><svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}"><circle cx="${r + sw}" cy="${r + sw}" r="${r}" fill="${color}" stroke="rgba(255,255,255,.85)" stroke-width="${sw}"/></svg></div>`,
    className:   '',
    iconSize:    [d, d],
    iconAnchor:  [r + sw, r + sw],
    popupAnchor: [0, -(r + sw + 4)],
  });
}

/** Add a single row as a marker (+ optional label) to the cluster layer. */
function addMarker(row) {
  if (!isFinite(row._lat) || !isFinite(row._lon)) return;
  const sl  = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
  const col = sl ? CONFIG.SL_COLOR : (lColors[row._layer] || '#888');
  const m   = L.marker([row._lat, row._lon], { icon: mkDotIcon(col, sl) });
  m.bindPopup(mkMapPopupHtml(row), { maxWidth: 320 });
  markerLayerMap.set(m, row._layer);
  cluster.addLayer(m);

  if (CONFIG.SHOW_LABELS) {
    const name = (row[CONFIG.COL_NAME] || '').trim();
    if (name) {
      labelLayer.addLayer(L.marker([row._lat, row._lon], {
        icon: L.divIcon({
          html:      `<div class="mk-lbl">${escHtml(name)}</div>`,
          className: '',
          iconSize:   [0, 0],
          iconAnchor: [0, -4],
        }),
        interactive:   false,
        zIndexOffset: -9999,
      }));
    }
  }
}

/** Clear and redraw all markers from the current visible rows. */
function redrawMap() {
  if (!mapInitialized) return;
  cluster.clearLayers();
  labelLayer.clearLayers();
  visibleRows().forEach(r => addMarker(r));
  syncLabels();
}

/** Show/hide labels based on current zoom level. */
function syncLabels() {
  if (!mapInitialized || !CONFIG.SHOW_LABELS) return;
  const show = map.getZoom() >= CONFIG.LABEL_MIN_ZOOM;
  document.querySelectorAll('.mk-lbl').forEach(el => { el.style.display = show ? '' : 'none'; });
}

window.addEventListener('resize', () => {
  if (currentView === 'map' && map) map.invalidateSize();
});

/* ── Map popup HTML ──────────────────────────────────────── */

/**
 * Build the HTML string for a Leaflet popup.
 * All user data is escaped through escHtml before insertion.
 */
function mkMapPopupHtml(row) {
  const n   = (row[CONFIG.COL_NAME]      || '').trim() || '(unnamed)';
  const ctr = (row[CONFIG.COL_COUNTRY]   || '').trim();
  const prv = (row[CONFIG.COL_PROVINCE]  || '').trim();
  const cnt = (row[CONFIG.COL_CONTINENT] || '').trim();
  const cat = (row[CONFIG.COL_CATEGORY]  || '').trim();
  const sl  = ['yes', '1', 'true', 'x', '✓'].includes(String(row[CONFIG.COL_SHORTLIST] || '').toLowerCase());
  const loc = [prv, ctr, cnt].filter(Boolean).join(', ');
  const dr  = fmtDateRange(row);
  const c   = lColors[row._layer] || '#f19072';
  const idx = rows.indexOf(row);

  return `<div class="mpb">
    <div class="mpb-cats">
      ${cnt ? `<span class="mpb-cat" style="background:${c}22;color:${c}">${escHtml(cnt)}</span>` : ''}
      ${cat ? `<span class="mpb-cat">${etIcon(cat)} ${escHtml(cat)}</span>`                      : ''}
    </div>
    <div class="mpb-name" onclick="openEventFromMap(${idx})">${escHtml(n)}</div>
    ${loc ? `<div class="mpb-loc">📍 ${escHtml(loc)}</div>`  : ''}
    ${dr  ? `<div class="mpb-date">📅 ${escHtml(dr)}</div>`  : ''}
    ${sl  ? `<div class="mpb-sl">⭐ Shortlisted</div>`        : ''}
    <span class="mpb-more" onclick="openEventFromMap(${idx})">View details →</span>
  </div>`;
}

/** Open the event detail modal from a map popup click. */
function openEventFromMap(idx) { openEventModal(rows[idx]); }
