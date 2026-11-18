<?php
/* Prepara la base de datos y el código para crear sagas. Se ejecuta una vez, desde la línea de órdenes:
     php api/instalar.php                       crea las tablas y, si no existe, el código para crear sagas
     php api/instalar.php --nuevo-codigo-crear  cambia el código para crear sagas
   Se puede volver a ejecutar sin riesgo: no borra nada. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

crearTablas();
echo "Tablas listas.\n";
if (ajuste('crear') === null || in_array('--nuevo-codigo-crear', $argv, true)) {
    $c = codigoNuevo();
    ponerAjuste('crear', hashCodigo($c));
    echo "Código para crear sagas: $c\n(apúntalo: no se vuelve a mostrar)\n";
} else {
    echo "El código para crear sagas ya estaba puesto (para cambiarlo: --nuevo-codigo-crear).\n";
}
