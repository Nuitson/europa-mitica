# Europa Mítica

Web de las sagas de Ars Magica de Europa Mítica: fichas, estaciones, reparto de experiencia, pantalla del máster y ayudas de juego.

## Archivos

```
index.html            la página: solo el marco (barra lateral y zona de contenido)
servir.bat / .ps1    arranca la web en local (activa las extensiones de PHP en Windows y crea api/config.php)
config.js             la dirección del servidor (api/api.php)
api/                  el servidor: PHP + MySQL (lib.php lleva la lógica, api.php es el punto de entrada, instalar.php prepara la base de datos,
                        usuarios.php gestiona cuentas desde la línea de órdenes)
herramientas/         migrar_desde_drive.py: pasa una saga del servidor antiguo (Drive) al nuevo;
libros/en, libros/es  los PDF de los libros (en inglés y en castellano) a los que enlaza la columna «Pág.» del compendio; data/libros.json es el índice
                        (herramientas/enlaces_libros.py lo genera: comprueba las páginas y copia los PDF desde Dropbox)
                        herramientas/descripciones_libros.py rellena la columna «Descripción» del compendio con el texto de los libros en castellano y
                        aplica herramientas/nombres_libros.json, los nombres que el libro llama de otra forma, revisados a mano)
                        homebrew_csv.py: convierte los CSV de material de blogs en data/homebrew/
sw.js                 la copia de la web en el navegador, para abrir las ayudas de juego sin conexión
css/styles.css        los estilos
js/gate.js            la entrada: abre la cuenta y la saga, carga los datos y arranca la aplicación
js/cuenta.js          las pantallas de la cuenta: entrar, crear cuenta, recuperar la contraseña y «Mi zona»
js/app/               la aplicación, en módulos de JavaScript (ES modules):
  main.js               rutas y arranque
  base.js               datos de la página, artes y utilidades comunes (h, esc…), registro de bloques R
  tree.js, search.js    árbol de carpetas de la barra lateral y buscador
  blocks.js, views.js   bloques de las ayudas de juego (tablas, gráficos…) y páginas de documentos e inicio
  saga/state.js         tablas fijas y el estado compartido S de la saga en curso
  saga/core.js          carga y suscripciones, escrituras, avisos, ventanas y controles de formulario
  saga/rules.js         reglas de ArM5 para las fichas: formas, heridas, fatiga, hechizos, experiencia
  saga/home.js          la saga en la barra lateral, en el inicio y en las cifras vivas de las hojas
  saga/homebrew.js      reglas caseras y material de blogs que el máster activa (pestaña «Homebrew» de su pantalla)
  saga/hbview.js        las páginas del material homebrew: #hb, cada grupo de tipo y autor y cada entrada
  saga/seasons.js       estaciones: reparto de experiencia, vis y tesorería
  saga/characters.js    personajes y sus fichas
  saga/pjfile.js        exportar un personaje a un archivo e importarlo (en esta saga o en otra)
  creation/rules.js     compendio de virtudes y defectos y reglas de creación
  creation/editor.js    el editor de personajes
  creation/vdtab.js     la pestaña para elegir virtudes y defectos: buscador, filtros, páginas, casillas y las propias de la saga
  creation/generos.js   las virtudes y defectos en femenino (el neutro, en -e, sale de ahí), según el género de la ficha
  master.js             la pantalla del máster (miembros de la saga, de quién es cada personaje, copias de seguridad)
  info.js               descripciones al pulsar un hechizo, una virtud o un defecto
data/ayudas.json      las ayudas de juego compartidas (guías, virtudes y defectos, pantalla del jugador…)
data/hechizos.json    el catálogo de hechizos
data/imagenes.json    la lista de imágenes de las ayudas (id → archivo)
data/homebrew/        material fanmade de blogs por tipo y autor (index.json y un archivo por grupo), de herramientas/homebrew_csv.py
img/                  las imágenes de las ayudas
```

`js/gate.js` lee los tres JSON con `fetch`, les añade los datos de la saga que llegan del servidor y los deja en `window.EM_DATA`, junto con la base de datos de la saga en `window.EM_WEB`. Después importa `js/app/main.js`, que arranca la aplicación al cargarse.

Al añadir un módulo, enlázalo también con `<link rel="modulepreload">` en `index.html`, para que se descargue mientras se muestra la entrada. Añádelo también a `FILES` en `sw.js`, como cualquier imagen o archivo de datos nuevo.

Los módulos se cargan en el orden de sus `import`. Lo que se ejecuta al cargar un módulo (fuera de las funciones) solo puede usar lo que ya está cargado. Por eso las tablas fijas y el estado viven en módulos sin dependencias circulares (`base.js`, `saga/state.js`). Una variable `let` solo se puede reasignar en su propio módulo: desde fuera, usa una función (por ejemplo, `resetIndex()` en `search.js`).

## En la mesa

- **Imprimir:** la ficha (la pestaña que está abierta) y la pantalla del máster tienen un botón «Imprimir». Sale en el tema claro, sin el índice, las pestañas ni los botones; también sirve para guardarla en PDF.
- **Exportar e importar personajes:** la página de cada personaje tiene «Exportar», que descarga un archivo `.json` con la ficha, todas sus estaciones y el retrato. En «Personajes», «Importar personaje» lee ese archivo, enseña lo que trae y lo crea como un personaje **nuevo**, a nombre de quien lo importa; nunca cambia los que ya hay (si ya existe uno con el mismo nombre, se avisa y quedan los dos). Sirve para pasar un personaje de una saga a otra o para guardar una copia suya. La copia de la saga entera sigue en la pantalla del máster.
- **Virtudes y defectos propios de la saga:** en la pestaña «Elegir virtudes y defectos» del editor, «Crear virtud o defecto» añade uno nuevo (nombre, virtud o defecto, valor, tipo y descripción). Se guarda en la saga (`virtudes/{id}`), sale en «Libros» como «Propias de la saga», se elige como cualquier otro y su descripción se ve en las fichas. Solo existe en esa saga: no entra en el compendio común (`data/ayudas.json`) ni en las sagas que se creen después; sí va en la copia de seguridad de la saga. Lo cambia o lo borra quien lo creó o un máster. Cuando ya lo tiene algún personaje, el nombre no se puede cambiar (las fichas lo encuentran por el nombre).
- **Homebrew:** la pantalla del máster tiene la pestaña «Homebrew». Arriba, las reglas caseras con una casilla cada una (por ejemplo, el lanzamiento con atributos afines). Debajo, el material de blogs (magos, aprendices, alianzas, objetos mágicos y hechizos) con un botón por tipo y autor, como «Teotimus · Hechizos». Lo añadido sale para toda la saga en la barra lateral, en «Homebrew», y sus hechizos entran en el catálogo de las fichas. Se guarda en el estado de la saga (`saga/estado`, campo `homebrew`). Para cambiar el material: `python herramientas/homebrew_csv.py <los CSV>`.
- **Tiradas:** la descripción de cada hechizo de una ficha tiene «Tirar dado de estrés». Suma el dado de estrés de ArM5 al total de lanzamiento (con el aura de la escena) y dice si sale, si cuesta fatiga o si falla. Con un 0 tira los dados de pifia: uno, más uno por punto de aura de otro reino y menos uno por punto de maestría.

## Sin conexión

`sw.js` guarda en el navegador una copia de la página, de los datos y de las imágenes. Con conexión, todo llega siempre del servidor (y la copia se renueva); sin conexión, o si la red tarda más de 4 segundos, responde la copia. El servidor de la saga nunca se guarda en la copia: sus datos siempre llegan en vivo.

Si no hay conexión, la entrada ofrece abrir la última saga abierta en ese navegador con solo las ayudas de juego. Las fichas, las estaciones y la pantalla del máster necesitan el servidor.

## Seguridad

`index.html` lleva una política de seguridad de contenidos (CSP): solo se ejecutan los scripts de la propia web, y la página solo se conecta consigo misma, y el servidor de la saga está en el mismo sitio (`api/api.php`). Si el servidor pasara a otra dirección, habría que añadirla a `connect-src` en esa política.

Cambiar la estación actual y el aura de la alianza es cosa del máster: los jugadores no ven esos botones. Qué puede hacer cada rol lo decide, en todo caso, el servidor: copia de seguridad, importar, miembros y asignar personajes son solo del máster.

## Cuentas y sagas

Cada persona tiene su **cuenta** (usuario, contraseña, correo, nombre que se ve e imagen). Las contraseñas se guardan con bcrypt; entrar mal muchas veces bloquea unos minutos; las sesiones duran 120 días y se pueden cerrar en todos los dispositivos desde «Mi perfil». Quien olvida la contraseña la cambia con un enlace que llega por correo (vale una hora y una sola vez).

- **Registrarse es libre**, pero una cuenta nueva no ve ninguna saga. Para entrar en una, el **máster la añade con su usuario** (pantalla del máster → «Quién está en la saga») como jugador o como máster. No hay códigos de saga.
- **Administrador:** nivel por encima del máster. Entra en **todas** las sagas como máster (leer y editar todo, aunque no sea miembro), puede crear sagas y, en las tablas de las ayudas de juego, pulsar «Editar celdas» y cambiar cualquier celda: el cambio se guarda en el servidor (tabla `docs`, saga `_global`, ruta `ayudas/ediciones`), se aplica encima de `data/ayudas.json` para todas las sagas y también lo ven los invitados. Se da con `php api/usuarios.php admin <usuario>` (y se quita con `… admin <usuario> no`). Los documentos de la propia saga (sus hojas de cálculo) no son de las ayudas y no se editan así.
- **Crear sagas:** solo las cuentas con permiso. La primera cuenta que se registra en una web nueva lo tiene; a otra se le da con `php api/usuarios.php crea-sagas <usuario>`. Quien crea una saga es su máster.
- **Mi zona** (se abre con «Mi zona» en la barra lateral, o al entrar si no hay saga): *Mis sagas* (con el rol de cada una), *Mis creaciones* (todo lo que has creado, repartido en personajes, hechizos, libros estudiados, actividades de estación y movimientos de vis y tesorería, con la saga a la que pertenece y un botón para abrirlo) y *Mi perfil* (imagen, nombre, correo, contraseña y sesiones).
- **De quién es cada cosa:** cada documento guarda la cuenta que lo creó, y no cambia al editarlo otra persona. Los personajes que ya existían (por ejemplo, los traídos de Drive) no tienen dueño: el máster los asigna en su pantalla, en «Personajes y jugadores».
- **«Libros»:** la web no tiene libros como pieza aparte; salen en «Libros estudiados» las actividades de estación de tipo «Estudio: summa» o «Estudio: tractatus», con su nota como título.

**Administrar desde la línea de órdenes** (por SSH en el hosting, o en tu PC):

```
php api/usuarios.php listar                       cuentas, sagas y sus miembros
php api/usuarios.php master <usuario> <saga>      hace máster de esa saga a esa cuenta
php api/usuarios.php miembro <usuario> <saga>     la añade como jugador
php api/usuarios.php crea-sagas <usuario> [no]    da (o quita) el permiso de crear sagas
php api/usuarios.php contrasena <usuario>         pone una contraseña nueva al azar (para quien no pueda recuperarla)
```

**Primera vez con una saga que ya existe** (por ejemplo, la Saga de Arazas traída de Drive): regístrate en la web, y después `php api/usuarios.php master <tu-usuario> arazas`. A partir de ahí añades tú al resto desde la pantalla del máster.

## El servidor

Los datos de las sagas (personajes, estaciones, vis, tesorería, retratos, virtudes y defectos propios) y las cuentas viven en una base de datos MySQL. `api/api.php` recibe un POST con `{accion: …}` y responde con JSON. Las acciones de cuenta son `registrar`, `entrar`, `perfil`, `actualizarPerfil`, `cambiarPassword`, `cerrarSesiones`, `recuperar`, `restablecer`, `contenido` y `crear`. Las de una saga (llevan `token` y `saga`) son `info`, `leer`, `escribir`, `archivo`, `exportar`, `importar`, `miembros`, `anadirMiembro`, `cambiarRol`, `quitarMiembro`, `asignar` y `autores`. El servidor comprueba siempre el rol de la cuenta en la saga.

Necesita PHP 8.1 o superior con la extensión PDO MySQL (en Plesk: «Selector PHP»).

**Instalarlo en el hosting**

1. En Plesk, crea la base de datos MySQL y apunta su nombre, usuario y contraseña.
2. Sube la carpeta de la web por SFTP (sin `datos/`, que es solo para trabajar en local).
3. Copia `api/config.ejemplo.php` como `api/config.php` y rellénalo: la base de datos y el correo (`'modo' => 'mail'` y la dirección de la que salen los mensajes, por ejemplo `no-responder@tu-dominio.es`; conviene que el dominio tenga SPF para que no caigan en el correo no deseado).
4. Abre `https://tu-dominio/api/api.php` en el navegador: tiene que responder `{"ok":true,…}`. Las tablas se crean solas en la primera petición (también puedes hacerlo por SSH con `php api/instalar.php`).
5. Regístrate en la web: tu cuenta podrá crear sagas.

Si al importar una copia grande falla, sube `post_max_size` en el Selector PHP.

**Publicar desde GitHub (automático).** La web de <https://conciliodearazas.com> se publica sola desde la rama `main` de este repositorio, con «Desplegar mediante Git» de Plesk (Sitios web y dominios → Git):

- Repositorio remoto `https://github.com/Nuitson/europa-mitica.git`, desplegado en `/httpdocs`.
- Acción de despliegue adicional, que quita lo que no es de la web (la base de datos local con sus cuentas, las herramientas y los scripts de local):

  ```
  for d in . httpdocs; do if [ -f "$d/index.html" ] && [ -d "$d/api" ] && [ -f "$d/sw.js" ]; then (cd "$d" && rm -rf datos herramientas servir.bat servir.ps1 README.md .gitignore .gitattributes); fi; done
  ```

- En GitHub, Settings → Webhooks, la dirección de webhook que da Plesk en la página del repositorio: así cada `push` a `main` avisa a Plesk y se publica al momento.
- `api/config.php` no está en git: publicar nunca lo toca. Los datos de las sagas tampoco, porque están en MySQL.
- Si el repositorio pasa a privado, Plesk deja de poder leerlo por https: cambia la URL a `git@github.com:Nuitson/europa-mitica.git` y añade en GitHub (Settings → Deploy keys) la clave SSH que enseña Plesk, solo de lectura.

**Copias de seguridad:** el plan del hosting hace copias de la base de datos, y cada máster puede descargar una copia de su saga desde la pantalla del máster. La copia lleva todos sus documentos y, si la saga las tiene, sus hojas de cálculo traídas de Drive (su archivo); al importarla se vuelve a poner todo.

**Pasar una saga desde Drive:** `python herramientas/migrar_desde_drive.py --help` (hace falta una cuenta con permiso para crear sagas).

## Probarla en local

La página no funciona abriendo `index.html` con doble clic (`file://`): necesita el servidor PHP. En local se usa SQLite, así que **no hace falta instalar MySQL** (en el hosting se usa MySQL; el código es el mismo). Los datos vienen en el repositorio: ver «La base de datos compartida en git».

**1. Instalar PHP 8.1 o superior** (Windows, en PowerShell):

```
winget install PHP.PHP.8.3
```

Cierra y abre la terminal para que encuentre `php`. En macOS: `brew install php`; en Linux, el paquete `php-cli` con `php-sqlite3` y `php-mbstring`.

**2. Arrancar.** Desde la carpeta del proyecto, en Windows:

```
servir.bat
```

(o `.\servir.ps1` en PowerShell; admite un puerto: `servir.bat 9000`). Abre <http://localhost:8080> y deja la terminal abierta (se para con Ctrl+C): sirve la web y el servidor a la vez. El script se ocupa de lo que PHP en Windows trae sin hacer: activa las extensiones que hacen falta (`mbstring`, `pdo_sqlite`, `sqlite3`, `openssl`) con un `php.ini` temporal, sin tocar tu instalación, y crea `api/config.php` (SQLite, no se sube a git) si no existe.

En macOS y Linux no hace falta el script: con las extensiones instaladas (`php-sqlite3`, `php-mbstring`), copia `api/config.ejemplo.php` a `api/config.php`, déjalo con este contenido y arranca con `php -S localhost:8080`:

```php
<?php
return [
    'driver' => 'sqlite',
    'file' => __DIR__ . '/../datos/europa.sqlite',
    'correo' => ['modo' => 'archivo', 'archivo' => __DIR__ . '/../datos/correo.log'],
];
```

La base de datos del equipo ya trae las cuentas y sagas que haya (ver «La base de datos compartida en git»). Si todavía no tienes cuenta, créala en la entrada («Crear una cuenta»); para que un máster te añada a su saga, dale tu usuario. Si necesitas empezar de cero (por ejemplo, para pruebas), borra `datos/europa.sqlite`: se crea vacía en la primera petición; la primera cuenta que registres podrá crear sagas.

En local no hay servidor de correo: con el modo `archivo` de arriba, «He olvidado mi contraseña» no envía nada, sino que escribe el mensaje (con el enlace) en `datos/correo.log`, que git ignora.

**Si la web sigue mostrando otra cosa** (por ejemplo, la versión anterior): el navegador guarda copias de la página (`sw.js`). Abre las herramientas de desarrollo (F12) → Application → Storage → «Clear site data» (con «Unregister service workers») y recarga con Ctrl+F5.

**Si falla:** el registro de errores de PHP sale en la terminal donde corre `php -S`. Si la web dice que a PHP le faltan extensiones (o el error es «could not find driver»), no estás arrancándola con `servir.bat` (paso 2).

## La base de datos compartida en git

Para que todos tengamos los mismos datos, **la base de datos de local viaja en el repositorio**: es el archivo `datos/europa.sqlite` (SQLite, un único archivo con las cuentas, las sagas, los personajes, las estaciones y los retratos). Por eso el repositorio tiene que ser **privado**: dentro van los datos de la partida, los correos de los usuarios, los hashes de sus contraseñas y la clave con que se firman las sesiones. Quien tenga acceso al repo puede ver todo eso, y con la clave de las sesiones, hacerse pasar por cualquier cuenta.

Cómo trabajar:

1. Antes de empezar: `git pull`, con el servidor parado (Ctrl+C en la terminal de `php -S`).
2. Arranca, trabaja en la web (los cambios se guardan solos en `datos/europa.sqlite`) y para el servidor.
3. Al acabar: `git add datos/europa.sqlite`, `git commit` y `git push`.

**Un solo archivo no se puede fusionar.** Git no sabe mezclar dos versiones de un `.sqlite`: si dos personas cambian datos desde el mismo `pull` y las dos hacen `push`, la segunda recibirá un conflicto en ese archivo y habrá que quedarse con una de las dos versiones (`git checkout --theirs datos/europa.sqlite` o `--ours`) y volver a meter a mano lo que se pierda. Para evitarlo: avisaos antes de tocar datos, haced `pull` justo antes de empezar y `push` justo al acabar, y no dejéis cambios sin subir. Cada versión que se sube pesa casi lo que la base de datos entera (hoy casi 1 MB), así que el repositorio crece con cada commit de datos: no los hagáis más de lo necesario. Las cuentas también están en ese archivo: quien se registre en su copia local y no suba el archivo, no existe para los demás.

Dos precauciones:

- Los `.sqlite-wal`, `.sqlite-shm` y `-journal` están ignorados a propósito: la base de datos se guarda sin ellos (`journal_mode=DELETE`) para que `datos/europa.sqlite` sea siempre un archivo completo. Si copias o subes el archivo con el servidor en medio de una escritura, espera a que termine.
- `datos/` es solo para trabajar en local. **No la subas al hosting**: allí los datos viven en MySQL, y la carpeta lleva un `.htaccess` que impide descargarla por si acaso. Para llevar los datos del equipo al hosting, descarga una copia desde la pantalla del máster (con las hojas de Drive incluidas) e impórtala allí, en una saga creada para ello, con «Sustituir lo que hay» (o usa la herramienta de migración). Las cuentas no van en la copia: cada uno se registra en el hosting y el máster lo añade.

## Colaborar desde un fork

Para mejorar la web sin tocar directamente el repositorio principal (`Nuitson/europa-mitica`): cada uno trabaja en su copia de GitHub (un *fork*) y propone sus cambios con una *pull request*, que Nuitson revisa y fusiona.

**La primera vez**

1. En GitHub, abre <https://github.com/Nuitson/europa-mitica> y pulsa **Fork**: se crea `tu-usuario/europa-mitica`. Si el repositorio es privado, Nuitson tiene que añadirte antes como colaborador (Settings → Collaborators → Add people).
2. Clona tu fork y enlázalo con el principal:

   ```
   git clone https://github.com/tu-usuario/europa-mitica.git
   cd europa-mitica
   git remote add upstream https://github.com/Nuitson/europa-mitica.git
   ```

3. Arráncala como en «Probarla en local» (`servir.bat`) y abre <http://localhost:8080>.

**Cada mejora**

1. Ponte al día con el principal: `git checkout main`, `git pull upstream main` y `git push origin main` (o el botón **Sync fork** de tu fork en GitHub, y luego `git pull`).
2. Haz una rama para la mejora: `git checkout -b nombre-de-la-mejora`.
3. Cambia y prueba en local. Guarda con `git add` de los archivos que hayas cambiado (no `git add .` ni `git add -A`: así no se cuela `datos/europa.sqlite`), `git commit` y `git push origin nombre-de-la-mejora`.
4. En GitHub, en tu fork, pulsa **Contribute → Open pull request** hacia `Nuitson/europa-mitica` (rama `main`) y explica qué cambia y cómo probarlo.
5. Nuitson la revisa y la fusiona en `main`. Al fusionarla, la web del dominio se actualiza sola (ver «Publicar desde GitHub»): lo que entra en `main` es lo que ve todo el mundo, así que pruébalo bien antes.

**Para que las pull requests encajen**

- **Sin datos:** `datos/europa.sqlite` no va en las pull requests. Es un único archivo que git no sabe mezclar, y los datos de verdad de la saga están en el dominio. Para probar con ellos, descarga una copia en la pantalla del máster del dominio e impórtala en tu web local.
- **Sin contraseñas:** nunca `api/config.php` (git ya lo ignora) ni claves en el código.
- Si cambias archivos de la web, sube la versión de `CACHE` en `sw.js`; si añades un módulo, enlázalo en `index.html` y en `FILES` de `sw.js` (ver «Archivos»).
- Una mejora por pull request, con un título que diga qué hace.

El catálogo de hechizos y las descripciones de virtudes y defectos están resumidos en castellano a partir del material de Ars Magica publicado con licencia abierta:

> Based on the material for Ars Magica, ©1993–2024, licensed by Trident, Inc. d/b/a Atlas Games®, under Creative Commons Attribution-ShareAlike 4.0 International license 4.0 ("CC-BY-SA 4.0").

[OpenARS](https://www.atlas-games.com/arsmagica/openars) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
