const DATA_SOURCE = {
  type: "csv",
  url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4SpyknHHgm6sGvWzKHWaven_gc_9H2HI_q-5jlhPfB9bHaxmlp_k_fjct3FyuH4J_R6z0ZIxyW3IE/pub?gid=0&single=true&output=csv",
};

const USERS_SOURCE = {
  type: "csv",
  url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS4SpyknHHgm6sGvWzKHWaven_gc_9H2HI_q-5jlhPfB9bHaxmlp_k_fjct3FyuH4J_R6z0ZIxyW3IE/pub?gid=113947866&single=true&output=csv",
};

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxkv6P9wHWRtY7_psFy5xzJlBaR4IiqQpomtsNdCrY3Wf13UE8eonkyIQ_8712W3ZIY/exec";
const STORE_CHECK_PAGE_SIZE = 30;
const SESSION_STORAGE_KEY = "hit-gta-session";

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
  users: [],
  filteredRows: [],
  storeCheckRows: [],
  storeCheckVisibleCount: STORE_CHECK_PAGE_SIZE,
  storeCheckDrafts: {},
  storeCheckSharedOfferUntil: "",
  storeCheckSharedOfferSourceRowKey: "",
  authUser: null,
  isSubmitting: false,
  isAuthenticating: false,
  pendingReceipt: null,
  receiptImageBlob: null,
  receiptImageUrl: "",
  receiptFileBaseName: "comprobante-hit-gta",
  loadingTimer: 0,
};

const elements = {
  loginScreen: document.querySelector("#login-screen"),
  loginForm: document.querySelector("#login-form"),
  loginUser: document.querySelector("#login-user"),
  loginPassword: document.querySelector("#login-password"),
  loginButton: document.querySelector("#login-button"),
  loginStatus: document.querySelector("#login-status"),
  sessionBar: document.querySelector("#session-bar"),
  sessionBarHost: document.querySelector("#session-bar-host"),
  homeSessionHost: document.querySelector("#home-session-host"),
  hitGtaSessionHost: document.querySelector("#hit-gta-session-host"),
  storeCheckSessionHost: document.querySelector("#store-check-session-host"),
  homeStoreSelect: document.querySelector("#home-store-select"),
  homeSelectionStatus: document.querySelector("#home-selection-status"),
  sessionUser: document.querySelector("#session-user"),
  sessionRole: document.querySelector("#session-role"),
  logoutButton: document.querySelector("#logout-button"),
  homeScreen: document.querySelector("#home-screen"),
  moduleScreens: document.querySelectorAll(".module-screen"),
  moduleButtons: document.querySelectorAll("[data-module-target]"),
  hitGtaModule: document.querySelector("#hit-gta-module"),
  storeCheckModule: document.querySelector("#store-check-module"),
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
  confirmStoreCheckSendOverlay: document.querySelector("#confirm-store-check-send-overlay"),
  cancelStoreCheckSendButton: document.querySelector("#cancel-store-check-send"),
  confirmStoreCheckSendButton: document.querySelector("#confirm-store-check-send"),
  receiptPreviewOverlay: document.querySelector("#receipt-preview-overlay"),
  closeReceiptPreviewButton: document.querySelector("#close-receipt-preview"),
  receiptPreviewImage: document.querySelector("#receipt-preview-image"),
  downloadReceiptButton: document.querySelector("#download-receipt"),
  shareReceiptButton: document.querySelector("#share-receipt"),
  familiaSelect: document.querySelector("#familia-select"),
  visitDate: document.querySelector("#visit-date"),
  ddiSugeridos: document.querySelector("#ddi-sugeridos"),
  resultsBody: document.querySelector("#results-body"),
  storeCheckResultsBody: document.querySelector("#store-check-results-body"),
  storeCheckResultsCopy: document.querySelector("#store-check-results-copy"),
  storeCheckLoadMoreButton: document.querySelector("#store-check-load-more"),
  sendButton: document.querySelector("#send-data"),
  storeCheckSendButton: document.querySelector("#store-check-send-data"),
  resetButton: document.querySelector("#reset-filters"),
  storeCheckResetButton: document.querySelector("#store-check-reset-filters"),
  submissionStatus: document.querySelector("#submission-status"),
  storeCheckSubmissionStatus: document.querySelector("#store-check-submission-status"),
  submitForm: document.querySelector("#submit-form"),
  payloadInput: document.querySelector("#payload-input"),
  submitFrame: document.querySelector("#submit-frame"),
};

boot();

async function boot() {
  bindEvents();
  configureVisitDate();
  showLoginScreen();

  try {
    const [rows, users] = await Promise.all([loadRows(), loadUsers()]);
    state.rawRows = rows.map(normalizeRow).filter(isUsableRow);
    state.users = users.map(normalizeUserRow).filter(isUsableUser);
    populateAllFilters();
    applyFilters();
    populateStoreCheckFilters();
    applyStoreCheckFilters();
    restoreSession();
  } catch (error) {
    console.error(error);
    setLoginStatus("No se pudieron cargar usuarios o registros.", "error");
    renderEmptyState("No se pudieron cargar registros.");
    renderStoreCheckEmptyState("No se pudieron cargar registros.");
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.logoutButton.addEventListener("click", handleSessionAction);
  elements.moduleButtons.forEach((button) => {
    button.addEventListener("click", () => openModuleWithLoader(button.dataset.moduleTarget || "", button));
  });
  elements.homeStoreSelect.addEventListener("change", handleGlobalStoreChange);
  elements.familiaSelect.addEventListener("change", handleFilterChange);
  elements.visitDate.addEventListener("change", updateDdiSugeridos);
  elements.ddiSugeridos.addEventListener("input", handleDdiInput);
  elements.resultsBody.addEventListener("input", handleTableInput);
  elements.storeCheckResultsBody.addEventListener("input", handleStoreCheckTableInput);
  elements.storeCheckResultsBody.addEventListener("focusout", handleStoreCheckTableFocusOut);
  elements.storeCheckLoadMoreButton.addEventListener("click", loadMoreStoreCheckRows);
  elements.sendButton.addEventListener("click", openSendConfirmation);
  elements.storeCheckSendButton.addEventListener("click", openStoreCheckSendConfirmation);
  elements.resetButton.addEventListener("click", openResetConfirmation);
  elements.storeCheckResetButton.addEventListener("click", resetStoreCheckFilters);
  elements.cancelResetButton.addEventListener("click", closeResetConfirmation);
  elements.confirmResetButton.addEventListener("click", confirmResetFilters);
  elements.cancelSendButton.addEventListener("click", closeSendConfirmation);
  elements.confirmSendButton.addEventListener("click", confirmSendInventoryData);
  elements.cancelStoreCheckSendButton.addEventListener("click", closeStoreCheckSendConfirmation);
  elements.confirmStoreCheckSendButton.addEventListener("click", confirmSendStoreCheckData);
  elements.closeReceiptPreviewButton.addEventListener("click", closeReceiptPreview);
  elements.downloadReceiptButton.addEventListener("click", downloadReceiptImage);
  elements.shareReceiptButton.addEventListener("click", shareReceiptImage);
  elements.submitFrame.addEventListener("load", handleSubmitFrameLoad);
}

function showHomeScreen() {
  if (!state.authUser) {
    showLoginScreen();
    return;
  }

  mountSessionBar(elements.homeSessionHost);
  elements.loginScreen.classList.add("is-hidden");
  elements.sessionBar.classList.remove("is-hidden");
  elements.homeScreen.classList.remove("is-hidden");
  elements.moduleScreens.forEach((screen) => {
    screen.classList.add("is-hidden");
  });
  setSessionAction("logout");
  updateModuleAvailability();
}

function showModule(moduleId) {
  if (!state.authUser) {
    showLoginScreen();
    return;
  }

  mountSessionBar(getSessionBarHostForModule(moduleId));
  elements.loginScreen.classList.add("is-hidden");
  elements.sessionBar.classList.remove("is-hidden");
  elements.homeScreen.classList.add("is-hidden");
  elements.moduleScreens.forEach((screen) => {
    screen.classList.toggle("is-hidden", screen.id !== moduleId);
  });
  setSessionAction("home");
}

function showLoginScreen() {
  mountSessionBar(elements.sessionBarHost);
  setSessionAction("logout");
  elements.loginScreen.classList.remove("is-hidden");
  elements.sessionBar.classList.add("is-hidden");
  elements.homeScreen.classList.add("is-hidden");
  elements.moduleScreens.forEach((screen) => {
    screen.classList.add("is-hidden");
  });
}

function openModuleWithLoader(moduleId, button) {
  if (!elements.homeStoreSelect.value) {
    setHomeSelectionStatus("Selecciona una tienda antes de entrar al modulo.", "error");
    return;
  }

  setHomeSelectionStatus("");
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
  return loadCsvFromSource(DATA_SOURCE);
}

async function loadUsers() {
  return loadCsvFromSource(USERS_SOURCE);
}

async function loadCsvFromSource(source) {
  if (source.type !== "csv") {
    throw new Error(`Tipo de origen no soportado: ${source.type}`);
  }

  const response = await fetch(source.url);
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

function normalizeUserRow(row) {
  return {
    displayName: pickValue(row, ["Promotora", "Nombre", "Nombre completo", "DisplayName"]),
    role: pickValue(row, ["roll", "rol", "role"]),
    username: pickValue(row, ["user", "usuario", "username"]),
    password: pickValue(row, ["contraseña", "contrasena", "password"]),
    passwordHash: pickValue(row, ["password_hash", "passwordHash", "hash"]).toLowerCase(),
  };
}

function isUsableUser(user) {
  return user.username && (user.password || user.passwordHash);
}

function populateAllFilters() {
  const availableRows = getRowsForCurrentScope();
  const currentStore = elements.homeStoreSelect.value;
  repopulateSelectWithLabel(elements.homeStoreSelect, uniqueValues(availableRows, "tienda"), currentStore, "Elige una tienda");
  populateSelect(elements.familiaSelect, uniqueValues(availableRows, "familia"), "Todas");
}

function handleGlobalStoreChange() {
  populateAllFilters();
  populateStoreCheckFilters();
  syncFilterOptions();
  applyFilters();
  applyStoreCheckFilters();
  setHomeSelectionStatus("");
  updateModuleAvailability();
}

function handleFilterChange() {
  syncFilterOptions();
  applyFilters();
}

function syncFilterOptions() {
  const current = getSelectedFilters();
  const filteredForFamilia = filterRows({
    tienda: current.tienda,
  });

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
  const scopedPromotoria = getCurrentPromotoriaScope();

  return state.rawRows.filter((row) => {
    if (scopedPromotoria && row.promotoria !== scopedPromotoria) return false;
    if (filters.tienda && row.tienda !== filters.tienda) return false;
    if (filters.familia && row.familia !== filters.familia) return false;
    return true;
  });
}

function populateStoreCheckFilters() {
  state.storeCheckVisibleCount = STORE_CHECK_PAGE_SIZE;
  state.storeCheckSharedOfferUntil = "";
  state.storeCheckSharedOfferSourceRowKey = "";
}

function syncStoreCheckFilterOptions() {
  state.storeCheckVisibleCount = STORE_CHECK_PAGE_SIZE;
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
          <td data-label="Producto">${escapeHtml(row.producto)}</td>
          <td data-label="Inventario En Paquetes">
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
          <td data-label="Sugerido"><span class="metric-pill is-hidden" data-average-value="${row.ventaPromedioDia.toFixed(2)}"></span>
            <input
              class="suggested-input"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              value="${calculateSuggestedValue(row.ventaPromedioDia, row.casePack, row.espacioAnaquel, 0)}"
              data-suggested-value
              data-case-pack="${row.casePack}"
              data-shelf-space="${row.espacioAnaquel}"
              aria-label="Sugerido para ${escapeHtml(row.producto)}"
            />
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderEmptyState(message) {
  elements.resultsBody.innerHTML = `
    <tr class="empty-state">
      <td colspan="3">${escapeHtml(message)}</td>
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
          <td data-label="Producto">${escapeHtml(row.producto)}</td>
          <td data-label="Precio regular">
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
          <td data-label="Precio promocion">
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
          <td data-label="Oferta hasta">
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
  elements.familiaSelect.value = "";
  configureVisitDate();
  populateAllFilters();
  applyRoleConstraints();
  applyFilters();
  setSubmissionStatus("");
}

function resetStoreCheckFilters() {
  state.storeCheckVisibleCount = STORE_CHECK_PAGE_SIZE;
  populateStoreCheckFilters();
  applyRoleConstraints();
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

function openStoreCheckSendConfirmation() {
  elements.confirmStoreCheckSendOverlay.classList.remove("is-hidden");
}

function closeStoreCheckSendConfirmation() {
  elements.confirmStoreCheckSendOverlay.classList.add("is-hidden");
}

function confirmSendStoreCheckData() {
  closeStoreCheckSendConfirmation();
  submitStoreCheckData();
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

function repopulateSelectWithLabel(select, values, selectedValue, emptyLabel) {
  populateSelect(select, values, emptyLabel);
  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function getSelectedFilters() {
  return {
    tienda: elements.homeStoreSelect.value,
    familia: elements.familiaSelect.value,
  };
}

function getStoreCheckSelectedFilters() {
  return {
    tienda: elements.homeStoreSelect.value,
  };
}

function pickValue(row, candidates) {
  const key = Object.keys(row).find((columnName) => candidates.includes(columnName.trim()));
  return (key ? row[key] : "").toString().trim();
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  if (state.isAuthenticating) {
    return;
  }

  const username = elements.loginUser.value.trim();
  const password = elements.loginPassword.value;

  if (!username || !password) {
    setLoginStatus("Captura usuario y contrasena.", "error");
    return;
  }

  const matchedUser = state.users.find((user) => normalizeText(user.username) === normalizeText(username));
  if (!matchedUser) {
    setLoginStatus("Usuario o contrasena incorrectos.", "error");
    return;
  }

  state.isAuthenticating = true;
  elements.loginButton.disabled = true;
  setLoginStatus("Validando acceso...");

  try {
    const isValid = await verifyPassword(matchedUser, password);
    if (!isValid) {
      setLoginStatus("Usuario o contrasena incorrectos.", "error");
      return;
    }

    setAuthenticatedUser(matchedUser);
    elements.loginForm.reset();
    setLoginStatus("");
  } catch (error) {
    console.error(error);
    setLoginStatus("No se pudo validar el acceso.", "error");
  } finally {
    state.isAuthenticating = false;
    elements.loginButton.disabled = false;
  }
}

function handleLogout() {
  state.authUser = null;
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  resetReceiptAsset();
  setLoginStatus("");
  showLoginScreen();
}

function handleSessionAction() {
  if (elements.logoutButton.dataset.action === "home") {
    showHomeScreen();
    return;
  }

  handleLogout();
}

async function verifyPassword(user, inputPassword) {
  if (user.passwordHash) {
    const hashedInput = await sha256Hex(inputPassword);
    return hashedInput === user.passwordHash;
  }

  return user.password === inputPassword;
}

async function sha256Hex(value) {
  const encodedValue = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedValue);
  return [...new Uint8Array(hashBuffer)].map((chunk) => chunk.toString(16).padStart(2, "0")).join("");
}

function setAuthenticatedUser(user) {
  state.authUser = {
    displayName: user.displayName || user.username,
    role: user.role || "usuario",
    username: user.username,
  };

  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.authUser));
  updateSessionBar();
  resetFilters();
  resetStoreCheckFilters();
  showHomeScreen();
}

function restoreSession() {
  const rawSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawSession) {
    return;
  }

  try {
    const session = JSON.parse(rawSession);
    const matchedUser = state.users.find((user) => normalizeText(user.username) === normalizeText(session.username));
    if (!matchedUser) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    state.authUser = {
      displayName: matchedUser.displayName || matchedUser.username,
      role: matchedUser.role || "usuario",
      username: matchedUser.username,
    };
    updateSessionBar();
    resetFilters();
    resetStoreCheckFilters();
    showHomeScreen();
  } catch (error) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function updateSessionBar() {
  if (!state.authUser) {
    elements.sessionUser.textContent = "";
    elements.sessionRole.textContent = "";
    return;
  }

  elements.sessionUser.textContent = state.authUser.displayName;
  elements.sessionRole.textContent = `Rol: ${state.authUser.role}`;
}

function mountSessionBar(host) {
  if (!host || host.contains(elements.sessionBar)) {
    return;
  }

  host.appendChild(elements.sessionBar);
}

function setSessionAction(action) {
  elements.logoutButton.dataset.action = action;
  elements.logoutButton.textContent = action === "home" ? "Inicio" : "Salir";
}

function getSessionBarHostForModule(moduleId) {
  if (moduleId === "hit-gta-module") {
    return elements.hitGtaSessionHost;
  }

  if (moduleId === "store-check-module") {
    return elements.storeCheckSessionHost;
  }

  return elements.sessionBarHost;
}

function setLoginStatus(message, tone = "") {
  elements.loginStatus.textContent = message;
  elements.loginStatus.className = "submission-status";

  if (tone === "error") {
    elements.loginStatus.classList.add("is-error");
  }

  if (tone === "success") {
    elements.loginStatus.classList.add("is-success");
  }
}

function setHomeSelectionStatus(message, tone = "") {
  elements.homeSelectionStatus.textContent = message;
  elements.homeSelectionStatus.className = "submission-status";

  if (tone === "error") {
    elements.homeSelectionStatus.classList.add("is-error");
  }

  if (tone === "success") {
    elements.homeSelectionStatus.classList.add("is-success");
  }
}

function updateModuleAvailability() {
  const hasSelectedStore = Boolean(elements.homeStoreSelect.value);

  elements.moduleButtons.forEach((button) => {
    button.disabled = !hasSelectedStore;
    button.classList.toggle("is-disabled", !hasSelectedStore);
  });
}

function normalizeText(value) {
  return (value || "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function applyRoleConstraints() {
  syncFilterOptions();
  applyFilters();
  syncStoreCheckFilterOptions();
  applyStoreCheckFilters();
}

function findPromotoriaForUser(displayName) {
  return uniqueValues(state.rawRows, "promotoria").find(
    (promotoria) => normalizeText(promotoria) === normalizeText(displayName),
  ) || "";
}

function getCurrentPromotoriaScope() {
  if (normalizeText(state.authUser?.role) !== "promotora") {
    return "";
  }

  return findPromotoriaForUser(state.authUser?.displayName || "");
}

function getRowsForCurrentScope() {
  const promotoria = getCurrentPromotoriaScope();
  if (!promotoria) {
    return state.rawRows;
  }

  return state.rawRows.filter((row) => row.promotoria === promotoria);
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

function formatReceiptDate(value) {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatReceiptDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDateForFileName(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}`;
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
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.classList.contains("suggested-input")) {
    target.value = target.value.replace(/[^0-9]/g, "");
    target.dataset.manualOverride = "true";
    return;
  }

  if (!target.classList.contains("inventory-input")) {
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
      if (draft.promo) {
        validateStoreCheckPrices(row, draft);
      }
    } else {
      draft.promo = target.value;
      draft.offerDateActive = false;
      if (!draft.promo) {
        draft.offerUntil = "";
        if (state.storeCheckSharedOfferSourceRowKey === (row.dataset.rowKey || "")) {
          state.storeCheckSharedOfferUntil = "";
          state.storeCheckSharedOfferSourceRowKey = "";
        }
      }
    }
    return;
  }

  if (target.classList.contains("offer-date-input")) {
    const rowKey = row.dataset.rowKey || "";
    draft.offerUntil = target.value;
    if (!state.storeCheckSharedOfferSourceRowKey || state.storeCheckSharedOfferSourceRowKey === rowKey) {
      state.storeCheckSharedOfferUntil = target.value;
      state.storeCheckSharedOfferSourceRowKey = target.value ? rowKey : "";
      syncStoreCheckOfferDates(rowKey, target.value);
    }
  }
}

function handleStoreCheckTableFocusOut(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.classList.contains("price-input")) {
    return;
  }

  const row = target.closest("tr");
  if (!(row instanceof HTMLTableRowElement)) {
    return;
  }

  const rowKey = row.dataset.rowKey || "";
  const draft = getStoreCheckDraftByKey(rowKey);

  if (!target.getAttribute("aria-label")?.includes("promocion")) {
    if (draft.promo) {
      validateStoreCheckPrices(row, draft);
      updateOfferDateCell(row, draft);
    }
    return;
  }

  if (!draft.promo) {
    draft.offerDateActive = false;
    draft.offerUntil = "";
    if (state.storeCheckSharedOfferSourceRowKey === rowKey) {
      state.storeCheckSharedOfferUntil = "";
      state.storeCheckSharedOfferSourceRowKey = "";
    }
    updateOfferDateCell(row, draft);
    return;
  }

  const isValid = validateStoreCheckPrices(row, draft);
  draft.offerDateActive = isValid;
  if (!isValid) {
    draft.offerUntil = "";
    if (state.storeCheckSharedOfferSourceRowKey === rowKey) {
      state.storeCheckSharedOfferUntil = "";
      state.storeCheckSharedOfferSourceRowKey = "";
    }
  } else if (!draft.offerUntil && state.storeCheckSharedOfferUntil) {
    draft.offerUntil = state.storeCheckSharedOfferUntil;
  }
  updateOfferDateCell(row, draft);
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
  if (suggestedOutput.dataset.manualOverride === "true") {
    return;
  }

  suggestedOutput.value = calculateSuggestedValue(averageValue, casePackValue, shelfSpaceValue, inventoryValue);
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

  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "");
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
      offerDateActive: false,
    };
  }

  return state.storeCheckDrafts[rowKey];
}

function renderOfferDateCell(row) {
  const draft = getStoreCheckDraft(row);
  if (!draft.offerDateActive) {
    return `<span class="offer-date-placeholder">Captura precio promocion</span>`;
  }

  if (!draft.offerUntil && state.storeCheckSharedOfferUntil) {
    draft.offerUntil = state.storeCheckSharedOfferUntil;
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

  if (!draft.offerDateActive) {
    offerDateCell.innerHTML = `<span class="offer-date-placeholder">Captura precio promocion</span>`;
    return;
  }

  if (!draft.offerUntil && state.storeCheckSharedOfferUntil) {
    draft.offerUntil = state.storeCheckSharedOfferUntil;
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
    return true;
  }

  const regularValue = Number.parseFloat(draft.regular);
  const promoValue = Number.parseFloat(draft.promo);
  const hasComparableValues = Number.isFinite(regularValue) && Number.isFinite(promoValue);
  const isInvalid = hasComparableValues && promoValue > regularValue;

  const message = isInvalid ? "El precio promocion no puede ser mayor que el precio regular." : "";
  promoInput.setCustomValidity(message);
  promoInput.classList.toggle("is-invalid", isInvalid);

  if (isInvalid) {
    promoInput.reportValidity();
    return false;
  }

  return true;
}

function syncStoreCheckOfferDates(sourceRowKey, offerUntil) {
  if (!offerUntil) {
    return;
  }

  elements.storeCheckResultsBody.querySelectorAll("tr").forEach((rowElement) => {
    if (!(rowElement instanceof HTMLTableRowElement)) {
      return;
    }

    const rowKey = rowElement.dataset.rowKey || "";
    if (!rowKey || rowKey === sourceRowKey) {
      return;
    }

    const draft = getStoreCheckDraftByKey(rowKey);
    if (!draft.offerDateActive || !draft.promo) {
      return;
    }

    draft.offerUntil = offerUntil;
    updateOfferDateCell(rowElement, draft);
  });
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

  state.pendingReceipt = buildInventoryReceiptModel(rowsToSubmit);
  state.isSubmitting = true;
  elements.sendButton.disabled = true;
  elements.payloadInput.value = JSON.stringify({ target: "inventario", rows: rowsToSubmit });
  elements.submitForm.action = APPS_SCRIPT_WEB_APP_URL;
  elements.submitForm.submit();
  setSubmissionStatus(`Enviando ${rowsToSubmit.length} registro(s)...`);
}

function submitStoreCheckData() {
  if (state.isSubmitting) {
    return;
  }

  if (!APPS_SCRIPT_WEB_APP_URL) {
    setStoreCheckSubmissionStatus("Falta configurar la URL del Web App de Apps Script.", "error");
    return;
  }

  const invalidPromoInput = elements.storeCheckResultsBody.querySelector(".price-input.is-invalid");
  if (invalidPromoInput instanceof HTMLInputElement) {
    invalidPromoInput.reportValidity();
    setStoreCheckSubmissionStatus("Corrige los precios antes de enviar.", "error");
    return;
  }

  const rowsToSubmit = collectStoreCheckRowsToSubmit();
  if (!rowsToSubmit.length) {
    setStoreCheckSubmissionStatus("Captura al menos un precio para poder enviar.", "error");
    return;
  }

  state.isSubmitting = true;
  state.pendingReceipt = buildStoreCheckReceiptModel(rowsToSubmit);
  elements.storeCheckSendButton.disabled = true;
  elements.payloadInput.value = JSON.stringify({ target: "promociones", rows: rowsToSubmit });
  elements.submitForm.action = APPS_SCRIPT_WEB_APP_URL;
  elements.submitForm.submit();
  setStoreCheckSubmissionStatus(`Enviando ${rowsToSubmit.length} promocion(es)...`);
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
      Cajas_Sugueridas: suggestedOutput.value?.trim() ?? "0",
      FechaPorxVisita: elements.visitDate.value || "",
    });
  });

  return rows;
}

function collectStoreCheckRowsToSubmit() {
  const rows = [];

  elements.storeCheckResultsBody.querySelectorAll("tr").forEach((rowElement) => {
    if (!(rowElement instanceof HTMLTableRowElement)) {
      return;
    }

    const rowKey = rowElement.dataset.rowKey || "";
    const draft = getStoreCheckDraftByKey(rowKey);
    const sourceRow = state.storeCheckRows.find((row) => getStoreCheckRowKey(row) === rowKey);
    if (!sourceRow) {
      return;
    }

    if (!draft.regular && !draft.promo && !draft.offerUntil) {
      return;
    }

    rows.push({
      Promotora: sourceRow.promotoria,
      NumeroTienda: sourceRow.numeroTienda,
      NombreTienda: sourceRow.tienda,
      Familia: sourceRow.familia,
      Descripcion: sourceRow.producto,
      SKU: sourceRow.sku,
      PrecioRegular: draft.regular,
      PrecioOferta: draft.promo,
      OfertaHasta: draft.offerUntil,
    });
  });

  return rows;
}

function buildInventoryReceiptModel(rows) {
  const submittedAt = new Date();

  return {
    type: "inventario",
    submittedAtIso: submittedAt.toISOString(),
    promotora: state.authUser?.displayName || rows[0]?.Promotora || "",
    tienda: elements.homeStoreSelect.value || rows[0]?.Nombre_Tienda || "",
    nextVisit: elements.visitDate.value || "",
    rows: rows.map((row) => ({
      producto: row.Nombre_Producto || "",
      inventario: row.Inventario || "0",
      sugeridas: row.Cajas_Sugueridas || "0",
    })),
  };
}

function buildStoreCheckReceiptModel(rows) {
  const submittedAt = new Date();
  const orderedRows = rows
    .map((row) => ({
      familia: row.Familia || "",
      producto: row.Descripcion || "",
      precioRegular: row.PrecioRegular || "",
      precioPromocion: row.PrecioOferta || "",
      ofertaHasta: row.OfertaHasta || "",
    }))
    .sort(compareStoreCheckReceiptRows);

  return {
    type: "store-check",
    submittedAtIso: submittedAt.toISOString(),
    promotora: state.authUser?.displayName || rows[0]?.Promotora || "",
    tienda: elements.homeStoreSelect.value || rows[0]?.NombreTienda || "",
    rows: orderedRows,
  };
}

async function openInventoryReceiptPreview(receipt) {
  const asset =
    receipt.type === "store-check"
      ? await createStoreCheckReceiptAsset(receipt)
      : await createInventoryReceiptAsset(receipt);
  resetReceiptAsset();
  state.receiptImageBlob = asset.blob;
  state.receiptImageUrl = asset.url;
  state.receiptFileBaseName = receipt.type === "store-check" ? "comprobante-store-check" : "comprobante-hit-gta";
  elements.receiptPreviewImage.src = asset.url;
  elements.receiptPreviewOverlay.classList.remove("is-hidden");
  updateReceiptShareAvailability();
}

function closeReceiptPreview() {
  elements.receiptPreviewOverlay.classList.add("is-hidden");
}

function resetReceiptAsset() {
  if (state.receiptImageUrl) {
    URL.revokeObjectURL(state.receiptImageUrl);
  }

  state.receiptImageBlob = null;
  state.receiptImageUrl = "";
  state.receiptFileBaseName = "comprobante-hit-gta";
  elements.receiptPreviewImage.removeAttribute("src");
  closeReceiptPreview();
}

function updateReceiptShareAvailability() {
  const canShareFiles = Boolean(
    state.receiptImageBlob &&
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({
        files: [new File([state.receiptImageBlob], `${state.receiptFileBaseName}.png`, { type: "image/png" })],
      }),
  );

  elements.shareReceiptButton.disabled = !canShareFiles;
  elements.shareReceiptButton.title = canShareFiles ? "" : "Tu navegador no permite compartir esta imagen directamente.";
}

function downloadReceiptImage() {
  if (!state.receiptImageUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = state.receiptImageUrl;
  link.download = `${state.receiptFileBaseName}-${formatDateForFileName(new Date())}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

async function shareReceiptImage() {
  if (!state.receiptImageBlob || !navigator.share || !navigator.canShare) {
    return;
  }

  const receiptFile = new File([state.receiptImageBlob], `${state.receiptFileBaseName}.png`, { type: "image/png" });
  if (!navigator.canShare({ files: [receiptFile] })) {
    return;
  }

  try {
    await navigator.share({ files: [receiptFile] });
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
    }
  }
}

async function createInventoryReceiptAsset(receipt) {
  const width = 1080;
  const outerPadding = 56;
  const cardPadding = 42;
  const headerHeight = 130;
  const detailsBlockHeight = 156;
  const tableHeaderHeight = 50;
  const rowHeight = 48;
  const footerHeight = 104;
  const contentWidth = width - outerPadding * 2;
  const visibleRows = receipt.rows;
  const totalSuggestedBoxes = visibleRows.reduce((sum, row) => sum + toNumber(row.sugeridas), 0);
  const height =
    outerPadding * 2 +
    headerHeight +
    18 +
    detailsBlockHeight +
    18 +
    tableHeaderHeight +
    visibleRows.length * rowHeight +
    footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo crear el comprobante.");
  }

  drawReceiptBackground(context, width, height);

  let y = outerPadding;
  drawRoundedRect(context, outerPadding, y, contentWidth, headerHeight, 34, "#0f766e");
  context.fillStyle = "#fffdf8";
  context.font = '700 42px "Barlow", sans-serif';
  context.fillText("HIT GTA", outerPadding + cardPadding, y + 56);
  context.font = '500 22px "Barlow", sans-serif';
  context.fillStyle = "rgba(255, 253, 248, 0.88)";
  context.fillText("Comprobante de envio", outerPadding + cardPadding, y + 90);

  y += headerHeight + 18;
  drawRoundedRect(context, outerPadding, y, contentWidth, detailsBlockHeight, 30, "#fffdf9");
  drawDetailsGrid(context, receipt, outerPadding + cardPadding, y + 34, contentWidth - cardPadding * 2);

  y += detailsBlockHeight + 18;
  const productColumnWidth = contentWidth - 250;
  const inventoryColumnWidth = 118;
  const suggestedColumnWidth = 132;

  drawRoundedRect(context, outerPadding, y, contentWidth, tableHeaderHeight, 24, "rgba(15, 118, 110, 0.12)");
  context.fillStyle = "#0b5d57";
  context.font = '700 22px "Barlow", sans-serif';
  context.fillText("Producto", outerPadding + 24, y + 32);
  context.fillText("Inventario", outerPadding + 24 + productColumnWidth, y + 32);
  context.fillText("Cajas sugeridas", outerPadding + 24 + productColumnWidth + inventoryColumnWidth, y + 32);

  y += tableHeaderHeight;
  visibleRows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    if (index % 2 === 0) {
      drawRoundedRect(context, outerPadding, rowY, contentWidth, rowHeight, 0, "rgba(255, 252, 247, 0.92)");
    }

    context.fillStyle = "#1f2a24";
    context.font = '500 21px "Barlow", sans-serif';
    const productText = truncateText(context, row.producto, productColumnWidth - 12);
    context.fillText(productText, outerPadding + 24, rowY + 31);
    context.textAlign = "center";
    context.fillText(String(row.inventario), outerPadding + 24 + productColumnWidth + inventoryColumnWidth / 2, rowY + 31);
    context.fillText(
      String(row.sugeridas),
      outerPadding + 24 + productColumnWidth + inventoryColumnWidth + suggestedColumnWidth / 2,
      rowY + 31,
    );
    context.textAlign = "left";

    context.strokeStyle = "rgba(31, 42, 36, 0.08)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(outerPadding, rowY + rowHeight);
    context.lineTo(outerPadding + contentWidth, rowY + rowHeight);
    context.stroke();
  });

  y += visibleRows.length * rowHeight;
  drawRoundedRect(context, outerPadding, y, contentWidth, footerHeight, 28, "#fff7e8");
  context.fillStyle = "#6f4d0c";
  context.font = '700 24px "Barlow", sans-serif';
  context.fillText(`Total de productos: ${visibleRows.length}`, outerPadding + cardPadding, y + 42);
  context.fillText(`Total de cajas sugeridas: ${totalSuggestedBoxes}`, outerPadding + cardPadding, y + 74);
  context.font = '500 18px "Barlow", sans-serif';
  context.fillText("Enviado desde HIT GTA", outerPadding + cardPadding, y + 96);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
}

async function createStoreCheckReceiptAsset(receipt) {
  const width = 1080;
  const outerPadding = 56;
  const cardPadding = 40;
  const headerHeight = 96;
  const detailsBlockHeight = 112;
  const tableHeaderHeight = 46;
  const rowHeight = 44;
  const footerHeight = 88;
  const contentWidth = width - outerPadding * 2;
  const visibleRows = receipt.rows;
  const totalPromoRows = visibleRows.filter((row) => row.precioPromocion).length;
  const height =
    outerPadding * 2 +
    headerHeight +
    14 +
    detailsBlockHeight +
    14 +
    tableHeaderHeight +
    visibleRows.length * rowHeight +
    footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo crear el comprobante.");
  }

  drawReceiptBackground(context, width, height);

  let y = outerPadding;
  drawRoundedRect(context, outerPadding, y, contentWidth, headerHeight, 34, "#8f6422");
  context.fillStyle = "#fffdf8";
  context.font = '700 34px "Barlow", sans-serif';
  context.fillText("STORE CHECK", outerPadding + cardPadding, y + 40);
  context.font = '500 18px "Barlow", sans-serif';
  context.fillStyle = "rgba(255, 253, 248, 0.88)";
  context.fillText("Comprobante de envio", outerPadding + cardPadding, y + 68);

  y += headerHeight + 14;
  drawRoundedRect(context, outerPadding, y, contentWidth, detailsBlockHeight, 30, "#fffdf9");
  drawStoreCheckDetailsGrid(context, receipt, outerPadding + cardPadding, y + 28, contentWidth - cardPadding * 2);

  y += detailsBlockHeight + 14;
  const productColumnWidth = contentWidth - 544;
  const regularColumnWidth = 100;
  const promoColumnWidth = 100;
  const savingsColumnWidth = 168;
  const offerColumnWidth = 176;

  drawRoundedRect(context, outerPadding, y, contentWidth, tableHeaderHeight, 24, "rgba(143, 100, 34, 0.12)");
  context.fillStyle = "#6f4d0c";
  context.font = '700 18px "Barlow", sans-serif';
  context.fillText("Producto", outerPadding + 24, y + 29);
  context.fillText("Regular", outerPadding + 24 + productColumnWidth + 8, y + 29);
  context.fillText("Promo", outerPadding + 24 + productColumnWidth + regularColumnWidth + 8, y + 29);
  context.fillText("Ahorro", outerPadding + 24 + productColumnWidth + regularColumnWidth + promoColumnWidth + 8, y + 29);
  context.fillText(
    "Vigencia",
    outerPadding + 24 + productColumnWidth + regularColumnWidth + promoColumnWidth + savingsColumnWidth + 8,
    y + 29,
  );

  y += tableHeaderHeight;
  visibleRows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    drawRoundedRect(context, outerPadding, rowY, contentWidth, rowHeight, 0, getStoreCheckFamilyRowColor(row.familia, index));

    context.fillStyle = "#1f2a24";
    context.font = '500 18px "Barlow", sans-serif';
    const productText = truncateText(context, row.producto, productColumnWidth - 12);
    context.fillText(productText, outerPadding + 24, rowY + 28);
    context.textAlign = "center";
    context.fillText(formatPriceForReceipt(row.precioRegular), outerPadding + 24 + productColumnWidth + regularColumnWidth / 2, rowY + 28);
    context.fillText(
      formatPriceForReceipt(row.precioPromocion),
      outerPadding + 24 + productColumnWidth + regularColumnWidth + promoColumnWidth / 2,
      rowY + 28,
    );
    context.fillText(
      formatStoreCheckSavings(row.precioRegular, row.precioPromocion),
      outerPadding + 24 + productColumnWidth + regularColumnWidth + promoColumnWidth + savingsColumnWidth / 2,
      rowY + 28,
    );
    context.fillText(
      formatReceiptDate(row.ofertaHasta || "") || "-",
      outerPadding + 24 + productColumnWidth + regularColumnWidth + promoColumnWidth + savingsColumnWidth + offerColumnWidth / 2,
      rowY + 28,
    );
    context.textAlign = "left";

    context.strokeStyle = "rgba(31, 42, 36, 0.08)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(outerPadding, rowY + rowHeight);
    context.lineTo(outerPadding + contentWidth, rowY + rowHeight);
    context.stroke();
  });

  y += visibleRows.length * rowHeight;
  drawRoundedRect(context, outerPadding, y, contentWidth, footerHeight, 28, "#fff7e8");
  context.fillStyle = "#6f4d0c";
  context.font = '700 22px "Barlow", sans-serif';
  context.fillText(`Total de productos: ${visibleRows.length}`, outerPadding + cardPadding, y + 34);
  context.fillText(`Promociones capturadas: ${totalPromoRows}`, outerPadding + cardPadding, y + 60);
  context.font = '500 17px "Barlow", sans-serif';
  context.fillText("Enviado desde Store Check", outerPadding + cardPadding, y + 79);

  const blob = await canvasToBlob(canvas);
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
}

function drawReceiptBackground(context, width, height) {
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#f9f5ef");
  background.addColorStop(1, "#efe6d7");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(width * 0.84, height * 0.14, 40, width * 0.84, height * 0.14, 280);
  glow.addColorStop(0, "rgba(239, 182, 79, 0.28)");
  glow.addColorStop(1, "rgba(239, 182, 79, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function drawDetailsGrid(context, receipt, x, y, width) {
  const leftX = x;
  const rightX = x + width / 2 + 10;
  const columnWidth = width / 2 - 20;
  const gapY = 56;

  drawDetailItem(context, leftX, y, "Promotora", receipt.promotora || "-", columnWidth);
  drawDetailItem(context, rightX, y, "Tienda", receipt.tienda || "-", columnWidth);
  drawDetailItem(context, leftX, y + gapY, "Fecha", formatReceiptDateTime(receipt.submittedAtIso), columnWidth);
  drawDetailItem(context, rightX, y + gapY, "Proxima visita", formatReceiptDate(receipt.nextVisit), columnWidth);
}

function drawStoreCheckDetailsGrid(context, receipt, x, y, width) {
  const leftX = x;
  const rightX = x + width / 2 + 10;
  const columnWidth = width / 2 - 20;

  drawDetailItem(context, leftX, y, "Promotora", receipt.promotora || "-", columnWidth);
  drawDetailItem(context, rightX, y, "Tienda", receipt.tienda || "-", columnWidth);
  drawDetailItem(context, leftX, y + 56, "Fecha", formatReceiptDateTime(receipt.submittedAtIso), columnWidth);
}

function compareStoreCheckReceiptRows(a, b) {
  const familyOrder = getStoreCheckFamilyOrder(a.familia) - getStoreCheckFamilyOrder(b.familia);
  if (familyOrder !== 0) {
    return familyOrder;
  }

  return (a.producto || "").localeCompare(b.producto || "", "es");
}

function getStoreCheckFamilyOrder(familia) {
  const normalizedFamily = normalizeText(familia);
  if (normalizedFamily.includes("panal") || normalizedFamily.includes("bebe") || normalizedFamily.includes("baby")) {
    return 0;
  }

  if (normalizedFamily.includes("toalla") || normalizedFamily.includes("femen")) {
    return 1;
  }

  if (normalizedFamily.includes("adult") || normalizedFamily.includes("senior") || normalizedFamily.includes("protector")) {
    return 2;
  }

  return 3;
}

function getStoreCheckFamilyRowColor(familia, index) {
  const normalizedFamily = normalizeText(familia);
  if (normalizedFamily.includes("panal") || normalizedFamily.includes("bebe") || normalizedFamily.includes("baby")) {
    return index % 2 === 0 ? "rgba(231, 209, 168, 0.32)" : "rgba(231, 209, 168, 0.2)";
  }

  if (normalizedFamily.includes("toalla") || normalizedFamily.includes("femen")) {
    return index % 2 === 0 ? "rgba(227, 185, 194, 0.26)" : "rgba(227, 185, 194, 0.16)";
  }

  if (normalizedFamily.includes("adult") || normalizedFamily.includes("senior") || normalizedFamily.includes("protector")) {
    return index % 2 === 0 ? "rgba(182, 201, 194, 0.28)" : "rgba(182, 201, 194, 0.18)";
  }

  return index % 2 === 0 ? "rgba(255, 252, 247, 0.92)" : "rgba(255, 252, 247, 0.78)";
}

function drawDetailItem(context, x, y, label, value, maxWidth) {
  context.fillStyle = "#6d786f";
  context.font = '600 18px "Barlow", sans-serif';
  context.fillText(label.toUpperCase(), x, y);
  context.fillStyle = "#1f2a24";
  context.font = '700 24px "Barlow", sans-serif';
  context.fillText(truncateText(context, value, maxWidth), x, y + 30);
}

function drawRoundedRect(context, x, y, width, height, radius, fillStyle) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function truncateText(context, value, maxWidth) {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let trimmed = value;
  while (trimmed.length > 0 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}...`;
}

function formatPriceForReceipt(value) {
  if (!value) {
    return "-";
  }

  const numericValue = Number.parseFloat(String(value));
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return formatCurrencyGtq(numericValue);
}

function formatStoreCheckSavings(regularValue, promoValue) {
  const regular = Number.parseFloat(String(regularValue));
  const promo = Number.parseFloat(String(promoValue));
  if (!Number.isFinite(regular) || !Number.isFinite(promo) || regular <= 0) {
    return "-";
  }

  const diffValue = regular - promo;
  const diffPercent = (diffValue / regular) * 100;
  return `${formatCurrencyGtq(diffValue)} | ${diffPercent.toFixed(1)}%`;
}

function formatCurrencyGtq(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo generar la imagen."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

async function handleSubmitFrameLoad() {
  if (!state.isSubmitting) {
    return;
  }

  state.isSubmitting = false;
  elements.sendButton.disabled = false;
  elements.storeCheckSendButton.disabled = false;

  const currentPayload = parseCurrentPayload();
  if (currentPayload.target === "promociones") {
    setStoreCheckSubmissionStatus("Informacion enviada a la hoja Promociones.", "success");
  } else {
    setSubmissionStatus("Informacion enviada a la hoja Inventario.", "success");
  }

  if (state.pendingReceipt) {
    await openInventoryReceiptPreview(state.pendingReceipt);
    state.pendingReceipt = null;
  }
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

function setStoreCheckSubmissionStatus(message, tone = "") {
  elements.storeCheckSubmissionStatus.textContent = message;
  elements.storeCheckSubmissionStatus.className = "submission-status";

  if (tone === "error") {
    elements.storeCheckSubmissionStatus.classList.add("is-error");
  }

  if (tone === "success") {
    elements.storeCheckSubmissionStatus.classList.add("is-success");
  }
}

function parseCurrentPayload() {
  try {
    return JSON.parse(elements.payloadInput.value || "{}");
  } catch (error) {
    return {};
  }
}
