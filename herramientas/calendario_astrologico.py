#!/usr/bin/env python3
"""El calendario astrológico (900–1600) de la hoja de cálculo a data/astro.json, para la pantalla del máster.

    python -X utf8 herramientas/calendario_astrologico.py RUTA.xlsx

Lee las hojas «Lunas», «Sol en los signos», «Planetas en los signos», «Luna en los signos» y «Referencias» (solo la
librería estándar: un .xlsx es un zip de XML). Los momentos son minutos desde el 1 de enero de 900 a las 00:00
(calendario juliano hasta el 4-10-1582 y gregoriano desde el 15-10-1582, como la hoja), en hora solar media de Arazas.

Formato de data/astro.json, compacto porque son 180.000 filas:
  luna    {s, t, d}  la Luna entra en un signo: s = primer signo (0 = Aries), t = primer momento, d = las diferencias
                     en minutos, 3 cifras en base 36 cada una; los signos siguen en orden
  fases   {f, t, d}  igual, con las fases (0 nueva, 1 cuarto creciente, 2 llena, 3 cuarto menguante) en orden
  sol     {s, t, d}  el Sol entra en un signo: cada entrada son 5 cifras en base 36, 3 de diferencia en minutos y 1 por
                     los días hasta el 2.º y el 3.er decanato
  planetas {Planeta: {t, d}}  d separado por comas: diferencia en base 36, signo en una cifra base 36 y «r» si entra
                     retrógrado
  signos, planetasRef  las tablas de «Referencias» tal cual
"""
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIGNOS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis']
FASES = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante']
PLANETAS = ['Mercurio', 'Venus', 'Marte', 'Júpiter', 'Saturno']
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
B36 = '0123456789abcdefghijklmnopqrstuvwxyz'


def leer_xlsx(ruta):
    """{hoja: [[celdas]]}"""
    z = zipfile.ZipFile(ruta)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('{%s}si' % M):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % M)))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out = {}
    for sh in ET.fromstring(z.read('xl/workbook.xml')).find('{%s}sheets' % M):
        p = rels[sh.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')].lstrip('/')
        if not p.startswith('xl/'): p = 'xl/' + p
        filas = []
        for row in ET.fromstring(z.read(p)).iter('{%s}row' % M):
            fila = []
            for c in row.findall('{%s}c' % M):
                col = 0
                for ch in re.match(r'[A-Z]+', c.get('r')).group(0): col = col * 26 + ord(ch) - 64
                fila += [None] * (col - 1 - len(fila))
                t, v = c.get('t'), c.find('{%s}v' % M)
                if t == 's': val = ss[int(v.text)]
                elif t == 'inlineStr': val = ''.join(x.text or '' for x in c.iter('{%s}t' % M))
                elif v is None: val = None
                elif t in ('str', 'e'): val = v.text
                else:
                    f = float(v.text)
                    val = int(f) if f.is_integer() else f
                fila.append(val)
            filas.append(fila)
        out[sh.get('name')] = filas
    return out


def jdn(y, m, d):
    """número de día juliano: calendario juliano hasta el 4-10-1582, gregoriano después"""
    a = (14 - m) // 12
    yy, mm = y + 4800 - a, m + 12 * a - 3
    n = d + (153 * mm + 2) // 5 + 365 * yy + yy // 4
    if (y, m, d) <= (1582, 10, 4): return n - 32083
    return n - yy // 100 + yy // 400 - 32045


J0 = jdn(900, 1, 1)


def momento(y, mes, d, hora):
    hh, mm = map(int, hora.split(':'))
    return (jdn(y, MESES.index(mes) + 1, d) - J0) * 1440 + hh * 60 + mm


def b36(n, ancho=0):
    s = ''
    while True:
        n, r = divmod(n, 36)
        s = B36[r] + s
        if not n: break
    if ancho:
        assert len(s) <= ancho, (n, ancho)
        s = s.rjust(ancho, '0')
    return s


def seguidos(filas, col_t, col_v, orden):
    """{primer valor, primer momento, diferencias de ancho 3}; comprueba que los valores van en orden"""
    ts = [col_t(r) for r in filas]
    vs = [orden.index(col_v(r)) for r in filas]
    for a, b in zip(vs, vs[1:]): assert b == (a + 1) % len(orden), 'fuera de orden'
    return {'s': vs[0], 't': ts[0], 'd': ''.join(b36(b - a, 3) for a, b in zip(ts, ts[1:]))}


def main():
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    x = leer_xlsx(sys.argv[1])
    cuerpo = lambda h: [r for r in x[h][1:] if r and isinstance(r[0], int)]

    lunas = cuerpo('Luna en los signos')
    luna = seguidos(lunas, lambda r: momento(r[0], r[1], r[2], r[4]), lambda r: r[5], SIGNOS)

    fs = cuerpo('Lunas')
    fases = seguidos(fs, lambda r: momento(r[0], r[1], r[2], r[4]), lambda r: r[5], FASES)
    fases['f'] = fases.pop('s')

    sol_f = cuerpo('Sol en los signos')
    sol = seguidos(sol_f, lambda r: momento(r[0], r[1], r[2], r[4]), lambda r: r[5], SIGNOS)
    dec = []
    for r in sol_f:
        j = jdn(r[0], MESES.index(r[1]) + 1, r[2])
        ds = []
        for txt in (r[12], r[13]):
            d, mes = txt.split()
            mi = MESES.index(mes) + 1
            y = r[0] + (1 if mi < MESES.index(r[1]) + 1 else 0)
            ds.append(b36(jdn(y, mi, int(d)) - j, 1))
        dec.append(''.join(ds))
    difs = [sol['d'][i:i + 3] for i in range(0, len(sol['d']), 3)]
    sol['d'] = ''.join(df + dc for df, dc in zip(difs, dec[:-1]))
    sol['u'] = dec[-1]   # los decanatos de la última entrada

    planetas = {}
    for p in PLANETAS:
        fl = [r for r in cuerpo('Planetas en los signos') if r[4] == p]
        ts = [momento(r[0], r[1], r[2], r[3]) for r in fl]
        trozos = [b36(t - (ts[i - 1] if i else ts[0])) + b36(SIGNOS.index(r[5]), 1) + ('r' if r[6] == 'retrógrado' else '')
                  for i, (t, r) in enumerate(zip(ts, fl))]
        planetas[p] = {'t': ts[0], 'd': ','.join(trozos)}

    ref = x['Referencias']
    signos = []
    for r in ref[2:14]:
        assert r[0] == SIGNOS[len(signos)], r
        signos.append({'n': r[0], 'elemento': r[1], 'humor': r[2], 'genero': r[3], 'cualidad': r[4], 'regente': r[5],
                       'decanatos': [r[7], r[8], r[9]]})
    planetas_ref = {}
    for r in ref[16:23]:
        planetas_ref[r[0]] = {'dia': r[1], 'car': r[2], 'ambito': r[7]}
    assert set(planetas_ref) == set(PLANETAS + ['Sol', 'Luna']), planetas_ref

    out = {'v': 1, 'desde': 900, 'hasta': 1600, 'fuente': os.path.basename(sys.argv[1]),
           'signos': signos, 'planetasRef': planetas_ref,
           'sol': sol, 'luna': luna, 'fases': fases, 'planetas': planetas}
    dst = os.path.join(RAIZ, 'data', 'astro.json')
    with open(dst, 'w', encoding='utf8', newline='\n') as fh:
        fh.write(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('data/astro.json: %d KB · Luna en signos %d · fases %d · Sol %d · planetas %s' % (
        os.path.getsize(dst) // 1024, len(lunas), len(fs), len(sol_f),
        ', '.join('%s %d' % (p, planetas[p]['d'].count(',') + 1) for p in PLANETAS)))


if __name__ == '__main__':
    main()
