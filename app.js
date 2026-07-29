const DATA_URL = "./data/youtube-content-master.json";
const PAGE_SIZE = 12;

const thumbnailUrl = (youtubeId) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;

const detailUrl = (originalContentId) =>
  `./detail.html?id=${encodeURIComponent(originalContentId)}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const loadMasterData = async () => {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Master data request failed: ${response.status}`);
  }
  return response.json();
};

const tagMarkup = (label, primary = false) =>
  `<span class="tag${primary ? " tag-primary" : ""}">${escapeHtml(label)}</span>`;

const originalCardMarkup = (content) => {
  const shortCount = content.assetTypeCounts.shorts ?? 0;
  const series = content.ipSeries || "Uncategorized";
  return `
    <article class="content-card">
      <a class="thumbnail-link" href="${detailUrl(content.originalContentId)}" aria-label="${escapeHtml(content.title)} 상세 보기">
        <img class="content-thumbnail" src="${thumbnailUrl(content.originalContentId)}" alt="${escapeHtml(content.title)} YouTube 썸네일" loading="lazy">
      </a>
      <div class="content-card-body">
        <div class="tag-row">
          ${tagMarkup(series, Boolean(content.ipSeries))}
          ${shortCount > 0 ? tagMarkup(`${shortCount} Shorts`) : tagMarkup("Original only")}
        </div>
        <a class="content-title card-detail-link" href="${detailUrl(content.originalContentId)}">${escapeHtml(content.title)}</a>
        <div class="card-meta">
          <span>${content.assetCount} linked asset${content.assetCount === 1 ? "" : "s"}</span>
          <a class="card-detail-link" href="${detailUrl(content.originalContentId)}">상세 보기 →</a>
        </div>
      </div>
    </article>
  `;
};

const initializeOverview = async () => {
  const grid = document.querySelector("#content-grid");
  const emptyState = document.querySelector("#empty-state");
  const loadMoreButton = document.querySelector("#load-more");
  const resultCount = document.querySelector("#result-count");
  const searchInput = document.querySelector("#content-search");
  const seriesFilter = document.querySelector("#series-filter");
  const assetFilter = document.querySelector("#asset-filter");
  const sortSelect = document.querySelector("#content-sort");
  const resetButton = document.querySelector("#reset-filters");

  try {
    const master = await loadMasterData();
    const allContents = master.originalContents;
    let visibleLimit = PAGE_SIZE;

    document.querySelector("#original-count").textContent =
      master.summary.originalContentCount.toLocaleString();
    document.querySelector("#linked-count").textContent =
      master.summary.linkedAssetCount.toLocaleString();
    document.querySelector("#short-count").textContent =
      master.summary.linkedShortCount.toLocaleString();
    document.querySelector("#unassigned-count").textContent =
      master.summary.unassignedAssetCount.toLocaleString();

    master.taxonomy.ipSeries.forEach((series) => {
      const option = document.createElement("option");
      option.value = series;
      option.textContent = series;
      seriesFilter.append(option);
    });

    const getFilteredContents = () => {
      const query = searchInput.value.trim().toLocaleLowerCase();
      const series = seriesFilter.value;
      const assetMode = assetFilter.value;
      const sortMode = sortSelect.value;

      const filtered = allContents.filter((content) => {
        const searchable = [
          content.title,
          content.ipSeries,
          ...content.collectionTags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        const shorts = content.assetTypeCounts.shorts ?? 0;
        return (
          (!query || searchable.includes(query)) &&
          (!series || content.ipSeries === series) &&
          (!assetMode ||
            (assetMode === "with-shorts" ? shorts > 0 : content.assetCount === 1))
        );
      });

      return filtered.sort((a, b) => {
        if (sortMode === "title-asc") {
          return a.title.localeCompare(b.title);
        }
        if (sortMode === "series-asc") {
          return (a.ipSeries || "ZZZ").localeCompare(b.ipSeries || "ZZZ") ||
            a.title.localeCompare(b.title);
        }
        return b.assetCount - a.assetCount || a.title.localeCompare(b.title);
      });
    };

    const render = () => {
      const filtered = getFilteredContents();
      const visible = filtered.slice(0, visibleLimit);
      grid.innerHTML = visible.map(originalCardMarkup).join("");
      emptyState.hidden = filtered.length > 0;
      grid.hidden = filtered.length === 0;
      resultCount.textContent = `${filtered.length}개 원본 콘텐츠 · ${visible.length}개 표시`;
      loadMoreButton.hidden = visible.length >= filtered.length;
    };

    const resetLimitAndRender = () => {
      visibleLimit = PAGE_SIZE;
      render();
    };

    searchInput.addEventListener("input", resetLimitAndRender);
    seriesFilter.addEventListener("change", resetLimitAndRender);
    assetFilter.addEventListener("change", resetLimitAndRender);
    sortSelect.addEventListener("change", resetLimitAndRender);
    loadMoreButton.addEventListener("click", () => {
      visibleLimit += PAGE_SIZE;
      render();
    });
    resetButton.addEventListener("click", () => {
      searchInput.value = "";
      seriesFilter.value = "";
      assetFilter.value = "";
      sortSelect.value = "assets-desc";
      resetLimitAndRender();
      searchInput.focus();
    });

    render();
  } catch (error) {
    console.error(error);
    resultCount.textContent = "데이터를 불러오지 못했습니다.";
    grid.innerHTML = "";
    emptyState.hidden = false;
    emptyState.querySelector("strong").textContent = "마스터 데이터를 불러오지 못했습니다.";
    emptyState.querySelector("span").textContent =
      "로컬 서버에서 index.html을 실행했는지 확인해주세요.";
  }
};

const assetRowMarkup = (asset) => `
  <a class="asset-row" href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">
    <img class="asset-thumbnail" src="${thumbnailUrl(asset.youtubeId)}" alt="" loading="lazy">
    <span class="asset-copy">
      <strong>${escapeHtml(asset.title)}</strong>
      <span>${asset.isAnchor ? "Anchor · Long-form" : escapeHtml(asset.contentType.replaceAll("_", " "))}</span>
    </span>
    <span class="asset-arrow" aria-hidden="true">↗</span>
  </a>
`;

const initializeDetail = async () => {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const loading = document.querySelector("#detail-loading");
  const contentSection = document.querySelector("#detail-content");
  const errorSection = document.querySelector("#detail-error");

  if (!requestedId) {
    loading.hidden = true;
    errorSection.hidden = false;
    return;
  }

  try {
    const master = await loadMasterData();
    const content = master.originalContents.find(
      (item) => item.originalContentId === requestedId,
    );
    if (!content) {
      throw new Error("Content not found");
    }

    const assets = content.assetIds
      .map((assetId) => master.assets.find((asset) => asset.youtubeId === assetId))
      .filter(Boolean)
      .sort((a, b) => Number(b.isAnchor) - Number(a.isAnchor));
    const currentIndex = master.originalContents.findIndex(
      (item) => item.originalContentId === requestedId,
    );
    const previous =
      master.originalContents[
        (currentIndex - 1 + master.originalContents.length) %
          master.originalContents.length
      ];
    const next =
      master.originalContents[(currentIndex + 1) % master.originalContents.length];

    document.title = `${content.title} · EO Analytics`;
    document.querySelector("#detail-thumbnail").src = thumbnailUrl(
      content.originalContentId,
    );
    document.querySelector("#detail-thumbnail").alt =
      `${content.title} YouTube 썸네일`;
    document.querySelector("#detail-title").textContent = content.title;
    document.querySelector("#detail-summary").textContent =
      `${content.assetCount}개의 YouTube 에셋이 하나의 original content ID로 연결되어 있습니다.`;
    document.querySelector("#youtube-link").href = content.canonicalUrl;
    document.querySelector("#detail-asset-count").textContent =
      content.assetCount.toLocaleString();
    document.querySelector("#detail-long-count").textContent =
      (content.assetTypeCounts.long_form ?? 0).toLocaleString();
    document.querySelector("#detail-short-count").textContent =
      (content.assetTypeCounts.shorts ?? 0).toLocaleString();
    document.querySelector("#detail-id").textContent = content.originalContentId;
    document.querySelector("#detail-tags").innerHTML = [
      tagMarkup(content.ipSeries || "Uncategorized", Boolean(content.ipSeries)),
      ...content.collectionTags.map((tag) => tagMarkup(tag)),
    ].join("");
    document.querySelector("#asset-list").innerHTML = assets
      .map(assetRowMarkup)
      .join("");
    document.querySelector("#previous-content").href = detailUrl(
      previous.originalContentId,
    );
    document.querySelector("#previous-content").title = previous.title;
    document.querySelector("#next-content").href = detailUrl(next.originalContentId);
    document.querySelector("#next-content").title = next.title;

    document.querySelector("#copy-link").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(window.location.href);
        button.textContent = "복사됨 ✓";
        window.setTimeout(() => {
          button.textContent = "링크 복사";
        }, 1400);
      } catch {
        button.textContent = "복사 실패";
      }
    });

    loading.hidden = true;
    contentSection.hidden = false;
  } catch (error) {
    console.error(error);
    loading.hidden = true;
    errorSection.hidden = false;
  }
};

const page = document.body.dataset.page;
if (page === "overview") {
  initializeOverview();
} else if (page === "detail") {
  initializeDetail();
}
