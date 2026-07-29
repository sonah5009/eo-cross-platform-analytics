import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const candidatesPath = resolve(
  projectRoot,
  "data/magazine-content-candidates.json",
);
const decisionsPath = resolve(projectRoot, "data/magazine-link-decisions.json");

const candidates = JSON.parse(await readFile(candidatesPath, "utf8"));
const decisions = JSON.parse(await readFile(decisionsPath, "utf8"));
const decisionsByMagazineId = new Map(
  decisions.decisions.map((decision) => [decision.magazineId, decision]),
);

for (const article of candidates.articles) {
  if (article.link_status !== "Suggested" || !article.parent_candidate_url) {
    continue;
  }
  const youtubeId = new URL(article.parent_candidate_url).searchParams.get("v");
  if (!youtubeId) {
    throw new Error(
      `Could not resolve YouTube ID for Magazine article ${article.magazine_id}`,
    );
  }
  decisionsByMagazineId.set(article.magazine_id, {
    magazineId: article.magazine_id,
    youtubeId,
    decision: "Approved",
  });
}

decisions.reviewedAt = new Date().toISOString().slice(0, 10);
decisions.reviewedBy = "User";
decisions.policy = "All remaining suggested relationships approved by user";
decisions.decisions = [...decisionsByMagazineId.values()].sort(
  (left, right) => left.magazineId - right.magazineId,
);

await writeFile(decisionsPath, `${JSON.stringify(decisions, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      approvedDecisionCount: decisions.decisions.filter(
        (decision) => decision.decision === "Approved",
      ).length,
    },
    null,
    2,
  ),
);
