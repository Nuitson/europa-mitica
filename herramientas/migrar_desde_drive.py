"""Pasa una saga del servidor antiguo (Google Apps Script / Drive) al servidor nuevo (api/api.php).

Hace tres cosas: descarga de Drive los documentos y el archivo de la saga, la crea en el servidor nuevo (o usa la que ya tengas con ese
nombre) y los importa. Al terminar descarga lo importado y lo compara con lo original. También deja una copia en un archivo local.

Hace falta una cuenta del servidor nuevo (créala en la web) con permiso para crear sagas: la primera que se registra lo tiene. La saga
queda a su nombre, como máster. Si la saga ya existe en el servidor nuevo, esa cuenta tiene que ser máster de ella.

Ejemplo (servidor nuevo en local):
  python herramientas/migrar_desde_drive.py ^
    --viejo https://script.google.com/macros/s/XXXX/exec --saga arazas --codigo-master-viejo CODIGO_DE_MASTER_ANTIGUO ^
    --nuevo http://localhost:8080/api/api.php --usuario MI_USUARIO

La contraseña se pide al ejecutarlo (o se lee de la variable de entorno EM_PASSWORD).
Solo usa la biblioteca estándar de Python."""
import argparse
import getpass
import json
import os
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
    a.add_argument('--codigo-master-viejo', required=True, help='el código de máster que tenía la saga en el servidor viejo')
    a.add_argument('--nuevo', required=True, help='dirección del servidor nuevo (…/api/api.php)')
    a.add_argument('--usuario', required=True, help='tu cuenta en el servidor nuevo')
    a.add_argument('--copia', help='archivo donde dejar la copia (por defecto copia-<saga>.json)')
    o = a.parse_args()
    password = os.environ.get('EM_PASSWORD') or getpass.getpass('Contraseña de %s en el servidor nuevo: ' % o.usuario)

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
    nuevo = llamar(o.nuevo, 'entrar', usuario=o.usuario, password=password)
    t = nuevo['token']
    existe = next((s for s in nuevo['perfil']['sagas'] if s['nombre'].lower() == info['nombre'].lower()), None)
    if existe:
        if existe['rol'] != 'master':
            sys.exit('Ya existe «%s» en el servidor nuevo y no eres su máster.' % existe['nombre'])
        print('Ya existe «%s» en el servidor nuevo: se usa esa y se sustituye su contenido.' % existe['nombre'])
        saga_id = existe['id']
    else:
        r = llamar(o.nuevo, 'crear', token=t, nombre=info['nombre'], alianza=info.get('alianza') or '', anio=info.get('anio'), est=info.get('est'), aura=info.get('aura'))
        saga_id = r['saga']['id']
        print('Creada «%s» en el servidor nuevo, a nombre de %s.' % (r['saga']['nombre'], o.usuario))
    r = llamar(o.nuevo, 'importar', token=t, saga=saga_id, docs=docs, archivo=arc, reemplazar=True)
    print('Importados %d documentos.' % r['n'])

    # comprobación: lo que guarda el servidor nuevo tiene que ser igual a lo que salió de Drive (también los {} y [] vacíos)
    de_vuelta = llamar(o.nuevo, 'exportar', token=t, saga=saga_id)['docs']
    if de_vuelta != docs:
        falta = sorted(set(docs) - set(de_vuelta))
        distintos = sorted(k for k in docs if k in de_vuelta and de_vuelta[k] != docs[k])
        sys.exit('¡Ojo! No coincide. Faltan %s; distintos %s' % (falta[:10], distintos[:10]))
    if arc and llamar(o.nuevo, 'archivo', token=t, saga=saga_id).get('archivo') != arc:
        sys.exit('¡Ojo! El archivo de hojas no coincide.')
    print('Comprobado: los %d documentos son idénticos a los de Drive.' % len(docs))
    print('Los demás entran con su propia cuenta: añádelos en la pantalla del máster, en «Quién está en la saga».')


if __name__ == '__main__':
    main()
