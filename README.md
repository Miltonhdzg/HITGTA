# Consulta de Inventarios GTA

Base inicial de una web pensada para telefonos moviles.

## Que hace

- Carga datos desde un CSV.
- Incluye login con usuarios desde un CSV publicado.
- Llena listas desplegables unicas para `Promotoria`, `Nombre de la tienda` y `Familia`.
- Filtra la tabla de productos.
- Muestra la columna `Venta Promedio Dia`.
- Incluye un modulo 3 con resumen de historial y graficas de uso.

## Archivos

- `index.html`: estructura principal.
- `styles.css`: estilos mobile-first.
- `app.js`: carga de datos, filtros y renderizado.
- `history-module.js`: resumen de historial, filtros y graficas.
- `Code.gs`: recibe envios y los guarda en la hoja `Inventario`.
- `data/catalogo-muestra.csv`: muestra local para desarrollo.

## Login

La app toma usuarios desde un CSV con columnas como:

- `Promotora`: nombre visible.
- `roll`: rol del usuario.
- `user`: usuario de acceso.
- `contraseña`: compatibilidad temporal con texto plano.

Tambien soporta `password_hash` en formato `SHA-256` hexadecimal. Si existe, se usa ese valor y ya no hace falta `contraseña`.

## Recomendacion para contrasenas

Lo que yo haria es esto:

1. Agregar una columna `password_hash`.
2. Guardar ahi el `SHA-256` de cada contrasena.
3. Vaciar o eliminar la columna `contraseña`.

Ejemplo para generar un hash:

```bash
printf '1126' | sha256sum
```

Importante: como el CSV de usuarios esta publicado en internet, esto mejora el manejo de contrasenas, pero no convierte el login en seguridad fuerte. Para produccion, lo correcto es mover los usuarios a una hoja privada validada desde `Code.gs` o a un backend real.

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

## Envio a la hoja Promociones

El modulo `Store Check` usa el mismo Web App de Apps Script, pero envia a una hoja distinta llamada `Promociones`.

La fila 1 de esa hoja debe tener estos encabezados exactos:

```text
Fecha | Promotora | NumeroTienda | NombreTienda | Descripcion | SKU | PrecioRegular | PrecioOferta | OfertaHasta
```

La app enviara solo filas visibles donde haya por lo menos un precio o una fecha capturada.

## Modulo 3: Historial y uso

El modulo `Historial y uso` consulta el mismo Web App de Apps Script con `?action=history` para leer el contenido de `Inventario` y `Promociones`.

Si haces cambios en la estructura de esas hojas, mantén al menos estos encabezados:

- `Fecha`
- `Promotora`
- `Numero_Tienda` o `NumeroTienda`
- `Nombre_Tienda` o `NombreTienda`
- `SKU`
