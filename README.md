# Europa Mítica

Web de las sagas de Ars Magica de Europa Mítica: fichas, estaciones, reparto de experiencia, pantalla del máster y ayudas de juego.

## Archivos

```
index.html            la página: solo el marco (barra lateral y zona de contenido)
config.js             la dirección del servidor, una aplicación web de Google Apps Script
css/styles.css        los estilos
js/app.js             la aplicación: ayudas de juego, fichas, estaciones, creación de personajes, pantalla del máster
js/gate.js            la entrada: elige saga y rol, comprueba el código con el servidor, carga los datos y arranca app.js
data/ayudas.json      las ayudas de juego compartidas (guías, virtudes y defectos, pantalla del jugador…)
data/hechizos.json    el catálogo de hechizos
data/imagenes.json    la lista de imágenes de las ayudas (id → archivo)
img/                  las imágenes de las ayudas
```

`js/gate.js` lee los tres JSON con `fetch`, les añade la carpeta de la saga que llega del servidor y los deja en `window.EM_DATA` antes de llamar a `window.EM_START()`, que define `js/app.js`.

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
