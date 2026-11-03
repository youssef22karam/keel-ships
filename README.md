# KEEL — The Procedural Shipyard

Turn a budget and a seed into a finely crafted vessel, then step inside its bridge. three.js + Tailwind (browser build), no build step.

Adapted from github.com/youssef22karam/keel.

## Run it

The code is split into ES modules, so it must be served over HTTP (opening `index.html` by double-click will not work):

```
python3 -m http.server 8000     # then open http://localhost:8000
```

On GitHub: Settings → Pages → deploy from the branch root. Libraries and fonts load from CDNs (see `index.html`).

## Layout

```
index.html              markup, import map, stylesheet links
css/                    base, topbar, workspace, viewport, overlays (loading/dialogs), responsive
js/watchdog.js          classic script: "engine needs a connection" fallback
js/app.js               entry: stage, camera, UI, generate, export, fleet
js/util.js              helpers
js/palettes.js          palettes, tiers, names
js/vessel-dna.js        seed + budget -> vessel design
js/materials.js         materials + parts
js/hull-sculptor.js     hull shape
js/vessel-builder.js    VesselBuilder class
js/builder/             VesselBuilder methods: cabin, fixtures, interior, props, displays
js/charts.js, fit.js    chart drawing, bounds helpers
```
