<?php
/* Gestión de cuentas desde la línea de órdenes (para quien administra la web, con acceso por SSH):
     php api/usuarios.php listar                          cuentas y sagas, con sus miembros
     php api/usuarios.php master <usuario> <saga>         hace máster de esa saga a esa cuenta (la añade si no estaba)
     php api/usuarios.php miembro <usuario> <saga> [rol]  la añade como jugador (o como master)
     php api/usuarios.php crea-sagas <usuario> [si|no]    permite (o no) a esa cuenta crear sagas
     php api/usuarios.php contrasena <usuario>            pone una contraseña nueva al azar y la muestra (cierra sus sesiones)
   Los usuarios se escriben como en la web (sin importar mayúsculas). */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

function cuenta(string $nombre): array {
    $u = usuarioPorNombre($nombre);
    if (!$u) { fwrite(STDERR, "No hay ninguna cuenta «$nombre».\n"); exit(1); }
    return $u;
}
function saga(string $id): array {
    $s = sagaPorId($id);
    if (!$s) { fwrite(STDERR, "No hay ninguna saga «$id». Las que hay: " . implode(', ', array_column(consulta('SELECT id FROM sagas')->fetchAll(), 'id')) . "\n"); exit(1); }
    return $s;
}
function ponerRol(array $u, array $s, string $rol): void {
    consulta('DELETE FROM miembros WHERE saga = ? AND usuario = ?', [$s['id'], $u['id']]);
    consulta('INSERT INTO miembros (saga, usuario, rol, desde) VALUES (?, ?, ?, ?)', [$s['id'], $u['id'], $rol, ahora()]);
    echo "{$u['usuario']} es ahora $rol de «{$s['nombre']}».\n";
}

$cmd = $argv[1] ?? '';
switch ($cmd) {
    case 'listar':
        foreach (consulta('SELECT * FROM usuarios ORDER BY creado')->fetchAll() as $u)
            echo "- {$u['usuario']} ({$u['nombre']}, {$u['email']})" . ($u['crea_sagas'] ? ' [puede crear sagas]' : '') . "\n";
        foreach (consulta('SELECT * FROM sagas ORDER BY nombre')->fetchAll() as $s) {
            echo "\n{$s['id']} — {$s['nombre']}\n";
            foreach (consulta('SELECT u.usuario, m.rol FROM miembros m JOIN usuarios u ON u.id = m.usuario WHERE m.saga = ?', [$s['id']]) as $m) echo "    {$m['usuario']}: {$m['rol']}\n";
        }
        break;
    case 'master': ponerRol(cuenta($argv[2] ?? ''), saga($argv[3] ?? ''), 'master'); break;
    case 'miembro':
        $rol = $argv[4] ?? 'jugador';
        if (!in_array($rol, ['master', 'jugador'], true)) { fwrite(STDERR, "El rol es master o jugador.\n"); exit(1); }
        ponerRol(cuenta($argv[2] ?? ''), saga($argv[3] ?? ''), $rol);
        break;
    case 'crea-sagas':
        $u = cuenta($argv[2] ?? '');
        $si = ($argv[3] ?? 'si') !== 'no';
        consulta('UPDATE usuarios SET crea_sagas = ? WHERE id = ?', [$si ? 1 : 0, $u['id']]);
        echo "{$u['usuario']} " . ($si ? 'puede' : 'ya no puede') . " crear sagas.\n";
        break;
    case 'contrasena':
        $u = cuenta($argv[2] ?? '');
        $nueva = codigoAzar();
        consulta('UPDATE usuarios SET hash = ?, gen = gen + 1 WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
        echo "Contraseña nueva de {$u['usuario']}: $nueva\n(pídele que la cambie al entrar, en «Mi zona»)\n";
        break;
    default:
        echo trim(substr(file_get_contents(__FILE__), 6, strpos(file_get_contents(__FILE__), '*/') - 6)) . "\n";
}

function codigoAzar(): string {
    $a = 'abcdefghjkmnpqrstuvwxyz23456789'; $s = '';
    for ($i = 0; $i < 12; $i++) $s .= $a[random_int(0, strlen($a) - 1)];
    return $s;
}
