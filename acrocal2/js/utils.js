/* ═══════════════════════════════════════════════════════════
   UTILS  — pure helpers, no DOM side-effects
   ═══════════════════════════════════════════════════════════ */

/** Escape a value for safe insertion into HTML. */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Show a brief toast notification. */
function toast(msg, ms = 4000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), ms);
}

/** Return the emoji icon for a given event category. */
function etIcon(t) {
  return { Festival: '🎪', Retreat: '🏕️', Intensive: '🔥', Event: '📍', Training: '🎓' }[t] || '';
}

/**
 * Parse a date string in ISO (YYYY-MM-DD) or US (MM/DD/YYYY) format.
 * Falls back to Date constructor; returns null on failure.
 */
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const iso = str.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const us = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us)  return new Date(+us[3], +us[1] - 1, +us[2]);
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

/** Convert a Date to a compact numeric key YYYYMMDD for fast comparisons. */
function dateOnly(d) {
  if (!d) return null;
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Format the start–end date range of a row as a human-readable string. */
function fmtDateRange(row) {
  const s = (row[CONFIG.COL_START] || '').trim();
  const e = (row[CONFIG.COL_END]   || '').trim();
  if (!s && !e) return '';
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const ds = s ? parseDate(s) : null;
  const de = e ? parseDate(e) : null;
  const fs = ds ? ds.toLocaleDateString('en-GB', opts) : s;
  const fe = de ? de.toLocaleDateString('en-GB', opts) : e;
  if (s && e && s !== e) return `${fs} – ${fe}`;
  return fs || fe;
}

/**
 * Parse CSV text into an array of objects keyed by the header row.
 * Handles: quoted fields, escaped quotes (""), CRLF, LF, and lone CR line endings.
 */
function parseCSV(csv) {
  const lines = [];
  let field = '', row = [], inQ = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i], nx = csv[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { field += '"'; i++; }
      else if (ch === '"')           { inQ = false; }
      else                           { field += ch; }
    } else {
      if      (ch === '"')  { inQ = true; }
      else if (ch === ',')  { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && nx === '\n') || (ch === '\r' && nx !== '\n')) {
        // Consume the \n in \r\n; lone \r and bare \n need no extra skip
        if (ch === '\r' && nx === '\n') i++;
        row.push(field); field = '';
        if (row.some(Boolean)) lines.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  // Flush last row
  if (field || row.length) { row.push(field); if (row.some(Boolean)) lines.push(row); }
  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.trim());
  return lines.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
}

/** Assign a colour from CONFIG.COLORS to each layer (cycles if > 30). */
function assignColors(layers) {
  layers.forEach((l, i) => { lColors[l] = CONFIG.COLORS[i % CONFIG.COLORS.length]; });
}
