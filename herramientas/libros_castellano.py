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
    'HoH:MC': {'nombre': 'Casas de Hermes: Cultos Mistéricos', 'subtitulos': True, 'casar': {
        # Criamon: las «Estaciones» del compendio son los «Hitos» del libro
        'Estación de la Herramienta Perfecta': 'Hito de la Herramienta Perfecta',
        'Estación de Alimento Espiritual': 'Hito del Sustento Espiritual',
        'Estación de Perfecta Economía de Movimiento': 'Hito del Movimiento Perfecto',
        'Estación del Microcosmos': 'Hito del Microcosmos',
        'Umbral del reposo corpóreo': 'Umbral del Reposo Corporal',
        'Estación de la diferenciación de lo aparente': 'Hito del Discernimiento de la Impostura',
        'Estación de la Visión Verdadera': 'Hito de la Visión Verdadera',
        'Estación de recuerdos vívidos de los objetos': 'Hito de los Recuerdos Vívidos de los Objetos',
        'Estación de paso a través de lo aparente': 'Hito de la Impostura Franqueada',
        'Estación desde la que ignorar lo real': 'Hito desde Donde Ignorar la Realidad',
        'Estación del Devorador de Pecados': 'Hito del Comepecados',
        'Estación de Sangre y Bronce': 'Hito de la Sangre y el Bronce',
        'Estación que repele y atrae elementos': 'Hito que Repudia y Atrae a los Elementos',
        'Estación que encanta a los elementos': 'Hito que Fascina a los Elementos',
        'Estación de la sidra dorada': 'Hito de la Sidra Dorada',
        'Estación de Servicio a la Armonía': 'Hito del Servicio al Amor',
        'Estación de Arroz y Miel': 'Hito del Arroz y la Miel',
        'Estación de Expresión': 'Hito de la Expresión',
        'Estación de Exaltación': 'Hito de la Exaltación',
        'Ascensión inmortal como reposo': 'Hito del Umbral del Reposo',
        # las pistas los cruzaban (Alluring / Inoffensive / Offensive / Unbearable to Beings)
        'Atractivo para los (Seres)': 'Fascinante para los (Tipo de Ser)',
        'Inofensivo para (Seres)': 'Inofensivo para los (Tipo de Ser)',
        'Ofensivo para (Seres)': 'Ofensivo para los (Tipo de Ser)',
        'Inaguantable para (Seres)': 'Insoportable para los (Tipo de Ser)',
        # filas repetidas en el compendio, la misma virtud
        'Magia Potente': 'Magia Potenciada',
        'Seguidor': 'Miembro de la Manada / Borrego',
        'Mentalidad de Rebaño': 'Miembro de la Manada / Borrego',
        'Mago Maligno': 'Magus Maligno',
        'Estigmas Proféticos': 'Estigmas Proféticos',
        'Conocimiento de la Naturaleza': 'Conocimiento de la Naturaleza',
        'Crear Autómata': 'Ingeniero de Autómatas',
    }},
    # la edición en castellano de Cultos Mistéricos trae en su primer capítulo varias virtudes de The Mysteries (Magia
    # Planetaria, Teúrgia Hermética…): sus entradas se casan con ese PDF, que es también su enlace «ES»
    'TMRE': {'nombre': 'The Mysteries, Revised Edition', 'pdf': 'HoH:MC', 'casar': {
        'Adivinación y Augurio': 'Adivinación',
        'Ascendencia al Salón de los Héroes': 'Ascenso al Salón de los Héroes',
        'Escritura en el Alma': 'Inscribir el Alma',
        'Magia Invocadora': 'Magia de Invocación',
        'Magia de Sueños': 'Magia Onírica',
        'Magia Potente (Casa)': 'Magia Potenciada',
        'Magia Potente (Signo o Planeta)': 'Magia Potenciada',
        'Magia Potente (Signo/Planeta)': 'Magia Potenciada',
        'Interpretación de Sueños Hermética': 'Oniromancia Hermética',
    }, 'solo_a_mano': True, 'subtitulos': True},
    'HoH:S': {'nombre': 'Casas de Hermes: Societates', 'casar': {
        # las tradiciones de Ex Miscellanea: el compendio las tradujo por su cuenta
        'Guarda': 'Custodia', 'Desaparecer': 'Destierro', 'Herboristería mítica': 'Herbología mítica',
        'Comprender Magia': 'Comprensión mágica', 'Canción de Sirena': 'Canto de sirena', 'Magia Circular/Anillo': 'Magia anular',
        'Magia de Orfeo': 'Magia órfica', 'Cortarraíces': 'Estaquillar', 'Foco de Hechizos': 'Foci de hechizos', 'Sihr': 'SiḤr',
        'Bendición del Humor Sanguíneo': 'Bendición del humor sanguíneo',
        'Vulnerable a la Tradición': 'Vulnerable a los remedios populares',
        # las Habilidades sobrenaturales de las tradiciones: en el compendio, la Virtud mayor que las da
        'Controlar Fertilidad': 'Fertilidad', 'Invocar Animales': 'Invocar animales', 'Silba el Viento': 'Silbo de viento',
     }, 'nombres': {'SiḤr': 'Siḥr'}, 'subtitulos': True,
        # sin línea de valor: «Invocar animales» / «Los personajes con esta Habilidad…»
        'habilidades': {'Invocar animales', 'Fertilidad', 'Silbo de viento'}},
    'RoP:M': {'nombre': 'Reinos de Poder: Magia', 'subtitulos': True, 'casar': {'Devoto de un espíritu': 'Devoto de los espíritus'}},
    # los poderes feéricos y virtudes de la hoja de virtudes (cap. 7, en mayúsculas), y las virtudes y defectos de los seres
    # feéricos (cap. 3), que están en la hoja «Seres sobrenaturales» con su nombre inglés: 'seres' casa ese nombre con el del libro
    'RoP:F': {'nombre': 'Reinos de Poder: Feérico', 'mayus': True, 'casar': {
        'Lanzamiento de maldiciones': 'Lanzar maldiciones', 'Invocación (de hadas)': 'Invocar', 'Embaucar': 'Seducir',
        'Vinculación': 'Vincular', 'Cautivador': 'Cautivar', 'Despedir': 'Expulsar', 'Presencia espantosa': 'Presencia asombrosa',
        'Familiaridad con las hadas': 'Familiaridad con los seres feéricos', 'Conceder': 'Otorgar', 'Porteo': 'Transporte',
        'Mercancía': 'Vigilar', 'Bienestar': 'Mejorar', 'Aflicción': 'Desgracia',   # Ward (el compendio decía «Ware»), Weal, Woe
        'Hechicero homúnculo': 'Hechicero homúnculo', 'Antipatía Feérica': 'Antipatía feérica', 'Simpatía feérica': 'Simpatía feérica'},
        'nombres': {'FEÉRICOS': 'Familiaridad con los seres feéricos', 'PODER RESIDUAl': 'Poder residual',
                    'DEFECTOS LIMITANTES DE PODERES PODER REDUCIDO': 'Poder reducido', 'FOCUS EN PODEr': 'Poder focalizado',
                    'VITALIDAD': 'La recuperación de poder requiere vitalidad', 'ALTAMENTE COGNOSCENTES': 'Altamente cognoscente'},
        'seres': {
            'Infiltrator': 'Infiltrador', 'External Vis': 'Vis externa', 'Focus Power': 'Focus en poder', 'Greater Power': 'Poder mayor',
            'Immune to (Source of Damage)': 'Inmune a (fuente de daño)', 'Increased Faerie Might': 'Poder feérico incrementado',
            'Ritual Power': 'Poder ritual', 'Huge': 'Enorme', 'Ostentatious': 'Ostentoso', 'Positive Folktales': 'Cuentos folclóricos positivos',
            'Faerie Beast': 'Bestia feérica', 'Faerie Instructor': 'Instructor feérico', 'Faerie Sight': 'Visión feérica',
            'Faerie Speech': 'Lenguaje feérico', 'Fast Might Recovery': 'Recuperación rápida de poder', 'Feast of the Dead': 'El festín de los muertos',
            'Feast of the Fae': 'El festín de los fae', 'Highly Cognizant': 'Altamente cognoscentes', 'Humanoid Faerie': 'Feérico humanoide',
            'Hybrid Form': 'Forma híbrida', 'Improved Damage': 'Daño mejorado', 'Improved Initiative': 'Iniciativa mejorada',
            'Improved Powers': 'Poderes incrementados', 'Improved Soak': 'Aguante mejorado', 'Lesser Power': 'Poder menor',
            'Personal Power': 'Poder personal', 'Puissant Pretense': 'Maña en simulación', 'Reputation as Confidence': 'Reputación como confianza',
            'Residual Power': 'Poder residual', 'Time or Place of Power': 'Tiempo o lugar de poder', 'Pretentious': 'Pretencioso',
            'Passes for Human': 'Pasar por humano', 'Faerie Trainer': 'Entrenador feérico', 'Narrowly Cognizant': 'Ligeramente cognoscente',
            'Observant': 'Observador', 'Monstrous Appearance': 'Apariencia monstruosa', 'Intangible Flesh': 'Carne intangible',
            'Might Recovery Requires Vitality': 'La recuperación de poder requiere vitalidad', 'Restricted Might': 'Poder restringido',
            'Slow Might Recovery': 'Recuperación lenta de poder', 'Sovereign Ward': 'Protección suprema',
            'Vulnerable to (Substance)': 'Vulnerable a (sustancia)', 'Little': 'Pequeño', 'Negative Reaction': 'Reacción negativa',
            'Decreased Might': 'Disminución del poder', 'Freshly Sprung': 'Recién nacido', 'Incognizant': 'Incognoscente',
            'Poor Combatant': 'Mal combatiente', 'Reduced Damage': 'Daño reducido', 'Reduced Initiative': 'Iniciativa reducida',
            'Reduced Power': 'Poder reducido', 'Reduced Soak': 'Aguante reducido', 'Role Requires Suffering': 'El papel requiere sufrimiento',
            'Slow Power': 'Poder lento', 'Susceptible to Deprivation': 'Susceptible a la carencia', 'Traditional Ward': 'Protección tradicional',
            'Aloof': 'Distante'}},
    'App': {'nombre': 'Aprendices', 'casar': {'Obsesión': 'Amor ciego', 'Don Suprimido': 'Don reprimido'},
            # tras «Bastardo» la maqueta pone los paquetes de Habilidades de la infancia, que no son suyos
            'cortar': {'Bastardo': 'Los siguientes paquetes'}},
    # magias no herméticas: el PDF en castellano está en OneDrive (pásalo con --pdf)
    'HMRE': {'nombre': 'Magia Limítrofe', 'excluir': {'Curación', 'Deficiencia Mágica Mayor'},
             'casar': {'(Tipo) Control': 'Controlar (clase)', 'Controlador': 'Controlar (clase)'}},
    'RM': {'nombre': 'Magia Rival', 'prefijo': True,
           # las Habilidades de los muspelli y algunas virtudes: el nombre solo en su línea, sin valor
           'insertar': {x: 'Mayor, Sobrenatural' for x in ('Sjonhverfing', 'Spadomur', 'Ojo de Tormenta', 'Hilos del destino', 'Valgaldrar',
                                                          'Fuego Salvaje', 'Aliento de invierno')} | {
               'MAESTRA EXPERIMENTADA': 'Menor, Historia', 'GENEROSO': 'Menor, Historia', 'MAGIA DE ENCANTAMIENTO DÉBIL': 'Mayor, Hermética'},
           'casar': {'Maestra hábil': 'Maestra experimentada', 'Maestro generoso': 'Generoso', 'Magia de encantamientos pobre': 'Magia de encantamiento débil',
                     'Ojo de tormenta': 'Ojo de Tormenta', 'Fuego salvaje': 'Fuego Salvaje', 'Hilos del destino': 'Hilos del destino',
                     'Valgaldrar': 'Valgaldrar', 'Sjonhverfing': 'Sjonhverfing', 'Spadomur': 'Spadomur', 'Aliento de invierno': 'Aliento de invierno'},
           'nombres': {'GENEROSO': 'Maestro generoso'}},
    'AnM': {'nombre': 'Magia Antigua', 'prefijo': True,
            # el libro pone de ejemplo al grigori Araquiel donde el compendio dice «(Grigorus)»
            'nombres': {'EL LEGADO DE ARAQUIEL': 'Legado de Grigorus', 'EL SECRETO DE ARAQUIEL': 'Secreto de Grigorus',
                        'Nueva Virtud MAGIA RÚNICA HERMÉTICA': 'Magia rúnica hermética', 'Nuevas Virtudes HIMNISTA HIPERBÓREO': 'Himnista hiperbóreo'}},
    # los animulae (cap. de Rocío): el nombre solo en su línea y el texto debajo, sin línea de valor; 'insertar' se la pone
    'BCoC': {'nombre': 'Calebais: la alianza rota',
             'insertar': {'Poderes Superiores': 'Mayor, General', 'Fiereza': 'Menor, General', 'Poder Aumentado': 'Menor, General',
                          'Poderes Menores': 'Menor, General'},
             'dos_puntos': {'Animula': 'Mayor, Estatus social'},   # «Animula: Eres un animal…»
             'casar': {'Poderes Mayores': 'Poderes Superiores', 'Ferocidad': 'Fiereza'},
             'nombres': {'Fiereza': 'Ferocidad'},   # la misma fila que la Ferocidad de otros libros: se queda su nombre
             'seres': {'Greater Powers': 'Poderes Superiores', 'Ferocity': 'Ferocidad', 'Lesser Powers': 'Poderes Menores',
                       'Improved Might': 'Poder Aumentado', 'Animula': 'Animula'}},
}
EXTRA = {'heroica', 'heroico', 'estatus', 'social'}
STOP = set('para como pero cuando donde sobre entre desde hasta tiene tienen puede pueden cada otra otros otras esta este '
           'estos estas personaje mago maga magus magi puntos tirada tiradas bono virtud defecto'.split())
# encabezados con el tipo delante del valor («Hermética, Menor»)
TV = re.compile(r'^([^\W\d_][^,]{2,30}), ((?:Mayor|Menor|Libre|Gratuit[ao]|Especial)(?: o (?:Mayor|Menor))?)\b(.*)$')


# encabezados en una línea: «Magia Planetaria (Menor, Hermética) El uso de…» -> «Magia Planetaria» / «Menor, Hermética El uso de…»
EN_LINEA = re.compile(r'^([A-ZÁÉÍÓÚÑ(][^()]{2,60}?(?:\([^)]{1,30}\)[^()]{0,25}?)?)\s*\(((?:Mayor|Menor|Libre|Gratuit[ao]|Especial)(?: o (?:Mayor|Menor))?, [^)]{3,40})\)\s*(.*)$')


# los Misterios de Cultos Mistéricos: «Magia Sensorial (Misterio Menor de la Casa)», «Glamour (Misterio Mayor de las Ilusiones)»
MISTERIO = re.compile(r'^([A-ZÁÉÍÓÚÑ][^()]{2,60}?)\s*\((?:Misterio|Virtud) (Mayor|Menor)[^)]{0,50}\)\s*(.*)$')


COLA = re.compile(r'^(\S.{0,35}?)\s+((?:Mayor|Menor|Gratuit[ao]|Especial)(?: o (?:Mayor|Menor))?, \w.*)$')
NUEVA = re.compile(r'^Nuev[ao] (?:virtud|defecto):\s*(.*)$', re.I)
# Reinos de Poder: Feérico: «VIS EXTERNA Virtud menor o mayor, Sobrenatural La esencia…» en una línea
# (y «DISMINUCIÓN DEL PODER Sobrenatural, Menor…», «OBSERVADOR Elección Gratuita…», «Protección tradicional Defecto menor…»)
MAYUS = re.compile(r'^([A-ZÁÉÍÓÚÑÜ(][A-Za-zÁÉÍÓÚÑÜáéíóúñü() /–-]{2,60}?)\s+('
                   r'(?:Virtud|Defecto|Elección) (?i:mayor|menor|gratuita)(?: o (?i:mayor|menor))?\b.*'
                   r'|(?:Mayor|Menor|Gratuita)(?: o (?:Mayor|Menor))?, \w.*'
                   r'|(?:Sobrenatural|General|Social|Interacción Social), (?:Mayor|Menor)\b.*)$')
# Magia Rival y Magia Antigua: «VIRTUD SOBRENATURAL MAYOR: HECHICERÍA POTENTE», «Defecto Sobrenatural Menor Ritual de…»
PREFIJO = re.compile(r'^(?i:virtud|defecto)(?: (?i:de))? ([A-Za-zÁÉÍÓÚáéíóúñÑ]+) ((?i:mayor|menor|gratuita))\s*:?\s+(\S.{2,60})$')
HITO = re.compile(r'^La Vía .+? y (?:el|la) ((?:Hito|Umbral)\b.*)$')


def lineas(ruta, cfg=None):
    cfg = cfg or {}
    ls = []
    crudas = [(p, unicodedata.normalize('NFC', l)) for p, l in D.lineas_libro(ruta)]
    for i, (p, l) in enumerate(crudas):
        m = NUEVA.match(l)
        if m:   # «Nueva virtud: custodia»: el prefijo fuera y la mayúscula al nombre (que puede ir en la línea siguiente)
            if not m.group(1).strip(): continue
            l = m.group(1).strip()
            l = l[0].upper() + l[1:]
        elif i and NUEVA.match(crudas[i - 1][1]) and not NUEVA.match(crudas[i - 1][1]).group(1).strip() and l:
            l = l[0].upper() + l[1:]
        m = PREFIJO.match(l) if cfg.get('prefijo') else None
        if m and L.norm(m.group(1)) in D.TIPOS | EXTRA:
            ls.append((p, m.group(3).strip())); ls.append((p, m.group(2).capitalize() + ', ' + m.group(1).capitalize())); continue
        if l in cfg.get('insertar', {}):
            ls.append((p, l)); ls.append((p, cfg['insertar'][l])); continue
        dp = next((k for k in cfg.get('dos_puntos', {}) if l.startswith(k + ': ')), None)
        if dp:
            ls.append((p, dp)); ls.append((p, cfg['dos_puntos'][dp])); ls.append((p, l[len(dp) + 2:])); continue
        if l in cfg.get('habilidades', ()) and next((x for _, x in crudas[i + 1:i + 3] if x), '').startswith('Los personajes con esta Habilidad'):
            ls.append((p, l)); ls.append((p, 'Mayor, Sobrenatural')); continue
        m = MISTERIO.match(l)
        if m and not m.group(1).startswith(('Iniciación', 'Ejemplo')):
            ls.append((p, re.sub(r'^(El|La|Los|Las) ', '', m.group(1).strip()))); ls.append((p, (m.group(2) + ', Mistérica ' + m.group(3)).strip())); continue
        m = MAYUS.match(l) if cfg.get('mayus') else None
        letras = [c for c in m.group(1) if c.isalpha()] if m else []
        if letras and (sum(c.isupper() for c in letras) >= 0.8 * len(letras)
                       or (m.group(2).startswith(('Virtud ', 'Defecto ')) and len(m.group(1).split()) <= 4)):
            ls.append((p, m.group(1).strip())); ls.append((p, re.sub(r'^Elección ', '', m.group(2)))); continue
        m = EN_LINEA.match(l)
        if m and set(L.norm(m.group(2).split(',', 1)[1]).split()) <= D.TIPOS | EXTRA:
            ls.append((p, m.group(1).strip())); ls.append((p, (m.group(2) + ' ' + m.group(3)).strip())); continue
        ls.append((p, l))
    # Criamon: «La Vía del Espejo Esférico y el Hito del Microcosmos» abre la descripción del hito (si detrás no viene el
    # «Nivel Objetivo» de su guion de iniciación): pasa a encabezado «Hito del Microcosmos» / «Mayor, Mistérica»
    out = []
    for i, (p, l) in enumerate(ls):
        m = HITO.match(l)
        sig = next((x for _, x in ls[i + 1:i + 3] if x), '')
        if m and not sig.startswith('Nivel Objetivo'):
            out.append((p, m.group(1))); out.append((p, 'Mayor, Mistérica'))
        else: out.append((p, l))
    ls = out
    # el nombre en dos líneas y la segunda con el valor detrás: «Imbuido con el espíritu» / «de (Forma) Menor, Hermética El…»
    partir = {}
    for i, (p, l) in enumerate(ls):
        m = COLA.match(l)
        if not m or not i or D.es_valor(l) or set(L.norm(m.group(2).split(',', 1)[1]).split()[:1]) - (D.TIPOS | EXTRA): continue
        k = i - 1
        while k > 0 and not ls[k][1]: k -= 1
        prev = ls[k][1]
        if prev and len(prev) <= 45 and prev[-1] not in '.,;:!?»' and prev[0].isupper() and not D.es_valor(prev):
            ls[k] = (ls[k][0], prev + ' ' + m.group(1)); ls[i] = (p, m.group(2))
        elif (not prev or prev[-1] in '.!?»)') and m.group(1)[:1] in '(ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ' and '.' not in m.group(1):
            partir[i] = m   # «(Ser) transformado Mayor, Sobrenatural El…»: el nombre y el valor en la misma línea
    ls = [x for i, (p, l) in enumerate(ls) for x in ([(p, partir[i].group(1)), (p, partir[i].group(2))] if i in partir else [(p, l)])]
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


def cola(t):
    """quita lo que queda tras la última frase si es un trozo corto sin punto: el nombre de la entrada siguiente o el de
    una sección («… otros Defectos de historia. Defecto Protegido»)"""
    m = re.search(r'^(.*[.!?»)])\s+([^.!?»]{1,45})$', t, re.S)
    return m.group(1) if m else t


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


SECCION = re.compile(r'^Nuev[ao]s? (virtud|defecto|virtudes|defectos)\b', re.I)
SUBTIT = ('Ejemplo', 'Guía', 'Guías', 'Iniciación', 'Nuevo', 'Nueva', 'Nuevos', 'Nuevas', 'Requisitos', 'Bono', 'Total', 'Factor')


def encabezados(ls, desde=1, hasta=10 ** 6, subtitulos=False):
    """los encabezados «Nombre / Valor, Tipo» del libro (entre esas páginas del PDF), con dónde acaba el texto de cada uno.
    subtitulos: las entradas tienen apartados dentro («Guías del Glamour»): el texto sigue hasta el encabezado siguiente"""
    cab = [c for c in D.cabeceras(ls) if desde <= ls[c[0]][0] <= hasta]
    heads = []
    for n, (j, vs) in enumerate(cab):
        fin = cab[n + 1][1][0][1] if n + 1 < len(cab) else min(len(ls), j + 80)
        if subtitulos:   # sigue tras los apartados de la entrada («Guías del Glamour»), no tras otro título
            raices = {w[:6] for v in vs for w in L.norm(v[0]).split() if len(w) >= 5}
            propio = lambda t: not SECCION.match(t) and (t.startswith(SUBTIT) or bool(raices & {w[:6] for w in L.norm(t).split() if len(w) >= 5}))
            # un título en mitad de una frase es un recuadro que la maqueta mete en medio: el texto sigue después
            corta = lambda i: next((x for _, x in reversed(ls[j:i]) if x), '.')[-1:] in '.!?»):'
            fin = next((i for i in range(j + 1, min(fin, j + 140)) if titulo(ls, i) and not propio(ls[i][1]) and corta(i)), fin)
        else: fin = next((i for i in range(j + 1, min(fin, j + 140)) if titulo(ls, i)), fin)
        names = [limpio(v[0]) for v in vs]
        if len(names) > 1 and names[0][:1].islower(): names = names[1:] + names[:1]
        names = [n[:1].upper() + n[1:] for n in names]
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
    ls = lineas(ruta, cfg)
    heads = encabezados(ls, subtitulos=cfg.get('subtitulos', False))
    if cfg.get('mayus'): heads = [h for h in heads if not h['valor'][:5].isupper()]

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
            if quiero:   # a mano: la misma cabecera puede servir a dos filas (las repetidas del compendio)
                if L.norm(quiero) in [L.norm(x) for x in h['names']]: asig[k] = (h, 'a mano', 1.0); usados.add(h['n']); break
                continue
            # el mismo nombre: también la segunda de dos filas repetidas del compendio
            if any(D.sin_parentesis(x) == D.sin_parentesis(e['es']) for x in h['names']) and D.valor_compatible(e['valor'], h['valor']):
                asig[k] = (h, 'exacto', 1.0); usados.add(h['n']); break
    anc = sorted((ents[k]['ref'], h['pag']) for k, (h, m, _) in asig.items())

    def esperada(ref):
        if not anc: return None
        return ref + statistics.median([p - r for r, p in sorted(anc, key=lambda a: abs(a[0] - ref))[:4]])

    cands = []
    for k, e in enumerate(ents):
        if k in asig or e['es'] in rep or cfg.get('solo_a_mano') or e['es'] in cfg.get('excluir', ()): continue
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
    if 'seres' in cfg: casar.heads = heads   # para la hoja de seres sobrenaturales (main)
    res = []
    for k, e in enumerate(ents):
        h, modo, punt = asig.get(k, (None, '', 0))
        texto = cola(sin_relleno(D.cuerpo(ls, h['j'], h['fin'], e))) if h else ''
        corte = cfg.get('cortar', {}).get(e['es'])
        if corte and corte in texto: texto = texto[:texto.index(corte)].rstrip()
        res.append((e, h, modo, punt, texto))
    return res, [h for h in heads if h['n'] not in usados]


def caso(nuevo, viejo):
    """los encabezados en mayúsculas de algunos libros («DON REPRIMIDO»): en minúscula, con mayúscula la primera palabra
    y las que la tenían en el nombre del compendio («Don Suprimido» -> «Don reprimido»)"""
    if not nuevo.isupper(): return nuevo
    mays = {w.lower() for w in re.findall(r'\w+', viejo) if w[:1].isupper()}
    ws = re.split(r'(\W+)', nuevo.lower())
    out = ''.join(w.capitalize() if (i == 0 or w in mays) and w.isalpha() else w for i, w in enumerate(ws))
    return out[:1].upper() + out[1:]


def valor_tipo(linea):
    """«Menor, Hermético Te criaste…» -> ('Menor', 'Hermética')"""
    v, _, t = re.sub(r'^(?:Virtud|Defecto)\s+', '', linea, flags=re.I).partition(',')
    tipo = ' '.join(w for w in t.split()[:2] if L.norm(w) in D.TIPOS | EXTRA)
    tipo = {'hermetico': 'Hermética', 'heroico': 'Heroica'}.get(L.norm(tipo), tipo[:1].upper() + tipo[1:])
    return v.split()[0].capitalize(), tipo


def main():
    ab = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else None
    if ab not in LIBROS_ES: raise SystemExit('Libros que sabe hacer: ' + ', '.join(LIBROS_ES))
    slug = L.LIBROS[LIBROS_ES[ab].get('pdf', ab)][0]   # el PDF de otro libro, si sus textos están en él
    pdf = sys.argv[sys.argv.index('--pdf') + 1] if '--pdf' in sys.argv else L.ruta_es(LIBROS_ES[ab].get('pdf', ab))
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
                par = re.search(r'\s*(\([^)]*\))\s*$', r[0])
                libro = caso(LIBROS_ES[ab].get('nombres', {}).get(h['name'], h['name']), r[0])
                nuevo = libro + ' ' + par.group(1) if par and '(' not in libro else libro
                if nuevo.lower() == r[0].lower(): nuevo = r[0]
                if nuevo != r[0]:
                    nl.append({'ab': ab, 'es': r[0], 'pag': r[5], 'en': r[1], 'tipo': r[2], 'valor': r[3], 'nuevo': nuevo})
                    if L.norm(r[0]) != L.norm(nuevo): alias[r[0]] = nuevo
                    lj['es'].pop('%s|%s|%s' % (ab, r[0], r[5]), None)
                    r[0] = nuevo
                if not D.valor_compatible(r[3], h['valor']): r[3], r[2] = valor_tipo(h['valor'])
                if t: r[7] = t; n += 1
                lj['es']['%s|%s|%s' % (ab, r[0], r[5])] = h['pag']
                if (r[0], r[2], r[3]) != viejo: cambios += 1; print('  %s -> %s' % (' · '.join(viejo), ' · '.join((r[0], r[2], r[3]))))
            for r in quitar: b['rows'].remove(r); print('  quitada fila repetida:', r[0])
    n += seres(ab, doc, alias, lj)
    with open(nl_ruta, 'w', encoding='utf8', newline='\n') as fh: fh.write(json.dumps(nl, ensure_ascii=False, indent=1) + '\n')
    guardar(ab, slug, pdf, raw, d, lj)
    print('escrito: %d textos, %d nombres/valores cambiados' % (n, cambios))


def seres(ab, doc, alias, lj):
    """la hoja «Seres sobrenaturales» (Nombre, Original, Reino, Clase, Tipo, Valor, Pág., Descripción): las filas de este libro
    con su nombre inglés pasan al nombre del libro en castellano, el inglés a «Original», y su página del PDF en castellano"""
    m = LIBROS_ES[ab].get('seres')
    if not m: return 0
    heads = {L.norm(x): h for h in casar.heads for x in h['names'] + [LIBROS_ES[ab].get('nombres', {}).get(h['name'], h['name'])]}
    n = 0
    for sh in doc['sheets']:
        if sh['id'] in ('virtudes', 'defectos'): continue
        for b in sh['blocks']:
            if b['t'] != 'table' or b['cols'][:2] != ['Nombre', 'Original'] or 'Pág.' not in b['cols']: continue
            ip = b['cols'].index('Pág.')
            for r in b['rows']:
                if not r[ip].startswith(ab + ' '): continue
                es = m.get(r[0]) or m.get(r[1])
                h = heads.get(L.norm(es)) if es else None
                if not h: print('  seres: sin casar', r[0]); continue
                if r[0] != es:
                    if not r[1]: r[1] = r[0]
                    alias[r[0]] = es
                    lj['es'].pop('%s|%s|%s' % (ab, r[0], r[ip]), None)
                    r[0] = es
                lj['es']['%s|%s|%s' % (ab, r[0], r[ip])] = h['pag']
                n += 1
    print('  seres sobrenaturales: %d filas' % n)
    return 0


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
