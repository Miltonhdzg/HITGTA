const HISTORY_STATE = {
  rows: [],
  filteredRows: [],
  loaded: false,
  loading: false,
  error: "",
  lastLoadedAt: "",
  pendingRequestId: "",
  loadTimeoutId: 0,
  activeFrame: null,
  pendingResolve: null,
  pendingReject: null,
};

const HISTORY_LOAD_TIMEOUT_MS = 30000;

const HISTORY_ELEMENTS = {
  screen: document.querySelector("#history-module"),
  status: document.querySelector("#history-status"),
  refreshButton: document.querySelector("#history-refresh"),
  clearButton: document.querySelector("#history-clear-filters"),
  startDate: document.querySelector("#history-range-start"),
  endDate: document.querySelector("#history-range-end"),
  moduleFilter: document.querySelector("#history-module-filter"),
  promotoraFilter: document.querySelector("#history-promotora-filter"),
  storeFilter: document.querySelector("#history-store-filter"),
  filterSummary: document.querySelector("#history-filter-summary"),
  totalRecords: document.querySelector("#history-total-records"),
  totalSubmissions: document.querySelector("#history-total-submissions"),
  totalStores: document.querySelector("#history-total-stores"),
  totalPromotoria: document.querySelector("#history-total-promotoria"),
  dailyNote: document.querySelector("#history-chart-daily-note"),
  moduleNote: document.querySelector("#history-chart-module-note"),
  storeNote: document.querySelector("#history-chart-store-note"),
  promotoraNote: document.querySelector("#history-chart-promotora-note"),
  dailyChart: document.querySelector("#history-daily-chart"),
  moduleChart: document.querySelector("#history-module-chart"),
  storeChart: document.querySelector("#history-store-chart"),
  promotoraChart: document.querySelector("#history-promotora-chart"),
  tableBody: document.querySelector("#history-table-body"),
};

const HISTORY_COLORS = {
  brand: "#0f766e",
  accent: "#efb64f",
  warm: "#d97706",
  muted: "#5b665f",
  line: "#d8ded8",
  text: "#1f2a24",
  bg: "#fffdf9",
  series: ["#0f766e", "#efb64f", "#8f6422", "#6b7280"],
};

initHistoryModule();
window.HistoryModule = {
  load: loadHistory,
  refresh: loadHistory,
};

function initHistoryModule() {
  if (!HISTORY_ELEMENTS.screen || HISTORY_ELEMENTS.screen.dataset.initialized === "true") {
    return;
  }

  HISTORY_ELEMENTS.screen.dataset.initialized = "true";
  bindHistoryEvents();
  configureHistoryFilters();
  renderHistory([]);
}

function bindHistoryEvents() {
  window.addEventListener("message", handleHistoryMessage);

  HISTORY_ELEMENTS.refreshButton?.addEventListener("click", () => {
    void loadHistory();
  });

  HISTORY_ELEMENTS.clearButton?.addEventListener("click", () => {
    configureHistoryFilters();
    syncHistoryFilterOptions();
    renderHistory();
  });

  HISTORY_ELEMENTS.startDate?.addEventListener("change", handleHistoryFilterChange);
  HISTORY_ELEMENTS.endDate?.addEventListener("change", handleHistoryFilterChange);
  HISTORY_ELEMENTS.moduleFilter?.addEventListener("change", handleHistoryFilterChange);
  HISTORY_ELEMENTS.promotoraFilter?.addEventListener("change", handleHistoryFilterChange);
  HISTORY_ELEMENTS.storeFilter?.addEventListener("change", handleHistoryFilterChange);
}

function configureHistoryFilters() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  if (HISTORY_ELEMENTS.startDate) {
    HISTORY_ELEMENTS.startDate.value = formatDateInput(start);
  }

  if (HISTORY_ELEMENTS.endDate) {
    HISTORY_ELEMENTS.endDate.value = formatDateInput(today);
  }

  if (HISTORY_ELEMENTS.moduleFilter) {
    HISTORY_ELEMENTS.moduleFilter.value = "";
  }

  if (HISTORY_ELEMENTS.promotoraFilter) {
    HISTORY_ELEMENTS.promotoraFilter.value = "";
  }

  if (HISTORY_ELEMENTS.storeFilter) {
    HISTORY_ELEMENTS.storeFilter.value = "";
  }
}

function handleHistoryFilterChange() {
  syncHistoryFilterOptions();
  renderHistory();
}

async function loadHistory() {
  const appsScriptUrl = getHistoryEndpointUrl();
  if (!appsScriptUrl) {
    setHistoryStatus("Configura la URL del Web App para ver el historial.", "error");
    renderHistory([]);
    return;
  }

  if (HISTORY_STATE.loading) {
    return;
  }

  HISTORY_STATE.loading = true;
  setHistoryStatus("Cargando historial...");

  try {
    const payload = await requestHistoryData(appsScriptUrl);
    applyHistoryPayload(payload);
  } catch (error) {
    console.error("No se pudo cargar el historial por fetch. Intentando fallback por iframe.", error);

    try {
      await requestHistoryFrame(appsScriptUrl);
    } catch (fallbackError) {
      console.error(fallbackError);
      HISTORY_STATE.loaded = false;
      HISTORY_STATE.error = fallbackError instanceof Error ? fallbackError.message : "No se pudo cargar el historial.";
      setHistoryStatus(HISTORY_STATE.error, "error");
      renderHistory([]);
    }
  } finally {
    HISTORY_STATE.loading = false;
  }
}

async function requestHistoryData(appsScriptUrl) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, HISTORY_LOAD_TIMEOUT_MS);

  try {
    const historyUrl = new URL(appsScriptUrl);
    historyUrl.searchParams.set("action", "history");
    historyUrl.searchParams.set("requestId", requestId);
    historyUrl.searchParams.set("ts", String(Date.now()));

    const response = await fetch(historyUrl.toString(), {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`No se pudo consultar el historial (${response.status}).`);
    }

    const payload = await response.json();
    if (payload && !payload.requestId) {
      payload.requestId = requestId;
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar el historial.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function requestHistoryFrame(appsScriptUrl) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const frame = document.createElement("iframe");

    cleanupHistoryFrame();
    HISTORY_STATE.pendingRequestId = requestId;
    HISTORY_STATE.activeFrame = frame;
    HISTORY_STATE.pendingResolve = resolve;
    HISTORY_STATE.pendingReject = reject;

    frame.className = "hidden-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.src = `${appsScriptUrl}?action=history&output=frame&requestId=${encodeURIComponent(requestId)}&ts=${Date.now()}`;

    window.clearTimeout(HISTORY_STATE.loadTimeoutId);
    HISTORY_STATE.loadTimeoutId = window.setTimeout(() => {
      if (HISTORY_STATE.pendingRequestId === requestId) {
        cleanupHistoryFrame();
        reject(
          new Error(
            "Tiempo de espera agotado al consultar el historial. Verifica que el Web App publicado use la version mas reciente del Apps Script.",
          ),
        );
      }
    }, HISTORY_LOAD_TIMEOUT_MS);

    document.body.appendChild(frame);
  });
}

function handleHistoryMessage(event) {
  if (!event?.data || event.data.type !== "hit-gta-history") {
    return;
  }

  if (event.data.payload?.requestId !== HISTORY_STATE.pendingRequestId) {
    return;
  }

  const payload = event.data.payload;
  const resolve = HISTORY_STATE.pendingResolve;
  const reject = HISTORY_STATE.pendingReject;
  cleanupHistoryFrame();

  try {
    applyHistoryPayload(payload);
    resolve?.();
  } catch (error) {
    reject?.(error instanceof Error ? error : new Error("No se pudo leer el historial."));
  }
}

function cleanupHistoryFrame() {
  window.clearTimeout(HISTORY_STATE.loadTimeoutId);
  HISTORY_STATE.loadTimeoutId = 0;

  if (HISTORY_STATE.activeFrame && HISTORY_STATE.activeFrame.parentNode) {
    HISTORY_STATE.activeFrame.parentNode.removeChild(HISTORY_STATE.activeFrame);
  }

  HISTORY_STATE.activeFrame = null;
  HISTORY_STATE.pendingRequestId = "";
  HISTORY_STATE.pendingResolve = null;
  HISTORY_STATE.pendingReject = null;
}

function applyHistoryPayload(payload) {
  if (!payload?.ok || !Array.isArray(payload.rows)) {
    const message = payload?.message || "No se pudo leer el historial.";
    HISTORY_STATE.loaded = false;
    HISTORY_STATE.error = message;
    setHistoryStatus(message, "error");
    renderHistory([]);
    throw new Error(message);
  }

  HISTORY_STATE.rows = payload.rows.map(normalizeHistoryRow).filter((row) => row.submittedAt);
  HISTORY_STATE.loaded = true;
  HISTORY_STATE.error = "";
  HISTORY_STATE.lastLoadedAt = new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
  syncHistoryFilterOptions();
  renderHistory();
}

function renderHistory(rows = HISTORY_STATE.rows) {
  const filteredRows = applyHistoryFilters(rows);
  HISTORY_STATE.filteredRows = filteredRows;

  const groupedSubmissions = groupSubmissions(filteredRows);
  const dailySeries = buildDailySeries(filteredRows);
  const moduleSeries = buildModuleSeries(filteredRows);
  const storeSeries = buildStoreSeries(filteredRows);
  const promotoraSeries = buildPromotoraSeries(filteredRows);

  updateSummaryCards(filteredRows, groupedSubmissions);
  renderDailyChart(HISTORY_ELEMENTS.dailyChart, dailySeries);
  renderModuleChart(HISTORY_ELEMENTS.moduleChart, moduleSeries);
  renderRankingChart(HISTORY_ELEMENTS.storeChart, storeSeries, {
    accentColor: HISTORY_COLORS.brand,
    trackColor: "rgba(15, 118, 110, 0.08)",
    emptyMessage: "Sin tiendas activas en este rango.",
  });
  renderRankingChart(HISTORY_ELEMENTS.promotoraChart, promotoraSeries, {
    accentColor: HISTORY_COLORS.accent,
    trackColor: "rgba(239, 182, 79, 0.16)",
    emptyMessage: "Sin promotoras activas en este rango.",
  });
  renderSubmissionTable(groupedSubmissions);
  renderChartNotes(dailySeries, moduleSeries, storeSeries, promotoraSeries, filteredRows.length);
  renderFilterSummary(filteredRows, groupedSubmissions);

  if (HISTORY_STATE.error) {
    setHistoryStatus(HISTORY_STATE.error, "error");
    return;
  }

  if (!HISTORY_STATE.loaded) {
    setHistoryStatus("Carga el historial para ver los datos.");
    return;
  }

  const rangeLabel = buildRangeLabel();
  const loadedLabel = HISTORY_STATE.lastLoadedAt ? `Actualizado ${HISTORY_STATE.lastLoadedAt}.` : "Actualizado.";
  setHistoryStatus(`${rangeLabel} ${loadedLabel}`.trim());
}

function applyHistoryFilters(rows) {
  const filters = getHistorySelectedFilters();
  return rows.filter((row) => matchesHistoryRow(row, filters));
}

function getHistorySelectedFilters() {
  return {
    start: HISTORY_ELEMENTS.startDate?.value || "",
    end: HISTORY_ELEMENTS.endDate?.value || "",
    module: HISTORY_ELEMENTS.moduleFilter?.value || "",
    promotora: HISTORY_ELEMENTS.promotoraFilter?.value || "",
    store: HISTORY_ELEMENTS.storeFilter?.value || "",
  };
}

function matchesHistoryRow(row, filters, options = {}) {
  const rowDate = row.submittedAtDateKey || "";

  if (filters.start && rowDate < filters.start) return false;
  if (filters.end && rowDate > filters.end) return false;
  if (!options.ignoreModule && filters.module && row.module !== filters.module) return false;
  if (!options.ignorePromotora && filters.promotora && getPromotoraLabel(row) !== filters.promotora) return false;
  if (!options.ignoreStore && filters.store && getStoreLabel(row) !== filters.store) return false;
  return true;
}

function syncHistoryFilterOptions() {
  populateHistoryPromotoraFilter();
  populateHistoryStoreFilter();
}

function populateHistoryPromotoraFilter() {
  if (!HISTORY_ELEMENTS.promotoraFilter) {
    return;
  }

  const current = HISTORY_ELEMENTS.promotoraFilter.value;
  const filters = getHistorySelectedFilters();
  const promotoraValues = uniqueValues(
    HISTORY_STATE.rows
      .filter((row) => matchesHistoryRow(row, filters, { ignorePromotora: true }))
      .map(getPromotoraLabel),
  );

  HISTORY_ELEMENTS.promotoraFilter.innerHTML = '<option value="">Todas</option>';
  for (const promotora of promotoraValues) {
    HISTORY_ELEMENTS.promotoraFilter.append(new Option(promotora, promotora));
  }

  HISTORY_ELEMENTS.promotoraFilter.value = promotoraValues.includes(current) ? current : "";
}

function populateHistoryStoreFilter() {
  if (!HISTORY_ELEMENTS.storeFilter) {
    return;
  }

  const current = HISTORY_ELEMENTS.storeFilter.value;
  const filters = getHistorySelectedFilters();
  const storeValues = uniqueValues(
    HISTORY_STATE.rows
      .filter((row) => matchesHistoryRow(row, filters, { ignoreStore: true }))
      .map(getStoreLabel),
  );

  HISTORY_ELEMENTS.storeFilter.innerHTML = '<option value="">Todas</option>';
  for (const store of storeValues) {
    HISTORY_ELEMENTS.storeFilter.append(new Option(store, store));
  }

  HISTORY_ELEMENTS.storeFilter.value = storeValues.includes(current) ? current : "";
}

function updateSummaryCards(filteredRows, groupedSubmissions) {
  const uniqueStores = uniqueValues(filteredRows.map((row) => row.tienda));
  const uniquePromotoria = uniqueValues(filteredRows.map((row) => row.promotora));

  if (HISTORY_ELEMENTS.totalRecords) {
    HISTORY_ELEMENTS.totalRecords.textContent = formatNumber(filteredRows.length);
  }

  if (HISTORY_ELEMENTS.totalSubmissions) {
    HISTORY_ELEMENTS.totalSubmissions.textContent = formatNumber(groupedSubmissions.length);
  }

  if (HISTORY_ELEMENTS.totalStores) {
    HISTORY_ELEMENTS.totalStores.textContent = formatNumber(uniqueStores.length);
  }

  if (HISTORY_ELEMENTS.totalPromotoria) {
    HISTORY_ELEMENTS.totalPromotoria.textContent = formatNumber(uniquePromotoria.length);
  }
}

function renderChartNotes(dailySeries, moduleSeries, storeSeries, promotoraSeries, totalRows) {
  if (HISTORY_ELEMENTS.dailyNote) {
    const peakDay = getPeakSeriesItem(dailySeries);
    HISTORY_ELEMENTS.dailyNote.textContent = peakDay
      ? `${dailySeries.length} dias · pico ${shortDateLabel(peakDay.label)}`
      : `${dailySeries.length} dias`;
  }

  if (HISTORY_ELEMENTS.moduleNote) {
    const leader = moduleSeries[0];
    HISTORY_ELEMENTS.moduleNote.textContent = leader
      ? `${leader.label} lidera con ${formatNumber(leader.value)}`
      : "Sin datos";
  }

  if (HISTORY_ELEMENTS.storeNote) {
    const leader = storeSeries[0];
    HISTORY_ELEMENTS.storeNote.textContent = leader
      ? `${truncateLabel(leader.label, 22)} · ${formatNumber(leader.value)}`
      : "Sin datos";
  }

  if (HISTORY_ELEMENTS.promotoraNote) {
    const leader = promotoraSeries[0];
    HISTORY_ELEMENTS.promotoraNote.textContent = leader
      ? `${truncateLabel(leader.label, 22)} · ${formatNumber(leader.value)}`
      : totalRows
        ? "Sin promotora"
        : "Sin datos";
  }
}

function renderFilterSummary(filteredRows, groupedSubmissions) {
  if (!HISTORY_ELEMENTS.filterSummary) {
    return;
  }

  const filters = getHistorySelectedFilters();
  const activeLabels = [];

  if (filters.module) activeLabels.push(`Modulo: ${filters.module}`);
  if (filters.promotora) activeLabels.push(`Promotora: ${filters.promotora}`);
  if (filters.store) activeLabels.push(`Tienda: ${filters.store}`);

  const baseSummary = activeLabels.length ? activeLabels.join(" · ") : "Sin filtros adicionales";
  const rangeSummary = `${formatNumber(filteredRows.length)} registros en ${formatNumber(groupedSubmissions.length)} envios`;
  HISTORY_ELEMENTS.filterSummary.textContent = `${baseSummary} · ${rangeSummary}.`;
}

function renderSubmissionTable(groupedSubmissions) {
  if (!HISTORY_ELEMENTS.tableBody) {
    return;
  }

  if (!groupedSubmissions.length) {
    HISTORY_ELEMENTS.tableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">No hay registros para el rango seleccionado.</td>
      </tr>
    `;
    return;
  }

  HISTORY_ELEMENTS.tableBody.innerHTML = groupedSubmissions
    .slice(0, 12)
    .map(
      (entry) => `
        <tr>
          <td data-label="Fecha">${escapeHtml(entry.submittedAtDisplay || formatHistoryTimestamp(entry.submittedAt))}</td>
          <td data-label="Modulo">${escapeHtml(entry.module || "-")}</td>
          <td data-label="Promotora">${escapeHtml(entry.promotora || "-")}</td>
          <td data-label="Tienda">${escapeHtml(entry.tienda || "-")}</td>
          <td data-label="Registros">${formatNumber(entry.count)}</td>
        </tr>
      `,
    )
    .join("");
}

function buildDailySeries(rows) {
  const counts = new Map();

  for (const row of rows) {
    const dateKey = row.submittedAtDateKey || "";
    if (!dateKey) continue;
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({ label, value }));
}

function buildModuleSeries(rows) {
  const counts = new Map();

  for (const row of rows) {
    const key = row.module || "Sin modulo";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es"));
}

function buildStoreSeries(rows) {
  const counts = new Map();

  for (const row of rows) {
    const key = getStoreLabel(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es"))
    .slice(0, 5);
}

function buildPromotoraSeries(rows) {
  const counts = new Map();

  for (const row of rows) {
    const key = getPromotoraLabel(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es"))
    .slice(0, 6);
}

function groupSubmissions(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = [row.submittedAtGroupKey, row.module, row.promotora, row.tienda].join("|");
    const current = groups.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    groups.set(key, {
      submittedAt: row.submittedAt,
      submittedAtDisplay: row.submittedAtDisplay,
      module: row.module || "",
      promotora: row.promotora || "",
      tienda: row.tienda || "",
      count: 1,
      submittedAtSortValue: row.submittedAtSortValue,
    });
  }

  return [...groups.values()].sort(
    (left, right) =>
      (right.submittedAtSortValue || 0) - (left.submittedAtSortValue || 0) ||
      String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")),
  );
}

function renderDailyChart(svgElement, series) {
  if (!svgElement) return;

  if (!series.length) {
    svgElement.innerHTML = renderEmptyChartSvg("Sin registros en este rango.");
    return;
  }

  const width = 640;
  const height = 240;
  const padding = { top: 18, right: 20, bottom: 42, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio));
  const step = series.length > 1 ? chartWidth / (series.length - 1) : 0;

  const points = series.map((item, index) => {
    const x = padding.left + step * index;
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const labelStep = Math.max(1, Math.ceil(points.length / 8));
  const peakPoint = points.reduce((top, point) => (!top || point.value > top.value ? point : top), null);

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = buildAreaPath(points, padding.top + chartHeight, padding.left);

  svgElement.innerHTML = `
    <defs>
      <linearGradient id="history-daily-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${HISTORY_COLORS.brand}" stop-opacity="0.24" />
        <stop offset="100%" stop-color="${HISTORY_COLORS.brand}" stop-opacity="0.04" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="640" height="240" rx="24" fill="${HISTORY_COLORS.bg}" />
    ${gridValues
      .map((value) => {
        const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
        return `
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${HISTORY_COLORS.line}" stroke-dasharray="4 6" />
          <text x="${padding.left - 6}" y="${y + 4}" text-anchor="end" fill="${HISTORY_COLORS.muted}" font-size="10">${formatNumber(value)}</text>
        `;
      })
      .join("")}
    <path d="${areaPath}" fill="url(#history-daily-fill)" />
    <polyline points="${linePoints}" fill="none" stroke="${HISTORY_COLORS.brand}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    ${points
      .map(
        (point, index) => `
          <circle cx="${point.x}" cy="${point.y}" r="5" fill="${HISTORY_COLORS.accent}" stroke="${HISTORY_COLORS.brand}" stroke-width="2" />
          ${
            index % labelStep === 0 || index === 0 || index === points.length - 1
              ? `
                <text x="${point.x}" y="${height - 16}" text-anchor="middle" fill="${HISTORY_COLORS.muted}" font-size="11">${escapeSvgText(shortDateLabel(point.label))}</text>
                <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" fill="${HISTORY_COLORS.text}" font-size="11" font-weight="700">${point.value}</text>
              `
              : ""
          }
        `,
      )
      .join("")}
    ${
      peakPoint
        ? `
          <rect x="${Math.max(padding.left, peakPoint.x - 52)}" y="${Math.max(8, peakPoint.y - 54)}" width="104" height="34" rx="10" fill="rgba(31, 42, 36, 0.88)" />
          <text x="${peakPoint.x}" y="${Math.max(30, peakPoint.y - 33)}" text-anchor="middle" fill="#fffdf8" font-size="10">${escapeSvgText(shortDateLabel(peakPoint.label))}</text>
          <text x="${peakPoint.x}" y="${Math.max(44, peakPoint.y - 18)}" text-anchor="middle" fill="#fffdf8" font-size="12" font-weight="700">${formatNumber(peakPoint.value)} registros</text>
        `
        : ""
    }
  `;
}

function renderModuleChart(svgElement, series) {
  if (!svgElement) return;

  if (!series.length) {
    svgElement.innerHTML = renderEmptyChartSvg("Sin registros en este rango.");
    return;
  }

  const total = series.reduce((sum, item) => sum + item.value, 0);
  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const centerX = 104;
  const centerY = 96;
  let offset = 0;

  const segments = series.map((item, index) => {
    const dashLength = total ? (item.value / total) * circumference : 0;
    const segment = `
      <circle
        cx="${centerX}"
        cy="${centerY}"
        r="${radius}"
        fill="none"
        stroke="${HISTORY_COLORS.series[index % HISTORY_COLORS.series.length]}"
        stroke-width="28"
        stroke-linecap="butt"
        stroke-dasharray="${dashLength} ${circumference - dashLength}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${centerX} ${centerY})"
      />
    `;
    offset += dashLength;
    return segment;
  });

  const legend = series
    .map(
      (item, index) => `
        <g transform="translate(218, ${54 + index * 64})">
          <rect x="0" y="0" width="12" height="12" rx="4" fill="${HISTORY_COLORS.series[index % HISTORY_COLORS.series.length]}" />
          <text x="18" y="11" fill="${HISTORY_COLORS.text}" font-size="12" font-weight="700">${escapeSvgText(item.label)}</text>
          <text x="18" y="30" fill="${HISTORY_COLORS.muted}" font-size="11">${formatNumber(item.value)} registros · ${formatPercent(item.value / total)}</text>
        </g>
      `,
    )
    .join("");

  svgElement.innerHTML = `
    <rect x="0" y="0" width="420" height="240" rx="24" fill="${HISTORY_COLORS.bg}" />
    ${segments.join("")}
    <circle cx="${centerX}" cy="${centerY}" r="${radius - 30}" fill="${HISTORY_COLORS.bg}" />
    <text x="${centerX}" y="${centerY - 2}" text-anchor="middle" fill="${HISTORY_COLORS.text}" font-size="28" font-weight="700">${formatNumber(total)}</text>
    <text x="${centerX}" y="${centerY + 20}" text-anchor="middle" fill="${HISTORY_COLORS.muted}" font-size="11">registros</text>
    ${legend}
  `;
}

function renderRankingChart(svgElement, series, options = {}) {
  if (!svgElement) return;

  if (!series.length) {
    svgElement.innerHTML = renderEmptyChartSvg(options.emptyMessage || "Sin registros en este rango.");
    return;
  }

  const width = 640;
  const height = 260;
  const padding = { top: 20, right: 46, bottom: 24, left: 176 };
  const barHeight = 22;
  const gap = 14;
  const chartWidth = width - padding.left - padding.right;
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const accentColor = options.accentColor || HISTORY_COLORS.brand;
  const trackColor = options.trackColor || "rgba(15, 118, 110, 0.08)";

  svgElement.innerHTML = `
    <rect x="0" y="0" width="640" height="260" rx="24" fill="${HISTORY_COLORS.bg}" />
    ${series
      .map((item, index) => {
        const y = padding.top + index * (barHeight + gap);
        const barWidth = (item.value / maxValue) * chartWidth;
        return `
          <circle cx="28" cy="${y + 11}" r="12" fill="${index === 0 ? accentColor : "rgba(31, 42, 36, 0.08)"}" />
          <text x="28" y="${y + 15}" text-anchor="middle" fill="${index === 0 ? "#fffdf8" : HISTORY_COLORS.text}" font-size="11" font-weight="700">${index + 1}</text>
          <text x="52" y="${y + 12}" fill="${HISTORY_COLORS.text}" font-size="12" font-weight="700">${escapeSvgText(truncateLabel(item.label, 24))}</text>
          <text x="52" y="${y + 28}" fill="${HISTORY_COLORS.muted}" font-size="11">${formatPercent(item.value / total)} del rango</text>
          <rect x="${padding.left}" y="${y}" width="${chartWidth}" height="${barHeight}" rx="12" fill="${trackColor}" />
          <rect x="${padding.left}" y="${y}" width="${barWidth}" height="${barHeight}" rx="12" fill="${accentColor}" />
          <text x="${Math.min(width - 14, padding.left + barWidth + 10)}" y="${y + 16}" fill="${HISTORY_COLORS.muted}" font-size="12">${formatNumber(item.value)}</text>
        `;
      })
      .join("")}
  `;
}

function buildAreaPath(points, baseline, startX) {
  if (!points.length) return "";
  const moveTo = `M ${startX} ${baseline}`;
  const lineTo = points.map((point, index) => `${index === 0 ? "L" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = points[points.length - 1];
  const close = `L ${lastPoint.x} ${baseline} Z`;
  return `${moveTo} ${lineTo} ${close}`;
}

function renderEmptyChartSvg(message) {
  return `
    <rect x="0" y="0" width="100%" height="100%" rx="24" fill="${HISTORY_COLORS.bg}" />
    <text x="50%" y="50%" text-anchor="middle" fill="${HISTORY_COLORS.muted}" font-size="14">${escapeSvgText(message)}</text>
  `;
}

function buildRangeLabel() {
  const start = HISTORY_ELEMENTS.startDate?.value || "";
  const end = HISTORY_ELEMENTS.endDate?.value || "";

  if (!start && !end) {
    return "";
  }

  if (start && end) {
    return `${formatDateLabel(start)} al ${formatDateLabel(end)}.`;
  }

  if (start) {
    return `Desde ${formatDateLabel(start)}.`;
  }

  return `Hasta ${formatDateLabel(end)}.`;
}

function getHistoryEndpointUrl() {
  return window.HIT_GTA_CONFIG?.appsScriptWebAppUrl || "";
}

function normalizeHistoryRow(row) {
  const submittedAtRaw = String(row.submittedAt || row.sentAt || row.fecha || row.Fecha || "").trim();
  const submittedAtDate = parseHistoryDate(submittedAtRaw);

  return {
    submittedAt: submittedAtRaw,
    submittedAtDateKey: submittedAtDate ? formatDateInput(submittedAtDate) : "",
    submittedAtDisplay: submittedAtDate ? formatHistoryDateTime(submittedAtDate) : submittedAtRaw,
    submittedAtGroupKey: submittedAtDate ? formatHistoryDateTimeKey(submittedAtDate) : submittedAtRaw,
    submittedAtSortValue: submittedAtDate ? submittedAtDate.getTime() : 0,
    module: String(row.module || row.modulo || row.target || "").trim(),
    promotora: String(row.promotora || row.Promotora || row.Promotoria || "").trim(),
    tienda: String(row.tienda || row.Tienda || row.nombreTienda || row.NombreTienda || "").trim(),
    numeroTienda: String(row.numeroTienda || row.NumeroTienda || "").trim(),
    sku: String(row.sku || row.SKU || "").trim(),
    producto: String(row.producto || row.product || row.Nombre_Producto || "").trim(),
  };
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
}

function getDateKey(value) {
  const parsedDate = parseHistoryDate(value);
  return parsedDate ? formatDateInput(parsedDate) : "";
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateValue) {
  const [year, month, day] = String(dateValue).split("-");
  if (!year || !month || !day) {
    return dateValue;
  }
  return `${day}/${month}/${year}`;
}

function formatHistoryTimestamp(value) {
  if (!value) return "-";
  const parsedDate = parseHistoryDate(value);
  if (parsedDate) {
    return formatHistoryDateTime(parsedDate);
  }

  const [datePart, timePart = ""] = String(value).split(" ");
  const formattedDate = formatDateLabel(datePart);
  return timePart ? `${formattedDate} ${timePart.slice(0, 5)}` : formattedDate;
}

function shortDateLabel(value) {
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}`;
}

function truncateLabel(label, maxLength) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-MX").format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function getPeakSeriesItem(series) {
  return series.reduce((peak, item) => (!peak || item.value > peak.value ? item : peak), null);
}

function getPromotoraLabel(row) {
  return row.promotora || "Sin promotora";
}

function getStoreLabel(row) {
  return row.tienda || "Sin tienda";
}

function parseHistoryDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoMatch) {
    const [, year, month, day, hours = "00", minutes = "00", seconds = "00"] = isoMatch;
    const parsedIsoDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    );

    if (!Number.isNaN(parsedIsoDate.getTime())) {
      return parsedIsoDate;
    }
  }

  const cleanedValue = rawValue.replace(/\s*\([^)]*\)\s*$/u, "").trim();
  const parsedDate = new Date(cleanedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatHistoryDateTime(date) {
  const dateLabel = formatDateInput(date);
  return `${formatDateLabel(dateLabel)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatHistoryDateTimeKey(date) {
  return `${formatDateInput(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function setHistoryStatus(message, tone = "") {
  if (!HISTORY_ELEMENTS.status) {
    return;
  }

  HISTORY_ELEMENTS.status.textContent = message;
  HISTORY_ELEMENTS.status.className = "submission-status history-status";

  if (tone === "error") {
    HISTORY_ELEMENTS.status.classList.add("is-error");
  }

  if (tone === "success") {
    HISTORY_ELEMENTS.status.classList.add("is-success");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSvgText(value) {
  return escapeHtml(value);
}
