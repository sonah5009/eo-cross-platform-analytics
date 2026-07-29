# EO Cross-platform Analytics

Prototype dashboard for viewing EO content performance across YouTube, Magazine, Instagram, and X.

## Screens

- `index.html` — cross-platform content overview
- `detail.html` — content performance detail

The prototype includes platform filters, period controls, owned/external view separation, content-level performance, and responsive light/dark themes.

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

The view metrics currently shown in the HTML prototype are demonstration data.
They should not be merged into the master data until dated analytics snapshots
are available.

## Run locally

Open `index.html` directly in a browser, or serve the directory with any static file server.
