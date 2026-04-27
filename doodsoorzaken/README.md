# How to build the `RAW` variable for the Zelfdoding viewer

The viewer's data lives in a single JavaScript constant called `RAW`. This document explains its structure and shows you step by step how to produce it from a CBS (Statistics Netherlands) CSV export — or from any other tabular source.

---

## 1. Structure of `RAW`

```
RAW = {
  "<cause of death label>": {
    "<geslacht>": {
      "<leeftijdsgroep>": {
        "<year>": <count (integer)>,
        ...
      },
      ...
    },
    ...
  }
}
```

**Example** (abbreviated):

```js
const RAW = {
  "17 Uitwendige doodsoorzaken|17.2 Zelfdoding": {
    "Totaal mannen en vrouwen": {
      "45 tot 50 jaar": {
        "2000": 196,
        "2001": 184,
        ...
        "2024": 154
      },
      "50 tot 55 jaar": { ... }
    },
    "Mannen": { ... },
    "Vrouwen": { ... }
  }
};
```

### Key names

| Key level | Allowed values in this viewer | Notes |
|---|---|---|
| Cause (top level) | Any string | The viewer uses one cause. Add more if you extend it. |
| Geslacht | `"Totaal mannen en vrouwen"`, `"Mannen"`, `"Vrouwen"` | Must match exactly — the UI buttons are hardcoded to these. |
| Leeftijdsgroep | Any string | Must match the `data-l` attribute on the leeftijd buttons in the HTML. |
| Year | `"2000"` … `"2024"` | String keys, not integers. Extend `ALL_YEARS` in the script if you add years. |
| Value | Integer or `null` | Use `null` for missing data; `0` means genuinely zero. |

---

## 2. Downloading from CBS StatLine

The current data comes from CBS table **7052_95** (Overledenen; belangrijke doodsoorzaken, leeftijd, geslacht).

### Step-by-step

1. Go to: [https://opendata.cbs.nl/#/CBS/nl/dataset/7052_95/table?fromstatweb](https://opendata.cbs.nl/#/CBS/nl/dataset/7052_95/table?fromstatweb)

2. In the filter panel on the left, select:
   - **Geslacht**: all three (Totaal, Mannen, Vrouwen)
   - **Leeftijd**: the age groups you want (you can select all)
   - **Perioden**: all years
   - **Onderwerp**: the cause(s) of death you want

3. Because CBS limits the number of columns per download, you may need **multiple exports** — one per batch of leeftijdsgroepen. The current viewer was built from three separate CSV files:
   - 0–30 jaar (7 groups)
   - 30–80 jaar + Totaal (11 groups)
   - 80+ jaar (4 groups)

4. Click **Downloaden → CSV (puntkommagescheiden)** for each batch.

5. Verify the file is larger than a few KB before saving — an empty export contains only 7 lines.

---

## 3. Format of the CBS CSV

The CBS export uses a **wide format** with a multi-row header. Here is the structure:

```
Row 0:  Title row (ignore)
Row 1:  Empty (ignore)
Row 2:  Empty (ignore)
Row 3:  Geslacht values  → e.g. "Totaal mannen en vrouwen", "Mannen", "Vrouwen"
Row 4:  Leeftijd values  → e.g. "0 jaar", "15 tot 20 jaar", ...
Row 5:  Column headers   → "Onderwerp", "Perioden", then year values "2000"..."2024"
Row 6+: Data rows        → one row per cause of death
Last:   "Bron: CBS"      (ignore)
```

- Delimiter: semicolon (`;`)
- Encoding: UTF-8 with BOM (`utf-8-sig`)
- Quoted fields: yes (`"value"`)
- Column 0: cause of death label
- Column 1: always `"aantal"`
- Column 2+: values, one per (geslacht × leeftijd × year) combination

---

## 4. Python script to build `RAW`

Save this as `build_raw.py`. It reads one or more CBS CSV files, merges them, and writes the result as a JavaScript `const RAW = ...` snippet you can paste into the HTML.

```python
"""
build_raw.py
Converts CBS doodsoorzaken CSV exports to the RAW JavaScript constant
used in the Zelfdoding viewer.

Usage:
    python build_raw.py file1.csv file2.csv ... > raw.js

Output:
    A JavaScript snippet:  const RAW = {...};
"""

import csv
import json
import sys
from pathlib import Path


def parse_cbs_file(path: str) -> dict:
    """Parse a single CBS CSV export and return nested dict data."""
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        rows = list(reader)

    # Validate minimum structure
    if len(rows) < 7:
        raise ValueError(f"{path}: file appears empty (only {len(rows)} rows). "
                         "Re-download with data selected.")

    geslacht_row = rows[3]
    leeftijd_row = rows[4]
    perioden_row = rows[5]

    # Build column index: (geslacht, leeftijd, year) → column index
    col_map: dict[tuple, int] = {}
    for i in range(2, len(geslacht_row)):
        key = (geslacht_row[i], leeftijd_row[i], perioden_row[i])
        col_map[key] = i

    # Collect unique dimension values
    geslacht_vals = list(dict.fromkeys(geslacht_row[2:]))   # preserve order
    leeftijd_vals = list(dict.fromkeys(leeftijd_row[2:]))
    year_vals     = list(dict.fromkeys(perioden_row[2:]))

    # Parse data rows (skip header rows and trailing "Bron: CBS" line)
    result: dict = {}
    for row in rows[6:]:
        if not row or not row[0] or row[0].startswith("Bron"):
            continue

        cause = row[0]
        result[cause] = {}

        for g in geslacht_vals:
            result[cause][g] = {}
            for l in leeftijd_vals:
                result[cause][g][l] = {}
                for y in year_vals:
                    key = (g, l, y)
                    if key in col_map:
                        raw_val = row[col_map[key]].strip()
                        if raw_val.lstrip("-").isdigit():
                            result[cause][g][l][y] = int(raw_val)
                        elif raw_val == "":
                            result[cause][g][l][y] = None
                        else:
                            result[cause][g][l][y] = None

    return result


def merge(base: dict, incoming: dict) -> dict:
    """Deep-merge incoming into base. Leeftijdsgroepen are added, not overwritten."""
    for cause, geslacht_data in incoming.items():
        if cause not in base:
            base[cause] = {}
        for g, leeftijd_data in geslacht_data.items():
            if g not in base[cause]:
                base[cause][g] = {}
            for l, year_data in leeftijd_data.items():
                # Always take from the incoming file (later files win)
                base[cause][g][l] = year_data
    return base


def main(paths: list[str]) -> None:
    if not paths:
        print("Usage: python build_raw.py file1.csv [file2.csv ...]", file=sys.stderr)
        sys.exit(1)

    merged: dict = {}
    for path in paths:
        print(f"Reading {path} ...", file=sys.stderr)
        data = parse_cbs_file(path)
        merged = merge(merged, data)

    # Report what we found
    for cause, gdata in merged.items():
        for g, ldata in gdata.items():
            print(f"  {cause} | {g}: {len(ldata)} leeftijdsgroepen", file=sys.stderr)

    js_value = json.dumps(merged, ensure_ascii=False)
    print(f"const RAW = {js_value};")


if __name__ == "__main__":
    main(sys.argv[1:])
```

### Run it

```bash
python build_raw.py batch1.csv batch2.csv batch3.csv > raw.js
```

The output looks like:

```js
const RAW = {"17 Uitwendige doodsoorzaken|17.2 Zelfdoding": { ... }};
```

Copy the line and replace the `const RAW = ...;` line in the HTML file.

---

## 5. Using a different dataset entirely

If your source is not CBS StatLine, you need to reshape your data to match the same nested structure. The only hard requirements are:

1. **Top-level key** = the cause label. It can be anything, but it must match `CAUSE_KEY` in the script:
   ```js
   const CAUSE_KEY = "your label here";
   ```

2. **Geslacht keys** must be exactly `"Totaal mannen en vrouwen"`, `"Mannen"`, `"Vrouwen"` — or you update the geslacht buttons in the HTML.

3. **Leeftijdsgroep keys** must match the `data-l` attributes on the leeftijd buttons in the HTML — or you regenerate the buttons dynamically (see tip below).

4. **Year keys** are strings (`"2000"`, not `2000`). If your years differ from 2000–2024, update `ALL_YEARS` in the script:
   ```js
   const ALL_YEARS = Array.from({length: N}, (_, i) => START_YEAR + i);
   ```

5. **Values** are integers or `null`. Missing values (`null`) are silently skipped in the chart.

### Tip: generating buttons dynamically

If you have many leeftijdsgroepen and don't want to hardcode buttons, replace the static button HTML with this JavaScript snippet (add it before `populateSelects()`):

```js
// Dynamically generate leeftijd buttons from data
const leeftijdContainer = document.getElementById('leeftijd-btns');
const allLeeftijd = Object.keys(RAW[CAUSE_KEY]['Totaal mannen en vrouwen']);
allLeeftijd.forEach((l, i) => {
  const btn = document.createElement('button');
  btn.className = `btn age-${i}`;
  btn.dataset.l = l;
  btn.textContent = l.replace(' jaar', '').replace(' tot ', '–').replace(' of ouder', '+');
  leeftijdContainer.appendChild(btn);
});
```

---

## 6. Quick checklist

- [ ] CSV delimiter is `;` (semicolon), not `,`
- [ ] File encoding is UTF-8 (with or without BOM)
- [ ] File is larger than ~1 KB (otherwise the export was empty)
- [ ] Geslacht row is row index 3 (0-based), Leeftijd row is 4, Perioden row is 5
- [ ] `CAUSE_KEY` in the HTML matches the cause label in your data exactly
- [ ] `ALL_YEARS` in the HTML covers the years present in your data
- [ ] Leeftijdsgroep button `data-l` values match the keys in `RAW`
