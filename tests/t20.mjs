import puppeteer from "puppeteer";
const [mode = "new", season = "2010", n = "8"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 900));
const out = await page.evaluate((mode, season, n) => {
  const HG = window.HG, res = []; HG.newGame(season, 4);
  for (let k = 0; k < n; k++) {
    HG.playDays(999); const G = HG.G, w = G.teams.map((t) => t.w), m = w.reduce((a, b) => a + b) / w.length, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / w.length);
    HG.playPlayoffs("all"); HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign();
    const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1;
    if (mode === "new") { HG.faAdvance(29); HG.fillMine(); HG.faAdvance(30); } else { HG.fillMine(); HG.startSeason(); }
    const pays = HG.G.teams.map((t) => HG.G.players.filter((p) => p.tid === t.tid).reduce((a, p) => a + p.sal, 0)).sort((a, b) => a - b), tops = HG.G.teams.map((t) => HG.G.players.filter((p) => p.tid === t.tid).sort((a, b) => b.ovr - a.ovr).slice(0, 3).reduce((a, p) => a + p.ovr, 0) / 3).sort((a, b) => a - b);
    res.push(`${G.season - 1}: best ${Math.max(...w)} worst ${Math.min(...w)} sd ${sd.toFixed(1)} | next payroll min ${pays[0].toFixed(0)} med ${pays[15].toFixed(0)} max ${pays[pays.length - 1].toFixed(0)} | top-3 ovr spread ${tops[0].toFixed(0)}-${tops[tops.length - 1].toFixed(0)} | FA left ${HG.G.players.filter((p) => p.tid === -1).length} | phase ${HG.G.phase}`);
  }
  return res;
}, mode, +season, +n);
console.log(out.join("\n")); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
