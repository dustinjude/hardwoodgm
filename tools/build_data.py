# Builds data.json for the original GM game: ratings are computed here from real box-score and advanced stats.
# Source files are not kept in this project (the game only needs data.json and hist.json). Put them in one folder and
# point HGM_SOURCES at it: real-player-data.basketball.json and real-player-stats.basketball.json (Basketball GM's public
# real-player data, used only as a source of real stats) and the re-rated league files gen-1990.json ... gen-2026.json.
# Run from the project root: HGM_SOURCES=/path/to/sources python3 tools/build_data.py
import sys, os, json, collections, math
import numpy as np
SRC = os.environ.get('HGM_SOURCES') or sys.exit('Set HGM_SOURCES to the folder with the source files (see the top of this script).')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load():
    D = json.load(open(os.path.join(SRC, 'real-player-data.basketball.json'))); S = json.load(open(os.path.join(SRC, 'real-player-stats.basketball.json')))['stats']
    return D, S
D, S = load(); bios = D['bios']
SEASONS = list(range(1990, 2027))
def agg(slug, y):
    rows = [r for r in S.get(slug, []) if r['season'] == y and not r.get('playoffs')]
    if not rows: return None
    a = collections.Counter()
    for r in rows:
        for k in ('gp', 'min', 'pts', 'orb', 'drb', 'ast', 'stl', 'blk', 'tp', 'tpa', 'fg', 'fga', 'ft', 'fta', 'tov', 'ows', 'dws'): a[k] += r.get(k) or 0
        for k in ('per', 'obpm', 'dbpm'): a[k] += (r.get(k) or 0) * (r.get('min') or 0)
    if a['min'] <= 0: return None
    for k in ('per', 'obpm', 'dbpm'): a[k] /= a['min']
    return a
RANKS = [(1, 98), (3, 95.5), (8, 92), (15, 89.5), (30, 86), (50, 83), (80, 80), (120, 76.5), (170, 73), (230, 69.5), (300, 65.5), (380, 61), (450, 56.5), (520, 52), (700, 46)]
def rank_to_ovr(r):
    xs = [math.log(a) for a, b in RANKS]; ys = [b for a, b in RANKS]
    return float(np.interp(math.log(max(r, 1)), xs, ys))
clip = lambda x, lo=25, hi=99: int(round(max(lo, min(hi, x))))
RAT = {}  # (slug, season) -> [ovr, sc, sh, pm, rb, df, st]
LG = {}
for y in SEASONS:
    A = {s: agg(s, y) for s in S}; A = {s: a for s, a in A.items() if a}
    reg = [a for a in A.values() if a['min'] >= 500]
    wm = lambda f: np.average([f(a) for a in reg], weights=[a['min'] for a in reg])
    wsd = lambda f: math.sqrt(np.average([(f(a) - wm(f)) ** 2 for a in reg], weights=[a['min'] for a in reg]))
    fb = lambda a: a['obpm'] + a['dbpm']; fw = lambda a: (a['ows'] + a['dws']) / a['min'] * 48; fp = lambda a: a['per']
    fd = lambda a: a['dbpm']; fs = lambda a: a['stl'] / a['min'] * 36; fk = lambda a: a['blk'] / a['min'] * 36
    st = {n: (wm(f), wsd(f)) for n, f in (('b', fb), ('w', fw), ('p', fp), ('d', fd), ('s', fs), ('k', fk))}
    z = lambda n, f, a: max(-3.5, min(4.5, (f(a) - st[n][0]) / st[n][1]))
    mpgs = [a['min'] / a['gp'] for a in A.values() if a['gp'] >= 10]; mm, ms = np.mean(mpgs), np.std(mpgs)
    comp = {}
    for s, a in A.items():
        w = a['min'] / (a['min'] + 450)
        v = (0.45 * z('b', fb, a) + 0.30 * z('w', fw, a) + 0.25 * z('p', fp, a)) * w + (-1.3) * (1 - w)
        comp[s] = v + 0.8 * ((a['min'] / a['gp'] - mm) / ms) * min(1, a['gp'] / 25)
    order = sorted(comp, key=lambda s: -comp[s])
    nteams = len({r['abbrev'] for s in A for r in S[s] if r['season'] == y and r.get('abbrev') != 'TOT'})
    tg = collections.defaultdict(int)
    for s in A:
        for r in S[s]:
            if r['season'] == y and not r.get('playoffs'): tg[r.get('abbrev')] = max(tg[r.get('abbrev')], r.get('gp') or 0)
    games = len(tg) * {1999: 50, 2012: 66, 2020: 70.6, 2021: 72}.get(y, 82); LG[y] = [round(sum(a['pts'] for a in A.values()) / games, 1), round(sum(a['tp'] for a in A.values()) / games, 1), len(tg)]
    lg2 = sum(a['fg'] - a['tp'] for a in A.values()) / max(1, sum(a['fga'] - a['tpa'] for a in A.values()))
    for i, s in enumerate(order):
        a = A[s]; w = a['min'] / (a['min'] + 300); p36 = lambda k: a[k] / a['min'] * 36
        ovr = rank_to_ovr((i + 1) * 30 / len(tg))
        sc = clip(25 + 2.45 * (p36('pts') * w + 11 * (1 - w)))
        sh = clip(25 + 19 * (p36('tp') * w + 0.3 * (1 - w)))
        pm = clip(25 + 6.3 * (p36('ast') * w + 2.2 * (1 - w)))
        rb = clip(25 + 4.7 * ((p36('orb') + p36('drb')) * w + 5 * (1 - w)))
        df = clip(55 + 13 * w * (0.5 * z('d', fd, a) + 0.25 * z('s', fs, a) + 0.25 * z('k', fk, a)))
        stm = clip(25 + 1.9 * (a['min'] / a['gp']) * min(1, a['gp'] / 20) + 20 * (1 - min(1, a['gp'] / 20)))
        blkshare = clip(100 * a['blk'] / max(1, a['blk'] + a['stl']), 0, 100)
        a2 = a['fga'] - a['tpa']; p2 = (a['fg'] - a['tp'] + 80 * lg2) / (a2 + 80); p3 = (a['tp'] + 50 * .26) / (a['tpa'] + 50); pft = (a['ft'] + 15 * .72) / (a['fta'] + 15)
        touches = (p36('pts') / 2 + p36('ast') * 1.5 + 2); ratio = (p36('tov') / touches) * w + .13 * (1 - w)
        ext = [clip(25 + (p2 - .36) * 330), clip(25 + (p3 - .20) * 330), clip(25 + (pft - .45) * 160), clip(25 + (.22 - ratio) * 500), clip(25 + 14 * (p36('orb') * w + 1.2 * (1 - w))), clip(25 + 6.2 * (p36('drb') * w + 3.8 * (1 - w))), clip(25 + 20 * (p36('blk') * w + .5 * (1 - w))), clip(25 + 30 * (p36('stl') * w + 1.0 * (1 - w)))]
        # Tendencies: free throws drawn (drivers and post scorers get to the line) and plays used (shots, trips to the line, turnovers).
        dr = clip(25 + 6 * (p36('fta') * w + 3.3 * (1 - w)))
        us = clip(25 + 2.96 * ((p36('fga') + .44 * p36('fta') + p36('tov')) * w + 15 * (1 - w) - 5))
        RAT[(s, y)] = [int(round(ovr)), sc, sh, pm, rb, df, stm, blkshare] + ext + [dr, us]
def rating(slug, y):
    for d in (0, -1, 1, -2, 2):
        r = RAT.get((slug, y + d))
        if r:
            r = list(r); pen = abs(d) * 2
            r[0] = max(45, r[0] - pen); return r
    return None
def peak_after(slug, y): return max([RAT[(slug, k)][0] for k in range(y, y + 9) if (slug, k) in RAT] or [0])
def pot_for(slug, y, ovr, age, pick=None):
    est = min(96, ovr + max(0, 26 - age) * 1.9)
    if pick: est = max(est, 90 - 0.42 * pick)
    pk = peak_after(slug, y); known = sum(1 for k in range(y + 1, y + 9) if (slug, k) in RAT)
    wk = min(1, known / 5) * 0.8
    return int(round(max(ovr, wk * pk + (1 - wk) * est))) if age <= 27 else ovr
FR = {'WSB': 'WAS', 'NJN': 'BRK', 'SEA': 'OKC', 'VAN': 'MEM', 'CHH': 'NOP', 'NOH': 'NOP', 'NOK': 'NOP', 'CHA': 'CHO'}
def prior(slug, y):
    t = [0, 0, 0, 0]
    for r in S.get(slug, []):
        if r['season'] < y and not r.get('playoffs'):
            t[0] += r.get('gp') or 0; t[1] += r.get('pts') or 0; t[2] += (r.get('orb') or 0) + (r.get('drb') or 0); t[3] += r.get('ast') or 0
    return t
players = []; pidx = {}
def pid(slug, name, born, pos, hgt, dy, dp):
    if slug not in pidx:
        pidx[slug] = len(players); players.append([name, born, pos or 'F', hgt or 78, dy or 0, dp or 0])
    return pidx[slug]
out = {'lg': LG, 'seasons': {}, 'classes': {}}
for y in SEASONS:
    f = json.load(open(os.path.join(SRC, f'gen-{y}.json')))
    poss = collections.Counter(); tgp = collections.Counter()
    for sl, rs in S.items():
        for r in rs:
            if r['season'] != y or r.get('playoffs') or r.get('abbrev') in (None, 'TOT'): continue
            poss[r['abbrev']] += (r.get('fga') or 0) + .44 * (r.get('fta') or 0) - (r.get('orb') or 0) + (r.get('tov') or 0); tgp[r['abbrev']] = max(tgp[r['abbrev']], r.get('gp') or 0)
    ppg = {k: poss[k] / tgp[k] for k in poss if tgp[k] >= 20}; lgp = sum(ppg.values()) / max(1, len(ppg))
    pace_of = lambda ab: int(round(1000 * ppg.get(ab, lgp) / lgp))
    teams = [[t['abbrev'], t['region'], t['name'], t['colors'][0], t['colors'][1], t['cid'], t['did'], t.get('pop', 3), FR.get(t.get('srID'), t.get('srID') or t['abbrev']), pace_of(t['abbrev'])] for t in sorted(f['teams'], key=lambda t: t['tid'])]
    rows = []; cls = []; miss = 0
    for p in f['players']:
        s = p.get('srID'); b = bios.get(s, {})
        if not s: continue
        born = p['born']['year']; i = None
        if p['tid'] >= -1:
            r = rating(s, y)
            if p['tid'] == -1 and (not r or r[0] < 58): continue
            if not r: miss += 1; r = [50, 45, 35, 40, 45, 50, 40, 30, 55, 48, 66, 62, 42, 48, 35, 55, 44, 50]
            i = pid(s, p['name'], born, p['pos'], p['hgt'], p['draft'].get('year'), p['draft'].get('pick') if p['draft'].get('round') in (1, 2) else 0)
            pick = p['draft'].get('pick') + (p['draft'].get('round', 1) - 1) * len(teams) if p['draft'].get('round') in (1, 2) and y - (p['draft'].get('year') or 0) <= 2 else None
            rows.append([i, p['tid']] + [r[0], pot_for(s, y, r[0], y - born, pick)] + r[1:8] + prior(s, y) + r[8:16] + r[16:18])
        elif p['tid'] == -2 and p['draft'].get('year') == y:
            fs = min([k for (sl, k) in RAT if sl == s and k > y] or [0])
            rd = b.get('draftRound') or p['draft'].get('round'); pk = b.get('draftPick') or p['draft'].get('pick') or 0; slot = pk + (rd - 1) * len(teams) if rd in (1, 2) and pk else 70
            if fs:
                r = list(RAT[(s, fs)]); r[0] = max(45, r[0] - 2 * (fs - y - 1))
            else:
                o = int(round(max(48, 73 - 0.33 * slot))); r = [o, clip(o - 8), 45, 42, 46, 52, 45, 35, 55, 50, 68, 62, 42, 48, 38, 55, 46, clip(o - 12)]
            i = pid(s, p['name'], born, p['pos'], p['hgt'], y, pk if rd in (1, 2) else 0)
            cls.append([i, slot, r[0], pot_for(s, fs or y + 1, r[0], y + 1 - born, slot if slot < 61 else None)] + r[1:])
    out['seasons'][y] = {'teams': teams, 'rows': rows}; out['classes'][y] = sorted(cls, key=lambda c: c[1])
    print(y, 'teams', len(teams), 'players', len(rows), 'no-stats', miss, 'class', len(cls), 'lg', LG[y])
out['players'] = players
recs = [{'k': 'lg', 'v': LG}, {'k': 'players', 'v': players}] + [{'k': f's{y}', 'v': out['seasons'][y]} for y in SEASONS] + [{'k': f'c{y}', 'v': out['classes'][y]} for y in SEASONS]
with open(os.path.join(ROOT, 'data.json'), 'w') as fh:
    fh.write('[\n' + ',\n'.join(json.dumps(r, separators=(',', ':'), ensure_ascii=False) for r in recs) + '\n]\n')
import os; print('bytes', os.path.getsize(os.path.join(ROOT, 'data.json')), 'players', len(players))
# Real season-by-season lines for every player (shown on player pages for seasons before the league starts).
inv = {i: sl for sl, i in pidx.items()}; hist = []
for i in range(len(players)):
    sl = inv[i]; by = collections.defaultdict(lambda: collections.Counter()); tm = collections.defaultdict(lambda: ['', -1])
    for r in S.get(sl, []):
        if r.get('playoffs'): continue
        c = by[r['season']]
        for k in ('gp', 'min', 'pts', 'orb', 'drb', 'ast', 'tp', 'fg', 'fga', 'tpa'): c[k] += r.get(k) or 0
        if (r.get('min') or 0) > tm[r['season']][1]: tm[r['season']] = [r.get('abbrev') or '', r.get('min') or 0]
    hist.append([[y, tm[y][0], (RAT.get((sl, y)) or [0])[0], c['gp'], int(round(c['min'])), c['pts'], c['orb'] + c['drb'], c['ast'], c['tp'], c['fg'], c['fga'], c['tpa']] for y, c in sorted(by.items()) if c['gp'] > 0])
with open(os.path.join(ROOT, 'hist.json'), 'w') as fh:
    fh.write('[\n' + ',\n'.join(json.dumps(r, separators=(',', ':')) for r in hist) + '\n]\n')
print('hist bytes', os.path.getsize(os.path.join(ROOT, 'hist.json')), 'rows', sum(len(h) for h in hist))
i = pidx['jordami01']; print(players[i][0], hist[i][:2], hist[i][-1])
for y in (1996, 2026):
    rows = sorted(out['seasons'][y]['rows'], key=lambda r: -r[2])[:12]
    print(y, [(players[r[0]][0], r[2], r[3], r[4:]) for r in rows[:8]])
    o = [r[2] for r in out['seasons'][y]['rows']]; print('  ovr pct', np.percentile(o, [5, 25, 50, 75, 95]).round(0), 'class top', [(players[c[0]][0], c[2], c[3]) for c in out['classes'][y][:5]])
