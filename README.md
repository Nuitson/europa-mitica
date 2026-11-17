# Europa Mítica

Web de las sagas de Ars Magica de Europa Mítica: fichas, estaciones, reparto de experiencia, pantalla del máster y ayudas de juego.

## Archivos

```
index.html            la página: solo el marco (barra lateral y zona de contenido)
config.js             la dirección del servidor, una aplicación web de Google Apps Script
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

`js/gate.js` lee los tres JSON con `fetch`, les añade la carpeta de la saga que llega del servidor y los deja en `window.EM_DATA`, junto con la base de datos de la saga en `window.EM_WEB`. Después importa `js/app/main.js`, que arranca la aplicación al cargarse.

Al añadir un módulo, enlázalo también con `<link rel="modulepreload">` en `index.html`, para que se descargue mientras se muestra la entrada. Añádelo también a `FILES` en `sw.js`, como cualquier imagen o archivo de datos nuevo.

Los módulos se cargan en el orden de sus `import`. Lo que se ejecuta al cargar un módulo (fuera de las funciones) solo puede usar lo que ya está cargado. Por eso las tablas fijas y el estado viven en módulos sin dependencias circulares (`base.js`, `saga/state.js`). Una variable `let` solo se puede reasignar en su propio módulo: desde fuera, usa una función (por ejemplo, `resetIndex()` en `search.js`).

## En la mesa

- **Imprimir:** la ficha (la pestaña que está abierta) y la pantalla del máster tienen un botón «Imprimir». Sale en el tema claro, sin el índice, las pestañas ni los botones; también sirve para guardarla en PDF.
- **Tiradas:** la descripción de cada hechizo de una ficha tiene «Tirar dado de estrés». Suma el dado de estrés de ArM5 al total de lanzamiento (con el aura de la escena) y dice si sale, si cuesta fatiga o si falla. Con un 0 tira los dados de pifia: uno, más uno por punto de aura de otro reino y menos uno por punto de maestría.

## Sin conexión

`sw.js` guarda en el navegador una copia de la página, de los datos y de las imágenes. Con conexión, todo llega siempre del servidor (y la copia se renueva); sin conexión, o si la red tarda más de 4 segundos, responde la copia. El servidor de la saga nunca se guarda en la copia: sus datos siempre llegan en vivo.

Si no hay conexión, la entrada ofrece abrir la última saga abierta en ese navegador con solo las ayudas de juego. Las fichas, las estaciones y la pantalla del máster necesitan el servidor.

## Seguridad

`index.html` lleva una política de seguridad de contenidos (CSP): solo se ejecutan los scripts de la propia web, y la página solo se conecta consigo misma y con Apps Script (`script.google.com`, que responde desde `script.googleusercontent.com`). Si el servidor de la saga cambia de dirección (por ejemplo, uno de pruebas en `localhost` en otro puerto), hay que añadirla a `connect-src` en esa política.

Cambiar la estación actual y el aura de la alianza es cosa del máster: los jugadores no ven esos botones. Qué puede escribir cada rol lo decide, en todo caso, el servidor.

## Probarla en local

Como los datos se cargan con `fetch`, la página no funciona abriendo `index.html` con doble clic (`file://`). Hay que servir la carpeta:

```
python -m http.server 8000
```

y abrir <http://localhost:8000>. En GitHub Pages funciona tal cual.

Cada saga se abre con su código, que da el máster. Sus datos viven en el Drive de quien instaló el servidor y solo llegan a la web después de comprobar ese código.

El catálogo de hechizos y las descripciones de virtudes y defectos están resumidos en castellano a partir del material de Ars Magica publicado con licencia abierta:

> Based on the material for Ars Magica, ©1993–2024, licensed by Trident, Inc. d/b/a Atlas Games®, under Creative Commons Attribution-ShareAlike 4.0 International license 4.0 ("CC-BY-SA 4.0").

[OpenARS](https://www.atlas-games.com/arsmagica/openars) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
