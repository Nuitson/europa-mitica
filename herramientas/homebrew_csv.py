"""Convierte los CSV de material fanmade (homebrew) en los datos que lee la web: data/homebrew/.

Cada CSV es una tabla separada por «;» en UTF-8. Hay dos formas:
  - entradas de blog (magos, aprendices, objetos mágicos, alianzas, hechizos en texto): id, tema, nombre, grupo, parte,
    fragmento, serie, blog, autor, colaborador, fecha, idioma, url, presentacion, texto
  - hechizos en tabla (The Iron-Bound Tome): id, nombre, tecnica, forma, requisitos, nivel, ritual, alcance, duracion,
    objetivo, etiquetas, parametros, descripcion, diseno, notas, fuente, …, autor, blog, idioma, observaciones

Se agrupa por tipo (el tema) y autor: cada grupo es un archivo data/homebrew/<tipo>-<autor>.json, y data/homebrew/index.json
los lista. El máster activa cada grupo en la pestaña «Homebrew» de su pantalla. De las entradas en texto con hechizos
(«## Nombre», «Creo (Rego) Aquam 35», «A: …, D: …, O: …») se sacan también los hechizos, para el catálogo.

Ejemplo:
  python herramientas/homebrew_csv.py Descargas/ars_magica_*.csv
Solo usa la biblioteca estándar de Python."""
import csv
import io
import json
import os
import re
import sys
import unicodedata

ARTES_T = ['Creo', 'Intellego', 'Muto', 'Perdo', 'Rego']
ARTES_F = ['Animal', 'Aquam', 'Auram', 'Corpus', 'Herbam', 'Ignem', 'Imaginem', 'Mentem', 'Terram', 'Vim']
ORDEN_TIPOS = ['Magos', 'Aprendices', 'Alianzas', 'Objetos mágicos', 'Hechizos']
csv.field_size_limit(10 ** 9)


def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def arte(w):
    k = slug(w)
    for a in ARTES_T + ARTES_F:
        if slug(a) == k or (k == 'intelego' and a == 'Intellego'):
            return a
    return ''


def leer(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(io.StringIO(f.read()), delimiter=';'))


def limpio(s):
    return (s or '').replace('\r\n', '\n').replace('\xa0', ' ').strip()


def nivel(v):
    v = limpio(v)
    if re.fullmatch(r'\d+', v):
        return int(v)
    return 'Gen' if v.lower().startswith('gen') else v


# «Creo (Rego) Aquam 35», «Muto Auram (Ignem) 15», «Creo Vim General»
CAB = re.compile(r'^(?P<arts>(?:\(?[A-Za-zÁÉÍÓÚáéíóú]+\)?\s+){2,4})(?P<lv>\d+|General)\s*$')
PARAM = re.compile(r'^A:\s*(?P<a>.+?),\s*D:\s*(?P<d>.+?),\s*O:\s*(?P<o>.+?)\s*$')


def hechizos_de_texto(e, n0):
    """Los hechizos escritos en una entrada: «## Nombre», la línea de Artes y nivel, la de parámetros y su texto."""
    out = []
    L = [x.strip() for x in e['texto'].split('\n') if x.strip()]
    # a spell starts with its name, then the Arts and level line, then the parameters (with or without «## » before the name)
    inicios = [i for i in range(1, len(L) - 1) if CAB.match(L[i]) and PARAM.match(L[i + 1])]
    for j, i in enumerate(inicios):
        nombre = L[i - 1].lstrip('#').strip()
        fin = inicios[j + 1] - 1 if j + 1 < len(inicios) else len(L)
        resto = L[i:fin]
        # the text of the spell ends at the next heading
        for q in range(2, len(resto)):
            if resto[q].startswith('#'):
                resto = resto[:q]
                break
        m, p = CAB.match(resto[0]), PARAM.match(resto[1])
        palabras = m.group('arts').split()
        req = [arte(w.strip('()')) for w in palabras if w.startswith('(')]
        base = [arte(w) for w in palabras if not w.startswith('(')]
        tec = next((a for a in base if a in ARTES_T), '')
        forma = next((a for a in base if a in ARTES_F), '')
        if not tec or not forma:
            continue
        obj = p.group('o')
        rit = bool(re.search(r',\s*Ritual$', obj, re.I))
        obj = re.sub(r',\s*Ritual$', '', obj, flags=re.I)
        desc, diseno, notas = [], '', []
        for x in resto[2:]:
            if not diseno and re.match(r'^\(Base\b', x):
                diseno = x
            elif diseno:
                notas.append(x)
            else:
                desc.append(x)
        n0 += 1
        out.append({'id': 'hb-' + slug(e['autor']) + '-' + slug(nombre) + '-' + str(n0), 'n': nombre, 'tec': tec, 'forma': forma,
                    'req': ', '.join(a for a in req if a), 'nivel': nivel(m.group('lv')), 'rit': rit or None,
                    'alc': p.group('a'), 'dur': p.group('d'), 'obj': obj, 'desc': '\n'.join(desc), 'base': diseno,
                    'notas': '\n'.join(notas), 'entrada': e['id'], 'url': e['url'], 'fecha': e['fecha'], 'idioma': e['idioma']})
    return out


def entradas(rows):
    """Las entradas de blog, con los fragmentos de una misma entrada (textos muy largos partidos en varias filas) juntos."""
    por_id, orden = {}, []
    for r in rows:
        i = limpio(r['id'])
        if i not in por_id:
            por_id[i] = []
            orden.append(i)
        por_id[i].append(r)
    out = []
    for i in orden:
        partes = sorted(por_id[i], key=lambda r: int((limpio(r['fragmento']) or '1/1').split('/')[0]))
        r = partes[0]
        out.append({'id': i, 'n': limpio(r['nombre']), 'tema': limpio(r['tema']), 'grupo': limpio(r['grupo']), 'parte': limpio(r['parte']),
                    'serie': limpio(r['serie']), 'blog': limpio(r['blog']), 'autor': limpio(r['autor']), 'colab': limpio(r['colaborador']),
                    'fecha': limpio(r['fecha']), 'idioma': limpio(r['idioma']), 'url': limpio(r['url']),
                    'pres': limpio(r['presentacion']), 'texto': '\n\n'.join(limpio(x['texto']) for x in partes)})
    return out


def hechizo_tabla(r):
    rit = limpio(r['ritual']).lower() in ('sí', 'si', 'yes', 'true', '1')
    return {'id': 'hb-' + slug(limpio(r['id'])), 'n': limpio(r['nombre']), 'tec': arte(limpio(r['tecnica'])), 'forma': arte(limpio(r['forma'])),
            'req': limpio(r['requisitos']), 'nivel': nivel(r['nivel']), 'rit': rit or None, 'alc': limpio(r['alcance']),
            'dur': limpio(r['duracion']), 'obj': limpio(r['objetivo']), 'etiq': limpio(r['etiquetas']), 'desc': limpio(r['descripcion']),
            'base': limpio(r['diseno']), 'notas': '\n'.join(x for x in [limpio(r['notas']), limpio(r['observaciones'])] if x),
            'entrada_n': limpio(r['entrada_original']), 'url': limpio(r['entrada_url']) or limpio(r['fuente_url']),
            'fecha': limpio(r['fecha_entrada']), 'idioma': limpio(r['idioma']), 'autor': limpio(r['autor']), 'blog': limpio(r['blog'])}


def main(paths):
    grupos = {}

    def grupo(tipo, autor):
        k = slug(tipo) + '-' + slug(autor)
        if k not in grupos:
            grupos[k] = {'k': k, 'tipo': tipo, 'autor': autor, 'blogs': [], 'textos': [], 'hechizos': []}
        return grupos[k]

    def blog(g, b):
        if b and b not in g['blogs']:
            g['blogs'].append(b)

    for path in paths:
        rows = leer(path)
        if not rows:
            continue
        if 'tecnica' in rows[0]:
            for r in rows:
                s = hechizo_tabla(r)
                if not s['tec'] or not s['forma']:
                    print('  sin Técnica o Forma, se salta:', path, r['id'], s['n'], file=sys.stderr)
                    continue
                g = grupo('Hechizos', s.pop('autor'))
                blog(g, s.pop('blog'))
                g['hechizos'].append({k: v for k, v in s.items() if v not in ('', None)})
        else:
            for e in entradas(rows):
                g = grupo(e['tema'] or 'Otros', e['autor'])
                blog(g, e['blog'])
                g['textos'].append({k: v for k, v in e.items() if v and k not in ('tema', 'autor')})
                if g['tipo'] == 'Hechizos':
                    for s in hechizos_de_texto(e, len(g['hechizos'])):
                        g['hechizos'].append({k: v for k, v in s.items() if v not in ('', None)})

    raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'homebrew')
    os.makedirs(raiz, exist_ok=True)
    indice = []
    orden = lambda g: (ORDEN_TIPOS.index(g['tipo']) if g['tipo'] in ORDEN_TIPOS else 99, g['tipo'], g['autor'])
    for g in sorted(grupos.values(), key=orden):
        with open(os.path.join(raiz, g['k'] + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(g, f, ensure_ascii=False, separators=(',', ':'))
        indice.append({'k': g['k'], 'tipo': g['tipo'], 'autor': g['autor'], 'blogs': g['blogs'],
                       'textos': len(g['textos']), 'hechizos': len(g['hechizos'])})
        print('%-32s %3d textos %4d hechizos' % (g['k'], len(g['textos']), len(g['hechizos'])))
    with open(os.path.join(raiz, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'v': 1, 'grupos': indice}, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
