# Master data contract

## Files

- `youtube-content-master.csv` is the reviewed source mapping.
- `youtube-content-master.json` is the dashboard-ready representation.

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
