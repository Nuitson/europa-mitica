<?php
/* Copia este archivo como config.php y rellénalo. config.php no se sube a git. */

// En el hosting (Plesk): los datos de la base de datos MySQL que creas en el panel
return [
    'driver' => 'mysql',
    'host' => 'localhost',
    'db' => 'nombre_de_la_base',
    'user' => 'usuario',
    'pass' => 'contraseña',
    // Correo para «He olvidado mi contraseña». En el hosting, 'mail' usa el correo del servidor.
    'correo' => ['modo' => 'mail', 'desde' => 'no-responder@tu-dominio.es'],
    // 'url' => 'https://tu-dominio.es',   // opcional: la dirección de la web, para los enlaces de los correos
];

/* Para trabajar en tu PC sin MySQL, usa SQLite (la extensión pdo_sqlite de PHP). La base de datos viaja en el repositorio (datos/europa.sqlite).
   Sin servidor de correo, los mensajes se guardan en un archivo en vez de enviarse:
return [
    'driver' => 'sqlite',
    'file' => __DIR__ . '/../datos/europa.sqlite',
    'correo' => ['modo' => 'archivo', 'archivo' => __DIR__ . '/../datos/correo.log'],
];
*/
