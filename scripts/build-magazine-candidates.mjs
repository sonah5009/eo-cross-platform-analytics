import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const youtubeMasterPath = resolve(projectRoot, "data/youtube-content-master.json");
const jsonOutputPath = resolve(projectRoot, "data/magazine-content-candidates.json");
const csvOutputPath = resolve(projectRoot, "data/magazine-content-candidates.csv");

const categories = [
  { id: 1, name: "Founder Focused" },
  { id: 2, name: "Behind The Scenes" },
  { id: 3, name: "Inside Hacker Houses" },
  { id: 4, name: "Raise Report" },
  { id: 6, name: "The Thinking Mode" },
];

const stopWords = new Set([
  "about", "after", "against", "all", "also", "and", "are", "back", "because",
  "been", "before", "behind", "being", "billion", "building", "built",
  "business", "can", "company", "could", "did", "does", "doing", "entrepreneur",
  "entrepreneurs", "every", "for", "founder", "founders", "from", "future",
  "global", "had", "has", "have", "how", "inside", "interview", "into", "its",
  "just", "made", "make", "making", "million", "more", "most", "new", "not",
  "now", "old", "one", "only", "out", "over", "startup", "startups", "story",
  "than", "that", "the", "their", "them", "these", "they", "this", "through",
  "under", "using", "want", "was", "were", "what", "when", "where", "which",
  "why", "will", "with", "without", "world", "year", "years", "you", "your",
  "youtube", "100m", "400m",
]);

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value) {
  return [...new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !stopWords.has(token)),
  )];
}

function longestSharedPhrase(left, right) {
  const leftTokens = normalize(left).split(" ").filter(Boolean);
  const rightText = ` ${normalize(right)} `;

  for (let size = Math.min(8, leftTokens.length); size >= 2; size -= 1) {
    for (let start = 0; start <= leftTokens.length - size; start += 1) {
      const phraseTokens = leftTokens.slice(start, start + size);
      const phrase = phraseTokens.join(" ");
      const meaningfulPhraseTokens = phraseTokens.filter(
        (token) => token.length >= 3 && !stopWords.has(token),
      );
      if (
        phrase.length >= 9 &&
        meaningfulPhraseTokens.length >= 2 &&
        rightText.includes(` ${phrase} `)
      ) return phrase;
    }
  }
  return "";
}

function scoreMatch(article, youtubeAsset) {
  const articleTitle = `${article.title} ${article.subtitle ?? ""}`;
  const articleContext = `${articleTitle} ${article.open_graph_description ?? ""}`;
  const articleTokens = meaningfulTokens(articleTitle);
  const contextTokens = meaningfulTokens(articleContext);
  const youtubeTokens = meaningfulTokens(youtubeAsset.title);
  const youtubeTokenSet = new Set(youtubeTokens);
  const titleOverlap = articleTokens.filter((token) => youtubeTokenSet.has(token));
  const contextOverlap = contextTokens.filter((token) => youtubeTokenSet.has(token));
  const union = new Set([...articleTokens, ...youtubeTokens]);
  const coverage =
    titleOverlap.length / Math.max(1, Math.min(articleTokens.length, youtubeTokens.length));
  const jaccard = titleOverlap.length / Math.max(1, union.size);
  const phrase = longestSharedPhrase(articleTitle, youtubeAsset.title);
  const distinctiveOverlap = contextOverlap.filter((token) => token.length >= 7);

  let score = coverage * 0.56 + jaccard * 0.24;
  score += Math.min(0.16, titleOverlap.length * 0.04);
  if (phrase) score += 0.24;
  if (distinctiveOverlap.length >= 2) score += 0.1;
  if (youtubeAsset.isAnchor) score += 0.015;

  return {
    score: Math.min(1, score),
    titleOverlap,
    contextOverlap,
    distinctiveOverlap,
    phrase,
  };
}

function classifyMatch(match) {
  const hasEnoughSignal =
    match.titleOverlap.length >= 2 ||
    match.phrase ||
    match.distinctiveOverlap.length >= 2;
  if (!hasEnoughSignal || match.score < 0.36) return null;
  if (match.score >= 0.66) return "High";
  if (match.score >= 0.49) return "Medium";
  return "Low";
}

function quoteCsv(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function fetchCategory(category) {
  const params = new URLSearchParams({
    category_id: String(category.id),
    is_published: "true",
    order_by_published_at: "DESC",
    offset: "0",
    limit: "1000",
  });
  const response = await fetch(`https://www.eomag.io/proxy/article?${params}`, {
    headers: { "Accept-Language": "en-US" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch category ${category.id}: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.items.length !== payload.total_count) {
    throw new Error(
      `Incomplete category ${category.id}: ${payload.items.length}/${payload.total_count}`,
    );
  }
  return payload.items;
}

const youtubeMaster = JSON.parse(await readFile(youtubeMasterPath, "utf8"));
const youtubeLongForms = youtubeMaster.assets.filter(
  (asset) => asset.contentType === "long_form",
);
const articles = (await Promise.all(categories.map(fetchCategory))).flat();

const candidates = articles
  .map((article) => {
    const slug = article.custom_slugs?.[0]?.content ?? String(article.id);
    const rankedMatches = youtubeLongForms
      .map((asset) => ({ asset, ...scoreMatch(article, asset) }))
      .sort((left, right) => right.score - left.score);
    const best = rankedMatches[0];
    const confidence = classifyMatch(best);
    const matchedAsset = confidence ? best.asset : null;
    const existingAnchorId = matchedAsset?.originalContentId ?? null;
    const parentCandidate = existingAnchorId ?? matchedAsset?.youtubeId ?? null;
    const matchReason = confidence
      ? [
          best.phrase ? `shared phrase: ${best.phrase}` : null,
          best.titleOverlap.length
            ? `title tokens: ${best.titleOverlap.join(", ")}`
            : null,
          best.distinctiveOverlap.length
            ? `distinctive tokens: ${best.distinctiveOverlap.join(", ")}`
            : null,
        ].filter(Boolean).join("; ")
      : "";

    return {
      magazine_id: article.id,
      source_platform: "magazine",
      asset_type: "article",
      slug,
      title: article.title,
      subtitle: article.subtitle ?? "",
      article_url: `https://www.eomag.io/article/${slug}`,
      thumbnail_url: article.thumbnail_image_url ?? "",
      open_graph_image_url: article.open_graph_image_url ?? "",
      published_at: article.published_at,
      reading_time_minutes: article.reading_time_minutes ?? null,
      view_count_at_import: article.view_count ?? null,
      written_by: article.written_by ?? "",
      magazine_category_id: article.category.id,
      magazine_category_raw: article.category.name,
      ip_series:
        article.category.name === "The Thinking Mode" ? "The Thinking Mode" : null,
      collection_tags:
        article.category.name === "Founder Focused" ? ["Founder Focused"] : [],
      content_origin_candidate: matchedAsset
        ? "youtube_linked_candidate"
        : "magazine_native_candidate",
      original_content_id: null,
      parent_candidate: parentCandidate,
      parent_candidate_url: matchedAsset?.url ?? "",
      matched_youtube_title: matchedAsset?.title ?? "",
      matched_youtube_status: matchedAsset?.linkStatus ?? "",
      match_score: confidence ? Number(best.score.toFixed(3)) : null,
      match_confidence: confidence ?? "",
      match_reason: matchReason,
      recommended_action: matchedAsset
        ? existingAnchorId
          ? "Review and link to existing anchor"
          : "Review, promote YouTube long-form to anchor, then link"
        : "Review as magazine-native original",
      link_status: matchedAsset ? "Suggested" : "Unassigned",
      review_status: matchedAsset ? "Needs review" : "Not reviewed",
    };
  })
  .sort((left, right) =>
    String(right.published_at).localeCompare(String(left.published_at)) ||
    left.magazine_id - right.magazine_id,
  );

const summary = {
  generatedAt: new Date().toISOString(),
  articleCount: candidates.length,
  categoryCounts: Object.fromEntries(
    categories.map((category) => [
      category.name,
      candidates.filter(
        (candidate) => candidate.magazine_category_id === category.id,
      ).length,
    ]),
  ),
  suggestedCount: candidates.filter((candidate) => candidate.link_status === "Suggested")
    .length,
  existingAnchorCandidateCount: candidates.filter(
    (candidate) =>
      candidate.recommended_action === "Review and link to existing anchor",
  ).length,
  newAnchorCandidateCount: candidates.filter((candidate) =>
    candidate.recommended_action.startsWith(
      "Review, promote YouTube long-form to anchor",
    ),
  ).length,
  magazineNativeCandidateCount: candidates.filter(
    (candidate) => candidate.link_status === "Unassigned",
  ).length,
};

const jsonOutput = {
  schemaVersion: 1,
  source: {
    name: "EO Magazine public article API",
    categoryUrls: categories.map((category) => ({
      id: category.id,
      name: category.name,
      url: `https://www.eomag.io/category/${category.id}`,
    })),
  },
  matchingPolicy: {
    approvalMode: "human_review_required",
    originalContentIdRule:
      "Always null until a reviewer approves the parent candidate.",
    existingAnchorRule:
      "A matched linked YouTube asset proposes its approved originalContentId.",
    newAnchorRule:
      "A matched unassigned YouTube long-form must be promoted to an anchor before linking.",
  },
  summary,
  articles: candidates,
};

const columns = [
  "magazine_id", "source_platform", "asset_type", "slug", "title", "subtitle",
  "article_url", "thumbnail_url", "open_graph_image_url", "published_at",
  "reading_time_minutes", "view_count_at_import", "written_by",
  "magazine_category_id", "magazine_category_raw", "ip_series",
  "collection_tags", "content_origin_candidate", "original_content_id",
  "parent_candidate", "parent_candidate_url", "matched_youtube_title",
  "matched_youtube_status", "match_score", "match_confidence", "match_reason",
  "recommended_action", "link_status", "review_status",
];

const csvOutput = [
  columns.join(","),
  ...candidates.map((candidate) =>
    columns.map((column) => quoteCsv(candidate[column])).join(","),
  ),
].join("\n");

await Promise.all([
  writeFile(jsonOutputPath, `${JSON.stringify(jsonOutput, null, 2)}\n`),
  writeFile(csvOutputPath, `${csvOutput}\n`),
]);

console.log(JSON.stringify(summary, null, 2));
