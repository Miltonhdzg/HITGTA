function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  var output = (e && e.parameter && e.parameter.output) || "";

  if (action === "history") {
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var rows = readHistoryRows(spreadsheet);
      var payload = {
        ok: true,
        rows: rows,
        requestId: (e && e.parameter && e.parameter.requestId) || "",
      };

      if (output === "frame") {
        return createHistoryFrameResponse(payload);
      }

      return createJsonResponse(payload);
    } catch (error) {
      var errorPayload = {
        ok: false,
        message: error.message,
        requestId: (e && e.parameter && e.parameter.requestId) || "",
      };

      if (output === "frame") {
        return createHistoryFrameResponse(errorPayload);
      }

      return createJsonResponse(errorPayload);
    }
  }

  return ContentService
    .createTextOutput("Web App activo")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var payload = JSON.parse((e.parameter && e.parameter.payload) || "{}");
    var target = payload.target || "inventario";
    var rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (target !== "inventario" && target !== "promociones") {
      throw new Error("Target no valido.");
    }

    if (!rows.length) {
      return createJsonResponse({
        ok: false,
        message: "No se recibieron registros.",
      });
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sentAt = new Date();
    var timeZone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "America/Monterrey";
    var sentAtFormatted = Utilities.formatDate(sentAt, timeZone, "yyyy-MM-dd HH:mm:ss");
    var sheet;
    var values;

    if (target === "promociones") {
      sheet = spreadsheet.getSheetByName("Promociones");
      if (!sheet) {
        throw new Error('No existe la hoja "Promociones".');
      }

      values = rows.map(function(row) {
        return [
          sentAtFormatted,
          row.Promotora || "",
          row.NumeroTienda || "",
          row.NombreTienda || "",
          row.Descripcion || "",
          row.SKU || "",
          row.PrecioRegular || "",
          row.PrecioOferta || "",
          row.OfertaHasta || "",
        ];
      });
    } else {
      sheet = spreadsheet.getSheetByName("Inventario");
      if (!sheet) {
        throw new Error('No existe la hoja "Inventario".');
      }

      values = rows.map(function(row) {
        return [
          sentAtFormatted,
          row.Promotora || "",
          row.Numero_Tienda || "",
          row.Nombre_Tienda || "",
          row.SKU || "",
          row.Nombre_Producto || "",
          row.AVG_Vta_diario || "",
          row.Inventario || "",
          "",
          row.Cajas_Sugueridas || "",
          row.FechaPorxVisita || "",
        ];
      });
    }

    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);

    return createJsonResponse({
      ok: true,
      rowsInserted: values.length,
      target: target,
    });
  } catch (error) {
    return createJsonResponse({
      ok: false,
      message: error.message,
    });
  }
}

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function createHistoryFrameResponse(payload) {
  var json = JSON.stringify(payload).replace(/</g, "\\u003c");
  var html = [
    "<!doctype html>",
    "<html>",
    "<body>",
    "<script>",
    "window.parent.postMessage({ type: 'hit-gta-history', payload: " + json + " }, '*');",
    "</script>",
    "<p>Historial enviado.</p>",
    "</body>",
    "</html>",
  ].join("");

  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function readHistoryRows(spreadsheet) {
  var rows = [];

  rows = rows.concat(readInventarioHistoryRows(spreadsheet));
  rows = rows.concat(readPromocionesHistoryRows(spreadsheet));

  return rows.sort(function(left, right) {
    return String(right.submittedAt || "").localeCompare(String(left.submittedAt || ""));
  });
}

function readInventarioHistoryRows(spreadsheet) {
  var sheet = spreadsheet.getSheetByName("Inventario");
  if (!sheet) {
    return [];
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = values[0].map(function(header) {
    return normalizeHeader(header);
  });

  return values.slice(1).map(function(row) {
    return {
      submittedAt: getCellValue(row, headers, ["fecha"]),
      module: "Inventario",
      promotora: getCellValue(row, headers, ["promotoria"]),
      tienda: getCellValue(row, headers, ["nombre_tienda", "nombre de la tienda"]),
      numeroTienda: getCellValue(row, headers, ["numero_tienda", "numero tienda", "numerotienda"]),
      sku: getCellValue(row, headers, ["sku"]),
      producto: getCellValue(row, headers, ["nombre_producto", "nombre de producto", "producto"]),
      inventory: getCellValue(row, headers, ["inventario"]),
      ddiActuales: getCellValue(row, headers, ["ddi_actuales", "ddi actuales"]),
      cajasSugeridas: getCellValue(row, headers, ["cajas_sugueridas", "cajas sugeridas"]),
      fechaPorxVisita: getCellValue(row, headers, ["fechaporxvisita", "fechaproxvisita", "fechaprox visita", "fechaprox_visita"]),
    };
  }).filter(function(row) {
    return row.submittedAt || row.tienda || row.producto;
  });
}

function readPromocionesHistoryRows(spreadsheet) {
  var sheet = spreadsheet.getSheetByName("Promociones");
  if (!sheet) {
    return [];
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = values[0].map(function(header) {
    return normalizeHeader(header);
  });

  return values.slice(1).map(function(row) {
    return {
      submittedAt: getCellValue(row, headers, ["fecha"]),
      module: "Promociones",
      promotora: getCellValue(row, headers, ["promotora"]),
      tienda: getCellValue(row, headers, ["nombretienda", "nombre tienda"]),
      numeroTienda: getCellValue(row, headers, ["numerotienda", "numero tienda"]),
      sku: getCellValue(row, headers, ["sku"]),
      producto: getCellValue(row, headers, ["descripcion", "producto", "nombre_producto"]),
      regularPrice: getCellValue(row, headers, ["precioregular", "precio regular"]),
      promoPrice: getCellValue(row, headers, ["preciooferta", "precio oferta"]),
      offerUntil: getCellValue(row, headers, ["ofertahasta", "oferta hasta"]),
    };
  }).filter(function(row) {
    return row.submittedAt || row.tienda || row.producto;
  });
}

function getCellValue(row, headers, candidates) {
  var headerMap = {};
  headers.forEach(function(header, index) {
    headerMap[header] = index;
  });

  for (var index = 0; index < candidates.length; index += 1) {
    var headerName = normalizeHeader(candidates[index]);
    if (Object.prototype.hasOwnProperty.call(headerMap, headerName)) {
      return normalizeCell(row[headerMap[headerName]]);
    }
  }

  return "";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}
