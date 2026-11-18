<?php
/* Punto de entrada: la web manda un POST con un JSON {accion: …, …} y recibe otro JSON. La lógica está en lib.php. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

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
