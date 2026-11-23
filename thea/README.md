<!-- version = "20261123-120700" -->
# Fit mit Thea – website

A static site with no build step and no frameworks: plain HTML, CSS and ES modules.

## Run locally

```bash
cd thea
python3 -m http.server 8000
# open http://localhost:8000
```

Use a local server, not `file://`. ES modules don't load from `file://`.

## Deploy (GitHub Pages)

Copy the folder contents into the `thea/` folder of `rcsmit.github.io`, then commit and push.
The canonical URL, the OG image and the sitemap all point to `https://rcsmit.github.io/thea/`. If the site moves to `fit-mit-thea.de`, update the URL in `index.html` (canonical, og:url, og:image, JSON-LD), `robots.txt` and `sitemap.xml`.

## Structure

```
index.html            landing page (all content is in the HTML, so it's crawlable and works without JS)
impressum.html        legal pages – fill in the <mark> fields before going live
datenschutz.html
agb.html
css/styles.css        one stylesheet, organised in @layer blocks
js/main.js            entry point; loads the popover polyfill only when it's needed
js/config.js          ← form endpoints and contact e-mail
js/nav.js             responsive nav, scrollspy, stuck-header fallback
js/filter.js          announces the course filter result (the filtering itself is pure CSS :has())
js/dialog.js          waitlist dialog
js/forms.js           validation feedback and submission
js/timer.js           mini-workout interval timer
assets/fonts          self-hosted Fraunces and Inter (no Google Fonts request, for DSGVO)
assets/img            AVIF/WebP/JPEG at 3 sizes, favicon, OG image
assets/vendor         popover polyfill (only loaded in old browsers)
```

## Common edits

- **Connect a newsletter tool**: put the endpoint URL in `js/config.js` → `formEndpoints.webinar` / `.warteliste`. The forms POST `FormData` to it. While it's empty, submitting opens the visitor's mail program with a pre-filled sign-up to `kontakt@fit-mit-thea.de`.
- **Go live with a course**: set `data-checkout="https://…"` on the course's "Jetzt starten" button in `index.html`. The button then goes straight to checkout instead of opening the waitlist. Also change `"availability": "PreOrder"` in the JSON-LD.
- **Change a course**: edit its `<article>` in `index.html`, the matching `data-*` attributes on its button, the footer link and the JSON-LD block.
- **Add a filter category**: add a radio `<label class="chip">` with a new `value`, set the same `data-category` on the course, and add one line to the `:has()` filter rule in `styles.css` (search for "Filtering in pure CSS").
- **Mini-workout exercises**: edit the `<li>` items in `#exercise-list`. The timer reads the name (`<b>`) and the `data-cue` text. Change the durations at the top of `js/timer.js`.
- **Add testimonials** (only real, approved ones): add a section like this one after `#workouts`:

```html
<section class="section" aria-labelledby="reviews-title">
  <div class="wrap">
    <header class="section-head"><p class="eyebrow">Erfahrungen</p><h2 id="reviews-title">Das sagen Teilnehmerinnen</h2></header>
    <ul class="tips">
      <li class="tip"><figure><blockquote><p>„…"</p></blockquote><figcaption>Name, Alter · Kurs</figcaption></figure></li>
    </ul>
  </div>
</section>
```

## Before launch

1. Fill in the `<mark>` fields in `impressum.html` and `datenschutz.html`, and have them checked.
2. Publish the AGB in `agb.html`.
3. Replace the photos if they aren't Thea's own: `assets/img/thea-hero-*` and `thea-portrait-*`, 4:5 crop.
4. Check the "regulär" prices. A struck-through or "regular" price has to be a price that was actually charged (German PAngV §11).
