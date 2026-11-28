<!-- version = "20261127-151000" -->
# citymap — reusable curated city map

Shared engine for maps like `rcsmit.github.io/rome/`. One engine, one small `index.html` per city.

```
citymap/        <- publish once (e.g. rcsmit.github.io/citymap/)
  citymap.js    generic code
  citymap.css   generic styles (colours/fonts are CSS variables)
rome/index.html <- one folder per city, contains only settings
paris/index.html
```

## New city in 3 steps
1. Copy `rome/index.html` to `<city>/index.html`.
2. Change `name`, `city`, `tagline`, `center`, `sheet.id`, `theme`, `disclaimer`, `popupWarning`, `storageKey`. Delete `fallbackData`/`fallbackMeta` (or replace with demo rows for that city).
3. Publish. The script tag `../citymap/citymap.js` works when `citymap/` and the city folders are siblings on the same GitHub Pages domain (`rcsmit.github.io`). Use the absolute URL `https://rcsmit.github.io/citymap/citymap.js` when the folders live elsewhere.

## Google Sheet
Share it as **Anyone with the link → Viewer**.
- Tab `MASTER` (name configurable): columns `Id`, `Layer`, `naam`, `address`, `LON`, `LAT`, `website`, `remarks`. Rename the columns your sheet uses via `fields`.
- Column `Status` (optional, name configurable via `fields.status`): when filled, a **Status** dropdown (default `ALL`) appears in the sidebar and filters places and layers. `?status=Open` preselects a value.
- Column `Region` (optional, name configurable via `fields.region`, header case does not matter): a **Region** dropdown appears under the layer list. Its options (with counts) are the regions of the places in the active layers; it is hidden when those places have no region, and goes back to `ALL` when the chosen region is no longer among them. Places without a region are hidden while a region is selected. `?region=North` preselects a value.
- Tab `LAYERS` (optional): columns `Layer`, `Description`, `Source`. Shown as hover tooltip and above each table.
- The `naam` cell may contain a pasted Google Maps place link (`https://www.google.com/maps/place/…`). The map shows the place name, takes LAT/LON from the link when those cells are empty, and builds the "Google Maps" link from the coordinates and the name (`…/maps/search/?api=1&query=<lat>,<lon>+<name>`). Short `maps.app.goo.gl` links cannot be decoded.
- `address` and `website` are optional and are shown in the marker popup. The bottom table lists name, remarks, distance and the action icons. The printed legend leaves out the address column when no row has one.
- `Id` is optional. Clicking a place name (or 📍) in the bottom table zooms to that marker and opens its popup; this works for every row with coordinates, with or without an `Id`. When any row has an `Id`, a thin `#` column appears in the table.
- Distance: the table has a thin **km** column, computed in the browser (haversine). It measures from the visitor's position once the "My location" button has found it, otherwise from the city centre (`distanceCenter`, or `center`). No sheet column needed.
- `rating` and `reviews` (optional; names configurable via `fields.rating` / `fields.reviews`; headers such as `Google rating`, `rating_count`, `Number of reviews`, `Reviews count` are recognised too; case, spaces and underscores do not matter): a thin **★** and **Rev.** column appear only when the sheet fills them. Ratings may use a comma (`4,6`); review counts may be `1234`, `1.234`, `1,234` or `1.2k`. An optional `rating_date` column (`fields.ratingDate`) is shown when hovering the rating and review values ("… — as of 2026-11-20").
- Quality and popularity (optional, computed in the browser, nothing to add to the sheet): `scores: { quality: true, popularity: true, weight: 50 }` in the city's `index.html` adds a **Q** and/or **P** column (and sort options). Both are off unless that key is present. They need the rating and review columns and are calculated per layer: **Q** = (n × rating + weight × layer average) / (n + weight), the rating corrected for few reviews; **P** = Q × log10(n + 1), scaled so the best place of each layer is 100. `weight` (default 50) is how many reviews it takes before a place's own rating counts for half.
- Sorting: click a column header (`#`, Name, km, ★, Rev.) to sort the places within each layer; click again to reverse, a third time for sheet order. Empty values always go last. In the right-hand list (`listPosition: "right"`) a **Sort** dropdown does the same, and distance / rating / reviews are shown under each name.

## Config keys (all optional except `center` and `sheet.id`)
| Key | Default | Meaning |
|---|---|---|
| `name`, `accentWord`, `tagline`, `documentTitle` | `"City map"` | Sidebar title; `accentWord` is the word in the title shown italic gold |
| `city` | `name` | City name used in the table's 🔍 Google Maps search (`<place> <city>`), e.g. `"Chiang Mai"` |
| `center`, `zoom`, `maxZoom` | – / 12 / 19 | Initial map view; `center` is `[lat, lon]` |
| `sheet` | `{id, dataTab:"MASTER", layersTab:"LAYERS"}` | Google Sheet |
| `fields`, `metaFields` | see engine | Column names in the two tabs |
| `theme` | CSS defaults | `cream, warmWhite, accent, accentDark, gold, deep, muted, border, borderSoft, subtle, headerSub, disclaimerBg, disclaimerText, warnBg, warnBorder, warnText, popupWarn`. `accentDark` is derived from `accent` if omitted |
| `fonts` | Playfair Display / Lato | `{heading, body, url}` — Google Fonts family names (or a full `url`) |
| `palette`, `layerColors` | 30 fixed colours | Colours given to layers in sheet order; `layerColors` pins a colour per layer name |
| `disclaimer`, `popupWarning` | empty | Sidebar footer text and the line at the bottom of every popup (omitted when empty) |
| `defaultLayers` | `4` | Layers on at load: a number, a list of names, or `"all"` |
| `storageKey` | `"citymap"` | Prefix for the saved basemap preference — use one per city |
| `defaultBasemap` | `"positron"` | `positron, dark, bright, liberty, fiord, positron_nolabels, dark_nolabels` |
| `clusterMaxRadius`, `clusterDisableAtZoom` | 60 / 13 | Marker clustering |
| `scores` | `{quality:false, popularity:false, weight:50}` | Computed Q / P columns per layer, see above |
| `showNames` | `false` | Initial state of the "Show names on map" toggle; the visitor's own choice is remembered in the browser. Labels never overlap: each takes the first free spot right/left/above/below its dot, labels without room are hidden until you zoom in (hovering the dot shows it). Earlier layers and earlier sheet rows win when space is short |
| `locate` | `true` | "My location" button under the zoom control. The position is only requested when it is pressed, shown as a pulsing blue diamond with accuracy circle (top-right, next to the zoom buttons), never stored or tracked. Needs https (GitHub Pages is). `false` removes the button |
| `resetView` | `true` | "Show all" button under the location button: zooms back to the opening view (all places of the active layers). `false` removes it |
| `qr` | `{enabled:false, url:""}` | `enabled:true` adds a "QR code" button (modal, SVG download) and a QR on the printed map. It encodes `url` (or the current page address) plus the active `?layer=` selection |
| `distanceCenter` | `center` | `[lat, lon]` the km column measures from while the visitor has not used "My location" |
| `listPosition` | `"bottom"` | Place list under the map, or `"right"`: a third column with each place's name, 🔍/📍 icons and description on its own line. Phones always use the bottom list |
| `allMapsLink` | `{url:"https://rcsmit.github.io/citymap/", text:"ALL CITYMAPS"}` | Banner link under the QR / print buttons. `url:""` hides it |
| `svgExport` | `true` | "⬇ SVG export" button: downloads the places of the active layers (current filters) at the current zoom. Each layer becomes these SVG layers: `<layer> points small r5` / `medium r7` / `large r9`, `numbers` (in the dots, same numbering as the printed map), `names` and `list` (one text block, `1. Name` per line, to the right of the map). Plain SVG 1.1: every layer is a top-level group named by its id, so it opens in Gravit/Corel Vector, Illustrator, Affinity, Figma and Inkscape |
| `referencePoints` | `{name:"Reference points", points:[]}` | Extra SVG layer with crosses for aligning the export on a base map, e.g. `{name:"Moat corners", points:[{name:"NE – Si Phum", lat:18.7952, lon:98.99362}, …]}`. Not shown on the map |
| `fallbackData`, `fallbackMeta` | none | Rows/descriptions used when the sheet is unreachable |
| `strings` | English | Every UI text, e.g. `placesCount: "{n} plaatsen"` or `loadingMap: "Kaart laden…"` for a Dutch map |

Loading: the page first shows a loading screen (spinner + map name), loads all stylesheets and fonts (fonts wait at most 1.5 s), and only then builds the page, so there is no flash of unstyled text. Optional: put `<style>html{background:#faf6f0}</style>` (your `cream` colour) in the `<head>` of the city's index.html so even the first moment before citymap.js arrives is not white.

Deeplinks: `?layer=Gelato,Pizza2` activates those layers on load; `?status=Open` selects a status; `?region=North` selects a region. Layer names in the sidebar and the place list show the number of places in brackets.
