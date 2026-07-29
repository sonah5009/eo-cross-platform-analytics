# Master data contract

## Files

- `youtube-content-master.csv` is the reviewed source mapping.
- `youtube-content-master.json` is the dashboard-ready representation.
- `magazine-content-candidates.csv` is the human-review queue for magazine
  articles and proposed YouTube relationships.
- `magazine-content-candidates.json` is the structured equivalent used by
  future dashboard integration.
- `magazine-link-decisions.json` stores human approvals and rejections so they
  survive future Magazine API refreshes.

## Identity rules

- `originalContentId` is the canonical story/group key.
- Each approved anchor self-references its YouTube ID.
- Every `Linked` asset points to an approved anchor.
- `ipSeries` and `collectionTags` are separate taxonomies.
- `Unassigned` assets remain in the source so future matching can be reviewed
  without changing existing IDs.

## Analytics joins

Platform-level snapshots should use a composite key such as:

```text
platform + platformAssetId + snapshotDate
```

Each platform asset should retain `originalContentId` as its roll-up key.
Views, deltas, and 3/7/14/30/90-day performance belong in snapshot data rather
than this identity master.

## Magazine candidate rules

- Magazine categories remain in `magazine_category_raw`.
- `Founder Focused` is a collection tag; `The Thinking Mode` is an IP series.
- `original_content_id` remains empty until a reviewer approves a match.
- Approved decisions populate `original_content_id` and change both link and
  review status to `Linked / Approved`.
- Matches to an approved YouTube group propose its existing anchor.
- Matches to an unassigned YouTube long-form propose promoting that video to
  an anchor before linking the magazine article.
- Articles without a reliable match remain magazine-native candidates.

Refresh the review queue with:

```sh
npm run data:reviews
npm run data:magazine
```
