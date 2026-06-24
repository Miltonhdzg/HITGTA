const DATA_SOURCE = {
  type: "csv",
  url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4SpyknHHgm6sGvWzKHWaven_gc_9H2HI_q-5jlhPfB9bHaxmlp_k_fjct3FyuH4J_R6z0ZIxyW3IE/pub?gid=0&single=true&output=csv",
};

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxmAFVwDjix8FsLW2X-hXKnoiY_BFzsU8mKu42NvzIMt3RMwfFSZP1JnCbwcOrotOv7/exec";
const STORE_CHECK_PAGE_SIZE = 30;

const COLUMN_MAP = {
  promotoria: ["Promotoria", "Promotor"],
  numeroTienda: ["Numero_Tienda", "Numero tienda", "NumeroTienda"],
  tienda: ["Nombre de la tienda", "Nombre_Tienda"],
  familia: ["Familia"],
  producto: ["Producto"],
  casePack: ["CasePack", "Case Pack", "Casepack"],
  espacioAnaquel: ["espacio_anaquel", "Espacio_Anaquel", "Espacio Anaquel"],
  sku: ["SKU", "Sku"],
  ventaPromedioDia: ["promedio de venta dia", "Promedio de venta dia", "Venta Promedio Dia"],
};

const state = {
  rawRows: [],
  filteredRows: [],
  storeCheckRows: [],
  storeCheckVisibleCount: STORE_CHECK_PAGE_SIZE,
  storeCheckDrafts: {},
  isSubmitting: false,
  loadingTimer: 0,
};

const elements = {
  homeScreen: document.querySelector("#home-screen"),
  moduleScreens: document.querySelectorAll(".module-screen"),
  moduleButtons: document.querySelectorAll("[data-module-target]"),
  hitGtaModule: document.querySelector("#hit-gta-module"),
  storeCheckModule: document.querySelector("#store-check-module"),
  backHomeHitGta: document.querySelector("#back-home-hit-gta"),
  backHomeStoreCheck: document.querySelector("#back-home-store-check"),
  loadingOverlay: document.querySelector("#loading-overlay"),
  loadingTitle: document.querySelector("#loading-title"),
  loadingProgressBar: document.querySelector("#loading-progress-bar"),
  loadingProgressText: document.querySelector("#loading-progress-text"),
  confirmResetOverlay: document.querySelector("#confirm-reset-overlay"),
  cancelResetButton: document.querySelector("#cancel-reset"),
  confirmResetButton: document.querySelector("#confirm-reset"),
  confirmSendOverlay: document.querySelector("#confirm-send-overlay"),
  cancelSendButton: document.querySelector("#cancel-send"),
  confirmSendButton: document.querySelector("#confirm-send"),
  promotoriaSelect: document.querySelector("#promotor-select"),
  tiendaSelect: document.querySelector("#tienda-select"),
  familiaSelect: document.querySelector("#familia-select"),
  storeCheckPromotoriaSelect: document.querySelector("#store-check-promotor-select"),
  storeCheckTiendaSelect: document.querySelector("#store-check-tienda-select"),
  visitDate: document.querySelector("#visit-date"),
  ddiSugeridos: document.querySelector("#ddi-sugeridos"),
  resultsBody: document.querySelector("#results-body"),
  storeCheckResultsBody: document.querySelector("#store-check-results-body"),
  storeCheckResultsCopy: document.querySelector("#store-check-results-copy"),
  storeCheckLoadMoreButton: document.querySelector("#store-check-load-more"),
  sendButton: document.querySelector("#send-data"),
  resetButton: document.querySelector("#reset-filters"),
  storeCheckResetButton: document.querySelector("#store-check-reset-filters"),
  submissionStatus: document.querySelector("#submission-status"),
  submitForm: document.querySelector("#submit-form"),
  payloadInput: document.querySelector("#payload-input"),
  submitFrame: document.querySelector("#submit-frame"),
};

boot();

async function boot() {
  bindEvents();
  configureVisitDate();
  showHomeScreen();

  try {
    const rows = await loadRows();
    state.rawRows = rows.map(normalizeRow).filter(isUsableRow);
    populateAllFilters();
    applyFilters();
    populateStoreCheckFilters();
    applyStoreCheckFilters();
  } catch (error) {
    console.error(error);
    renderEmptyState("No se pudieron cargar registros.");
    renderStoreCheckEmptyState("No se pudieron cargar registros.");
  }
}

function bindEvents() {
  elements.moduleButtons.forEach((button) => {
    button.addEventListener("click", () => openModuleWithLoader(button.dataset.moduleTarget || "", button));
  });

  elements.backHomeHitGta.addEventListener("click", showHomeScreen);
  elements.backHomeStoreCheck.addEventListener("click", showHomeScreen);
  elements.promotoriaSelect.addEventListener("change", handleFilterChange);
  elements.tiendaSelect.addEventListener("change", handleFilterChange);
  elements.familiaSelect.addEventListener("change", handleFilterChange);
  elements.storeCheckPromotoriaSelect.addEventListener("change", handleStoreCheckFilterChange);
  elements.storeCheckTiendaSelect.addEventListener("change", handleStoreCheckFilterChange);
  elements.visitDate.addEventListener("change", updateDdiSugeridos);
  elements.ddiSugeridos.addEventListener("input", handleDdiInput);
  elements.resultsBody.addEventListener("input", handleTableInput);
  elements.storeCheckResultsBody.addEventListener("input", handleStoreCheckTableInput);
  elements.storeCheckLoadMoreButton.addEventListener("click", loadMoreStoreCheckRows);
  elements.sendButton.addEventListener("click", openSendConfirmation);
  elements.resetButton.addEventListener("click", openResetConfirmation);
  elements.storeCheckResetButton.addEventListener("click", resetStoreCheckFilters);
  elements.cancelResetButton.addEventListener("click", closeResetConfirmation);
  elements.confirmResetButton.addEventListener("click", confirmResetFilters);
  elements.cancelSendButton.addEventListener("click", closeSendConfirmation);
  elements.confirmSendButton.addEventListener("click", confirmSendInventoryData);
  elements.submitFrame.addEventListener("load", handleSubmitFrameLoad);
}

function showHomeScreen() {
  elements.homeScreen.classList.remove("is-hidden");
  elements.moduleScreens.forEach((screen) => {
    screen.classList.add("is-hidden");
  });
}

function showModule(moduleId) {
  elements.homeScreen.classList.add("is-hidden");
  elements.moduleScreens.forEach((screen) => {
    screen.classList.toggle("is-hidden", screen.id !== moduleId);
  });
}

function openModuleWithLoader(moduleId, button) {
  const moduleName = button?.querySelector("strong")?.textContent?.trim() || "Modulo";
  startLoadingOverlay(moduleName);

  window.setTimeout(() => {
    showModule(moduleId);
  }, 220);
}

function startLoadingOverlay(moduleName) {
  const progressSteps = [12, 27, 41, 58, 73, 89, 100];
  let stepIndex = 0;

  window.clearInterval(state.loadingTimer);
  elements.loadingTitle.textContent = moduleName;
  elements.loadingProgressBar.style.width = "0%";
  elements.loadingProgressText.textContent = "0%";
  elements.loadingOverlay.classList.remove("is-hidden");

  state.loadingTimer = window.setInterval(() => {
    const progress = progressSteps[stepIndex];
    elements.loadingProgressBar.style.width = `${progress}%`;
    elements.loadingProgressText.textContent = `${progress}%`;
    stepIndex += 1;

    if (stepIndex >= progressSteps.length) {
      window.clearInterval(state.loadingTimer);
      window.setTimeout(() => {
        elements.loadingOverlay.classList.add("is-hidden");
      }, 140);
    }
  }, 90);
}

function configureVisitDate() {
  const currentDate = new Date();
  const today = formatDateForInput(currentDate);
  const maxDate = new Date(currentDate);
  maxDate.setDate(maxDate.getDate() + 90);

  elements.visitDate.min = today;
  elements.visitDate.max = formatDateForInput(maxDate);
  elements.visitDate.value = today;
  updateDdiSugeridos();
}

async function loadRows() {
  if (DATA_SOURCE.type !== "csv") {
    throw new Error(`Tipo de origen no soportado: ${DATA_SOURCE.type}`);
  }

  const response = await fetch(DATA_SOURCE.url);
  if (!response.ok) {
    throw new Error(`Error cargando datos: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText);
}

function normalizeRow(row) {
  return {
    promotoria: pickValue(row, COLUMN_MAP.promotoria),
    numeroTienda: pickValue(row, COLUMN_MAP.numeroTienda),
    tienda: pickValue(row, COLUMN_MAP.tienda),
    familia: pickValue(row, COLUMN_MAP.familia),
    producto: pickValue(row, COLUMN_MAP.producto),
    casePack: toNumber(pickValue(row, COLUMN_MAP.casePack)),
    espacioAnaquel: toNumber(pickValue(row, COLUMN_MAP.espacioAnaquel)),
    sku: pickValue(row, COLUMN_MAP.sku),
    ventaPromedioDia: toNumber(pickValue(row, COLUMN_MAP.ventaPromedioDia)),
  };
}

function isUsableRow(row) {
  return row.tienda && row.producto;
}

function populateAllFilters() {
  populateSelect(elements.promotoriaSelect, uniqueValues(state.rawRows, "promotoria"), "Todas");
  populateSelect(elements.tiendaSelect, uniqueValues(state.rawRows, "tienda"), "Todas");
  populateSelect(elements.familiaSelect, uniqueValues(state.rawRows, "familia"), "Todas");
}

function handleFilterChange() {
  syncFilterOptions();
  applyFilters();
}

function handleStoreCheckFilterChange() {
  state.storeCheckVisibleCount = STORE_CHECK_PAGE_SIZE;
  syncStoreCheckFilterOptions();
  applyStoreCheckFilters();
}

function syncFilterOptions() {
  const current = getSelectedFilters();
  const filteredForPromotoria = filterRows({
    tienda: current.tienda,
    familia: current.familia,
  });
  const filteredForTienda = filterRows({
    promotoria: current.promotoria,
    familia: current.familia,
  });
  const filteredForFamilia = filterRows({
    promotoria: current.promotoria,
    tienda: current.tienda,
  });

  repopulateSelect(elements.promotoriaSelect, uniqueValues(filteredForPromotoria, "promotoria"), current.promotoria);
  repopulateSelect(elements.tiendaSelect, uniqueValues(filteredForTienda, "tienda"), current.tienda);
  repopulateSelect(elements.familiaSelect, uniqueValues(filteredForFamilia, "familia"), current.familia);
}

function applyFilters() {
  const filters = getSelectedFilters();
  state.filteredRows = filterRows(filters).sort((a, b) => b.ventaPromedioDia - a.ventaPromedioDia);
  renderTable(state.filteredRows);
}

function applyStoreCheckFilters() {
  const filters = getStoreCheckSelectedFilters();
  state.storeCheckRows = filterRows(filters).sort((a, b) => a.producto.localeCompare(b.producto, "es"));
  renderStoreCheckTable(state.storeCheckRows);
}

function filterRows(filters) {
  return state.rawRows.filter((row) => {
    if (filters.promotoria && row.promotoria !== filters.promotoria) return false;
    if (filters.tienda && row.tienda !== filters.tienda) return false;
    if (filters.familia && row.familia !== filters.familia) return false;
    return true;
  });
}

function populateStoreCheckFilters() {
  populateSelect(elements.storeCheckPromotoriaSelect, uniqueValues(state.rawRows, "promotoria"), "Todas");
  populateSelect(elements.storeCheckTiendaSelect, uniqueValues(state.rawRows, "tienda"), "Todas");
}

function syncStoreCheckFilterOptions() {
  const current = getStoreCheckSelectedFilters();
  const filteredForPromotoria = filterRows({
    tienda: current.tienda,
  });
  const filteredForTienda = filterRows({
    promotoria: current.promotoria,
  });

  repopulateSelect(
    elements.storeCheckPromotoriaSelect,
    uniqueValues(filteredForPromotoria, "promotoria"),
    current.promotoria,
  );
  repopulateSelect(
    elements.storeCheckTiendaSelect,
    uniqueValues(filteredForTienda, "tienda"),
    current.tienda,
  );
}

function renderTable(rows) {
  if (!rows.length) {
    renderEmptyState("No hay productos para la combinacion seleccionada.");
    return;
  }

  elements.resultsBody.innerHTML = rows
    .map(
      (row) => `
        <tr
          data-promotoria="${escapeHtml(row.promotoria)}"
          data-numero-tienda="${escapeHtml(row.numeroTienda)}"
          data-nombre-tienda="${escapeHtml(row.tienda)}"
          data-sku="${escapeHtml(row.sku)}"
          data-producto="${escapeHtml(row.producto)}"
        >
          <td>${escapeHtml(row.producto)}</td>
          <td><span class="metric-pill" data-average-value="${row.ventaPromedioDia.toFixed(2)}">${row.ventaPromedioDia.toFixed(2)}</span></td>
          <td>
            <input
              class="inventory-input"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              pattern="[0-9]*"
              aria-label="Inventario en piso de venta para ${escapeHtml(row.producto)}"
            />
          </td>
          <td>
            <span class="suggested-pill" data-suggested-value data-case-pack="${row.casePack}" data-shelf-space="${row.espacioAnaquel}">${calculateSuggestedValue(row.ventaPromedioDia, row.casePack, row.espacioAnaquel, 0)}</span>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderEmptyState(message) {
  elements.resultsBody.innerHTML = `
    <tr class="empty-state">
      <td colspan="4">${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderStoreCheckTable(rows) {
  if (!rows.length) {
    renderStoreCheckEmptyState("No hay productos para la combinacion seleccionada.");
    return;
  }

  const visibleRows = rows.slice(0, state.storeCheckVisibleCount);

  elements.storeCheckResultsBody.innerHTML = visibleRows
    .map(
      (row) => `
        <tr data-row-key="${escapeHtml(getStoreCheckRowKey(row))}">
          <td>${escapeHtml(row.producto)}</td>
          <td>
            <input
              class="price-input"
              type="text"
              inputmode="decimal"
              pattern="[0-9]*[.,]?[0-9]{0,2}"
              placeholder="0.00"
              value="${escapeHtml(getStoreCheckDraft(row).regular)}"
              aria-label="Precio regular para ${escapeHtml(row.producto)}"
            />
          </td>
          <td>
            <input
              class="price-input"
              type="text"
              inputmode="decimal"
              pattern="[0-9]*[.,]?[0-9]{0,2}"
              placeholder="0.00"
              value="${escapeHtml(getStoreCheckDraft(row).promo)}"
              aria-label="Precio promocion para ${escapeHtml(row.producto)}"
            />
          </td>
          <td>
            ${renderOfferDateCell(row)}
          </td>
        </tr>
      `,
    )
    .join("");

  elements.storeCheckResultsCopy.textContent = `${visibleRows.length} de ${rows.length} productos cargados.`;
  elements.storeCheckLoadMoreButton.classList.toggle("is-hidden", visibleRows.length >= rows.length);
}

function renderStoreCheckEmptyState(message) {
  elements.storeCheckResultsBody.innerHTML = `
    <tr class="empty-state">
      <td colspan="4">${escapeHtml(message)}</td>
    </tr>
  `;
  elements.storeCheckResultsCopy.textContent = "0 productos cargados.";
  elements.storeCheckLoadMoreButton.classList.add("is-hidden");
}

function resetFilters() {
  elements.promotoriaSelect.value = "";
  elements.tiendaSelect.value = "";
  elements.familiaSelect.value = "";
  configureVisitDate();
  populateAllFilters();
  applyFilters();
  setSubmissionStatus("");
}

function resetStoreCheckFilters() {
  elements.storeCheckPromotoriaSelect.value = "";
  elements.storeCheckTiendaSelect.value = "";
  state.storeCheckVisibleCount = STORE_CHECK_PAGE_SIZE;
  populateStoreCheckFilters();
  applyStoreCheckFilters();
}

function openResetConfirmation() {
  elements.confirmResetOverlay.classList.remove("is-hidden");
}

function closeResetConfirmation() {
  elements.confirmResetOverlay.classList.add("is-hidden");
}

function confirmResetFilters() {
  closeResetConfirmation();
  resetFilters();
}

function openSendConfirmation() {
  elements.confirmSendOverlay.classList.remove("is-hidden");
}

function closeSendConfirmation() {
  elements.confirmSendOverlay.classList.add("is-hidden");
}

function confirmSendInventoryData() {
  closeSendConfirmation();
  submitInventoryData();
}

function populateSelect(select, values, emptyLabel) {
  select.innerHTML = "";
  select.append(new Option(emptyLabel, ""));
  values.forEach((value) => {
    select.append(new Option(value, value));
  });
}

function repopulateSelect(select, values, selectedValue) {
  const fallbackLabel = "Todas";
  populateSelect(select, values, fallbackLabel);
  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function getSelectedFilters() {
  return {
    promotoria: elements.promotoriaSelect.value,
    tienda: elements.tiendaSelect.value,
    familia: elements.familiaSelect.value,
  };
}

function getStoreCheckSelectedFilters() {
  return {
    promotoria: elements.storeCheckPromotoriaSelect.value,
    tienda: elements.storeCheckTiendaSelect.value,
  };
}

function pickValue(row, candidates) {
  const key = Object.keys(row).find((columnName) => candidates.includes(columnName.trim()));
  return (key ? row[key] : "").toString().trim();
}

function toNumber(value) {
  if (!value) return 0;
  const normalized = value.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(csvText) {
  const lines = [];
  let currentValue = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const currentChar = csvText[index];
    const nextChar = csvText[index + 1];

    if (currentChar === '"') {
      if (insideQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (currentChar === "," && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((currentChar === "\n" || currentChar === "\r") && !insideQuotes) {
      if (currentChar === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      lines.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += currentChar;
  }

  if (currentValue || currentRow.length) {
    currentRow.push(currentValue);
    lines.push(currentRow);
  }

  const [headers = [], ...dataRows] = lines.filter((row) => row.some((cell) => cell !== ""));

  return dataRows.map((cells) =>
    headers.reduce((record, header, index) => {
      record[header.trim()] = (cells[index] ?? "").trim();
      return record;
    }, {}),
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateDdiSugeridos() {
  const selectedDate = elements.visitDate.value;
  if (!selectedDate) {
    elements.ddiSugeridos.value = "0";
    updateSuggestedValues();
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visitDate = new Date(`${selectedDate}T00:00:00`);
  const diffInMs = visitDate.getTime() - today.getTime();
  const diffInDays = Math.max(0, Math.round(diffInMs / 86400000));

  elements.ddiSugeridos.value = String(diffInDays);
  updateSuggestedValues();
}

function handleTableInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("inventory-input")) {
    return;
  }

  if (target.value.includes(".")) {
    target.value = target.value.split(".")[0];
  }

  updateSuggestedValueForRow(target.closest("tr"));
}

function handleStoreCheckTableInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const row = target.closest("tr");
  if (!(row instanceof HTMLTableRowElement)) return;
  const draft = getStoreCheckDraftByKey(row.dataset.rowKey || "");

  if (target.classList.contains("price-input")) {
    target.value = sanitizeDecimalInput(target.value);
    if (target.getAttribute("aria-label")?.includes("regular")) {
      draft.regular = target.value;
      validateStoreCheckPrices(row, draft);
    } else {
      const previousPromoValue = draft.promo;
      draft.promo = target.value;
      validateStoreCheckPrices(row, draft);
      if (!draft.promo) {
        draft.offerUntil = "";
      }
      if (previousPromoValue !== draft.promo) {
        updateOfferDateCell(row, draft);
      }
    }
    return;
  }

  if (target.classList.contains("offer-date-input")) {
    draft.offerUntil = target.value;
  }
}

function handleDdiInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.value.includes(".")) {
    target.value = target.value.split(".")[0];
  }

  updateSuggestedValues();
}

function updateSuggestedValues() {
  elements.resultsBody.querySelectorAll("tr").forEach((row) => {
    updateSuggestedValueForRow(row);
  });
}

function updateSuggestedValueForRow(rowElement) {
  if (!(rowElement instanceof HTMLTableRowElement)) {
    return;
  }

  const inventoryInput = rowElement.querySelector(".inventory-input");
  const suggestedOutput = rowElement.querySelector("[data-suggested-value]");
  const averageCell = rowElement.querySelector("[data-average-value]");

  if (!inventoryInput || !suggestedOutput || !averageCell) {
    return;
  }

  const averageValue = toNumber(averageCell.dataset.averageValue);
  const casePackValue = toNumber(suggestedOutput.dataset.casePack);
  const shelfSpaceValue = toNumber(suggestedOutput.dataset.shelfSpace);
  const inventoryValue = toInteger(inventoryInput.value);
  suggestedOutput.textContent = calculateSuggestedValue(averageValue, casePackValue, shelfSpaceValue, inventoryValue);
}

function calculateSuggestedValue(averageValue, casePackValue, shelfSpaceValue, inventoryValue) {
  const ddiValue = toInteger(elements.ddiSugeridos.value);
  const ddiNeed = averageValue * ddiValue - inventoryValue;
  const shelfNeed = shelfSpaceValue - inventoryValue;
  const baseSuggestedValue = Math.max(0, ddiNeed, shelfNeed);
  if (casePackValue <= 0) {
    return Math.ceil(baseSuggestedValue).toString();
  }

  return Math.ceil(baseSuggestedValue / casePackValue).toString();
}

function toInteger(value) {
  if (!value) return 0;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeDecimalInput(value) {
  if (!value) return "";

  const normalized = value.replace(",", ".");
  const cleaned = normalized.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const integerPart = parts[0] ?? "";
  const decimalPart = (parts[1] ?? "").slice(0, 2);

  if (cleaned.includes(".")) {
    return `${integerPart || "0"}.${decimalPart}`;
  }

  return integerPart;
}

function loadMoreStoreCheckRows() {
  state.storeCheckVisibleCount += STORE_CHECK_PAGE_SIZE;
  renderStoreCheckTable(state.storeCheckRows);
}

function getStoreCheckRowKey(row) {
  return [row.promotoria, row.tienda, row.sku, row.producto].join("|");
}

function getStoreCheckDraft(row) {
  return getStoreCheckDraftByKey(getStoreCheckRowKey(row));
}

function getStoreCheckDraftByKey(rowKey) {
  if (!state.storeCheckDrafts[rowKey]) {
    state.storeCheckDrafts[rowKey] = {
      regular: "",
      promo: "",
      offerUntil: "",
    };
  }

  return state.storeCheckDrafts[rowKey];
}

function renderOfferDateCell(row) {
  const draft = getStoreCheckDraft(row);
  if (!draft.promo) {
    return `<span class="offer-date-placeholder">Captura precio promocion</span>`;
  }

  return `
    <input
      class="offer-date-input"
      type="date"
      min="${elements.visitDate.min || ""}"
      value="${escapeHtml(draft.offerUntil)}"
      aria-label="Fecha limite de oferta para ${escapeHtml(row.producto)}"
    />
  `;
}

function updateOfferDateCell(rowElement, draft) {
  const offerDateCell = rowElement.cells[3];
  if (!offerDateCell) {
    return;
  }

  if (!draft.promo) {
    offerDateCell.innerHTML = `<span class="offer-date-placeholder">Captura precio promocion</span>`;
    return;
  }

  offerDateCell.innerHTML = `
    <input
      class="offer-date-input"
      type="date"
      min="${elements.visitDate.min || ""}"
      value="${escapeHtml(draft.offerUntil)}"
      aria-label="Fecha limite de oferta"
    />
  `;
}

function validateStoreCheckPrices(rowElement, draft) {
  const priceInputs = rowElement.querySelectorAll(".price-input");
  const regularInput = priceInputs[0];
  const promoInput = priceInputs[1];

  if (!(regularInput instanceof HTMLInputElement) || !(promoInput instanceof HTMLInputElement)) {
    return;
  }

  const regularValue = Number.parseFloat(draft.regular);
  const promoValue = Number.parseFloat(draft.promo);
  const hasComparableValues = Number.isFinite(regularValue) && Number.isFinite(promoValue);
  const isInvalid = hasComparableValues && promoValue > regularValue;

  const message = isInvalid ? "El precio promocion no puede ser mayor que el precio regular." : "";
  promoInput.setCustomValidity(message);
  promoInput.classList.toggle("is-invalid", isInvalid);

  if (!isInvalid) {
    return;
  }

  promoInput.reportValidity();
}

function submitInventoryData() {
  if (state.isSubmitting) {
    return;
  }

  if (!APPS_SCRIPT_WEB_APP_URL) {
    setSubmissionStatus("Falta configurar la URL del Web App de Apps Script.", "error");
    return;
  }

  const rowsToSubmit = collectRowsToSubmit();
  if (!rowsToSubmit.length) {
    setSubmissionStatus("Captura inventario en al menos un producto para poder enviar.", "error");
    return;
  }

  state.isSubmitting = true;
  elements.sendButton.disabled = true;
  elements.payloadInput.value = JSON.stringify({ rows: rowsToSubmit });
  elements.submitForm.action = APPS_SCRIPT_WEB_APP_URL;
  elements.submitForm.submit();
  setSubmissionStatus(`Enviando ${rowsToSubmit.length} registro(s)...`);
}

function collectRowsToSubmit() {
  const rows = [];

  elements.resultsBody.querySelectorAll("tr").forEach((rowElement) => {
    if (!(rowElement instanceof HTMLTableRowElement)) {
      return;
    }

    const inventoryInput = rowElement.querySelector(".inventory-input");
    const suggestedOutput = rowElement.querySelector("[data-suggested-value]");
    const averageOutput = rowElement.querySelector("[data-average-value]");

    if (!inventoryInput || !suggestedOutput || !averageOutput) {
      return;
    }

    const inventoryRawValue = inventoryInput.value.trim();
    if (inventoryRawValue === "") {
      return;
    }

    rows.push({
      Promotora: rowElement.dataset.promotoria ?? "",
      Numero_Tienda: rowElement.dataset.numeroTienda ?? "",
      Nombre_Tienda: rowElement.dataset.nombreTienda ?? "",
      SKU: rowElement.dataset.sku ?? "",
      Nombre_Producto: rowElement.dataset.producto ?? "",
      AVG_Vta_diario: averageOutput.dataset.averageValue ?? "0",
      Inventario: String(toInteger(inventoryRawValue)),
      DDI_Actuales: "",
      Cajas_Sugueridas: suggestedOutput.textContent?.trim() ?? "0",
      FechaPorxVisita: elements.visitDate.value || "",
    });
  });

  return rows;
}

function handleSubmitFrameLoad() {
  if (!state.isSubmitting) {
    return;
  }

  state.isSubmitting = false;
  elements.sendButton.disabled = false;
  setSubmissionStatus("Informacion enviada a la hoja Inventario.", "success");
}

function setSubmissionStatus(message, tone = "") {
  elements.submissionStatus.textContent = message;
  elements.submissionStatus.className = "submission-status";

  if (tone === "error") {
    elements.submissionStatus.classList.add("is-error");
  }

  if (tone === "success") {
    elements.submissionStatus.classList.add("is-success");
  }
}
