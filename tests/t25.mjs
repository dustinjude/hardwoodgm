import puppeteer from "puppeteer";
const [port = "3400", season = "2005", n = "6"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 900));
const out = await page.evaluate((season, n) => {
	const HG = window.HG; HG.newGame(season, 4); const ch = [], lg = [];
	const snap = () => new Map(HG.G.players.filter((p) => p.tid >= -1).map((p) => [p.id, [p.ovr, HG.G.season - p.born]]));
	for (let k = 0; k < n; k++) {
		HG.playDays(999); const base = snap(); HG.playPlayoffs("all"); const a0 = snap(), t0 = HG.G.phase; HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign();
		const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; HG.fillMine();
		const mid = snap(); HG.faAdvance(30); const G = HG.G;
		// ratings must not move between the end of the playoffs and the start of the season, except at the start itself
		let movedEarly = 0; for (const [id, v] of a0) { const m = mid.get(id); if (m && m[0] !== v[0]) movedEarly++; }
		for (const p of G.players) { const b = base.get(p.id); if (!b || p.tid < 0) continue; ch.push([b[1], p.ovr - b[0]]); }
		const ro = G.players.filter((p) => p.tid >= 0).map((p) => p.ovr).sort((a, b) => b - a);
		lg.push(`${G.season}: phase ${G.phase}, moved before start ${movedEarly}, report s${G.prog && G.prog.s} | league ovr #1 ${ro[0]} #10 ${ro[9]} #50 ${ro[49]} #150 ${ro[149]} median ${ro[Math.floor(ro.length / 2)]}`);
	}
	const b = (lo, hi) => { const v = ch.filter((x) => x[0] >= lo && x[0] <= hi).map((x) => x[1]); const m = v.reduce((a, c) => a + c, 0) / v.length, sd = Math.sqrt(v.reduce((a, c) => a + (c - m) ** 2, 0) / v.length); return `${lo}-${hi}: avg ${m.toFixed(1)} sd ${sd.toFixed(1)} (n ${v.length})`; };
	const all = ch.map((x) => x[1]), big = all.filter((x) => Math.abs(x) >= 5).length / all.length, none = all.filter((x) => x === 0).length / all.length, sdAll = Math.sqrt(all.reduce((a, c) => a + c * c, 0) / all.length);
	return [...lg, b(19, 22), b(23, 25), b(26, 28), b(29, 31), b(32, 34), b(35, 45), `all: rms ${sdAll.toFixed(1)}, |change| >= 5: ${(big * 100).toFixed(0)}%, no change: ${(none * 100).toFixed(0)}%, max +${Math.max(...all)}, min ${Math.min(...all)}`];
}, +season, +n);
console.log(out.join("\n")); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
