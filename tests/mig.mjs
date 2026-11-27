import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];
const open = async (url) => { const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); }); await page.goto(url, { waitUntil: "networkidle2" }); await sleep(400); return page; };
const old = await open(`http://127.0.0.1:${process.argv[2] || 3401}/index.html`);
const saves = await old.evaluate(() => { const HG = window.HG, out = []; HG.newGame(2004, HG.DATA.s2004.teams.findIndex((t) => t[0] === "CHI")); HG.playDays(40); out.push(localStorage.getItem("hardwoodgm1")); HG.playDays(999); HG.playPlayoffs("all"); out.push(localStorage.getItem("hardwoodgm1")); HG.simDraft(false); out.push(localStorage.getItem("hardwoodgm1")); return out; });
for (const [i, sv] of saves.entries()) {
  const page = await open("http://127.0.0.1:3400/index.html");
  await page.evaluate((sv) => localStorage.setItem("hardwoodgm1", sv), sv); await page.reload({ waitUntil: "networkidle2" }); await sleep(400);
  const r = await page.evaluate(() => { const HG = window.HG, G = HG.G, mj = G.players.find((p) => p.n === "Kobe Bryant"); const info = { phase: G.phase, season: G.season, picks: G.picks.length, prospects: G.players.filter((p) => p.tid === -2).length, mj: mj && [mj.c, mj.s.length], hof: G.hof.length, fin: [G.fin.cash, G.teams[G.userTid].pop] };
    for (const t of ["home", "roster", "league", "moves", "more"]) { HG.UI.tab = t; for (const l of ["standings", "leaders", "playoffs", "history"]) { HG.UI.league = l; for (const m of ["fa", "trade", "draft", "resign"]) { HG.UI.moves = m; HG.render(); } } }
    if (G.phase === "regular") HG.playDays(999); if (G.phase === "playoffs") HG.playPlayoffs("all"); if (HG.G.phase === "draft") HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign();
    const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; const fas = g.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); while (mine.length < 13) { const p = fas.shift(); p.tid = g.userTid; p.sal = 1; p.exp = g.season + 1; delete p.ask; mine.push(p); }
    HG.startSeason(); HG.playDays(30); info.after = `${HG.G.season} ${HG.G.phase} day ${HG.G.day} picks ${HG.G.picks.length} prospects ${HG.G.players.filter((p) => p.tid === -2).length}`; info.teams = HG.G.teams.length + ' ' + HG.G.teams.map((t) => t.ab).slice(-2).join(','); info.trades = HG.G.news.filter((n) => /^Trade: the/.test(n.t)).length; return info; });
  console.log("save", i, JSON.stringify(r)); await page.close();
}
console.log("ERRORS", JSON.stringify(errors.slice(0, 6))); await browser.close();
