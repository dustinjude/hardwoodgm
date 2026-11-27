import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 900));
const out = await page.evaluate(() => {
  const HG = window.HG; HG.newGame(1996, 0); const G = HG.G, ctx = HG.dayCtx(), orl = G.teams.findIndex((t) => t.ab === "ORL"), N = 3000;
  const shaq = ctx.rots[orl].find((x) => x.p.n === "Shaquille O'Neal");
  const res = {};
  for (const [name, f] of Object.entries({ none: null, hackShaq: (t, o) => { const w = o.on.reduce((m, y) => (y.pf < m.pf ? y : m), o.on[0]); t.c.def = w && w.pf < .55 ? "foul" : "norm"; } })) {
    let w = 0, mg = 0, fouls = 0, outs = 0, shaqMin = 0;
    for (let i = 0; i < N; i++) { const h = (i % (G.teams.length - 1)) + (i % (G.teams.length - 1) >= orl ? 1 : 0); const g = HG.makeGame(h, orl, ctx, 0, { coach: true }), t = g.T[0], o = g.T[1]; while (!g.done()) { if (f) f(t, o); g.step(); } if (t.pts > o.pts) w++; mg += t.pts - o.pts; fouls += t.pl.reduce((s, x) => s + x.L[13], 0); outs += t.pl.filter((x) => x.L[13] >= 6).length; shaqMin += o.pl.find((x) => x.p === shaq.p).min; }
    res[name] = { win: (w / N * 100).toFixed(1), margin: (mg / N).toFixed(2), fouls: (fouls / N).toFixed(1), foulOuts: (outs / N).toFixed(2), shaqMin: (shaqMin / N).toFixed(1) };
  }
  return { shaqFT: shaq.f.pf.toFixed(2), res };
});
console.log(JSON.stringify(out)); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
