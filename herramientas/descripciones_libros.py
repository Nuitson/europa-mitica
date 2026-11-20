#!/usr/bin/env python3
"""Descripción completa de cada virtud y defecto, sacada de los libros en castellano.

    python herramientas/descripciones_libros.py [--escribir] [--es CARPETA] [--en CARPETA]

El compendio (data/ayudas.json, hojas «Virtudes» y «Defectos») tiene una columna «Resumen» (el resumen corto de siempre)
y una columna «Descripción» con el texto del libro. Esta herramienta rellena la segunda y, de paso, la página en castellano
de cada entrada (data/libros.json, el enlace «ES»): lee el PDF, encuentra todos los encabezados («Nombre» y debajo
«Valor, Tipo»), casa cada entrada con su encabezado (por nombre exacto o, si el libro lo llama de otra forma, por parecido
con el mismo valor) y copia el texto hasta el encabezado siguiente. Lo que no se casa queda vacío.

Sin --escribir solo cuenta y enseña ejemplos. Con --escribir reescribe data/ayudas.json y data/libros.json (se puede repetir:
el resumen no se toca y la descripción se recalcula entera).
"""
import collections, difflib, json, os, re, statistics, sys

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
    pgs = open(f, encoding='utf8', errors='ignore').read().replace(' ', '\n').replace(' ', '\n').split('\f')   # separadores de párrafo del PDF = salto de línea
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
    """[(j, [(nombre, inicio)...])]: la línea «Valor, Tipo» (j) y los nombres posibles (una o dos líneas) que la preceden"""
    out = []
    for j, (_, l) in enumerate(ls):
        if not es_valor(l): continue
        k = j - 1
        while k >= 0 and not ls[k][1] and j - k <= 2: k -= 1   # una línea en blanco entre el nombre y el valor
        if k < 0 or not ls[k][1] or es_valor(ls[k][1]) or len(ls[k][1]) > 70: continue
        vars_ = [(ls[k][1], k)]
        m = k - 1
        while m >= 0 and not ls[m][1] and k - m <= 2: m -= 1   # nombre en dos líneas («Magia Espontánea» / «Amplificada»)
        if m >= 0 and ls[m][1] and len(ls[m][1]) <= 45 and ls[m][1][-1] not in FIN and not es_valor(ls[m][1]) and ls[m][1][0].isupper():
            vars_.append((ls[m][1] + ' ' + ls[k][1], m))
        out.append((j, vars_))
    return out


def cuerpo(ls, j, fin, ent):
    """texto de la entrada: desde la línea del valor hasta `fin`, sin el «Valor, Tipo» del principio"""
    sel = [re.sub(r'\bCAP.TULO\b ?', '', l) for _, l in ls[j:fin] if l]   # las líneas en blanco del PDF no marcan párrafos
    if not sel: return ''
    permitidas = PREFIJO | set(L.norm(ent['tipo']).split()) | set(L.norm(ent['valor']).split()) | TIPOS
    palabras = sel[0].split(' ')
    i = 0
    while i < len(palabras) and L.norm(palabras[i]) in permitidas: i += 1
    sel[0] = ' '.join(palabras[i:])
    # párrafos: el ancho típico de línea es el máximo; una línea que acaba en punto y es bastante más corta cierra el párrafo
    ancho = max([len(l) for l in sel] + [30])
    partes, actual = [], ''
    for l in sel:
        if not l: continue
        if actual.endswith('-') and l[:1].islower(): actual = actual[:-1] + l      # guion de fin de línea
        else: actual = (actual + ' ' + l).strip()
        if l[-1] in '.!?»' and len(l) < 0.72 * ancho: partes.append(actual); actual = ''
    if actual: partes.append(actual)
    # al final puede colarse el título de una sección o el nombre de la entrada siguiente: línea corta sin puntuación
    while partes and len(partes[-1]) <= 50 and partes[-1][-1] not in FIN: partes.pop()
    return '\n\n'.join(p for p in partes if p).strip()


def sin_parentesis(n):
    return L.norm(re.sub(r'\(.*?\)|\[.*?\]', ' ', n))


def valor_de(linea):
    """los valores de la línea «Valor, Tipo» («Mayor o Menor, Personalidad» → {mayor, menor})"""
    antes = linea.split(',')[0]
    return {w for w in L.norm(antes).split() if w in ('mayor', 'menor', 'libre', 'especial', 'gratuita', 'gratuito')}


def valor_compatible(a, linea):
    a = L.norm(a)
    v = valor_de(linea)
    return not a or not v or a in v or not (a in ('mayor', 'menor') and v <= {'mayor', 'menor'})


def descripciones(ab, ents):
    """{índice de entrada: (texto, página del PDF en castellano)} para un libro con PDF en castellano"""
    ruta = os.path.join(L.ES, L.LIBROS[ab][3])
    ls = lineas_libro(ruta)
    cab = cabeceras(ls)
    # nombre de encabezado -> posiciones en cab
    por_nombre = collections.defaultdict(list)
    for n, (j, vs) in enumerate(cab):
        for nombre, ini in vs:
            por_nombre[L.norm(nombre)].append(n)
            sp = sin_parentesis(nombre)
            if sp and sp != L.norm(nombre): por_nombre[sp].append(n)

    def exactos(e):
        res = []
        for nm in {L.norm(e['es']), sin_parentesis(e['es'])}:
            if nm: res += por_nombre.get(nm, [])
        return [n for n in sorted(set(res)) if valor_compatible(e['valor'], ls[cab[n][0]][1])]

    cand = {k: exactos(e) for k, e in enumerate(ents)}
    # desfase típico entre la página en inglés y la del libro, con los nombres que salen una sola vez
    ancla = [ls[cab[h[0]][0]][0] - ents[k]['ref'] for k, h in cand.items() if len(h) == 1]
    desfase = statistics.median(ancla) if ancla else 0
    usados = {c for hh in cand.values() for c in hh}
    libres = [(c, v[0][0]) for c, (j, v) in enumerate(cab) if c not in usados]
    res = {}
    for k, e in enumerate(ents):
        h = cand[k]
        n = None
        if h:
            n = min(h, key=lambda c: abs(ls[cab[c][0]][0] - (e['ref'] + desfase)))
        else:
            # el libro lo llama de otra forma: el encabezado libre más parecido, con el mismo valor y por la zona
            nm = sin_parentesis(e['es']) or L.norm(e['es'])
            mejor = (0, None)
            for c, nombre in libres:
                if abs(ls[cab[c][0]][0] - (e['ref'] + desfase)) > 45: continue
                if not valor_compatible(e['valor'], ls[cab[c][0]][1]): continue
                r = difflib.SequenceMatcher(None, nm, sin_parentesis(nombre)).ratio()
                if r > mejor[0]: mejor = (r, c)
            if mejor[0] >= 0.84: n = mejor[1]
        if n is None: continue
        j, vs = cab[n]
        ini = vs[0][1]
        for nombre, ii in vs:   # la variante de nombre que casó da la página del encabezado
            if L.norm(nombre) in (L.norm(e['es']), sin_parentesis(e['es'])): ini = ii
        fin = cab[n + 1][1][0][1] if n + 1 < len(cab) else min(len(ls), j + 80)
        fin = min(fin, j + 140)
        texto = cuerpo(ls, j, fin, e)
        if len(texto) >= 25: res[k] = (texto, ls[ini][0])
    return res


def renombrar():
    """aplica herramientas/nombres_libros.json (nombres que el libro en castellano llama de otra forma, revisados a mano)
    a data/ayudas.json: la fila pasa a llamarse como el libro; si «Original» estaba mal puesta («Mágico», «Feérico», vacía), se
    queda con el nombre de antes (que era el inglés). Los nombres viejos se guardan como alias para que las fichas que los
    usan sigan encontrando la entrada."""
    ruta = os.path.join(L.RAIZ, 'data', 'ayudas.json')
    raw = open(ruta, encoding='utf8', newline='').read()
    d = json.loads(raw)
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    lista = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nombres_libros.json'), encoding='utf8'))
    por = {(x['ab'], x['es'], x['pag'], x['en'], x['tipo'], x['valor']): x['nuevo'] for x in lista}
    alias = doc.setdefault('alias', {})
    por_pag = {(x['ab'], x['es'], x['pag']): x['nuevo'] for x in lista}
    n = 0
    for sh in doc['sheets']:
        for b in sh['blocks']:
            if b['t'] != 'table': continue
            if sh['id'] in ('animales', 'seres-sobrenaturales'):
                # hojas con los nombres en inglés y sin columna «Original»: se añade (en segunda posición) para no perder el término inglés
                if 'Original' not in b['cols']:
                    b['cols'].insert(1, 'Original')
                    for r in b['rows']: r.insert(1, '')
                    b['filters'] = [i + 1 for i in b.get('filters', [])]
                    b['long'] = [i + 1 for i in b.get('long', [])]
                    if 'nw' in b: b['nw'] = [i + 1 for i in b['nw']]
                pi = next(i for i, c in enumerate(b['cols']) if c.startswith('P') and 'g' in c)
                for r in b['rows']:
                    ab = r[pi].split(' ')[0] if r[pi] else ''
                    nuevo = por_pag.get((ab, r[0], r[pi]))
                    if not nuevo or nuevo == r[0]: continue
                    if not r[1]: r[1] = r[0]
                    r[0] = nuevo
                    n += 1
                continue
            if sh['id'] not in ('virtudes', 'defectos'): continue
            for r in b['rows']:
                ab = r[5].split(' ')[0] if r[5] else ''
                nuevo = por.get((ab, r[0], r[5], r[1], r[2], r[3]))
                if not nuevo or nuevo == r[0]: continue
                if r[1] in ('', 'Mágico', 'Feérico'): r[1] = r[0]
                if L.norm(r[0]) != L.norm(nuevo): alias[r[0]] = nuevo
                r[0] = nuevo
                n += 1
    if n:
        fin = raw[len(raw.rstrip('\r\n')):]
        with open(ruta, 'w', encoding='utf8', newline='') as fh:
            fh.write(json.dumps(d, ensure_ascii=False, separators=(',', ':')) + fin)
    print('renombradas %d filas (alias: %d)' % (n, len(alias)))


def main():
    escribir = '--escribir' in sys.argv
    if escribir: renombrar()
    todas = L.entradas()
    por = collections.defaultdict(list)
    for e in todas: por[e['ab']].append(e)
    claves = {}
    for ab, (slug, nombre, trozo, esf) in L.LIBROS.items():
        if not esf or not por.get(ab): continue
        if ab == 'BCoC': continue   # sus entradas no llevan «Valor, Tipo»: no hay encabezado que localizar
        d = descripciones(ab, por[ab])
        print('%-7s %3d de %3d' % (ab, len(d), len(por[ab])))
        for k, (t, p) in d.items():
            e = por[ab][k]
            claves[(ab, e['es'], e['pag'], e['en'], e['tipo'], e['valor'])] = (t, p)
    print('total', len(claves))
    if not escribir:
        for (ab, nom, pag, *_), (t, p) in list(claves.items())[:3]: print('\n#', nom, pag, 'pdf', p, '\n', t[:600])
        return
    # data/ayudas.json: columnas Resumen y Descripción
    ruta = os.path.join(L.RAIZ, 'data', 'ayudas.json')
    raw = open(ruta, encoding='utf8', newline='').read()
    d = json.loads(raw)
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    n = 0
    for sh in doc['sheets']:
        for b in sh['blocks']:
            if b['t'] != 'table' or sh['id'] not in ('virtudes', 'defectos'): continue
            cols = b['cols']
            if 'Resumen' not in cols:
                cols[6] = 'Resumen'
                cols.append('Descripción')
                b['long'] = sorted(set(b.get('long', [])) | {6, 7})
            for r in b['rows']:
                while len(r) < 8: r.append('')
                ab = r[5].split(' ')[0] if r[5] else ''
                r[7] = (claves.get((ab, r[0], r[5], r[1], r[2], r[3])) or ('', 0))[0]
                if r[7]: n += 1
    fin = raw[len(raw.rstrip('\r\n')):]
    with open(ruta, 'w', encoding='utf8', newline='') as fh:
        fh.write(json.dumps(d, ensure_ascii=False, separators=(',', ':')) + fin)
    print('escritas', n, 'descripciones en data/ayudas.json')
    # data/libros.json: la página en castellano que sale del encabezado manda sobre la de enlaces_libros.py
    rl = os.path.join(L.RAIZ, 'data', 'libros.json')
    lj = json.load(open(rl, encoding='utf8'))
    cambios = 0
    for (ab, nom, pag, *_), (t, p) in claves.items():
        k = '%s|%s|%s' % (ab, nom, pag)
        if lj['es'].get(k) != p: lj['es'][k] = p; cambios += 1
    with open(rl, 'w', encoding='utf8', newline='\n') as fh:
        json.dump(lj, fh, ensure_ascii=False, separators=(',', ':'))
    print('libros.json: %d páginas en castellano (%d nuevas o cambiadas)' % (len(lj['es']), cambios))


if __name__ == '__main__':
    main()
