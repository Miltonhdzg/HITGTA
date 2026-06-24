# Consulta de Inventarios GTA

Base inicial de una web pensada para telefonos moviles.

## Que hace

- Carga datos desde un CSV.
- Llena listas desplegables unicas para `Promotoria`, `Nombre de la tienda` y `Familia`.
- Filtra la tabla de productos.
- Muestra la columna `Venta Promedio Dia`.

## Archivos

- `index.html`: estructura principal.
- `styles.css`: estilos mobile-first.
- `app.js`: carga de datos, filtros y renderizado.
- `Code.gs`: recibe envios y los guarda en la hoja `Inventario`.
- `data/catalogo-muestra.csv`: muestra local para desarrollo.

## Como abrirla

Por seguridad del navegador conviene usar un servidor local:

```bash
cd "/home/claudio/Documents/HIT GTA"
python3 -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

## Como conectar Google Sheets

La forma mas simple es publicar la hoja como CSV:

1. En Google Sheets abre `Archivo > Compartir > Publicar en la web`.
2. Elige la hoja correcta.
3. Publicala como `CSV`.
4. Copia la URL publicada.
5. En `app.js` cambia:

```js
const DATA_SOURCE = {
  type: "csv",
  url: "./data/catalogo-muestra.csv",
};
```

Por algo asi:

```js
const DATA_SOURCE = {
  type: "csv",
  url: "https://docs.google.com/spreadsheets/d/e/TU_ID_PUBLICO/pub?gid=0&single=true&output=csv",
};
```

## Nombres de columnas esperados

El codigo ya reconoce estos encabezados:

- `Promotor` o `Promotoria`
- `Numero_Tienda`
- `Nombre_Tienda` o `Nombre de la tienda`
- `Familia`
- `Producto`
- `SKU`
- `CasePack`
- `espacio_anaquel`
- `Venta Promedio Dia`

## Envio a la hoja Inventario

Para guardar desde la app hacia Google Sheets:

1. Abre tu Google Sheet real.
2. En `Extensiones > Apps Script`, pega el contenido de `Code.gs`.
3. Asegurate de tener una hoja llamada `Inventario`.
4. La fila 1 debe tener estos encabezados exactos:

```text
Fecha | Promotora | Numero_Tienda | Nombre_Tienda | SKU | Nombre_Producto | AVG_Vta_diario | Inventario | DDI_Actuales | Cajas_Sugueridas | FechaPorxVisita
```

5. En Apps Script ve a `Deploy > New deployment > Web app`.
6. Copia la URL final que termina en `/exec`.
7. En `app.js`, pega esa URL aqui:

```js
const APPS_SCRIPT_WEB_APP_URL = "";
```

## Como envia la app

- La fecha se genera en Apps Script con fecha y hora exactas del envio en formato `yyyy-MM-dd HH:mm:ss`.
- `DDI_Actuales` se guarda vacio.
- `FechaPorxVisita` se toma del calendario seleccionado en la app.
- Se envian solo las filas visibles donde `Inventario en piso de venta` tenga un valor capturado.
