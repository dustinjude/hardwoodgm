import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(120); return ok; };
const txt = (sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").slice(0, 260) : null; }, sel);
const r1 = await page.evaluate(() => { const HG = window.HG; HG.newGame(1996, HG.DATA.s1996.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(20); const G = HG.G; return { dist: G.dist.map((d) => (d ? d.length : 0)).join(","), hist: !!window.HG.HIST }; });
console.log("new game", JSON.stringify(r1));
// live game with box score
await page.evaluate(() => window.HG.watchNext(false)); await sleep(700);
console.log("live buttons", await page.evaluate(() => [...document.querySelectorAll(".sheet button")].map((b) => b.innerText).join(" | ")));
await tap('[data-a="livebox"]'); await sleep(900);
console.log("live box", await txt("#lvbox")); await page.screenshot({ path: "tests/shots/t7-livebox.png" });
const sums = await page.evaluate(() => { const L = window.HG.UI.live, e = L.ev[L.ev.length - 1]; return { final: e.s, box: e.bx.map((t) => t.reduce((a, r) => a + r[2], 0)), on: e.bx.map((t) => t.filter((r) => r[0]).length), names: L.names.map((n) => n.length), rows: e.bx.map((t) => t.length) }; });
console.log("box sums vs score", JSON.stringify(sums));
await tap('[data-a="livebox"]'); await tap('[data-a="liveskip"]'); await sleep(300); console.log("after skip", await txt("#lvscore"));
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.render(); });
// ratings table, team stats, news filters
await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "league"; HG.UI.league = "leaders"; HG.render(); });
await tap('[data-a="pmode"][data-k="rat"]'); console.log("ratings", await txt("main table")); await tap('[data-a="rsort"][data-k="5"]'); console.log("sorted 3pt", await txt("main table tr:nth-child(2)"));
await page.screenshot({ path: "tests/shots/t7-ratings.png" });
await tap('[data-a="pfilter"][data-k="fa"]'); console.log("fa ratings", await txt("main table tr:nth-child(2)")); await tap('[data-a="pmode"][data-k="stat"]'); console.log("stats mode", await txt("main table tr:nth-child(2)"));
await page.evaluate(() => { const HG = window.HG; HG.UI.league = "teams"; HG.render(); }); console.log("team stats", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].pop(); return s.innerText.replace(/\s+/g, " ").slice(0, 220); }));
await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "home"; HG.render(); });
for (const k of ["trade", "sign", "inj", "big", ""]) { await tap(`[data-a="nfilter"][data-k="${k}"]`); console.log("news", k || "all", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /News/.test(x.querySelector("h2")?.innerText || "")); return s ? s.querySelectorAll(".list > div").length + " · " + (s.querySelector(".list > div")?.innerText || "").slice(0, 90) : null; })); }
// real past seasons on a player page
const pid = await page.evaluate(() => window.HG.G.players.find((p) => p.n === "Hakeem Olajuwon").id);
await page.evaluate((id) => { const HG = window.HG; HG.UI.sheet = { k: "player", id }; HG.render(); }, pid); await sleep(200);
console.log("career rows", await page.evaluate(() => { const t = [...document.querySelectorAll(".sheet table")].pop(); return t ? t.rows.length + " · " + [...t.rows].slice(0, 4).map((r) => r.innerText.replace(/\s+/g, " ")).join(" / ") : null; }));
await page.screenshot({ path: "tests/shots/t7-player.png" });
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.render(); });
// playoffs bracket
const po = await page.evaluate(() => { const HG = window.HG; HG.playDays(999); HG.playPlayoffs("round"); HG.UI.tab = "league"; HG.UI.league = "playoffs"; HG.UI.sheet = null; HG.render(); const G = HG.G; return { phase: G.phase, round: G.po && G.po.round, done: (G.po.done || []).length }; });
console.log("playoffs mid", JSON.stringify(po), await page.evaluate(() => [...document.querySelectorAll("main section")].map((s) => s.querySelector("h2")?.innerText + ":" + s.querySelectorAll(".list > div").length).join(" | ")));
await page.screenshot({ path: "tests/shots/t7-bracket.png" });
const po2 = await page.evaluate(() => { const HG = window.HG; if (HG.G.phase === "playoffs") HG.playPlayoffs("all"); HG.UI.tab = "league"; HG.UI.league = "playoffs"; HG.UI.sheet = null; HG.render(); const G = HG.G; return { phase: G.phase, done: (G.po.done || []).map((x) => x.r).join(""), champ: G.history[G.history.length - 1] }; });
console.log("playoffs end", JSON.stringify(po2).slice(0, 300), await page.evaluate(() => [...document.querySelectorAll("main section")].map((s) => s.querySelector("h2")?.innerText + ":" + s.querySelectorAll(".list > div").length).join(" | ")));
await page.screenshot({ path: "tests/shots/t7-bracket2.png", fullPage: true });
// commissioner: edit and switch
await page.evaluate(() => { const HG = window.HG; HG.G.god = true; HG.UI.tab = "more"; HG.render(); });
const setv = async (sel, v) => { await page.evaluate((sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); }, sel, v); await sleep(120); };
await setv("#te-region", "Winter Park"); await setv("#te-name", "Charriers"); await setv("#te-ab", "wpk"); await setv("#te-c1", "#0a7d5a"); await setv("#te-ab", "toolong1");
console.log("edited", await page.evaluate(() => { const G = window.HG.G, t = G.teams[G.userTid]; return [t.region, t.name, t.ab, t.c1, t.custom, getComputedStyle(document.documentElement).getPropertyValue("--accent")].join(" · "); }));
await page.screenshot({ path: "tests/shots/t7-office.png", fullPage: true });
const other = await page.evaluate(() => window.HG.G.teams.find((t) => t.ab === "CHI").tid); await setv("#switchteam", String(other));
console.log("switched", await page.evaluate(() => { const G = window.HG.G; return G.teams[G.userTid].ab + " " + G.phase + " " + G.news[0].t; }));
// carry on through the offseason and a new season to be sure nothing broke, and that the edited name survives the timeline
const r9 = await page.evaluate(() => { const HG = window.HG; if (HG.G.phase === "draft") HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; const fas = g.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); while (mine.length < 13) { const p = fas.shift(); p.tid = g.userTid; p.sal = 1; p.exp = g.season + 1; delete p.ask; mine.push(p); } HG.startSeason(); HG.playDays(999); const o = HG.G.teams.find((t) => t.custom); return { season: HG.G.season, phase: HG.G.phase, custom: o.region + " " + o.name + " " + o.ab, po: !!HG.G.po, done: (HG.G.po && HG.G.po.done || []).length }; });
console.log("next season", JSON.stringify(r9));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
