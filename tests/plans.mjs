import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.goto(`http://127.0.0.1:3400/index.html`, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 800));
const out = await page.evaluate(() => {
  const HG = window.HG, res = {};
  for (const y of [1996, 2016, 2025]) { HG.UI.season = y; const snap = HG.DATA["s" + y]; HG.newGame(y, 0); const G = HG.G, ctx = HG.dayCtx(), c = {}; let n = 0;
    for (let d = 0; d < 30; d++) for (const [h, a] of G.sched[d]) for (const [x, o] of [[h, a], [a, h]]) { const p = HG.planFor(x, o, ctx); c["off:" + p.off] = (c["off:" + p.off] || 0) + 1; c["def:" + p.def] = (c["def:" + p.def] || 0) + 1; n++; }
    for (const k in c) c[k] = +(c[k] / n).toFixed(2); res[y] = c; }
  return res;
});
console.log(JSON.stringify(out)); await browser.close();
