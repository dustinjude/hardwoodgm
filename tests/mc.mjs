import puppeteer from "puppeteer";
const [season = "2024", N = "600"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.evaluateOnNewDocument((o) => { window.MCONLY = o; }, process.env.ONLY || ""); await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 900));
const out = await page.evaluate((season, N) => {
  const HG = window.HG; HG.newGame(season, 0); const G = HG.G, ctx = HG.dayCtx(), nT = G.teams.length;
  // strategies: a function run before every minute on the user's team record t (and the game g)
  const S = {
    sim: null, coachDefault: () => {}, plain: (t) => { t.c.off = "bal"; t.c.def = "norm"; }, threes: (t) => { t.c.off = "three"; }, inside: (t) => { t.c.off = "in"; }, star: (t) => { t.c.off = "star"; t.c.star = t.pl.reduce((m, x) => (x.p.ovr > t.pl[m].p.ovr ? x.k : m), 0); },
    press: (t) => { t.c.def = "press"; }, pack: (t) => { t.c.def = "pack"; }, slow: (t) => { t.c.pace = -1; }, fast: (t) => { t.c.pace = 1; },
    ironman: (t) => { if (t.c.auto) { t.c.auto = false; t.lock = t.pl.slice().sort((x, y) => y.p.ovr - x.p.ovr).slice(0, 5); } },
    hack: (t) => { t.c.def = "foul"; },
    lateFoul: (t, g, o) => { t.c.def = g.lateLeft() <= 2 && g.slice >= 46 && o.pts - t.pts >= 3 && o.pts - t.pts <= 10 ? "foul" : "norm"; },
    timeouts: (t, g, o) => { if (o.run >= 8 && t.to > 0) g.timeout(t.i); },
  };
  const res = {}; const only = (window.MCONLY || "").split(",").filter(Boolean);
  const pairs = []; for (let i = 0; i < N; i++) { const h = i % nT, a = (h + 1 + (i * 7) % (nT - 1)) % nT; pairs.push([h, a === h ? (h + 1) % nT : a]); }
  for (const [name, f] of Object.entries(S)) { if (only.length && !only.includes(name)) continue;
    let w = 0, mg = 0, pts = 0;
    const per = {};
    for (const [h, a] of pairs) {
      // copy stats so finish() does not pile them up: run without finish
      let us, them;
      if (!f) { const g = HG.makeGame(h, a, ctx, -1, {}); while (!g.done()) g.step(); us = g.T[0].pts; them = g.T[1].pts; }
      else { const g = HG.makeGame(h, a, ctx, 0, { coach: true }); const t = g.T[0], o = g.T[1]; while (!g.done()) { f(t, g, o); g.step(); } us = t.pts; them = o.pts; }
      if (us > them) w++; mg += us - them; pts += us + them;
      per[h] = (per[h] || 0) + us - them; (res.opp = res.opp || {})[name] = res.opp[name] || {}; res.opp[name][a] = (res.opp[name][a] || 0) + us - them;
    }
    res[name] = { opp: (res.opp || {})[name], win: +(w / N * 100).toFixed(1), margin: +(mg / N).toFixed(2), ppg: +(pts / N / 2).toFixed(1), per };
  }
  // what do the scouting ranks say about each team? (three-point quality, inside, rim, ball security, worst FT)
  const rows = ctx.rots.map((rt, tid) => { let s3 = 0, a3 = 0, sec = 0, rim = 0, wft = 1; for (const x of rt) { s3 += x.m * x.f.w3; a3 += x.m * x.f.w3 * x.f.p3; sec += x.m * x.f.wt; rim += x.m * x.f.wb; } for (const x of rt.slice(0, 8)) wft = Math.min(wft, x.f.pf); return { tid, p3: a3 / s3, sec, rim, wft }; });
  return { res, rows };
}, +season, +N);
const base = out.res.coachDefault.margin;
const cor = (k, key, side) => { const r0 = out.res[k], d0 = out.res.coachDefault, src = side === 'opp' ? 'opp' : 'per'; const xs = out.rows.map((r) => r[key]), ys = out.rows.map((r) => (r0[src][r.tid] - d0[src][r.tid])); const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length; let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; }); const sorted = out.rows.map((r, i) => [xs[i], ys[i]]).sort((a, b) => a[0] - b[0]), n = sorted.length, third = Math.floor(n / 3), avg = (a) => (a.reduce((s, x) => s + x[1], 0) / a.length / (N / n)).toFixed(2); return `corr ${(sxy / Math.sqrt(sxx * syy)).toFixed(2)}, gain per game: low third ${avg(sorted.slice(0, third))}, high third ${avg(sorted.slice(n - third))}`; };
for (const [k, v] of Object.entries(out.res)) console.log(k.padEnd(13), "win", v.win, "margin", v.margin, "Δ vs default", (v.margin - base).toFixed(2), "ppg", v.ppg);
// threes effect vs own shooting quality
const corr = (k, key) => { const xs = out.rows.map((r) => r[key]), ys = out.rows.map((r) => (out.res[k].per[r.tid] - out.res.coachDefault.per[r.tid])); const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length; let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; }); return (sxy / Math.sqrt(sxx * syy)).toFixed(2); };

if (out.res.threes) console.log('threes vs own 3pt quality:', cor('threes', 'p3', 'per'));
if (out.res.pack) console.log('pack vs their 3pt quality:', cor('pack', 'p3', 'opp'));
if (out.res.press) console.log('press vs their turnover proneness:', cor('press', 'sec', 'opp'));
if (out.res.inside) console.log('inside vs their rim protection:', cor('inside', 'rim', 'opp'));
console.log("ERRORS", JSON.stringify(errors)); await browser.close();
