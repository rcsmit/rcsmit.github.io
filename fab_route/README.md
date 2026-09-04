# Fabulous Village Walking Route — setup &amp; replication guide

This project is three HTML pages plus two shared JavaScript files:

| File | Who uses it | What it's for |
|---|---|---|
| `index.html` | Guests | The public walking-route finder (search a pitch, get directions, distance, time) |
| `power.html` | You / site maintenance | Find a power station or switch box, and get walking directions to it from any pitch |
| `map-config-tool.html` (a.k.a. **the map-config-tool**) | You / camping group admins | A visual editor to build and fix the underlying graph |
| `data.js` | All three pages | The campsite data: nodes, edges, plots, scale |
| `map-svg.js` | All three pages | The campsite background map |

There's still no build step, no server, and no dependencies — but the five files have to sit **in the same folder**, because each page loads `data.js` and `map-svg.js` as plain `<script src="…">` tags. Double-clicking any of the three pages still works. That's deliberate: the shared files are plain scripts rather than a fetched `.json`/`.svg` or an ES module, because browsers block both of those over `file://`, which would have killed the open-the-tool-locally workflow.

Everything the pages know about the campsite lives in **`data.js`**:

```js
const NODES = { "n0": [1098.7, 419.7], "n1": [968.1, 536], ... };
const EDGES = [["n18","n19","Via Roma"], ["n20","n21","Via Roma"], ...];
let PLOTS   = [{"key":"000","num":"000","x":968,"y":536,"color":"yellow","node":"n1"}, ...];
const M_PER_UNIT = 0.6857;
```

- `NODES` — every path junction/bend, as `id: [x, y]` pixel coordinates on the map SVG.
- `EDGES` — every path segment, as `[fromNodeId, toNodeId, streetName]`.
- `PLOTS` — every pitch, plus special locations like reception, plus the power stations — each linked to its nearest node.
- `M_PER_UNIT` — how many real-world meters one map pixel represents (see step 5).

`PLOTS` is `let` rather than `const` on purpose: the map-config-tool reassigns the whole array when you delete a plot. Don't "fix" it to `const` — the tool will throw. `NODES` and `EDGES` are only ever mutated in place.

**Older versions of this project had these constants duplicated in every HTML file, and keeping them in sync by hand was by far the easiest way to break the setup. That's gone.** There is now exactly one copy, in one file, read by all three pages. See "The data file" below.

---

## 1. Replicating this for another campsite

### Step 1 — Get a background map

You need an SVG (or SVG-able) version of the site's official map. In practice: export or trace the site plan in Illustrator/Inkscape, and note the exact width/height of your `viewBox` — you'll need those two numbers next.

### Step 2 — Swap in the background and the canvas size

1. Replace the SVG string in **`map-svg.js`**. The file is one long line of the form:

   ```js
   const MAP_SVG = "<svg id=\"mapSvg\" … viewBox=\"0 0 1218.9 870.236\" …>…</svg>";
   ```

   Keep `id="mapSvg"` and the `<g id="bgGroup">` wrapper — the pages' zoom/pan/click code and the tool's "hide background" toggle depend on both. The easiest way to regenerate this file is to run your SVG through anything that JSON-escapes a string (`JSON.stringify` in a browser console works fine) and paste the result between the quotes. Leave the `injectMapSvg()` function at the bottom of the file alone.

2. Update the viewbox constants so they match your new map exactly. These are still per-page, near the top of each `<script>` block in **all three** HTML files:

   ```js
   const VBW = 1218.9, VBH = 870.236;  // <- change to your SVG's width/height
   ```

   Get this wrong and zoom, pan, and the "fit view" button will all be slightly off. (Yes, this is the one bit of data still duplicated three ways. It changes roughly once per campsite, so it hasn't been worth moving.)

3. Update the page titles and header text (`<h1>Fabulous Village</h1>`, the `<title>`, etc.) in all three pages to the new campsite's name.

### Step 3 — Start with an empty graph

Reset `data.js` to:

```js
const NODES = {};
const EDGES = [];
let PLOTS   = [];
const M_PER_UNIT = 1;   // calibrate in step 5
```

Then open `map-config-tool.html` in a browser — this is where all the real work happens.

### Step 4 — Trace the graph in the map-config-tool

Work through this rough order (see section 4 below for a full explanation of every button):

1. **Nodes tab → "Add node mode."** Click along every path, at every junction and bend, to lay down nodes. Turn on the **grid** (Overview tab, adjustable step size) if you want easier visual alignment with the background.
2. **Edges tab → "Add edge mode."** Type a street name, then click two nodes in a row to connect them. Repeat for every path segment. Reuse the same street name for a whole path so the outlier-detection (see below) can do its job.
3. **Plots tab → "Add plot mode."** Type a number/label, pick a colour, then click where each pitch sits. The nearest node is linked automatically — you can change that link later if it picks the wrong one.
4. **Add the power stations / switch boxes** the same way, with the colour dropdown set to **power station**. They're just plots with `color: "power"`, so they use exactly the same workflow — see section 3.
5. **Check the Flagged edges and Stats accordions** (Overview tab) as you go. The tool automatically flags edges that are statistically much longer than others on the same street, or that are simply very long overall — these are almost always mistakes (e.g. a node accidentally connected across the map instead of to its neighbour). Click a flagged edge to jump straight to it on the map and inspect it.
6. **Export early, export often.** There is no autosave — everything lives in the browser tab's memory only, and a refresh throws it all away. Use **Export data.js → Download data.js** regularly and keep the file somewhere safe as a checkpoint while you work.

### Step 5 — Calibrate distance and walking speed

`M_PER_UNIT` lives in `data.js`. `WALK_SPEED` lives in `index.html` and `power.html` (the two pages that show a walking time):

```js
const M_PER_UNIT = 0.6857;  // 1 map unit (pixel) = this many real-world meters   [data.js]
const WALK_SPEED = 1.3;     // assumed walking speed, in meters/second            [index.html, power.html]
```

To calibrate `M_PER_UNIT` for a new map: find two points whose real-world distance you know (e.g. the campsite might list the length of the main boulevard, or you can measure it on Google Maps/on foot), find the corresponding two nodes on your traced graph, and compute:

```
M_PER_UNIT = (known real-world distance in meters) / (pixel distance between the two nodes)
```

`WALK_SPEED` (in m/s) is just an assumed pace — 1.3 m/s (≈ 4.7 km/h) is a relaxed adult stroll. Lower it a bit if your guests skew toward families with young kids or a hillier site.

### Step 6 — Publish

Once the graph and pitches look right, click **Export data.js → Download data.js** one last time and drop the file next to the three HTML pages, overwriting the old one. That's it — all three pages are now live with your new campsite's data. There is nothing to paste into any HTML file.

### Step 7 — Bump the version

If you're following the "every file gets a version comment" convention, update the `version = "yyyymmdd-hhmmss"` line at the top of the pages you changed — it makes it easy to tell, at a glance, whether two copies of a file are actually the same.

---

## 2. The data file

Because there's no database and no backend, **the "database" is `data.js`.** The workflow is now:

1. Open `map-config-tool.html`.
2. Make your edits (add/move/delete nodes, edges, plots, power stations).
3. Click **Export data.js → Download data.js**.
4. Drop the downloaded file next to the HTML pages, replacing the old `data.js`.

That's the whole loop. The tool exports the complete file — header comment, all four constants — so you overwrite rather than patch, and the file you just used to make the edits picks up its own output the next time you open it. The old failure mode of editing a stale graph is gone by construction.

**Caching caveat.** Browsers cache `.js` files. On GitHub Pages, a static asset comes back with `Cache-Control: max-age=600`, so someone who loaded the site in the last ten minutes may still be running the old graph after you publish. If that matters during a session where you're pushing fixes, bump the reference in all three pages:

```html
<script src="data.js?v=20260904"></script>
```

`map-svg.js` doesn't need this treatment — it only changes when the campsite map itself does.

**Practical tip:** keep a dated copy of each exported `data.js` (a private git repo is ideal, timestamped filenames work too), so you can roll back if an edit turns out to be wrong.

---

## 3. Plot categories and `power.html`

A plot's `color` field is what puts it in one of three categories:

| `color` | Meaning here | Where it shows up |
|---|---|---|
| `yellow` | Tour operator pitch | Guest route finder, config tool |
| `grey` | hu OPENAIR pitch | Guest route finder, config tool |
| `power` | Power station / switch box | **`power.html`** and the config tool only |

The first two are a naming convention you're free to redefine per campsite (see section 5). The third is different: `power` is load-bearing. `index.html` filters those plots out of the guest autocomplete, out of the typed lookup, and out of click-to-select on the map, so a guest can never be routed to a switch box. The config tool draws them in their own layer as blue squares, with their own show/hide toggles, so they stay visible even when the regular plot layer is off.

**`power.html`** is the page for them:

- A searchable, numerically-sorted list of every power station.
- Click a row (or a blue square on the map) to select one — the map zooms to it and the panel shows its key, number, linked node, coordinates, and the eight closest pitches with walking distances in meters.
- A **From plot** field gives full walking directions from any pitch to the selected station, using the same Dijkstra routing as the guest app.
- Optional faint dots for the regular pitches, as context.
- Deep-linkable: `power.html?ps=200&from=214` opens with that station selected and that route drawn. The selection is written back into the URL as you click, so the address bar is always shareable.

If `data.js` contains no `power` plots yet, the page says so and tells you how to add them, rather than showing an empty list.

---

## 4. Configuring this for other people in the camping group

- **Publish `index.html`.** That's the guest-facing page — put it on the campsite's website (as a page or an iframe) or host it as a static page. It needs `data.js` and `map-svg.js` in the same folder to work.
- **Keep `map-config-tool.html` private.** It lets anyone who opens it add, move, or delete nodes/edges/plots — fine for you and trusted colleagues, not something you want a curious guest stumbling into. Share it directly (email, a private link, an internal admin folder) rather than publishing it alongside the guest app.
- **`power.html` is your call.** Nothing on it is sensitive — it's a map of grey boxes — but it's no use to guests either. Publishing it is harmless; if you'd rather not, keep it in the same private folder as the config tool. Note that it needs `data.js` and `map-svg.js` too, so a private copy needs its own copies of those.
- **One set of files per campsite.** If another campsite in the group wants their own version, don't share a single live copy — duplicate all five files, follow "Replicating this for another campsite" above with their own map, and give them their own `data.js`.
- **Decide who "owns" edits per site.** Since there's no built-in access control or multi-user editing (it's just local HTML files), the simplest model is: one person per campsite is the designated editor, uses the map-config-tool to make changes, and re-publishes `data.js` when done — same as with any other static file.
- **Agree on a colour convention.** `yellow` and `grey` mean whatever you decide — "regular pitch" vs "tour-operator pitch," "available" vs "long-term," whatever fits the site. Just make sure everyone editing a given campsite's data agrees before they start adding plots. `power` is the exception: leave that one meaning power stations, since `index.html` hides it from guests and `power.html` is built around it.

---

## 5. Full reference: every option in the map-config-tool

The sidebar is split into four tabs: **Overview, Nodes, Edges, Plots.** Selecting something on the map (or in a table) automatically switches to the relevant tab.

### Overview tab

**Layers accordion**
| Option | What it does |
|---|---|
| Background (campsite map) | Show/hide the underlying site-plan artwork |
| Edges (paths) | Show/hide all path lines |
| Nodes | Show/hide the node dots |
| Node labels (ID) | Show each node's ID as text next to it |
| Plots (pitches) | Show/hide plot markers (power stations are *not* affected — they have their own toggle) |
| Plot labels (number) | Show each plot's number/label as text |
| Power stations / switch boxes | Show/hide the blue square markers |
| Power station labels | Show each power station's number as text |
| Show flagged edges only | Filter the map down to just the auto-flagged (suspicious) edges |
| Grid (estimate coordinates) | Overlay a coordinate grid, with a step size of 25 / 50 / 100 units, to help you eyeball positions while tracing |

**Street legend accordion**
A scrollable, colour-coded list of every street name currently in use, with an edge count per street. Click a street to dim/hide just that street on the map (handy for isolating one path visually); **Show all** / **Hide all** buttons reset or hide everything at once.

**Flagged edges accordion**
An auto-generated list of edges the tool thinks might be mistakes, based on two checks:
- **Per-street outliers:** if a street has 3+ edges, any edge more than 1.8 standard deviations longer than that street's average (and over 60px) gets flagged.
- **Global outliers:** any edge in the longest 7% of *all* edges (and over 100px) gets flagged, regardless of street.

Click any flagged entry to select it and pan the map to it, so you can visually compare it against the background artwork and decide whether it's a real path or a mistake.

**Stats accordion**
A live-updating summary: nodes, edges, plots, power stations (counted separately from plots), unique street names, and currently-flagged edges.

**Export data.js accordion**
- **Download data.js** — saves the complete file, ready to drop next to the HTML pages.
- **Copy** — same content, to the clipboard, if you'd rather paste it somewhere yourself.
- A read-only text box showing exactly what will be written.
- **Refresh export** — regenerates the box from the current in-memory state (useful if you've made edits since it was last built).

### Nodes tab

**Add node**
- **Add node mode** checkbox — while on, clicking an empty spot on the map places a new node there.
- Optional **node id** field — set a custom ID for the next node you add; leave blank to auto-generate one (`nnew1`, `nnew2`, …).

**Selected node**
- Info box showing the node's coordinates and how many edges/plots connect to it; any linked plots are shown as clickable pills that jump you to that plot.
- **Drag** a node on the map to move it (all connected edges update their length automatically).
- **Delete node** button — also deletes every edge touching that node, and re-links any plots that were attached to it to their new nearest node.

### Edges tab

**Add edge**
- **Add edge mode** checkbox — while on, click two nodes in a row to connect them with a new edge.
- **Street name for new edge** field — applied to the edge you're about to create; leave blank and it's named "Unknown street" (worth fixing later).

**Selected edge**
- Info box with from/to node, street name, length, and (if applicable) why it was flagged.
- **Delete edge** button.
- **Rename street** button — prompts for a new name and applies it to *this one edge only* (to rename an entire street, repeat per edge, or edit the exported `EDGES` line in `data.js` directly).

**Edge table**
A sortable (click a column header), filterable (type a node ID or street name) table of every edge. Click a row to select that edge and pan to it on the map.

### Plots tab

Power stations are plots, so everything here applies to them too.

**Add plot**
- **Add plot mode** checkbox — while on, clicking an empty spot places a new plot there and auto-links it to the nearest node.
- **number/label** field and a **colour** dropdown (`yellow` / `grey` / `power station`).

**Selected plot**
- Info box with the plot's key, number, colour, and linked node.
- Editable fields: key, number/label, colour, and a dropdown to change the linked node manually. Changing the colour to or from `power station` moves the marker between layers immediately.
- **Save** button (applies your edits) and **Delete plot** button.
- **Drag** a plot on the map to reposition it.

**Plot list**
A sortable, filterable table of every plot, mirroring the edge table. The filter matches key, number, node id and colour — type `power` to list just the power stations.

### Global behaviour

- **Delete/Backspace** deletes whatever is currently selected (node, edge, or plot) — disabled while you're typing in a text field, so it won't accidentally fire while you're naming a street.
- **Pan:** click-and-drag anywhere on the empty map background.
- **Zoom:** mouse wheel, the `+`/`−` buttons, or the reset button to fit the whole map back into view.
- **Tooltips:** hover over any node, edge, plot, or power station for a quick info popup without needing to click.

---

## 6. Quick troubleshooting

- **A page loads but the map is blank / nothing works.** `data.js` or `map-svg.js` isn't next to the HTML file, or got renamed. Check the browser console for a 404 or for `MAP_SVG is not defined`. All five files live in one folder.
- **`Assignment to constant variable` when deleting a plot in the config tool.** `PLOTS` in `data.js` has been changed from `let` to `const`. Change it back.
- **You published a new `data.js` but the site still shows the old graph.** Browser cache. Hard-refresh, or add a `?v=…` to the script tags (see section 2).
- **The public app sends people the wrong way / can't find a route.** Almost always a graph problem, not an app problem — open the map-config-tool, check the Flagged edges list, and visually compare the two nodes in question against the background map.
- **Distances look wildly wrong.** Re-check `M_PER_UNIT` — it's easy to accidentally calibrate it against the wrong pair of points.
- **A power station shows up in the guest search.** Its `color` isn't exactly `power` — check for a typo or a stray capital in `data.js`.
- **The map-config-tool "doesn't remember my last session."** That's expected — it has no storage. Always finish an editing session by exporting `data.js`.
- **Two people edited at the same time and now the data has diverged.** There's no merge tool here — pick the more complete/recent `data.js`, and have the other person redo their (hopefully small) changes on top of it.

---

### 7. To do list / wishlist
- ~~NODES / EDGES / PLOTS in a seperate file~~ — done, `data.js`
- ~~map.svg in a seperate file~~ — done, `map-svg.js`
- ~~qr code / deeplink~~ — done: QR + share modal on `index.html`, `?from=`/`?to=` there and `?ps=`/`?from=` on `power.html`
- client-side QR generation, to drop the `api.qrserver.com` dependency (external call + GDPR exposure)
- move `VBW`/`VBH` into `data.js` so nothing but the page titles is per-file
- more plot categories beyond yellow/grey/power, each independently toggleable as guest-visible or admin-only (`power` is currently the only category with that visible/hidden split hardcoded into `index.html`)
- link a plot to other plots — e.g. enter a plot number and see the power station assigned to it, without hunting for it on the map
- variables and map in a database
- version/system with everything webbased, user control etc etc
