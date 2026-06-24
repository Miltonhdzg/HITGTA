function doPost(e) {
  try {
    var payload = JSON.parse((e.parameter && e.parameter.payload) || "{}");
    var rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!rows.length) {
      return createJsonResponse({
        ok: false,
        message: "No se recibieron registros.",
      });
    }

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName("Inventario");

    if (!sheet) {
      throw new Error('No existe la hoja "Inventario".');
    }

    var sentAt = new Date();
    var timeZone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "America/Monterrey";
    var sentAtFormatted = Utilities.formatDate(sentAt, timeZone, "yyyy-MM-dd HH:mm:ss");
    var values = rows.map(function(row) {
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

    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);

    return createJsonResponse({
      ok: true,
      rowsInserted: values.length,
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
