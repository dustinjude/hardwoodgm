import puppeteer from "puppeteer";
const [season = "1996", nSeasons = "3", shot = ""] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:" + (process.env.PORT || 3400) + "/index.html", { waitUntil: "networkidle2" }); await sleep(800);
if (shot) await page.screenshot({ path: `tests/shots/${shot}-start.png` });
const out = await page.evaluate((season, nSeasons) => {
  const HG = window.HG, res = []; HG.UI.season = season; const snap = HG.DATA["s" + season]; HG.newGame(season, snap.teams.findIndex((t) => t[0] === "CHI"));
  for (let k = 0; k < nSeasons; k++) {
    const G = HG.G; HG.playDays(999);
    const wins = G.teams.map((t) => t.w * 82 / (t.w + t.l)), mean = wins.reduce((a, b) => a + b, 0) / wins.length, sd = Math.sqrt(wins.reduce((a, b) => a + (b - mean) ** 2, 0) / wins.length);
    const ps = G.players.filter((p) => p.tid >= 0 && p.s[0] >= 50), top = (i) => ps.slice().sort((a, b) => b.s[i] / b.s[0] - a.s[i] / a.s[0]).slice(0, 10);
    const avg10 = (i) => +(top(i).reduce((s, p) => s + p.s[i] / p.s[0], 0) / 10).toFixed(1);
    const nets = G.teams.map((t) => HG.teamRating(t.tid));
    res.push({ season: G.season, sd: +sd.toFixed(1), best: Math.round(Math.max(...wins)), worst: Math.round(Math.min(...wins)), chi: G.teams[G.userTid].w, bestT: G.teams.slice().sort((a, b) => b.w - a.w)[0].ab, ppg: +(G.teams.reduce((s, t) => s + t.pf, 0) / G.teams.reduce((s, t) => s + t.w + t.l, 0)).toFixed(1), top10: { pts: avg10(2), reb: avg10(3), ast: avg10(4), stl: avg10(5), blk: avg10(6), tp: avg10(7), min: avg10(1) }, leaders: top(2).slice(0, 4).map((p) => `${p.n} ${(p.s[2] / p.s[0]).toFixed(1)} (${(p.s[1] / p.s[0]).toFixed(0)}m)`), ovrTop: G.players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3).map((p) => p.n + " " + p.ovr), lgs: (() => { const t = Array(17).fill(0); for (const p of G.players) if (p.tid >= 0) p.s.forEach((v, i) => { t[i] += v; }); const g = G.teams.reduce((s, x) => s + x.w + x.l, 0), per = (i) => +(t[i] / g).toFixed(1); return { fg: +(100 * t[8] / t[9]).toFixed(1), tp: +(100 * t[7] / t[10]).toFixed(1), ft: +(100 * t[11] / t[12]).toFixed(1), fga: per(9), tpm: per(7), fta: per(12), reb: per(3), orb: per(13), ast: per(4), stl: per(5), blk: per(6), tov: per(14), pf: per(15) }; })(), diff: +Math.max(...G.teams.map((t) => (t.pf - t.pa) / (t.w + t.l))).toFixed(1), nt: G.teams.length, news: G.news.filter((n) => /Expansion|moving|will be called|expansion draft/.test(n.t)).map((n) => n.t.slice(0, 70)).slice(0, 3), n90: G.players.filter((p) => p.tid >= 0 && p.ovr >= 90).length, age: +(G.players.filter((p) => p.tid >= 0).reduce((s, p) => s + (G.season - p.born) * p.s[1], 0) / G.players.reduce((s, p) => s + (p.tid >= 0 ? p.s[1] : 0), 0)).toFixed(1), n: G.players.length, fa: G.players.filter((p) => p.tid === -1).length, pay: Math.round(G.teams.reduce((s, t) => s + G.players.filter((p) => p.tid === t.tid).reduce((a, p) => a + p.sal, 0), 0) / G.teams.length) });
    HG.playPlayoffs("all"); res[res.length - 1].hist = JSON.stringify(G.history[0]); res[res.length - 1].cls = G.players.filter((p) => p.tid === -2).length;
    HG.simDraft(false); for (const id of G.resign.slice()) { const p = G.players.find((x) => x.id === id); if (p && p.ask != null) { p.sal = p.ask; p.exp = G.season + p.askY; delete p.ask; delete p.askY; } } HG.finishResign();
    let mine = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1;
    const fas = G.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); while (mine.length < 13 && fas.length) { const p = fas.shift(); p.tid = G.userTid; p.sal = 1; p.exp = G.season + 1; delete p.ask; mine.push(p); }
    HG.startSeason(); res[res.length - 1].phase = HG.G.phase; res[res.length - 1].sizes = [Math.min(...G.teams.map((t) => G.players.filter((p) => p.tid === t.tid).length)), Math.max(...G.teams.map((t) => G.players.filter((p) => p.tid === t.tid).length))];
  }
  return res;
}, +season, +nSeasons);
for (const r of out) console.log(JSON.stringify(r));
if (shot) { await page.evaluate(() => { window.HG.playDays(23); }); await new Promise((r) => setTimeout(r, 3400)); for (const tab of ["home", "roster", "league", "moves"]) { await page.evaluate((t) => { window.HG.UI.tab = t; window.HG.render(); }, tab); await sleep(200); await page.screenshot({ path: `tests/shots/${shot}-${tab}.png` }); } }
console.log("ERRORS", JSON.stringify(errors.slice(0, 5)), "save bytes", await page.evaluate(() => (localStorage.getItem("hardwoodgm1") || "").length));
await browser.close();
