# Building a walking-route finder for a campsite (and the graph hiding underneath it)

Every summer at Fabulous Village, the same question gets asked at reception a hundred times a day: *"Which way to pitch 1104?"* The official site plan is a lovely piece of graphic design, but it's not a map you can search. So I built one — a small web app where you type in a pitch number (or the entrance, `000`) and a destination, and it draws you the walking route, with distance and an estimated walking time.

This post is about how it's built: a background image, a graph of paths laid on top of it, and one very old algorithm doing the actual work.

## The idea: turn a picture into a graph

The site plan itself is "just" an SVG — an image. Images don't know anything about paths, intersections, or how far it is from pitch 401 to the reception. To make routing possible, I had to lay an invisible graph on top of the picture: a set of points (path junctions) connected by lines (path segments), each with a name (the street) and a length.

That gives three ingredients, and the whole app is built out of nothing more than these three JavaScript constants:

- **`NODES`** — every junction or bend in a path, as an `{id: [x, y]}` pair of pixel coordinates on the map.
- **`EDGES`** — every path segment, as `[fromNodeId, toNodeId, streetName]` triples connecting two nodes.
- **`PLOTS`** — every pitch (and the reception, the gelateria, etc.), each with a number, a color, an `(x, y)` position, and the *nearest node* it's attached to.

Once you have that, "how do I get from pitch A to pitch B" turns into a textbook graph problem: walk from the node nearest A to the node nearest B, using the combination of edges that adds up to the smallest total length. Which brings us to the box below.

> ### 📐 Math box: Dijkstra's algorithm
>
> The routing itself is [Dijkstra's shortest-path algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm), from 1956 — one of the oldest, most-used algorithms in computer science. It answers exactly the question I needed: *given a graph with non-negative edge weights, what's the cheapest way from a start node to every other node?*
>
> The idea is greedy but provably correct:
>
> 1. Give the start node a distance of `0`, and every other node a distance of `∞`.
> 2. Repeatedly pick the *unvisited* node with the smallest known distance.
> 3. Look at all of its neighbours. For each neighbour, check if going through the current node gives a shorter path than what we currently know (this step is called **relaxing** the edge):
>    `if distance[current] + weight(current, neighbour) < distance[neighbour]: update it`
> 4. Mark the current node as visited, and repeat until every node has been visited (or the destination has been reached).
>
> Because every edge weight here is a plain Euclidean distance (`√(Δx² + Δy²)`, computed straight from the node coordinates), weights can never be negative — which is exactly the condition Dijkstra needs to guarantee correctness. It's also why the algorithm can be greedy at all: once a node is visited with its shortest distance locked in, no future discovery can ever beat it, *because* every edge can only add distance, never subtract it.
>
> In code, it's barely 20 lines:
>
> ```js
> function dijkstra(start) {
>   const dist = {}, prev = {}, visited = {};
>   for (const k in NODES) dist[k] = Infinity;
>   dist[start] = 0;
>   const queue = [[0, start]];
>   while (queue.length) {
>     queue.sort((a, b) => a[0] - b[0]);   // pick smallest distance
>     const [d, u] = queue.shift();
>     if (visited[u]) continue;
>     visited[u] = true;
>     adjacency[u].forEach(edge => {
>       const nd = d + edge.weight;
>       if (nd < dist[edge.to]) {
>         dist[edge.to] = nd;
>         prev[edge.to] = { node: u, street: edge.street };
>         queue.push([nd, edge.to]);
>       }
>     });
>   }
>   return { dist, prev };
> }
> ```
>
> That `prev` map is the trick for turning "distances" into an actual *route*: for every node, it remembers which neighbour and which street you'd have come from on the shortest path. So once Dijkstra finishes, reconstructing the walking directions is just: start at the destination, follow `prev` backwards until you're home, then reverse the list.
>
> **A confession about complexity.** Sorting the whole queue on every loop (as above) is *not* how you'd do this at scale — it costs O(V²·log V)-ish work, versus O((V + E)·log V) with a real binary heap / priority queue. For a campsite with a few hundred nodes, the difference is invisible (the whole route is computed in a few milliseconds), so I kept the simple version. If this were routing a whole city, I'd reach for a heap — or for [A*](https://en.wikipedia.org/wiki/A*_search_algorithm), which is Dijkstra plus a straight-line-distance *hint* toward the destination, so it stops exploring in the wrong direction.

## From graph to guest-facing app

With `NODES`, `EDGES` and `PLOTS` in hand, the public page does three things:

1. Look up the plot the visitor typed (or clicked), and find the *node* it's attached to.
2. Run Dijkstra from the start node, and read off the path to the destination node.
3. Convert the result from "abstract graph units" into something a human cares about: meters and minutes.

That last step is one line each:

```js
const meters = totalPathLengthInUnits * M_PER_UNIT;   // pixel units → meters
const minutes = meters / WALK_SPEED / 60;              // meters → minutes
```

`M_PER_UNIT` is a calibration constant — pixels on the SVG map don't naturally mean anything in the real world, so I measured a known real-world distance on-site and divided to get "meters per map unit." `WALK_SPEED` is just an assumed walking pace (1.3 m/s, a fairly relaxed adult stroll — including in flip-flops, carrying a bag of croissants).

## The unglamorous part: drawing the graph by hand

Here's the thing nobody tells you about "just draw a graph over a map": *somebody* has to actually place every node and trace every path, by hand, over a real site plan with a few hundred pitches on it. Doing that by directly editing a JSON object in a text editor would have been miserable — and worse, error-prone in a way that's invisible until a guest gets sent on a 400-meter detour because one edge was accidentally drawn between the wrong two nodes.

So before I built the guest-facing app, I built myself a second tool: a graph editor that sits directly on top of the same map, lets me click to add nodes, click two nodes to connect them, click to drop a pitch marker, and — critically — flags edges that look statistically "off" (much longer than similar paths on the same street, for instance) so I can go back and check them by eye. I've written that whole tool up separately, since it ended up useful enough that I want other people in our camping group to be able to reuse it for their own site plans.

## What I'd do differently

A few things I'd change if I started over:
- **Calibrate `M_PER_UNIT` earlier.** I eyeballed it first and only measured it properly against a known distance near the end — which meant redoing "how far is a route" sanity checks twice.
- **Name streets consistently from the start.** The automatic outlier-detection (in the box above) groups edges by street name to spot suspiciously long segments, so a typo'd street name silently opts a path out of that safety net.
- **Keep the config tool's own copy of the data up to date.** More on that in the how-to-replicate-this write-up — it bit me exactly once, which was enough.

The whole thing — background map, graph, and Dijkstra — is a few hundred lines of plain HTML/JS with no build step and no backend. Which, for a tool that only needs to work when someone's phone has one bar of campsite wifi, feels like exactly the right amount of technology.
