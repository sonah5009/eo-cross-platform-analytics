const YOUTUBE_DATA_URL = "./data/youtube-content-master.json";
const MAGAZINE_DATA_URL = "./data/magazine-content-candidates.json";
const PLATFORM_ORDER = ["youtube", "magazine", "instagram", "x"];
const PLATFORM_LABELS = {
  youtube: "YouTube",
  magazine: "Magazine",
  instagram: "Instagram",
  x: "X",
};
const PLATFORM_COLORS = {
  youtube: "var(--eo-youtube)",
  magazine: "var(--eo-magazine)",
  instagram: "var(--eo-instagram)",
  x: "var(--eo-x)",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const thumbnailUrl = (youtubeId) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;

const detailUrl = (platform, id) =>
  `./detail.html?platform=${encodeURIComponent(platform)}&id=${encodeURIComponent(id)}`;

const loadMasterData = async () => {
  const [youtubeResponse, magazineResponse] = await Promise.all([
    fetch(YOUTUBE_DATA_URL),
    fetch(MAGAZINE_DATA_URL),
  ]);
  if (!youtubeResponse.ok || !magazineResponse.ok) {
    throw new Error(
      `Master data request failed: ${youtubeResponse.status}/${magazineResponse.status}`,
    );
  }
  const [youtube, magazine] = await Promise.all([
    youtubeResponse.json(),
    magazineResponse.json(),
  ]);
  return { youtube, magazine };
};

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const stableHash = (value) =>
  [...String(value)].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

const roundToThousand = (value) => Math.round(value / 1000) * 1000;

const buildPrototypeViewBreakdown = (content) => {
  if (content.platform === "magazine") {
    const magazineViews =
      content.views || 18_000 + (stableHash(content.id) % 68) * 1000;
    return { youtube: 0, magazine: magazineViews, instagram: 0, x: 0 };
  }

  const seed = stableHash(content.id);
  const totalViews =
    420_000 +
    Math.min(content.assetCount, 8) * 38_000 +
    (seed % 145) * 1000;
  const magazineShare = content.linkedMagazineCount
    ? Math.min(.12, .04 + content.linkedMagazineCount * .015)
    : 0;
  const instagramShare = .16 + (seed % 5) / 100;
  const xShare = .06 + (seed % 4) / 100;
  const magazineViews = roundToThousand(totalViews * magazineShare);
  const instagramViews = roundToThousand(totalViews * instagramShare);
  const xViews = roundToThousand(totalViews * xShare);

  return {
    youtube: totalViews - magazineViews - instagramViews - xViews,
    magazine: magazineViews,
    instagram: instagramViews,
    x: xViews,
  };
};

const initializeOverview = async () => {
  const root = document.querySelector("#eo-content-overview");
  if (!root) return;

  const tabs = [...root.querySelectorAll("[data-filter]")];
  const range = root.querySelector("#overview-range");
  const external = root.querySelector("#overview-external");
  const externalLabel = root.querySelector('label[for="overview-external"]');
  const total = root.querySelector("#overview-total");
  const contentCount = root.querySelector("#overview-content-count");
  const externalValue = root.querySelector("#overview-external-value");
  const externalContext = root.querySelector("#overview-external-context");
  const resultLabel = root.querySelector("#content-result-label");
  const chartLabel = root.querySelector("#overview-chart-label");
  const grid = root.querySelector("#overview-grid");
  const area = root.querySelector("#overview-area");
  const line = root.querySelector("#overview-line");
  const pointsGroup = root.querySelector("#overview-points");
  const labels = root.querySelector("#overview-labels");
  const rowsContainer = root.querySelector("#content-rows");
  const searchInput = root.querySelector("#content-search");
  const seriesFilter = root.querySelector("#series-filter");
  const sortSelect = root.querySelector("#content-sort");
  const channelViewButtons = [
    ...root.querySelectorAll("[data-channel-view]"),
  ];
  const channelBars = root.querySelector("#channel-bars");
  const channelDonut = root.querySelector("#channel-donut");
  const donutWrap = root.querySelector(".eo-donut-wrap");
  const donutTooltip = root.querySelector("#channel-donut-tooltip");
  const donutSegments = [
    ...root.querySelectorAll(".eo-donut-segment"),
  ];

  const { youtube, magazine } = await loadMasterData();
  const youtubeContents = youtube.originalContents.map((content) => {
    const linkedMagazineCount = magazine.articles.filter(
      (article) =>
        article.review_status === "Approved" &&
        article.original_content_id === content.originalContentId,
    ).length;
    return {
      id: content.originalContentId,
      platform: "youtube",
      title: content.title,
      imageUrl: thumbnailUrl(content.originalContentId),
      taxonomy: content.ipSeries || content.collectionTags[0] || "Uncategorized",
      searchable: [
        content.title,
        content.ipSeries,
        ...content.collectionTags,
      ].filter(Boolean).join(" "),
      assetCount: content.assetCount + linkedMagazineCount,
      youtubeAssetCount: content.assetCount,
      linkedMagazineCount,
      platformCounts: {
        youtube: content.assetCount,
        magazine: linkedMagazineCount,
        instagram: 0,
        x: 0,
      },
      shortCount: content.assetTypeCounts.shorts ?? 0,
      views: null,
      publishedAt: null,
      status: "Approved anchor",
    };
  });
  const magazineContents = magazine.articles.map((article) => ({
    id: article.magazine_id,
    platform: "magazine",
    title: article.title,
    imageUrl: article.thumbnail_url,
    taxonomy: article.ip_series || article.magazine_category_raw,
    searchable: [
      article.title,
      article.subtitle,
      article.magazine_category_raw,
      article.ip_series,
      ...(article.collection_tags || []),
      article.written_by,
    ].filter(Boolean).join(" "),
    assetCount: 1,
    shortCount: 0,
    isNative: article.review_status !== "Approved",
    platformCounts: {
      youtube: 0,
      magazine: 1,
      instagram: 0,
      x: 0,
    },
    views: article.view_count_at_import ?? 0,
    publishedAt: article.published_at,
    status:
      article.link_status === "Linked"
        ? "Approved · linked to YouTube"
        : article.link_status === "Suggested"
          ? `${article.match_confidence} match candidate`
          : "Magazine-native candidate",
  }));
  const contents = [...youtubeContents, ...magazineContents];
  contents.forEach((content) => {
    content.viewBreakdown = buildPrototypeViewBreakdown(content);
    content.views = Object.values(content.viewBreakdown).reduce(
      (sum, value) => sum + value,
      0,
    );
  });
  let platform = "all";
  const expandedContentIds = new Set();

  const taxonomies = [
    ...youtube.taxonomy.ipSeries,
    ...youtube.taxonomy.collectionTags,
    ...new Set(magazine.articles.map((article) => article.magazine_category_raw)),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  taxonomies.sort((a, b) => a.localeCompare(b)).forEach((series) => {
    const option = document.createElement("option");
    option.value = series;
    option.textContent = series;
    seriesFilter.append(option);
  });

  const totals = {
    all: 12.8,
    youtube: 8.3,
    instagram: 2.6,
    x: .6,
  };

  const drawChart = () => {
    const days = Number(range.value);
    const count = days <= 7 ? 8 : days <= 30 ? 16 : 20;
    const platformScale = {
      all: 1,
      youtube: .65,
      magazine: .1,
      instagram: .2,
      x: .05,
    }[platform];
    const values = Array.from({ length: count }, (_, index) => {
      const wave =
        Math.sin(index * 1.31) * .13 + Math.cos(index * .57) * .09;
      return (300 + index * 8 + wave * 260) * platformScale;
    });
    const width = 650;
    const height = 210;
    const left = 48;
    const right = 16;
    const top = 16;
    const bottom = 30;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const max = Math.max(...values) * 1.12;
    const x = (index) => left + (index / (values.length - 1)) * plotWidth;
    const y = (value) => top + plotHeight - (value / max) * plotHeight;
    const points = values.map((value, index) => [x(index), y(value)]);
    const path = points
      .map(
        (point, index) =>
          `${index ? "L" : "M"} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`,
      )
      .join(" ");

    line.setAttribute("d", path);
    area.setAttribute(
      "d",
      `${path} L ${x(values.length - 1)} ${top + plotHeight} L ${left} ${top + plotHeight} Z`,
    );
    grid.innerHTML = [0, .5, 1]
      .map((ratio) => {
        const gridY = top + plotHeight - ratio * plotHeight;
        return `<line class="grid" x1="${left}" x2="${width - right}" y1="${gridY}" y2="${gridY}"></line>
          <text x="${left - 8}" y="${gridY + 4}" text-anchor="end">${Math.round(max * ratio)}K</text>`;
      })
      .join("");
    labels.innerHTML = [
      [left, `-${days}D`, "start"],
      [left + plotWidth / 2, `-${Math.round(days / 2)}D`, "middle"],
      [width - right, "Today", "end"],
    ]
      .map(
        (item) =>
          `<text x="${item[0]}" y="${height - 8}" text-anchor="${item[2]}">${item[1]}</text>`,
      )
      .join("");
    pointsGroup.innerHTML = [
      Math.floor((values.length - 1) / 2),
      values.length - 1,
    ]
      .map(
        (index) =>
          `<circle class="point" cx="${x(index)}" cy="${y(values[index])}" r="4"><title>${Math.round(values[index])}K views</title></circle>`,
      )
      .join("");
  };

  const getFilteredContents = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const series = seriesFilter.value;
    const filtered = contents.filter((content) => {
      const platformMatches =
        platform === "all"
          ? content.platform === "youtube" ||
            (content.platform === "magazine" && content.isNative)
          : content.platform === platform;
      return (
        platformMatches &&
        (!query || content.searchable.toLocaleLowerCase().includes(query)) &&
        (!series || content.taxonomy === series)
      );
    });

    return filtered.sort((a, b) => {
      const platformOrder =
        platform === "all"
          ? PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
          : 0;
      if (platformOrder) return platformOrder;
      if (sortSelect.value === "recent-desc") {
        return (
          String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) ||
          a.title.localeCompare(b.title)
        );
      }
      if (sortSelect.value === "views-desc") {
        return (b.views ?? -1) - (a.views ?? -1) || a.title.localeCompare(b.title);
      }
      if (sortSelect.value === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortSelect.value === "series-asc") {
        return (
          (a.taxonomy || "ZZZ").localeCompare(b.taxonomy || "ZZZ") ||
          a.title.localeCompare(b.title)
        );
      }
      return b.assetCount - a.assetCount || a.title.localeCompare(b.title);
    });
  };

  const contentRow = (content) => {
    const isMagazine = content.platform === "magazine";
    const contentKey = `${content.platform}:${content.id}`;
    const breakdownId = `platform-breakdown-${content.platform}-${String(content.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const isExpanded = expandedContentIds.has(contentKey);
    const platformEntries = PLATFORM_ORDER
      .map((platformName) => [
        platformName,
        content.platformCounts?.[platformName] || 0,
      ])
      .filter(([, count]) => count > 0);
    const platformTotal = platformEntries.reduce(
      (sum, [, count]) => sum + count,
      0,
    );
    const platformLabel = platformEntries
      .map(
        ([platformName, count]) =>
          `${PLATFORM_LABELS[platformName]} ${count}`,
      )
      .join(", ");
    const mixMarkup = platformEntries
      .map(
        ([platformName, count]) =>
          `<span class="eo-mix" style="width: ${(count / platformTotal) * 100}%; background: ${PLATFORM_COLORS[platformName]}" title="${escapeHtml(`${PLATFORM_LABELS[platformName]} ${Math.round((count / platformTotal) * 100)}%`)}"></span>`,
      )
      .join("");
    const totalViews = Object.values(content.viewBreakdown).reduce(
      (sum, value) => sum + value,
      0,
    );
    const platformAssetLabel = (platformName) => {
      if (platformName === "youtube") {
        const count = content.platformCounts.youtube;
        return count
          ? `${count} ${count === 1 ? "asset" : "assets"}`
          : "No connected asset";
      }
      if (platformName === "magazine") {
        const count = content.platformCounts.magazine;
        return count
          ? `${count} linked ${count === 1 ? "article" : "articles"}`
          : "No linked article";
      }
      return content.viewBreakdown[platformName]
        ? "Prototype snapshot"
        : "No tracked post";
    };
    const breakdownMarkup = PLATFORM_ORDER
      .map((platformName) => {
        const views = content.viewBreakdown[platformName];
        const share = totalViews ? Math.round((views / totalViews) * 100) : 0;
        const badge = {
          youtube: "YT",
          magazine: "M",
          instagram: "IG",
          x: "X",
        }[platformName];
        return `
          <div class="eo-breakdown-platform${views ? "" : " is-empty"}">
            <span class="eo-breakdown-badge" style="background: ${PLATFORM_COLORS[platformName]}">${badge}</span>
            <span class="eo-breakdown-copy">
              <strong>${PLATFORM_LABELS[platformName]}</strong>
              <small>${platformAssetLabel(platformName)}</small>
            </span>
            <span class="eo-breakdown-metric">
              <strong>${views.toLocaleString("en-US")}</strong>
              <small>views</small>
            </span>
            <span class="eo-breakdown-share">${share}%</span>
            <span class="eo-breakdown-bar" aria-hidden="true">
              <i style="width: ${share}%; background: ${PLATFORM_COLORS[platformName]}"></i>
            </span>
          </div>
        `;
      })
      .join("");
    return `
      <tr class="eo-content-row${isExpanded ? " is-expanded" : ""}" data-content-key="${escapeHtml(contentKey)}">
        <td>
          <div class="eo-content-name">
            <img class="eo-thumbnail" src="${escapeHtml(content.imageUrl)}" alt="" loading="lazy">
            <div class="eo-content-copy">
              <div class="eo-content-title">${escapeHtml(content.title)}</div>
              <div class="eo-content-date">${escapeHtml(content.taxonomy)} · ${isMagazine ? formatDate(content.publishedAt) : `${content.assetCount} linked assets`}</div>
            </div>
          </div>
        </td>
        <td class="text-end">
          <span class="eo-view-value">${formatMetric(content.views)}</span>
          <span class="eo-data-pending">${isMagazine ? "Imported / prototype" : "Prototype snapshot"}</span>
        </td>
        <td>
          <div class="eo-platform-mix" aria-label="${platformLabel}">
            ${mixMarkup}
          </div>
          <div class="eo-source">
            <span class="eo-platform-chip eo-platform-chip-${content.platform}">${isMagazine ? "M" : "YT"}</span>
            ${
              isMagazine
                ? escapeHtml(content.status)
                : content.linkedMagazineCount
                  ? `${content.youtubeAssetCount} YouTube · ${content.linkedMagazineCount} Magazine`
                  : `${content.youtubeAssetCount} owned · ${content.shortCount} Shorts`
            }
          </div>
        </td>
        <td class="text-end">
          <span class="eo-row-actions">
            <a class="eo-row-action" href="${detailUrl(content.platform, content.id)}">View detail ↗</a>
            <button class="eo-expand-button" type="button" aria-expanded="${isExpanded}" aria-controls="${breakdownId}" aria-label="${isExpanded ? "Collapse" : "Expand"} platform views for ${escapeHtml(content.title)}">
              <span aria-hidden="true">⌄</span>
            </button>
          </span>
        </td>
      </tr>
      <tr class="eo-content-breakdown-row" id="${breakdownId}"${isExpanded ? "" : " hidden"}>
        <td colspan="4">
          <div class="eo-content-breakdown">
            <div class="eo-breakdown-heading">
              <strong>Platform views</strong>
              <span>Visible views · prototype snapshot</span>
            </div>
            <div class="eo-breakdown-list">
              ${breakdownMarkup}
            </div>
          </div>
        </td>
      </tr>
    `;
  };

  const renderContent = () => {
    const filtered = getFilteredContents();
    rowsContainer.innerHTML = filtered.length
      ? filtered.map(contentRow).join("")
      : '<tr><td colspan="4" class="eo-empty-row">No mapped content matches this filter.</td></tr>';
    const youtubeCount = filtered.filter(
      (content) => content.platform === "youtube",
    ).length;
    const magazineCount = filtered.length - youtubeCount;
    const linkedMagazineCount = filtered.reduce(
      (sum, content) => sum + (content.linkedMagazineCount || 0),
      0,
    );
    resultLabel.textContent =
      platform === "magazine"
        ? `${magazineCount} real articles · public EO Magazine data`
        : platform === "youtube"
          ? `${youtubeCount} approved original stories · YouTube master`
          : `${youtubeCount} YouTube originals · ${linkedMagazineCount} linked Magazine articles · ${magazineCount} Magazine originals`;
    contentCount.textContent = String(filtered.length);
  };

  const toggleContentBreakdown = (contentRowElement) => {
    const contentKey = contentRowElement.dataset.contentKey;
    const toggle = contentRowElement.querySelector(".eo-expand-button");
    const breakdown = root.querySelector(
      `#${CSS.escape(toggle.getAttribute("aria-controls"))}`,
    );
    const nextExpanded = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(nextExpanded));
    toggle.setAttribute(
      "aria-label",
      `${nextExpanded ? "Collapse" : "Expand"} platform views`,
    );
    contentRowElement.classList.toggle("is-expanded", nextExpanded);
    breakdown.hidden = !nextExpanded;
    if (nextExpanded) expandedContentIds.add(contentKey);
    else expandedContentIds.delete(contentKey);
  };

  rowsContainer.addEventListener("click", (event) => {
    if (event.target.closest(".eo-row-action")) return;
    const contentRowElement = event.target.closest(".eo-content-row");
    if (contentRowElement) toggleContentBreakdown(contentRowElement);
  });

  const render = () => {
    const externalIncluded = external.checked;
    const periodScale = {
      7: .28,
      30: 1,
      90: 2.3,
      365: 6.8,
    }[Number(range.value)];
    if (platform === "magazine") {
      const importedViews = getFilteredContents().reduce(
        (sum, content) => sum + (content.views || 0),
        0,
      );
      total.textContent = formatMetric(importedViews);
      externalValue.textContent = "—";
      externalContext.textContent = "No repost data in the initial import";
    } else {
      const baseTotal = totals[platform] ?? totals.all;
      const visibleTotal =
        baseTotal * periodScale * (externalIncluded ? 1 : .87);
      total.textContent =
        visibleTotal < 1
          ? `${Math.round(visibleTotal * 1000)}K`
          : `${visibleTotal.toFixed(1)}M`;
      externalValue.textContent = externalIncluded
        ? `${(baseTotal * periodScale * .13).toFixed(1)}M`
        : "—";
      externalContext.textContent = externalIncluded
        ? "13% of total · 18 discovered posts"
        : "Excluded from totals";
    }
    externalLabel.textContent = externalIncluded
      ? "External included"
      : "Owned only";
    root.dataset.external = String(externalIncluded);
    chartLabel.textContent =
      platform === "magazine"
        ? "Trend begins after recurring snapshots are collected"
        : `Daily views · ${platform === "all" ? "all platforms" : platform} · ${range.value} days`;

    renderContent();
    drawChart();
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      platform = tab.dataset.filter;
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.classList.toggle("btn-ghost", !active);
      });
      render();
    });
  });
  range.addEventListener("change", render);
  external.addEventListener("change", render);
  searchInput.addEventListener("input", renderContent);
  seriesFilter.addEventListener("change", renderContent);
  sortSelect.addEventListener("change", renderContent);
  channelViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedView = button.dataset.channelView;
      channelBars.hidden = selectedView !== "bars";
      channelDonut.hidden = selectedView !== "donut";
      channelViewButtons.forEach((item) => {
        const active = item === button;
        item.setAttribute("aria-pressed", String(active));
        item.classList.toggle("btn-ghost", !active);
      });
    });
  });
  const placeDonutTooltip = (clientX, clientY) => {
    const bounds = donutWrap.getBoundingClientRect();
    const tooltipBounds = donutTooltip.getBoundingClientRect();
    const padding = 8;
    const left = Math.min(
      Math.max(clientX - bounds.left + 12, padding),
      bounds.width - tooltipBounds.width - padding,
    );
    const top = Math.min(
      Math.max(clientY - bounds.top - tooltipBounds.height / 2, padding),
      bounds.height - tooltipBounds.height - padding,
    );
    donutTooltip.style.left = `${left}px`;
    donutTooltip.style.top = `${top}px`;
  };
  const showDonutTooltip = (segment, clientX, clientY) => {
    donutTooltip.querySelector(".eo-tooltip-platform i").className =
      `eo-tooltip-color eo-tooltip-color-${segment.dataset.color}`;
    donutTooltip.querySelector(".eo-tooltip-platform span").textContent =
      segment.dataset.platform;
    donutTooltip.querySelector(".eo-tooltip-platform strong").textContent =
      segment.dataset.views;
    donutTooltip.querySelector(".eo-tooltip-share strong").textContent =
      segment.dataset.share;
    donutTooltip.hidden = false;
    segment.classList.add("is-active");
    placeDonutTooltip(clientX, clientY);
  };
  const hideDonutTooltip = (segment) => {
    donutTooltip.hidden = true;
    segment.classList.remove("is-active");
  };
  donutSegments.forEach((segment) => {
    segment.addEventListener("pointerenter", (event) => {
      showDonutTooltip(segment, event.clientX, event.clientY);
    });
    segment.addEventListener("pointermove", (event) => {
      placeDonutTooltip(event.clientX, event.clientY);
    });
    segment.addEventListener("pointerleave", () => {
      if (document.activeElement !== segment) hideDonutTooltip(segment);
    });
    segment.addEventListener("focus", () => {
      const bounds = donutWrap.getBoundingClientRect();
      showDonutTooltip(
        segment,
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2,
      );
    });
    segment.addEventListener("blur", () => hideDonutTooltip(segment));
  });
  render();
};

const formatMetric = (value) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2).replace(/0$/, "")}M`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
};

const initializeDetail = async () => {
  const root = document.querySelector("#eo-content-detail");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const requestedPlatform = params.get("platform") || "youtube";
  if (!requestedId) {
    window.location.replace("./index.html");
    return;
  }

  const { youtube, magazine } = await loadMasterData();
  const isMagazine = requestedPlatform === "magazine";
  const content = isMagazine
    ? magazine.articles.find(
        (article) => String(article.magazine_id) === requestedId,
      )
    : youtube.originalContents.find(
        (item) => item.originalContentId === requestedId,
      );
  if (!content) {
    window.location.replace("./index.html");
    return;
  }

  document.title = `${content.title} · EO Analytics`;
  root.querySelector("#detail-heading").textContent = content.title;
  root.querySelector("#detail-card-title").textContent = content.title;
  const platformBadge = root.querySelector("#detail-platform-badge");
  const ownerCopy = root.querySelector("#detail-owner-copy");
  const publishedPosts = root.querySelector("#published-posts");

  if (isMagazine) {
    const matchedYoutubeId = content.parent_candidate_url
      ? new URL(content.parent_candidate_url).searchParams.get("v")
      : null;
    const matchedYoutubeAsset = matchedYoutubeId
      ? youtube.assets.find((asset) => asset.youtubeId === matchedYoutubeId)
      : null;
    root.querySelector("#detail-series").textContent =
      content.ip_series || content.magazine_category_raw;
    root.querySelector("#detail-asset-summary").textContent =
      `${content.reading_time_minutes || "—"} min read · ${formatDate(content.published_at)}`;
    root.querySelector("#detail-original-link").href = content.article_url;
    root.querySelector("#detail-thumbnail").src = content.thumbnail_url;
    root.querySelector("#detail-thumbnail").alt =
      `${content.title} magazine thumbnail`;
    root.querySelector("#detail-content-id").textContent =
      `Magazine ID ${content.magazine_id}`;
    platformBadge.textContent = "M";
    platformBadge.style.background = "var(--eo-magazine)";
    ownerCopy.textContent = `EO Magazine · ${content.magazine_category_raw}`;
    publishedPosts.innerHTML = `
      <li class="eo-published">
        <a class="eo-published-link" href="${escapeHtml(content.article_url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(content.title)} (opens external page)">
          <span class="eo-badge" style="background: var(--eo-magazine)">M</span>
          <span class="eo-published-main">
            <span class="eo-published-name">${escapeHtml(content.title)}</span>
            <span class="eo-published-date">${formatDate(content.published_at)} · ${content.reading_time_minutes || "—"} min read</span>
          </span>
          <span class="eo-published-actions">
            <span class="eo-source-badge">Owned</span>
            <span class="eo-external-mark" aria-hidden="true">↗</span>
          </span>
        </a>
      </li>
      ${
        matchedYoutubeAsset
          ? `<li class="eo-published eo-candidate-row">
              <a class="eo-published-link" href="${escapeHtml(matchedYoutubeAsset.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(matchedYoutubeAsset.title)} (opens external page)">
                <span class="eo-badge" style="background: var(--eo-youtube)">YT</span>
                <span class="eo-published-main">
                  <span class="eo-published-name">${escapeHtml(matchedYoutubeAsset.title)}</span>
                  <span class="eo-published-date">${content.review_status === "Approved" ? "Approved same original" : `${escapeHtml(content.match_confidence)} candidate · score ${content.match_score}`}</span>
                </span>
                <span class="eo-published-actions">
                  <span class="eo-source-badge ${content.review_status === "Approved" ? "" : "eo-review-badge"}">${escapeHtml(content.review_status)}</span>
                  <span class="eo-external-mark" aria-hidden="true">↗</span>
                </span>
              </a>
            </li>`
          : `<li class="eo-published eo-published-static eo-candidate-row">
              <span class="eo-badge" style="background: var(--eo-panel-2); color: var(--eo-ink-2)">—</span>
              <div class="eo-published-main">
                <span class="eo-published-name">No YouTube relationship proposed</span>
                <div class="eo-published-date">Magazine-native original candidate</div>
              </div>
              <span class="eo-source-badge eo-review-badge">Not reviewed</span>
            </li>`
      }
    `;
  } else {
    const assets = content.assetIds
      .map((assetId) =>
        youtube.assets.find((asset) => asset.youtubeId === assetId),
      )
      .filter(Boolean)
      .sort((a, b) => Number(b.isAnchor) - Number(a.isAnchor));
    const linkedMagazineArticles = magazine.articles.filter(
      (article) =>
        article.review_status === "Approved" &&
        article.original_content_id === content.originalContentId,
    );
    root.querySelector("#detail-series").textContent =
      content.ipSeries || "Uncategorized";
    root.querySelector("#detail-asset-summary").textContent =
      `${content.assetCount} YouTube assets · ${linkedMagazineArticles.length} Magazine articles`;
    root.querySelector("#detail-original-link").href = content.canonicalUrl;
    root.querySelector("#detail-thumbnail").src = thumbnailUrl(
      content.originalContentId,
    );
    root.querySelector("#detail-thumbnail").alt =
      `${content.title} YouTube thumbnail`;
    root.querySelector("#detail-content-id").textContent =
      `ID ${content.originalContentId}`;
    publishedPosts.innerHTML = assets
      .map(
        (asset) => `
        <li class="eo-published">
          <a class="eo-published-link" href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(asset.title)} (opens external page)">
            <span class="eo-badge" style="background: var(--eo-youtube)">${asset.isAnchor ? "YT" : "S"}</span>
            <span class="eo-published-main">
              <span class="eo-published-name">${escapeHtml(asset.title)}</span>
              <span class="eo-published-date">${asset.isAnchor ? "Original long-form" : "YouTube Short"}</span>
            </span>
            <span class="eo-published-actions">
              <span class="eo-source-badge">Owned</span>
              <span class="eo-external-mark" aria-hidden="true">↗</span>
            </span>
          </a>
        </li>
      `,
      )
      .join("") + linkedMagazineArticles
        .map(
          (article) => `
            <li class="eo-published">
              <a class="eo-published-link" href="${escapeHtml(article.article_url)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(article.title)} (opens external page)">
                <span class="eo-badge" style="background: var(--eo-magazine)">M</span>
                <span class="eo-published-main">
                  <span class="eo-published-name">${escapeHtml(article.title)}</span>
                  <span class="eo-published-date">${formatDate(article.published_at)} · Approved same original</span>
                </span>
                <span class="eo-published-actions">
                  <span class="eo-source-badge">Owned</span>
                  <span class="eo-external-mark" aria-hidden="true">↗</span>
                </span>
              </a>
            </li>
          `,
        )
        .join("");
  }

  const externalToggle = root.querySelector("#external-toggle");
  const externalLabel = root.querySelector('label[for="external-toggle"]');
  const tabs = [...root.querySelectorAll("[data-platform]")];
  const rangeButtons = [...root.querySelectorAll("[data-range]")];
  const platformRows = [...root.querySelectorAll("[data-row-platform]")];
  const totalViews = root.querySelector("#total-views");
  const ownedViews = root.querySelector("#owned-views");
  const ownedShare = root.querySelector("#owned-share");
  const externalViews = root.querySelector("#external-views");
  const externalShare = root.querySelector("#external-share");
  const chartSubtitle = root.querySelector("#chart-subtitle");
  const chartGrid = root.querySelector("#chart-grid");
  const chartMilestones = root.querySelector("#chart-milestones");
  const chartArea = root.querySelector("#chart-area");
  const chartLine = root.querySelector("#chart-line");
  const chartPoints = root.querySelector("#chart-points");
  const chartLabels = root.querySelector("#chart-labels");

  const data = isMagazine
    ? {
        all: { owned: content.view_count_at_import || 0, external: 0 },
        youtube: { owned: 0, external: 0 },
        magazine: { owned: content.view_count_at_import || 0, external: 0 },
        instagram: { owned: 0, external: 0 },
        x: { owned: 0, external: 0 },
      }
    : {
        all: { owned: 1_102_000, external: 138_000 },
        youtube: { owned: 761_000, external: 82_000 },
        magazine: { owned: 87_000, external: 0 },
        instagram: { owned: 214_000, external: 46_000 },
        x: { owned: 40_000, external: 10_000 },
      };
  let selectedPlatform = "all";
  let selectedRange = 30;
  let externalIncluded = true;

  const makeSeries = (days, totalValue) => {
    if (isMagazine) return Array.from({ length: days + 1 }, () => totalValue);
    const anchors = [
      [0, 0],
      [1, .08],
      [3, .27],
      [7, .52],
      [14, .75],
      [30, .91],
      [90, 1],
    ];
    const values = [];
    for (let day = 0; day <= days; day += 1) {
      let start = anchors[0];
      let end = anchors.at(-1);
      for (let index = 0; index < anchors.length - 1; index += 1) {
        if (day >= anchors[index][0] && day <= anchors[index + 1][0]) {
          start = anchors[index];
          end = anchors[index + 1];
          break;
        }
      }
      const ratio =
        start[1] +
        ((day - start[0]) / Math.max(1, end[0] - start[0])) *
          (end[1] - start[1]);
      const rangeScale =
        days === 90
          ? 1
          : anchors.find((item) => item[0] === days)?.[1] || .91;
      values.push(
        Math.round(totalValue * Math.min(1, ratio / rangeScale)),
      );
    }
    return values;
  };

  const renderChart = (totalValue) => {
    const values = makeSeries(selectedRange, totalValue);
    const width = 700;
    const height = 270;
    const left = 54;
    const right = 18;
    const top = 24;
    const bottom = 34;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const max = Math.max(1, ...values) * 1.08;
    const x = (index) => left + (index / (values.length - 1)) * plotWidth;
    const y = (value) => top + plotHeight - (value / max) * plotHeight;
    const points = values.map((value, index) => [x(index), y(value)]);
    const linePath = points
      .map(
        (point, index) =>
          `${index ? "L" : "M"} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`,
      )
      .join(" ");

    chartLine.setAttribute("d", linePath);
    chartArea.setAttribute(
      "d",
      `${linePath} L ${x(values.length - 1).toFixed(1)} ${top + plotHeight} L ${left} ${top + plotHeight} Z`,
    );
    chartGrid.innerHTML = [0, .5, 1]
      .map((ratio) => {
        const gridY = top + plotHeight - ratio * plotHeight;
        return `<line class="grid" x1="${left}" x2="${width - right}" y1="${gridY}" y2="${gridY}"></line>
          <text class="axis-label" x="${left - 9}" y="${gridY + 4}" text-anchor="end">${formatMetric(max * ratio)}</text>`;
      })
      .join("");

    const ticks = [
      ...new Set([
        0,
        Math.min(3, selectedRange),
        Math.min(7, selectedRange),
        Math.min(14, selectedRange),
        selectedRange,
      ]),
    ];
    chartLabels.innerHTML = ticks
      .map(
        (day) =>
          `<text class="axis-label" x="${x(day)}" y="${height - 9}" text-anchor="${day === 0 ? "start" : day === selectedRange ? "end" : "middle"}">Day ${day}</text>`,
      )
      .join("");
    chartMilestones.innerHTML = [3, 7, 14, 30, 90]
      .filter((day) => day <= selectedRange)
      .map(
        (day) =>
          `<line class="milestone-line" x1="${x(day)}" x2="${x(day)}" y1="${top}" y2="${top + plotHeight}"></line>
          <text class="milestone-label" x="${x(day) + 5}" y="${top + 13}">${day}D</text>`,
      )
      .join("");
    chartPoints.innerHTML = [
      ...new Set([
        Math.min(3, selectedRange),
        Math.min(7, selectedRange),
        Math.min(14, selectedRange),
        selectedRange,
      ]),
    ]
      .map(
        (day) =>
          `<circle class="total-point" cx="${x(day)}" cy="${y(values[day])}" r="4"><title>Day ${day}: ${formatMetric(values[day])} views</title></circle>`,
      )
      .join("");
  };

  const render = () => {
    const current = data[selectedPlatform];
    const visibleExternal = externalIncluded ? current.external : 0;
    const visibleTotal = current.owned + visibleExternal;
    const ownedPercent = visibleTotal
      ? Math.round((current.owned / visibleTotal) * 100)
      : 0;

    root.dataset.external = String(externalIncluded);
    externalLabel.textContent = externalIncluded ? "Included" : "Excluded";
    totalViews.textContent = formatMetric(visibleTotal);
    ownedViews.textContent = formatMetric(current.owned);
    ownedShare.textContent = `${ownedPercent}% of visible views`;
    externalViews.textContent = externalIncluded
      ? formatMetric(current.external)
      : "—";
    externalShare.textContent = externalIncluded
      ? `${100 - ownedPercent}% of visible views · ${isMagazine ? 0 : 2} posts`
      : "Excluded from totals";
    chartSubtitle.textContent = isMagazine
      ? "Imported snapshot only · history starts with the next refresh"
      : `${selectedPlatform === "all" ? "Cumulative cross-platform" : selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} views · ${selectedRange} days`;
    platformRows.forEach((row) => {
      const rowPlatform = row.dataset.rowPlatform;
      const rowData = data[rowPlatform];
      const allOwned = data.all.owned || 1;
      const share = Math.round((rowData.owned / allOwned) * 100);
      row.querySelector(".eo-bar").style.width = `${share}%`;
      row.querySelector(".eo-platform-value").innerHTML =
        `${formatMetric(rowData.owned)}<span class="eo-platform-share">${share}%</span>`;
      row.hidden =
        selectedPlatform !== "all" &&
        rowPlatform !== selectedPlatform;
    });
    renderChart(visibleTotal);
  };

  externalToggle.addEventListener("change", () => {
    externalIncluded = externalToggle.checked;
    render();
  });
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      selectedPlatform = tab.dataset.platform;
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.classList.toggle("btn-ghost", !active);
      });
      render();
    });
  });
  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedRange = Number(button.dataset.range);
      rangeButtons.forEach((item) => {
        const active = item === button;
        item.setAttribute("aria-pressed", String(active));
        item.classList.toggle("btn-ghost", !active);
      });
      render();
    });
  });
  render();
};

const page = document.body.dataset.page;
if (page === "overview") {
  initializeOverview().catch(console.error);
} else if (page === "detail") {
  initializeDetail().catch(console.error);
}
