import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [season = "2010", n = "8"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const out = await page.evaluate((season, n) => { const HG = window.HG, res = []; HG.newGame(season, HG.DATA["s" + season].teams.findIndex((t) => t[0] === "CHA" || t[0] === "CHH" || t[0] === "CHO"));
  for (let k = 0; k < n; k++) { HG.playDays(999); const G = HG.G, ts = G.teams.slice().sort((a, b) => b.w - a.w), info = (t) => { const ps = G.players.filter((p) => p.tid === t.tid).sort((a, b) => b.ovr - a.ovr); return `${t.ab} ${t.w}-${t.l} pay ${Math.round(ps.reduce((s, p) => s + p.sal, 0))} top ${ps.slice(0, 6).map((p) => p.ovr).join("/")} diff ${((t.pf - t.pa) / (t.w + t.l)).toFixed(1)}`; };
    const pays = G.teams.map((t) => G.players.filter((p) => p.tid === t.tid).reduce((s, p) => s + p.sal, 0)).sort((a, b) => b - a);
    res.push(`${G.season}: ${info(ts[0])} | ${info(ts[1])} | worst ${info(ts[ts.length - 1])} | payrolls max ${Math.round(pays[0])} med ${Math.round(pays[15])} min ${Math.round(pays[pays.length - 1])}`);
    HG.playPlayoffs("all"); HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; const fas = g.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); while (mine.length < 13) { const p = fas.shift(); p.tid = g.userTid; p.sal = 1; p.exp = g.season + 1; delete p.ask; mine.push(p); } HG.startSeason(); }
  return res; }, +season, +n);
console.log(out.join("\n")); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
