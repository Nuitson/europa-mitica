#!/usr/bin/env python3
"""Enlaces de la columna «Pág.» del compendio de virtudes y defectos a los PDF de los libros.

    python herramientas/enlaces_libros.py [--copiar] [--es CARPETA] [--en CARPETA]

Qué hace:
  1. Comprueba, libro a libro, que el número de página del compendio es la página del PDF en inglés (busca el
     nombre inglés de cada entrada y mide el desfase; tiene que salir 0).
  2. Para los libros que están en castellano, busca en qué página del PDF en castellano está cada entrada (la
     paginación cambia según la entrada, no hay un desfase fijo): nombre en castellano + palabras de la descripción,
     dentro de una ventana, y descarta lo que no sigue la tendencia del libro. Lo que no se puede asegurar se
     queda sin página en castellano y la web enlaza al PDF en inglés.
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
    'HoH:TL': ('hoh-tl', 'Houses of Hermes: True Lineages', 'True Lineages', None),
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
}
# sin PDF propio con la abreviatura de otra hoja: «Grogs» y «Gr» son el mismo libro
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


def resolver_es(pgs, ents):
    """página del PDF en castellano de cada entrada (o None), por nombre + descripción dentro de una ventana"""
    # desfase típico del libro, con las entradas de nombre único
    c = collections.Counter()
    for e in ents:
        nn = nombre_buscable(e['es'])
        if len(nn) < 6: continue
        hits = [i + 1 for i, t in enumerate(pgs) if re.search(r'\b' + re.escape(nn) + r'\b', t)]
        if len(hits) <= 3:
            for h in hits: c[round((h - e['ref']) / 5) * 5] += 1
    if not c: return {}
    centro = c.most_common(1)[0][0]
    res = {}
    for k, e in enumerate(ents):
        nn = nombre_buscable(e['es'])
        pal = palabras(e['desc'])
        mejor = None
        for p in range(max(1, e['ref'] + centro - 45), min(len(pgs), e['ref'] + centro + 60) + 1):
            t = pgs[p - 1]
            # el encabezado de la entrada es «Nombre Valor, Tipo» (Menor/Mayor/Libre/Especial); una simple mención no vale
            cab = r'\b' + re.escape(nn) + r'\b.{0,50}?\b' + (re.escape(norm(e['valor'])) if e['valor'] else '(mayor|menor|libre|especial)') + r'\b'
            if not re.search(cab, t): continue
            punt =3 + (3 * sum(1 for w in pal if w in t) / len(pal) if pal else 0)
            if mejor is None or punt > mejor[0]: mejor = (punt, p)
        if mejor and mejor[0] >= 3.6: res[k] = mejor[1]
    # tendencia: dentro del libro, castellano e inglés avanzan juntos; se descarta lo que se aparta
    pts = sorted((ents[k]['ref'], p, k) for k, p in res.items())
    ok = {}
    for i, (r, p, k) in enumerate(pts):
        vec = [pp - rr for rr, pp, kk in pts[max(0, i - 6):i + 7] if kk != k]
        if len(vec) >= 3 and abs((p - r) - statistics.median(vec)) <= 6: ok[k] = p
    return ok


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
        if not ents: continue
        en_f = buscar_pdf_en(trozo)
        n, off = desfase_en(paginas(os.path.join(EN, en_f)), ents)
        linea = '%-7s %-6d %s' % (ab, len(ents), '%s de %d' % (off, n))
        if not off or off[0][0] != 0 or off[0][1] < max(2, 0.3 * n): problemas.append(ab)
        info = {'slug': slug, 'nombre': nombre, 'en': 'libros/en/%s.pdf' % slug, '_en': en_f, '_es': esf}
        if esf:
            ok = resolver_es(paginas(os.path.join(ES, esf)), ents)
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
            if not f or (sub, info['slug']) in hechos: continue
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
