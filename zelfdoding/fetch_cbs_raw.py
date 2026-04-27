"""
fetch_cbs_raw.py
================
Fetches CBS table 7052_95 (Overledenen; belangrijke doodsoorzaken,
leeftijd, geslacht) directly from the CBS OData v3 API and writes
the ``const RAW = {...};`` JavaScript snippet used by the Zelfdoding viewer.

Usage
-----
    python fetch_cbs_raw.py                        # prints JS to stdout
    python fetch_cbs_raw.py --out raw.js           # writes to file
    python fetch_cbs_raw.py --cache                # cache API responses in ./cache/
    python fetch_cbs_raw.py --cause "17.2"         # filter by cause substring

Requirements
------------
    pip install requests

CBS OData v3 API overview
-------------------------
Base URL: https://opendata.cbs.nl/ODataApi/OData/{TABLE_ID}/

Endpoints used:
  /TableInfos          → table title, modified date
  /DataProperties      → column names, types, units
  /DoodsoorzakenKorteLijst → dimension codes + labels for causes of death
  /Geslacht            → dimension codes + labels (Totaal / Mannen / Vrouwen)
  /Leeftijd            → dimension codes + labels (age groups)
  /Perioden            → dimension codes + labels (years)
  /TypedDataSet        → the actual data rows (paginated, max 10 000/call)

All responses are JSON with a "value" array.
Pagination: add ?$skip=N to get the next page of results.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TABLE_ID = "7052_95"
BASE_URL = f"https://opendata.cbs.nl/ODataApi/OData/{TABLE_ID}"
PAGE_SIZE = 10_000          # CBS maximum per request
REQUEST_TIMEOUT = 30        # seconds
RETRY_ATTEMPTS = 3
RETRY_DELAY = 2.0           # seconds between retries

# Map CBS dimension key names to the viewer's geslacht strings
GESLACHT_LABELS: dict[str, str] = {
    "T001038": "Totaal mannen en vrouwen",
    "3000":    "Mannen",
    "4000":    "Vrouwen",
}

# The cause key used in CAUSE_KEY inside the viewer HTML
CAUSE_LABEL_SEPARATOR = "|"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, params: dict[str, Any] | None = None,
         cache_dir: Path | None = None) -> list[dict]:
    """
    GET a CBS OData endpoint and return its ``value`` list.

    Handles pagination automatically: keeps fetching ``?$skip=N`` until
    the response contains fewer than PAGE_SIZE rows.

    Parameters
    ----------
    url:
        Full endpoint URL.
    params:
        Extra OData query parameters (e.g. ``{"$filter": "..."}``).
    cache_dir:
        If provided, responses are cached as JSON files under this directory.
        The cache key is the full URL + sorted params string.

    Returns
    -------
    list[dict]
        All rows collected across all pages.
    """
    all_rows: list[dict] = []
    skip = 0

    while True:
        page_params: dict[str, Any] = {"$format": "json"}
        if params:
            page_params.update(params)
        if skip > 0:
            page_params["$skip"] = skip

        cache_key = url + json.dumps(page_params, sort_keys=True)
        cache_path = (cache_dir / f"{abs(hash(cache_key))}.json"
                      if cache_dir else None)

        if cache_path and cache_path.exists():
            with open(cache_path, encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = _fetch_with_retry(url, page_params)
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)

        rows: list[dict] = data.get("value", [])
        all_rows.extend(rows)

        if len(rows) < PAGE_SIZE:
            break           # last page reached
        skip += PAGE_SIZE
        print(f"  … fetched {len(all_rows)} rows so far", file=sys.stderr)

    return all_rows


def _fetch_with_retry(url: str, params: dict[str, Any]) -> dict:
    """
    Perform a GET request with simple retry logic on transient errors.

    Parameters
    ----------
    url:
        Full endpoint URL.
    params:
        Query parameters.

    Returns
    -------
    dict
        Parsed JSON response body.

    Raises
    ------
    RuntimeError
        If all retry attempts fail.
    """
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            if attempt == RETRY_ATTEMPTS:
                raise RuntimeError(
                    f"Failed to fetch {url} after {RETRY_ATTEMPTS} attempts: {exc}"
                ) from exc
            print(
                f"  Attempt {attempt} failed ({exc}), retrying in "
                f"{RETRY_DELAY}s…",
                file=sys.stderr,
            )
            time.sleep(RETRY_DELAY)
    # unreachable, but satisfies type checkers
    raise RuntimeError("Unreachable")


# ---------------------------------------------------------------------------
# Dimension lookups
# ---------------------------------------------------------------------------

def fetch_dimension(endpoint: str, cache_dir: Path | None) -> dict[str, str]:
    """
    Fetch a CBS dimension table and return a mapping of Key → Title.

    Parameters
    ----------
    endpoint:
        Full URL of the dimension endpoint (e.g. ``.../Geslacht``).
    cache_dir:
        Optional cache directory.

    Returns
    -------
    dict[str, str]
        ``{code_key: label}``
    """
    rows = _get(endpoint, cache_dir=cache_dir)
    return {row["Key"].strip(): row["Title"].strip() for row in rows}


# ---------------------------------------------------------------------------
# Main data fetch
# ---------------------------------------------------------------------------

def fetch_data(cache_dir: Path | None,
               cause_filter: str | None) -> dict[str, dict]:
    """
    Fetch all data from CBS table 7052_95 and return the RAW structure.

    Parameters
    ----------
    cache_dir:
        Optional path for caching API responses.
    cause_filter:
        If given, only include causes whose label contains this substring
        (case-insensitive). Pass ``None`` to include all causes.

    Returns
    -------
    dict
        Nested dict:  cause → geslacht → leeftijd → year → int | None
    """
    print("Fetching dimension tables…", file=sys.stderr)

    cause_map  = fetch_dimension(f"{BASE_URL}/DoodsoorzakenKorteLijst", cache_dir)
    geslacht_map = fetch_dimension(f"{BASE_URL}/Geslacht", cache_dir)
    leeftijd_map = fetch_dimension(f"{BASE_URL}/Leeftijd", cache_dir)
    perioden_map = fetch_dimension(f"{BASE_URL}/Perioden", cache_dir)

    print(f"  {len(cause_map)} doodsoorzaken", file=sys.stderr)
    print(f"  {len(geslacht_map)} geslacht values", file=sys.stderr)
    print(f"  {len(leeftijd_map)} leeftijdsgroepen", file=sys.stderr)
    print(f"  {len(perioden_map)} perioden", file=sys.stderr)

    # Resolve geslacht codes to human-readable labels
    # Prefer our hardcoded map; fall back to CBS title
    def geslacht_label(key: str) -> str:
        return GESLACHT_LABELS.get(key, geslacht_map.get(key, key))

    # Build set of cause codes to include
    if cause_filter:
        wanted_causes = {
            k for k, v in cause_map.items()
            if cause_filter.lower() in v.lower()
        }
        if not wanted_causes:
            print(
                f"Warning: no causes matched filter '{cause_filter}'. "
                "Fetching all causes.",
                file=sys.stderr,
            )
            wanted_causes = set(cause_map)
    else:
        wanted_causes = set(cause_map)

    print(f"\nFetching TypedDataSet ({len(wanted_causes)} causes)…", file=sys.stderr)
    rows = _get(f"{BASE_URL}/TypedDataSet", cache_dir=cache_dir)
    print(f"  {len(rows)} rows received", file=sys.stderr)

    # Build nested structure
    raw: dict[str, dict] = {}

    for row in rows:
        cause_key   = row.get("DoodsoorzakenKorteLijst", "").strip()
        geslacht_key = row.get("Geslacht", "").strip()
        leeftijd_key = row.get("Leeftijd", "").strip()
        periode_key  = row.get("Perioden", "").strip()

        if cause_key not in wanted_causes:
            continue

        # Resolve labels
        # CBS stores cause codes like "A.1.17.2" with the title being the full
        # hierarchical label. We join with CAUSE_LABEL_SEPARATOR to match the
        # existing viewer convention.
        cause_parent = cause_map.get(cause_key, cause_key)
        cause_label  = cause_parent   # for flat causes, this is the full label

        geslacht_label_str = geslacht_label(geslacht_key)
        leeftijd_label_str = leeftijd_map.get(leeftijd_key, leeftijd_key)
        year               = periode_key[:4]   # "2024JJ00" → "2024"

        # Skip non-annual periods (quarters, months contain "KW" or "MM")
        if not year.isdigit():
            continue

        # Raw value field name for this table is "Zelfdoding_1" or similar;
        # we take the first numeric-looking column that is not a dimension key.
        value: int | None = None
        for col, val in row.items():
            if col in {"DoodsoorzakenKorteLijst", "Geslacht", "Leeftijd",
                       "Perioden", "ID"}:
                continue
            if isinstance(val, (int, float)):
                value = int(val) if val is not None else None
                break
            if isinstance(val, str) and val.strip().lstrip("-").isdigit():
                value = int(val.strip())
                break

        # Build nested dict
        raw.setdefault(cause_label, {})
        raw[cause_label].setdefault(geslacht_label_str, {})
        raw[cause_label][geslacht_label_str].setdefault(leeftijd_label_str, {})
        raw[cause_label][geslacht_label_str][leeftijd_label_str][year] = value

    return raw


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def to_js_const(raw: dict) -> str:
    """
    Serialise the RAW dict to a JavaScript ``const RAW = ...;`` statement.

    Parameters
    ----------
    raw:
        Nested data dict.

    Returns
    -------
    str
        Single-line JavaScript constant declaration.
    """
    return f"const RAW = {json.dumps(raw, ensure_ascii=False)};"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description=(
            "Fetch CBS doodsoorzaken data (table 7052_95) via OData API "
            "and output const RAW = {...}; for use in the Zelfdoding viewer."
        )
    )
    parser.add_argument(
        "--out", "-o",
        metavar="FILE",
        help="Write output to FILE instead of stdout (e.g. raw.js)",
    )
    parser.add_argument(
        "--cache",
        action="store_true",
        help="Cache API responses in ./cache/ to speed up repeated runs",
    )
    parser.add_argument(
        "--cache-dir",
        metavar="DIR",
        default="cache",
        help="Directory for cached responses (default: ./cache)",
    )
    parser.add_argument(
        "--cause",
        metavar="SUBSTRING",
        default=None,
        help=(
            "Only include causes whose label contains SUBSTRING "
            "(case-insensitive). E.g. --cause '17.2' for zelfdoding only."
        ),
    )
    parser.add_argument(
        "--table",
        metavar="TABLE_ID",
        default=TABLE_ID,
        help=f"CBS table identifier (default: {TABLE_ID})",
    )
    return parser.parse_args()


def main() -> None:
    """Entry point."""
    args = parse_args()

    # Allow overriding the table via CLI
    global BASE_URL, TABLE_ID
    if args.table != TABLE_ID:
        TABLE_ID = args.table
        BASE_URL = f"https://opendata.cbs.nl/ODataApi/OData/{TABLE_ID}"

    cache_dir: Path | None = Path(args.cache_dir) if args.cache else None
    if cache_dir:
        print(f"Cache enabled → {cache_dir.resolve()}", file=sys.stderr)

    try:
        raw = fetch_data(cache_dir=cache_dir, cause_filter=args.cause)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    js = to_js_const(raw)

    if args.out:
        Path(args.out).write_text(js, encoding="utf-8")
        print(f"Written to {args.out}", file=sys.stderr)

        # Print a summary
        for cause, gdata in raw.items():
            for g, ldata in gdata.items():
                year_counts = sum(len(y) for y in ldata.values())
                print(
                    f"  {cause[:60]} | {g}: "
                    f"{len(ldata)} groepen, {year_counts} datapunten",
                    file=sys.stderr,
                )
    else:
        print(js)


if __name__ == "__main__":
    main()
