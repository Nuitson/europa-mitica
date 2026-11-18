<?php
/* Copia este archivo como config.php y rellénalo. config.php no se sube a git. */

// En el hosting (Plesk): los datos de la base de datos MySQL que creas en el panel
return [
    'driver' => 'mysql',
    'host' => 'localhost',
    'db' => 'nombre_de_la_base',
    'user' => 'usuario',
    'pass' => 'contraseña',
];

/* Para probar en tu PC sin MySQL, usa SQLite (la extensión pdo_sqlite de PHP). El archivo queda fuera de la carpeta de la web:
return [
    'driver' => 'sqlite',
    'file' => __DIR__ . '/../../europa-mitica.sqlite',
];
*/
