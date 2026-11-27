import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(120); return ok; };
const main = (n = 300) => page.evaluate((n) => document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, n), n);
const sec = (re, n = 330) => page.evaluate((re, n) => { const s = [...document.querySelectorAll("main section")].find((x) => new RegExp(re, "i").test(x.querySelector("h2")?.innerText || "")); return s ? s.innerText.replace(/\s+/g, " ").slice(0, n) : null; }, re, n);
// before the deadline
let r = await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(50); const G = HG.G; HG.UI.tab = "moves"; HG.UI.moves = "trade"; HG.render(); return { day: G.day, days: G.sched.length, dl: Math.floor(G.sched.length * .7) }; });
console.log("pre", JSON.stringify(r), "|", (await main(160)));
r = await page.evaluate(() => { const HG = window.HG; HG.playDays(12); HG.UI.tab = "moves"; HG.UI.moves = "trade"; HG.render(); const G = HG.G; return { day: G.day, offers: G.offers.length, news: G.news.filter((n) => /deadline|All-Star|contest/.test(n.t)).map((n) => n.t.slice(0, 150)), as: G.as && [G.as.three, G.as.dunk] }; });
console.log("post", JSON.stringify(r)); console.log("trade tab:", (await main(400)).split("Trade")[2] || await main(400));
console.log("check:", await page.evaluate(() => { const HG = window.HG; const o = HG.buildOffer(HG.G.teams.find((t) => t.tid !== HG.G.userTid).tid); return JSON.stringify(HG.tradeCheck()) + " offer:" + JSON.stringify(o); }));
await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "league"; HG.UI.league = "teams"; HG.render(); }); console.log("injuries:", await sec("injury", 260));
await page.evaluate(() => { const HG = window.HG; HG.UI.league = "awards"; HG.render(); }); console.log("all-stars:", (await sec("all-stars", 900) || "").slice(-170));
await page.evaluate(() => { const HG = window.HG; HG.UI.league = "leaders"; HG.UI.pmode = "stat"; HG.render(); }); console.log("stats head:", await page.evaluate(() => [...document.querySelectorAll("main table tr")].slice(0, 2).map((r) => r.innerText.replace(/\s+/g, " ")).join(" / ")));
await tap('[data-a="psort"][data-k="14"]'); console.log("by Eff:", await page.evaluate(() => [...document.querySelectorAll("main table tr")].slice(1, 4).map((r) => r.innerText.replace(/\s+/g, " ").slice(0, 34) + " … " + r.innerText.replace(/\s+/g, " ").split(" ").slice(-2).join(" ")).join(" / ")));
// commissioner mode reopens trading
console.log("god:", await page.evaluate(() => { const HG = window.HG; HG.G.god = true; const m = HG.tradeCheck().msg; HG.G.god = false; return m; }));
// player page chart
const id = await page.evaluate(() => window.HG.G.players.find((p) => p.n === "Tracy McGrady").id);
await page.evaluate((id) => { const HG = window.HG; HG.UI.tab = "roster"; HG.UI.sheet = { k: "player", id }; HG.render(); const sh = document.querySelector(".sheet"); const svg = sh.querySelector("svg"); if (svg) svg.scrollIntoView({ block: "center" }); }, id); await sleep(300);
console.log("chart:", await page.evaluate(() => { const svg = document.querySelector(".sheet svg"); return svg ? svg.getAttribute("aria-label") : null; })); await page.screenshot({ path: "tests/shots/t9-chart.png" });
// draft lottery
r = await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.playDays(999); HG.playPlayoffs("all"); const G = HG.G; HG.render(); return { phase: G.phase, lot: G.draft.lot, first: G.draft.order.slice(0, 5).map((t) => G.teams[t].ab), news: G.news.filter((n) => /lottery|Draft order/.test(n.t)).map((n) => n.t) }; });
console.log("draft", JSON.stringify(r)); console.log("lottery:", await sec("lottery", 420));
await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /lottery/i.test(x.querySelector("h2")?.innerText || "")); if (s) s.scrollIntoView(); }); await sleep(200); await page.screenshot({ path: "tests/shots/t9-lottery.png" });
// trading open again in the offseason, and next season runs
r = await page.evaluate(() => { const HG = window.HG; const open = HG.tradeCheck().msg; HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; const fas = g.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); while (mine.length < 13) { const p = fas.shift(); p.tid = g.userTid; p.sal = 1; p.exp = g.season + 1; delete p.ask; mine.push(p); } HG.startSeason(); HG.playDays(30); return { open, season: HG.G.season, day: HG.G.day, trades: HG.G.news.filter((n) => /^Trade: the/.test(n.t)).length }; });
console.log("next", JSON.stringify(r)); console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
