# Europa Mítica: forma de trabajar

Seguir siempre estas normas. Detalles de la web en `README.md`.

## Ramas y publicación

- Se trabaja y se prueba en local (<http://localhost:8080>), en la rama **`desarrollo`**. Antes de empezar, comprueba que estás en ella y ponte al día (`git pull`).
- Cada cambio terminado y probado: **commit y push a `desarrollo`**, sin esperar a que se pida. Eso no toca la web.
- **La web (<https://conciliodearazas.com>) solo se actualiza cuando Nuitson lo pide** («súbelo a la web»). Entonces `desarrollo` se pasa a `main` (`git merge --ff-only desarrollo`), se sube `main` y Plesk publica solo en unos segundos. Comprueba que la web sirve la versión nueva y vuelve a `desarrollo`.
- Nunca se sube nada a `main` sin esa petición: todo lo que entra en `main` se publica.

## Fork (el programa) y deshacer versiones

- «Fork» es el **programa Fork** (cliente de git), no un fork de GitHub. Nuitson y Trullenque lo usan para ver las versiones.
- Cada versión tiene que quedar guardada para poder deshacerla: **un commit por cada cambio**, con un mensaje que diga qué hace.
- Para deshacer se usa **revert** (en Fork: clic derecho sobre el commit → *Revert commit*; o `git revert`), en `desarrollo`.
- **No se reescribe el historial:** nada de `push --force`, `reset` sobre commits subidos, `rebase` de lo ya publicado ni borrar ramas.

## Qué no se toca

- `datos/europa.sqlite` (la base de datos local) e `iniciar-servidor.vbs` **no se incluyen en los commits** salvo que se pida. No descartes sus cambios (*Discard changes* en Fork): son los datos de la saga local.
- `api/config.php`, contraseñas y claves nunca van a git.
- No se cambian datos de personajes sin que lo decida el usuario. Las pruebas se hacen en la saga de prueba «Arazas 2.1», nunca en la Saga de Arazas, y se borran al terminar.

## Al cambiar la web

- Sube la versión de `CACHE` en `sw.js`.
- Un módulo nuevo se enlaza en `index.html` (`modulepreload`) y en `FILES` de `sw.js`.
- Si cambia cómo se usa o se instala algo, actualiza `README.md`.
