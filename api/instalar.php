<?php
/* Prepara la base de datos (crea las tablas o las pone al día). Se ejecuta desde la línea de órdenes:
     php api/instalar.php
   Se puede volver a ejecutar sin riesgo: no borra nada. La web también lo hace sola en la primera petición.
   Las cuentas se gestionan con api/usuarios.php. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

crearTablas();
echo "Tablas listas (esquema " . ESQUEMA . ").\n";
echo "La primera cuenta que se registre en la web podrá crear sagas. Para dar a alguien el control de una saga ya existente:\n";
echo "  php api/usuarios.php master <usuario> <saga>\n";
