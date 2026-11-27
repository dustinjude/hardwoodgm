// The other Claude features: the newsletter and the assistant GM on Home, a scouting report on a prospect's page, the
// agent on a free agent's page, and the other GM on the trade screen. The function is stubbed (no API key needed): each
// reply names its kind, so the test checks that every button sends the right kind and facts and shows what comes back.
import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
const sent = [];
await page.setRequestInterception(true);
page.on("request", (rq) => {
	if (!rq.url().endsWith("/api/claude")) return rq.continue();
	const b = JSON.parse(rq.postData()); sent.push(b);
	setTimeout(() => rq.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ text: `Stand-in ${b.kind} title\nShort heading\nA stand-in paragraph for ${b.kind}.` }) }), 300);
});
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(800);
await page.evaluate(() => { const HG = window.HG; HG.UI.season = 2016; HG.newGame(2016, HG.DATA.s2016.teams.findIndex((t) => t[0] === "HOU")); HG.playDays(10); HG.UI.tab = "home"; HG.render(); });
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true; }, sel); await sleep(500); return ok; };
const shown = (kind) => page.evaluate((kind) => [...document.querySelectorAll(".recap")].some((e) => e.innerText.includes("stand-in paragraph for " + kind)), kind);
const last = () => sent[sent.length - 1] || {};
const wide = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

// newsletter
console.log("news button:", await tap('[data-a="ai"][data-k^="news:"]'), "shown:", await shown("news"), "kind:", last().kind,
	"facts:", JSON.stringify({ when: last().facts.when, east: last().facts.east.length, west: last().facts.west.length, leaders: last().facts.leaders.map((c) => c.cat + " " + (c.rows[0] || {}).n), news: last().facts.news.length }));
console.log("news headings bold:", await page.evaluate(() => [...document.querySelectorAll(".recap b")].map((b) => b.innerText).slice(0, 2).join(" | ")));
await page.screenshot({ path: "tests/shots/s30-news.png" });

// assistant GM
await page.type("#askq", "Who should we target to improve our defense?");
console.log("ask button:", await tap('[data-a="askgm"]'), "shown:", await shown("ask"), "kind:", last().kind,
	"facts:", JSON.stringify({ q: last().facts.q, roster: last().facts.roster.length, fa: last().facts.fa.length, targets: last().facts.targets.length, pay: Math.round(last().facts.pay), rank: last().facts.rank }), "bytes:", JSON.stringify(last()).length);
await page.evaluate(() => { const e = [...document.querySelectorAll("h2")].find((h) => /assistant/i.test(h.innerText)); if (e) e.scrollIntoView(); }); await sleep(150);
await page.screenshot({ path: "tests/shots/s30-ask.png" }); console.log("sideways scroll on home:", await wide());

// scouting report on a prospect
const pid = await page.evaluate(() => { const p = window.HG.G.players.find((x) => x.tid === -2); return p ? p.id : null; });
if (pid == null) console.log("scout: no prospects in the pool at this point");
else {
	await page.evaluate((id) => { window.HG.UI.sheet = { k: "player", id }; window.HG.render(); }, pid); await sleep(200);
	console.log("scout button:", await tap('[data-a="ai"][data-k^="scout:"]'), "shown:", await shown("scout"), "facts:", JSON.stringify({ n: last().facts.n, rank: last().facts.rank, of: last().facts.of, proj: last().facts.proj, r: last().facts.r.length }));
	await page.screenshot({ path: "tests/shots/s30-scout.png" });
}

// the agent of a free agent (give one an asking price if nobody has one mid-season)
const fid = await page.evaluate(() => { const G = window.HG.G; let p = G.players.filter((x) => x.tid === -1 && x.ask != null).sort((a, b) => b.ovr - a.ovr)[0]; if (!p) { p = G.players.filter((x) => x.tid === -1).sort((a, b) => b.ovr - a.ovr)[0]; p.ask = 3.4; p.askY = 2; } return p.id; });
await page.evaluate((id) => { window.HG.UI.sheet = { k: "player", id }; window.HG.render(); }, fid); await sleep(200);
console.log("agent button:", await tap('[data-a="ai"][data-k^="agent:"]'), "shown:", await shown("agent"), "facts:", JSON.stringify({ p: last().facts.p.n, market: last().facts.market, price: last().facts.price, why: last().facts.why, resign: last().facts.resign, others: last().facts.others }));
await page.screenshot({ path: "tests/shots/s30-agent.png" });

// the other GM on the trade screen
await page.evaluate(() => { const HG = window.HG, G = HG.G, UI = HG.UI; UI.sheet = null; UI.tab = "moves"; UI.moves = "trade"; const o = G.teams.find((t) => t.ab === "SAC"); UI.tradeTid = o.tid; const mine = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.ovr - b.ovr)[0], theirs = G.players.filter((p) => p.tid === o.tid && Math.abs(p.sal - mine.sal) < 1.5 && p.ovr > mine.ovr).sort((a, b) => b.ovr - a.ovr)[0]; UI.tradeA = [mine.id]; UI.tradeB = [theirs.id]; UI.tradePA = []; UI.tradePB = []; HG.render(); });
console.log("trade verdict:", await page.evaluate(() => (document.querySelector("main p.note b, main p.good b") || {}).innerText));
console.log("trade button:", await tap('[data-a="ai"][data-k^="trade:"]'), "shown:", await shown("trade"), "facts:", JSON.stringify({ them: last().facts.them, get: last().facts.get.map((p) => p.n), give: last().facts.give.map((p) => p.n), verdict: last().facts.verdict }));
await page.screenshot({ path: "tests/shots/s30-trade.png" }); console.log("sideways scroll on trade:", await wide());
const tradeKey = await page.evaluate(() => document.querySelector('[data-aikey^="trade:"]').dataset.aikey);
await page.evaluate(() => { const UI = window.HG.UI, G = window.HG.G; const o = G.teams.find((t) => t.ab === "SAC"), me = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.ovr - b.ovr)[1]; UI.tradeA = [me.id]; UI.tradeB = [G.players.filter((p) => p.tid === o.tid && Math.abs(p.sal - me.sal) < 1.5).sort((a, b) => b.ovr - a.ovr)[0].id]; window.HG.render(); });
await page.evaluate(() => { const UI = window.HG.UI, G = window.HG.G, o = G.teams.find((t) => t.ab === "SAC"); UI.tradeB = [G.players.filter((p) => p.tid === o.tid).sort((a, b) => b.sal - a.sal)[0].id]; window.HG.render(); });
console.log("a deal stopped by the cap has no GM button:", await page.evaluate(() => !document.querySelector('[data-aikey^="trade:"]')), "verdict:", await page.evaluate(() => (document.querySelector("main p.note b") || {}).innerText));
console.log("changing the offer drops the old reply:", await page.evaluate((k) => !document.querySelector(`[data-aikey="${k}"]`), tradeKey), "new verdict:", await page.evaluate(() => (document.querySelector("main p.note b, main p.good b") || {}).innerText), "button:", await page.evaluate(() => !!document.querySelector('[data-a="ai"][data-k^="trade:"]')));

console.log("kinds sent:", sent.map((b) => b.kind).join(","));
console.log("save untouched:", await page.evaluate(() => !JSON.stringify(window.HG.G).includes("stand-in")));
console.log("ERRORS", errors);
await browser.close();
