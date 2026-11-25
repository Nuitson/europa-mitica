"""Las alianzas de los libros de Tribunales: su ficha, sus textos y sus magi (con su texto y su ficha) -> data/alianzas.json
y data/alianzas/<libro>.json

    python -X utf8 herramientas/alianzas_libros.py            (prueba: lo que encuentra)
    python -X utf8 herramientas/alianzas_libros.py -v         (con los magi de cada alianza)
    python -X utf8 herramientas/alianzas_libros.py --escribir

Dónde empieza y acaba cada alianza (a la línea, no a la página: en la misma página puede acabar una y empezar otra):
- The Lion and the Lily, The Sundered Eagle y Against the Dark: el índice, con el nivel de cada entrada por su sangría (la
  versión -layout de pdftotext). Una alianza es una entrada con «History» y «Setting…» dentro; acaba en la siguiente entrada
  de su nivel o de uno mayor. Sus magi son las entradas que cuelgan de «Magi» (si el índice las trae).
  (Against the Dark no sangra bien todas las páginas: ahí acaba en la siguiente alianza o capítulo, o donde diga FIN.)
  Las tres acaban como mucho en el encabezado «Chapter …» siguiente.
- Guardians of the Forests: las alianzas, a mano (GOTF; Heorot no está en el índice: GOTF_MANO); cada una acaba en la
  entrada siguiente del índice. Sus magi: «MURION, PRIMA OF HOUSE BONISAGUS» y su perfil «Age: … Personality Traits: …».
- El Tribunal de Iberia: cada alianza (viva o en ruinas) tiene su recuadro «Vida: Fundador: Estación: Aura…»; acaba en el
  encabezado de la siguiente, en el de una región o una ciudad, en la portada del capítulo o en la página TDI_FIN. Sus magi,
  en «Los magi de X» / «Las magae de X». Lo que tras un recuadro empieza en minúscula es el texto de la alianza anterior.
- Tribunals of Hermes: Rome (tercera edición, escaneado con mal OCR): las alianzas del capítulo cinco a mano (ROMA, y las
  pequeñas de «Other Covenants», que se reparten los párrafos por el nombre que llevan); su ficha, su recuadro
  («Symbol: … Year Founded: …»); sin magi aparte (vienen en «Miembros»).
Los magi: los encabezados «Catella of House Bonisagus», «Sesnando Ex Miscellanea, mestre», «MURION, PRIMA OF HOUSE
BONISAGUS»…; su ficha, el bloque de reglas («Characteristics: …» hasta «Appearance: …»; en el Rin, «Age: … Personality
Traits: …»); su texto, lo demás. La ficha de la alianza: el recuadro de Iberia, el de Roma o lo que diga el texto (estación,
año de fundación, aura, domus magna, espíritu patrón). Necesita pdftotext (xpdf o poppler)."""
import collections, json, os, re, subprocess, sys, tempfile, unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(tempfile.gettempdir(), 'em-alianzas')

# libro -> (tribunal de la web, PDF, idioma, título, fichero de textos)
LIBROS = {
    'L&L': ('normandia', 'libros/en/ll.pdf', 'en', 'The Lion and the Lily', 'll'),
    'GotF': ('rin', 'libros/en/gotf.pdf', 'en', 'Guardians of the Forests', 'gotf'),
    'TSE': ('tebas', 'libros/en/tse.pdf', 'en', 'The Sundered Eagle', 'tse'),
    'AtD': ('transilvania', 'libros/en/atd.pdf', 'en', 'Against the Dark', 'atd'),
    'TdI': ('iberia', 'libros/es/tdi.pdf', 'es', 'El Tribunal de Iberia', 'tdi'),
    'ToH:R': ('roma', 'libros/en/toh-r.pdf', 'en', 'Tribunals of Hermes: Rome', 'toh-r'),
}
TRIB = {'normandia': 'Normandía', 'rin': 'el Rin', 'tebas': 'Tebas', 'transilvania': 'Transilvania', 'iberia': 'Iberia', 'roma': 'Roma'}
# alianzas que el índice no marca con «History» y «Setting» (vasallas dentro de la sección de otra, un capítulo entero)
EXTRA = {'L&L': {'Exspectatio', 'Spider’s Palace', 'Dragon’s Rest', 'Atramentum Renatus', 'XI. Confluensis'}}
GOTF = ['Triamore', 'Durenmar', 'Dankmar', 'Waddenzee', 'Oculus Septentrionalis', 'Fengheld', 'Crintera', 'Irencillia', 'Roznov', 'Blue Sea']
GOTF_MANO = [('Heorot', 90, 'Rügen')]   # alianzas que el índice no trae: (encabezado, página del PDF, encabezado donde acaba)
# Roma, capítulo cinco (páginas del PDF): (nombre, primera, última, página de su recuadro «Symbol: … Season: …» o None).
# Las cinco pequeñas de «Other Covenants» comparten páginas: su texto se reparte por la alianza que nombra cada párrafo.
ROMA = [('Harco', 61, 68, None), ('Literatus', 69, 75, 68), ('Magvillus', 76, 82, 76), ('Rellantali', 83, 87, None), ('Verdi', 88, 94, 87)]
ROMA_OTRAS = [('Luctatio', 'Luctatio'), ('Postestas', 'Postestas'), ('Vardian’s Tomb', 'Vardian'), ('Sansaron', 'Sansaron'), ('Feritel', 'Feritel')]
ROMA_CAMPOS = r'(Symbo\w*|Season|Year Founded|House Affiliation|Aura|Members|Number of Grogs|A[nr]+a?ments)\s*:'
NOMBRE = {'The Ladies of Thessaloniki': 'Oikos tou Eleous', 'XI. Confluensis': 'Confluensis'}

CASAS = r'(Bjornaer|Bonisagus|Criamon|Flambeau|Guernicus|Jerbiton|Mercere|Merinita|Tremere|Tytalus|Verditius|Ex Miscellanea|Miscellanea)'
MAGO = re.compile(r'^([A-ZÁÉÍÓÚÑĂŶʿʾ][\w’\'´ .\-ʾʿ]{1,45}?),?\s+(?:(?:filius|filia) [\w ]{2,30}? |(?:[Ff]ollower|Prima|Primus|Princeps|Member|Magus|Maga|Archmage|Archmagus) )?(?:of House|of the House|of|ex|Ex|de la Casa|de)\s+' + CASAS + r'\b(.{0,60})$')
# El Tribunal de Iberia: «Lacerta Bjornaer», «Archimagus Raḥûm al-Tŷtalī», «Orraca al-Merkeriyya (Boina Roja)»
MAGO_ES = re.compile(r'^([A-ZÁÉÍÓÚÑĂŶʿʾ][\w’\'´ .\-ʾʿ«»]{1,45}?),?\s+(?:(?:ex|Ex|de|de la Casa)\s+)?(' + CASAS[1:-1] + r'|al-[^\s,]+)\b(.{0,60})$')
MAYUS = re.compile(r'^([A-ZÄÖÜÉ][A-ZÄÖÜÉ’\' .\-]{1,40}?(?: VON [A-ZÄÖÜ]+)?), ([A-Z]+) (?:OF (?:HOUSE )?|EX )' + CASAS.upper() + r'$')
ARABE = [('tyt', 'Tytalus'), ('tŷt', 'Tytalus'), ('verdit', 'Verditius'), ('merker', 'Mercere'), ('mercer', 'Mercere'), ('erbit', 'Jerbiton'),
         ('flamb', 'Flambeau'), ('bonis', 'Bonisagus'), ('bunis', 'Bonisagus'), ('guern', 'Guernicus'), ('gernik', 'Guernicus'), ('ŷern', 'Guernicus'),
         ('merin', 'Merinita'), ('tremer', 'Tremere'), ('criam', 'Criamon'), ('kriam', 'Criamon'), ('bjorn', 'Bjornaer'), ('biorn', 'Bjornaer'), ('biŷorn', 'Bjornaer'), ('biyorn', 'Bjornaer'),
         ('pral', 'Ex Miscellanea'), ('miscel', 'Ex Miscellanea')]
NO_NOMBRE = {'cuando', 'casa', 'los', 'las', 'la', 'el', 'una', 'un', 'the', 'a', 'when', 'house', 'loyal', 'seccion', 'capitulo', 'por', 'para',
             'con', 'como', 'other', 'otros', 'story', 'ideas'}
CAMPOS = ('Characteristics|Size|Age|Decrepitude|Warping Score|Confidence Score|Confidence|Virtues and Flaws|Personality Traits|Reputations|'
          'Combat|Soak|Fatigue Levels|Wound Penalties|Abilities|Arts|Twilight Scars|Equipment|Encumbrance|Spells Known|Appearance|Sigil|Vis|'
          'Características|Tamaño|Edad|Decrepitud|Puntuación de Informidad|Puntuación de Confianza|Impronta|Virtudes y Defectos|'
          'Rasgos de Personalidad|Reputaciones|Combate|Aguante|Niveles de Fatiga|Penalizaciones por Heridas|Habilidades|Artes|Equipo|Carga|'
          'Hechizos conocidos|Apariencia|Cicatrices del Crepúsculo|Objetos encantados|Notas')
CARACT = re.compile(r'^(Characteristics|Características):')
FIN_FICHA = re.compile(r'^(Appearance|Apariencia):')
CORTE = re.compile(r'^(Story Seeds?|Ideas para relatos)\b')   # recuadros con ideas de historias: van a la descripción
TERMINA = re.compile(r'[.!?»”"’)…:]\d{0,2}$')


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def pdftotext(ruta, *args, pg=None):
    os.makedirs(CACHE, exist_ok=True)
    clave = os.path.basename(ruta) + ''.join(args) + ('-%d' % pg if pg else '') + '.txt'
    txt = os.path.join(CACHE, clave)
    if not os.path.exists(txt):
        cmd = ['pdftotext', '-enc', 'UTF-8', *args] + (['-f', str(pg), '-l', str(pg)] if pg else []) + [os.path.join(RAIZ, ruta), txt]
        subprocess.run(cmd, check=True)
    return open(txt, encoding='utf8', errors='replace').read()


def paginas(ruta):
    return pdftotext(ruta).split('\f')


# ---------------------------------------------------------------- el índice, con niveles
# una entrada: el título (sin saltar a la columna de al lado: nada de tres espacios seguidos), puntos y la página
ENT = re.compile(r'([A-ZÁÉÍÓÚÑ“"\'(](?:(?!\s{3})[^\n]){0,70}?)\s?\.{2,}\s*(\d{1,3})\b')
CAP = re.compile(r'(?:^|\s{2,})((?:[IVX]+\.|Chapter \w+:?|Appendix [A-Z]:?) [A-Z](?:(?!\s{3})[^.\n]){2,40}?)(?:\s+(\d{1,3}))?(?=\s{2,}|$)')
TROZO = re.compile(r'(?:^|(?<=\s{3}))([A-ZÁÉÍÓÚÑa-z“"\'(](?:(?!\s{3})[^\n.]){2,60}?)(?=\s{3,}|$)')


def indice(ruta, pags):
    """[(nivel, título, página impresa)] en orden de lectura; nivel 0 = capítulo"""
    filas, trozos = [], {}
    for pg in range(1, 9):
        out = pdftotext(ruta, '-layout', pg=pg)
        if len(ENT.findall(out)) < 10: continue
        for i, l in enumerate(out.split('\n')):
            ocup = []
            for m in CAP.finditer(l):
                filas.append((pg, i, m.start(1), m.group(1).strip(), None, int(m.group(2)) if m.group(2) else None)); ocup.append((m.start(1), m.end()))
            for m in ENT.finditer(l):
                if any(a <= m.start(1) < b for a, b in ocup): continue
                filas.append((pg, i, m.start(1), re.sub(r'\s+', ' ', m.group(1)).strip().rstrip('.').strip(), int(m.group(2)), None)); ocup.append((m.start(1), m.end()))
            # un título largo partido en dos líneas: el trozo de arriba no tiene puntos ni página
            for m in TROZO.finditer(l):
                if not any(a <= m.start(1) < b for a, b in ocup): trozos[(pg, i, m.start(1))] = m.group(1).strip()
    # pega a cada entrada el trozo que tenga justo encima, en su columna
    unidas = []
    for pg, i, x, t, p, pc in filas:
        arriba = next((v for (q, j, y), v in trozos.items() if q == pg and j == i - 1 and abs(y - x) <= 6), None)
        if arriba and p is not None and not arriba.endswith(('.', ':')) and len(arriba) + len(t) < 90:
            t = arriba + ' ' + t
        unidas.append((pg, i, x, t, p, pc))
    # columnas, página a página (la sangría de un nivel son unos 5 caracteres)
    out = []
    for pg in sorted(set(f[0] for f in unidas)):
        fp = [f for f in unidas if f[0] == pg]
        xs = sorted(set(f[2] for f in fp))
        grupos, cur = [], [xs[0]]
        for x in xs[1:]:
            if x - cur[-1] > 15: grupos.append(cur); cur = [x]
            else: cur.append(x)
        grupos.append(cur)
        base = [min(g) for g in grupos]
        col = lambda x: max(i for i, b in enumerate(base) if x >= b - 2)
        out += [(pg, col(x), i, 0 if p is None else 1 + max(0, round((x - base[col(x)]) / 5)), t, p if p is not None else pc) for pg, i, x, t, p, pc in fp]
    out.sort(key=lambda r: (r[0], r[1], r[2]))
    return [(lvl, t, p) for _, _, _, lvl, t, p in out]


# ---------------------------------------------------------------- las líneas del libro, limpias
TDI_FIN = 275   # última página del PDF de los capítulos de los reinos (luego, «X. Tradiciones mágicas»)
ARREGLOS = {'TdI': [('Nu um', 'Nuʿum'), ('al- erbit', 'al-Ŷerbit')]}   # letras que el PDF de Iberia pierde
PORTADAS = collections.defaultdict(set)   # libro -> páginas de portada de capítulo quitadas


def lineas(ab, pags):
    """[(página del PDF, línea)] sin cabeceras, números de página ni las portadas decorativas de Iberia"""
    n = len(pags)
    cuenta = collections.Counter(l for t in pags for l in set(x.strip() for x in t.split('\n')) if l and len(l) < 45)
    sub = {'History', 'Historia', 'Magi', 'Covenfolk', 'Culture and Traditions', 'Setting and Physical Description', 'Setting and Description',
           'Ubicación y descripción', 'Sociedad y costumbres', 'Hechizos conocidos'}
    cab = {l for l, k in cuenta.items() if k > n * 0.25 and l not in sub} | {'SECCIÓN', 'CAPÍTULO'}
    out = []
    for p, t in enumerate(pags, 1):
        ls = [l.strip() for l in t.split('\n') if l.strip()]
        # portada de capítulo de Iberia: el título («IX. El Imperio almohade») y el texto en latín de adorno, en trozos
        if ab == 'TdI' and ((len(ls) > 25 and sum(1 for l in ls if len(l) < 14) > 0.6 * len(ls)) or any(re.match(r'^[IVX]+\. (El|La|Los|Las) ', l) for l in ls)):
            PORTADAS[ab].add(p); continue
        for l in ls:
            if l in cab or l.isdigit() or len(l) <= 2 or not re.search(r'[A-Za-zÀ-ÿ]', l): continue
            if ab == 'ToH:R' and sum(c.isalpha() for c in l) < 0.6 * len(l.replace(' ', '')): continue
            for a, b in ARREGLOS.get(ab, []): l = l.replace(a, b)
            out.append((p, l))
    return out


def busca(L, titulo, desde, p_ini, p_fin):
    """índice de la línea del encabezado «titulo» entre esas páginas, a partir de la línea desde"""
    k = norm(titulo)
    for i in range(desde, len(L)):
        p, l = L[i]
        if p < p_ini: continue
        if p > p_fin: break
        n = norm(l)
        if n == k or (len(l) < 90 and k and (n.endswith(' ' + k) or n.startswith(k + ' ')) and len(n) - len(k) < 40 and not TERMINA.search(l)):
            return i
        if i + 1 < len(L) and len(l) < 50 and norm(l + ' ' + L[i + 1][1]) == k: return i
    return None


# ---------------------------------------------------------------- las alianzas de cada libro
NIVELES = {'L&L', 'TSE'}   # libros cuyo índice sangra bien todas sus páginas
FIN = {('AtD', 'The Oppidum of Coeris'): 'Plot Hooks', ('AtD', 'The Oppidum of Kezdö Válasz'): 'Dragons of the Tribunal'}


def alianzas_indice(ab, L, ent):
    extra = EXTRA.get(ab, set())
    es = [t in extra or (lvl >= 1 and i + 1 < len(ent) and ent[i + 1][1].startswith('History') and any(x[1].startswith('Setting') for x in ent[i + 2:i + 5]))
          for i, (lvl, t, p) in enumerate(ent)]
    out = []
    for i, (lvl, t, p) in enumerate(ent):
        if not es[i]: continue
        fin = None
        for j in range(i + 1, len(ent)):
            lv2, t2, _ = ent[j]
            if es[j] or lv2 == 0 or (ab in NIVELES and lv2 <= lvl) or FIN.get((ab, t)) == t2: fin = j; break
        hijos = ent[i + 1:fin] if fin else ent[i + 1:i + 30]
        sig = ent[fin] if fin is not None else None
        if sig and sig[2] is None: sig = (sig[0], sig[1], next((x[2] for x in ent[fin + 1:] if x[2]), None))
        n = NOMBRE.get(t, re.sub(r'^[IVX]+\. ', '', t))
        n = re.sub(r'^The Oppid(?:um|a) of (?:the )?', '', n).rstrip('.')
        if p is None or lvl == 0:   # un capítulo entero (Confluensis): su encabezado, por su nombre, antes de su primer apartado
            p = next((h[2] for h in hijos if h[2]), None)
            if p is None: continue
            p, t = p - 3, n
        out.append({'t': t, 'n': n, 'p': p, 'lvl': lvl, 'hijos': hijos, 'sig': sig})
    return out


def secciones(ab, L, pags):
    """[{'n', 'i0', 'i1', 'hijos'}] con las líneas de L que son de cada alianza (sin las de una vasalla que tenga dentro)"""
    ruta = LIBROS[ab][1]
    res = []
    if ab in ('L&L', 'TSE', 'AtD', 'GotF'):
        ent = indice(ruta, pags)
        if ab == 'GotF':
            covs = []
            for i, (lvl, t, p) in enumerate(ent):
                if t in GOTF:
                    covs.append({'t': t, 'n': t, 'p': p, 'lvl': lvl, 'hijos': [], 'sig': ent[i + 1] if i + 1 < len(ent) else None})
            for t, p, fin in GOTF_MANO:
                covs.append({'t': t, 'n': t, 'p': p, 'lvl': 1, 'hijos': [], 'sig': (1, fin, p + 1)})
            covs.sort(key=lambda c: c['p'])
        else:
            covs = alianzas_indice(ab, L, ent)
        for c in covs:
            pdf = next((q for q in range(c['p'], c['p'] + 9) if busca(L, c['t'], 0, q, q) is not None), c['p'])
            i0 = busca(L, c['t'], 0, pdf, pdf)
            if i0 is None: print('  ! %s: no encuentro el encabezado «%s»' % (ab, c['t'])); continue
            i1 = None
            if c['sig'] and c['sig'][2]:
                i1 = busca(L, c['sig'][1], i0 + 1, pdf, c['sig'][2] + (pdf - c['p']) + 2)
            if i1 is None:
                fin = (c['sig'][2] + (pdf - c['p']) - 1) if c['sig'] and c['sig'][2] else pdf + 12
                i1 = next((k for k in range(i0, len(L)) if L[k][0] > fin), len(L))
            cap = next((k for k in range(i0 + 1, i1) if re.match(r'^Chapter (?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|\d+)\b', L[k][1])), None)
            if cap: i1 = cap
            res.append({'n': c['n'], 'i0': i0, 'i1': i1, 'hijos': c['hijos'], 'lvl': c['lvl']})
    elif ab == 'TdI':
        # los nombres de las listas «Alianzas habitadas / Alianzas en ruinas» de cada capítulo (en las portadas también)
        listas = ' '.join(norm(m.group(1)) for t in pags for m in re.finditer(r'Alianzas (?:habitadas|en ruinas)\s+([^\n]{0,160})', t))
        res = secciones_iberia(L, listas)
    elif ab == 'ToH:R':
        recuadros = roma_recuadros(L)
        for n, a, b, rp in ROMA:
            i0 = next(k for k, (p, _) in enumerate(L) if p >= a)
            i1 = next((k for k, (p, _) in enumerate(L) if p > b), len(L))
            r = next((x for x in recuadros if x['p'] == rp), None) if rp else None
            res.append({'n': n, 'i0': i0, 'i1': i1, 'hijos': [], 'roma': r})
        # las pequeñas: cada línea, a la última alianza nombrada
        a = next(k for k, (p, _) in enumerate(L) if p >= 95)
        b = next((k for k, (p, _) in enumerate(L) if p > 97), len(L))
        de = {}
        cur = None
        for k in range(a, b):
            l = L[k][1]
            pl = l.replace(' ', '').lower()
            nombradas = sorted((pl.rfind(clave.lower()), n) for n, clave in ROMA_OTRAS if clave.lower() in pl)
            if nombradas: cur = nombradas[-1][1]   # «Like Vardian’s Tomb, Feritel is…»: la última que nombra
            if cur and not re.match(ROMA_CAMPOS, l): de.setdefault(cur, []).append(k)
        orden = [x for x in recuadros if x['p'] >= 95]
        for (n, _), r in zip(ROMA_OTRAS, orden):
            ks = de.get(n, [])
            if not ks: continue
            res.append({'n': n, 'i0': ks[0], 'i1': ks[0], 'hijos': [], 'roma': r, 'lineas': ks})
    # el Rin: un recuadro «OTHER MAGI» fuera de toda sección es de la alianza anterior (hasta el siguiente título que no sea un magus)
    if ab == 'GotF':
        for k, (p, l) in enumerate(L):
            if l != 'OTHER MAGI' or any(x['i0'] <= k < x['i1'] for x in res): continue
            prev = max((x for x in res if x['i0'] < k), key=lambda x: x['i0'], default=None)
            if not prev or L[k][0] - L[prev['i1'] - 1][0] > 2: continue
            j = k + 1
            while j < len(L) and j < k + 30 and (MAYUS.match(L[j][1]) or L[j][1].startswith('Age:') or len(L[j][1]) > 60 or L[j][1][:1] in '+–-' or L[j][1][:1].islower()): j += 1
            prev.setdefault('mas', []).append((k, j))
    # una alianza dentro de la sección de otra (Exspectatio en Fudarus): fuera de la de fuera
    for s in res:
        s['fuera'] = [(o['i0'], o['i1']) for o in res if o is not s and s['i0'] < o['i0'] < s['i1']]
    return res


def roma_recuadros(L):
    """los recuadros de las alianzas de Roma (escaneados): [{p, campos: [(clave, valor)]}], en orden"""
    out = []
    años = [k for k, (p, l) in enumerate(L) if 'Year Founded' in l and (90 > p >= 58 or 98 > p >= 95)]
    for n, k in enumerate(años):
        a = max(años[n - 1] + 1 if n else 0, k - 4)
        b = min(años[n + 1] - 3 if n + 1 < len(años) else k + 7, k + 7)
        p = L[k][0]
        texto = ' '.join(re.sub(r'Symbo\w*?(?=None)', 'Symbol: ', x) for q, x in L[a:b] if re.search(ROMA_CAMPOS, x) or re.match(r'Symbo', x))
        campos = []
        partes = re.split(ROMA_CAMPOS, texto)
        for i in range(1, len(partes) - 1, 2):
            clave, valor = partes[i], partes[i + 1].strip(' .,;-—')
            nombre = {'Season': 'Estación', 'Year Founded': 'Año de fundación', 'House Affiliation': 'Casa', 'Aura': 'Aura',
                      'Members': 'Miembros', 'Number of Grogs': 'Grogs'}.get(clave, 'Símbolo' if clave.startswith('Symbo') else 'Armamento')
            if nombre == 'Estación': valor = ESTACIONES.get(valor.split()[0].lower(), valor) if valor else valor
            if nombre == 'Año de fundación':
                m = re.search(r'(\d{3,4})', valor); valor = m.group(1) if m else valor
            if nombre in ('Grogs',):
                m = re.match(r'(\d+)', valor); valor = m.group(1) if m else valor
            if nombre == 'Armamento': valor = {'Standard': 'Normal', 'Poor': 'Pobre', 'Good': 'Bueno', 'Excellent': 'Excelente'}.get(valor.split()[0], valor.split()[0]) if valor else valor
            if nombre in ('Casa', 'Símbolo'): valor = {'None': 'Ninguna' if nombre == 'Casa' else 'Ninguno'}.get(valor.split()[0] if valor else '', re.sub(r'^House ', '', valor))
            if valor and not any(c[0] == nombre for c in campos): campos.append((nombre, valor[:160]))
        out.append({'p': p, 'campos': campos})
    return out


# ---------------------------------------------------------------- Iberia: los recuadros
ETIQ = re.compile(r'^(?:(?:Vida|Fundador(?:a|es|as)?|Estación|Aura \(tipo y poder\)|Reputaciones|Votos|Blasón|Lema):\s*)+$')
TIPO = {
    'Vida': r'(?:\d{3,4}(?: \([^)]*\))?\s*-\s*(?:Actualidad|\d{3,4})(?:;\s*\d{3,4}\s*-\s*(?:Actualidad|\d{3,4}))*|Sin constituir|No llegó a constituirse)',
    'Fund': r'.+?',
    'Estación': r'(?:n/a \()?(?:Primavera|Verano|Otoño|Invierno)\)?',
    'Aura (tipo y poder)': r'(?:(?:(?:Mágica|Feérica|Divina|Infernal),? poder [^()]*?(?:\s*\([^)]*\))?)(?:\s+(?=Mágica|Feérica|Divina|Infernal))?)+|Desconocida|Ninguna',
    'Reputaciones': r'(?:Ninguna|[^()]+?\([^)]*\) -?\d+(?:\s+[^()]+?\([^)]*\) -?\d+)*)',
    'Votos': r'\d+(?: \(\d+\))?',
    'Blasón': r'.+?', 'Lema': r'.+?',
}


def recuadro(etiquetas, valores):
    """las etiquetas del recuadro, en orden, con sus valores (que pdftotext da todos seguidos en una línea)"""
    pat = []
    for k, e in enumerate(etiquetas):
        clave = 'Fund' if e.startswith('Fundador') else e
        pat.append('(?P<g%d>%s)' % (k, TIPO.get(clave, r'.+?')))
    m = re.match(r'^' + r'\s+'.join(pat) + r'\s*$', valores)
    if not m: return None
    return [(e, m.group('g%d' % k).strip()) for k, e in enumerate(etiquetas)]


def secciones_iberia(L, listas=''):
    cajas = []   # (índice del nombre, índice de «Vida:», etiquetas, valores, índices de las líneas del recuadro)
    for i, (p, l) in enumerate(L):
        if not l.startswith('Vida:'): continue
        etq, idx, j = [], [], i
        while j < len(L) and j < i + 8:
            if ETIQ.match(L[j][1]): etq += re.findall(r'(Vida|Fundador(?:a|es|as)?|Estación|Aura \(tipo y poder\)|Reputaciones|Votos|Blasón|Lema):', L[j][1]); idx.append(j); j += 1
            elif etq and j + 1 < len(L) and ETIQ.match(L[j + 1][1]) and len(L[j][1]) < 120: j += 1   # un valor suelto entre etiquetas
            else: break
        # los valores: la línea (o líneas) que siguen, hasta que casen con las etiquetas
        val, par = '', None
        for k in range(j, min(j + 4, len(L))):
            val = (val + ' ' + L[k][1]).strip()
            par = recuadro(etq, val)
            if par: idx += list(range(j, k + 1)); break
        if not par: idx.append(j)
        # el nombre: el título corto más cercano por encima (mejor si le sigue la cita del epígrafe o el recuadro)
        cand = []
        tope = cajas[-1]['vida'] if cajas else -1   # el nombre va después del recuadro anterior
        for k in range(i - 1, max(tope, i - 50), -1):
            t = L[k][1]
            if (len(t) <= 40 or (len(t) <= 60 and i - k <= 3)) and t[:1] and (t[0].isupper() or t[0] in 'ʿʾĂŶ«') and not re.search(r'[.!?»”"’…:]\d{0,2}$', t) and not ETIQ.match(t) \
                    and t not in ('Historia', 'Ubicación y descripción', 'Sociedad y costumbres') and not CORTE.match(t) and '. ' not in t:
                sig = L[k + 1][1]
                bueno = k + 1 == i or re.search(r'[.!?»”"…]\d{1,2}$', sig) or sig.startswith(('Vida:', 'Ubicación', 'Historia'))
                en_lista = len(norm(t)) > 3 and norm(re.sub(r'\s*\(.*\)', '', t)) in listas
                cand.append((0 if bueno else 1, 0 if en_lista else 1, i - k, k))
        if not cand: print('  ! Iberia: recuadro sin nombre en la página %d' % p); continue
        k = min(cand)[3]
        cajas.append({'i0': k, 'vida': i, 'par': par or [], 'crudo': None if par else val, 'caja': idx})
    # límites: el nombre de la siguiente, el encabezado de una región o ciudad, una portada de capítulo
    res = []
    propios = ('Historia', 'Ubicación y descripción', 'Sociedad y costumbres')
    for n, c in enumerate(cajas):
        fin = cajas[n + 1]['i0'] if n + 1 < len(cajas) else next((k for k, (p, _) in enumerate(L) if p > TDI_FIN), len(L))
        visto = False   # la región o ciudad que corta tiene que venir después de lo propio de la alianza (su historia…)
        for k in range(c['vida'] + 1, fin):
            if any(q in PORTADAS['TdI'] for q in range(L[k - 1][0] + 1, L[k][0] + 1)): fin = k; break   # portada de capítulo
            t = L[k][1]
            if t in propios or re.match(r'^(Los|Las) mag(i|ae) ', t): visto = True; continue
            if visto and len(t) <= 40 and t[:1].isupper() and not TERMINA.search(t) and not CORTE.match(t) and k + 1 < fin:
                sig = ' '.join(x for _, x in L[k + 1:k + 4])   # en las páginas de columnas estrechas el párrafo viene en trozos
                if len(sig) > 100 and re.match(r'^(?:(?:La|El) (?:región|unidad regional|provincia|kūra|comarca)\b|En 1220, (?:la región|.{2,40} es la capital)|Actualmente, .{2,40} alberga)', sig):
                    fin = k; break
        res.append({'n': L[c['i0']][1], 'i0': c['i0'], 'i1': fin, 'hijos': [], 'caja': c})
    for n in range(1, len(res)):
        s, prev = res[n], res[n - 1]
        k = next((k for k in range(s['i0'] + 1, s['i1']) if k not in s['caja']['caja'] and k != s['caja']['vida']), None)
        if k is None or not L[k][1][:1].islower(): continue
        propio = norm(re.sub(r'\s*\(.*\)', '', s['n']))
        m = k
        while m < s['i1'] and not (L[m][1] in propios or CORTE.match(L[m][1]) or re.match(r'^(Los|Las) mag(i|ae) ', L[m][1]) or propio in norm(L[m][1])):
            m += 1
        prev.setdefault('mas', []).append((k, m))
        s.setdefault('quitar', []).append((k, m))
    return res


# ---------------------------------------------------------------- texto: párrafos y encabezados
ABIERTA = re.compile(r'\b(en|de|del|la|el|los|las|y|o|que|a|al|con|por|para|un|una|su|sus|se|the|of|and|a|an|to|in|with|for|by|on|at|from|his|her|its)$', re.I)


def items(ls, encab=(), solo_mayus=False):
    """[('h', título) | ('p', párrafo)] con los párrafos cortados por un recuadro o un cambio de página vueltos a unir"""
    enc = {norm(x) for x in encab}
    out = []
    for k, l in enumerate(ls):
        sig = ls[k + 1] if k + 1 < len(ls) else ''
        if solo_mayus:
            es_h = len(l) <= 50 and l.isupper() and len(re.sub(r'[^A-Z]', '', l)) >= 4
        else:
            es_h = norm(l) in enc or CORTE.match(l) or (len(l) <= 60 and len(l.split()) <= 9 and (l[:1].isupper() or l[:1] in '«ʿʾĂŶ')
                                                       and not TERMINA.search(l) and not l.endswith((',', ';', '-')) and len(sig) > 60
                                                       and not sig[:1].islower() and not ABIERTA.search(l))
        out.append(('h' if es_h else 'p', l))
    # un párrafo que acaba a media frase sigue en el siguiente que empieza en minúscula (lo de en medio es un recuadro)
    i = 0
    while i < len(out):
        t, x = out[i]
        if t == 'p' and not TERMINA.search(x):
            j = next((j for j in range(i + 1, min(i + 10, len(out))) if out[j][0] == 'p' and out[j][1][:1].islower()), None)
            if j is not None:
                y = out.pop(j)[1]
                out[i] = ('p', x[:-1] + y if x.endswith('-') and x[-2:-1].isalpha() else x + ' ' + y)
                continue
        i += 1
    return out


def bloques(its):
    """[[encabezado, [párrafos]]] para la web"""
    out = []
    for t, x in its:
        if t == 'h': out.append([x, []])
        else:
            if not out: out.append(['', []])
            out[-1][1].append(x)
    return [b for b in out if b[1] or b[0]]


# ---------------------------------------------------------------- magi
def casa_de(t):
    m = re.search(CASAS, t)
    if m: return 'Ex Miscellanea' if m.group(1) == 'Miscellanea' else m.group(1)
    for g, c in (('Ierbiton', 'Jerbiton'), ('Trianom', 'Bonisagus'), ('Merinitae', 'Merinita'), ('Tytali', 'Tytalus'), ('Bonisagi', 'Bonisagus'),
                 ('Tremeris', 'Tremere'), ('Guernici', 'Guernicus'), ('Verditii', 'Verditius'), ('Criamonis', 'Criamon'), ('Mercer', 'Mercere')):
        if re.search(r'\b' + g, t): return c
    for a in re.findall(r'al-(\S+)', t):
        c = next((c for r, c in ARABE if r in a.lower()), '')
        if c: return c
    return ''


PARTICULAS = {'de', 'del', 'da', 'do', 'la', 'el', 'y', 'the', 'of', 'equitum', 'al', 'ibn', 'bint', 'ḅint', 'bat', 'ben', 'von', 'and', 'maior', 'minor',
              'mayor', 'menor', 'filius', 'filia'}


def es_nombre(n):
    ws = n.replace('«', ' ').replace('»', ' ').split()
    if not ws or len(ws) > 7 or norm(ws[0]) in NO_NOMBRE: return False
    return all(w[:1].isupper() or w[:1] in 'ʿʾĂŶḄḤṬẒ' or w.lower() in PARTICULAS or w.startswith('al-') for w in ws)


def cabecera_iberia(l):
    """los encabezados de magi de Iberia: (nombre, casa, cargo)"""
    if len(l) > 80 or re.search(r'[.;:]$', l) or l.startswith(('Los magi', 'Ideas para')) or not (l[:1].isupper() or l[:1] in 'ʿʾĂŶḄḤṬẒ'): return None
    m = re.match(r'^([A-ZÁÉÍÓÚ][\w ]+), (.+?),? (?:de la Casa|de|ex|Ex) ' + CASAS + r'\b,? ?(.*)$', l)   # «Ductor, Ouro de Flambeau, seguidor…»
    if m and es_nombre(m.group(2)):
        return m.group(2), casa_de(m.group(3)), ', '.join(x for x in (m.group(1), m.group(4).strip(' ,')) if x)
    m = re.search(r',?\s+(?:(?:de la Casa|de|ex|Ex)\s+)?' + CASAS + r'\b', l)
    if m and m.start() > 0:
        nombre, resto = l[:m.start()].strip(' ,'), l[m.end():].strip(' ,')
    elif re.search(r' (Ierbitonis|Trianomae|Merinitae|Tytali|Bonisagi|Tremeris|Guernici|Verditii|Criamonis)\b', l):
        m = re.search(r' (Ierbitonis|Trianomae|Merinitae|Tytali|Bonisagi|Tremeris|Guernici|Verditii|Criamonis)\b', l)
        nombre, resto = l[:m.start()].strip(' ,'), l[m.end():].strip(' ,')
    else:
        ws = l.split()
        als = [k for k, w in enumerate(ws) if k > 0 and w.startswith('al-')]
        casa = next((k for k in reversed(als) if casa_de(ws[k])), None)
        if casa is None: return None
        nombre, resto = ' '.join(ws[:casa]), ' '.join(ws[casa + 1:])
        m = None
    cargo = resto.strip('() ') if resto else ''
    if ', ' in nombre:   # «Sālik, Yehudá»: el cargo delante
        tit, nombre = nombre.split(', ', 1)
        cargo = ', '.join(x for x in (tit, cargo) if x)
    if not es_nombre(nombre): return None
    return nombre, casa_de(l[len(nombre):]), cargo


def cabecera_mago(l, ab):
    """(nombre, casa, cargo) si la línea es el encabezado de un magus"""
    if len(l) > 110 or l.endswith('.'): return None
    m = MAYUS.match(l)
    if m:
        nombre = re.sub(r' (Of|Von|De|La|Du|Da) ', lambda x: x.group(0).lower(), m.group(1).title())
        return nombre, casa_de(l.title()), (m.group(2).capitalize() if m.group(2) not in ('FOLLOWER', 'MEMBER', 'MAGA', 'MAGUS') else '')
    if ab == 'TdI': return cabecera_iberia(l)
    m = MAGO.match(l)
    if not m:
        m2 = re.match(r'^((?:Archmagus |Archmage )?[A-Z][\w’\' ]+?(?: of [A-Z][\w’\']+)?), (?:.+, )?(?:follower|member) of (?:House )?' + CASAS + r'$', l)
        if not m2 or not es_nombre(m2.group(1)): return None
        nombre = re.sub(r'^(?:Archmagus|Archmage) ', '', m2.group(1))
        return nombre, casa_de(m2.group(2)), ('Archmagus' if l.startswith(('Archmagus', 'Archmage')) else '')
    nombre = m.group(1).strip()
    tit = re.match(r'^.+?,?\s+((?:Prima|Primus|Princeps|Archmage|Archmagus)) ', l)
    if not es_nombre(nombre): return None
    resto = m.group(3).strip(' ,:')
    cargo = resto if resto and not resto.startswith(('(', '.')) else ''
    if tit and not cargo: cargo = tit.group(1)
    return nombre, casa_de(l[len(nombre):]), cargo


def parece_mago(t):
    """una entrada del índice que es un magus: «Nestor, Curator of Tablinum», «Theodora and Theodore», «Lexander of House Tremere»"""
    if norm(t) in PARADAS or t.startswith(('The ', 'Story', 'Plot')) or len(t.split()) > 9: return False
    return bool(MAGO.match(t)) or bool(re.match(r'^[A-Z][\w’\']+(?: [A-Z][\w’\']+)*(?:,| and [A-Z])', t))


def del_indice(t):
    """«Dominic of Tytalus, Aedile of Coeris» / «Murat the Younger, Magus Ex Miscellanea» / «Theodora and Theodore»"""
    m = re.match(r'^(.+?)(?:,? (?:Magus |Maga )?(?:of House|of|ex|Ex|House) ' + CASAS + r')(?:,\s*(.+))?$', t)
    if m: return re.sub(r',? (?:Magus|Maga)$', '', m.group(1).strip()), ('Ex Miscellanea' if m.group(2) == 'Miscellanea' else m.group(2)), (m.group(3) or '').strip()
    nombre, _, cargo = t.partition(', ')
    return nombre.strip(), casa_de(cargo), cargo.strip()


def fichas_en(ls, es_cab=lambda l: False):
    """los bloques de reglas de esas líneas: [(índice del nombre, índices del bloque, texto)]"""
    out = []
    usados = set()
    for i, l in enumerate(ls):
        if i in usados or not CARACT.search(l): continue
        k = i - 1
        while k >= 0 and (ls[k].isupper() and len(ls[k].split()) == 1): k -= 1
        if k < 0 or len(ls[k]) > 70: continue
        j = i
        while j < len(ls) and j < i + 40 and not FIN_FICHA.match(ls[j]) and not (j > i and (CARACT.search(ls[j]) or es_cab(ls[j]))): j += 1
        if j < len(ls) and FIN_FICHA.match(ls[j]): j += 1
        texto = re.sub(r'\s+', ' ', ' '.join(ls[k + 1:j]))
        if not re.search(r'\b(Arts|Artes):', texto): continue   # grogs, compañeros y criaturas: no
        texto = re.sub(r'\s+(?=(?:' + CAMPOS + r'):)', '\n', texto).strip()
        out.append((k, list(range(k, j)), texto))
        usados.update(range(k, j))
    return out


PARADAS = {'covenfolk', 'vassals', 'grogs', 'covenfolk and vassals', 'resources', 'the covenant', 'other magi', 'companions', 'specialists',
           'magical resources', 'mundane resources', 'library', 'buildings', 'culture and traditions', 'setting and physical description', 'history'}


def magi_de(ab, ls, nombres_toc, paradas=()):
    """los magi de la parte «Magi» de una alianza: [{n, casa, cargo, pi (índice), texto, ficha}] y las líneas que no son suyas"""
    paradas = set(PARADAS) | {norm(x) for x in paradas}
    F = fichas_en([l for _, l in ls], lambda l: bool(cabecera_mago(l, ab)))
    en_ficha = {k for _, idx, _ in F for k in idx}
    cabs = []   # (índice, nombre, casa, cargo)
    toc = [del_indice(t) for t in nombres_toc]
    nombre_ficha = {k for k, _, _ in F}
    primeros = {norm(re.split(r',| of | ex | de ', ls[k][1])[0]) for k in nombre_ficha}
    for k, (p, l) in enumerate(ls):
        if k in en_ficha and k not in nombre_ficha: continue
        mm = re.match(r'^([A-ZÁÉÍÓÚ][\wáéíóúñ]+), ([a-záéíóú][\wáéíóúñ ]{2,30})$', l)
        if mm and norm(mm.group(1)) in primeros and k not in nombre_ficha:
            cabs.append((k, mm.group(1), '', mm.group(2))); continue
        if toc:
            x = next((x for x in toc if norm(l) == norm(x[0]) or norm(l).startswith(norm(x[0]) + ' ')), None)
            if x and len(l) < 100: cabs.append((k, x[0], x[1] or casa_de(l), x[2])); continue
        c = cabecera_mago(l, ab)
        if c and not any(norm(c[0]) == norm(y[1]) for y in cabs): cabs.append((k,) + c)
    # los del índice que no salen como encabezado
    for x in toc:
        if not x[0]: continue
        if not any(norm(x[0]) == norm(y[1]) for y in cabs): cabs.append((None, x[0], x[1], x[2]))
    # «Disceptator Fortún» y «Fortún»: el mismo
    vistos, limpios = {}, []
    for c in cabs:
        k = norm(c[1])
        igual = next((v for kk, v in vistos.items() if kk == k or kk.endswith(' ' + k) or k.endswith(' ' + kk)), None)
        if igual:
            if len(c[1]) > len(igual[1]): limpios[limpios.index(igual)] = igual = (igual[0], c[1], igual[2] or c[2], igual[3] or c[3])
            continue
        vistos[k] = c; limpios.append(c)
    cabs = sorted(limpios, key=lambda c: (c[0] is None, c[0] if c[0] is not None else 0))
    con = [c for c in cabs if c[0] is not None]
    magos, propias = [], set()
    for n, c in enumerate(cabs):
        x = {'n': c[1], 'casa': c[2], 'cargo': c[3], 'p': ls[c[0]][0] if c[0] is not None else None, 'texto': [], 'ficha': ''}
        if c[0] is not None:
            fin = next((d[0] for d in con if d[0] > c[0]), len(ls))
            desde = c[0] + 1
            if desde < fin and norm(ls[desde][1]) in paradas:
                pila = norm(c[1]).split()[:1]
                j = next((k for k in range(desde + 1, min(fin, desde + 10)) if ls[k][1].startswith('Age:') or (pila and pila[0] in norm(ls[k][1]).split()[:6])), None)
                if j is not None: desde = j
            fin = next((k for k in range(desde, fin) if norm(ls[k][1]) in paradas), fin)
            cuerpo = [k for k in range(desde, fin) if k not in en_ficha]
            en_ficha.discard(c[0])
            # «Age: 98 (Archmage) Personality Traits: Loyal +3, …» al principio: su ficha corta (el resto de la línea, si sigue, es texto)
            x['_extra'] = []
            if cuerpo and ls[cuerpo[0]][1].startswith('Age:'):
                perfil = ' '.join(ls[k][1] for k in cuerpo[:4])
                m = re.match(r'^(Age:.*?Personality Traits:\s*(?:(?:\([^)]*\)\s*)?(?:[A-Z][\w’\'\-]*(?: [\w’\'\-]+){0,4}|[a-z][\w\-]+) [+–-] ?\d+(?:[,;]\s*|\s+|$))*'
                             r'(?:Privilege:\s*(?:\([^)]*\)\s*)?[A-Z]\w+(?:,\s*(?:\([^)]*\)\s*)?[A-Z]\w+)*\.?\s*)?)(.*)$', perfil)
                if m:
                    ficha, resto = m.group(1).strip(' ,'), m.group(2).strip()
                    # cuántas líneas se ha comido el perfil
                    usadas, largo = 0, 0
                    while usadas < min(4, len(cuerpo)) and largo + len(ls[cuerpo[usadas]][1]) <= len(ficha) + 1:
                        largo += len(ls[cuerpo[usadas]][1]) + 1; usadas += 1
                    resto_linea = ' '.join(ls[k][1] for k in cuerpo[:usadas + 1])[len(ficha):].strip() if usadas < len(cuerpo) else ''
                    x['ficha'] = ficha
                    cuerpo = cuerpo[usadas + 1:] if resto_linea else cuerpo[usadas:]
                    if resto_linea: x['_extra'] = [resto_linea]
            x['_lineas'] = cuerpo
            propias.update(range(c[0], fin))
        magos.append(x)
    # las fichas, con su magus por el primer nombre («Catella» / «Catella of House Bonisagus»); si no hay, es otro (un aprendiz)
    for k, idx, texto in F:
        cab = ls[k][1]
        pal = norm(re.split(r',| of | ex | de ', cab)[0]).split()
        x = next((m for m in magos if pal and (norm(m['n']).split()[:1] == pal[:1] or pal[0] in norm(m['n']).split())), None)
        if not x:
            nombre = re.split(r',| of | ex ', cab)[0].strip()
            if not es_nombre(nombre): continue
            x = {'n': nombre, 'casa': casa_de(cab + ' ' + texto[:400]), 'cargo': 'Aprendiz' if re.search(r'Aprendiz|Apprentice', texto) else '',
                 'p': ls[k][0], 'texto': [], 'ficha': ''}
            magos.append(x)
        x['ficha'] = texto
        propias.update(idx)
    return magos, propias


# ---------------------------------------------------------------- la ficha de la alianza
ESTACIONES = {'spring': 'Primavera', 'summer': 'Verano', 'autumn': 'Otoño', 'fall': 'Otoño', 'winter': 'Invierno'}
REINOS = {'magic': 'mágica', 'magical': 'mágica', 'faerie': 'feérica', 'divine': 'divina', 'infernal': 'infernal', 'dominion': 'del Dominio'}


def ficha_texto(texto, hijos, lugar='', nombre=''):
    """lo que dice el texto de una alianza de la quinta edición: estación, año de fundación, aura, domus magna, patrón
    (el aura y el año, solo en su descripción y su historia: en otros apartados pueden ser los de otro sitio)"""
    out = []
    todo, texto = texto, lugar or texto
    m = re.search(r'\b(spring|summer|autumn|fall|winter)\s+covenant\b', todo, re.I) or \
        re.search(r'\bcovenant\b[^.]{0,60}?\b(?:is )?in (?:its|the) (spring|summer|autumn|fall|winter)\b', todo, re.I)
    if m: out.append(('Estación', ESTACIONES[m.group(1).lower()]))
    m = re.search(r'\b(?:founded|established|was built|were built)\b[^.]{0,80}?\b(?:in|around|about|circa|c\.)\s+(?:AD\s+|A\.D\.\s+|the year\s+)?(\d{3,4})\b', texto) or \
        re.search(r'\bIn (\d{3,4}),[^.]{0,80}?\b(?:founded|established)\b', texto)
    if m and 700 <= int(m.group(1)) <= 1220: out.append(('Año de fundación', m.group(1)))
    m = re.search(r'\b(?:(magic(?:al)?|faerie|divine|infernal|dominion)\s+)?aura\s+(?:of|is|rated at|with a (?:strength|rating) of)\s+(?:a\s+)?(\d{1,2})\b', texto, re.I)
    if m: out.append(('Aura', m.group(2) + (' (' + REINOS[m.group(1).lower()] + ')' if m.group(1) else '')))
    if nombre:
        k = re.escape(nombre.split()[0])
        m = re.search(k + r'(?: is|,|’s?)? (?:now |currently |also |still )?(?:the |a |its )?(?:ancient |current |true |original )?domus magna of (?:House )?(\w+)', todo) or \
            re.search(r'\bdomus magna of (?:House )?(\w+), ' + k, todo) or re.match(r'^The domus magna of (?:House )?(\w+)', todo)
        if m: out.append(('Domus magna', 'de la Casa ' + m.group(1)))
    for _, t, _ in hijos:
        m = re.match(r'^.+?’s Patron: (.+)$', t) or re.match(r'^Patron Spirit: (.+)$', t)
        if m: out.append(('Espíritu patrón', m.group(1))); break
    return out


def ficha_roma(texto):
    out = []
    for clave, pat in (('Símbolo', r'Symbo\w*\s*:\s*(.+?)(?=\s+(?:Season|Year|House|Aura|Number|A[nr]+a?ments)\b|$)'),
                       ('Estación', r'Season\s*:\s*(\w+)'), ('Año de fundación', r'Year Founded\s*:\s*A\.?\s*D\.?\s*(\d{3,4})'),
                       ('Casa', r'House Affiliation\s*:\s*(.+?)(?=\s+(?:Aura|Number|A[nr]+a?ments|Season|Year)\b|$)'),
                       ('Aura', r'Aura\s*:\s*(.+?)(?=\s+(?:Number|A[nr]+a?ments|Season|Year|House)\b|$)'),
                       ('Grogs', r'Number of Grogs\s*:\s*(\d+)'), ('Armamento', r'A[nr]+a?ments\s*:\s*(\w+)')):
        m = re.search(pat, texto)
        if m:
            v = m.group(1).strip(' .,;')
            if clave == 'Estación': v = ESTACIONES.get(v.lower(), v)
            out.append((clave, v))
    return out


LINAJES = r'(?:(?:de|ex|Ex) )?(?:' + CASAS[1:-1] + r'|Diedne|Apromor|Ierbitonis|Trianomae|Merinitae|Tytali|al-[^\s,]+)'


def separa(e, v):
    """los recuadros de Iberia dan varios valores seguidos: «Corrupta (al-Ándalus) 4 Justa (Tribunal de Iberia) 3» -> «…; …»"""
    if e == 'Reputaciones':
        return re.sub(r'(\(([^)]*)\) -?\d+) (?=[A-ZÁÉÍÓÚ])', r'\1; ', v)
    if e == 'Aura (tipo y poder)':
        return re.sub(r' (?=(?:Mágica|Feérica|Divina|Infernal),? poder)', '; ', v)
    if e.startswith('Fundador'):
        # tras la casa o el linaje de un fundador (y su paréntesis), si empieza otro nombre: una coma
        return re.sub(r'(' + LINAJES + r'(?: \([^)]*\))?) (?=[A-ZÁÉÍÓÚĂŶʿʾḤṬ])', r'\1, ', v)
    return v


def ficha_iberia(caja):
    out = []
    for e, v in caja['par']:
        v = separa(e, v)
        if e == 'Vida':
            out.append(('Vida', v))
            if 'Actualidad' in v: out.insert(0, ('Estado', 'Habitada'))
            elif v == 'Sin constituir': out.insert(0, ('Estado', 'Habitada, aún sin constituir'))
            elif re.search(r'constituir', v): out.insert(0, ('Estado', 'No llegó a constituirse'))
            else: out.insert(0, ('Estado', 'En ruinas'))
            m = re.match(r'(\d{3,4})', v)
            if m: out.append(('Año de fundación', m.group(1)))
        elif e.startswith('Fundador'): out.append((e, v))
        elif e == 'Aura (tipo y poder)': out.append(('Aura', v))
        else: out.append((e, v))
    if caja['crudo']: out.append(('Recuadro del libro', caja['crudo']))
    return out


# ---------------------------------------------------------------- todo
def libro(ab):
    trib, ruta, idi, titulo, fich = LIBROS[ab]
    pags = paginas(ruta)
    L = lineas(ab, pags)
    res, textos = [], {}
    for s in secciones(ab, L, pags):
        quitar = s['fuera'] + s.get('quitar', [])
        dentro = [k for k in range(s['i0'], s['i1']) if not any(a <= k < b for a, b in quitar)] + [k for a, b in s.get('mas', []) for k in range(a, b)]
        if 'lineas' in s: dentro = s['lineas']
        if ab == 'ToH:R': dentro = [k for k in dentro if not re.match(ROMA_CAMPOS, L[k][1])]
        caja = s.get('caja')
        if caja: dentro = [k for k in dentro if k not in caja['caja'] and k != caja['vida']]
        ls = [L[k] for k in dentro]
        # la parte de los magi: desde «Magi» / «Los magi de X» hasta el siguiente apartado de la alianza en el índice
        i_magi = next((k for k, (_, l) in enumerate(ls) if norm(l) in ('magi', 'other magi') or re.match(r'^(Los|Las) mag(i|ae|as|os)\b.* de ', l)), None)
        nombres_toc, magos, propias = [], [], set()
        if ab != 'ToH:R':
            if i_magi is None and ab != 'TdI' and any(cabecera_mago(l, ab) for _, l in ls[1:]): i_magi = 0
            if i_magi is not None:
                fin = len(ls)
                lvl_magi = next((lv for lv, t, _ in s['hijos'] if norm(t) == 'magi'), None)
                if lvl_magi is not None and ab not in NIVELES:
                    tras = False
                    for lv, t, _ in s['hijos']:
                        if norm(t) == 'magi': tras = True; continue
                        if not tras: continue
                        if parece_mago(t): nombres_toc.append(t); continue
                        k = next((k for k in range(i_magi + 1, len(ls)) if norm(ls[k][1]) == norm(t)), None)
                        if k is not None: fin = k
                        break
                elif lvl_magi is not None:
                    tras = False
                    for lv, t, _ in s['hijos']:
                        if norm(t) == 'magi': tras = True; continue
                        if tras and lv > lvl_magi: nombres_toc.append(t); continue
                        if tras and lv <= lvl_magi:
                            k = next((k for k in range(i_magi + 1, len(ls)) if norm(ls[k][1]) == norm(t)), None)
                            if k is not None: fin = k
                            break
                ini = i_magi + 1
                if nombres_toc and fin == len(ls): ini = 1      # sin otro apartado detrás: toda la sección
                elif nombres_toc: ini = 1                        # y con él, también desde el principio (hasta ese apartado)
                parte = ls[ini:fin]
                magos, prop = magi_de(ab, parte, nombres_toc, [t for _, t, _ in s['hijos'] if not parece_mago(t)])
                propias = {i_magi} | {ini + k for k in prop}
                for m in magos:
                    m['texto'] = bloques(items(m.pop('_extra', []) + [parte[k][1] for k in m.pop('_lineas', [])]))
                    if not m['casa'] and m['texto']:
                        primero = ' '.join(p for _, ps in m['texto'][:2] for p in ps[:3])[:900]
                        mm = re.search(r'\b(?:of House|is of House|of the House) ' + CASAS, primero) or re.search(r'\b(?:Casa|casa) (?:de )?' + CASAS, primero)
                        if mm: m['casa'] = 'Ex Miscellanea' if mm.group(1) == 'Miscellanea' else mm.group(1)
                    # un recuadro de ideas para historias dentro del texto de un magus va a la descripción
                    sueltos = [b for b in m['texto'] if CORTE.match(b[0])]
                    m['texto'] = [b for b in m['texto'] if not CORTE.match(b[0])]
                    m['_sueltos'] = sueltos
        desc_ls = [l for k, (_, l) in enumerate(ls) if k not in propias]
        encab = [t for _, t, _ in s['hijos']]
        desc_ls = [l for l in desc_ls if not re.match(r'^Región (septentrional|meridional|central|oriental|occidental)$', l)]
        desc = bloques(items(desc_ls[1:] if desc_ls and norm(desc_ls[0]) == norm(s['n']) else desc_ls, encab, ab == 'ToH:R'))
        for m in magos: desc += m.pop('_sueltos', [])
        texto = ' '.join(p for _, ps in desc for p in ps)
        lugar = ' '.join(p for h, ps in desc if not h or re.match(r'^(Setting|History|Culture)', h) for p in ps)
        if ab == 'TdI': fic = ficha_iberia(caja)
        elif ab == 'ToH:R': fic = list(s['roma']['campos']) if s.get('roma') else []
        else: fic = ficha_texto(texto, s['hijos'], lugar, s['n'])
        n = s['n']
        id_ = norm(ab + ' ' + n).replace(' ', '-')
        pag0, pag1 = L[s['i0']][0], L[max(s['i0'], s['i1'] - 1)][0]
        estado = dict(fic).get('Estado', 'Habitada')
        if estado.startswith('Habitada'): estado = '' if estado == 'Habitada' else estado
        fic = [x for x in fic if x[0] != 'Estado']
        casas = collections.Counter(m['casa'] for m in magos if m['casa'])
        cab = [('Denominación', n), ('Tribunal', 'Tribunal ' + ('del Rin' if trib == 'rin' else 'de ' + TRIB[trib]))]
        if estado: cab.append(('Estado', estado))
        fic = cab + [x for x in fic if x[0] != 'Estado']
        if magos: fic.append(('Magi', '%d (%s)' % (len(magos), ', '.join('%s %d' % (c, k) if k > 1 else c for c, k in casas.most_common())) if casas else str(len(magos))))
        res.append({'id': id_, 'n': n, 'trib': trib, 'ab': ab, 'p': pag0, 'pf': pag1, 'estado': 'ruinas' if estado in ('En ruinas', 'No llegó a constituirse') else '',
                    'ficha': [list(x) for x in fic],
                    'magos': [{k: v for k, v in (('n', m['n']), ('casa', m['casa']), ('cargo', m['cargo']), ('p', m['p']), ('f', 1 if m['ficha'] else 0)) if v not in ('', None)}
                              for m in magos]})
        textos[id_] = {'desc': desc, 'magos': [{'t': m['texto'], 'f': m['ficha']} for m in magos]}
    return res, textos


def main():
    todas, porlibro = [], {}
    for ab in LIBROS:
        res, textos = libro(ab)
        todas += res
        porlibro[ab] = textos
        nm = sum(len(a['magos']) for a in res)
        print('%-6s %2d alianzas (%d en ruinas o sin constituir), %3d magi, %3d fichas de magi, %d párrafos' % (
            ab, len(res), sum(1 for a in res if a['estado']), nm, sum(1 for a in res for m in a['magos'] if m.get('f')),
            sum(len(ps) for t in textos.values() for _, ps in t['desc'])))
        if '-v' in sys.argv:
            for a in res:
                print('   %-34s p%-4d %-3s %s' % (a['n'][:34], a['p'], 'R' if a['estado'] else '',
                                              '; '.join(m['n'] + ('*' if m.get('f') else '') + ' (' + m.get('casa', '') + ')' for m in a['magos'])))
    if '--escribir' in sys.argv:
        libros = {ab: {'t': v[3], 'idi': v[2], 'f': v[4]} for ab, v in LIBROS.items()}
        with open(os.path.join(RAIZ, 'data', 'alianzas.json'), 'w', encoding='utf8', newline='\n') as fh:
            json.dump({'libros': libros, 'alianzas': todas}, fh, ensure_ascii=False, separators=(',', ':'))
        os.makedirs(os.path.join(RAIZ, 'data', 'alianzas'), exist_ok=True)
        for ab, textos in porlibro.items():
            with open(os.path.join(RAIZ, 'data', 'alianzas', LIBROS[ab][4] + '.json'), 'w', encoding='utf8', newline='\n') as fh:
                json.dump(textos, fh, ensure_ascii=False, separators=(',', ':'))
        print('escrito data/alianzas.json y data/alianzas/*.json')


if __name__ == '__main__':
    main()
