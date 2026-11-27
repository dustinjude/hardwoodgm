import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];
// make a save in free agency with the published version (development already happened after the playoffs)
const old = await browser.newPage(); old.on("pageerror", (e) => errors.push("OLD " + e.message.slice(0, 200)));
await old.goto("http://127.0.0.1:3420/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const dump = await old.evaluate(() => { localStorage.clear(); const HG = window.HG; HG.newGame(2003, 5); HG.playDays(999); HG.playPlayoffs("all"); HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); HG.save(true); const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return { o, phase: HG.G.phase, prog: HG.G.prog && HG.G.prog.s }; });
console.log("old save:", dump.phase, "report season", dump.prog);
const page = await browser.newPage(); page.on("pageerror", (e) => errors.push("NEW " + e.message.slice(0, 200)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await page.evaluate((o) => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, dump.o); await page.reload({ waitUntil: "networkidle2" }); await sleep(900);
const r = await page.evaluate(() => { const HG = window.HG, G = HG.G; const before = new Map(G.players.map((p) => [p.id, p.ovr])); const info = { phase: G.phase, devSkip: G.devSkip, devV: G.devV, progS: G.prog && G.prog.s }; const g = G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; HG.fillMine(); HG.faAdvance(30); let moved = 0; for (const p of HG.G.players) if (before.has(p.id) && before.get(p.id) !== p.ovr) moved++; info.afterStart = { season: HG.G.season, phase: HG.G.phase, moved, devSkip: HG.G.devSkip, progS: HG.G.prog && HG.G.prog.s };
	// the next offseason develops exactly once, at the start of the following season
	HG.playDays(999); HG.playPlayoffs("all"); const b2 = new Map(HG.G.players.map((p) => [p.id, p.ovr])); HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); mine = HG.G.players.filter((p) => p.tid === HG.G.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; HG.fillMine(); let early = 0; for (const p of HG.G.players) if (b2.has(p.id) && b2.get(p.id) !== p.ovr) early++; HG.faAdvance(30); let moved2 = 0; for (const p of HG.G.players) if (b2.has(p.id) && b2.get(p.id) !== p.ovr) moved2++; info.next = { season: HG.G.season, early, moved2, progS: HG.G.prog.s, rookiesSkipped: HG.G.prog.rows.filter((r) => { const p = HG.G.players.find((x) => x.id === r[0]); return p && p.dy === HG.G.season - 1; }).length };
	return info; });
console.log(JSON.stringify(r)); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
