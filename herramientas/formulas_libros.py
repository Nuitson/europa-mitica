#!/usr/bin/env python3
"""Las fórmulas de reglas de los libros (Total de Laboratorio, Total de Lanzamiento, tiradas…), con su libro y página.

    python herramientas/formulas_libros.py [AB ...] [--muestra] [--escribir]

Lee el texto de cada PDF (pdftotext, página a página) y se queda con las líneas que son una fórmula: un nombre, dos puntos
o un igual, y una expresión de términos sumados o multiplicados («Total de Laboratorio: Técnica + Forma + Inteligencia +
Teoría Mágica + Aura»). Los libros que tenemos en castellano se leen en castellano; los demás, en inglés.
Con --escribir deja data/formulas.json: [{n, f, tema, refs: [[AB, página del PDF]]}], las repetidas juntas.
"""
import collections, json, os, re, subprocess, sys, tempfile, unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ONEDRIVE = r'C:\Users\chiru\OneDrive\01-Juegois rol\Ars\Manuales'
# abreviatura -> (título, PDF, idioma); en castellano cuando lo hay
LIBROS = {
    'ArM': ('Ars Magica (Libro básico)', 'libros/es/arm.pdf', 'es'),
    'HoH:TL': ('Casas de Hermes: Castas', 'libros/es/hoh-tl.pdf', 'es'),
    'HoH:MC': ('Casas de Hermes: Cultos Mistéricos', 'libros/es/hoh-mc.pdf', 'es'),
    'HoH:S': ('Casas de Hermes: Societates', 'libros/es/hoh-s.pdf', 'es'),
    'RoP:M': ('Reinos de Poder: Magia', 'libros/es/rop-m.pdf', 'es'),
    'RoP:F': ('Reinos de Poder: Feérico', 'libros/es/rop-f.pdf', 'es'),
    'App': ('Aprendices', 'libros/es/app.pdf', 'es'),
    'BCoC': ('Calebais: la alianza rota', 'libros/es/bcoc.pdf', 'es'),
    'TdI': ('El Tribunal de Iberia', 'libros/es/tdi.pdf', 'es'),
    'HMRE': ('Magia Limítrofe', ONEDRIVE + r'\Magias no hermeticas\Magia Limítrofe.pdf', 'es'),
    'RM': ('Magia Rival', ONEDRIVE + r'\Magias no hermeticas\Magia Rival.pdf', 'es'),
    'AnM': ('Magia Antigua', ONEDRIVE + r'\Magias no hermeticas\Magia Antigua.pdf', 'es'),
    'Cov': ('Alianzas', ONEDRIVE + r'\Ampliación alianzas\AM5_Alianzas_web.pdf', 'es'),
    'CH': ('Códice Hermético', ONEDRIVE + r'\Ayudas\ArM5_Codice Hermetico_web.pdf', 'es'),
    'A&A': ('Art & Academe', 'libros/en/aa.pdf', 'en'),
    'Ant': ('Antagonists', 'libros/en/ant.pdf', 'en'),
    'AtD': ('Against the Dark', 'libros/en/atd.pdf', 'en'),
    'C&G': ('City & Guild', 'libros/en/cg.pdf', 'en'),
    'GotF': ('Guardians of the Forests', 'libros/en/gotf.pdf', 'en'),
    'Grogs': ('Grogs', 'libros/en/grogs.pdf', 'en'),
    'L&L': ('The Lion and the Lily', 'libros/en/ll.pdf', 'en'),
    'LoH': ('Legends of Hermes', 'libros/en/loh.pdf', 'en'),
    'LoM': ('Lords of Men', 'libros/en/lom.pdf', 'en'),
    'MoH': ('Magi of Hermes', 'libros/en/moh.pdf', 'en'),
    'RoP:D': ('Realms of Power: The Divine', 'libros/en/rop-d.pdf', 'en'),
    'RoP:I': ('Realms of Power: The Infernal', 'libros/en/rop-i.pdf', 'en'),
    'TC': ('The Church', 'libros/en/tc.pdf', 'en'),
    'TC&TC': ('The Cradle and the Crescent', 'libros/en/tctc.pdf', 'en'),
    'TMRE': ('The Mysteries, Revised Edition', 'libros/en/tmre.pdf', 'en'),
    'ToME': ('Tales of Mythic Europe', 'libros/en/tome.pdf', 'en'),
    'TSE': ('The Sundered Eagle', 'libros/en/tse.pdf', 'en'),
}
CACHE = os.path.join(tempfile.gettempdir(), 'em-formulas')


def paginas(ruta):
    """el texto de cada página, en orden de lectura (sin -layout, para que las columnas no se mezclen)"""
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, re.sub(r'\W', '_', os.path.basename(ruta)) + '.txt')
    if not os.path.exists(f):
        subprocess.run(['pdftotext', '-enc', 'UTF-8', ruta, f], check=True)
    return open(f, encoding='utf8', errors='ignore').read().split('\f')


def norm(s):
    s = unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9+×x*/=: ]', ' ', s)).strip()


# «Nombre: expresión» o «Nombre = expresión»; el nombre es corto y la expresión, términos unidos por operadores
LINEA = re.compile(r'^\s*([A-ZÁÉÍÓÚÑ(«“][^:=.]{2,80}?)\s*[:=]\s*(.{3,400})$')
# el nombre solo en su línea, la fórmula en la siguiente: «Total de Avance:» / «Calidad de la Fuente + Bonos…»
SOLO = re.compile(r'^\s*([A-ZÁÉÍÓÚÑ(«“][^:=.]{2,80}?)\s*:\s*$')
CLAVE = re.compile(r'\b(total|puntuaci[oó]n|tirada|calidad|nivel|bono|penetraci[oó]n|coste|velocidad|fuerza|resistencia|'
                   r'score|roll|bonus|level|quality|cost|speed|strength|resistance|modifier|modificador|factor|limit|l[ií]mite)\b', re.I)
OPS = re.compile(r'\s[+×÷/]\s|\s[–−-]\s|\s[x×]\s|\bvs\.?\s')
# donde empieza una frase normal detrás de la fórmula («… + Dado El tipo de dado depende…»)
FRASE = re.compile(r'\s(?=(?:El|La|Los|Las|Si|Un|Una|Este|Esta|Estos|En|Por|Para|Cuando|Con|Se|No|Ver|Así|The|If|This|These|A|An|For|When|In|With|See|Note)\s+[a-záéíóúñ])')
SIGUE = re.compile(r'([+×÷/–−-]|\b(de|del|la|las|los|el|y|o|por|en|con|a|of|the|and|or|per|to|by|plus|times|al|stress|simple|botch)|\w[’\']s)\s*$', re.I)


def ops(expr):
    return len(OPS.findall(' ' + expr + ' '))


def limpiar(expr):
    expr = re.sub(r'(\w)- (\w)', r'\1\2', expr)                 # «Ense- ñanza»
    expr = re.sub(r'\s+', ' ', expr).strip()
    m = FRASE.search(expr)
    if m and ops(expr[:m.start()]) >= 1: expr = expr[:m.start()]
    m = re.search(r'\s[A-ZÁÉÍÓÚ][\wáéíóúñ]+(?:\s[\wáéíóúñ]+)?:\s', expr + ' ')
    if m and not SIGUE.search(expr[:m.start()]): expr = expr[:m.start()]
    return expr.strip(' .,;')


def salta(ls, i, expr):
    """si la expresión acaba abierta y debajo hay un hueco, el índice de la línea que la continúa (o i)"""
    if not SIGUE.search(expr) or i + 1 >= len(ls) or ls[i + 1]: return i
    for k in range(i + 2, min(i + 7, len(ls))):
        l = ls[k]
        if not l: continue
        if l[0].islower() or re.match(r'^[+×÷–−-]\s', l): return k - 1
        if len(l) <= 60 and ops(l) >= 1 and '. ' not in l: return k - 1
    return i


def junta(ls, i, expr):
    """la expresión sigue en las líneas de abajo mientras quede abierta (operador, preposición o corchete al final)"""
    i0 = salta(ls, i, expr)
    if i0 != i: ls = ls[:i + 1] + ls[i0 + 1:]; desp = i0 - i
    else: desp = 0
    while i + 1 < len(ls) and ls[i + 1] and len(expr) < 400 and (
            SIGUE.search(expr) or re.match(r'^[+×÷–−-]\s', ls[i + 1]) or expr.count('[') > expr.count(']') or expr.count('(') > expr.count(')')):
        i += 1
        expr += ' ' + ls[i]
    return i + desp, expr


def candidatas(texto):
    """las fórmulas de una página: (nombre, expresión)"""
    ls = [l.strip() for l in texto.split('\n')]
    out = []
    i = 0
    while i < len(ls):
        l = ls[i]
        m = SOLO.match(l)
        if m and i + 1 < len(ls) and ls[i + 1]:
            j, expr = junta(ls, i + 1, ls[i + 1])
            expr = limpiar(expr)
            if ops(expr) >= 1 and len(expr.split()) <= 40:
                out.append((m.group(1).strip(), expr)); i = j + 1; continue
        m = LINEA.match(l)
        if m:
            nombre = m.group(1).strip()
            j, expr = junta(ls, i, m.group(2).strip())
            expr = limpiar(expr)
            n_ops, palabras = ops(expr), len(expr.split())
            if palabras <= 40 and (n_ops >= 2 or (n_ops >= 1 and CLAVE.search(nombre))) and n_ops / max(1, palabras) >= 0.08 \
                    and not re.search(r'\b(página|page|ver|see|ejemplo|example)\b', nombre, re.I) and len(nombre.split()) <= 12:
                out.append((nombre, expr)); i = j
        i += 1
    return out


# los campos de las fichas de ejemplo («Virtudes y defectos: 2 x Poder…», «Combat: …») no son fórmulas
FICHA = {norm(x) for x in (
    'Virtudes y defectos', 'Virtudes y Defectos', 'Combate', 'Habilidades', 'Características', 'Equipo', 'Poderes', 'Rasgos de personalidad',
    'Reputaciones', 'Aguante', 'Niveles de fatiga', 'Penalizaciones por heridas', 'Armas naturales', 'Cualidades', 'Inferioridades',
    'Hechizos conocidos', 'Artes', 'Vis', 'Carga', 'Edad', 'Tamaño', 'Confianza', 'Decrepitud', 'Puntuación de Informidad', 'Impronta',
    'Apariencia', 'Puntuación de confianza', 'Virtues and Flaws', 'Combat', 'Abilities', 'Characteristics', 'Equipment', 'Powers',
    'Personality Traits', 'Reputations', 'Soak', 'Fatigue Levels', 'Wound Penalties', 'Natural Weapons', 'Qualities', 'Inferiorities',
    'Spells Known', 'Arts', 'Encumbrance', 'Age', 'Size', 'Confidence', 'Confidence Score', 'Decrepitude', 'Warping Score', 'Twilight Scars',
    'Sigil', 'Appearance', 'Magic Might', 'Faerie Might', 'Infernal Might', 'Divine Might', 'Might', 'Poder mágico', 'Poder feérico',
    'Poder infernal', 'Poder divino', 'Lab Texts', 'Laboratory', 'Vis Sources', 'Library', 'Biblioteca')}


def es_ruido(nombre, expr):
    n = norm(nombre)
    if n in FICHA or any(n.startswith(f + ' ') and len(n) < len(f) + 12 for f in FICHA): return True
    if re.search(r'\bby\b|\bpor\b.*\bsumma|;|tractatus of|summa on', nombre, re.I): return True       # listas de libros
    if re.match(r'^(a|an|the|el|la|un|una|los|las)\s+(character|characters|personaje|personajes|player|jugador|magus|maga)\b', n): return True
    if len(nombre.split()) > 9 or n in {norm('Armas y Armaduras')}: return True
    if nombre.count('(') != nombre.count(')'): return True                  # «(Minor Virtue 18»: un trozo de otra línea
    if re.search(r'\b(Inic|Ataq|Def|Daño|Init|Atk|Dfn|Dam)\s[+−-]\d', expr): return True                  # líneas de combate de una ficha
    if not re.search(r'[A-Za-zÁÉÍÓÚáéíóúñ]{3}', expr): return True       # «0 – 6»: un rango de una tabla
    # prosa y listas (un punto o un punto y coma entre frases; «vs.» y las abreviaturas no cuentan), o nombres que son fórmulas
    sin_abrev = re.sub(r'(vs|p|pp|pág|ej|etc|cf|Int|Per|Pre|Com|Str|Sta|Dex|Qik|Fue|Vit|Des|Rap)\.', '', expr)
    if re.search(r'[.;]\s', sin_abrev) or re.search(r'\s[+×–−-]\s', ' ' + nombre + ' '): return True
    return False


def desfase(pags):
    """página del PDF menos página impresa: lo más votado entre los números sueltos de cada página"""
    c = collections.Counter()
    for n, t in enumerate(pags, 1):
        ls = [l.strip() for l in t.split('\n') if l.strip()]
        for l in ls[:3] + ls[-3:]:
            if re.fullmatch(r'\d{1,3}', l) and 0 <= n - int(l) <= 40: c[n - int(l)] += 1
    if not c: return None
    d, v = c.most_common(1)[0]
    return d if v >= max(5, len(pags) // 10) else None


def libro(ab, muestra=False):
    titulo, pdf, idi = LIBROS[ab]
    ruta = pdf if os.path.isabs(pdf) else os.path.join(RAIZ, pdf)
    if not os.path.exists(ruta): return []
    res = []
    pags = paginas(ruta)
    d = desfase(pags)
    for n, t in enumerate(pags, 1):
        for nombre, expr in candidatas(t):
            if es_ruido(nombre, expr): continue
            if nombre.isupper(): nombre = nombre[0] + nombre[1:].lower()      # los títulos en mayúsculas de algunos libros
            res.append({'n': nombre, 'f': expr, 'ab': ab, 'p': n, 'imp': n - d if d is not None else None, 'idi': idi})
    if muestra:
        print('== %s: %d fórmulas' % (ab, len(res)))
        for r in res: print('   p%-4d %-45s = %s' % (r['p'], r['n'][:45], r['f'][:110]))
    return res


# temas, en este orden: el primero cuyas palabras aparezcan en el nombre o la fórmula
TEMAS = [
    ('certamen', 'Certamen', r'certamen|debilitaci|weakening'),
    ('iniciacion', 'Misterios e iniciación', r'iniciaci|initiation|gui[oó]n|script|ordal|ordeal|mistagog|mystagog'),
    ('crepusculo', 'Crepúsculo e Informidad', r'crep[uú]sculo|twilight|informidad|warping'),
    ('envejecimiento', 'Envejecimiento y longevidad', r'envejec|aging|ageing|crisis|decrepit|longevidad|longevity'),
    ('laboratorio', 'Laboratorio, vis y objetos', r'laboratorio|\blab\b|lab total|\bvis\b|encantam|enchant|familiar|talism|textos? de laboratorio|lab text|invent|poci[oó]n|potion|alquimi|alchem'),
    ('estudio', 'Estudio, enseñanza y libros', r'profesor|teacher|maestro|lecture|recitation|commentary|experiencia|experience|summa|tractatus|fuente|source|enseñanza|teaching|entrenamiento|training|avance|advancement|libro|book|escrib|writ|copi|copy|estudio|study|aprend|learn'),
    ('lanzamiento', 'Lanzamiento de hechizos', r'lanzamiento|casting|penetraci|penetration|hechizo|spell|concentraci|apuntar|aim|ritual|ceremonial|magia espont|spontaneous|forma de un efecto'),
    ('combate', 'Combate, heridas y salud', r'ataque|attack|defensa|defense|iniciativa|initiative|da[nñ]o|damage|aguante|soak|herida|wound|recuperaci|recovery|fatiga|fatigue|enfermedad|disease|veneno|poison|cirug|surgery|chirurg|medicin|prognosis'),
    ('criaturas', 'Criaturas, reinos y auras', r'dominion|dominio|bono por forma|magical bonus|\bpoder\b|might|criatura|creature|\bfe\b|faith|regio|aura|demon|infernal|divin|fe[eé]ric|faerie|glamour|esp[ií]ritu|spirit|invoca|summon|umbral'),
    ('social', 'Social, mundano y viajes', r'lealtad|loyalty|aesthetic|est[eé]tic|social|reputaci|reputation|intriga|intrigue|liderazgo|leadership|viaje|travel|asedio|siege|caza|hunt|regat|bargain|serm|preach|mercad|merchant|agent|santo|saint|iglesia|church|ordenaci|ordination|peticion|petition|miles per day|paces'),
    ('tiradas', 'Habilidades y otras tiradas', r'dado|\bdie\b|roll|tirada|factor de dificultad|ease factor|total'),
]


def tema(f):
    t = norm(f['n'] + ' ' + f['f'])
    for k, _, pat in TEMAS:
        if re.search(pat, t, re.I): return k
    return 'otras'


def main():
    abs_ = [a for a in sys.argv[1:] if not a.startswith('--')] or list(LIBROS)
    todas = []
    for ab in abs_: todas += libro(ab, '--muestra' in sys.argv)
    # las repetidas (el capítulo y el resumen del final, el básico y el Códice…) juntas, con todas sus páginas
    juntas = collections.OrderedDict()
    for f in todas:
        k = norm(f['n'].replace('×', 'x')) + '|' + norm(f['f'].replace('×', 'x').replace('ó', 'o'))
        g = juntas.setdefault(k, {'n': f['n'], 'f': f['f'], 'idi': f['idi'], 'refs': []})
        if [f['ab'], f['p']] not in [[r[0], r[1]] for r in g['refs']]: g['refs'].append([f['ab'], f['p'], f['imp']])
    out = list(juntas.values())
    for g in out: g['tema'] = tema(g)
    print('candidatas %d, fórmulas distintas %d' % (len(todas), len(out)))
    print(collections.Counter(g['tema'] for g in out))
    if '--escribir' in sys.argv:
        libros = {ab: {'t': LIBROS[ab][0], 'idi': LIBROS[ab][2]} for ab in LIBROS}
        temas = [[k, t] for k, t, _ in TEMAS] + [['otras', 'Otras']]
        with open(os.path.join(RAIZ, 'data', 'formulas.json'), 'w', encoding='utf8', newline='\n') as fh:
            json.dump({'temas': temas, 'libros': libros, 'f': out}, fh, ensure_ascii=False, separators=(',', ':'))
        print('escrito data/formulas.json')


if __name__ == '__main__':
    main()
