import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(200); if (!ok) console.log("  MISSING", sel); return ok; };
const rows = (n = 4) => page.evaluate((n) => [...document.querySelectorAll("main table tr[data-a='player']")].slice(0, n).map((r) => r.innerText.replace(/\s+/g, " ").slice(0, 70)).join(" / "), n);
// ---- free agents in the offseason
await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(999); HG.playPlayoffs("all"); HG.UI.sheet = null; HG.UI.progPending = false; });
console.log("draft phase moves:", await page.evaluate(() => document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, 700)));
await page.screenshot({ path: "tests/shots/t24-draft.png" });
// ---- draft: next pick, board, go to my pick
const d0 = await page.evaluate(() => window.HG.G.draft.i); await tap('[data-a="draftnext"]'); console.log("next pick:", d0, "->", await page.evaluate(() => window.HG.G.draft.i), "| last:", await page.evaluate(() => [...document.querySelectorAll("main .clock p.note")].map((p) => p.innerText).find((t) => /Last pick/.test(t))));
await tap('[data-a="drhelp"]'); console.log("help:", await page.evaluate(() => [...document.querySelectorAll("main .clock p.note")].pop().innerText.slice(0, 160)));
for (const k of ["mine", "done", "next"]) { await tap(`[data-a="dboard"][data-k="${k}"]`); console.log("board", k, ":", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /Draft board/i.test(x.querySelector("h2")?.innerText || "")); return [...s.querySelectorAll(".list > div")].slice(0, 3).map((d) => d.innerText.replace(/\s+/g, " ")).join(" / "); })); }
console.log("prospects sorted by rank:", await rows(3));
await tap('[data-a="lsort"][data-l="draft"][data-k="pot"]'); console.log("by potential:", await rows(3)); await tap('[data-a="lsort"][data-l="draft"][data-k="pot"]'); console.log("reversed:", await rows(2));
await tap('[data-a="lpos"][data-l="draft"][data-k="C"]'); console.log("centers:", await rows(3)); await tap('[data-a="lpos"][data-l="draft"][data-k=""]'); await tap('[data-a="lsort"][data-l="draft"][data-k="rank"]');
// a prospect page before my pick
await page.evaluate(() => { const HG = window.HG; const p = HG.G.players.filter((x) => x.tid === -2)[0]; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); });
console.log("prospect page (not my turn):", await page.evaluate(() => document.querySelector(".sheet section")?.innerText.replace(/\s+/g, " ").slice(0, 300)));
await page.evaluate(() => { window.HG.UI.sheet = null; window.HG.render(); });
const mineLeft = await page.evaluate(() => window.HG.G.draft.order.filter((t, i) => t === window.HG.G.userTid && i >= window.HG.G.draft.i).length);
if (mineLeft) {
	await tap('[data-a="simdraft"][data-k="1"]'); console.log("on the clock:", await page.evaluate(() => document.querySelector("main .clock").innerText.replace(/\s+/g, " ").slice(0, 300)));
	await page.screenshot({ path: "tests/shots/t24-clock.png" });
	const id = await page.evaluate(() => +document.querySelector("main table tr[data-a='player']:nth-of-type(3)")?.dataset.id || +document.querySelector("main table tr[data-a='player']").dataset.id);
	await page.evaluate((id) => { const HG = window.HG; HG.UI.sheet = { k: "player", id }; HG.render(); }, id); console.log("prospect page (my turn):", await page.evaluate(() => document.querySelector(".sheet section")?.innerText.replace(/\s+/g, " ").slice(0, 260)));
	await page.screenshot({ path: "tests/shots/t24-prospect.png" });
	await tap('.sheet [data-a="draft"]'); console.log("drafted:", await page.evaluate(() => window.HG.UI.toast), "| mine:", await page.evaluate((id) => { const p = window.HG.G.players.find((x) => x.id === id); return `${p.n} tid ${p.tid === window.HG.G.userTid ? "mine" : p.tid} sal ${p.sal} exp ${p.exp}`; }, id));
}
await tap('[data-a="simdraft"][data-k=""]'); console.log("after draft:", await page.evaluate(() => window.HG.G.phase));
// ---- free agents: sorts and filters
await page.evaluate(() => { const HG = window.HG; if (HG.G.phase === "resign") HG.finishResign(); HG.UI.tab = "moves"; HG.UI.moves = "fa"; HG.UI.sheet = null; HG.render(); });
console.log("FA default:", await rows(3));
for (const k of ["pot", "young", "cheap", "pts", "reb", "ast"]) { await tap(`[data-a="lsort"][data-l="fa"][data-k="${k}"]`); console.log("FA", k, ":", await rows(2)); }
await tap('[data-a="lsort"][data-l="fa"][data-k="ast"]'); console.log("FA ast reversed:", await rows(2));
await tap('thead [data-a="lsort"], main table th [data-a="lsort"][data-k="ovr"]'); console.log("header ovr:", await rows(2), "| header text:", await page.evaluate(() => [...document.querySelectorAll("main table th")].map((t) => t.innerText).join(" ")));
await tap('[data-a="lpos"][data-l="fa"][data-k="G"]'); console.log("guards:", await page.evaluate(() => [...document.querySelectorAll("main table tr[data-a='player'] .sub")].slice(0, 6).map((s) => s.innerText.split(" · ")[0]).join(",")));
await tap('[data-a="faonly"]'); console.log("can sign guards:", await page.evaluate(() => document.querySelectorAll("main table tr[data-a='player']").length), await page.evaluate(() => [...document.querySelectorAll("main p.note")].map((p) => p.innerText).find((t) => /player/.test(t) && /Tap a column/.test(t))));
await page.screenshot({ path: "tests/shots/t24-fa.png" });
// ---- roster sorting
await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "roster"; HG.render(); }); console.log("roster lineup:", await page.evaluate(() => document.querySelectorAll("main tr.cut").length), await rows(3));
await tap('[data-a="lsort"][data-l="rmine"][data-k="young"]'); console.log("roster youngest:", await rows(3), "| cut rows:", await page.evaluate(() => document.querySelectorAll("main tr.cut").length), "|", await page.evaluate(() => [...document.querySelectorAll("main p.note")].map((p) => p.innerText).find((t) => /Sorted view/.test(t))));
await tap('[data-a="lsort"][data-l="rmine"][data-k="lineup"]');
// ---- scouting in season, and a fantasy draft
await page.evaluate(() => { const HG = window.HG; const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; HG.fillMine(); HG.faAdvance(30); HG.UI.tab = "moves"; HG.UI.moves = "draft"; HG.render(); });
console.log("scouting:", await page.evaluate(() => document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, 400)));
await page.evaluate(() => { const HG = window.HG; HG.newGame(2010, 3, { fantasy: true }); HG.UI.tab = "moves"; HG.render(); });
console.log("fantasy:", await page.evaluate(() => document.querySelector("main .clock")?.innerText.replace(/\s+/g, " ").slice(0, 300)));
await tap('[data-a="simdraft"][data-k=""]'); console.log("fantasy done:", await page.evaluate(() => window.HG.G.phase));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
