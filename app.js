const DATA_URL = "./data/youtube-content-master.json";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const thumbnailUrl = (youtubeId) =>
  `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;

const detailUrl = (originalContentId) =>
  `./detail.html?id=${encodeURIComponent(originalContentId)}`;

const loadMasterData = async () => {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Master data request failed: ${response.status}`);
  }
  return response.json();
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

  const master = await loadMasterData();
  const contents = master.originalContents;
  let platform = "all";

  master.taxonomy.ipSeries.forEach((series) => {
    const option = document.createElement("option");
    option.value = series;
    option.textContent = series;
    seriesFilter.append(option);
  });

  const totals = {
    all: [12.8, contents.length],
    youtube: [8.3, contents.length],
    magazine: [1.3, 0],
    instagram: [2.6, 0],
    x: [.6, 0],
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
    if (platform !== "all" && platform !== "youtube") return [];

    const query = searchInput.value.trim().toLocaleLowerCase();
    const series = seriesFilter.value;
    const filtered = contents.filter((content) => {
      const searchable = [
        content.title,
        content.ipSeries,
        ...content.collectionTags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!series || content.ipSeries === series)
      );
    });

    return filtered.sort((a, b) => {
      if (sortSelect.value === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      if (sortSelect.value === "series-asc") {
        return (
          (a.ipSeries || "ZZZ").localeCompare(b.ipSeries || "ZZZ") ||
          a.title.localeCompare(b.title)
        );
      }
      return b.assetCount - a.assetCount || a.title.localeCompare(b.title);
    });
  };

  const contentRow = (content) => {
    const shortCount = content.assetTypeCounts.shorts ?? 0;
    return `
      <tr data-platforms="youtube">
        <td>
          <div class="eo-content-name">
            <img class="eo-thumbnail" src="${thumbnailUrl(content.originalContentId)}" alt="" loading="lazy">
            <div class="eo-content-copy">
              <div class="eo-content-title">${escapeHtml(content.title)}</div>
              <div class="eo-content-date">${escapeHtml(content.ipSeries || "Uncategorized")} · ${content.assetCount} linked assets</div>
            </div>
          </div>
        </td>
        <td class="text-end">
          <span class="eo-view-value">—</span>
          <span class="eo-data-pending">Snapshot pending</span>
        </td>
        <td>
          <div class="eo-platform-mix" aria-label="YouTube assets only">
            <span class="eo-mix" style="width: 100%; background: var(--eo-youtube)"></span>
          </div>
          <div class="eo-source">${content.assetCount} owned · ${shortCount} Shorts</div>
        </td>
        <td class="text-end"><a class="eo-row-action" href="${detailUrl(content.originalContentId)}">View detail ↗</a></td>
      </tr>
    `;
  };

  const renderContent = () => {
    const filtered = getFilteredContents();
    rowsContainer.innerHTML = filtered.length
      ? filtered.map(contentRow).join("")
      : '<tr><td colspan="4" class="eo-empty-row">No mapped content matches this filter.</td></tr>';
    resultLabel.textContent = `${filtered.length} original stories · master data`;
    contentCount.textContent = String(filtered.length);
  };

  const render = () => {
    const [baseTotal] = totals[platform];
    const externalIncluded = external.checked;
    const periodScale = {
      7: .28,
      30: 1,
      90: 2.3,
      365: 6.8,
    }[Number(range.value)];
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
    externalLabel.textContent = externalIncluded
      ? "External included"
      : "Owned only";
    root.dataset.external = String(externalIncluded);
    chartLabel.textContent = `Daily views · ${platform === "all" ? "all platforms" : platform} · ${range.value} days`;

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

  const requestedId = new URLSearchParams(window.location.search).get("id");
  if (!requestedId) {
    window.location.replace("./index.html");
    return;
  }

  const master = await loadMasterData();
  const content = master.originalContents.find(
    (item) => item.originalContentId === requestedId,
  );
  if (!content) {
    window.location.replace("./index.html");
    return;
  }

  const assets = content.assetIds
    .map((assetId) =>
      master.assets.find((asset) => asset.youtubeId === assetId),
    )
    .filter(Boolean)
    .sort((a, b) => Number(b.isAnchor) - Number(a.isAnchor));

  document.title = `${content.title} · EO Analytics`;
  root.querySelector("#detail-heading").textContent = content.title;
  root.querySelector("#detail-card-title").textContent = content.title;
  root.querySelector("#detail-series").textContent =
    content.ipSeries || "Uncategorized";
  root.querySelector("#detail-asset-summary").textContent =
    `${content.assetCount} owned YouTube assets`;
  root.querySelector("#detail-original-link").href = content.canonicalUrl;
  root.querySelector("#detail-thumbnail").src = thumbnailUrl(
    content.originalContentId,
  );
  root.querySelector("#detail-thumbnail").alt =
    `${content.title} YouTube thumbnail`;
  root.querySelector("#detail-content-id").textContent =
    `ID ${content.originalContentId}`;
  root.querySelector("#published-posts").innerHTML = assets
    .map(
      (asset) => `
        <li class="eo-published">
          <span class="eo-badge" style="background: var(--eo-youtube)">${asset.isAnchor ? "YT" : "S"}</span>
          <div class="eo-published-main">
            <a class="eo-published-name eo-published-link" href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">${escapeHtml(asset.title)}</a>
            <div class="eo-published-date">${asset.isAnchor ? "Original long-form" : "YouTube Short"}</div>
          </div>
          <span class="eo-source-badge">Owned</span>
        </li>
      `,
    )
    .join("");

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

  const data = {
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
    const max = Math.max(...values) * 1.08;
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
      ? `${100 - ownedPercent}% of visible views · 2 posts`
      : "Excluded from totals";
    chartSubtitle.textContent =
      `${selectedPlatform === "all" ? "Cumulative cross-platform" : selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} views · ${selectedRange} days`;
    platformRows.forEach((row) => {
      row.hidden =
        selectedPlatform !== "all" &&
        row.dataset.rowPlatform !== selectedPlatform;
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
