/* ═══════════════════════════════════════════════════════════
   APP  — view switching, global event listeners, entry point
   ═══════════════════════════════════════════════════════════ */

/** Switch between 'map', 'list', and 'cal' views. */
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

/* ── Hamburger menu ──────────────────────────────────────── */
function toggleMenu() { document.getElementById('hmenu').classList.toggle('open'); }
function closeMenu()  { document.getElementById('hmenu').classList.remove('open'); }

document.addEventListener('click', e => {
  const w = document.getElementById('hmenu-wrap');
  if (w && !w.contains(e.target)) closeMenu();
});

/* ── Search ──────────────────────────────────────────────── */
document.getElementById('q').addEventListener('input', function () {
  qStr = this.value.trim();
  redraw();
});

/* ── Keyboard shortcuts ──────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeMenu();
    closeModal('info');
    closeModal('credits');
    closeCalPopup();
    closeEventModal();
  }
});

/* ── Boot ────────────────────────────────────────────────── */
init();
