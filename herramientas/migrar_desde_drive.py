"""Pasa una saga del servidor antiguo (Google Apps Script / Drive) al servidor nuevo (api/api.php).

Hace tres cosas: descarga de Drive los documentos y el archivo de la saga, la crea en el servidor nuevo (o usa la que ya exista con ese nombre)
y los importa. Al terminar descarga lo importado y lo compara con lo original. También deja una copia en un archivo local.

Ejemplo (servidor nuevo en local):
  python herramientas/migrar_desde_drive.py ^
    --viejo https://script.google.com/macros/s/XXXX/exec --saga arazas --codigo-master-viejo CODIGO ^
    --nuevo http://localhost:8080/api/api.php --codigo-crear CODIGO_CREAR --codigo-jugador NUEVO_CODIGO_JUGADOR

El código de máster nuevo es, si no dices otro, el mismo que el viejo. El de jugador antiguo no se puede recuperar: pon uno nuevo.
Solo usa la biblioteca estándar de Python."""
import argparse
import json
import sys
import urllib.request


def llamar(url, accion, **datos):
    cuerpo = json.dumps(dict(accion=accion, **datos)).encode('utf-8')
    # un texto plano, como hace la web: Apps Script responde así sin preguntar antes (y urllib sigue su redirección)
    req = urllib.request.Request(url, data=cuerpo, headers={'Content-Type': 'text/plain;charset=utf-8'})
    with urllib.request.urlopen(req, timeout=600) as r:
        o = json.loads(r.read().decode('utf-8'))
    if isinstance(o, dict) and o.get('error'):
        sys.exit('%s: %s' % (accion, o.get('mensaje') or o['error']))
    return o


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--viejo', required=True, help='dirección del Apps Script (termina en /exec)')
    a.add_argument('--saga', help='id de la saga en el servidor viejo (si solo hay una, no hace falta)')
    a.add_argument('--codigo-master-viejo', required=True)
    a.add_argument('--nuevo', required=True, help='dirección del servidor nuevo (…/api/api.php)')
    a.add_argument('--codigo-crear', required=True, help='el que dio api/instalar.php')
    a.add_argument('--codigo-jugador', required=True, help='el código de jugador que tendrá la saga nueva')
    a.add_argument('--codigo-master-nuevo', help='por defecto, el mismo código de máster que el viejo')
    a.add_argument('--copia', help='archivo donde dejar la copia (por defecto copia-<saga>.json)')
    o = a.parse_args()

    sagas = llamar(o.viejo, 'sagas')['sagas']
    if not o.saga:
        if len(sagas) != 1:
            sys.exit('Hay varias sagas, elige una con --saga: ' + ', '.join(s['id'] for s in sagas))
        o.saga = sagas[0]['id']
    print('Entrando en la saga «%s» del servidor viejo…' % o.saga)
    ses = llamar(o.viejo, 'entrar', saga=o.saga, rol='master', codigo=o.codigo_master_viejo)
    tok = ses['token']
    exp = llamar(o.viejo, 'exportar', token=tok)
    arc = llamar(o.viejo, 'archivo', token=tok).get('archivo')
    docs = exp['docs']
    print('Descargados %d documentos%s.' % (len(docs), ' y el archivo de hojas' if arc else ''))

    copia = o.copia or ('copia-%s.json' % o.saga)
    with open(copia, 'w', encoding='utf-8') as f:
        json.dump({'formato': exp['formato'], 'saga': exp['saga'], 'fecha': exp['fecha'], 'docs': docs, 'archivo': arc}, f, ensure_ascii=False)
    print('Copia local en', copia)

    info = exp['saga']
    master = o.codigo_master_nuevo or o.codigo_master_viejo
    existe = next((s for s in llamar(o.nuevo, 'sagas')['sagas'] if s['nombre'].lower() == info['nombre'].lower()), None)
    if existe:
        print('Ya existe «%s» en el servidor nuevo: se usa esa y se sustituye su contenido.' % existe['nombre'])
        nueva = llamar(o.nuevo, 'entrar', saga=existe['id'], rol='master', codigo=master)
    else:
        nueva = llamar(o.nuevo, 'crear', nombre=info['nombre'], alianza=info.get('alianza') or '', anio=info.get('anio'), est=info.get('est'),
                       aura=info.get('aura'), codigoJugador=o.codigo_jugador, codigoMaster=master, codigoCrear=o.codigo_crear)
        print('Creada «%s» en el servidor nuevo.' % nueva['saga']['nombre'])
    r = llamar(o.nuevo, 'importar', token=nueva['token'], docs=docs, archivo=arc, reemplazar=True)
    print('Importados %d documentos.' % r['n'])

    # comprobación: lo que guarda el servidor nuevo tiene que ser igual a lo que salió de Drive (también los {} y [] vacíos)
    de_vuelta = llamar(o.nuevo, 'exportar', token=nueva['token'])['docs']
    if de_vuelta != docs:
        falta = sorted(set(docs) - set(de_vuelta))
        distintos = sorted(k for k in docs if k in de_vuelta and de_vuelta[k] != docs[k])
        sys.exit('¡Ojo! No coincide. Faltan %s; distintos %s' % (falta[:10], distintos[:10]))
    if arc and llamar(o.nuevo, 'archivo', token=nueva['token']).get('archivo') != arc:
        sys.exit('¡Ojo! El archivo de hojas no coincide.')
    print('Comprobado: los %d documentos son idénticos a los de Drive.' % len(docs))
    print('Entra en la web con el código de máster %s' % ('que ya tenías' if not o.codigo_master_nuevo else 'nuevo'), 'y el de jugador que has puesto.')


if __name__ == '__main__':
    main()
