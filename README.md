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

Como los datos se cargan con `fetch`, la página no funciona abriendo `index.html` con doble clic (`file://`). Hace falta PHP; con SQLite no hace falta instalar MySQL:

```
cp api/config.ejemplo.php api/config.php     (y deja activo el bloque de SQLite)
php api/instalar.php
php -S localhost:8080
```

y abrir <http://localhost:8080>. `php -S` sirve la web y el servidor a la vez.

El catálogo de hechizos y las descripciones de virtudes y defectos están resumidos en castellano a partir del material de Ars Magica publicado con licencia abierta:

> Based on the material for Ars Magica, ©1993–2024, licensed by Trident, Inc. d/b/a Atlas Games®, under Creative Commons Attribution-ShareAlike 4.0 International license 4.0 ("CC-BY-SA 4.0").

[OpenARS](https://www.atlas-games.com/arsmagica/openars) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
