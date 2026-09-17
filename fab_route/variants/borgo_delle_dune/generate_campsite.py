#!/usr/bin/env python3
"""
Borgo delle Dune: a fictional 1,000-pitch campsite for FabRoute.

Generates the two shared FabRoute files for a made-up campsite, so the app can
be shown in a portfolio without the real campsite's map or branding:

  data.js     NODES, EDGES, PLOTS, M_PER_UNIT  (same shape the map-config-tool exports)
  map-svg.js  MAP_SVG + injectMapSvg()          (same shape as the production file)

The canvas keeps the production viewBox (1218.9 x 870.236), so VBW/VBH in the
HTML pages stay valid and both files are drop-in replacements.

Layout: a ring road with a central cross splits the site into four quarters.
Three quarters use straight lanes with back-to-back pitch rows; the south-east
quarter is built around a pond with two circular lanes and four spokes.
Everything is deterministic (fixed random seed), so reruns give identical files.

Usage:  python generate_campsite.py [output_dir]
"""
# version : 20260917-151801 - Initial version: layout, walking graph, SVG map, data.js/map-svg.js export
current_version = "20260917-151801"

import json
import math
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

Point = tuple[float, float]

# ---------------------------------------------------------------------------
# Canvas and scale
# ---------------------------------------------------------------------------
VBW, VBH = 1218.9, 870.236
M_PER_UNIT = 0.5          # 1 map unit = 0.5 m, so a pitch is roughly 9.6 x 10 m
TARGET_PLOTS = 1000
SEED = 20260917

# Road grid (centerlines)
X_W, X_MID, X_E = 60.0, 610.0, 1160.0
Y_N, Y_MID, Y_S = 60.0, 380.0, 690.0
MAIN_HALF = 6.0           # half width of the main roads
LANE_HALF = 5.0           # half width of the lanes
PITCH_W = 19.5            # target pitch width along a lane

# South-east pond quarter
POND_C: Point = (885.0, 535.0)
POND_R = 38.0
PROM_R = 48.0             # Anello del Laghetto
RING2_R = 100.0           # Cerchio dei Salici
GREEN_R = 149.0           # outer edge of the pond quarter's hedge ring
RINGS = [                 # (inner r, outer r, pitch count, facing street, category)
    (53.0, 74.0, 20, "Anello del Laghetto", "grey"),
    (74.0, 95.0, 28, "Cerchio dei Salici", "grey"),
    (105.0, 127.0, 36, "Cerchio dei Salici", "yellow"),
]

# Palette "Pineta & Terracotta"
PAL = {
    "outside": "#E7E1CF", "field": "#DDD5BD", "ground": "#E2ECD5",
    "hedge": "#B3CC9C", "fence": "#7E9B6C",
    "pitch_grey": "#F3F6EC", "pitch_yellow": "#F7DAC4",
    "road": "#FFFFFF", "road_edge": "#CDC1A9", "lane": "#FBF8F1", "lane_edge": "#D8CEBB",
    "public_road": "#D6D0C3",
    "tree": "#6F9E5C", "tree_dark": "#4D7B45", "tree_light": "#8DB876",
    "sea": "#6FB7C9", "sea_deep": "#4E9DB4", "shallow": "#A6D8E2",
    "sand": "#F1DFAF", "dune": "#E3CF94", "dune_grass": "#A3B26F",
    "water": "#5FB6CB", "pool": "#56C1D6", "deck": "#F2E6D0",
    "building": "#C9694C", "roof": "#A9523A", "teal": "#2E7D7A",
    "asphalt": "#D9D4C8", "court": "#8FBF7C", "playsand": "#EFD9A7",
    "wood": "#C9A77A", "ink": "#33423B", "muted": "#8C8270", "coral": "#E4674A",
    "cream": "#FBF6EA",
}


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class Street:
    name: str
    pts: list
    half: float
    kind: str                       # 'main' | 'lane' | 'path'
    closed: bool = False
    circle: tuple | None = None     # (cx, cy, r) for circular lanes (drawing only)
    extra: list = field(default_factory=list)   # extra split points on this street

    def segments(self) -> list:
        pts = self.pts + ([self.pts[0]] if self.closed else [])
        return list(zip(pts[:-1], pts[1:]))


@dataclass
class Plot:
    x: float
    y: float
    face: str                       # street the pitch opens onto
    category: str                   # 'yellow' | 'grey'
    zone: str
    sort_key: tuple
    rect: tuple | None = None       # (x0, y0, x1, y1) for straight pitches
    sector: tuple | None = None     # (r0, r1, a0, a1) for pond pitches, degrees
    trimmable: bool = False
    key: str = ""


@dataclass
class Facility:
    name: str                       # also the PLOTS key of the special location
    kind: str
    rect: tuple                     # (x0, y0, x1, y1)


@dataclass
class Power:
    x: float
    y: float
    face: str


@dataclass
class Label:
    text: str
    x: float
    y: float
    angle: float
    size: float
    kind: str                       # 'main' | 'lane'


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def seg_intersection(p: Point, p2: Point, q: Point, q2: Point):
    """Intersection point of two segments (endpoints included), or None."""
    rx, ry = p2[0] - p[0], p2[1] - p[1]
    sx, sy = q2[0] - q[0], q2[1] - q[1]
    den = rx * sy - ry * sx
    if abs(den) < 1e-9:
        return None
    qpx, qpy = q[0] - p[0], q[1] - p[1]
    t = (qpx * sy - qpy * sx) / den
    u = (qpx * ry - qpy * rx) / den
    tol = 1e-6
    if -tol <= t <= 1 + tol and -tol <= u <= 1 + tol:
        return (p[0] + t * rx, p[1] + t * ry)
    return None


def project_t(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    ll = dx * dx + dy * dy
    if ll == 0:
        return 0.0
    return max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ll))


def point_seg_dist(p: Point, a: Point, b: Point) -> float:
    t = project_t(p, a, b)
    return dist(p, (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))


def circle_pts(c: Point, r: float, n: int) -> list:
    """n vertices, starting at angle 0 (east), clockwise on screen."""
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n))
            for i in range(n)]


def polar(c: Point, r: float, deg: float) -> Point:
    a = math.radians(deg)
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))


def f1(v: float) -> str:
    """Compact number for SVG output."""
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------------------
# Layout: straight-lane quarters
# ---------------------------------------------------------------------------
def lane_quarter(zone, x0, x1, y0, y1, top_road, bottom_road, lane_names, facility_specs, category):
    """Horizontal lanes between two vertical roads, pitches back to back.

    facility_specs: dicts with name, kind, bands=(ka, kb), cols=(ca, cb).
    Band k is the double pitch row between street k and street k+1, where
    street 0 is the top road and street n+1 the bottom road. cols are column
    indices (end exclusive, negatives count from the right).
    """
    n = len(lane_names)
    inner = (y1 - MAIN_HALF) - (y0 + MAIN_HALF) - n * 2 * LANE_HALF
    depth = inner / (2 * (n + 1))
    names = [top_road] + lane_names + [bottom_road]
    halves = [MAIN_HALF] + [LANE_HALF] * n + [MAIN_HALF]

    ys = [y0]
    y = y0 + MAIN_HALF
    for _ in range(n):
        y += 2 * depth + LANE_HALF
        ys.append(y)
        y += LANE_HALF
    ys.append(y1)
    assert abs(y + 2 * depth - (y1 - MAIN_HALF)) < 1e-6

    left, right = x0 + MAIN_HALF, x1 - MAIN_HALF
    ncols = round((right - left) / PITCH_W)
    pw = (right - left) / ncols
    col_x = [left + i * pw for i in range(ncols + 1)]

    def band_top(k):
        return ys[k] + halves[k]

    def band_bot(k):
        return ys[k + 1] - halves[k + 1]

    facilities, fac_cells = [], []
    for spec in facility_specs:
        ca, cb = spec["cols"]
        ca = ca + ncols if ca < 0 else ca
        cb = cb + ncols if cb <= 0 else cb
        ka, kb = spec["bands"]
        facilities.append(Facility(spec["name"], spec["kind"],
                                   (col_x[ca], band_top(ka), col_x[cb], band_bot(kb))))
        fac_cells.append((ka, kb, ca, cb))

    def blocked(k, c):
        return any(ka <= k <= kb and ca <= c < cb for ka, kb, ca, cb in fac_cells)

    plots = []
    for k in range(n + 1):
        top, bot = band_top(k), band_bot(k)
        rows = [(top, top + depth, k, 1), (top + depth, bot, k + 1, 0)]
        for ta, tb, s, side in rows:
            for c in range(ncols):
                if blocked(k, c):
                    continue
                plots.append(Plot(
                    x=(col_x[c] + col_x[c + 1]) / 2, y=(ta + tb) / 2,
                    face=names[s], category=category, zone=zone,
                    sort_key=(s, side, c), rect=(col_x[c], ta, col_x[c + 1], tb),
                    trimmable=(1 <= s <= n and c in (0, ncols - 1)),
                ))

    streets, lane_pieces = [], []
    for j in range(1, n + 1):
        cuts = sorted((col_x[ca], col_x[cb]) for ka, kb, ca, cb in fac_cells if ka + 1 <= j <= kb)
        pieces = [(x0, x1)]
        for ca_x, cb_x in cuts:
            nxt = []
            for a, b in pieces:
                if cb_x <= a or ca_x >= b:
                    nxt.append((a, b))
                    continue
                if ca_x > a:
                    nxt.append((a, ca_x))
                if cb_x < b:
                    nxt.append((cb_x, b))
            pieces = nxt
        pieces = [(a, b) for a, b in pieces if (a == x0 or b == x1) and b - a > 15]
        for a, b in pieces:
            st = Street(names[j], [(a, ys[j]), (b, ys[j])], LANE_HALF, "lane")
            st.extra = [(col_x[c], ys[j]) for c in range(2, ncols, 2) if a + 3 < col_x[c] < b - 3]
            streets.append(st)
            lane_pieces.append((j, a, b))

    road_extra = {
        top_road: [(col_x[c], y0) for c in range(2, ncols, 2)],
        bottom_road: [(col_x[c], y1) for c in range(2, ncols, 2)],
    }

    power = []
    for j, a, b in lane_pieces:
        for c in range(1, ncols):
            if c % 9 != 4 or not (a + pw < col_x[c] < b - pw):
                continue
            up = (j + c) % 2 == 0
            band = j - 1 if up else j
            if blocked(band, c - 1) or blocked(band, c):
                continue
            yy = ys[j] - LANE_HALF if up else ys[j] + LANE_HALF
            power.append(Power(col_x[c], yy, names[j]))

    labels = []
    for j, a, b in lane_pieces:
        c_mid = min(range(ncols + 1), key=lambda c: abs(col_x[c] - (a + b) / 2))
        lx = col_x[c_mid] + (pw / 2 if b - a < 200 else 0)
        labels.append(Label(names[j], lx, ys[j], 0, 5.2, "lane"))

    bands = [(left, band_top(k), right, band_bot(k)) for k in range(n + 1)]
    return dict(plots=plots, facilities=facilities, streets=streets, road_extra=road_extra,
                power=power, labels=labels, bands=bands)


# ---------------------------------------------------------------------------
# Layout: pond quarter (south-east)
# ---------------------------------------------------------------------------
def pond_quarter():
    cx, cy = POND_C
    plots, streets, power, labels, facilities = [], [], [], [], []

    streets.append(Street("Anello del Laghetto", circle_pts(POND_C, PROM_R, 24), LANE_HALF, "lane",
                          closed=True, circle=(cx, cy, PROM_R)))
    streets.append(Street("Cerchio dei Salici", circle_pts(POND_C, RING2_R, 32), LANE_HALF, "lane",
                          closed=True, circle=(cx, cy, RING2_R)))
    spokes = [
        Street("Via delle Ninfee", [(cx, Y_MID), (cx, cy - PROM_R)], LANE_HALF, "lane"),
        Street("Via delle Canne", [(cx, Y_S), (cx, cy + PROM_R)], LANE_HALF, "lane"),
        Street("Via del Giunco", [(X_MID, cy), (cx - PROM_R, cy)], LANE_HALF, "lane"),
        Street("Via delle Libellule", [(X_E, cy), (cx + PROM_R, cy)], LANE_HALF, "lane"),
    ]
    streets += spokes

    # Circular pitch rings; the pitch centred on each spoke is left out.
    for ring_i, (r0, r1, count, face, cat) in enumerate(RINGS):
        step = 360.0 / count
        for i in range(count):
            a = i * step
            if abs(a % 90.0) < 1e-9:
                continue
            rm = (r0 + r1) / 2
            px, py = polar(POND_C, rm, a)
            plots.append(Plot(x=px, y=py, face=face, category=cat, zone="SE",
                              sort_key=(0, ring_i, (a - 270.0) % 360.0),
                              sector=(r0, r1, a - step / 2, a + step / 2)))

    # Side strips with a north-south lane each
    top, bot = Y_MID + MAIN_HALF, Y_S - MAIN_HALF
    ncells = round((bot - top) / 20.0)
    ph = (bot - top) / ncells
    cell_y = [top + i * ph for i in range(ncells + 1)]
    skip = int((cy - top) // ph)
    strips = [
        ("W", "Viale del Mare", "Via dei Pioppi", 663.0, [(616.0, 637.0, "road"), (637.0, 658.0, "lane"), (668.0, 689.0, "lane")]),
        ("E", "Viale Est", "Via degli Ontani", 1107.0, [(1133.0, 1154.0, "road"), (1112.0, 1133.0, "lane"), (1081.0, 1102.0, "lane")]),
    ]
    road_extra = {}
    for side_i, (tag, road, lane, lx, rows) in enumerate(strips):
        st = Street(lane, [(lx, Y_MID), (lx, Y_S)], LANE_HALF, "lane")
        st.extra = [(lx, cell_y[i]) for i in range(2, ncells, 2)]
        streets.append(st)
        road_extra[road] = [(X_MID if tag == "W" else X_E, cell_y[i]) for i in range(2, ncells, 2)]
        for row_i, (xa, xb, facing) in enumerate(rows):
            for i in range(ncells):
                if i == skip:
                    continue
                plots.append(Plot(x=(xa + xb) / 2, y=(cell_y[i] + cell_y[i + 1]) / 2,
                                  face=road if facing == "road" else lane, category="grey", zone="SE",
                                  sort_key=(1 + side_i, row_i, i),
                                  rect=(min(xa, xb), cell_y[i], max(xa, xb), cell_y[i + 1])))
        for i in (3, ncells - 3):
            px = lx + (LANE_HALF if i == 3 else -LANE_HALF)
            power.append(Power(px, cell_y[i], lane))
        labels.append(Label(lane, lx, (cell_y[2] + cell_y[3]) / 2 + 8, -90, 5.2, "lane"))

    for a in (45, 135, 225, 315):
        px, py = polar(POND_C, RING2_R - LANE_HALF, a)
        power.append(Power(px, py, "Cerchio dei Salici"))
    for a in (45, 225):
        px, py = polar(POND_C, PROM_R + LANE_HALF, a)
        power.append(Power(px, py, "Anello del Laghetto"))

    facilities.append(Facility("Toilets 4", "toilets", (699.0, 588.0, 723.0, 610.0)))
    facilities.append(Facility("Toilets 5", "toilets", (1047.0, 452.0, 1071.0, 474.0)))
    facilities.append(Facility("Lake", "lake", (cx - POND_R, cy - POND_R, cx + POND_R, cy + POND_R)))

    labels += [
        Label("Via delle Ninfee", cx, (Y_MID + cy - RING2_R) / 2 + 1, -90, 4.4, "lane"),
        Label("Via delle Canne", cx, (Y_S + cy + RING2_R) / 2 - 1, -90, 4.4, "lane"),
        Label("Via del Giunco", 738.0, cy, 0, 5.2, "lane"),
        Label("Via delle Libellule", 1034.0, cy, 0, 5.2, "lane"),
    ]
    return dict(plots=plots, facilities=facilities, streets=streets, road_extra=road_extra,
                power=power, labels=labels, spokes=spokes, strip_cells=(cell_y, skip))


# ---------------------------------------------------------------------------
# Walking graph
# ---------------------------------------------------------------------------
def build_graph(streets):
    """Split every street at crossings and extra points; return nodes and edges."""
    segs = []
    for si, st in enumerate(streets):
        for gi, (a, b) in enumerate(st.segments()):
            segs.append((si, gi, a, b))
    splits = {(si, gi): [a, b] for si, gi, a, b in segs}

    for i, (si, gi, a, b) in enumerate(segs):
        ax0, ax1 = sorted((a[0], b[0]))
        ay0, ay1 = sorted((a[1], b[1]))
        for sj, gj, c, d in segs[i + 1:]:
            if sj == si:
                continue
            if (max(c[0], d[0]) < ax0 - 0.01 or min(c[0], d[0]) > ax1 + 0.01
                    or max(c[1], d[1]) < ay0 - 0.01 or min(c[1], d[1]) > ay1 + 0.01):
                continue
            x = seg_intersection(a, b, c, d)
            if x is not None:
                splits[(si, gi)].append(x)
                splits[(sj, gj)].append(x)

    for si, st in enumerate(streets):
        sg = st.segments()
        for p in st.extra:
            gi = min(range(len(sg)), key=lambda g: point_seg_dist(p, *sg[g]))
            a, b = sg[gi]
            t = project_t(p, a, b)
            q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
            if all(dist(q, e) > 3.0 for e in splits[(si, gi)]):
                splits[(si, gi)].append(q)

    node_id, node_xy, node_streets = {}, {}, {}
    edges, seen = [], set()

    def nid(p):
        k = (round(p[0], 1), round(p[1], 1))
        if k not in node_id:
            node_id[k] = f"n{len(node_id)}"
            node_xy[node_id[k]] = k
            node_streets[node_id[k]] = set()
        return node_id[k]

    for si, gi, a, b in segs:
        name = streets[si].name
        pts = sorted(splits[(si, gi)], key=lambda p: project_t(p, a, b))
        ids = []
        for p in pts:
            i = nid(p)
            node_streets[i].add(name)
            if not ids or ids[-1] != i:
                ids.append(i)
        for u, v in zip(ids[:-1], ids[1:]):
            key = tuple(sorted((u, v)))
            if key in seen:
                continue
            seen.add(key)
            edges.append([u, v, name])
    return node_xy, node_streets, edges


def check_connected(node_xy, edges):
    adj = {n: [] for n in node_xy}
    for u, v, _ in edges:
        adj[u].append(v)
        adj[v].append(u)
    start = next(iter(adj))
    stack, seen = [start], {start}
    while stack:
        for w in adj[stack.pop()]:
            if w not in seen:
                seen.add(w)
                stack.append(w)
    return len(seen) == len(adj)


# ---------------------------------------------------------------------------
# Site assembly
# ---------------------------------------------------------------------------
def build_site():
    rng = random.Random(SEED)

    main_roads = [
        Street("Viale Nord", [(X_W, Y_N), (X_E, Y_N)], MAIN_HALF, "main"),
        Street("Viale Sud", [(X_W, Y_S), (X_E, Y_S)], MAIN_HALF, "main"),
        Street("Viale Ovest", [(X_W, Y_N), (X_W, Y_S)], MAIN_HALF, "main"),
        Street("Viale Est", [(X_E, Y_N), (X_E, Y_S)], MAIN_HALF, "main"),
        Street("Viale Centrale", [(X_W, Y_MID), (X_E, Y_MID)], MAIN_HALF, "main"),
        Street("Viale del Mare", [(X_MID, Y_N), (X_MID, Y_S)], MAIN_HALF, "main"),
        Street("Ingresso", [(10.0, Y_MID), (X_W, Y_MID)], MAIN_HALF, "main"),
        Street("Passeggiata al Mare", [(X_MID, Y_S), (X_MID, 768.0)], 4.0, "path"),
    ]
    by_name = {s.name: s for s in main_roads}

    nw = lane_quarter("NW", X_W, X_MID, Y_N, Y_MID, "Viale Nord", "Viale Centrale",
                      ["Via dei Pini", "Via dei Cipressi", "Via degli Ulivi", "Via dei Lecci", "Via dei Mirti"],
                      [dict(name="Reception", kind="reception", bands=(5, 5), cols=(0, 6)),
                       dict(name="Parking", kind="parking", bands=(4, 4), cols=(0, 6)),
                       dict(name="Toilets 1", kind="toilets", bands=(2, 2), cols=(13, 15))],
                      "grey")
    ne = lane_quarter("NE", X_MID, X_E, Y_N, Y_MID, "Viale Nord", "Viale Centrale",
                      ["Via delle Rose", "Via dei Gigli", "Via delle Viole", "Via dei Girasoli", "Via delle Dalie"],
                      [dict(name="Swimming pool", kind="pool", bands=(4, 5), cols=(0, 8)),
                       dict(name="Toilets 2", kind="toilets", bands=(1, 1), cols=(13, 15)),
                       dict(name="Playground", kind="playground", bands=(3, 3), cols=(22, 25))],
                      "yellow")
    sw = lane_quarter("SW", X_W, X_MID, Y_MID, Y_S, "Viale Centrale", "Viale Sud",
                      ["Via dei Gabbiani", "Via delle Rondini", "Via degli Aironi", "Via dei Fenicotteri", "Via delle Cicogne"],
                      [dict(name="Restaurant", kind="restaurant", bands=(0, 1), cols=(-7, -4)),
                       dict(name="Supermarket", kind="market", bands=(0, 1), cols=(-4, 0)),
                       dict(name="Sports field", kind="sports", bands=(3, 4), cols=(0, 7)),
                       dict(name="Toilets 3", kind="toilets", bands=(2, 2), cols=(13, 15)),
                       dict(name="Amphitheatre", kind="theatre", bands=(5, 5), cols=(9, 13))],
                      "grey")
    se = pond_quarter()

    quarters = [("NW", nw), ("NE", ne), ("SE", se), ("SW", sw)]
    streets = list(main_roads)
    for _, q in quarters:
        streets += q["streets"]
        for road, pts in q["road_extra"].items():
            by_name[road].extra += pts

    # Plots: trim to exactly TARGET_PLOTS by turning lane-end pitches into green pockets
    all_plots = [p for _, q in quarters for p in q["plots"]]
    excess = len(all_plots) - TARGET_PLOTS
    if excess < 0:
        raise SystemExit(f"layout only fits {len(all_plots)} pitches, need {TARGET_PLOTS}")
    candidates = [p for p in all_plots if p.trimmable]
    candidates.sort(key=lambda p: (p.zone, p.sort_key[0], p.sort_key[2], p.sort_key[1]))
    if len(candidates) < excess:
        raise SystemExit("not enough lane-end pitches to trim")
    stride = len(candidates) / excess
    trimmed = [candidates[int(i * stride)] for i in range(excess)]
    trimmed_ids = {id(p) for p in trimmed}
    plots = []
    zone_order = {"NW": 0, "NE": 1, "SE": 2, "SW": 3}
    for p in sorted((p for p in all_plots if id(p) not in trimmed_ids),
                    key=lambda p: (zone_order[p.zone], p.sort_key)):
        p.key = str(len(plots) + 1)
        plots.append(p)
    assert len(plots) == TARGET_PLOTS

    power = [pw for _, q in quarters for pw in q["power"]]
    facilities = [f for _, q in quarters for f in q["facilities"]]
    labels = [lb for _, q in quarters for lb in q["labels"]]

    node_xy, node_streets, edges = build_graph(streets)
    if not check_connected(node_xy, edges):
        raise SystemExit("walking graph is not connected")

    def nearest(pt, street=None):
        pool = [n for n in node_xy if street is None or street in node_streets[n]]
        if not pool:
            raise SystemExit(f"no nodes on street {street!r}")
        return min(pool, key=lambda n: dist(pt, node_xy[n]))

    data_plots = []
    for p in plots:
        data_plots.append({"key": p.key, "num": p.key, "x": round(p.x, 1), "y": round(p.y, 1),
                           "color": p.category, "node": nearest((p.x, p.y), p.face)})
    specials = [("Entrance", (22.0, Y_MID), "Ingresso"), ("Beach bar", (X_MID, 777.0), "Passeggiata al Mare")]
    for f in facilities:
        c = ((f.rect[0] + f.rect[2]) / 2, (f.rect[1] + f.rect[3]) / 2)
        specials.append((f.name, c, None))
    specials.sort(key=lambda s: s[0])
    for name, c, street in specials:
        data_plots.append({"key": name, "num": name, "x": round(c[0], 1), "y": round(c[1], 1),
                           "color": "grey", "node": nearest(c, street)})
    for i, pw in enumerate(power, 1):
        key = f"P{i:02d}"
        data_plots.append({"key": key, "num": key, "x": round(pw.x, 1), "y": round(pw.y, 1),
                           "color": "power", "node": nearest((pw.x, pw.y), pw.face)})

    # Main road labels
    labels += [
        Label("VIALE NORD", 335.0, Y_N, 0, 6.4, "main"), Label("VIALE NORD", 885.0, Y_N, 0, 6.4, "main"),
        Label("VIALE CENTRALE", 335.0, Y_MID, 0, 6.4, "main"), Label("VIALE CENTRALE", 885.0, Y_MID, 0, 6.4, "main"),
        Label("VIALE SUD", 335.0, Y_S, 0, 6.4, "main"), Label("VIALE SUD", 885.0, Y_S, 0, 6.4, "main"),
        Label("VIALE OVEST", X_W, 220.0, -90, 6.4, "main"), Label("VIALE OVEST", X_W, 535.0, -90, 6.4, "main"),
        Label("VIALE EST", X_E, 220.0, 90, 6.4, "main"), Label("VIALE EST", X_E, 610.0, 90, 6.4, "main"),
        Label("VIALE DEL MARE", X_MID, 220.0, -90, 6.4, "main"), Label("VIALE DEL MARE", X_MID, 455.0, -90, 6.4, "main"),
    ]

    return dict(rng=rng, streets=streets, plots=plots, trimmed=trimmed, power=power,
                facilities=facilities, labels=labels, node_xy=node_xy, edges=edges,
                data_plots=data_plots, bands=nw["bands"] + ne["bands"] + sw["bands"],
                spokes=se["spokes"])


# ---------------------------------------------------------------------------
# SVG rendering
# ---------------------------------------------------------------------------
SVG_STYLE = f"""
.bdd-t{{font-family:Figtree,'Segoe UI',Helvetica,Arial,sans-serif}}
.bdd-pn{{font-size:6px;fill:{PAL['ink']};text-anchor:middle;dominant-baseline:central;opacity:.72}}
.bdd-ln{{font-size:5.2px;fill:{PAL['muted']};text-anchor:middle;dominant-baseline:central;font-style:italic}}
.bdd-mn{{font-size:6.4px;fill:{PAL['muted']};text-anchor:middle;dominant-baseline:central;letter-spacing:1.6px;font-weight:600}}
.bdd-fl{{font-size:7px;fill:{PAL['ink']};text-anchor:middle;dominant-baseline:central;font-weight:700;letter-spacing:.8px}}
.bdd-py{{fill:{PAL['pitch_yellow']}}}
.bdd-pg{{fill:{PAL['pitch_grey']}}}
.bdd-tr{{fill:{PAL['tree']}}}
.bdd-td{{fill:{PAL['tree_dark']}}}
.bdd-tl{{fill:{PAL['tree_light']}}}
""".strip().replace("\n", "")


class SvgOut:
    def __init__(self):
        self.parts = []

    def add(self, s: str):
        self.parts.append(s)

    def rect(self, x0, y0, x1, y1, fill, rx=0.0, extra=""):
        r = f' rx="{f1(rx)}"' if rx else ""
        self.add(f'<rect x="{f1(x0)}" y="{f1(y0)}" width="{f1(x1 - x0)}" height="{f1(y1 - y0)}"{r} fill="{fill}"{extra}/>')

    def text(self, x, y, s, cls, angle=0.0, extra=""):
        tr = f' transform="rotate({f1(angle)} {f1(x)} {f1(y)})"' if angle else ""
        self.add(f'<text class="bdd-t {cls}" x="{f1(x)}" y="{f1(y)}"{tr}{extra}>{esc(s)}</text>')


def sector_path(c, r0, r1, a0, a1):
    p1, p2 = polar(c, r1, a0), polar(c, r1, a1)
    p3, p4 = polar(c, r0, a1), polar(c, r0, a0)
    return (f"M{f1(p1[0])},{f1(p1[1])}A{f1(r1)},{f1(r1)} 0 0 1 {f1(p2[0])},{f1(p2[1])}"
            f"L{f1(p3[0])},{f1(p3[1])}A{f1(r0)},{f1(r0)} 0 0 0 {f1(p4[0])},{f1(p4[1])}Z")


def draw_tree(svg: SvgOut, x, y, r):
    svg.add(f'<circle cx="{f1(x + r * .25)}" cy="{f1(y + r * .3)}" r="{f1(r)}" class="bdd-td"/>'
            f'<circle cx="{f1(x)}" cy="{f1(y)}" r="{f1(r)}" class="bdd-tr"/>'
            f'<circle cx="{f1(x - r * .3)}" cy="{f1(y - r * .3)}" r="{f1(r * .45)}" class="bdd-tl"/>')


def draw_facility(svg: SvgOut, f: Facility, rng: random.Random):
    x0, y0, x1, y1 = f.rect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = x1 - x0, y1 - y0
    if f.kind == "reception":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["deck"], 2)
        svg.rect(x0 + 10, y0 + 6, x1 - 34, y1 - 6, PAL["building"], 2)
        svg.rect(x0 + 10, y0 + 6, x1 - 34, y0 + 13, PAL["roof"], 2)
        for i in range(4):
            svg.add(f'<circle cx="{f1(x1 - 26 + i * 6)}" cy="{f1(cy + 8)}" r="2" fill="{PAL["coral"]}"/>')
        svg.add(f'<path d="M{f1(x1 - 20)},{f1(y0 + 5)}v16" stroke="{PAL["ink"]}" stroke-width=".8"/>'
                f'<path d="M{f1(x1 - 20)},{f1(y0 + 5)}l9,3l-9,3z" fill="{PAL["coral"]}"/>')
        svg.text((x0 + x1 - 24) / 2, cy + 3, "RECEPTION", "bdd-fl", extra=' fill="#fff" style="fill:#fff"')
    elif f.kind == "parking":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["asphalt"], 2)
        stall = 9.5
        nx = int((w - 4) / stall)
        mid = cy
        for i in range(nx + 1):
            xx = x0 + 2 + i * stall
            svg.add(f'<path d="M{f1(xx)},{f1(y0 + 2)}V{f1(mid - 4)}M{f1(xx)},{f1(mid + 4)}V{f1(y1 - 2)}" '
                    f'stroke="#fff" stroke-width=".7"/>')
        for i in range(nx):
            if rng.random() < 0.55:
                col = rng.choice(["#8FA7B3", "#C98B6B", "#E9E4DA", "#6E7F8C", "#B9B06F"])
                row = rng.random() < 0.5
                yy = (y0 + 4) if row else (mid + 6)
                svg.rect(x0 + 3.5 + i * stall, yy, x0 + 9.5 + i * stall, yy + (mid - y0 - 10), col, 1.5)
        svg.add(f'<circle cx="{f1(x1 - 12)}" cy="{f1(cy)}" r="7" fill="{PAL["teal"]}" stroke="#fff" stroke-width="1.2"/>')
        svg.text(x1 - 12, cy + .5, "P", "bdd-fl", extra=' style="fill:#fff;font-size:9px"')
    elif f.kind == "toilets":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["hedge"], 2)
        bw, bh = min(w - 6, 26), min(h - 8, 18)
        svg.rect(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, PAL["teal"], 2.5)
        svg.text(cx, cy + .3, "WC", "bdd-fl", extra=' style="fill:#fff;font-size:7px"')
    elif f.kind == "pool":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["deck"], 3)
        px0, py0, px1, py1 = x0 + 12, y0 + 16, x0 + 12 + w * 0.56, y1 - 16
        svg.rect(px0 - 2, py0 - 2, px1 + 2, py1 + 2, "#fff", 8)
        svg.rect(px0, py0, px1, py1, PAL["pool"], 7)
        for i in range(1, 5):
            yy = py0 + i * (py1 - py0) / 5
            svg.add(f'<path d="M{f1(px0 + 6)},{f1(yy)}H{f1(px1 - 6)}" stroke="#fff" stroke-width=".7" '
                    f'stroke-dasharray="3 2" opacity=".8"/>')
        kx, ky = x1 - 30, y0 + 30
        svg.add(f'<circle cx="{f1(kx)}" cy="{f1(ky)}" r="15" fill="#fff"/>'
                f'<circle cx="{f1(kx)}" cy="{f1(ky)}" r="13" fill="{PAL["pool"]}"/>')
        for i in range(6):
            sx = x1 - 44 + i * 7
            svg.rect(sx, y1 - 30, sx + 4, y1 - 20, "#fff", 1, extra=f' stroke="{PAL["muted"]}" stroke-width=".4"')
        for i in range(3):
            ux, uy = x1 - 40 + i * 14, y1 - 42
            svg.add(f'<circle cx="{f1(ux)}" cy="{f1(uy)}" r="5" fill="{PAL["coral"] if i % 2 == 0 else PAL["teal"]}"/>'
                    f'<circle cx="{f1(ux)}" cy="{f1(uy)}" r="1" fill="#fff"/>')
        svg.text((px0 + px1) / 2, (py0 + py1) / 2, "PISCINA", "bdd-fl", extra=' style="fill:#fff;font-size:9px;letter-spacing:2px"')
    elif f.kind == "playground":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["playsand"], 6)
        svg.add(f'<circle cx="{f1(x0 + 14)}" cy="{f1(cy - 5)}" r="6" fill="none" stroke="{PAL["coral"]}" stroke-width="2"/>'
                f'<path d="M{f1(cx - 4)},{f1(y1 - 7)}l7,-14l7,14z" fill="{PAL["teal"]}"/>'
                f'<rect x="{f1(x1 - 20)}" y="{f1(y0 + 7)}" width="12" height="4" rx="2" fill="{PAL["building"]}"/>'
                f'<rect x="{f1(x1 - 18)}" y="{f1(y0 + 14)}" width="10" height="4" rx="2" fill="{PAL["building"]}"/>')
        svg.text(cx, y1 - 5, "GIOCHI", "bdd-fl", extra=' style="font-size:5.5px"')
    elif f.kind in ("restaurant", "market"):
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["deck"], 3)
        svg.rect(x0 + 5, y0 + 5, x1 - 5, cy + 6, PAL["building"], 3)
        svg.rect(x0 + 5, y0 + 5, x1 - 5, y0 + 12, PAL["roof"], 3)
        if f.kind == "restaurant":
            for i in range(3):
                for j in range(2):
                    tx, ty = x0 + 12 + i * (w - 24) / 2, cy + 16 + j * 12
                    svg.add(f'<circle cx="{f1(tx)}" cy="{f1(ty)}" r="3.2" fill="#fff" stroke="{PAL["muted"]}" stroke-width=".4"/>')
            svg.text(cx, y0 + 26, "RISTORANTE", "bdd-fl", extra=' style="fill:#fff;font-size:5px;letter-spacing:.3px"')
        else:
            for i in range(5):
                svg.rect(x0 + 10 + i * (w - 20) / 5, cy + 14, x0 + 16 + i * (w - 20) / 5, y1 - 8,
                         PAL["coral"] if i % 2 else PAL["teal"], 1)
            svg.text(cx, y0 + 26, "MARKET", "bdd-fl", extra=' style="fill:#fff;font-size:7px"')
    elif f.kind == "sports":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["court"], 3)
        fx0, fy0, fx1, fy1 = x0 + 8, y0 + 8, x1 - 8, y1 - 8
        svg.add(f'<rect x="{f1(fx0)}" y="{f1(fy0)}" width="{f1(fx1 - fx0)}" height="{f1(fy1 - fy0)}" '
                f'fill="none" stroke="#fff" stroke-width="1.1"/>'
                f'<path d="M{f1(cx)},{f1(fy0)}V{f1(fy1)}" stroke="#fff" stroke-width="1.1"/>'
                f'<circle cx="{f1(cx)}" cy="{f1(cy)}" r="10" fill="none" stroke="#fff" stroke-width="1.1"/>'
                f'<rect x="{f1(fx0)}" y="{f1(cy - 14)}" width="12" height="28" fill="none" stroke="#fff" stroke-width="1.1"/>'
                f'<rect x="{f1(fx1 - 12)}" y="{f1(cy - 14)}" width="12" height="28" fill="none" stroke="#fff" stroke-width="1.1"/>')
        svg.text(cx, fy0 + 9, "SPORT", "bdd-fl", extra=' style="fill:#fff;font-size:6px;letter-spacing:2px"')
    elif f.kind == "theatre":
        svg.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, PAL["hedge"], 3)
        sx, sy = cx, y1 - 5
        for i, r in enumerate((30, 24, 18, 12)):
            svg.add(f'<path d="M{f1(sx - r)},{f1(sy)}A{r},{r} 0 0 1 {f1(sx + r)},{f1(sy)}" fill="none" '
                    f'stroke="{PAL["deck"] if i % 2 else "#fff"}" stroke-width="4.5"/>')
        svg.rect(sx - 8, sy - 6, sx + 8, sy, PAL["building"], 1.5)
        svg.text(cx, y0 + 7, "ANFITEATRO", "bdd-fl", extra=' style="font-size:5.5px"')
    elif f.kind == "lake":
        c = POND_C
        svg.add(f'<circle cx="{f1(c[0])}" cy="{f1(c[1])}" r="{f1(POND_R + 3)}" fill="{PAL["dune_grass"]}" opacity=".55"/>'
                f'<circle cx="{f1(c[0])}" cy="{f1(c[1])}" r="{f1(POND_R)}" fill="{PAL["water"]}"/>'
                f'<circle cx="{f1(c[0])}" cy="{f1(c[1])}" r="{f1(POND_R - 7)}" fill="none" stroke="#fff" '
                f'stroke-width=".7" opacity=".5" stroke-dasharray="4 6"/>'
                f'<ellipse cx="{f1(c[0] + 12)}" cy="{f1(c[1] - 8)}" rx="9" ry="6" fill="{PAL["sand"]}"/>')
        draw_tree(svg, c[0] + 12, c[1] - 9, 4)
        for a in range(20, 360, 40):
            px, py = polar(c, POND_R - 2, a)
            svg.add(f'<path d="M{f1(px)},{f1(py)}l-1.5,-4M{f1(px)},{f1(py)}l0,-5M{f1(px)},{f1(py)}l1.5,-4" '
                    f'stroke="{PAL["tree_dark"]}" stroke-width=".7"/>')
        svg.text(c[0] - 6, c[1] + 12, "LAGHETTO", "bdd-fl", extra=' style="fill:#fff;font-size:6px;letter-spacing:1.5px"')


def render_svg(site) -> str:
    rng = random.Random(SEED + 1)
    svg = SvgOut()
    streets, plots = site["streets"], site["plots"]

    svg.add(f'<svg id="mapSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VBW} {VBH}" '
            f'preserveAspectRatio="xMidYMid meet">')
    svg.add(f'<defs><style>{SVG_STYLE}</style>'
            f'<linearGradient id="bddSea" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{PAL["shallow"]}"/><stop offset=".25" stop-color="{PAL["sea"]}"/>'
            f'<stop offset="1" stop-color="{PAL["sea_deep"]}"/></linearGradient>'
            f'<pattern id="bddField" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">'
            f'<rect width="14" height="14" fill="{PAL["outside"]}"/><path d="M0,7H14" stroke="{PAL["field"]}" stroke-width="3"/>'
            f'</pattern></defs>')
    svg.add('<g id="bgGroup">')

    # Land, dunes, beach, sea
    svg.rect(0, 0, VBW, VBH, "url(#bddField)")
    shore = [(0.0, 796.0)]
    for i in range(1, 25):
        x = VBW * i / 24
        shore.append((x, 796.0 + 4.5 * math.sin(i * 1.3) + 2.5 * math.sin(i * 0.47)))
    shore_d = "L".join(f"{f1(x)},{f1(y)}" for x, y in shore)
    svg.add(f'<path d="M0,{f1(VBH)}L{shore_d}L{f1(VBW)},{f1(VBH)}Z" fill="url(#bddSea)"/>')
    svg.add(f'<path d="M0,730L{shore_d}L{f1(VBW)},730Z" fill="{PAL["sand"]}"/>')
    foam = "L".join(f"{f1(x)},{f1(y - 1.5)}" for x, y in shore)
    svg.add(f'<path d="M{foam}" fill="none" stroke="#fff" stroke-width="1.6" opacity=".75"/>')
    for k, yy in enumerate((812.0, 832.0, 852.0)):
        wave = " ".join(f"M{f1(x)},{f1(yy)}q6,-3 12,0" for x in range(40 + k * 30, int(VBW) - 20, 90))
        svg.add(f'<path d="{wave}" fill="none" stroke="#fff" stroke-width=".8" opacity=".45"/>')
    dune_top = "L".join(f"{f1(VBW * i / 40)},{f1(716 + 4 * math.sin(i * 0.9))}" for i in range(41))
    svg.add(f'<path d="M0,738L{dune_top}L{f1(VBW)},738Z" fill="{PAL["dune"]}"/>')
    for _ in range(170):
        gx, gy = rng.uniform(4, VBW - 4), rng.uniform(722, 737)
        svg.add(f'<path d="M{f1(gx)},{f1(gy)}l-1.6,-3.5M{f1(gx)},{f1(gy)}l0,-4.2M{f1(gx)},{f1(gy)}l1.6,-3.5" '
                f'stroke="{PAL["dune_grass"]}" stroke-width=".7"/>')

    # Public coast road on the west
    svg.rect(2, 0, 18, 730, PAL["public_road"])
    svg.add(f'<path d="M10,0V730" stroke="#fff" stroke-width=".8" stroke-dasharray="6 6"/>')
    svg.text(10, 160, "SP 42 LITORANEA", "bdd-mn", -90, extra=' style="fill:#8C8270"')

    # Campsite ground + fence
    svg.rect(34, 34, 1186, 714, PAL["ground"], 22)
    svg.add(f'<rect x="34" y="34" width="1152" height="680" rx="22" fill="none" stroke="{PAL["fence"]}" '
            f'stroke-width="1.2" stroke-dasharray="5 3"/>')

    # Hedge bands under pitch rows
    for x0, y0, x1, y1 in site["bands"]:
        svg.rect(x0, y0, x1, y1, PAL["hedge"])
    svg.add(f'<circle cx="{f1(POND_C[0])}" cy="{f1(POND_C[1])}" r="{f1(RINGS[-1][1])}" fill="{PAL["hedge"]}"/>')
    svg.rect(616, 386, 689, 684, PAL["hedge"])
    svg.rect(1081, 386, 1154, 684, PAL["hedge"])

    # Facilities (under roads so lane ends tuck in neatly)
    for f in site["facilities"]:
        draw_facility(svg, f, rng)

    # Pitches
    ins = 1.1
    out = []
    for p in plots:
        cls = "bdd-py" if p.category == "yellow" else "bdd-pg"
        if p.rect:
            x0, y0, x1, y1 = p.rect
            out.append(f'<rect class="{cls}" x="{f1(x0 + ins)}" y="{f1(y0 + ins)}" '
                       f'width="{f1(x1 - x0 - 2 * ins)}" height="{f1(y1 - y0 - 2 * ins)}" rx="1.6"/>')
        else:
            r0, r1, a0, a1 = p.sector
            pad = math.degrees(ins / ((r0 + r1) / 2))
            out.append(f'<path class="{cls}" d="{sector_path(POND_C, r0 + ins, r1 - ins, a0 + pad, a1 - pad)}"/>')
    svg.add("".join(out))
    # Green pockets where lane-end pitches were trimmed
    for p in site["trimmed"]:
        x0, y0, x1, y1 = p.rect
        svg.rect(x0 + ins, y0 + ins, x1 - ins, y1 - ins, PAL["ground"], 1.6)

    # Roads: casings first, then surfaces
    def road_path(st):
        if st.circle:
            return None
        return "M" + "L".join(f"{f1(x)},{f1(y)}" for x, y in st.pts)

    for layer in ("edge", "surface"):
        for st in streets:
            if st.kind == "path":
                continue
            wdt = st.half * 2 + (1.6 if layer == "edge" else 0)
            if st.kind == "main":
                col = PAL["road_edge"] if layer == "edge" else PAL["road"]
            else:
                col = PAL["lane_edge"] if layer == "edge" else PAL["lane"]
            if st.circle:
                cx, cy, r = st.circle
                svg.add(f'<circle cx="{f1(cx)}" cy="{f1(cy)}" r="{f1(r)}" fill="none" stroke="{col}" stroke-width="{f1(wdt)}"/>')
            elif st.name in ("Viale Nord", "Viale Sud", "Viale Ovest", "Viale Est"):
                continue
            else:
                svg.add(f'<path d="{road_path(st)}" fill="none" stroke="{col}" stroke-width="{f1(wdt)}" stroke-linecap="butt"/>')
        wdt = MAIN_HALF * 2 + (1.6 if layer == "edge" else 0)
        col = PAL["road_edge"] if layer == "edge" else PAL["road"]
        svg.add(f'<rect x="{f1(X_W)}" y="{f1(Y_N)}" width="{f1(X_E - X_W)}" height="{f1(Y_S - Y_N)}" rx="14" '
                f'fill="none" stroke="{col}" stroke-width="{f1(wdt)}"/>')
    # Centre dashes on the main roads
    for st in streets:
        if st.kind == "main" and st.name not in ("Viale Nord", "Viale Sud", "Viale Ovest", "Viale Est"):
            svg.add(f'<path d="{road_path(st)}" fill="none" stroke="{PAL["road_edge"]}" stroke-width=".5" '
                    f'stroke-dasharray="4 5" opacity=".7"/>')
    svg.add(f'<rect x="{f1(X_W)}" y="{f1(Y_N)}" width="{f1(X_E - X_W)}" height="{f1(Y_S - Y_N)}" rx="14" '
            f'fill="none" stroke="{PAL["road_edge"]}" stroke-width=".5" stroke-dasharray="4 5" opacity=".7"/>')
    # Roundabout at the central crossing
    svg.add(f'<circle cx="{f1(X_MID)}" cy="{f1(Y_MID)}" r="11" fill="{PAL["road"]}" stroke="{PAL["road_edge"]}" stroke-width=".8"/>'
            f'<circle cx="{f1(X_MID)}" cy="{f1(Y_MID)}" r="5" fill="{PAL["tree"]}"/>')

    # Boardwalk to the beach + beach bar
    svg.rect(X_MID - 4.5, Y_S + MAIN_HALF, X_MID + 4.5, 769, PAL["wood"])
    for yy in range(int(Y_S + MAIN_HALF) + 3, 768, 4):
        svg.add(f'<path d="M{f1(X_MID - 4.5)},{yy}h9" stroke="#fff" stroke-width=".4" opacity=".6"/>')
    svg.rect(588, 768, 632, 788, PAL["wood"], 2)
    svg.rect(594, 771, 626, 785, PAL["building"], 2)
    svg.text(X_MID, 778.3, "BAR", "bdd-fl", extra=' style="fill:#fff;font-size:6px"')
    for row, yy in enumerate((748.0, 764.0, 780.0)):
        for i in range(16):
            ux = 330 + i * 38 + (row % 2) * 19
            if 560 < ux < 660:
                continue
            col = PAL["coral"] if (i + row) % 2 == 0 else PAL["teal"]
            svg.add(f'<circle cx="{f1(ux)}" cy="{f1(yy)}" r="5" fill="{col}"/>'
                    f'<path d="M{f1(ux - 5)},{f1(yy)}h10M{f1(ux)},{f1(yy - 5)}v10" stroke="#fff" stroke-width=".5"/>')
    svg.text(215, 762, "SPIAGGIA", "bdd-mn", extra=' style="fill:#B79A5C;font-size:9px;letter-spacing:6px"')

    # Entrance gate
    svg.add(f'<rect x="30" y="{f1(Y_MID - 10)}" width="8" height="20" fill="{PAL["teal"]}" rx="1.5"/>'
            f'<path d="M34,{f1(Y_MID - 8)}V{f1(Y_MID + 8)}" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 2"/>')
    svg.text(24, Y_MID - 16, "INGRESSO", "bdd-fl", extra=' style="font-size:5.5px"')

    # Trees
    trees = place_trees(site, rng)
    svg.add("".join(_tree_markup(x, y, r) for x, y, r in trees))

    # Pitch numbers
    svg.add("".join(f'<text class="bdd-t bdd-pn" x="{f1(p.x)}" y="{f1(p.y)}">{p.key}</text>' for p in plots))

    # Street labels
    for lb in site["labels"]:
        cls = "bdd-mn" if lb.kind == "main" else "bdd-ln"
        style = f' style="font-size:{lb.size}px"' if lb.kind == "lane" and lb.size != 5.2 else ""
        svg.text(lb.x, lb.y, lb.text, cls, lb.angle, extra=style)
    cx, cy = POND_C
    for rid, r, span, name in (("bddArc1", PROM_R, (190.0, 262.0), "Anello del Laghetto"),
                               ("bddArc2", RING2_R, (200.0, 250.0), "Cerchio dei Salici")):
        a0, a1 = polar(POND_C, r, span[0]), polar(POND_C, r, span[1])
        svg.add(f'<path id="{rid}" d="M{f1(a0[0])},{f1(a0[1])}A{f1(r)},{f1(r)} 0 0 1 {f1(a1[0])},{f1(a1[1])}" fill="none"/>'
                f'<text class="bdd-t bdd-ln" style="font-size:{4.6 if r < 60 else 5.2}px">'
                f'<textPath href="#{rid}" startOffset="50%">{name}</textPath></text>')

    # Cartouche, compass and scale bar in the sea
    svg.add(f'<g transform="translate(40 816)">'
            f'<rect width="300" height="40" rx="8" fill="{PAL["cream"]}" opacity=".95"/>'
            f'<rect x="4" y="4" width="292" height="32" rx="6" fill="none" stroke="{PAL["building"]}" stroke-width=".6"/>'
            f'<text class="bdd-t" x="14" y="21" style="font-size:15px;font-weight:800;fill:{PAL["ink"]};letter-spacing:.5px">Borgo delle Dune</text>'
            f'<text class="bdd-t" x="15" y="31" style="font-size:6.2px;fill:{PAL["muted"]};letter-spacing:1.4px">CAMPING VILLAGE · 1000 PIAZZOLE · FICTIONAL MAP</text>'
            f'<circle cx="274" cy="20" r="11" fill="{PAL["coral"]}"/>'
            f'<path d="M266,24q8,-12 16,0" fill="none" stroke="#fff" stroke-width="1.4"/>'
            f'<circle cx="274" cy="15" r="3" fill="#fff"/></g>')
    bar_units = 100 / M_PER_UNIT
    sx, sy = VBW - 60 - bar_units, 846
    svg.add(f'<g><rect x="{f1(sx - 10)}" y="{f1(sy - 18)}" width="{f1(bar_units + 20)}" height="28" rx="6" '
            f'fill="{PAL["cream"]}" opacity=".9"/>'
            f'<rect x="{f1(sx)}" y="{f1(sy)}" width="{f1(bar_units / 2)}" height="3" fill="{PAL["ink"]}"/>'
            f'<rect x="{f1(sx + bar_units / 2)}" y="{f1(sy)}" width="{f1(bar_units / 2)}" height="3" fill="#fff" '
            f'stroke="{PAL["ink"]}" stroke-width=".5"/>')
    svg.text(sx, sy - 6, "0", "bdd-ln", extra=' style="font-style:normal"')
    svg.text(sx + bar_units / 2, sy - 6, "50", "bdd-ln", extra=' style="font-style:normal"')
    svg.text(sx + bar_units, sy - 6, "100 m", "bdd-ln", extra=' style="font-style:normal"')
    svg.add("</g>")
    kx, ky = VBW - 30, 838
    svg.add(f'<g><circle cx="{f1(kx)}" cy="{f1(ky)}" r="14" fill="{PAL["cream"]}" opacity=".9"/>'
            f'<path d="M{f1(kx)},{f1(ky - 11)}l4,11h-8z" fill="{PAL["coral"]}"/>'
            f'<path d="M{f1(kx)},{f1(ky + 11)}l4,-11h-8z" fill="{PAL["ink"]}" opacity=".5"/></g>')
    svg.text(kx, ky - 19, "N", "bdd-fl", extra=' style="font-size:6px;fill:#fff"')

    svg.add("</g></svg>")
    return "".join(svg.parts)


def _tree_markup(x, y, r):
    return (f'<circle cx="{f1(x + r * .25)}" cy="{f1(y + r * .3)}" r="{f1(r)}" class="bdd-td"/>'
            f'<circle cx="{f1(x)}" cy="{f1(y)}" r="{f1(r)}" class="bdd-tr"/>'
            f'<circle cx="{f1(x - r * .3)}" cy="{f1(y - r * .3)}" r="{f1(r * .45)}" class="bdd-tl"/>')


def place_trees(site, rng):
    """Scatter trees in the green areas, never on a road, pitch or building."""
    road_segs = [(a, b, st.half) for st in site["streets"] for a, b in st.segments()]
    blocked_rects = [f.rect for f in site["facilities"] if f.kind != "lake"]
    blocked_rects.append((586, 766, 634, 790))
    trees = []

    def clear(x, y, r, min_gap=2.0):
        for a, b, h in road_segs:
            if point_seg_dist((x, y), a, b) < h + r + 1.2:
                return False
        for x0, y0, x1, y1 in blocked_rects:
            if x0 - r - 1 < x < x1 + r + 1 and y0 - r - 1 < y < y1 + r + 1:
                return False
        return all(dist((x, y), (tx, ty)) > r + tr + min_gap for tx, ty, tr in trees)

    def scatter(n_try, sampler, extra_ok=lambda x, y, r: True, rmin=3.2, rmax=6.0):
        for _ in range(n_try):
            x, y = sampler()
            r = rng.uniform(rmin, rmax)
            if extra_ok(x, y, r) and clear(x, y, r):
                trees.append((x, y, r))

    # Outside pine wood (north and east)
    scatter(900, lambda: (rng.uniform(28, VBW - 8), rng.uniform(4, 28)), rmin=4, rmax=7.5)
    scatter(500, lambda: (rng.uniform(1192, VBW - 4), rng.uniform(28, 714)), rmin=4, rmax=7.5)
    # Belt between fence and ring road
    scatter(900, lambda: (rng.uniform(42, 1178), rng.uniform(40, 50)), rmin=3, rmax=4.6)
    scatter(700, lambda: (rng.uniform(40, 50), rng.uniform(46, 704)),
            extra_ok=lambda x, y, r: abs(y - Y_MID) > 28, rmin=3, rmax=4.6)
    scatter(700, lambda: (rng.uniform(1170, 1180), rng.uniform(46, 704)), rmin=3, rmax=4.6)

    # Pond quarter: outer hedge ring and the buffers next to the strips
    cx, cy = POND_C
    spokes = site["spokes"]

    def off_spokes(x, y, r):
        return all(point_seg_dist((x, y), *sp.segments()[0]) > LANE_HALF + r + 1.5 for sp in spokes)

    def ring_sampler():
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(RINGS[-1][1] + 5, GREEN_R - 4)
        return cx + rr * math.cos(a), cy + rr * math.sin(a)

    scatter(900, ring_sampler, off_spokes, rmin=3.2, rmax=5.2)

    def buffer_ok(x, y, r):
        return dist((x, y), POND_C) > GREEN_R + r + 1 and off_spokes(x, y, r)

    scatter(900, lambda: (rng.uniform(694, 800), rng.uniform(392, 678)),
            lambda x, y, r: x - r > 690 and buffer_ok(x, y, r), rmin=3.5, rmax=6.5)
    scatter(900, lambda: (rng.uniform(970, 1076), rng.uniform(392, 678)),
            lambda x, y, r: x + r < 1080 and buffer_ok(x, y, r), rmin=3.5, rmax=6.5)

    # Green pockets: one tree each
    for p in site["trimmed"]:
        trees.append((p.x, p.y, 5.0))
    return trees


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def write_data_js(site, path: Path):
    nodes = {k: [v[0], v[1]] for k, v in site["node_xy"].items()}
    body = [
        f"// version : {current_version} - Borgo delle Dune (fictional portfolio campsite), generated by generate_campsite.py",
        "// FabRoute \u2014 shared graph data.",
        "//",
        "// Loaded by index.html, map-config-tool.html and power.html. This is the only",
        "// place these constants exist; edit the graph in map-config-tool.html and",
        "// use its \"Export data.js\" panel to regenerate this whole file.",
        "//",
        "// PLOTS is `let` on purpose: map-config-tool.html reassigns it when a plot is",
        "// deleted. NODES and EDGES are only ever mutated in place.",
        "//",
        f"// Borgo delle Dune: {TARGET_PLOTS} pitches (keys \"1\"..\"{TARGET_PLOTS}\"), named facilities and",
        "// power stations (keys \"P01\"..). 1 map unit = 0.5 m.",
        "",
        "const NODES = " + json.dumps(nodes, separators=(",", ":")) + ";",
        "const EDGES = " + json.dumps(site["edges"], separators=(",", ":"), ensure_ascii=False) + ";",
        "let PLOTS = " + json.dumps(site["data_plots"], separators=(",", ":"), ensure_ascii=False) + ";",
        f"const M_PER_UNIT = {M_PER_UNIT};",
        "",
    ]
    path.write_text("\n".join(body), encoding="utf-8")


def write_map_svg_js(svg: str, path: Path):
    js = (
        f"// version : {current_version} - Borgo delle Dune (fictional portfolio campsite), generated by generate_campsite.py\n"
        "// FabRoute \u2014 background map.\n"
        "//\n"
        "// It lives in a plain script (not a .svg fetched at runtime) so that every page\n"
        "// still opens straight from disk over file:// \u2014 fetch() and ES modules are\n"
        "// blocked there, which would break the debug tool's double-click workflow.\n"
        "//\n"
        "// Loaded by index.html, map-config-tool.html and power.html. Each of them calls\n"
        "// injectMapSvg() as the first thing in its own script.\n"
        "//\n"
        f"// viewBox 0 0 {VBW} {VBH} (same as production, so VBW/VBH need no change).\n"
        "// All CSS classes inside the SVG are prefixed bdd- so they cannot clash with page styles.\n"
        "\n"
        f"const MAP_SVG = {json.dumps(svg, ensure_ascii=False)};\n"
        "\n"
        "// Inserted at the start of #mapinner, so anything else already in that\n"
        "// container (or added later) is left alone.\n"
        "function injectMapSvg(){\n"
        "  const host = document.getElementById('mapinner');\n"
        "  if (!host){\n"
        "    console.error('injectMapSvg: no #mapinner element on this page');\n"
        "    return null;\n"
        "  }\n"
        "  host.insertAdjacentHTML('afterbegin', MAP_SVG);\n"
        "  return document.getElementById('mapSvg');\n"
        "}\n"
    )
    path.write_text(js, encoding="utf-8")


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    out_dir.mkdir(parents=True, exist_ok=True)
    site = build_site()
    svg = render_svg(site)
    write_data_js(site, out_dir / "data.js")
    write_map_svg_js(svg, out_dir / "map-svg.js")
    (out_dir / "map-preview.svg").write_text(svg, encoding="utf-8")
    counts = {c: sum(1 for p in site["data_plots"] if p["color"] == c) for c in ("yellow", "grey", "power")}
    print(f"nodes={len(site['node_xy'])} edges={len(site['edges'])} plots={len(site['plots'])} "
          f"trimmed={len(site['trimmed'])} power={counts['power']} "
          f"specials={len(site['data_plots']) - len(site['plots']) - counts['power']} "
          f"svg={len(svg) // 1024} KB")


if __name__ == "__main__":
    main()
