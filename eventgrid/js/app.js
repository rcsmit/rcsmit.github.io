/* ═══════════════════════════════════════════════════════════
   APP  — view switching, global event listeners, entry point
   ═══════════════════════════════════════════════════════════ */

function setView(v) {
  currentView = v;
  ['map', 'list', 'cal'].forEach(id => {
    const el = document.getElementById('view-' + id);
    if (el) el.classList.toggle('hidden', id !== v);
  });
  document.querySelectorAll('.vt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('vt-' + v).classList.add('active');
  if (v === 'map')  { initMap(); setTimeout(() => map && map.invalidateSize(), 50); }
  if (v === 'list') { listPage = 1; renderList(); }
  if (v === 'cal')  { renderCalendar(); }
}

function toggleMenu() { document.getElementById('hmenu').classList.toggle('open'); }
function closeMenu()  { document.getElementById('hmenu').classList.remove('open'); }

document.addEventListener('click', e => {
  const w = document.getElementById('hmenu-wrap');
  if (w && !w.contains(e.target)) closeMenu();
});

document.getElementById('q').addEventListener('input', function () {
  qStr = this.value.trim();
  redraw();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMenu();
    closeModal('info');
    closeModal('credits');
    closeCalPopup();
    closeEventModal();
  }
});

function applyUILabels(cfg) {
  const L = cfg.content.labels;
  const q = document.getElementById('q');
  if (q && L.search_placeholder) q.placeholder = L.search_placeholder;
  const vLabels = {
    'vt-list': L.list_view     || 'List',
    'vt-cal':  L.calendar_view || 'Calendar',
    'vt-map':  L.map_view      || 'Map',
  };
  Object.entries(vLabels).forEach(([id, txt]) => {
    const el = document.getElementById(id);
    if (el) { const span = el.querySelector('.vt-label'); if (span) span.textContent = txt; }
  });
}

/* ── Boot — loadTenantConfig() MUST finish before init() ─── */
(async function boot() {
  try {
    const cfg = await loadTenantConfig();   /* TENANT_CONFIG_FILE set in config.js */
    applyUILabels(cfg);
  } catch (err) {
    console.error('[App] Config load failed — check TENANT_CONFIG_FILE path:', err);
  }
  init();   /* runs after await — CONFIG is fully populated */
})();
