function doGet() {
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
