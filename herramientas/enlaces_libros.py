#!/usr/bin/env python3
"""Enlaces de la columna «Pág.» del compendio de virtudes y defectos a los PDF de los libros.

    python herramientas/enlaces_libros.py [--copiar] [--es CARPETA] [--en CARPETA]

Qué hace:
  1. Comprueba, libro a libro, que el número de página del compendio es la página del PDF en inglés (busca el
     nombre inglés de cada entrada y mide el desfase; tiene que salir 0).
  2. Para los libros que están en castellano, lee el PDF y busca la página donde empieza cada entrada (la
     paginación cambia según la entrada, no hay un desfase fijo): el encabezado «Nombre / Valor, Tipo» y, donde
     se comprobó que acierta, nombre + valor/tipo cerca dentro de una ventana. Lo que no se puede asegurar se
     queda sin página en castellano y la web enlaza solo al PDF en inglés.
  3. Con --copiar, copia los PDF a libros/en/ y libros/es/ (nombres sin espacios) y escribe data/libros.json.

Necesita pdftotext (poppler). Las carpetas por defecto son las de Dropbox del equipo.
"""
import collections, json, os, re, shutil, statistics, subprocess, sys, tempfile, unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ES = r'C:\Users\raul.trullenque\Dropbox\Rol\Ars Magica\Oficiales Castellano'
EN = r'C:\Users\raul.trullenque\Dropbox\Rol\Ars Magica\Oficiales Ingles'
for i, a in enumerate(sys.argv):
    if a == '--es': ES = sys.argv[i + 1]
    if a == '--en': EN = sys.argv[i + 1]

# abreviatura: (slug, nombre, trozo del nombre del PDF inglés, PDF castellano o None)
LIBROS = {
    'ArM': ('arm', 'Ars Magica (Libro básico)', 'Core Rulebook', 'Ars Magica  ebook.pdf'),
    'HMRE': ('hmre', 'Hedge Magic, Revised Edition', 'Hedge Magic', None),
    'HoH:MC': ('hoh-mc', 'Casas de Hermes: Cultos Mistéricos', 'Houses of Hermes - Mystery Cults', 'AM_CultosMistericos_web_baja.pdf'),
    'RoP:I': ('rop-i', 'Realms of Power: The Infernal', 'The Infernal', None),
    'RoP:D': ('rop-d', 'Realms of Power: The Divine', 'The Divine', None),
    'Gr': ('grogs', 'Grogs', 'Grogs', None),
    'Grogs': ('grogs', 'Grogs', 'Grogs', None),
    'TMRE': ('tmre', 'The Mysteries, Revised Edition', 'The Mysteries (Revised)', None),
    'HoH:TL': ('hoh-tl', 'Casas de Hermes: Castas', 'True Lineages', 'AM5_Castas_web.pdf'),
    'TC&TC': ('tctc', 'The Cradle and the Crescent', 'The Cradle', None),
    'RoP:F': ('rop-f', 'Reinos de Poder: Feérico', 'Realms Of Power - Faerie', 'Reinos de Poder Feérico - Traduccion Fan.pdf'),
    'RoP:M': ('rop-m', 'Reinos de Poder: Magia', 'Realms Of Power - Magic', 'AM5_RdPM_web.pdf'),
    'RM': ('rm', 'Rival Magic', 'Rival Magic', None),
    'App': ('app', 'Aprendices', 'Apprentices', 'Aprendices - Traduccion Fan.pdf'),
    'HoH:S': ('hoh-s', 'Casas de Hermes: Societates', 'Societates', 'AM_societates_LIBRO_WEB.pdf'),
    'A&A': ('aa', 'Art & Academe', 'Art & Academe', None),
    'C&G': ('cg', 'City & Guild', 'City & Guild', None),
    'AnM': ('anm', 'Ancient Magic', 'Ancient Magic', None),
    'AtD': ('atd', 'Against the Dark', 'Against the Dark', None),
    'TC': ('tc', 'The Church', 'The Church', None),
    'GotF': ('gotf', 'Guardians of the Forests', 'Guardians of the Forests', None),
    'TSE': ('tse', 'The Sundered Eagle', 'Sundered Eagle', None),
    'BCoC': ('bcoc', 'Calebais: la alianza rota', 'Calebais', 'Ars Magica - Calebais ebook.pdf'),
    'L&L': ('ll', 'The Lion and the Lily', 'Lion and the Lily', None),
    'MoH': ('moh', 'Magi of Hermes', 'Magi Of Hermes', None),
    'LoH': ('loh', 'Legends of Hermes', 'Legends of Hermes', None),
    'LoM': ('lom', 'Lords of Men', 'Lords Of Men', None),
    'Ant': ('ant', 'Antagonists', 'Antagonists', None),
    'ToME': ('tome', 'Tales of Mythic Europe', 'Tales Of Mythic', None),
    # solo en castellano (sin PDF inglés): sus entradas las añade libros_castellano.py
    'TdI': ('tdi', 'El Tribunal de Iberia', None, 'AM_tribunaliberia_WEB.pdf'),
}
# sin PDF propio con la abreviatura de otra hoja: «Grogs» y «Gr» son el mismo libro
# libros que casa y rellena libros_castellano.py (el compendio los tenía con nombres traducidos por nuestra cuenta): esta
# herramienta y descripciones_libros.py no recalculan sus páginas ni sus textos, para no deshacer lo casado
PROPIOS = {'HoH:TL', 'TdI', 'HoH:MC', 'TMRE', 'HoH:S', 'RoP:M'}


def ruta_es(ab):
    """el PDF en castellano del libro: el de la carpeta ES o, si no está ahí, la copia de libros/es"""
    esf = LIBROS[ab][3]
    if not esf: return None
    for r in (os.path.join(ES, esf), os.path.join(RAIZ, 'libros', 'es', LIBROS[ab][0] + '.pdf')):
        if os.path.exists(r): return r
    return os.path.join(ES, esf)
STOP = set('para como pero cuando donde sobre entre desde hasta tiene tienen puede pueden cada otra otros otras esta este estos estas'.split())


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


CACHE = os.path.join(tempfile.gettempdir(), 'em-pdfcache')


def paginas(ruta):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, re.sub(r'\W', '_', os.path.basename(ruta)) + '.txt')
    if not os.path.exists(f):
        subprocess.run(['pdftotext', '-enc', 'UTF-8', '-layout', ruta, f], check=True)
    return [norm(x) for x in open(f, encoding='utf8', errors='ignore').read().split('\f')]


def buscar_pdf_en(trozo):
    for f in sorted(os.listdir(EN)):
        if trozo.lower() in f.lower() and f.lower().endswith('.pdf'): return f
    raise SystemExit('No hay PDF inglés para «%s» en %s' % (trozo, EN))


def nombre_buscable(n):
    sin = norm(re.sub(r'\(.*?\)|\[.*?\]', ' ', n))
    return sin if len(sin) >= 6 else norm(n)


def entradas():
    d = json.load(open(os.path.join(RAIZ, 'data', 'ayudas.json'), encoding='utf8'))
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    out = []
    for sh in doc['sheets']:
        for b in sh['blocks']:
            if b['t'] != 'table': continue
            cols = b['cols']
            pi = [i for i, c in enumerate(cols) if c.startswith('P') and 'g' in c]
            if not pi or len(cols) < 7: continue
            for r in b['rows']:
                m = re.match(r'^(\S+)\s+(\d+)', r[pi[0]] or '')
                if m and m.group(1) in LIBROS:
                    out.append({'ab': m.group(1), 'es': r[0], 'en': r[1], 'ref': int(m.group(2)), 'desc': r[6], 'pag': r[pi[0]], 'valor': r[3], 'tipo': r[2]})
    return out


def desfase_en(pgs, ents):
    c = collections.Counter(); n = 0
    for e in ents:
        nn = nombre_buscable(e['en'] or '')
        if len(nn) < 6: continue
        n += 1
        for i, t in enumerate(pgs):
            if re.search(r'\b' + re.escape(nn) + r'\b', t) and -5 <= i + 1 - e['ref'] <= 120: c[i + 1 - e['ref']] += 1
    return n, c.most_common(3)


def palabras(desc):
    return {w for w in norm(desc).split() if len(w) >= 6 and w not in STOP}


def paginas_crudas(ruta):
    """texto del PDF en orden de lectura (sin maquetar en columnas): cada entrada aparece como «Nombre / Valor, Tipo / texto»"""
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, 'raw_' + re.sub(r'\W', '_', os.path.basename(ruta)) + '.txt')
    if not os.path.exists(f):
        subprocess.run(['pdftotext', '-enc', 'UTF-8', ruta, f], check=True)
    return [norm(x) for x in open(f, encoding='utf8', errors='ignore').read().split('\f')]


def cabeceras(pgs, e):
    """páginas donde aparece el encabezado de la entrada: «Nombre Valor Tipo» (o solo «Nombre Valor»)"""
    nombres = [norm(e['es'])]
    sin = norm(re.sub(r'\(.*?\)|\[.*?\]', ' ', e['es']))
    if len(sin) >= 4 and sin != nombres[0]: nombres.append(sin)
    val = norm(e['valor'])
    tipo = (norm(e['tipo']).split() or [''])[0]
    for nm in nombres:
        for con_tipo in (True, False):
            v = re.escape(val) if val else '(?:mayor|menor|libre|especial)'
            pat = r'\b' + re.escape(nm) + ' ' + v + ((' ' + re.escape(tipo)) if con_tipo and tipo else '') + r'\b'
            hits = [i + 1 for i, t in enumerate(pgs) if re.search(pat, t)]
            if hits: return hits
    return []


def tendencia(anclas, ref):
    cerca = [p - r for r, p in anclas if abs(r - ref) <= 25]
    if len(cerca) < 3: cerca = [p - r for r, p in sorted(anclas, key=lambda a: abs(a[0] - ref))[:5]]
    return statistics.median(cerca) if cerca else None


# qué métodos valen en cada libro (medido contra entradas con encabezado seguro):
#   cab = encabezado exacto; ven = nombre + valor/tipo cerca, en una ventana alrededor de la tendencia del libro;
#   desc = nombre + palabras de la descripción. En los libros donde «ven» fallaba demasiado, solo «cab».
METODOS = {'ArM': ('cab', 'ven'), 'HoH:MC': ('cab', 'ven'), 'RoP:M': ('cab', 'ven'), 'App': ('cab', 'ven'),
           'RoP:F': ('cab',), 'HoH:S': ('cab',), 'BCoC': ('cab', 'ven', 'desc')}


def resolver_es(pgs, ents, ab):
    """página del PDF en castellano de cada entrada (índice -> página); lo que no se puede asegurar no sale"""
    metodos = METODOS.get(ab, ('cab',))
    cand = {k: cabeceras(pgs, e) for k, e in enumerate(ents)}
    unicas = [(ents[k]['ref'], h[0], k) for k, h in cand.items() if len(h) == 1]
    res = {}
    for k, h in cand.items():
        if not h: continue
        otras = [(r, p) for r, p, kk in unicas if kk != k]
        t = tendencia(otras, ents[k]['ref'])
        if t is None:
            if len(h) == 1: res[k] = h[0]   # el único encabezado del libro: sin con qué compararlo, pero es un encabezado exacto
            continue
        mejor = min(h, key=lambda p: abs(p - (ents[k]['ref'] + t)))
        if abs(mejor - (ents[k]['ref'] + t)) <= 8: res[k] = mejor
    anclas = [(ents[k]['ref'], p) for k, p in res.items()]
    if 'cab' not in metodos: res = {}
    glob = None
    if not anclas and len(metodos) > 1:   # ningún encabezado exacto: desfase típico del libro, con los nombres que salen una o dos veces
        c = collections.Counter()
        for e in ents:
            nm = nombre_buscable(e['es'])
            if len(nm) < 6: continue
            hits = [i + 1 for i, t in enumerate(pgs) if re.search(r'\b' + re.escape(nm) + r'\b', t)]
            if len(hits) <= 2:
                for h in hits: c[round((h - e['ref']) / 6) * 6] += 1
        if c: glob = c.most_common(1)[0][0]
    if (not anclas and glob is None) or len(metodos) == 1: return res
    for k, e in enumerate(ents):
        if k in res: continue
        t = tendencia(anclas, e['ref']) if anclas else glob
        nm = nombre_buscable(e['es'])
        if t is None or len(nm) < 4: continue
        val = norm(e['valor']); tipo = (norm(e['tipo']).split() or [''])[0]
        pal = palabras(e['desc'])
        mejor = None
        for p in range(max(1, int(e['ref'] + t) - 10), min(len(pgs), int(e['ref'] + t) + 10) + 1):
            m = re.search(r'\b' + re.escape(nm) + r'\b', pgs[p - 1])
            if not m: continue
            ctx = pgs[p - 1][m.end():m.end() + 80]
            cerca = bool((val and val in ctx) or (tipo and tipo in ctx))
            ov = sum(1 for w in pal if w in pgs[p - 1]) / len(pal) if pal else 0
            punt = (2 if cerca else 0) + ov * 3 - abs(p - (e['ref'] + t)) * 0.05
            if mejor is None or punt > mejor[0]: mejor = (punt, p, cerca, ov)
        if mejor and ((mejor[2] and 'ven' in metodos) or (mejor[3] >= 0.35 and 'desc' in metodos)): res[k] = mejor[1]
    return res


def main():
    copiar = '--copiar' in sys.argv
    todas = entradas()
    por = collections.defaultdict(list)
    for e in todas: por[e['ab']].append(e)
    libros, paginas_es = {}, {}
    print('%-7s %-6s %-22s %s' % ('libro', 'entr.', 'inglés: desfase', 'castellano: resueltas'))
    problemas = []
    for ab, (slug, nombre, trozo, esf) in LIBROS.items():
        ents = por.get(ab, [])
        if not ents:
            libros[ab] = {'slug': slug, 'nombre': nombre, '_en': None, '_es': None}
            continue
        en_f = buscar_pdf_en(trozo) if trozo else None   # sin edición inglesa (El Tribunal de Iberia)
        n, off = desfase_en(paginas(os.path.join(EN, en_f)), ents) if en_f else (0, [(0, 0)])
        linea = '%-7s %-6d %s' % (ab, len(ents), '%s de %d' % (off, n) if en_f else 'sin PDF inglés')
        if en_f and (not off or off[0][0] != 0 or off[0][1] < max(2, 0.3 * n)): problemas.append(ab)
        info = {'slug': slug, 'nombre': nombre, '_en': en_f, '_es': esf}
        if en_f: info['en'] = 'libros/en/%s.pdf' % slug
        if esf and ab in PROPIOS:   # sus páginas las puso libros_castellano.py: se conservan
            info['es'] = 'libros/es/%s.pdf' % slug
            antes = json.load(open(os.path.join(RAIZ, 'data', 'libros.json'), encoding='utf8'))['es']
            paginas_es.update({k: v for k, v in antes.items() if k.startswith(ab + '|')})
            linea += '   (libros_castellano.py)'
        elif esf:
            ok = resolver_es(paginas_crudas(ruta_es(ab)), ents, ab)
            info['es'] = 'libros/es/%s.pdf' % slug
            for k, p in ok.items(): paginas_es['%s|%s|%s' % (ab, ents[k]['es'], ents[k]['pag'])] = p
            linea += '   %d de %d' % (len(ok), len(ents))
        print(linea)
        libros[ab] = info
    if problemas: print('\nOJO: el desfase no es 0 en', problemas, '- revisar antes de enlazar')
    if not copiar: return
    for sub in ('en', 'es'): os.makedirs(os.path.join(RAIZ, 'libros', sub), exist_ok=True)
    hechos = set()
    for ab, info in libros.items():
        for sub, carpeta, f in (('en', EN, info['_en']), ('es', ES, info['_es'])):
            if not f or (sub, info['slug']) in hechos or not os.path.exists(os.path.join(carpeta, f)): continue
            hechos.add((sub, info['slug']))
            dst = os.path.join(RAIZ, 'libros', sub, info['slug'] + '.pdf')
            if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(os.path.join(carpeta, f)):
                shutil.copyfile(os.path.join(carpeta, f), dst)
    salida = {'libros': {ab: {k: v for k, v in i.items() if not k.startswith('_')} for ab, i in libros.items()}, 'es': paginas_es}
    with open(os.path.join(RAIZ, 'data', 'libros.json'), 'w', encoding='utf8', newline='\n') as fh:
        json.dump(salida, fh, ensure_ascii=False, separators=(',', ':'))
    print('\nCopiados %d PDF y escrito data/libros.json' % len(hechos))


if __name__ == '__main__':
    main()
