<?php
/* Europa Mítica · servidor de la web (PHP + MySQL).
   Hace lo mismo que hacía el Apps Script: guarda los datos de cada saga y responde a js/gate.js.
   Cada saga es un conjunto de «documentos» (ruta → JSON): personajes/…, avance/…, vis/…, tesoreria/…, retratos/… y saga/estado.
   Los JSON se guardan y se devuelven tal cual (sin decodificar siempre), para que un objeto vacío {} no se convierta en una lista []. */
declare(strict_types=1);

const VERSION = '2026-11-18';
const DIAS_SESION = 120;
const MAX_DOC = 2500000;   // un retrato reducido cabe de sobra
const RUTA_OK = '#^(personajes|avance|vis|tesoreria|retratos)/[A-Za-z0-9_.\-]{1,120}$|^saga/estado$#';
const JSON_OUT = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION;

/* ============================================================== utilidades */
class Fallo extends Exception {
    public string $codigo;
    public function __construct(string $codigo, string $mensaje) { parent::__construct($mensaje); $this->codigo = $codigo; }
}
/* una respuesta que ya es JSON */
class Crudo { public function __construct(public string $json) {} }

function ahora(): int { return (int) round(microtime(true) * 1000); }

function config(): array {
    static $c = null;
    if ($c === null) {
        $f = __DIR__ . '/config.php';
        if (!is_file($f)) throw new Fallo('config', 'Falta api/config.php: copia config.ejemplo.php y rellénalo.');
        $c = require $f;
    }
    return $c;
}

function driver(): string { return config()['driver'] ?? 'mysql'; }

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = config();
    $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
    if (driver() === 'sqlite') {
        $pdo = new PDO('sqlite:' . $c['file'], null, null, $opts);
        // sin WAL: el .sqlite es un único archivo completo, que es lo que se sube a git
        $pdo->exec('PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=20000;');
    } else {
        $opts[PDO::ATTR_EMULATE_PREPARES] = false;
        $pdo = new PDO('mysql:host=' . ($c['host'] ?? 'localhost') . ';dbname=' . $c['db'] . ';charset=utf8mb4', $c['user'], $c['pass'], $opts);
    }
    return $pdo;
}

function consulta(string $sql, array $args = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st;
}

/* varias escrituras como una sola: o entran todas o ninguna, y nadie más escribe mientras tanto */
function transaccion(callable $f) {
    $db = db();
    $sqlite = driver() === 'sqlite';
    if ($sqlite) $db->exec('BEGIN IMMEDIATE'); else $db->beginTransaction();
    try {
        $r = $f();
        if ($sqlite) $db->exec('COMMIT'); else $db->commit();
        return $r;
    } catch (Throwable $e) {
        try { if ($sqlite) $db->exec('ROLLBACK'); else $db->rollBack(); } catch (Throwable $x) { /* ya cerrada */ }
        throw $e;
    }
}

function crearTablas(): void {
    $mysql = driver() === 'mysql';
    $fin = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $bin = $mysql ? ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' : '';
    $db = db();
    $db->exec('CREATE TABLE IF NOT EXISTS sagas (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        alianza VARCHAR(80) NOT NULL DEFAULT \'\',
        anio INT NOT NULL, est INT NOT NULL, aura INT NOT NULL,
        hj VARCHAR(100) NOT NULL, hm VARCHAR(100) NOT NULL,
        gen INT NOT NULL DEFAULT 1,
        rev VARCHAR(20) NOT NULL DEFAULT \'1\',
        archivo_rev VARCHAR(20) NULL,
        creada BIGINT NOT NULL
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS docs (
        saga VARCHAR(40) NOT NULL,
        ruta VARCHAR(150)' . $bin . ' NOT NULL,
        actualizado BIGINT NOT NULL,
        datos LONGTEXT NOT NULL,
        PRIMARY KEY (saga, ruta)
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS archivos (saga VARCHAR(40) NOT NULL PRIMARY KEY, datos LONGTEXT NOT NULL)' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS ajustes (clave VARCHAR(40) NOT NULL PRIMARY KEY, valor TEXT NOT NULL)' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS fallos (clave VARCHAR(80) NOT NULL PRIMARY KEY, n INT NOT NULL, hasta BIGINT NOT NULL)' . $fin);
}

function ajuste(string $clave): ?string {
    $v = consulta('SELECT valor FROM ajustes WHERE clave = ?', [$clave])->fetchColumn();
    return $v === false ? null : (string) $v;
}
function ponerAjuste(string $clave, string $valor): void {
    consulta('REPLACE INTO ajustes (clave, valor) VALUES (?, ?)', [$clave, $valor]);
}

/* ============================================================== códigos, sesiones y freno de intentos */
function norm(string $codigo): string { return mb_strtolower(trim($codigo)); }
function hashCodigo(string $codigo): string { return password_hash(norm($codigo), PASSWORD_DEFAULT); }
function vale(string $codigo, string $hash): bool { return password_verify(norm($codigo), $hash); }

function validarCodigo(string $c, string $que): string {
    $c = trim($c);
    if (mb_strlen($c) < 6) throw new Fallo('codigo', "El código de $que debe tener al menos 6 caracteres.");
    return $c;
}

const PALABRAS = ['vis', 'aura', 'creo', 'rego', 'muto', 'perdo', 'ignem', 'aquam', 'auram', 'terram', 'herbam', 'animal',
    'corpus', 'mentem', 'vim', 'parma', 'aegis', 'regio', 'summa', 'grog', 'magus', 'sodalis', 'lumen', 'draco', 'verbum',
    'arcana', 'corona', 'silva', 'lupus', 'ursus', 'stella', 'nix', 'ventus', 'umbra', 'flamma', 'petra'];
function codigoNuevo(): string {
    $n = count(PALABRAS);
    return PALABRAS[random_int(0, $n - 1)] . '-' . PALABRAS[random_int(0, $n - 1)] . '-' . random_int(100, 999);
}

function secreto(): string {
    $s = ajuste('secreto');
    if ($s === null) { $s = bin2hex(random_bytes(32)); ponerAjuste('secreto', $s); }
    return $s;
}
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function deb64u(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/')); }
function firmar(string $t): string { return b64u(hash_hmac('sha256', $t, secreto(), true)); }

function token(array $saga, string $rol): string {
    $d = b64u(json_encode(['s' => $saga['id'], 'r' => $rol, 'g' => (int) $saga['gen'], 'e' => ahora() + DIAS_SESION * 86400000]));
    return $d . '.' . firmar($d);
}

/* devuelve [la fila de la saga, el rol] o falla */
function sesion($token, ?string $rolMinimo = null): array {
    $partes = explode('.', (string) $token);
    if (count($partes) !== 2 || !hash_equals(firmar($partes[0]), $partes[1])) throw new Fallo('sesion', 'La sesión no es válida. Vuelve a entrar.');
    $d = json_decode(deb64u($partes[0]), true);
    if (!is_array($d) || empty($d['e']) || $d['e'] < ahora()) throw new Fallo('sesion', 'La sesión ha caducado. Vuelve a entrar.');
    $saga = sagaPorId((string) ($d['s'] ?? ''));
    if (!$saga) throw new Fallo('sesion', 'Esa saga ya no existe.');
    if ((int) $saga['gen'] !== (int) ($d['g'] ?? 0)) throw new Fallo('sesion', 'Han cambiado los códigos de la saga. Vuelve a entrar con el nuevo.');
    if ($rolMinimo === 'master' && ($d['r'] ?? '') !== 'master') throw new Fallo('permiso', 'Solo el máster puede hacer esto.');
    return [$saga, ($d['r'] ?? '') === 'master' ? 'master' : 'jugador'];
}

/* devuelve un cierre: llamarlo anota un intento fallido (y frena un poco al que adivina) */
function freno(string $clave): callable {
    $f = consulta('SELECT n, hasta FROM fallos WHERE clave = ?', [$clave])->fetch();
    $n = ($f && (int) $f['hasta'] > ahora()) ? (int) $f['n'] : 0;
    if ($n >= 25) throw new Fallo('freno', 'Demasiados intentos fallidos. Espera un cuarto de hora.');
    return function () use ($clave, $n) {
        consulta('REPLACE INTO fallos (clave, n, hasta) VALUES (?, ?, ?)', [$clave, $n + 1, ahora() + 900000]);
        usleep(600000);
    };
}

/* ============================================================== sagas */
function sagaPorId(string $id): ?array {
    $s = consulta('SELECT * FROM sagas WHERE id = ?', [$id])->fetch();
    return $s ?: null;
}

function publica(array $s): array {
    return ['id' => $s['id'], 'nombre' => $s['nombre'], 'alianza' => $s['alianza'], 'anio' => (int) $s['anio'],
        'est' => (int) $s['est'], 'aura' => (int) $s['aura'], 'archivo' => $s['archivo_rev'] ?: null];
}

function listaSagas(): array {
    $l = consulta('SELECT id, nombre FROM sagas')->fetchAll();
    usort($l, fn($a, $b) => strcmp(mb_strtolower($a['nombre']), mb_strtolower($b['nombre'])));
    return $l;
}

function idDe(string $nombre): string {
    $b = strtr(mb_strtolower($nombre), ['á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
        'ñ' => 'n', 'ç' => 'c']);
    $b = preg_replace('/^saga\s+(del?\s+)?/', '', $b);
    $b = trim((string) preg_replace('/[^a-z0-9]+/', '-', $b), '-');
    $b = substr($b, 0, 30) ?: 'saga';
    $id = $b; $n = 2;
    while (sagaPorId($id)) $id = $b . '-' . $n++;
    return $id;
}

/* crea la saga y su estado inicial; la usan «crear» y las herramientas de línea de órdenes */
function nuevaSaga(string $nombre, string $alianza, int $anio, int $est, int $aura, string $cj, string $cm): array {
    return transaccion(function () use ($nombre, $alianza, $anio, $est, $aura, $cj, $cm) {
        $id = idDe($nombre);
        consulta('INSERT INTO sagas (id, nombre, alianza, anio, est, aura, hj, hm, gen, rev, creada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
            [$id, $nombre, $alianza, $anio, $est, $aura, hashCodigo($cj), hashCodigo($cm), (string) ahora(), ahora()]);
        guardarDoc($id, 'saga/estado', json_encode(['anio' => $anio, 'est' => $est, 'aura' => $aura, 'actualizado' => ahora()], JSON_OUT), ahora());
        return sagaPorId($id);
    });
}

function guardarDoc(string $saga, string $ruta, string $json, int $t): void {
    if (strlen($json) > MAX_DOC) throw new Fallo('grande', 'Ese documento es demasiado grande para guardarlo.');
    consulta('REPLACE INTO docs (saga, ruta, actualizado, datos) VALUES (?, ?, ?, ?)', [$saga, $ruta, $t, $json]);
}

/* sube la revisión de la saga: los navegadores la comparan para saber si hay algo nuevo */
function subirRev(string $id): string {
    $v = (string) max(ahora(), (int) consulta('SELECT rev FROM sagas WHERE id = ?', [$id])->fetchColumn() + 1);
    consulta('UPDATE sagas SET rev = ? WHERE id = ?', [$v, $id]);
    return $v;
}

/* bloquea la fila de la saga hasta el final de la transacción (en SQLite ya lo hace BEGIN IMMEDIATE) */
function bloquear(string $id): void {
    if (driver() === 'mysql') consulta('SELECT id FROM sagas WHERE id = ? FOR UPDATE', [$id]);
}

/* ============================================================== acciones */
function entrar(array $p): array {
    $saga = sagaPorId((string) ($p['saga'] ?? ''));
    if (!$saga) throw new Fallo('saga', 'No encuentro esa saga.');
    $rol = ($p['rol'] ?? '') === 'master' ? 'master' : 'jugador';
    $anotar = freno('saga:' . $saga['id']);
    $codigo = (string) ($p['codigo'] ?? '');
    $ok = $rol === 'master' ? vale($codigo, $saga['hm']) : (vale($codigo, $saga['hj']) || vale($codigo, $saga['hm']));
    if (!$ok) {
        $anotar();
        throw new Fallo('codigo', $rol === 'master' ? 'Ese no es el código de máster de esta saga.' : 'Ese no es el código de jugador de esta saga.');
    }
    return ['token' => token($saga, $rol), 'rol' => $rol, 'saga' => publica($saga)];
}

function crear(array $p): array {
    $anotar = freno('crear');
    $h = ajuste('crear');
    if (!$h || !vale((string) ($p['codigoCrear'] ?? ''), $h)) { $anotar(); throw new Fallo('codigo', 'Ese no es el código para crear sagas.'); }
    $nombre = trim((string) preg_replace('/\s+/', ' ', (string) ($p['nombre'] ?? '')));
    if (mb_strlen($nombre) < 3) throw new Fallo('nombre', 'Ponle un nombre a la saga.');
    $nombre = mb_substr($nombre, 0, 80);
    $cj = validarCodigo((string) (($p['codigoJugador'] ?? '') ?: codigoNuevo()), 'jugador');
    $cm = validarCodigo((string) (($p['codigoMaster'] ?? '') ?: codigoNuevo()), 'máster');
    if (norm($cj) === norm($cm)) throw new Fallo('codigo', 'Los dos códigos tienen que ser distintos.');
    foreach (listaSagas() as $s) if (mb_strtolower($s['nombre']) === mb_strtolower($nombre)) throw new Fallo('nombre', 'Ya hay una saga con ese nombre.');
    $alianza = mb_substr(trim((string) ($p['alianza'] ?? '')), 0, 60);
    $anio = (int) ($p['anio'] ?? 0) ?: 1220;
    $est = min(4, max(1, (int) ($p['est'] ?? 0) ?: 1));
    $saga = nuevaSaga($nombre, $alianza, $anio, $est, (int) ($p['aura'] ?? 0), $cj, $cm);
    return ['saga' => publica($saga), 'codigos' => ['jugador' => $cj, 'master' => $cm], 'token' => token($saga, 'master'), 'avisos' => []];
}

function cambiarCodigos(array $saga, array $p): array {
    $cj = !empty($p['jugador']) ? validarCodigo((string) $p['jugador'], 'jugador') : null;
    $cm = !empty($p['master']) ? validarCodigo((string) $p['master'], 'máster') : null;
    if ($cj && $cm && norm($cj) === norm($cm)) throw new Fallo('codigo', 'Los dos códigos tienen que ser distintos.');
    return transaccion(function () use ($saga, $cj, $cm) {
        bloquear($saga['id']);
        if ($cj) consulta('UPDATE sagas SET hj = ? WHERE id = ?', [hashCodigo($cj), $saga['id']]);
        if ($cm) consulta('UPDATE sagas SET hm = ? WHERE id = ?', [hashCodigo($cm), $saga['id']]);
        consulta('UPDATE sagas SET gen = gen + 1 WHERE id = ?', [$saga['id']]);
        return ['ok' => true, 'token' => token(sagaPorId($saga['id']), 'master')];
    });
}

/* leer: si el navegador ya tiene esta revisión, no se manda nada; si no, los documentos cambiados desde «desde» y la lista de rutas */
function leer(array $saga, array $p): Crudo {
    $rev = $saga['rev'];
    if (!empty($p['rev']) && (string) $p['rev'] === $rev) return new Crudo(json_encode(['rev' => $rev, 'igual' => true]));
    $t = ahora();
    $desde = (int) ($p['desde'] ?? 0);
    $trozos = [];
    $rutas = null;
    if ($desde) {
        $rutas = array_column(consulta('SELECT ruta FROM docs WHERE saga = ?', [$saga['id']])->fetchAll(), 'ruta');
        $st = consulta('SELECT ruta, datos FROM docs WHERE saga = ? AND actualizado >= ?', [$saga['id'], $desde - 120000]);
    } else {
        $st = consulta('SELECT ruta, datos FROM docs WHERE saga = ?', [$saga['id']]);
    }
    foreach ($st as $f) $trozos[] = json_encode($f['ruta'], JSON_OUT) . ':' . $f['datos'];
    return new Crudo('{"rev":' . json_encode($rev) . ',"ahora":' . $t . ',"docs":{' . implode(',', $trozos) . '},"rutas":'
        . ($rutas === null ? 'null' : json_encode($rutas, JSON_OUT)) . '}');
}

/* ops: [{op: set|update|delete, ruta, datos}], todas o ninguna */
function escribir(array $saga, $ops): array {
    if (!is_array($ops) || !$ops) throw new Fallo('peticion', 'No hay nada que guardar.');
    if (count($ops) > 300) throw new Fallo('peticion', 'Demasiados cambios a la vez.');
    foreach ($ops as $op) {
        $ruta = (string) ($op->ruta ?? '');
        if (!preg_match(RUTA_OK, $ruta)) throw new Fallo('ruta', 'Ruta no permitida: ' . $ruta);
        if (($op->op ?? '') !== 'delete' && !(($op->datos ?? null) instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos en ' . $ruta);
    }
    $t = ahora();
    return transaccion(function () use ($saga, $ops, $t) {
        bloquear($saga['id']);
        foreach ($ops as $op) {
            $ruta = (string) $op->ruta;
            $que = $op->op ?? 'set';
            if ($que === 'delete') { consulta('DELETE FROM docs WHERE saga = ? AND ruta = ?', [$saga['id'], $ruta]); continue; }
            $datos = $op->datos;
            if ($que === 'update') {
                $actual = consulta('SELECT datos FROM docs WHERE saga = ? AND ruta = ?', [$saga['id'], $ruta])->fetchColumn();
                if ($actual === false) throw new Fallo('no_encontrado', 'No existe ' . $ruta);
                $nuevo = json_decode($actual);
                foreach ($datos as $k => $v) $nuevo->$k = $v;
                $datos = $nuevo;
            }
            guardarDoc($saga['id'], $ruta, json_encode($datos, JSON_OUT), $t);
        }
        return ['ok' => true, 'rev' => subirRev($saga['id']), 't' => $t];
    });
}

function archivo(array $saga): Crudo {
    $a = consulta('SELECT datos FROM archivos WHERE saga = ?', [$saga['id']])->fetchColumn();
    if ($a === false) return new Crudo('{"archivo":null}');
    return new Crudo('{"rev":' . json_encode($saga['archivo_rev']) . ',"archivo":' . $a . '}');
}

function exportar(array $saga): Crudo {
    $trozos = [];
    foreach (consulta('SELECT ruta, datos FROM docs WHERE saga = ?', [$saga['id']]) as $f) $trozos[] = json_encode($f['ruta'], JSON_OUT) . ':' . $f['datos'];
    $info = ['nombre' => $saga['nombre'], 'alianza' => $saga['alianza'], 'anio' => (int) $saga['anio'], 'est' => (int) $saga['est'], 'aura' => (int) $saga['aura']];
    return new Crudo('{"formato":"europa-mitica/1","saga":' . json_encode($info, JSON_OUT) . ',"fecha":' . ahora() . ',"docs":{' . implode(',', $trozos) . '}}');
}

/* importar: «reemplazar» vacía antes la saga; si no, junta lo importado con lo que hay */
function importar(array $saga, array $p): array {
    $docs = $p['docs'] ?? new stdClass();
    if (!($docs instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos.');
    foreach ($docs as $ruta => $d) {
        if (!preg_match(RUTA_OK, (string) $ruta)) throw new Fallo('ruta', 'Ruta no permitida: ' . $ruta);
        if (!($d instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos en ' . $ruta);
    }
    return transaccion(function () use ($saga, $docs, $p) {
        bloquear($saga['id']);
        if (!empty($p['reemplazar'])) consulta('DELETE FROM docs WHERE saga = ?', [$saga['id']]);
        $t = ahora(); $n = 0;
        foreach ($docs as $ruta => $d) { guardarDoc($saga['id'], (string) $ruta, json_encode($d, JSON_OUT), $t); $n++; }
        if (!empty($p['archivo'])) {
            consulta('REPLACE INTO archivos (saga, datos) VALUES (?, ?)', [$saga['id'], json_encode($p['archivo'], JSON_OUT)]);
            consulta('UPDATE sagas SET archivo_rev = ? WHERE id = ?', [(string) ahora(), $saga['id']]);
        }
        return ['ok' => true, 'n' => $n, 'rev' => subirRev($saga['id'])];
    });
}

/* $p: lo que manda la web; los valores sueltos son texto, número o lista, y los objetos son stdClass (así {} sigue siendo {}) */
function atender(array $p) {
    try {
        switch ($p['accion'] ?? '') {
            case 'sagas': return ['sagas' => listaSagas()];
            case 'entrar': return entrar($p);
            case 'crear': return crear($p);
            case 'leer': [$s] = sesion($p['token'] ?? ''); return leer($s, $p);
            case 'escribir': [$s] = sesion($p['token'] ?? ''); return escribir($s, $p['ops'] ?? null);
            case 'archivo': [$s] = sesion($p['token'] ?? ''); return archivo($s);
            case 'exportar': [$s] = sesion($p['token'] ?? '', 'master'); return exportar($s);
            case 'importar': [$s] = sesion($p['token'] ?? '', 'master'); return importar($s, $p);
            case 'codigos': [$s] = sesion($p['token'] ?? '', 'master'); return cambiarCodigos($s, $p);
            case 'info': [$s, $rol] = sesion($p['token'] ?? ''); return ['saga' => publica($s), 'rol' => $rol];
            default: return ['error' => 'accion', 'mensaje' => 'Acción desconocida.'];
        }
    } catch (Fallo $e) {
        return ['error' => $e->codigo, 'mensaje' => $e->getMessage()];
    } catch (Throwable $e) {
        error_log('Europa Mítica: ' . $e);
        return ['error' => 'interno', 'mensaje' => 'Error del servidor.'];
    }
}
