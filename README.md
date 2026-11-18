# Europa Mítica

Web de las sagas de Ars Magica de Europa Mítica: fichas, estaciones, reparto de experiencia, pantalla del máster y ayudas de juego.

## Archivos

```
index.html            la página: solo el marco (barra lateral y zona de contenido)
config.js             la dirección del servidor (api/api.php)
api/                  el servidor: PHP + MySQL (lib.php lleva la lógica, api.php es el punto de entrada, instalar.php prepara la base de datos)
herramientas/         migrar_desde_drive.py: pasa una saga del servidor antiguo (Drive) al nuevo
sw.js                 la copia de la web en el navegador, para abrir las ayudas de juego sin conexión
css/styles.css        los estilos
js/gate.js            la entrada: elige saga y rol, comprueba el código con el servidor, carga los datos y arranca la aplicación
js/app/               la aplicación, en módulos de JavaScript (ES modules):
  main.js               rutas y arranque
  base.js               datos de la página, artes y utilidades comunes (h, esc…), registro de bloques R
  tree.js, search.js    árbol de carpetas de la barra lateral y buscador
  blocks.js, views.js   bloques de las ayudas de juego (tablas, gráficos…) y páginas de documentos e inicio
  saga/state.js         tablas fijas y el estado compartido S de la saga en curso
  saga/core.js          carga y suscripciones, escrituras, avisos, ventanas y controles de formulario
  saga/rules.js         reglas de ArM5 para las fichas: formas, heridas, fatiga, hechizos, experiencia
  saga/home.js          la saga en la barra lateral, en el inicio y en las cifras vivas de las hojas
  saga/seasons.js       estaciones: reparto de experiencia, vis y tesorería
  saga/characters.js    personajes y sus fichas
  creation/rules.js     compendio de virtudes y defectos y reglas de creación
  creation/editor.js    el editor de personajes
  master.js             la pantalla del máster
  info.js               descripciones al pulsar un hechizo, una virtud o un defecto
data/ayudas.json      las ayudas de juego compartidas (guías, virtudes y defectos, pantalla del jugador…)
data/hechizos.json    el catálogo de hechizos
data/imagenes.json    la lista de imágenes de las ayudas (id → archivo)
img/                  las imágenes de las ayudas
```

`js/gate.js` lee los tres JSON con `fetch`, les añade los datos de la saga que llegan del servidor y los deja en `window.EM_DATA`, junto con la base de datos de la saga en `window.EM_WEB`. Después importa `js/app/main.js`, que arranca la aplicación al cargarse.

Al añadir un módulo, enlázalo también con `<link rel="modulepreload">` en `index.html`, para que se descargue mientras se muestra la entrada. Añádelo también a `FILES` en `sw.js`, como cualquier imagen o archivo de datos nuevo.

Los módulos se cargan en el orden de sus `import`. Lo que se ejecuta al cargar un módulo (fuera de las funciones) solo puede usar lo que ya está cargado. Por eso las tablas fijas y el estado viven en módulos sin dependencias circulares (`base.js`, `saga/state.js`). Una variable `let` solo se puede reasignar en su propio módulo: desde fuera, usa una función (por ejemplo, `resetIndex()` en `search.js`).

## En la mesa

- **Imprimir:** la ficha (la pestaña que está abierta) y la pantalla del máster tienen un botón «Imprimir». Sale en el tema claro, sin el índice, las pestañas ni los botones; también sirve para guardarla en PDF.
- **Tiradas:** la descripción de cada hechizo de una ficha tiene «Tirar dado de estrés». Suma el dado de estrés de ArM5 al total de lanzamiento (con el aura de la escena) y dice si sale, si cuesta fatiga o si falla. Con un 0 tira los dados de pifia: uno, más uno por punto de aura de otro reino y menos uno por punto de maestría.

## Sin conexión

`sw.js` guarda en el navegador una copia de la página, de los datos y de las imágenes. Con conexión, todo llega siempre del servidor (y la copia se renueva); sin conexión, o si la red tarda más de 4 segundos, responde la copia. El servidor de la saga nunca se guarda en la copia: sus datos siempre llegan en vivo.

Si no hay conexión, la entrada ofrece abrir la última saga abierta en ese navegador con solo las ayudas de juego. Las fichas, las estaciones y la pantalla del máster necesitan el servidor.

## Seguridad

`index.html` lleva una política de seguridad de contenidos (CSP): solo se ejecutan los scripts de la propia web, y la página solo se conecta consigo misma, y el servidor de la saga está en el mismo sitio (`api/api.php`). Si el servidor pasara a otra dirección, habría que añadirla a `connect-src` en esa política.

Cambiar la estación actual y el aura de la alianza es cosa del máster: los jugadores no ven esos botones. Qué puede escribir cada rol lo decide, en todo caso, el servidor.

## El servidor

Los datos de las sagas (personajes, estaciones, vis, tesorería, retratos) viven en una base de datos MySQL. `api/api.php` recibe un POST con `{accion: …}` y responde con JSON; sus acciones son `sagas`, `entrar`, `crear`, `info`, `leer`, `escribir`, `archivo`, `exportar`, `importar` y `codigos`. Cada saga se abre con su código, que da el máster, y solo sus datos llegan al navegador después de comprobarlo. Los códigos se guardan con hash (bcrypt) y hay un freno de intentos.

Necesita PHP 8.1 o superior con la extensión PDO MySQL (en Plesk: «Selector PHP»).

**Instalarlo en el hosting**

1. En Plesk, crea la base de datos MySQL y apunta su nombre, usuario y contraseña.
2. Sube la carpeta de la web por SFTP.
3. Copia `api/config.ejemplo.php` como `api/config.php` y rellénalo.
4. Por SSH, en la carpeta de la web: `php api/instalar.php`. Crea las tablas y muestra el código para crear sagas (apúntalo: no se vuelve a mostrar).
5. Comprueba que `https://tu-dominio/api/api.php` responde `{"ok":true,…}` en el navegador.

Si al importar una copia grande falla, sube `post_max_size` y `upload_max_filesize` en el Selector PHP.

**Copias de seguridad:** el plan del hosting hace copias de la base de datos, y cada máster puede descargar una copia de su saga desde la pantalla del máster.

**Pasar una saga desde Drive:** `python herramientas/migrar_desde_drive.py --help`.

## Probarla en local

La página no funciona abriendo `index.html` con doble clic (`file://`): necesita el servidor PHP. En local se usa SQLite, así que **no hace falta instalar MySQL** (en el hosting se usa MySQL; el código es el mismo). Los datos vienen en el repositorio: ver «La base de datos compartida en git».

**1. Instalar PHP 8.1 o superior** (Windows, en PowerShell):

```
winget install PHP.PHP.8.3
```

Cierra y abre la terminal para que encuentre `php`. En macOS: `brew install php`; en Linux, el paquete `php-cli` con `php-sqlite3` y `php-mbstring`.

**2. Activar las extensiones.** Solo en Windows: PHP viene sin ellas. Crea un archivo `php.ini` (en cualquier carpeta fuera del proyecto) con estas líneas, cambiando la ruta de `extension_dir` por la carpeta `ext` de tu instalación de PHP. Para saber dónde está: `(Get-Command php).Source`, y la carpeta `ext` está junto a `php.exe` (suele estar en `%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.3_…`).

```
extension_dir="C:\ruta\a\php\ext"
extension=pdo_sqlite
extension=sqlite3
extension=mbstring
extension=openssl
```
Comprueba que salen las cuatro con `php -c C:\ruta\al\php.ini -m`. En el resto de comandos, `php` se escribe `php -c C:\ruta\al\php.ini`. (Si ya tienes un `php.ini` global con esas extensiones, no hace falta el `-c`.)
Comprueba que salen las cuatro con `php -c C:

**3. Configurar la base de datos.** Desde la carpeta del proyecto:

```
copy api\config.ejemplo.php api\config.php
```

y sustituye todo el contenido de `api/config.php` por esto:

```php
<?php
return [
    'driver' => 'sqlite',
    'file' => __DIR__ . '/../datos/europa.sqlite',
];
```

`config.php` es de cada uno y no se sube a git.

**4. Arrancar.**

```
php -S localhost:8080
```

Abre <http://localhost:8080> (deja la terminal abierta; se para con Ctrl+C). `php -S` sirve la web y el servidor a la vez.

Entra con el código de la saga que te dé quien la lleva. Si necesitas empezar una base de datos desde cero (por ejemplo, para pruebas), borra `datos/europa.sqlite`, ejecuta `php api/instalar.php` (muestra el **código para crear sagas**: apúntalo, no se vuelve a mostrar) y crea una saga desde la entrada: «Máster» → «Crear una saga nueva».

**Si la web sigue mostrando otra cosa** (por ejemplo, la versión anterior): el navegador guarda copias de la página (`sw.js`). Abre las herramientas de desarrollo (F12) → Application → Storage → «Clear site data» (con «Unregister service workers») y recarga con Ctrl+F5.

**Si falla:** el registro de errores de PHP sale en la terminal donde corre `php -S`. El error «could not find driver» significa que falta activar `pdo_sqlite` (paso 2).

## La base de datos compartida en git

Para que todos tengamos los mismos datos, **la base de datos de local viaja en el repositorio**: es el archivo `datos/europa.sqlite` (SQLite, un único archivo con todas las sagas, personajes, estaciones y retratos). Por eso el repositorio tiene que ser **privado**: dentro van los datos de la partida, los hashes de los códigos de acceso y la clave con que se firman las sesiones. Quien tenga acceso al repo puede entrar en cualquier saga.

Cómo trabajar:

1. Antes de empezar: `git pull`, con el servidor parado (Ctrl+C en la terminal de `php -S`).
2. Arranca, trabaja en la web (los cambios se guardan solos en `datos/europa.sqlite`) y para el servidor.
3. Al acabar: `git add datos/europa.sqlite`, `git commit` y `git push`.

**Un solo archivo no se puede fusionar.** Git no sabe mezclar dos versiones de un `.sqlite`: si dos personas cambian datos desde el mismo `pull` y las dos hacen `push`, la segunda recibirá un conflicto en ese archivo y habrá que quedarse con una de las dos versiones (`git checkout --theirs datos/europa.sqlite` o `--ours`) y volver a meter a mano lo que se pierda. Para evitarlo: avisaos antes de tocar datos, haced `pull` justo antes de empezar y `push` justo al acabar, y no dejéis cambios sin subir. Cada versión que se sube pesa casi lo que la base de datos entera (hoy unos 800 KB), así que el repositorio crece con cada commit de datos: no los hagáis más de lo necesario.

Dos precauciones:

- Los `.sqlite-wal`, `.sqlite-shm` y `-journal` están ignorados a propósito: la base de datos se guarda sin ellos (`journal_mode=DELETE`) para que `datos/europa.sqlite` sea siempre un archivo completo. Si copias o subes el archivo con el servidor en medio de una escritura, espera a que termine.
- `datos/` es solo para trabajar en local. **No la subas al hosting**: allí los datos viven en MySQL, y la carpeta lleva un `.htaccess` que impide descargarla por si acaso. Para llevar los datos del equipo al hosting, descarga una copia desde la pantalla del máster y impórtala allí (o usa la herramienta de migración).

El catálogo de hechizos y las descripciones de virtudes y defectos están resumidos en castellano a partir del material de Ars Magica publicado con licencia abierta:

> Based on the material for Ars Magica, ©1993–2024, licensed by Trident, Inc. d/b/a Atlas Games®, under Creative Commons Attribution-ShareAlike 4.0 International license 4.0 ("CC-BY-SA 4.0").

[OpenARS](https://www.atlas-games.com/arsmagica/openars) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
