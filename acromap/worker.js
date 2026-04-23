/**
 * Cloudflare Worker — Google Sheets proxy
 * ════════════════════════════════════════
 * Fetches a private Google Sheet using a Service Account,
 * filters to only the allowed columns, and returns JSON.
 *
 * SETUP STEPS:
 * ─────────────────────────────────────────────────────────────
 * 1. Google Cloud Console (console.cloud.google.com)
 *    a. Create a project (or reuse one)
 *    b. Enable "Google Sheets API"
 *    c. Create a Service Account (IAM & Admin → Service Accounts)
 *    d. Create a JSON key for that Service Account → download it
 *    e. Share your Google Sheet with the Service Account's email
 *       (the email looks like: name@project.iam.gserviceaccount.com)
 *       Give it "Viewer" access — no edit rights needed.
 *
 * 2. Cloudflare Workers (workers.cloudflare.com)
 *    a. Create a new Worker
 *    b. Paste this file as the Worker code
 *    c. Add these Secrets (Worker → Settings → Variables → Secrets):
 *         GOOGLE_SA_EMAIL   → the service account email address
 *         GOOGLE_SA_KEY     → the private_key from the JSON file
 *                             (the full -----BEGIN PRIVATE KEY----- block)
 *         SHEET_ID          → your spreadsheet ID
 *         SHEET_TAB         → the tab name (e.g. MASTER)
 *    d. Deploy the Worker
 *    e. Copy the Worker URL into CONFIG.WORKER_URL in communities-map.html
 *
 * 3. Optional: restrict allowed origins in ALLOWED_ORIGINS below
 *    so only your domain can call this Worker.
 *
 * RESPONSE FORMAT:
 *    { "rows": [ { "Name": "...", "Land": "...", ... }, ... ] }
 *    Only the columns listed in EXPOSE_COLUMNS are included.
 * ─────────────────────────────────────────────────────────────
 */

// ╔═══════════════════════════════════════════════════════════╗
// ║  CONFIG                                                   ║
// ╚═══════════════════════════════════════════════════════════╝

// ── Per-route sheet and column config ────────────────────────
// Each route key maps to: { sheetId, sheetTab, exposeColumns }
// Set via Cloudflare Worker Secrets (see setup steps above).
// SHEET_ID / SHEET_TAB are the defaults (main sheet).
// VENUES_SHEET_ID / VENUES_SHEET_TAB are for the venues route.
const ROUTES = {
  // GET /communities  → main communities sheet
  '/communities': {
    sheetIdEnv:  'SHEET_ID',
    sheetTabEnv: 'SHEET_TAB',
    columns: [
      'Layer', 'LAT', 'LON', 'Name', 'remarks',
      'continent', 'Land', 'provincie', 'shortlist',
    ],
  },
  // GET /venues  → venues sheet (name, city, state, country, lat, lon)
  '/venues': {
    sheetIdEnv:  'VENUES_SHEET_ID',
    sheetTabEnv: 'VENUES_SHEET_TAB',
    columns: [
      'Name', 'city', 'state', 'country', 'LAT', 'LON',
    ],
  },
};

// Allowed origins for CORS. Add your domain(s) here.
// Use ['*'] to allow all origins (less secure but simpler for testing).
const ALLOWED_ORIGINS = [
  'https://rcsmit.github.io',
  'https://rene-smit.com',
  'http://localhost',
  'null',           // allows file:// (local HTML files)
];

// Cache responses for this many seconds (reduce Sheets API calls)
const CACHE_SECONDS = 300;  // 5 minutes

// ╔═══════════════════════════════════════════════════════════╗
// ║  WORKER HANDLER                                           ║
// ╚═══════════════════════════════════════════════════════════╝

export default {
  async fetch(request, env) {
    const origin  = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, allowed) });
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Route matching — strip query string for matching
    const path = new URL(request.url).pathname;
    const route = ROUTES[path];
    if (!route) {
      const available = Object.keys(ROUTES).join(', ');
      return new Response(
        JSON.stringify({ error: `Unknown route "${path}". Available: ${available}` }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) } }
      );
    }

    try {
      const sheetId  = env[route.sheetIdEnv];
      const sheetTab = env[route.sheetTabEnv];
      if (!sheetId || !sheetTab) {
        throw new Error(`Missing Worker Secret: ${route.sheetIdEnv} or ${route.sheetTabEnv}`);
      }

      const rows     = await fetchSheetRows(env, sheetId, sheetTab);
      const filtered = rows.map(row => filterRow(row, route.columns));
      const body     = JSON.stringify({ rows: filtered, count: filtered.length, route: path });

      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
          ...corsHeaders(origin, allowed),
        },
      });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowed) },
      });
    }
  },
};

// ── CORS headers ──────────────────────────────────────────────
function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin':  allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ── Fetch rows from Google Sheets API v4 ──────────────────────
async function fetchSheetRows(env, sheetId, sheetTab) {
  const token = await getAccessToken(env.GOOGLE_SA_EMAIL, env.GOOGLE_SA_KEY);

  // Use the Sheets API to get all values including headers
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTab)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const values = data.values;
  if (!values || values.length < 2) throw new Error('Sheet is empty or has no data rows');

  // First row = headers, rest = data
  const headers = values[0].map(h => h.trim());
  const rows = values.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });

  return rows;
}

// ── Filter row to only exposed columns ────────────────────────
function filterRow(row, columns) {
  const out = {};
  columns.forEach(col => {
    out[col] = row[col] || '';
  });
  return out;
}

// ════════════════════════════════════════════════════════════════
//  GOOGLE SERVICE ACCOUNT JWT + ACCESS TOKEN
//  Implements OAuth2 using the service account private key.
//  No external libraries needed — uses the Web Crypto API.
// ════════════════════════════════════════════════════════════════

async function getAccessToken(clientEmail, privateKeyPem) {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const jwt = await signJWT(claim, privateKeyPem);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const json = await res.json();
  if (!json.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(json));
  return json.access_token;
}

async function signJWT(payload, pemKey) {
  const header  = { alg: 'RS256', typ: 'JWT' };
  const enc     = v => btoa(JSON.stringify(v)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const message = enc(header) + '.' + enc(payload);

  const key = await importPrivateKey(pemKey);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(message),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');

  return message + '.' + sigB64;
}

async function importPrivateKey(pem) {
  // Strip PEM headers and decode base64
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binary.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}
