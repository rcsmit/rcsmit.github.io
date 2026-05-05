/* ═══════════════════════════════════════════════════════════
   CALENDAR VIEW  — monthly grid + floating popup
   ═══════════════════════════════════════════════════════════ */

const CAL_DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CAL_MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

/**
 * Build a Map from row → colour index by walking visibleRows() in order.
 * Each event gets the next colour in CONFIG.COLORS (cycles after 30).
 * Shortlisted events always use CONFIG.SL_COLOR.
 * Called once per renderCalendar() so the colour is stable within a render.
 */
function buildCalColorMap() {
  const SL = new Set(['yes', '1', 'true', 'x', '✓']);
  const map = new Map();
  let i = 0;
  visibleRows().forEach(row => {
    const sl = SL.has(String(row[CONFIG.COL_SHORTLIST] || '').trim().toLowerCase());
    map.set(row, sl ? CONFIG.SL_COLOR : CONFIG.COLORS[i++ % CONFIG.COLORS.length]);
  });
  return map;
}

function calEventColor(row, colorMap) {
  return colorMap.get(row) || CONFIG.COLORS[0];
}

/** Navigate to the previous month. */
function calPrev()    { calMonth--; if (calMonth < 0)  { calMonth = 11; calYear--; } renderCalendar(); }
/** Navigate to the next month. */
function calNext()    { calMonth++; if (calMonth > 11) { calMonth = 0;  calYear++; } renderCalendar(); }
/** Jump the calendar to today's month. */
function calGoToday() { calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); renderCalendar(); }

/** Render the full calendar grid for the current calYear / calMonth. */
function renderCalendar() {
  document.getElementById('cal-month-title').textContent = `${CAL_MONTHS[calMonth]} ${calYear}`;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Build colour map once — one colour per visible event, walking CONFIG.COLORS in order.
  const colorMap = buildCalColorMap();

  // Day-of-week headers
  CAL_DAYS.forEach(d => {
    const h = document.createElement('div');
    h.className   = 'cal-dow';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay   = new Date(calYear, calMonth, 1);
  const lastDay    = new Date(calYear, calMonth + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;   // Monday-based week
  const today       = new Date();
  const todayKey    = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Build event map: key → array of rows that span that day
  const evMap = {};
  visibleRows().forEach(row => {
    const rs = parseDate(row[CONFIG.COL_START]);
    const re = parseDate(row[CONFIG.COL_END]) || rs;
    if (!rs) return;
    const loopStart = new Date(Math.max(rs.getTime(),           new Date(calYear, calMonth, 1).getTime()));
    const loopEnd   = new Date(Math.min((re || rs).getTime(),   new Date(calYear, calMonth + 1, 0).getTime()));
    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() !== calMonth || d.getFullYear() !== calYear) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!evMap[key]) evMap[key] = [];
      if (!evMap[key].includes(row)) evMap[key].push(row);
    }
  });

  // No events in this specific month — show message inside the grid
  if (!Object.keys(evMap).length) {
    const msg = document.createElement('div');
    msg.style.cssText = 'grid-column:1/-1;text-align:center;padding:3rem 1rem;color:var(--p5);';
    msg.innerHTML =
      '<div style="font-size:2rem;margin-bottom:.75rem">🤸</div>'
      + `<div style="font-family:var(--font-heading);font-size:1.1rem;font-weight:700;color:var(--p3);margin-bottom:.4rem">No events in ${CAL_MONTHS[calMonth]} ${calYear}</div>`
      + '<div style="font-size:13px">Try navigating to another month or widening your filters.</div>';
    grid.appendChild(msg);
    return;
  }

  // Leading empty cells (days from previous month)
  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    const num = document.createElement('span');
    num.className   = 'cal-day-num';
    num.textContent = new Date(calYear, calMonth, -startOffset + i + 1).getDate();
    cell.appendChild(num);
    grid.appendChild(cell);
  }

  // Day cells
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const key       = `${calYear}-${calMonth}-${d}`;
    const cell      = document.createElement('div');
    cell.className  = 'cal-cell' + (key === todayKey ? ' today' : '');
    const num       = document.createElement('span');
    num.className   = 'cal-day-num';
    num.textContent = d;
    cell.appendChild(num);

    const dayEvents = evMap[key] || [];
    dayEvents.slice(0, 3).forEach(row => {
      const col = calEventColor(row, colorMap);
      const dot = document.createElement('span');
      dot.className      = 'cal-ev-dot';
      dot.style.background  = col + '22';
      dot.style.color       = col;
      dot.style.borderLeft  = `3px solid ${col}`;
      dot.textContent    = (row[CONFIG.COL_NAME] || '').trim() || '(unnamed)';
      dot.addEventListener('click', e => { e.stopPropagation(); openEventModal(row); });
      cell.appendChild(dot);
    });

    if (dayEvents.length > 3) {
      const more = document.createElement('span');
      more.className   = 'cal-ev-more';
      more.textContent = `+${dayEvents.length - 3} more`;
      more.addEventListener('click', e => { e.stopPropagation(); showCalPopupMulti(dayEvents, d, e); });
      cell.appendChild(more);
    }

    grid.appendChild(cell);
  }

  // Trailing empty cells (days from next month)
  const trailingCells = (7 - (startOffset + lastDay.getDate()) % 7) % 7;
  for (let i = 1; i <= trailingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell other-month';
    const num = document.createElement('span');
    num.className   = 'cal-day-num';
    num.textContent = i;
    cell.appendChild(num);
    grid.appendChild(cell);
  }
}

/* ── Calendar "+N more" floating popup ───────────────────── */

/** Open the floating popup showing all events for a given day. */
function showCalPopupMulti(dayEvents, day, e) {
  const colorMap = buildCalColorMap();
  const popup = document.getElementById('cal-popup');
  let html = `<div style="padding:10px 14px 6px;font-family:var(--font-heading);font-size:.9rem;font-weight:700;color:var(--p3);border-bottom:1px solid var(--p6);margin-bottom:6px">${day} ${CAL_MONTHS[calMonth]}</div>`;

  dayEvents.forEach(row => {
    const c  = calEventColor(row, colorMap);
    const n  = (row[CONFIG.COL_NAME] || '').trim() || '(unnamed)';
    const dr = fmtDateRange(row);
    const idx = rows.indexOf(row);
    html += `<div style="padding:7px 14px;border-bottom:1px solid var(--p6);">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:${c};margin-bottom:2px">${escHtml(row._layer || '')}</div>
      <div style="font-family:var(--font-heading);font-size:.85rem;font-weight:700;color:var(--p3);cursor:pointer;margin-bottom:2px" onclick="openEventFromMap(${idx});closeCalPopup()">${escHtml(n)}</div>
      ${dr ? `<div style="font-size:11px;color:var(--p2);font-weight:600">${escHtml(dr)}</div>` : ''}
    </div>`;
  });

  document.getElementById('cal-popup-content').innerHTML = html;
  popup.classList.add('open');

  const pw = 300, ph = 220;
  let x = e.clientX + 12, y = e.clientY + 12;
  if (x + pw > window.innerWidth  - 16) x = e.clientX - pw - 12;
  if (y + ph > window.innerHeight - 16) y = e.clientY - ph - 12;
  popup.style.left = Math.max(8, x) + 'px';
  popup.style.top  = Math.max(8, y) + 'px';
}

/** Close the floating calendar popup. */
function closeCalPopup() { document.getElementById('cal-popup').classList.remove('open'); }

// Close popup when clicking outside it
document.addEventListener('click', e => {
  const popup = document.getElementById('cal-popup');
  if (popup.classList.contains('open') && !popup.contains(e.target)) closeCalPopup();
});
