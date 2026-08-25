# Fabulous Village Walking Route — setup &amp; replication guide

This project is two HTML files that share the same three pieces of data:

| File | Who uses it | What it's for |
|---|---|---|
| `index.html` | Guests | The public walking-route finder (search a pitch, get directions, distance, time) |
| `map-config-tool.html` (a.k.a. **the map-config-tool**) | You / camping group admins | A visual editor to build and fix the underlying graph |

Both files are fully self-contained (HTML + CSS + JS, no build step, no server, no dependencies). You can open either one by just double-clicking it, or host it as a static file.

Everything both files know about the campsite lives in **three JavaScript constants**, defined near the top of each file's `<script>` block:

```js
const NODES = { "n0": [1098.7, 419.7], "n1": [968.1, 536], ... };
const EDGES = [["n18","n19","Via Roma"], ["n20","n21","Via Roma"], ...];
const PLOTS = [{"key":"000","num":"000","x":968,"y":536,"color":"yellow","node":"n1"}, ...];
```

- `NODES` — every path junction/bend, as `id: [x, y]` pixel coordinates on the map SVG.
- `EDGES` — every path segment, as `[fromNodeId, toNodeId, streetName]`.
- `PLOTS` — every pitch (and special locations like reception), each linked to its nearest node.

**This is the single most important thing to remember about the whole setup:** these three constants must be copy-pasted into *both* files whenever they change. `index.html` needs the current data to route guests correctly. `map-config-tool.html` needs the current data too — otherwise the next time someone opens it to make an edit, they'll be editing a stale, out-of-date graph. See "Keeping both files in sync" below — skipping this step is the #1 way this setup breaks.

---

## 1. Replicating this for another campsite

### Step 1 — Get a background map

You need an SVG (or SVG-able) version of the site's official map, since both files render it directly inside an `<svg id="mapSvg" viewBox="0 0 W H">…</svg>` element. In practice: export or trace the site plan in Illustrator/Inkscape, and note the exact width/height of your `viewBox` — you'll need those two numbers next.

### Step 2 — Swap in the background and the canvas size

In **both** `index.html` and `map-config-tool.html`:

1. Replace the contents of the `<svg id="mapSvg" ...>` element with your new background artwork (keep the `id="mapSvg"` and surrounding wrapper elements as they are — the app's zoom/pan/click code depends on them).
2. Update the two viewbox constants near the top of the `<script>` block so they match your new map exactly:
   ```js
   const VBW = 1218.9, VBH = 870.236;  // <- change to your SVG's width/height
   ```
   Get this wrong and zoom, pan, and the "fit view" button will all be slightly off.
3. Update the page title and header text (`<h1>Fabulous Village</h1>`, the `<title>`, etc.) to the new campsite's name.

### Step 3 — Start with an empty graph

In both files, reset the three constants to empty:

```js
const NODES = {};
const EDGES = [];
const PLOTS = [];
```

Then open `map-config-tool.html` in a browser — this is where all the real work happens.

### Step 4 — Trace the graph in the map-config-tool

Work through this rough order (see section 2 below for a full explanation of every button):

1. **Nodes tab → "Add node mode."** Click along every path, at every junction and bend, to lay down nodes. Turn on the **grid** (Overview tab, adjustable step size) if you want easier visual alignment with the background.
2. **Edges tab → "Add edge mode."** Type a street name, then click two nodes in a row to connect them. Repeat for every path segment. Reuse the same street name for a whole path so the outlier-detection (see below) can do its job.
3. **Plots tab → "Add plot mode."** Type a number/label, pick a color, then click where each pitch sits. The nearest node is linked automatically — you can change that link later if it picks the wrong one.
4. **Check the Flagged edges and Stats accordions** (Overview tab) as you go. The tool automatically flags edges that are statistically much longer than others on the same street, or that are simply very long overall — these are almost always mistakes (e.g. a node accidentally connected across the map instead of to its neighbour). Click a flagged edge to jump straight to it on the map and inspect it.
5. **Export early, export often.** There is no autosave — everything lives in the browser tab's memory only, and a refresh throws it all away. Use the **Export accordion → "Copy all three"** button regularly and paste the result somewhere safe (even just a scratch text file) as a checkpoint while you work.

### Step 5 — Calibrate distance and walking speed

Two more constants live in `index.html` (only needed there, since only `index.html` shows distance/time to guests):

```js
const M_PER_UNIT = 0.6857;  // 1 map unit (pixel) = this many real-world meters
const WALK_SPEED = 1.3;     // assumed walking speed, in meters/second
```

To calibrate `M_PER_UNIT` for a new map: find two points whose real-world distance you know (e.g. the campsite might list the length of the main boulevard, or you can measure it on Google Maps/on foot), find the corresponding two nodes on your traced graph, and compute:

```
M_PER_UNIT = (known real-world distance in meters) / (pixel distance between the two nodes)
```

`WALK_SPEED` (in m/s) is just an assumed pace — 1.3 m/s (≈ 4.7 km/h) is a relaxed adult stroll. Lower it a bit if your guests skew toward families with young kids or a hillier site.

### Step 6 — Copy the final data into `index.html`

Once the graph and pitches look right, click **Export → "Copy all three"** in the map-config-tool one last time, and paste the result into `index.html`, replacing its existing `const NODES = …`, `const EDGES = …`, and `const PLOTS = …` lines (they're near the top of the `<script>` block, right after the `<style>` section). The public app is now live with your new campsite's data.

### Step 7 — Bump the version

If you're following the "every file gets a version comment" convention, update the `version = "yyyymmdd-hhmmss"` line at the top of both files to the current date/time whenever you ship a data change — it makes it easy to tell, at a glance, whether two copies of a file are actually the same.

---

## 2. Keeping both files in sync

Because there's no database and no backend, **the "database" is just these three constants, duplicated in two files.** There is exactly one workflow that keeps them consistent:

1. Open `map-config-tool.html`.
2. Make your edits (add/move/delete nodes, edges, plots).
3. Click **Export → "Copy all three."**
4. Paste the result into `index.html` (overwriting its `NODES`/`EDGES`/`PLOTS`).
5. **Also paste the same result back into `map-config-tool.html` itself**, overwriting its own `NODES`/`EDGES`/`PLOTS` — yes, the file you just used to generate this data needs it pasted back into itself.

Step 5 is the one people forget, and it's the one that causes real headaches: if you (or a colleague) skip it, the *next* time anyone opens the map-config-tool, they'll be editing whatever old snapshot was hardcoded in that file — not the version that's actually live on `index.html`. Any edits made from that point are built on stale data, and reconciling two diverged graphs by hand is no fun. Treat the exported block as a tiny hand-rolled "save file" that always needs writing to both places.

**Practical tip:** keep a dated copy of the exported `NODES`/`EDGES`/`PLOTS` block (e.g. in a private git repo, or just timestamped `.txt` files) every time you make a significant change, so you can roll back if an edit turns out to be wrong.

---

## 3. Configuring this for other people in the camping group

- **Publish only `index.html`.** That's the guest-facing file — put it on the campsite's website (as a page or an iframe) or host it as a static page.
- **Keep `map-config-tool.html` private.** It lets anyone who opens it add, move, or delete nodes/edges/plots — fine for you and trusted colleagues, not something you want a curious guest stumbling into. Share it directly (email, a private link, an internal admin folder) rather than publishing it alongside the guest app.
- **One pair of files per campsite.** If another campsite in the group wants their own version, don't share a single live copy — duplicate both files, follow "Replicating this for another campsite" above with their own map, and give them their own `NODES`/`EDGES`/`PLOTS`.
- **Decide who "owns" edits per site.** Since there's no built-in access control or multi-user editing (it's just a local HTML file), the simplest model is: one person per campsite is the designated editor, uses the map-config-tool to make changes, and re-publishes `index.html` when done — same as with any other static file.
- **Agree on a color convention.** The tool ships with two plot colors (`yellow`/`grey`); their meaning is entirely up to you — e.g. "regular pitch" vs "tour-operator pitch," or "available" vs "long-term." Just make sure everyone editing a given campsite's data agrees on what each color means before they start adding plots.

---

## 4. Full reference: every option in the map-config-tool

The sidebar is split into four tabs: **Overview, Nodes, Edges, Plots.** Selecting something on the map (or in a table) automatically switches to the relevant tab.

### Overview tab

**Layers accordion**
| Option | What it does |
|---|---|
| Background (campsite map) | Show/hide the underlying site-plan artwork |
| Edges (paths) | Show/hide all path lines |
| Nodes | Show/hide the node dots |
| Node labels (ID) | Show each node's ID as text next to it |
| Plots (pitches) | Show/hide plot markers |
| Plot labels (number) | Show each plot's number/label as text |
| Show flagged edges only | Filter the map down to just the auto-flagged (suspicious) edges |
| Grid (estimate coordinates) | Overlay a coordinate grid, with a step size of 25 / 50 / 100 units, to help you eyeball positions while tracing |

**Street legend accordion**
A scrollable, color-coded list of every street name currently in use, with an edge count per street. Click a street to dim/hide just that street on the map (handy for isolating one path visually); **Show all** / **Hide all** buttons reset or hide everything at once.

**Flagged edges accordion**
An auto-generated list of edges the tool thinks might be mistakes, based on two checks:
- **Per-street outliers:** if a street has 3+ edges, any edge more than 1.8 standard deviations longer than that street's average (and over 60px) gets flagged.
- **Global outliers:** any edge in the longest 7% of *all* edges (and over 100px) gets flagged, regardless of street.

Click any flagged entry to select it and pan the map to it, so you can visually compare it against the background artwork and decide whether it's a real path or a mistake.

**Stats accordion**
A live-updating summary: total nodes, total edges, total plots, number of unique street names, and number of currently-flagged edges.

**Export corrected data accordion**
- **Copy all three (NODES + EDGES + PLOTS)** — copies a ready-to-paste block of all three `const` declarations to your clipboard (falls back to a manual copy box if clipboard access is blocked).
- Three individual read-only text boxes, one per constant, if you want to copy just one of them.
- **Refresh export** — regenerates the text boxes from the current in-memory state (useful if you've made edits since the boxes were last built).

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
- **Rename street** button — prompts for a new name and applies it to *this one edge only* (to rename an entire street, repeat per edge, or edit the exported `EDGES` text directly and re-paste it in).

**Edge table**
A sortable (click a column header), filterable (type a node ID or street name) table of every edge. Click a row to select that edge and pan to it on the map.

### Plots tab

**Add plot**
- **Add plot mode** checkbox — while on, clicking an empty spot places a new plot there and auto-links it to the nearest node.
- **number/label** field and a **color** dropdown (`yellow` / `grey`).

**Selected plot**
- Info box with the plot's key, number, color, and linked node.
- Editable fields: key, number/label, color, and a dropdown to change the linked node manually.
- **Save** button (applies your edits) and **Delete plot** button.
- **Drag** a plot on the map to reposition it.

**Plot list**
A sortable, filterable table of every plot, mirroring the edge table.

### Global behaviour

- **Delete/Backspace** deletes whatever is currently selected (node, edge, or plot) — disabled while you're typing in a text field, so it won't accidentally fire while you're naming a street.
- **Pan:** click-and-drag anywhere on the empty map background.
- **Zoom:** mouse wheel, the `+`/`−` buttons, or the reset button to fit the whole map back into view.
- **Tooltips:** hover over any node, edge, or plot for a quick info popup without needing to click.

---

## 5. Quick troubleshooting

- **The public app sends people the wrong way / can't find a route.** Almost always a graph problem, not an app problem — open the map-config-tool, check the Flagged edges list, and visually compare the two nodes in question against the background map.
- **Distances look wildly wrong.** Re-check `M_PER_UNIT` — it's easy to accidentally calibrate it against the wrong pair of points.
- **The map-config-tool "doesn't remember my last session."** That's expected — it has no storage. Always finish an editing session by exporting and pasting the result into both files (see section 2).
- **Two people edited at the same time and now the data has diverged.** There's no merge tool here — pick the more complete/recent export, and have the other person redo their (hopefully small) changes on top of it.

---

### 6. To do list / wishlist
- NODES / EDGES / PLOTS in a seperate file
- map.svg in a seperate file
- variables and map in a database
- version/system with everything webbased, user control etc etc
- qr code / deeplink
