import puppeteer from "puppeteer";
const [season = "2016", port = "3400"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 800));
const out = await page.evaluate((season) => {
  const HG = window.HG; HG.UI.season = +season; const snap = HG.DATA["s" + season]; HG.newGame(+season, snap.teams.findIndex((t) => t[0] === "CHI"));
  const G = HG.G; const plans = { off: {}, def: {}, n: 0 };
  HG.playDays(999);
  const ps = G.players.filter((p) => p.tid >= 0 && p.s[0] >= 40), g = (p, i) => p.s[i] / p.s[0];
  const fmt = (p) => `${p.n} ${g(p, 2).toFixed(1)}p ${g(p, 9).toFixed(1)}fga ${g(p, 12).toFixed(1)}fta ${g(p,10).toFixed(1)}3pa`;
  const fta = ps.slice().sort((a, b) => g(b, 12) - g(a, 12)).slice(0, 8).map(fmt);
  const pts = ps.slice().sort((a, b) => g(b, 2) - g(a, 2)).slice(0, 8).map(fmt);
  const tf = G.teams.map((t) => { const pl = G.players.filter((p) => p.tid === t.tid); let a = 0, f = 0; for (const p of pl) { a += p.s[12]; f += p.s[9]; } return [t.ab, +(a / f).toFixed(3)]; }).sort((a, b) => b[1] - a[1]);
  return { fta, pts, tfHi: tf.slice(0, 3), tfLo: tf.slice(-3) };
}, season);
console.log(JSON.stringify(out, null, 1)); await browser.close();
