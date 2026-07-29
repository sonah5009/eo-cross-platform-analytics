import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const masterPath = resolve(projectRoot, "data/youtube-content-master.json");
const masterCsvPath = resolve(projectRoot, "data/youtube-content-master.csv");
const decisionsPath = resolve(projectRoot, "data/magazine-link-decisions.json");

const master = JSON.parse(await readFile(masterPath, "utf8"));
const decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
const approvedYoutubeIds = new Set(
  decisions.decisions
    .filter((decision) => decision.decision === "Approved")
    .map((decision) => decision.youtubeId),
);

for (const asset of master.assets) {
  if (!approvedYoutubeIds.has(asset.youtubeId)) continue;
  if (asset.contentType !== "long_form") {
    throw new Error(`Approved YouTube asset is not long-form: ${asset.youtubeId}`);
  }
  asset.originalContentId = asset.originalContentId || asset.youtubeId;
  asset.isAnchor = true;
  asset.parentCandidate = null;
  asset.linkStatus = "Linked";
  asset.reviewStatus = "Approved";
}

const linkedAssets = master.assets.filter(
  (asset) => asset.linkStatus === "Linked" && asset.originalContentId,
);
const anchors = linkedAssets
  .filter((asset) => asset.isAnchor)
  .sort((left, right) => left.title.localeCompare(right.title));

master.originalContents = anchors.map((anchor) => {
  const assets = linkedAssets.filter(
    (asset) => asset.originalContentId === anchor.originalContentId,
  );
  const assetTypeCounts = Object.fromEntries(
    [...new Set(assets.map((asset) => asset.contentType))].map((contentType) => [
      contentType,
      assets.filter((asset) => asset.contentType === contentType).length,
    ]),
  );
  return {
    originalContentId: anchor.originalContentId,
    title: anchor.title,
    canonicalUrl: anchor.url,
    anchorPlatform: "youtube",
    ipSeries: anchor.ipSeries,
    collectionTags: anchor.collectionTags,
    assetIds: assets.map((asset) => asset.youtubeId),
    assetCount: assets.length,
    assetTypeCounts,
  };
});

master.summary = {
  assetCount: master.assets.length,
  originalContentCount: master.originalContents.length,
  linkedAssetCount: linkedAssets.length,
  linkedAnchorCount: anchors.length,
  linkedShortCount: linkedAssets.filter(
    (asset) => asset.contentType === "shorts",
  ).length,
  unassignedAssetCount: master.assets.filter(
    (asset) => asset.linkStatus === "Unassigned",
  ).length,
  suggestedAssetCount: master.assets.filter(
    (asset) => asset.linkStatus === "Suggested",
  ).length,
};

const columns = [
  "youtube_id",
  "content_type",
  "title",
  "url",
  "playlist_raw",
  "ip_series",
  "collection_tags",
  "original_content_id",
  "is_anchor",
  "parent_candidate",
  "link_status",
  "review_status",
];

const csvValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

const csvRows = master.assets.map((asset) => ({
  youtube_id: asset.youtubeId,
  content_type: asset.contentType,
  title: asset.title,
  url: asset.url,
  playlist_raw: asset.playlistRaw,
  ip_series: asset.ipSeries,
  collection_tags: asset.collectionTags,
  original_content_id: asset.originalContentId,
  is_anchor: asset.isAnchor ? "TRUE" : "FALSE",
  parent_candidate: asset.parentCandidate,
  link_status: asset.linkStatus,
  review_status: asset.reviewStatus,
}));
const csv = [
  columns.join(","),
  ...csvRows.map((row) => columns.map((column) => csvValue(row[column])).join(",")),
].join("\n");

await Promise.all([
  writeFile(masterPath, `${JSON.stringify(master, null, 2)}\n`),
  writeFile(masterCsvPath, `\uFEFF${csv}\n`),
]);

console.log(JSON.stringify(master.summary, null, 2));
