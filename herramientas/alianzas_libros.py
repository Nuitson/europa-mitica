"""Las alianzas de los libros de Tribunales, con sus magi y la ficha de los que la traen -> data/alianzas.json

    python -X utf8 herramientas/alianzas_libros.py            (prueba: lo que encuentra)
    python -X utf8 herramientas/alianzas_libros.py --escribir

Dónde está cada alianza:
- libros de la quinta edición en inglés: su sección del índice, con «History» y «Setting…» justo detrás (o a mano, MANUAL);
  la sección llega hasta la alianza siguiente (como mucho 12 páginas);
- El Tribunal de Iberia: «Los magi de X», hasta el siguiente;
- Tribunals of Hermes: Rome (tercera edición, escaneado con mal OCR): las alianzas del capítulo cinco, a mano, sin magi.
Los magi son los encabezados «Catella of House Bonisagus» / «Sesnando Ex Miscellanea, mestre» / «MURION, PRIMA OF HOUSE
BONISAGUS» de la sección; su ficha, el
bloque de reglas que empieza por su nombre y «Characteristics:» / «Características:» y acaba en «Appearance:» / «Apariencia:».
Necesita pdftotext (MSYS2: /ucrt64/bin)."""
import json, os, re, subprocess, sys, tempfile, unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(tempfile.gettempdir(), 'em-alianzas')

# libro -> (tribunal de la web, PDF, idioma, título)
LIBROS = {
    'L&L': ('normandia', 'libros/en/ll.pdf', 'en', 'The Lion and the Lily'),
    'GotF': ('rin', 'libros/en/gotf.pdf', 'en', 'Guardians of the Forests'),
    'TSE': ('tebas', 'libros/en/tse.pdf', 'en', 'The Sundered Eagle'),
    'AtD': ('transilvania', 'libros/en/atd.pdf', 'en', 'Against the Dark'),
    'TdI': ('iberia', 'libros/es/tdi.pdf', 'es', 'El Tribunal de Iberia'),
    'ToH:R': ('roma', 'libros/en/toh-r.pdf', 'en', 'Tribunals of Hermes: Rome'),
}
# alianzas que el índice no marca (página impresa) y entradas del índice que parecen alianzas pero no lo son
MANUAL = {'GotF': ['Triamore', 'Durenmar', 'Dankmar', 'Oculus Septentrionalis', 'Fengheld', 'Crintera', 'Irencillia', 'Roznov', 'Blue Sea']}
NO_SON = {'The Primi Tytali', "Moero's Garden"}
CASAS = r'(Bjornaer|Bonisagus|Criamon|Flambeau|Guernicus|Jerbiton|Mercere|Merinita|Tremere|Tytalus|Verditius|Ex Miscellanea|Miscellanea)'
MAGO = re.compile(r'^([A-ZÁÉÍÓÚÑĂŶʿʾ][\w’\'´ .\-ʾʿ]{1,45}?),?\s+(?:(?:filius|filia) [\w ]{2,30}? )?(?:of House|of the House|of|ex|Ex|de la Casa|de)\s+' + CASAS + r'\b(.{0,50})$')
# El Tribunal de Iberia: «Lacerta Bjornaer», «Archimagus Raḥûm al-Tŷtalī», «Orraca al-Merkeriyya (Boina Roja)», «Ojarra «Handia» de Merinita»
MAGO_ES = re.compile(r'^([A-ZÁÉÍÓÚÑĂŶʿʾ][\w’\'´ .\-ʾʿ«»]{1,45}?),?\s+(?:(?:ex|Ex|de|de la Casa)\s+)?(' + CASAS[1:-1] + r'|al-[^\s,]+)\b(.{0,50})$')
ARABE = [('tyt', 'Tytalus'), ('tŷt', 'Tytalus'), ('verdit', 'Verditius'), ('merker', 'Mercere'), ('mercer', 'Mercere'), ('erbit', 'Jerbiton'),
         ('flamb', 'Flambeau'), ('bonis', 'Bonisagus'), ('bunis', 'Bonisagus'), ('guern', 'Guernicus'), ('ŷern', 'Guernicus'), ('merin', 'Merinita'),
         ('tremer', 'Tremere'), ('criam', 'Criamon'), ('kriam', 'Criamon'), ('bjorn', 'Bjornaer'), ('biorn', 'Bjornaer'), ('pral', 'Ex Miscellanea'),
         ('miscel', 'Ex Miscellanea')]
NO_NOMBRE = {'cuando', 'casa', 'los', 'las', 'la', 'el', 'una', 'un', 'the', 'a', 'when', 'house', 'loyal', 'seccion', 'capitulo', 'por', 'para', 'con', 'como'}
CAMPOS = ('Characteristics|Size|Age|Decrepitude|Warping Score|Confidence Score|Confidence|Virtues and Flaws|Personality Traits|Reputations|'
          'Combat|Soak|Fatigue Levels|Wound Penalties|Abilities|Arts|Twilight Scars|Equipment|Encumbrance|Spells Known|Appearance|Sigil|Vis|'
          'Características|Tamaño|Edad|Decrepitud|Puntuación de Informidad|Puntuación de Confianza|Impronta|Virtudes y Defectos|'
          'Rasgos de Personalidad|Reputaciones|Combate|Aguante|Niveles de Fatiga|Penalizaciones por Heridas|Habilidades|Artes|Equipo|Carga|'
          'Hechizos conocidos|Apariencia|Cicatrices del Crepúsculo|Objetos encantados|Notas')
MAYUS = re.compile(r'^([A-ZÄÖÜÉ][A-ZÄÖÜÉ’\' .\-]{1,40}?(?: VON [A-ZÄÖÜ]+)?), ([A-Z]+) OF (?:HOUSE )?' + CASAS.upper() + r'$')
CARACT = re.compile(r'(?:^|\s)(Characteristics|Características):')
FIN = re.compile(r'^(Appearance|Apariencia):')
# apartados de la sección de una alianza en el índice (no la terminan)
APARTADO = re.compile(r'^(History|Setting|Culture|Magi|Covenfolk|Buildings|Magical Resources|Mundane Resources|Resources|Library|Libraries|'
                      r'Vis|Laborator|Enchanted|Outside|Relations|Story|Mysteries|Grogs|Companions|Specialists|Customs|The Council|Defenses|Charter|'
                      r'Government|Finances|Income|Lands|Site|Aura|Familiar)', re.I)


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def paginas(ruta):
    os.makedirs(CACHE, exist_ok=True)
    txt = os.path.join(CACHE, os.path.basename(ruta) + '.txt')
    if not os.path.exists(txt):
        subprocess.run(['pdftotext', '-enc', 'UTF-8', os.path.join(RAIZ, ruta), txt], check=True)
    return open(txt, encoding='utf8', errors='replace').read().split('\f')


ENTRADA = re.compile(r'([A-ZÁÉÍÓÚÑ][^.\n]{1,70}?)\s*\.{2,}\s*(\d{1,3})\b')


def indice(pags, hasta=8):
    """las entradas del índice, en orden: (título, página impresa)"""
    out = []
    for t in pags[:hasta]:
        for m in ENTRADA.finditer(t):
            out.append((re.sub(r'\s+', ' ', m.group(1)).strip(), int(m.group(2))))
    return out


def en_pdf(pags, titulo, imp):
    """la página del PDF donde está el encabezado (la impresa más el desfase del libro, que no se sabe: busca cerca)"""
    k = norm(titulo)
    for p in list(range(imp, imp + 9)) + list(range(imp - 3, imp)):
        if 1 <= p <= len(pags) and any(norm(l) == k for l in pags[p - 1].split('\n')): return p
    return imp


def nombre_alianza(t):
    return re.sub(r'^The (Oppid(?:um|a) of (?:the )?|Covenant of )', '', t).strip()


def secciones(ab, pags):
    """[(nombre, primera página del PDF, última)]"""
    if ab == 'TdI':
        marcas = [(n, l.strip()[len('Los magi de '):].strip()) for n, t in enumerate(pags, 1) for l in t.split('\n')
                  if l.strip().startswith('Los magi de ') and len(l.strip()) < 50]
        return [(x, p, (marcas[i + 1][0] - 1) if i + 1 < len(marcas) else p + 8) for i, (p, x) in enumerate(marcas)]
    if ab == 'ToH:R':   # escaneado con mal OCR: el capítulo cinco, a mano (páginas del PDF)
        return [('Harco', 59, 79), ('Magvillus', 80, 87), ('Verdi', 88, 94), ('Luctatio', 95, 95), ('Potestas', 96, 96),
                ('Sansaron', 96, 96), ('Feritel', 97, 97)]
    ent = indice(pags)
    if ab in MANUAL:
        cov = [(t, p) for t, p in ent if t in MANUAL[ab]]
    else:
        cov = [(t, p) for i, (t, p) in enumerate(ent) if t not in NO_SON and ent[i + 1:i + 2] and ent[i + 1][0].startswith('History')
               and any(s[0].startswith('Setting') for s in ent[i + 2:i + 4])]
    out = []
    for t, p in cov:
        i = ent.index((t, p))
        ini = en_pdf(pags, t, p)
        out.append([nombre_alianza(t), ini, p])
    for k, x in enumerate(out):
        sig = out[k + 1][1] if k + 1 < len(out) else x[1] + 10
        x[2] = max(x[1], min(sig - 1, x[1] + 12))
    return [tuple(x) for x in out]


def fichas(ls):
    """los bloques de reglas de magi (con Artes) en esas líneas: {nombre: texto}"""
    out = {}
    for i, l in enumerate(ls):
        if not CARACT.match(l): continue
        if not CARACT.match(l) or not l.startswith(('Characteristics', 'Características')):
            pass
        k = i - 1
        while k >= 0 and (not ls[k] or ls[k].isupper() or ls[k].isdigit()): k -= 1
        if l.startswith(('Characteristics', 'Características')):
            if k < 0 or len(ls[k]) > 70: continue
        else:   # «Infernal Might: 5 (Vim) Characteristics: …»: el nombre es la línea de encima igual
            if k < 0 or len(ls[k]) > 70: continue
        j = i
        while j < len(ls) and j < i + 60 and not FIN.match(ls[j]) and not (j > i and CARACT.match(ls[j])): j += 1
        if j < len(ls) and FIN.match(ls[j]): j += 1
        bloque = [x for x in ls[k + 1:j] if x and not (x.isupper() and len(x.split()) == 1) and not x.isdigit()]   # «SECCIÓN», el número de página
        texto = re.sub(r'[ \t]*\n[ \t]*', ' ', ' '.join(bloque))
        # cada apartado de la ficha en su línea
        texto = re.sub(r'\s+(?=(?:' + CAMPOS + r'):)', '\n', texto).strip()
        if not re.search(r'\b(Arts|Artes):', texto): continue   # grogs y compañeros: no
        out[ls[k]] = texto
    return out


def casa_de(t):
    m = re.search(CASAS, t)
    if m: return 'Ex Miscellanea' if m.group(1) == 'Miscellanea' else m.group(1)
    a = re.search(r'al-(\S+)', t)
    if a: return next((c for r, c in ARABE if r in a.group(1).lower()), '')
    return ''


def es_nombre(n):
    ws = n.replace('«', ' ').replace('»', ' ').split()
    if not ws or len(ws) > 6 or norm(ws[0]) in NO_NOMBRE: return False
    return all(w[:1].isupper() or w[:1] in 'ʿʾĂŶ' or w.lower() in ('de', 'del', 'da', 'do', 'la', 'el', 'y', 'the', 'of', 'equitum', 'al', 'ibn', 'bat', 'ben')
               or w.startswith('al-') for w in ws)


def magos(pags, ini, fin, es=False, con_fichas=True):
    ls = [(n, l.strip()) for n in range(ini, min(fin, len(pags)) + 1) for l in pags[n - 1].split('\n')]
    planas = [l for _, l in ls]
    F = fichas(planas) if con_fichas else {}   # Rome: tercera edición, sin fichas
    out, vistos = [], {}
    for i, (n, l) in enumerate(ls):
        # Guardians of the Forests: «MURION, PRIMA OF HOUSE BONISAGUS» / «ANDRUS, FOLLOWER OF BONISAGUS» y debajo «Age: … Personality Traits: …»
        m = MAYUS.match(l)
        if m:
            nombre = re.sub(r' (Of|Von|De|La|Du|Da) ', lambda x: x.group(0).lower(), m.group(1).title())
            if norm(nombre) in vistos: continue
            x = {'n': nombre, 'casa': casa_de(l.title()), 'p': n}
            if m.group(2) not in ('FOLLOWER', 'MEMBER'): x['cargo'] = m.group(2).capitalize()
            perfil = []
            for _, s in ls[i + 1:i + 6]:
                if not s or MAYUS.match(s) or (perfil and len(s) > 90): break
                perfil.append(s)
            if perfil and perfil[0].startswith('Age:'): x['ficha'] = ' '.join(perfil)
            vistos[norm(nombre)] = x
            out.append(x)
            continue
        m = MAGO.match(l) or (MAGO_ES.match(l) if es else None)
        if not m or l.endswith('.') or len(l) > 80: continue
        if es and m.re is MAGO_ES and m.group(2).startswith('al-') and not casa_de(m.group(2)): continue
        nombre = m.group(1).strip()
        if not es_nombre(nombre): continue
        # «Disceptator Fortún» y «Fortún»: el mismo
        igual = next((v for k, v in vistos.items() if k == norm(nombre) or k.endswith(' ' + norm(nombre)) or norm(nombre).endswith(' ' + k)), None)
        if igual:
            if len(nombre) > len(igual['n']): igual['n'] = nombre
            continue
        resto = m.group(3).strip(' ,')
        x = {'n': nombre, 'casa': casa_de(l[len(nombre):]), 'p': n}
        if resto and not resto.startswith(('(', '.')): x['cargo'] = resto
        vistos[norm(nombre)] = x
        out.append(x)
    # las fichas, con su mago por el primer nombre («Catella» / «Catella of House Bonisagus»)
    for cab, texto in F.items():
        k = norm(re.split(r',| of | ex | de ', cab)[0]).split()
        x = next((m for m in out if k and (norm(m['n']).split()[:1] == k[:1] or k[0] in norm(m['n']).split())), None)
        if not x and not es_nombre(re.split(r',| of | ex ', cab)[0].strip()): continue
        if not x:
            x = {'n': re.split(r',| of | ex ', cab)[0].strip(), 'casa': casa_de(cab + ' ' + texto[:300]), 'p': ini}
            out.append(x)
        x['ficha'] = texto
    return out


def main():
    res = []
    for ab, (trib, ruta, idi, titulo) in LIBROS.items():
        pags = paginas(ruta)
        secs = secciones(ab, pags)
        for nombre, ini, fin in secs:
            ms = magos(pags, ini, fin, ab == 'TdI') if ab != 'ToH:R' else []   # Rome: el OCR no da nombres fiables
            res.append({'id': norm(ab + ' ' + nombre).replace(' ', '-'), 'n': nombre, 'trib': trib, 'ab': ab, 'p': ini, 'magos': ms})
        print('%-6s %2d alianzas, %3d magi, %3d fichas' % (ab, len(secs), sum(len(a['magos']) for a in res if a['ab'] == ab),
                                                       sum(1 for a in res if a['ab'] == ab for m in a['magos'] if m.get('ficha'))))
        if '-v' in sys.argv:
            for a in res:
                if a['ab'] != ab: continue
                print('   %-28s p%-4d %s' % (a['n'], a['p'], '; '.join(m['n'] + ('*' if m.get('ficha') else '') + ' (' + m['casa'] + ')' for m in a['magos'])))
    if '--escribir' in sys.argv:
        libros = {ab: {'t': v[3], 'idi': v[2]} for ab, v in LIBROS.items()}
        with open(os.path.join(RAIZ, 'data', 'alianzas.json'), 'w', encoding='utf8', newline='\n') as fh:
            json.dump({'libros': libros, 'alianzas': res}, fh, ensure_ascii=False, separators=(',', ':'))
        print('escrito data/alianzas.json')


if __name__ == '__main__':
    main()
