<!-- version = "20261107-130000" -->
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
2. Change `name`, `tagline`, `center`, `sheet.id`, `theme`, `disclaimer`, `popupWarning`, `storageKey`. Delete `fallbackData`/`fallbackMeta` (or replace with demo rows for that city).
3. Publish. The script tag `../citymap/citymap.js` works when `citymap/` and the city folders are siblings on the same GitHub Pages domain (`rcsmit.github.io`). Use the absolute URL `https://rcsmit.github.io/citymap/citymap.js` when the folders live elsewhere.

## Google Sheet
Share it as **Anyone with the link → Viewer**.
- Tab `MASTER` (name configurable): columns `Id`, `Layer`, `naam`, `address`, `LON`, `LAT`, `website`, `remarks`. Rename the columns your sheet uses via `fields`.
- Tab `LAYERS` (optional): columns `Layer`, `Description`, `Source`. Shown as hover tooltip and above each table.
- The `naam` cell may contain a pasted Google Maps place link (`https://www.google.com/maps/place/…`). The map shows the place name, takes LAT/LON from the link when those cells are empty, and uses the cleaned link as the "Google Maps" link. Short `maps.app.goo.gl` links cannot be decoded.
- `Id` must be unique per row (used by the "show on map" button).

## Config keys (all optional except `center` and `sheet.id`)
| Key | Default | Meaning |
|---|---|---|
| `name`, `accentWord`, `tagline`, `documentTitle` | `"City map"` | Sidebar title; `accentWord` is the word in the title shown italic gold |
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
| `qr` | `{enabled:false, url:""}` | `enabled:true` adds a "QR code" button (modal, SVG download) and a QR on the printed map. It encodes `url` (or the current page address) plus the active `?layer=` selection |
| `fallbackData`, `fallbackMeta` | none | Rows/descriptions used when the sheet is unreachable |
| `strings` | English | Every UI text, e.g. `placesCount: "{n} plaatsen"` for a Dutch map |

Deeplinks: `?layer=Gelato,Pizza2` activates those layers on load.
