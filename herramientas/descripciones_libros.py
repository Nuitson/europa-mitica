#!/usr/bin/env python3
"""Descripción completa de cada virtud y defecto, sacada de los libros en castellano.

    python herramientas/descripciones_libros.py [--escribir] [--es CARPETA] [--en CARPETA]

El compendio (data/ayudas.json, hojas «Virtudes» y «Defectos») tiene una columna «Resumen» (el resumen corto de siempre)
y una columna «Descripción» con el texto del libro. Esta herramienta rellena la segunda: usa la página en castellano que
encuentra herramientas/enlaces_libros.py, localiza el encabezado de la entrada («Nombre» y debajo «Valor, Tipo») y copia el
texto hasta el encabezado siguiente. Solo rellena lo que se puede asegurar; el resto queda vacío.

Sin --escribir solo cuenta y enseña algunos ejemplos. Con --escribir reescribe data/ayudas.json (y se puede repetir: el
resumen no se toca y la descripción se recalcula entera).
"""
import collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enlaces_libros as L

VALOR = r'(?:virtud |defecto )?(?:mayor|menor|libre|gratuit[ao]|especial)(?: o (?:mayor|menor))?'
RE_VALOR = re.compile(r'^\W*' + VALOR + r'\b\W*[a-z]', re.I)
FIN = '.!?:;)»"'
PREFIJO = set('virtud defecto mayor menor libre gratuita gratuito especial o'.split())


# los tipos que aparecen en la columna «Tipo» del compendio («Hermética y General», «Estatus Social»…): el encabezado de la
# entrada los lista tras el valor y hay que quitarlos del principio del texto
TIPOS = {t for e in L.entradas() for t in L.norm(e['tipo']).split()} | {'y', 'hermetico', 'hermetica', 'mistico', 'mistica', 'general'}
TIPOS -= {'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'en', 'a'}


def lineas_libro(ruta):
    """[(pagina, texto)] de todo el libro, sin números de página ni cabeceras que se repiten en muchas páginas"""
    L.paginas_crudas(ruta)  # asegura la caché
    f = os.path.join(L.CACHE, 'raw_' + re.sub(r'\W', '_', os.path.basename(ruta)) + '.txt')
    pgs = open(f, encoding='utf8', errors='ignore').read().split('\f')
    veces = collections.Counter()
    for t in pgs:
        for l in set(x.strip() for x in t.split('\n')): veces[l] += 1
    out = []
    for n, t in enumerate(pgs, 1):
        for l in t.split('\n'):
            l = l.strip()
            if l and (re.fullmatch(r'\d{1,3}', l) or (veces[l] >= 8 and len(l) < 60)): continue
            out.append((n, l))
    return out


def es_valor(l):
    return bool(l) and bool(RE_VALOR.match(l))


def cabeceras(ls):
    """índices de las líneas «Valor, Tipo» y nombre que les precede (una o dos líneas): [(j, nombre, inicio)]"""
    out = []
    for j, (_, l) in enumerate(ls):
        if not es_valor(l): continue
        k = j - 1
        while k >= 0 and not ls[k][1] and j - k <= 2: k -= 1   # una línea en blanco entre el nombre y el valor
        if k < 0 or not ls[k][1] or es_valor(ls[k][1]) or len(ls[k][1]) > 70: continue
        nombre, ini = ls[k][1], k
        # nombre en dos líneas: la anterior también es corta y sin punto final
        if k - 1 >= 0 and ls[k - 1][1] and len(ls[k - 1][1]) <= 40 and ls[k - 1][1][-1] not in FIN and len(nombre) <= 40 \
                and not es_valor(ls[k - 1][1]) and ls[k - 1][0] == ls[k][0] and ls[k - 1][1][0].isupper() and nombre[0].isupper() \
                and not (k - 2 >= 0 and ls[k - 2][1] and ls[k - 2][1][-1] not in FIN and len(ls[k - 2][1]) < 40):
            pass  # demasiado ambiguo: se queda con una línea (los nombres largos se casan por prefijo más abajo)
        out.append((j, nombre, ini))
    return out


def cuerpo(ls, j, fin, ent):
    """texto de la entrada: desde la línea del valor hasta `fin`, sin el «Valor, Tipo» del principio"""
    sel = [re.sub(r'\bCAP.TULO\b ?', '', l) for _, l in ls[j:fin] if l]   # las líneas en blanco del PDF no marcan párrafos
    # quitar el «Valor, Tipo» (con el tipo de la entrada) del principio de la primera línea
    permitidas = PREFIJO | set(L.norm(ent['tipo']).split()) | set(L.norm(ent['valor']).split()) | TIPOS
    palabras = sel[0].split(' ')
    i = 0
    while i < len(palabras) and L.norm(palabras[i]) in permitidas: i += 1
    sel[0] = ' '.join(palabras[i:])
    # párrafos: el ancho típico de línea del libro es el máximo; una línea que acaba en punto y es bastante más corta cierra el párrafo
    ancho = max([len(l) for l in sel] + [1])
    ancho = max(ancho, 30)
    partes, actual = [], ''
    for k, l in enumerate(sel):
        if not l:
            if actual: partes.append(actual); actual = ''
            continue
        if actual.endswith('-') and l[:1].islower(): actual = actual[:-1] + l      # guion de fin de línea
        else: actual = (actual + ' ' + l).strip()
        if l[-1] in '.!?»' and len(l) < 0.72 * ancho: partes.append(actual); actual = ''
    if actual: partes.append(actual)
    # al final puede colarse el título de una sección («Nuevos Defectos»): línea corta sin puntuación
    while partes and len(partes[-1]) <= 50 and partes[-1][-1] not in FIN: partes.pop()
    return '\n\n'.join(p for p in partes if p).strip()


def descripciones(ab, ents):
    """{índice de entrada: texto} para un libro con PDF en castellano"""
    esf = L.LIBROS[ab][3]
    ruta = os.path.join(L.ES, esf)
    ok = L.resolver_es(L.paginas_crudas(ruta), ents, ab)
    ls = lineas_libro(ruta)
    cab = cabeceras(ls)
    por_pagina = collections.defaultdict(list)
    for n, (j, nombre, ini) in enumerate(cab): por_pagina[ls[j][0]].append(n)
    res = {}
    for k, p in ok.items():
        e = ents[k]
        nm = L.norm(e['es'])
        sin = L.norm(re.sub(r'\(.*?\)|\[.*?\]', ' ', e['es']))
        val = L.norm(e['valor'])
        mejor = None
        for pp in (p, p - 1, p + 1):
            for n in por_pagina.get(pp, []):
                j, nombre, ini = cab[n]
                nh = L.norm(nombre)
                if nh in (nm, sin) or (len(nh) >= 6 and (nm.startswith(nh) or nh.startswith(nm))):
                    if pp == p or mejor is None: mejor = n
            if mejor is not None and pp == p: break
        if mejor is None: continue
        j, nombre, ini = cab[mejor]
        fin = cab[mejor + 1][2] if mejor + 1 < len(cab) else min(len(ls), j + 80)
        fin = min(fin, j + 140)
        texto = cuerpo(ls, j, fin, e)
        if len(texto) >= 25: res[k] = texto
    return res


def main():
    escribir = '--escribir' in sys.argv
    todas = L.entradas()
    ents = {}
    por = collections.defaultdict(list)
    for e in todas: por[e['ab']].append(e)
    # las descripciones se buscan por (nombre, libro y página como están en la fila)
    claves = {}
    for ab, (slug, nombre, trozo, esf) in L.LIBROS.items():
        if not esf or not por.get(ab): continue
        if ab == 'BCoC': continue   # sus entradas no llevan «Valor, Tipo»: no hay encabezado que localizar
        d = descripciones(ab, por[ab])
        print('%-7s %3d de %3d' % (ab, len(d), len(por[ab])))
        for k, t in d.items():
            e = por[ab][k]
            claves[(e['es'], e['pag'], e['en'], e['tipo'], e['valor'])] = t
    print('total', len(claves))
    if not escribir:
        for (nom, pag, *_), t in list(claves.items())[:3]: print('\n#', nom, pag, '\n', t[:600])
        return
    ruta = os.path.join(L.RAIZ, 'data', 'ayudas.json')
    raw = open(ruta, encoding='utf8', newline='').read()
    d = json.loads(raw)
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    n = 0
    for sh in doc['sheets']:
        for b in sh['blocks']:
            if b['t'] != 'table' or sh['id'] not in ('virtudes', 'defectos'): continue
            cols = b['cols']
            ci = {c: i for i, c in enumerate(cols)}
            if 'Resumen' not in cols:
                cols[6] = 'Resumen'
                cols.append('Descripción')
                b['long'] = sorted(set(b.get('long', [])) | {6, 7})
            for r in b['rows']:
                while len(r) < 8: r.append('')
                r[7] = claves.get((r[0], r[5], r[1], r[2], r[3]), '')
                if r[7]: n += 1
    fin = raw[len(raw.rstrip('\r\n')):]
    with open(ruta, 'w', encoding='utf8', newline='') as fh:
        fh.write(json.dumps(d, ensure_ascii=False, separators=(',', ':')) + fin)
    print('escritas', n, 'descripciones en data/ayudas.json')


if __name__ == '__main__':
    main()
