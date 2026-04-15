#!/usr/bin/env python3
"""
generate_readme.py
------------------
Generates README.md for rcsmit.github.io from a JSON catalogue.

Usage:
    python generate_readme.py                        # reads catalogue.json, writes README.md
    python generate_readme.py --json my.json         # custom input file
    python generate_readme.py --out docs/README.md   # custom output path
    python generate_readme.py --dry-run              # print to stdout, don't write file
"""

import argparse
import json
import sys
from collections import OrderedDict
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://rcsmit.github.io"

# Category display order and emoji — add new categories here to control order.
# Any category found in the JSON but not listed here is appended at the end.
CATEGORY_META: dict[str, str] = {
    "Personal & Featured":  "👤  Personal & Featured",
    "Movement & Body":      "🤸  Movement & Body",
    "Geo & Maps":           "🌍  Geo & Maps",
    "Music & Visuals":      "🎵  Music & Visuals",
    "People & Profiles":    "👥  People & Profiles",
    "Tools & Apps":         "💡  Tools & Apps",
    "Coaching & Community": "🧘  Coaching & Community",
}

HEADER = """\
# René Smit — rcsmit.github.io

Multidisciplinary freelancer working at the intersection of **data, design, and movement**.
Python · Streamlit · Data viz · Web design · Yoga · Acroyoga

🔗 [rene-smit.com](https://rene-smit.com) · [rcsmit.streamlit.app](https://rcsmit.streamlit.app) · [github.com/rcsmit](https://github.com/rcsmit)

---
"""

FOOTER = """\

---


---

* · Netherlands *
""".format(base_url=BASE_URL)


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def load_catalogue(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        sys.exit(f"ERROR: Expected a JSON array in {path}, got {type(data).__name__}.")
    return data


def group_by_category(entries: list[dict]) -> "OrderedDict[str, list[dict]]":
    """
    Group entries by category, preserving the order defined in CATEGORY_META.
    Unknown categories are appended in the order they first appear in the JSON.
    Duplicate (category, directory) pairs are deduplicated, keeping first occurrence.
    """
    grouped: OrderedDict[str, list[dict]] = OrderedDict()

    # Pre-populate with known order
    for cat in CATEGORY_META:
        grouped[cat] = []

    seen: set[tuple[str, str]] = set()

    for entry in entries:
        cat = entry.get("category", "Uncategorised").strip()
        directory = entry.get("directory", "").strip()
        description = entry.get("description", "").strip()

        key = (cat, directory)
        if key in seen:
            continue
        seen.add(key)

        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({"directory": directory, "description": description})

    # Remove empty categories (those in CATEGORY_META with no entries)
    return OrderedDict((k, v) for k, v in grouped.items() if v)


def render_category(cat_name: str, entries: list[dict]) -> str:
    heading = CATEGORY_META.get(cat_name, f"📁  {cat_name}")
    lines = [f"## {heading}", "", "| Project | Description |", "|---|---|"]
    for e in entries:
        d = e["directory"]
        desc = e["description"]
        lines.append(f"| [{d}]({BASE_URL}/{d}) | {desc} |")
    lines.append("")
    return "\n".join(lines)


def generate(catalogue_path: Path) -> str:
    entries = load_catalogue(catalogue_path)
    grouped = group_by_category(entries)

    sections = [HEADER]
    for cat_name, cat_entries in grouped.items():
        sections.append(render_category(cat_name, cat_entries))
        sections.append("---\n")

    sections.append(FOOTER)
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate README.md from JSON catalogue.")
    parser.add_argument(
        "--json", dest="json_path",
        default="catalogue.json",
        help="Path to the JSON catalogue file (default: catalogue.json)",
    )
    parser.add_argument(
        "--out", dest="out_path",
        default="README.md",
        help="Output path for the generated README (default: README.md)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print output to stdout instead of writing a file",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    catalogue_path = Path(args.json_path)
    if not catalogue_path.exists():
        sys.exit(f"ERROR: catalogue file not found: {catalogue_path}")

    readme = generate(catalogue_path)

    if args.dry_run:
        print(readme)
    else:
        out_path = Path(args.out_path)
        out_path.write_text(readme, encoding="utf-8")
        print(f"✓ Written to {out_path}  ({len(readme):,} characters, "
              f"{readme.count(chr(10))} lines)")


if __name__ == "__main__":
    main()
