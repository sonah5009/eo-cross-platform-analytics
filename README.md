# EO Cross-platform Analytics

Prototype dashboard for viewing EO content performance across YouTube, Magazine, Instagram, and X.

## Screens

- `index.html` — cross-platform content overview
- `detail.html?id={originalContentId}` — content performance detail
- `styles.css` — shared responsive design system
- `app.js` — master-data loading, filtering, and page routing

The prototype includes IP/series filters, real YouTube thumbnails, original-to-asset mapping, content-level navigation, and responsive layouts.

## Initial master data

The dashboard uses `data/youtube-content-master.json` as its initial canonical
content source. The original reviewed mapping is preserved as
`data/youtube-content-master.csv`.

The JSON separates:

- `originalContents` — 59 approved original-content groups, keyed by
  `originalContentId`
- `assets` — 433 YouTube videos and Shorts, including 179 approved links and
  254 unassigned assets
- `taxonomy` — the approved IP/series and collection-tag values
- `summary` — integrity-checked counts for quick validation

Analytics snapshots should join to `assets[].youtubeId`. Cross-platform assets
should join to `originalContents[].originalContentId`, so YouTube, Magazine,
Instagram, X, and external repost performance can roll up to one story without
changing the canonical content identity.

View metrics remain empty until dated analytics snapshots are available. This
prevents demonstration values from being mistaken for collected performance
data.

## Run locally

Serve the project directory with any static file server and open `index.html`.
The page loads the JSON master with `fetch`, so it should not be opened directly
through a `file://` URL.

## Build

Run `npm run build` to generate the Cloudflare Worker bundle used by Sites.
