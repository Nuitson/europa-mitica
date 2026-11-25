"""Las reglas de laboratorio de Alianzas (edición en castellano, libros/es/cov.pdf, sección 9) -> data/laboratorio.json

    python -X utf8 herramientas/laboratorio_alianzas.py            (prueba: lo que encuentra)
    python -X utf8 herramientas/laboratorio_alianzas.py --escribir

Saca del libro:
- las Virtudes y Defectos de laboratorio (de Estructura, de Equipamiento y Sobrenaturales; Mayores, Menores y Gratuitos), con
  lo que cambian las Características («+2 Seguridad, +1 Estética») y las Especializaciones que dan («+1 Vi», «+2 Co o Me»,
  «1 punto en una Especialización adecuada»…), y su texto;
- los Distintivos (Altar, Caldero…) con sus Especializaciones posibles;
- los laboratorios de ejemplo (Darius, Igor Rastvan…), con sus Características y Especializaciones tal como las da el libro.
Necesita pdftotext (xpdf o poppler)."""
import json, os, re, subprocess, sys, tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(RAIZ, 'libros', 'es', 'cov.pdf')
CAR = ['Tamaño', 'Perfeccionamiento', 'Calidad General', 'Mantenimiento', 'Seguridad', 'Informidad', 'Salubridad', 'Estética']
ACTIVIDADES = ['Enseñanza', 'Experimentación', 'Extracción de vis', 'Familiar', 'Hechizos', 'Objetos', 'Rituales de longevidad', 'Textos']
ARTES = {'Cr': 'Creo', 'In': 'Intellego', 'Mu': 'Muto', 'Pe': 'Perdo', 'Re': 'Rego', 'An': 'Animal', 'Aq': 'Aquam', 'Au': 'Auram', 'Co': 'Corpus',
         'He': 'Herbam', 'Ig': 'Ignem', 'Im': 'Imaginem', 'Me': 'Mentem', 'Te': 'Terram', 'Vi': 'Vim'}
TECNICAS = ['Creo', 'Intellego', 'Muto', 'Perdo', 'Rego']
FORMAS = [a for a in ARTES.values() if a not in TECNICAS]
# los apartados de la lista, en orden: (encabezado del libro, clase, valor, categoría)
APARTADOS = [
    ('Virtudes Mayores de Estructura', 'Virtud', 'Mayor', 'Estructura'), ('Virtudes Menores de Estructura', 'Virtud', 'Menor', 'Estructura'),
    ('Virtudes Gratuitas de Estructura', 'Virtud', 'Gratuita', 'Estructura'), ('Defectos Gratuitos de Estructura', 'Defecto', 'Gratuito', 'Estructura'),
    ('Defectos Menores de Estructura', 'Defecto', 'Menor', 'Estructura'), ('Defectos Mayores de Estructura', 'Defecto', 'Mayor', 'Estructura'),
    ('Virtudes Mayores de Equipamiento', 'Virtud', 'Mayor', 'Equipamiento'), ('Virtudes Menores de Equipamiento', 'Virtud', 'Menor', 'Equipamiento'),
    ('Virtudes Gratuitas de Equipamiento', 'Virtud', 'Gratuita', 'Equipamiento'), ('Defectos Gratuitos de Equipamiento', 'Defecto', 'Gratuito', 'Equipamiento'),
    ('Defectos Menores de Equipamiento', 'Defecto', 'Menor', 'Equipamiento'), ('Defectos Mayores de Equipamiento', 'Defecto', 'Mayor', 'Equipamiento'),
    ('Virtudes Mayores Sobrenaturales', 'Virtud', 'Mayor', 'Sobrenatural'), ('Virtudes Menores Sobrenaturales', 'Virtud', 'Menor', 'Sobrenatural'),
    ('Virtudes Sobrenaturales Gratuitas', 'Virtud', 'Gratuita', 'Sobrenatural'), ('Defectos Sobrenaturales Gratuitos', 'Defecto', 'Gratuito', 'Sobrenatural'),
    ('Defectos Sobrenaturales Menores', 'Defecto', 'Menor', 'Sobrenatural'), ('Defectos Mayores Sobrenaturales', 'Defecto', 'Mayor', 'Sobrenatural'),
    ('Distintivos del Laboratorio', None, None, None)]
# recuadros del libro que caen en medio de la lista y no son de ninguna entrada
RECUADROS = ('Coste de Puntos de Construcción', 'Adueñarse de un Laboratorio', 'Trasladar un Laboratorio', 'Especializaciones del Laboratorio')
ENTRADA = re.compile(r'(?:^|(?<=[.)]\s))([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?: (?:de|del|la|el|en|con|sin|y|a|al|los|las)?\s?[A-ZÁÉÍÓÚÑa-záéíóúñ][\wáéíóúñ]+){0,4}\*?):\s')
STAT = r'(Calidad General|Mantenimiento|Seguridad|Informidad|Salubridad|Estética|Tamaño|Perfeccionamiento)'
ACT_RE = r'(Enseñanza|Experimentación|Extracción de Vis|Familiar|Hechizos|Objetos|Rituales de Longevidad|Textos)'
ART_RE = r'(Cr|In|Mu|Pe|Re|An|Aq|Au|Co|He|Ig|Im|Me|Te|Vi|Creo|Intellego|Muto|Perdo|Rego|Animal|Aquam|Auram|Corpus|Herbam|Ignem|Imaginem|Mentem|Terram|Vim)'


def paginas():
    txt = os.path.join(tempfile.gettempdir(), 'em-cov.txt')
    if not os.path.exists(txt): subprocess.run(['pdftotext', '-enc', 'UTF-8', PDF, txt], check=True)
    return open(txt, encoding='utf8', errors='replace').read().split('\f')


def esp_nombre(t):
    t = t.strip()
    if t in ARTES: return ARTES[t]
    m = re.match('^' + ACT_RE + '$', t)
    if m: return {'Extracción de Vis': 'Extracción de vis', 'Rituales de Longevidad': 'Rituales de longevidad'}.get(t, t)
    return t if t in ARTES.values() else None


def efectos(txt):
    """lo que dice la última frase de una entrada: {mods: {Característica: n}, var: [texto], esp: [{v, de: [..]} | {v, libre: tipo, de}]}"""
    out = {'mods': {}, 'var': [], 'esp': []}
    # la frase de efectos: desde el primer «+n Característica» o «n punto(s)» de la última parte
    frases = re.split(r'(?<=\.)\s+(?=[+\-−\d(A-ZÁÉÍÓÚ])', txt)
    ef = ''
    for f in reversed(frases):
        if re.search(r'[+\-−]\s?(\d+|\[|\()[^;]*?' + STAT, f) or re.search(r'[+\-−]\d+ ' + ART_RE + r'\b', f) or re.search(r'\bpuntos? (en|entre)\b', f) \
                or re.search(r'[+\-−]\d+ ' + ACT_RE, f):
            ef = f + (' ' + ef if ef else '')
            if re.match(r'^[+\-−\d(]', f) or re.search(STAT + r'[,;.]', f): break
        elif ef: break
    ef = ef.strip()
    stats, _, esps = ef.partition(';')
    if not _ and not re.search(STAT, stats): stats, esps = '', stats
    for m in re.finditer(r'([+\-−])\s?(\d+)\s+' + STAT, stats):
        out['mods'][m.group(3)] = out['mods'].get(m.group(3), 0) + (int(m.group(2)) if m.group(1) == '+' else -int(m.group(2)))
    for m in re.finditer(r'\+\s?[\[(]([^\])]+)[\])]\s+' + STAT, stats):
        out['var'].append('+(' + m.group(1) + ') ' + m.group(2))
    if re.search(r'\+1 a \+3 Estética', ef): out['var'].append('+1 a +3 Estética')
    for g in (r'divide a la mitad la puntuación de Estética[^;.]*', r'la puntuación de Estética no puede superar -1', r'o \+2 Mantenimiento, según corresponda'):
        m = re.search(g, ef)
        if m: out['var'].append(m.group(0))
    trozos = []
    m = re.search(r'\d+ puntos? (?:en|entre) [^;]*$', esps)
    if m: trozos, esps = [m.group(0)], esps[:m.start()]
    for item in [x.strip(' .') for x in re.split(r',\s*(?![^()]*\))', esps) if x.strip(' .')] + [t.strip(' .') for t in trozos]:
        m = re.match(r'^([+\-−])\s?(\d+)\s+(.+?)(?:\s+o\s+(.+))?$', item)
        if m and esp_nombre(m.group(3)):
            v = int(m.group(2)) * (1 if m.group(1) == '+' else -1)
            de = [esp_nombre(m.group(3))] + ([esp_nombre(m.group(4))] if m.group(4) and esp_nombre(m.group(4)) else [])
            out['esp'].append({'v': v, 'de': de})
            continue
        m = re.match(r'^(\d+) puntos? (?:en|entre)\s+(.*)$', item)
        if m:
            v, resto = int(m.group(1)), m.group(2)
            de = [esp_nombre(x) for x in re.findall(r'\b' + ART_RE + r'\b', resto)]
            de = [x for x in de if x]
            tipo = 'Forma' if 'cualquier Forma' in resto else 'Técnica' if 'Técnica' in resto and not de else 'Arte' if re.search(r'Artes?\b', resto) else \
                'Actividad' if 'actividad' in resto else 'cualquiera'
            x = {'v': v, 'libre': tipo, 'nota': resto}
            if de: x['de'] = de
            if 'Distintivo' in resto: x['libre'], x['de'] = 'Distintivo', []
            out['esp'].append(x)
            continue
        if item: out['var'].append(item)
    return out


def lista(pags):
    texto = '\n'.join(pags[153:164])   # páginas 154–164 del PDF
    corte = re.search(r'\n\s*Objetos Mágicos para Laboratorios\s*\n', texto)   # el encabezado, no la mención en «Encantamiento»
    if corte: texto = texto[:corte.start()]
    # los recuadros que no son de la lista, fuera (hasta el siguiente encabezado de apartado o entrada)
    for r in RECUADROS:
        i = texto.find(r)
        while i >= 0:
            # el título (una o dos líneas cortas) y el párrafo que sigue; lo de detrás sigue la entrada de antes
            m = re.match(r'[^\n]*\n(?:\s*[^\n]{0,60}\n)?\s*\n*[^\n]{200,}\n', texto[i:])
            corte = i + (m.end() if m else len(r))
            texto = texto[:i] + texto[corte:]
            i = texto.find(r, i + 1)
    texto = re.sub(r'\n\s*\d{3}\s*\n', '\n', texto)            # números de página
    texto = re.sub(r'-\n(?=[a-záéíóúñ])', '', texto)            # «Calidad Ge-» / «neral»
    texto = re.sub(r'\s*\n\s*', ' ', texto)
    out, distintivos = [], []
    pos = [(texto.find(a[0]), a) for a in APARTADOS]
    pos = sorted([p for p in pos if p[0] >= 0])
    for n, (i, (enc, clase, valor, cat)) in enumerate(pos):
        fin = pos[n + 1][0] if n + 1 < len(pos) else len(texto)
        trozo = texto[i + len(enc):fin].strip()
        ms = [m for m in ENTRADA.finditer(trozo) if m.group(1) not in ('Especializaciones', 'Por ejemplo')]
        for k, m in enumerate(ms):
            nombre = m.group(1)
            cuerpo = trozo[m.end():ms[k + 1].start() if k + 1 < len(ms) else len(trozo)].strip()
            if clase is None:   # los Distintivos: «Altar: Una construcción… Especializaciones: cualquier Técnica, Vi.»
                if nombre.startswith('Especializaciones'): continue
                e = re.search(r'Especializaciones:\s*(.+?)\.?$', cuerpo)
                if not e: continue
                de = [esp_nombre(x) or ('Técnica' if 'Técnica' in x else None) for x in re.split(r',\s*', e.group(1))]
                distintivos.append({'n': nombre, 'de': [x for x in de if x], 'txt': cuerpo[:e.start()].strip()})
                continue
            if nombre in ('Por ejemplo', 'Especializaciones'): continue
            # la entrada acaba antes de la presentación de la categoría siguiente («Virtudes y Defectos Sobrenaturales Estas…»)
            cuerpo = re.split(r'\s*Virtudes y Defectos (?:de Estructura|de Equipamiento|Sobrenaturales)\b', cuerpo)[0].strip()
            multi = nombre.endswith('*')
            ef = efectos(cuerpo)
            n0 = nombre.rstrip('*')
            if n0 == 'Restricción': ef['mods'].pop('Mantenimiento', None); ef['var'] = ['o, en vez de −1 Calidad General, +2 Mantenimiento (según la restricción)']
            if n0 == 'Vacío': ef['mods'] = {'Estética': -1}; ef['var'] = ['a elegir: +1 Mantenimiento o −1 Salubridad']
            if n0 == 'Estudio': ef['mods'] = {'Estética': 1}; ef['var'] = ['+1 a +3 Estética, según la grandiosidad y el número de objetos expuestos']
            if not ef['mods'] and not ef['esp'] and not ef['var']:
                ult = re.split(r'(?<=\.)\s+', cuerpo.strip())
                ef['var'] = [ult[-1][:220]] if ult else []
            out.append({'n': nombre.rstrip('*'), 'clase': clase, 'valor': valor, 'cat': cat, 'multi': multi, 'mods': ef['mods'], 'esp': ef['esp'],
                        'var': ef['var'], 'txt': cuerpo})
    return out, distintivos


def ejemplos(pags):
    texto = re.sub(r'\s*\n\s*', ' ', '\n'.join(pags[165:168]))
    texto = re.sub(r' \d{3} ', ' ', texto)
    texto = re.sub(r'([a-záéíóúñ])- ([a-záéíóúñ])', r'\1\2', texto)   # «Guar- dia»
    out = []
    for nombre in ('Carolus Furax', 'Darius', 'Ierimyra', 'La Torre de Bonisagus', 'Ricardus Caespuus', 'Igor Rastvan', 'La Esfinge', 'Helvius Pertinax', 'Lutisse'):
        i = texto.find(nombre + ' ')
        while i >= 0 and 'Virtudes y Defectos:' not in texto[i:i + 2500]: i = texto.find(nombre + ' ', i + 1)
        j = texto.find('Virtudes y Defectos:', i)
        intro = texto[i + len(nombre):j].strip()
        k = texto.find('Características:', j)
        vd = texto[j + len('Virtudes y Defectos:'):k].strip().rstrip('.')
        e = texto.find('Especializaciones:', k)
        car = {}
        for m in re.finditer(STAT + r' ([+\-−]?\d+)(?: \(([+\-−]?\d+)\))?', texto[k:e]):
            car[m.group(1)] = int(m.group(2).replace('−', '-'))
            if m.group(3): car['Tamaño ocupado'] = int(m.group(3))
        fin = re.search(r'(Rasgos de [Pp]ersonalidad: [^.]*\.|(?=Ejemplo: Hechizos)|(?=[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+ de la Casa))', texto[e:])
        esp_txt = texto[e + len('Especializaciones:'): e + (fin.start() if fin else 300)]
        esp_txt = esp_txt.split('.')[0] + '.'
        esp = {esp_nombre(m.group(1)) or m.group(1): int(m.group(2)) for m in re.finditer(r'([A-Za-zÁÉÍÓÚáéíóúñ ]+?) (\d+)(?:,|\.|$)', esp_txt)}
        rasgos = re.search(r'Rasgos de [Pp]ersonalidad: ([^.]*?)(?:\.|$)', texto[e:e + 400])
        out.append({'n': nombre, 'txt': intro, 'vd': vd, 'car': car, 'esp': {k.strip(): v for k, v in esp.items()},
                    'rasgos': rasgos.group(1).strip() if rasgos else ''})
    # el hechizo «El Laboratorio de Bonisagus»: un laboratorio mejor que el estándar
    i = texto.find('El Laboratorio de Bonisagus Creo Terram')
    if i >= 0:
        t = texto[i:i + 3000]
        car = {m.group(1): int(m.group(2).replace('−', '-')) for m in re.finditer(STAT + r' ([+\-−]?\d+)', t[t.find('Características:'):t.find('Especializaciones:')])}
        esp_t = t[t.find('Especializaciones:') + 18:t.find('(Base')]
        esp = {esp_nombre(m.group(1).strip()) or m.group(1).strip(): int(m.group(2)) for m in re.finditer(r'([A-Za-zÁÉÍÓÚáéíóúñ ]+?) (\d+)(?:,|\.)', esp_t)}
        out.append({'n': 'El Laboratorio de Bonisagus', 'txt': 'Laboratorio creado con el ritual El Laboratorio de Bonisagus (CrTe 45): mejor que el estándar mientras se mantenga al máximo de Mantenimiento.',
                    'vd': 'Equipamiento Perfecto, Herramientas Perfectas, Impecable', 'car': car, 'esp': esp, 'rasgos': ''})
    return out


ALIAS = {'Iluminación Deficiente': 'Iluminación Defectuosa'}   # el ejemplo de Lutisse lo llama así; la lista, «Defectuosa»


def estructura(ej, vd):
    """la lista de Virtudes y Defectos de un ejemplo («Distintivo Menor (Pozo; +1 Pe), Guardia x 2; Sirviente (Int +2)…») como
    laboratorio editable: [{n, sel, val, nota, dist}] más los ajustes que no salen de ninguna (los de un Objeto Mágico…)"""
    por = {x['n'].lower(): x for x in vd}
    trozos, prof, cur = [], 0, ''
    for c in ej['vd']:
        if c in ',;' and not prof: trozos.append(cur.strip()); cur = ''; continue
        prof += (c == '(') - (c == ')')
        cur += c
    if cur.strip(): trozos.append(cur.strip())
    out, ajuste, esp_ajuste, faltan = [], {}, {}, []
    for t in trozos:
        m = re.match(r'^(.+?)(?:\s*\((.*)\))?(?:\s*x\s*(\d+))?$', t)
        nombre, par, veces = m.group(1).strip(), m.group(2) or '', int(m.group(3) or 1)
        d = por.get(nombre.lower()) or por.get(ALIAS.get(nombre, '').lower())
        if not d: faltan.append(nombre); continue
        nota, dist, sel, val = [], '', [], None
        for parte in [x.strip() for x in par.split(';') if x.strip()]:
            dones = re.findall(r'([+\-−]\d+) ([A-Za-zÁÉÍÓÚáéíóúñ ]+?)(?=,|$)', parte)
            mi = re.match(r'^Int ([+\-−]?\d+)$', parte)
            if mi: val = -(-int(mi.group(1)) // 2); continue      # Sirviente: Inteligencia / 2, hacia arriba
            if not dones:
                if nombre.startswith('Distintivo'): dist = parte
                else: nota.append(parte)
                continue
            for v, e in dones:
                v = int(v.replace('−', '-'))
                e = e.strip()
                if re.fullmatch(STAT, e): ajuste[e] = ajuste.get(e, 0) + v; continue
                nombre_e = esp_nombre(e) or {'Rituales de Longevidad': 'Rituales de longevidad', 'Extracción de Vis': 'Extracción de vis'}.get(e, e)
                elegibles = [g for g in d['esp'] if 'libre' in g or len(g.get('de', [])) > 1]
                if elegibles: sel += [nombre_e] * v
                else: esp_ajuste[nombre_e] = esp_ajuste.get(nombre_e, 0) + v
        for _ in range(veces):
            x = {'n': d['n']}
            if sel: x['sel'] = sel
            if val is not None: x['val'] = val
            if dist: x['dist'] = dist
            if nota: x['nota'] = '; '.join(nota)
            out.append(x)
    car = ej['car']
    lab = {'tam': car.get('Tamaño', 0), 'perf': car.get('Perfeccionamiento', 0), 'vd': out}
    if ajuste: lab['ajuste'] = ajuste
    if esp_ajuste: lab['espAjuste'] = esp_ajuste
    return lab, faltan


def main():
    pags = paginas()
    vd, dist = lista(pags)
    ej = ejemplos(pags)
    for e in ej:
        e['lab'], faltan = estructura(e, vd)
        if faltan: print('  ! %s: no encuentro %s' % (e['n'], faltan))
    print('%d virtudes y defectos, %d distintivos, %d ejemplos' % (len(vd), len(dist), len(ej)))
    if '-v' in sys.argv:
        for x in vd:
            print('  %-8s %-8s %-12s %-34s %s | %s | %s' % (x['clase'], x['valor'], x['cat'], x['n'] + ('*' if x['multi'] else ''),
                                                       ', '.join('%s %+d' % kv for kv in x['mods'].items()), '; '.join(
                ('%+d %s' % (e['v'], '/'.join(e.get('de', []))) if 'libre' not in e else '%d libre(%s%s)' % (e['v'], e['libre'], ':' + '/'.join(e['de']) if e.get('de') else '')) for e in x['esp']),
                                                       ' · '.join(x['var'])))
        for d in dist: print('  DISTINTIVO', d['n'], d['de'])
        for e in ej: print('  EJEMPLO', e['n'], e['car'], e['esp'], e['rasgos'], '|', e['vd'][:80])
    if '--escribir' in sys.argv:
        datos = {'fuente': {'ab': 'Cov', 't': 'Alianzas', 'p': 147}, 'car': CAR, 'actividades': ACTIVIDADES, 'tecnicas': TECNICAS, 'formas': FORMAS,
                 'vd': vd, 'distintivos': dist, 'ejemplos': ej}
        with open(os.path.join(RAIZ, 'data', 'laboratorio.json'), 'w', encoding='utf8', newline='\n') as fh:
            json.dump(datos, fh, ensure_ascii=False, separators=(',', ':'))
        print('escrito data/laboratorio.json')


if __name__ == '__main__':
    main()
