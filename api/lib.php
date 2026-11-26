<?php
/* Europa Mítica · servidor de la web (PHP + MySQL/SQLite).
   Cuentas de usuario (contraseña, perfil, avatar), pertenencia a sagas (máster o jugador) y los datos de cada saga.
   Cada saga es un conjunto de «documentos» (ruta → JSON): personajes/…, avance/…, vis/…, tesoreria/…, retratos/…, virtudes/…, textos/…, armeria/…, cronica/…, alianzas/…, laboratorios/… y saga/estado.
   Los JSON se guardan y se devuelven tal cual (sin decodificar siempre), para que un objeto vacío {} no se convierta en una lista []. */
declare(strict_types=1);

const VERSION = '2026-11-19';
const ESQUEMA = '3';
const DIAS_SESION = 120;
const MAX_DOC = 2500000;        // un retrato reducido cabe de sobra
const MAX_AVATAR = 200000;      // caracteres del avatar (la web lo reduce a 256 px)
const RUTA_OK = '#^(personajes|avance|vis|tesoreria|retratos|virtudes|textos|armeria|cronica|alianzas|laboratorios)/[A-Za-z0-9_.\-]{1,120}$|^saga/estado$#';
const JSON_OUT = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION;

/* ============================================================== utilidades */
class Fallo extends Exception {
    public string $codigo;
    public function __construct(string $codigo, string $mensaje) { parent::__construct($mensaje); $this->codigo = $codigo; }
}
/* una respuesta que ya es JSON */
class Crudo { public function __construct(public string $json) {} }

function ahora(): int { return (int) round(microtime(true) * 1000); }
function ip(): string { return (string) ($_SERVER['REMOTE_ADDR'] ?? 'cli'); }

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
        $nuevo = new PDO('sqlite:' . $c['file'], null, null, $opts);
        // sin WAL: el .sqlite es un único archivo completo, que es lo que se sube a git
        $nuevo->exec('PRAGMA journal_mode=DELETE; PRAGMA busy_timeout=20000;');
    } else {
        $opts[PDO::ATTR_EMULATE_PREPARES] = false;
        $nuevo = new PDO('mysql:host=' . ($c['host'] ?? 'localhost') . ';dbname=' . $c['db'] . ';charset=utf8mb4', $c['user'], $c['pass'], $opts);
    }
    $pdo = $nuevo;
    asegurarEsquema();
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

/* ============================================================== esquema */
function tieneColumna(string $tabla, string $col): bool {
    if (driver() === 'sqlite') {
        foreach (db()->query("PRAGMA table_info($tabla)") as $c) if ($c['name'] === $col) return true;
        return false;
    }
    return (bool) db()->query("SHOW COLUMNS FROM $tabla LIKE '$col'")->fetch();
}

function crearTablas(): void {
    $mysql = driver() === 'mysql';
    $fin = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';
    $bin = $mysql ? ' CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' : '';
    $db = db();
    $db->exec('CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(20) NOT NULL PRIMARY KEY,
        usuario VARCHAR(30) NOT NULL,
        nombre VARCHAR(60) NOT NULL,
        email VARCHAR(120) NOT NULL,
        hash VARCHAR(100) NOT NULL,
        avatar MEDIUMTEXT NULL,
        crea_sagas INT NOT NULL DEFAULT 0,
        admin INT NOT NULL DEFAULT 0,
        gen INT NOT NULL DEFAULT 1,
        creado BIGINT NOT NULL,
        UNIQUE (usuario),
        UNIQUE (email)
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS sagas (
        id VARCHAR(40) NOT NULL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        alianza VARCHAR(80) NOT NULL DEFAULT \'\',
        anio INT NOT NULL, est INT NOT NULL, aura INT NOT NULL,
        rev VARCHAR(20) NOT NULL DEFAULT \'1\',
        archivo_rev VARCHAR(20) NULL,
        creada BIGINT NOT NULL
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS miembros (
        saga VARCHAR(40) NOT NULL,
        usuario VARCHAR(20) NOT NULL,
        rol VARCHAR(10) NOT NULL,
        desde BIGINT NOT NULL,
        PRIMARY KEY (saga, usuario)
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS docs (
        saga VARCHAR(40) NOT NULL,
        ruta VARCHAR(150)' . $bin . ' NOT NULL,
        actualizado BIGINT NOT NULL,
        autor VARCHAR(20) NULL,
        datos LONGTEXT NOT NULL,
        PRIMARY KEY (saga, ruta)
    )' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS archivos (saga VARCHAR(40) NOT NULL PRIMARY KEY, datos LONGTEXT NOT NULL)' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS recuperaciones (hash VARCHAR(64) NOT NULL PRIMARY KEY, usuario VARCHAR(20) NOT NULL, expira BIGINT NOT NULL)' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS ajustes (clave VARCHAR(40) NOT NULL PRIMARY KEY, valor TEXT NOT NULL)' . $fin);
    $db->exec('CREATE TABLE IF NOT EXISTS fallos (clave VARCHAR(80) NOT NULL PRIMARY KEY, n INT NOT NULL, hasta BIGINT NOT NULL)' . $fin);
    // de la versión con códigos de saga a la de cuentas
    if (!tieneColumna('docs', 'autor')) $db->exec('ALTER TABLE docs ADD COLUMN autor VARCHAR(20) NULL');
    if (!tieneColumna('usuarios', 'admin')) $db->exec('ALTER TABLE usuarios ADD COLUMN admin INT NOT NULL DEFAULT 0');
    foreach (['hj', 'hm', 'gen'] as $col) if (tieneColumna('sagas', $col)) $db->exec("ALTER TABLE sagas DROP COLUMN $col");
    $db->exec("DELETE FROM ajustes WHERE clave = 'crear'");
    ponerAjuste('esquema', ESQUEMA);
}

function asegurarEsquema(): void {
    try { $v = consulta("SELECT valor FROM ajustes WHERE clave = 'esquema'")->fetchColumn(); } catch (Throwable $e) { $v = false; }
    if ($v !== ESQUEMA) crearTablas();
}

function ajuste(string $clave): ?string {
    $v = consulta('SELECT valor FROM ajustes WHERE clave = ?', [$clave])->fetchColumn();
    return $v === false ? null : (string) $v;
}
function ponerAjuste(string $clave, string $valor): void {
    consulta('REPLACE INTO ajustes (clave, valor) VALUES (?, ?)', [$clave, $valor]);
}

/* ============================================================== sesiones y freno de intentos */
function secreto(): string {
    $s = ajuste('secreto');
    if ($s === null) { $s = bin2hex(random_bytes(32)); ponerAjuste('secreto', $s); }
    return $s;
}
function b64u(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function deb64u(string $s): string { return (string) base64_decode(strtr($s, '-_', '+/')); }
function firmar(string $t): string { return b64u(hash_hmac('sha256', $t, secreto(), true)); }

function token(array $u): string {
    $d = b64u(json_encode(['u' => $u['id'], 'g' => (int) $u['gen'], 'e' => ahora() + DIAS_SESION * 86400000]));
    return $d . '.' . firmar($d);
}

/* la cuenta de esa sesión, o falla */
function sesion($token): array {
    $partes = explode('.', (string) $token);
    if (count($partes) !== 2 || !hash_equals(firmar($partes[0]), $partes[1])) throw new Fallo('sesion', 'La sesión no es válida. Vuelve a entrar.');
    $d = json_decode(deb64u($partes[0]), true);
    if (!is_array($d) || empty($d['e']) || $d['e'] < ahora()) throw new Fallo('sesion', 'La sesión ha caducado. Vuelve a entrar.');
    $u = usuarioPorId((string) ($d['u'] ?? ''));
    if (!$u || (int) $u['gen'] !== (int) ($d['g'] ?? 0)) throw new Fallo('sesion', 'La sesión ha caducado. Vuelve a entrar.');
    return $u;
}

/* devuelve un cierre: llamarlo anota un intento (y, si $frenar, hace esperar un poco al que adivina) */
function freno(string $clave, int $max = 25, int $ventana = 900000, bool $frenar = true): callable {
    $f = consulta('SELECT n, hasta FROM fallos WHERE clave = ?', [$clave])->fetch();
    $n = ($f && (int) $f['hasta'] > ahora()) ? (int) $f['n'] : 0;
    if ($n >= $max) throw new Fallo('freno', 'Demasiados intentos. Espera un rato y vuelve a probar.');
    return function () use ($clave, $n, $ventana, $frenar) {
        consulta('REPLACE INTO fallos (clave, n, hasta) VALUES (?, ?, ?)', [$clave, $n + 1, ahora() + $ventana]);
        if ($frenar) usleep(600000);
    };
}

/* ============================================================== cuentas */
function usuarioPorId(string $id): ?array {
    $u = consulta('SELECT * FROM usuarios WHERE id = ?', [$id])->fetch();
    return $u ?: null;
}
function usuarioPorNombre(string $nombre): ?array {
    $u = consulta('SELECT * FROM usuarios WHERE usuario = ?', [mb_strtolower(trim($nombre))])->fetch();
    return $u ?: null;
}
function usuarioPorEmail(string $email): ?array {
    $u = consulta('SELECT * FROM usuarios WHERE email = ?', [mb_strtolower(trim($email))])->fetch();
    return $u ?: null;
}

function validarUsuario(string $s): string {
    $s = mb_strtolower(trim($s));
    if (!preg_match('/^[a-z0-9][a-z0-9_.\-]{2,29}$/', $s)) throw new Fallo('usuario', 'El usuario debe tener de 3 a 30 caracteres: letras sin tilde, números, punto, guion o guion bajo.');
    return $s;
}
function validarEmail(string $s): string {
    $s = mb_strtolower(trim($s));
    if (mb_strlen($s) > 120 || !filter_var($s, FILTER_VALIDATE_EMAIL)) throw new Fallo('email', 'Ese correo no parece válido.');
    return $s;
}
function validarNombre(string $s): string {
    $s = trim((string) preg_replace('/\s+/', ' ', $s));
    if (mb_strlen($s) < 1 || mb_strlen($s) > 60) throw new Fallo('nombre', 'El nombre debe tener de 1 a 60 caracteres.');
    return $s;
}
function validarPassword(string $s): string {
    if (mb_strlen($s) < 8) throw new Fallo('password', 'La contraseña debe tener al menos 8 caracteres.');
    if (strlen($s) > 200) throw new Fallo('password', 'La contraseña es demasiado larga.');
    return $s;
}

/* data:image/…;base64,… de un tamaño razonable, y que de verdad sea esa imagen (un SVG podría llevar scripts: no se admite) */
function validarAvatar(string $s): string {
    if (strlen($s) > MAX_AVATAR || !preg_match('#^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$#', $s, $m)) throw new Fallo('avatar', 'La imagen no es válida o es demasiado grande.');
    $info = @getimagesizefromstring((string) base64_decode($m[2], true));
    if (!$info || $info['mime'] !== 'image/' . $m[1] || $info[0] > 1024 || $info[1] > 1024) throw new Fallo('avatar', 'La imagen no es válida o es demasiado grande.');
    return $s;
}

function nuevoId(string $prefijo): string {
    $a = 'abcdefghijklmnopqrstuvwxyz0123456789'; $s = $prefijo;
    for ($i = 0; $i < 12; $i++) $s .= $a[random_int(0, 35)];
    return $s;
}

function registrar(array $p): array {
    $anotar = freno('registro:' . ip(), 20, 3600000, false);
    $usuario = validarUsuario((string) ($p['usuario'] ?? ''));
    $nombre = validarNombre((string) (($p['nombre'] ?? '') ?: $usuario));
    $email = validarEmail((string) ($p['email'] ?? ''));
    $pass = validarPassword((string) ($p['password'] ?? ''));
    $u = transaccion(function () use ($usuario, $nombre, $email, $pass) {
        if (usuarioPorNombre($usuario)) throw new Fallo('usuario', 'Ese usuario ya existe.');
        if (usuarioPorEmail($email)) throw new Fallo('email', 'Ese correo ya tiene una cuenta.');
        $primero = (int) consulta('SELECT COUNT(*) FROM usuarios')->fetchColumn() === 0;   // quien abre la web puede crear sagas
        $id = nuevoId('u');
        consulta('INSERT INTO usuarios (id, usuario, nombre, email, hash, crea_sagas, gen, creado) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
            [$id, $usuario, $nombre, $email, password_hash($pass, PASSWORD_DEFAULT), $primero ? 1 : 0, ahora()]);
        return usuarioPorId($id);
    });
    $anotar();
    return ['token' => token($u), 'perfil' => perfil($u)];
}

function entrar(array $p): array {
    $id = mb_strtolower(trim((string) ($p['usuario'] ?? '')));
    $anotarIp = freno('ip:' . ip(), 100);
    $anotarUsuario = freno('login:' . $id);
    $u = str_contains($id, '@') ? usuarioPorEmail($id) : usuarioPorNombre($id);
    // con o sin cuenta se calcula un hash: así no se nota por el tiempo si el usuario existe
    static $falso = null;
    $ok = password_verify((string) ($p['password'] ?? ''), $u ? $u['hash'] : ($falso ??= password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT)));
    if (!$u || !$ok) { $anotarIp(); $anotarUsuario(); throw new Fallo('login', 'Usuario o contraseña incorrectos.'); }
    return ['token' => token($u), 'perfil' => perfil($u)];
}

function sagasDe(string $uid, bool $admin = false): array {
    // un administrador ve todas las sagas, con el rol de máster (o el suyo, si es más alto: no lo hay)
    $l = $admin ? consulta("SELECT id, nombre, alianza, 'master' AS rol FROM sagas")->fetchAll()
        : consulta('SELECT s.id, s.nombre, s.alianza, m.rol FROM miembros m JOIN sagas s ON s.id = m.saga WHERE m.usuario = ?', [$uid])->fetchAll();
    usort($l, fn($a, $b) => strcmp(mb_strtolower($a['nombre']), mb_strtolower($b['nombre'])));
    return $l;
}

function perfil(array $u): array {
    return ['id' => $u['id'], 'usuario' => $u['usuario'], 'nombre' => $u['nombre'], 'email' => $u['email'], 'avatar' => $u['avatar'] ?: null,
        'creaSagas' => (bool) $u['crea_sagas'] || (bool) $u['admin'], 'admin' => (bool) $u['admin'], 'sagas' => sagasDe($u['id'], (bool) $u['admin'])];
}

function actualizarPerfil(array $u, array $p): array {
    if (array_key_exists('nombre', $p)) consulta('UPDATE usuarios SET nombre = ? WHERE id = ?', [validarNombre((string) $p['nombre']), $u['id']]);
    if (array_key_exists('email', $p)) {
        $e = validarEmail((string) $p['email']);
        $otro = usuarioPorEmail($e);
        if ($otro && $otro['id'] !== $u['id']) throw new Fallo('email', 'Ese correo ya tiene una cuenta.');
        consulta('UPDATE usuarios SET email = ? WHERE id = ?', [$e, $u['id']]);
    }
    if (array_key_exists('avatar', $p)) {
        $a = (string) $p['avatar'];
        consulta('UPDATE usuarios SET avatar = ? WHERE id = ?', [$a === '' ? null : validarAvatar($a), $u['id']]);
    }
    return ['perfil' => perfil(usuarioPorId($u['id']))];
}

/* cambiar la contraseña (o cerrar todas las sesiones) invalida los tokens de los demás dispositivos; este recibe uno nuevo */
function cambiarPassword(array $u, array $p): array {
    $anotar = freno('pass:' . $u['id']);
    if (!password_verify((string) ($p['actual'] ?? ''), $u['hash'])) { $anotar(); throw new Fallo('login', 'La contraseña actual no es correcta.'); }
    $nueva = validarPassword((string) ($p['nueva'] ?? ''));
    consulta('UPDATE usuarios SET hash = ?, gen = gen + 1 WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
    return ['ok' => true, 'token' => token(usuarioPorId($u['id']))];
}
function cerrarSesiones(array $u): array {
    consulta('UPDATE usuarios SET gen = gen + 1 WHERE id = ?', [$u['id']]);
    return ['ok' => true, 'token' => token(usuarioPorId($u['id']))];
}

/* ---------- recuperar la contraseña por correo */
function enviarCorreo(string $a, string $asunto, string $texto): void {
    $c = config()['correo'] ?? [];
    if (($c['modo'] ?? 'mail') === 'archivo') {
        file_put_contents($c['archivo'] ?? (__DIR__ . '/../datos/correo.log'), "=== " . date('c') . " · para $a · $asunto\n$texto\n\n", FILE_APPEND);
        return;
    }
    $desde = $c['desde'] ?? ('no-responder@' . preg_replace('/^www\./', '', (string) ($_SERVER['HTTP_HOST'] ?? 'localhost')));
    $cab = "From: Europa Mítica <$desde>\r\nContent-Type: text/plain; charset=UTF-8\r\nMIME-Version: 1.0";
    if (!@mail($a, mb_encode_mimeheader($asunto, 'UTF-8'), $texto, $cab)) error_log("Europa Mítica: no se pudo enviar el correo a $a");
}

function urlBase(): string {
    $c = config();
    if (!empty($c['url'])) return rtrim((string) $c['url'], '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $dir = rtrim(str_replace('\\', '/', dirname(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/api.php')))), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}

function recuperar(array $p): array {
    $anotarIp = freno('recuperar:' . ip(), 10, 3600000, false);
    $email = mb_strtolower(trim((string) ($p['email'] ?? '')));
    $anotarIp();
    $u = filter_var($email, FILTER_VALIDATE_EMAIL) ? usuarioPorEmail($email) : null;
    if ($u) {
        $codigo = bin2hex(random_bytes(32));
        consulta('DELETE FROM recuperaciones WHERE usuario = ?', [$u['id']]);
        consulta('INSERT INTO recuperaciones (hash, usuario, expira) VALUES (?, ?, ?)', [hash('sha256', $codigo), $u['id'], ahora() + 3600000]);
        enviarCorreo($u['email'], 'Recuperar tu contraseña de Europa Mítica',
            "Hola, {$u['nombre']}:\n\nHas pedido cambiar la contraseña de tu cuenta ({$u['usuario']}). Abre este enlace en la próxima hora:\n\n"
            . urlBase() . "/#recuperar=$codigo\n\nSi no has sido tú, ignora este mensaje: tu contraseña no cambia.\n");
    }
    return ['ok' => true];   // la misma respuesta con o sin cuenta
}

function restablecer(array $p): array {
    $anotar = freno('restablecer:' . ip(), 20);
    $r = consulta('SELECT usuario, expira FROM recuperaciones WHERE hash = ?', [hash('sha256', (string) ($p['codigo'] ?? ''))])->fetch();
    if (!$r || (int) $r['expira'] < ahora()) { $anotar(); throw new Fallo('codigo', 'Ese enlace ya no vale. Pide otro.'); }
    $nueva = validarPassword((string) ($p['password'] ?? ''));
    consulta('UPDATE usuarios SET hash = ?, gen = gen + 1 WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $r['usuario']]);
    consulta('DELETE FROM recuperaciones WHERE usuario = ?', [$r['usuario']]);
    return ['ok' => true];
}

/* ============================================================== sagas y miembros */
function sagaPorId(string $id): ?array {
    $s = consulta('SELECT * FROM sagas WHERE id = ?', [$id])->fetch();
    return $s ?: null;
}

function rolEn(string $saga, string $uid): ?string {
    $r = consulta('SELECT rol FROM miembros WHERE saga = ? AND usuario = ?', [$saga, $uid])->fetchColumn();
    return $r === false ? null : (string) $r;
}

/* [la saga, el rol de esta cuenta en ella, la cuenta] o falla */
function acceso(array $p, ?string $rolMinimo = null): array {
    $u = sesion($p['token'] ?? '');
    $saga = sagaPorId((string) ($p['saga'] ?? ''));
    $rol = $saga ? rolEn($saga['id'], $u['id']) : null;
    if ($saga && !$rol && $u['admin']) $rol = 'master';   // el administrador entra en cualquier saga como máster
    if (!$saga || !$rol) throw new Fallo('saga', 'No tienes acceso a esa saga.');
    if ($rolMinimo === 'master' && $rol !== 'master') throw new Fallo('permiso', 'Solo el máster puede hacer esto.');
    return [$saga, $rol, $u];
}

function publica(array $s): array {
    return ['id' => $s['id'], 'nombre' => $s['nombre'], 'alianza' => $s['alianza'], 'anio' => (int) $s['anio'],
        'est' => (int) $s['est'], 'aura' => (int) $s['aura'], 'archivo' => $s['archivo_rev'] ?: null];
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

/* crea la saga con su estado inicial y su primer máster; la usan «crear» y las herramientas de línea de órdenes */
function nuevaSaga(string $nombre, string $alianza, int $anio, int $est, int $aura, string $masterId): array {
    return transaccion(function () use ($nombre, $alianza, $anio, $est, $aura, $masterId) {
        $id = idDe($nombre);
        consulta('INSERT INTO sagas (id, nombre, alianza, anio, est, aura, rev, creada) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $nombre, $alianza, $anio, $est, $aura, (string) ahora(), ahora()]);
        consulta('INSERT INTO miembros (saga, usuario, rol, desde) VALUES (?, ?, \'master\', ?)', [$id, $masterId, ahora()]);
        guardarDoc($id, 'saga/estado', json_encode(['anio' => $anio, 'est' => $est, 'aura' => $aura, 'actualizado' => ahora()], JSON_OUT), ahora(), $masterId);
        return sagaPorId($id);
    });
}

function crear(array $u, array $p): array {
    if (!$u['crea_sagas'] && !$u['admin']) throw new Fallo('permiso', 'Tu cuenta no puede crear sagas. Pídeselo a quien administra la web.');
    $nombre = trim((string) preg_replace('/\s+/', ' ', (string) ($p['nombre'] ?? '')));
    if (mb_strlen($nombre) < 3) throw new Fallo('nombre', 'Ponle un nombre a la saga.');
    $nombre = mb_substr($nombre, 0, 80);
    foreach (consulta('SELECT nombre FROM sagas')->fetchAll() as $s) if (mb_strtolower($s['nombre']) === mb_strtolower($nombre)) throw new Fallo('nombre', 'Ya hay una saga con ese nombre.');
    $alianza = mb_substr(trim((string) ($p['alianza'] ?? '')), 0, 60);
    $anio = (int) ($p['anio'] ?? 0) ?: 1220;
    $est = min(4, max(1, (int) ($p['est'] ?? 0) ?: 1));
    $saga = nuevaSaga($nombre, $alianza, $anio, $est, (int) ($p['aura'] ?? 0), $u['id']);
    return ['saga' => publica($saga), 'rol' => 'master', 'perfil' => perfil(usuarioPorId($u['id']))];
}

function miembros(array $saga): array {
    $l = consulta('SELECT u.usuario, u.nombre, u.avatar, m.rol FROM miembros m JOIN usuarios u ON u.id = m.usuario WHERE m.saga = ?', [$saga['id']])->fetchAll();
    usort($l, fn($a, $b) => [$a['rol'] === 'master' ? 0 : 1, mb_strtolower($a['nombre'])] <=> [$b['rol'] === 'master' ? 0 : 1, mb_strtolower($b['nombre'])]);
    return ['miembros' => array_map(fn($m) => ['usuario' => $m['usuario'], 'nombre' => $m['nombre'], 'avatar' => $m['avatar'] ?: null, 'rol' => $m['rol']], $l)];
}

function rolValido($r): string {
    if ($r !== 'master' && $r !== 'jugador') throw new Fallo('peticion', 'El rol tiene que ser máster o jugador.');
    return $r;
}

function anadirMiembro(array $saga, array $p): array {
    $rol = rolValido($p['rol'] ?? 'jugador');
    $objetivo = usuarioPorNombre((string) ($p['usuario'] ?? ''));
    if (!$objetivo) throw new Fallo('usuario', 'No hay ninguna cuenta con ese usuario.');
    if (rolEn($saga['id'], $objetivo['id'])) throw new Fallo('usuario', 'Ya está en la saga.');
    consulta('INSERT INTO miembros (saga, usuario, rol, desde) VALUES (?, ?, ?, ?)', [$saga['id'], $objetivo['id'], $rol, ahora()]);
    return miembros($saga);
}

function numMasters(string $saga): int { return (int) consulta("SELECT COUNT(*) FROM miembros WHERE saga = ? AND rol = 'master'", [$saga])->fetchColumn(); }

function cambiarRol(array $saga, array $p): array {
    $rol = rolValido($p['rol'] ?? null);
    $o = usuarioPorNombre((string) ($p['usuario'] ?? ''));
    $actual = $o ? rolEn($saga['id'], $o['id']) : null;
    if (!$actual) throw new Fallo('usuario', 'Esa cuenta no está en la saga.');
    if ($actual === 'master' && $rol !== 'master' && numMasters($saga['id']) < 2) throw new Fallo('master', 'La saga necesita al menos un máster.');
    consulta('UPDATE miembros SET rol = ? WHERE saga = ? AND usuario = ?', [$rol, $saga['id'], $o['id']]);
    return miembros($saga);
}

/* el máster saca a cualquiera; cada uno puede salir él mismo (la saga no puede quedarse sin máster) */
function quitarMiembro(array $saga, string $rolPropio, array $u, array $p): array {
    $o = usuarioPorNombre((string) ($p['usuario'] ?? ''));
    $actual = $o ? rolEn($saga['id'], $o['id']) : null;
    if (!$actual) throw new Fallo('usuario', 'Esa cuenta no está en la saga.');
    if ($o['id'] !== $u['id'] && $rolPropio !== 'master') throw new Fallo('permiso', 'Solo el máster puede sacar a otros de la saga.');
    if ($actual === 'master' && numMasters($saga['id']) < 2) throw new Fallo('master', 'La saga necesita al menos un máster.');
    consulta('DELETE FROM miembros WHERE saga = ? AND usuario = ?', [$saga['id'], $o['id']]);
    return $o['id'] === $u['id'] ? ['ok' => true, 'perfil' => perfil($u)] : miembros($saga);
}

/* el máster dice de quién es un personaje (null: de nadie): así sale en «Mis creaciones» de esa cuenta */
function asignar(array $saga, array $p): array {
    $ruta = (string) ($p['ruta'] ?? '');
    if (!str_starts_with($ruta, 'personajes/') || !preg_match(RUTA_OK, $ruta)) throw new Fallo('ruta', 'Solo se asignan personajes.');
    $uid = null;
    if (!empty($p['usuario'])) {
        $o = usuarioPorNombre((string) $p['usuario']);
        if (!$o || !rolEn($saga['id'], $o['id'])) throw new Fallo('usuario', 'Esa cuenta no está en la saga.');
        $uid = $o['id'];
    }
    if (consulta('SELECT 1 FROM docs WHERE saga = ? AND ruta = ?', [$saga['id'], $ruta])->fetchColumn() === false) throw new Fallo('no_encontrado', 'No existe ' . $ruta);
    consulta('UPDATE docs SET autor = ? WHERE saga = ? AND ruta = ?', [$uid, $saga['id'], $ruta]);
    return ['ok' => true];
}

/* quién es el autor de cada personaje de la saga: {ruta: usuario} */
function autores(array $saga): array {
    $o = new stdClass();
    foreach (consulta("SELECT d.ruta, u.usuario FROM docs d JOIN usuarios u ON u.id = d.autor WHERE d.saga = ? AND d.ruta LIKE 'personajes/%'", [$saga['id']]) as $f) $o->{$f['ruta']} = $f['usuario'];
    return ['autores' => $o];
}

/* lo que ha creado esta cuenta en todas sus sagas: los documentos suyos, tal cual (la web los reparte en secciones) */
function contenido(array $u): Crudo {
    $trozos = [];
    $st = consulta("SELECT d.saga, s.nombre, d.ruta, d.actualizado, d.datos FROM docs d JOIN sagas s ON s.id = d.saga JOIN miembros m ON m.saga = d.saga AND m.usuario = d.autor
        WHERE d.autor = ? AND d.ruta NOT LIKE 'retratos/%' AND d.ruta <> 'saga/estado' ORDER BY d.actualizado DESC", [$u['id']]);
    foreach ($st as $f) {
        $trozos[] = '{"saga":' . json_encode($f['saga']) . ',"sagaNombre":' . json_encode($f['nombre'], JSON_OUT) . ',"ruta":' . json_encode($f['ruta'], JSON_OUT)
            . ',"actualizado":' . (int) $f['actualizado'] . ',"datos":' . $f['datos'] . '}';
    }
    return new Crudo('{"items":[' . implode(',', $trozos) . ']}');
}

/* ============================================================== documentos de las sagas */
/* el autor es quien lo creó y no cambia al editarlo; ($autor solo cuenta si el documento es nuevo) */
function guardarDoc(string $saga, string $ruta, string $json, int $t, ?string $autor = null): void {
    if (strlen($json) > MAX_DOC) throw new Fallo('grande', 'Ese documento es demasiado grande para guardarlo.');
    if (consulta('SELECT 1 FROM docs WHERE saga = ? AND ruta = ?', [$saga, $ruta])->fetchColumn() !== false) {
        consulta('UPDATE docs SET actualizado = ?, datos = ? WHERE saga = ? AND ruta = ?', [$t, $json, $saga, $ruta]);
    } else {
        consulta('INSERT INTO docs (saga, ruta, actualizado, autor, datos) VALUES (?, ?, ?, ?, ?)', [$saga, $ruta, $t, $autor, $json]);
    }
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
function escribir(array $saga, array $u, $ops): array {
    if (!is_array($ops) || !$ops) throw new Fallo('peticion', 'No hay nada que guardar.');
    if (count($ops) > 300) throw new Fallo('peticion', 'Demasiados cambios a la vez.');
    foreach ($ops as $op) {
        $ruta = (string) ($op->ruta ?? '');
        if (!preg_match(RUTA_OK, $ruta)) throw new Fallo('ruta', 'Ruta no permitida: ' . $ruta);
        if (($op->op ?? '') !== 'delete' && !(($op->datos ?? null) instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos en ' . $ruta);
    }
    $t = ahora();
    return transaccion(function () use ($saga, $u, $ops, $t) {
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
            guardarDoc($saga['id'], $ruta, json_encode($datos, JSON_OUT), $t, $u['id']);
        }
        return ['ok' => true, 'rev' => subirRev($saga['id']), 't' => $t];
    });
}

function archivo(array $saga): Crudo {
    $a = consulta('SELECT datos FROM archivos WHERE saga = ?', [$saga['id']])->fetchColumn();
    if ($a === false) return new Crudo('{"archivo":null}');
    return new Crudo('{"rev":' . json_encode($saga['archivo_rev']) . ',"archivo":' . $a . '}');
}

/* la copia de la saga: sus documentos y, si tiene, su archivo (las hojas de cálculo traídas de Drive), que «importar» vuelve a poner */
function exportar(array $saga): Crudo {
    $trozos = [];
    foreach (consulta('SELECT ruta, datos FROM docs WHERE saga = ?', [$saga['id']]) as $f) $trozos[] = json_encode($f['ruta'], JSON_OUT) . ':' . $f['datos'];
    $info = ['nombre' => $saga['nombre'], 'alianza' => $saga['alianza'], 'anio' => (int) $saga['anio'], 'est' => (int) $saga['est'], 'aura' => (int) $saga['aura']];
    $arc = consulta('SELECT datos FROM archivos WHERE saga = ?', [$saga['id']])->fetchColumn();
    return new Crudo('{"formato":"europa-mitica/1","saga":' . json_encode($info, JSON_OUT) . ',"fecha":' . ahora() . ',"docs":{' . implode(',', $trozos) . '}'
        . (is_string($arc) && $arc !== '' ? ',"archivo":' . $arc : '') . '}');
}

/* importar: «reemplazar» vacía antes la saga (sin perder de quién era cada documento); si no, junta lo importado con lo que hay */
function importar(array $saga, array $u, array $p): array {
    $docs = $p['docs'] ?? new stdClass();
    if (!($docs instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos.');
    foreach ($docs as $ruta => $d) {
        if (!preg_match(RUTA_OK, (string) $ruta)) throw new Fallo('ruta', 'Ruta no permitida: ' . $ruta);
        if (!($d instanceof stdClass)) throw new Fallo('peticion', 'Datos no válidos en ' . $ruta);
    }
    return transaccion(function () use ($saga, $u, $docs, $p) {
        bloquear($saga['id']);
        $autores = [];
        if (!empty($p['reemplazar'])) {
            foreach (consulta('SELECT ruta, autor FROM docs WHERE saga = ?', [$saga['id']]) as $f) $autores[$f['ruta']] = $f['autor'];
            consulta('DELETE FROM docs WHERE saga = ?', [$saga['id']]);
        }
        $t = ahora(); $n = 0;
        foreach ($docs as $ruta => $d) { guardarDoc($saga['id'], (string) $ruta, json_encode($d, JSON_OUT), $t, $autores[(string) $ruta] ?? null); $n++; }
        if (!empty($p['archivo'])) {
            consulta('REPLACE INTO archivos (saga, datos) VALUES (?, ?)', [$saga['id'], json_encode($p['archivo'], JSON_OUT)]);
            consulta('UPDATE sagas SET archivo_rev = ? WHERE id = ?', [(string) ahora(), $saga['id']]);
        }
        return ['ok' => true, 'n' => $n, 'rev' => subirRev($saga['id'])];
    });
}

/* ============================================================== ayudas de juego: ediciones de los administradores
   Las ayudas (data/ayudas.json) son iguales para todas las sagas; un administrador puede cambiar cualquier celda de sus tablas.
   Los cambios se guardan aparte (aquí) y la web los aplica encima de los datos al cargar, también para los invitados. */
const SAGA_GLOBAL = '_global';
const RUTA_AYUDAS = 'ayudas/ediciones';

function ayudasLeer(): Crudo {
    $d = consulta('SELECT datos FROM docs WHERE saga = ? AND ruta = ?', [SAGA_GLOBAL, RUTA_AYUDAS])->fetchColumn();
    return new Crudo($d === false ? '{"e":{}}' : (string) $d);
}

/* cambios: [{k: «documento|hoja|tabla», i: fila, n: nombre original de la fila, c: columna, v: texto nuevo (null: quitar el cambio)}] */
function ayudasEscribir(array $u, array $p): array {
    if (!$u['admin']) throw new Fallo('permiso', 'Solo un administrador puede editar las ayudas de juego.');
    $cambios = $p['cambios'] ?? null;
    if (!is_array($cambios) || !$cambios) throw new Fallo('peticion', 'No hay nada que guardar.');
    if (count($cambios) > 100) throw new Fallo('peticion', 'Demasiados cambios a la vez.');
    foreach ($cambios as $c) {
        $k = (string) ($c->k ?? ''); $col = (string) ($c->c ?? '');
        $v = $c->v ?? null;
        if (!preg_match('#^[A-Za-z0-9._|-]{1,120}$#', $k) || $col === '' || mb_strlen($col) > 40 || !is_int($c->i ?? null) || $c->i < 0 || $c->i > 20000
            || mb_strlen((string) ($c->n ?? '')) > 300 || ($v !== null && (!is_string($v) || mb_strlen($v) > 30000)))
            throw new Fallo('peticion', 'Cambio no válido.');
    }
    $t = ahora();
    return transaccion(function () use ($u, $cambios, $t) {
        $d = consulta('SELECT datos FROM docs WHERE saga = ? AND ruta = ?', [SAGA_GLOBAL, RUTA_AYUDAS])->fetchColumn();
        $e = $d === false ? [] : ((json_decode((string) $d, true)['e'] ?? []) ?: []);
        foreach ($cambios as $c) {
            $clave = $c->k . '|' . $c->i . '|' . $c->c;
            if (($c->v ?? null) === null) { unset($e[$clave]); continue; }
            $e[$clave] = ['k' => $c->k, 'i' => $c->i, 'n' => (string) ($c->n ?? ''), 'c' => $c->c, 'v' => $c->v, 'por' => $u['id'], 't' => $t];
        }
        guardarDoc(SAGA_GLOBAL, RUTA_AYUDAS, json_encode(['e' => (object) $e, 't' => $t], JSON_OUT), $t, $u['id']);
        return ['ok' => true, 'n' => count($e), 't' => $t];
    });
}

/* $p: lo que manda la web; los valores sueltos son texto, número o lista, y los objetos son stdClass (así {} sigue siendo {}) */
function atender(array $p) {
    try {
        switch ($p['accion'] ?? '') {
            // cuentas
            case 'registrar': return registrar($p);
            case 'entrar': return entrar($p);
            case 'recuperar': return recuperar($p);
            case 'restablecer': return restablecer($p);
            case 'perfil': return ['perfil' => perfil(sesion($p['token'] ?? ''))];
            case 'actualizarPerfil': return actualizarPerfil(sesion($p['token'] ?? ''), $p);
            case 'cambiarPassword': return cambiarPassword(sesion($p['token'] ?? ''), $p);
            case 'cerrarSesiones': return cerrarSesiones(sesion($p['token'] ?? ''));
            case 'contenido': return contenido(sesion($p['token'] ?? ''));
            case 'crear': return crear(sesion($p['token'] ?? ''), $p);
            // ayudas de juego (las leen todos, también sin cuenta; las escribe un administrador)
            case 'ayudasLeer': return ayudasLeer();
            case 'ayudasEscribir': return ayudasEscribir(sesion($p['token'] ?? ''), $p);
            // una saga
            case 'info': [$s, $rol] = acceso($p); return ['saga' => publica($s), 'rol' => $rol];
            case 'leer': [$s] = acceso($p); return leer($s, $p);
            case 'escribir': [$s, , $u] = acceso($p); return escribir($s, $u, $p['ops'] ?? null);
            case 'archivo': [$s] = acceso($p); return archivo($s);
            case 'exportar': [$s] = acceso($p, 'master'); return exportar($s);
            case 'importar': [$s, , $u] = acceso($p, 'master'); return importar($s, $u, $p);
            case 'miembros': [$s] = acceso($p); return miembros($s);
            case 'anadirMiembro': [$s] = acceso($p, 'master'); return anadirMiembro($s, $p);
            case 'cambiarRol': [$s] = acceso($p, 'master'); return cambiarRol($s, $p);
            case 'quitarMiembro': [$s, $rol, $u] = acceso($p); return quitarMiembro($s, $rol, $u, $p);
            case 'asignar': [$s] = acceso($p, 'master'); return asignar($s, $p);
            case 'autores': [$s] = acceso($p, 'master'); return autores($s);
            default: return ['error' => 'accion', 'mensaje' => 'Acción desconocida.'];
        }
    } catch (Fallo $e) {
        return ['error' => $e->codigo, 'mensaje' => $e->getMessage()];
    } catch (Throwable $e) {
        error_log('Europa Mítica: ' . $e);
        return ['error' => 'interno', 'mensaje' => 'Error del servidor.'];
    }
}
