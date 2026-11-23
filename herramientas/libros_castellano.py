#!/usr/bin/env python3
"""Virtudes y defectos de un libro en castellano cuyo compendio tenía nombres traducidos por nuestra cuenta.

    python herramientas/libros_castellano.py AB [--pdf RUTA] [--escribir]

descripciones_libros.py casa cada entrada del compendio con su encabezado en el PDF en castellano por el nombre, y eso solo
funciona cuando el compendio ya usa los nombres del libro. En los libros de aquí el compendio los tradujo por su cuenta
(«Patrimonio de los héroes» es «Legado Heroico» en el libro), así que se casan por otras pistas:
  1. el nombre exacto, como allí;
  2. si no, el encabezado libre con el mismo valor y tipo, por la zona del libro que toca (la página inglesa más el desfase
     de las exactas) y cuyo texto comparte más palabras con nuestro resumen, más el parecido del nombre;
  3. a mano, en LIBROS_ES[AB]['casar'], lo que las pistas no resuelven o resuelven mal (revisado contra el PDF inglés).

Sin --escribir enseña lo casado por parecido y lo que queda sin casar, para revisarlo. Con --escribir:
  - data/ayudas.json: cada entrada casada pasa a llamarse como el libro (el nombre de antes queda como alias), recibe su
    texto en la columna «Descripción» y, si el libro le da otro valor (Mayor/Menor), el valor y el tipo del libro;
    las filas repetidas de LIBROS_ES[AB]['repetidas'] se quitan (su nombre queda como alias de la buena);
  - data/libros.json: el PDF en castellano del libro, su título en castellano y la página de cada entrada;
  - libros/es/<slug>.pdf: la copia del PDF (con --pdf);
  - herramientas/nombres_libros.json: los cambios de nombre, como los demás.
Se puede repetir: lo que ya tiene el nombre del libro casa por nombre exacto.

Libros sin entradas en el compendio (LIBROS_ES[AB]['nuevas'], como El Tribunal de Iberia, que solo existe en castellano):
se leen todos los encabezados de su sección de virtudes y defectos y se añaden como filas nuevas, con el texto del libro,
un resumen (su primera frase) y la página impresa (la del PDF menos LIBROS_ES[AB]['desfase']).

Los libros de aquí no los toca descripciones_libros.py ni enlaces_libros.py (L.PROPIOS), para no deshacer lo casado.
"""
import difflib, json, os, re, shutil, statistics, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enlaces_libros as L
import descripciones_libros as D

# abreviatura -> PDF en castellano (en la carpeta de --es o en libros/es), título, casados a mano y filas repetidas
LIBROS_ES = {
    'HoH:TL': {
        'nombre': 'Casas de Hermes: Castas',
        'casar': {   # nombre en el compendio -> encabezado del libro
            'Patrimonio de los héroes': 'Legado Heroico',   # Heroes' Birthright
            'Magia ajustada': 'Magia Conectiva',            # Fettered Magic
            'Magia Atada': 'Magia Caduca',                  # Bound Magic
        },
        'repetidas': {'Patrimonio Heroico': 'Legado Heroico'},   # la misma virtud que «Patrimonio de los héroes», con «Gratuita» por nombre inglés
    },
    # libro en castellano sin edición inglesa: sus virtudes y defectos no estaban en el compendio y se añaden enteros desde su
    # sección «Nuevas Virtudes y Defectos» (páginas del PDF); el libro impreso va una página por detrás del PDF
    'TdI': {'nombre': 'El Tribunal de Iberia', 'nuevas': (307, 310), 'desfase': 1,
            'nombres': {'SiḤr': 'Siḥr'}},   # el encabezado del PDF sale con la H mayúscula; el índice del libro dice «Siḥr»
}
EXTRA = {'heroica', 'heroico', 'estatus', 'social'}
STOP = set('para como pero cuando donde sobre entre desde hasta tiene tienen puede pueden cada otra otros otras esta este '
           'estos estas personaje mago maga magus magi puntos tirada tiradas bono virtud defecto'.split())
# encabezados con el tipo delante del valor («Hermética, Menor»)
TV = re.compile(r'^([^\W\d_][^,]{2,30}), ((?:Mayor|Menor|Libre|Gratuit[ao]|Especial)(?: o (?:Mayor|Menor))?)\b(.*)$')


def lineas(ruta):
    ls = [(p, unicodedata.normalize('NFC', l)) for p, l in D.lineas_libro(ruta)]
    for i, (p, l) in enumerate(ls):
        m = TV.match(l)
        if m and set(L.norm(m.group(1)).split()) <= D.TIPOS | EXTRA:
            ls[i] = (p, m.group(2) + ', ' + m.group(1) + m.group(3))
    return ls


D.TIPOS |= EXTRA   # para que el texto no empiece por «Heroico» cuando el tipo del libro lo escribe en masculino
FUNC = set('de la el que y e o u en los las a un una por con se su no es al del lo le te tu mi si ya ni'.split())
PARRAFO = '\n\n'


def sin_relleno(t):
    """quita los párrafos del final que no son castellano (el texto de relleno de la maqueta: «santecte piciti te, isquae…»)"""
    ps = t.split(PARRAFO)
    while ps:
        w = L.norm(ps[-1]).split()
        sueltas = sum(1 for x in w if len(x) <= 2 and x not in FUNC and not x.isdigit())   # «b u vo m»: trozos de palabras
        if w and (sum(1 for x in w if x in FUNC) / len(w) < 0.12 or sueltas / len(w) > 0.15): ps.pop()
        else: break
    return PARRAFO.join(ps)


def pal(t):
    return {w for w in L.norm(t).split() if len(w) >= 5 and w not in STOP}


def sim(a, b):
    return difflib.SequenceMatcher(None, D.sin_parentesis(a), D.sin_parentesis(b)).ratio()


def limpio(n):
    return n.rstrip('*').strip()


def titulo(ls, i):
    """la línea i es un título de sección del libro («Investigación Original», «Defectos»): corta y sin punto, y detrás
    un párrafo largo; con ella acaba la entrada anterior"""
    l = ls[i][1]
    if l in ('Virtudes', 'Defectos') or re.match(r'^Nuev[ao]s (habilidades|virtudes|defectos)\b', l, re.I): return True
    if not (3 <= len(l) <= 45) or not l[0].isupper() or l[-1] in '.,;:)»"-–' or l[-1].isdigit(): return False
    sig = next((x for _, x in ls[i + 1:i + 3] if x), '')
    return len(sig) > 60


def encabezados(ls, desde=1, hasta=10 ** 6):
    """los encabezados «Nombre / Valor, Tipo» del libro (entre esas páginas del PDF), con dónde acaba el texto de cada uno"""
    cab = [c for c in D.cabeceras(ls) if desde <= ls[c[0]][0] <= hasta]
    heads = []
    for n, (j, vs) in enumerate(cab):
        fin = cab[n + 1][1][0][1] if n + 1 < len(cab) else min(len(ls), j + 80)
        fin = next((i for i in range(j + 1, min(fin, j + 140)) if titulo(ls, i)), fin)
        names = [limpio(v[0]) for v in vs]
        heads.append({'n': n, 'name': names[0], 'names': names, 'valor': ls[j][1], 'pag': ls[vs[0][1]][0], 'j': j, 'fin': min(fin, j + 140),
                      'ini': vs[0][1], 'pw': pal(' '.join(l for _, l in ls[j:min(fin, j + 140)]))})
    return heads


def nuevas(ab, ruta):
    """libros sin entradas en el compendio (LIBROS_ES[AB]['nuevas'] = páginas del PDF de su sección de virtudes y defectos):
    [(hoja, fila del compendio, página del PDF)]"""
    cfg = LIBROS_ES[ab]
    desde, hasta = cfg['nuevas']
    ls = lineas(ruta)
    # lo que va tras el título «Defectos» de la sección son defectos
    corte = next((i for i, (p, l) in enumerate(ls) if desde <= p <= hasta and l == 'Defectos'), len(ls))
    filas = []
    for h in encabezados(ls, desde, hasta):
        valor, tipo = valor_tipo(h['valor'])
        texto = sin_relleno(D.cuerpo(ls, h['j'], h['fin'], {'tipo': tipo, 'valor': valor}))
        # resumen: las primeras frases hasta tener algo que leer («En plural, al-fuqahā.» sola no dice nada)
        resumen = ''
        for f in re.split(r'(?<=[.!?])\s+', texto.replace(PARRAFO, ' ')):
            resumen = (resumen + ' ' + f).strip()
            if len(resumen) >= 60: break
        if len(resumen) > 180: resumen = resumen[:177].rsplit(' ', 1)[0] + '…'
        pag = '%s %d' % (ab, h['pag'] - cfg.get('desfase', 0))
        nombre = cfg.get('nombres', {}).get(h['name'], h['name'])
        filas.append(('defectos' if h['j'] > corte else 'virtudes', [nombre, '', tipo, valor, cfg['nombre'], pag, resumen, texto], h['pag']))
    return filas


def casar(ab, ruta):
    """[(entrada, encabezado o None, modo, puntuación)] y los encabezados que no casan con nada"""
    cfg = LIBROS_ES[ab]
    ents = [e for e in L.entradas() if e['ab'] == ab]
    ls = lineas(ruta)
    heads = encabezados(ls)

    def tipo_ok(e, h):
        t = set(L.norm(e['tipo']).split()) & (D.TIPOS | EXTRA)
        v = set(L.norm(h['valor'][:40]).split()) & (D.TIPOS | EXTRA)
        return not t or not v or bool({x[:6] for x in t} & {x[:6] for x in v})

    asig, usados = {}, set()
    rep = cfg.get('repetidas', {})
    for k, e in enumerate(ents):   # a mano y exactos
        if e['es'] in rep: continue
        quiero = cfg.get('casar', {}).get(e['es'])
        for h in heads:
            if h['n'] in usados: continue
            if quiero:
                if L.norm(quiero) in [L.norm(x) for x in h['names']]: asig[k] = (h, 'a mano', 1.0); usados.add(h['n']); break
            elif any(D.sin_parentesis(x) == D.sin_parentesis(e['es']) for x in h['names']) and D.valor_compatible(e['valor'], h['valor']):
                asig[k] = (h, 'exacto', 1.0); usados.add(h['n']); break
    anc = sorted((ents[k]['ref'], h['pag']) for k, (h, m, _) in asig.items())

    def esperada(ref):
        if not anc: return None
        return ref + statistics.median([p - r for r, p in sorted(anc, key=lambda a: abs(a[0] - ref))[:4]])

    cands = []
    for k, e in enumerate(ents):
        if k in asig or e['es'] in rep: continue
        ew = pal(e['desc']) | pal(e['es'])
        p0 = esperada(e['ref'])
        for h in heads:
            if h['n'] in usados: continue
            s = max(sim(e['es'], x) for x in h['names'])
            okv = D.valor_compatible(e['valor'], h['valor']) and tipo_ok(e, h)
            if not okv and s < 0.9: continue   # otro valor o tipo: solo con el nombre casi igual (el compendio tenía alguno mal)
            if p0 is not None and abs(h['pag'] - p0) > 40 and s < 0.9: continue
            ov = len(ew & h['pw']) / max(4, len(ew))
            pen = 0 if p0 is None else min(abs(h['pag'] - p0), 40) / 80
            cands.append((ov + 0.6 * s - pen - (0 if okv else 0.2), k, h['n']))
    for punt, k, n in sorted(cands, reverse=True):
        if k in asig or n in usados or punt < 0.45: continue
        asig[k] = (heads[n], 'parecido', round(punt, 2)); usados.add(n)
    res = []
    for k, e in enumerate(ents):
        h, modo, punt = asig.get(k, (None, '', 0))
        texto = sin_relleno(D.cuerpo(ls, h['j'], h['fin'], e)) if h else ''
        res.append((e, h, modo, punt, texto))
    return res, [h for h in heads if h['n'] not in usados]


def valor_tipo(linea):
    """«Menor, Hermético Te criaste…» -> ('Menor', 'Hermética')"""
    v, _, t = linea.partition(',')
    tipo = ' '.join(w for w in t.split()[:2] if L.norm(w) in D.TIPOS | EXTRA)
    tipo = {'hermetico': 'Hermética', 'heroico': 'Heroica'}.get(L.norm(tipo), tipo[:1].upper() + tipo[1:])
    return v.split()[0].capitalize(), tipo


def main():
    ab = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else None
    if ab not in LIBROS_ES: raise SystemExit('Libros que sabe hacer: ' + ', '.join(LIBROS_ES))
    slug = L.LIBROS[ab][0]
    pdf = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else L.ruta_es(ab)
    if not pdf or not os.path.exists(pdf): raise SystemExit('No encuentro el PDF en castellano: pásalo con --pdf')
    if 'nuevas' in LIBROS_ES[ab]: return main_nuevas(ab, slug, pdf)
    res, libres = casar(ab, pdf)
    print('%s: %d entradas, casadas %d (%d por parecido: revisar)' % (ab, len(res), sum(1 for r in res if r[1]), sum(1 for r in res if r[2] == 'parecido')))
    for e, h, modo, punt, t in res:
        if modo == 'parecido': print('  %.2f  %-32s -> %-32s pág. %-4s (%s)' % (punt, e['es'], h['name'], h['pag'], e['en']))
    for e, h, modo, punt, t in res:
        if not h and e['es'] not in LIBROS_ES[ab].get('repetidas', {}): print('  sin casar: %s (%s, %s, %s)' % (e['es'], e['en'], e['valor'], e['pag']))
    for h in libres: print('  encabezado sin entrada: %s | %s' % (h['name'], h['valor'][:40]))
    if '--escribir' not in sys.argv: return

    ruta = os.path.join(L.RAIZ, 'data', 'ayudas.json')
    raw = open(ruta, encoding='utf8', newline='').read()
    d = json.loads(raw)
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    alias = doc.setdefault('alias', {})
    nl_ruta = os.path.join(L.RAIZ, 'herramientas', 'nombres_libros.json')
    nl = json.load(open(nl_ruta, encoding='utf8'))
    rl = os.path.join(L.RAIZ, 'data', 'libros.json')
    lj = json.load(open(rl, encoding='utf8'))
    por = {(e['es'], e['pag'], e['en'], e['tipo'], e['valor']): (h, t) for e, h, m, p, t in res if h}
    rep = LIBROS_ES[ab].get('repetidas', {})
    n = cambios = 0
    for sh in doc['sheets']:
        if sh['id'] not in ('virtudes', 'defectos'): continue
        for b in sh['blocks']:
            if b['t'] != 'table': continue
            quitar = []
            for r in b['rows']:
                if not r[5].startswith(ab + ' '): continue
                if r[0] in rep: quitar.append(r); alias[r[0]] = rep[r[0]]; continue
                x = por.get((r[0], r[5], r[1], r[2], r[3]))
                if not x: continue
                h, t = x
                viejo = (r[0], r[2], r[3])
                # «Sangre Feérica (Boina Roja)» es «Sangre Feérica» en el libro: el paréntesis la distingue de la del básico, se queda
                mismo = D.sin_parentesis(h['name']) == D.sin_parentesis(r[0]) and '(' in r[0] and '(' not in h['name']
                if h['name'] != r[0] and not mismo:
                    nl.append({'ab': ab, 'es': r[0], 'pag': r[5], 'en': r[1], 'tipo': r[2], 'valor': r[3], 'nuevo': h['name']})
                    if L.norm(r[0]) != L.norm(h['name']): alias[r[0]] = h['name']
                    lj['es'].pop('%s|%s|%s' % (ab, r[0], r[5]), None)
                    r[0] = h['name']
                if not D.valor_compatible(r[3], h['valor']): r[3], r[2] = valor_tipo(h['valor'])
                if t: r[7] = t; n += 1
                lj['es']['%s|%s|%s' % (ab, r[0], r[5])] = h['pag']
                if (r[0], r[2], r[3]) != viejo: cambios += 1; print('  %s -> %s' % (' · '.join(viejo), ' · '.join((r[0], r[2], r[3]))))
            for r in quitar: b['rows'].remove(r); print('  quitada fila repetida:', r[0])
    with open(nl_ruta, 'w', encoding='utf8', newline='\n') as fh: fh.write(json.dumps(nl, ensure_ascii=False, indent=1) + '\n')
    guardar(ab, slug, pdf, raw, d, lj)
    print('escrito: %d textos, %d nombres/valores cambiados' % (n, cambios))


def guardar(ab, slug, pdf, raw, d, lj):
    """data/ayudas.json, la copia del PDF en libros/es y data/libros.json (su PDF en castellano y su título)"""
    fin = raw[len(raw.rstrip('\r\n')):]
    with open(os.path.join(L.RAIZ, 'data', 'ayudas.json'), 'w', encoding='utf8', newline='') as fh:
        fh.write(json.dumps(d, ensure_ascii=False, separators=(',', ':')) + fin)
    dst = os.path.join(L.RAIZ, 'libros', 'es', slug + '.pdf')
    # only when missing: the copy in libros/es may be a compressed one (same pages) that must not be overwritten
    if not os.path.exists(dst):
        shutil.copyfile(pdf, dst); print('  copiado el PDF a libros/es/%s.pdf' % slug)
        if os.path.getsize(dst) > 100 * 1024 * 1024:
            print('  OJO: pasa de 100 MB y GitHub no lo admite; comprímelo (mismas páginas) antes de subirlo')
    lj['libros'].setdefault(ab, {'slug': slug})
    lj['libros'][ab]['es'] = 'libros/es/%s.pdf' % slug
    lj['libros'][ab]['nombre'] = LIBROS_ES[ab]['nombre']
    with open(os.path.join(L.RAIZ, 'data', 'libros.json'), 'w', encoding='utf8', newline='\n') as fh:
        json.dump(lj, fh, ensure_ascii=False, separators=(',', ':'))


def main_nuevas(ab, slug, pdf):
    filas = nuevas(ab, pdf)
    for hoja in ('virtudes', 'defectos'):
        print('%s: %d' % (hoja, sum(1 for f in filas if f[0] == hoja)))
        for h, r, p in filas:
            if h == hoja: print('  %-34s %-6s %-16s %-9s %5d letras | %s' % (r[0], r[3], r[2], r[5], len(r[7]), r[6][:70]))
    if '--escribir' not in sys.argv: return
    ruta = os.path.join(L.RAIZ, 'data', 'ayudas.json')
    raw = open(ruta, encoding='utf8', newline='').read()
    d = json.loads(raw)
    doc = next(x for x in d['docs'] if x['id'] == 'virtudes-defectos')
    lj = json.load(open(os.path.join(L.RAIZ, 'data', 'libros.json'), encoding='utf8'))
    lj['es'] = {k: v for k, v in lj['es'].items() if not k.startswith(ab + '|')}
    for sh in doc['sheets']:
        if sh['id'] not in ('virtudes', 'defectos'): continue
        b = next(b for b in sh['blocks'] if b['t'] == 'table')
        b['rows'] = [r for r in b['rows'] if not r[5].startswith(ab + ' ')]   # se puede repetir: las de este libro se rehacen
        for h, r, p in filas:
            if h != sh['id']: continue
            b['rows'].append(r + [''] * (len(b['cols']) - len(r)))
            lj['es']['%s|%s|%s' % (ab, r[0], r[5])] = p
    guardar(ab, slug, pdf, raw, d, lj)
    print('escrito: %d entradas nuevas' % len(filas))


if __name__ == '__main__':
    main()
