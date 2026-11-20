<?php
/* Punto de entrada: la web manda un POST con un JSON {accion: …, …} y recibe otro JSON. La lógica está en lib.php. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// PHP sin las extensiones necesarias (típico de PHP en Windows sin php.ini): decirlo claro en vez de un error 500
$faltan = array_filter(['mbstring', 'openssl', 'pdo_' . (driver() === 'sqlite' ? 'sqlite' : 'mysql')], fn($e) => !extension_loaded($e));
if ($faltan) {
    echo json_encode(['error' => 'config', 'mensaje' => 'Al PHP del servidor le faltan extensiones: ' . implode(', ', $faltan) . '. En local, arranca la web con servir.bat (README, «Probarla en local»).']);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    echo json_encode(['ok' => true, 'servicio' => 'Europa Mítica', 'version' => VERSION]);
    exit;
}

$cuerpo = json_decode((string) file_get_contents('php://input'));   // sin «true»: los objetos llegan como stdClass
if (!($cuerpo instanceof stdClass)) {
    echo json_encode(['error' => 'peticion', 'mensaje' => 'Petición mal formada.']);
    exit;
}

$r = atender((array) $cuerpo);
echo $r instanceof Crudo ? $r->json : json_encode($r, JSON_OUT);
