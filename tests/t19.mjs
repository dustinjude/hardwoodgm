import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(200); return ok; };
const txt = (sel, n = 400) => page.evaluate((sel, n) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").slice(0, n) : null; }, sel, n);
const st = () => page.evaluate(() => { const G = window.HG.G, mine = G.players.filter((p) => p.tid === G.userTid); return { phase: G.phase, faDay: G.faDay, roster: mine.length, pay: Math.round(mine.reduce((a, p) => a + p.sal, 0) * 10) / 10, fa: G.players.filter((p) => p.tid === -1).length }; });
await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(999); HG.playPlayoffs("all"); HG.UI.toast = ""; HG.render(); });
console.log("draft steps:", await txt("main section", 160));
await page.evaluate(() => { const HG = window.HG; HG.simDraft(false); HG.UI.toast = ""; HG.render(); });
console.log("resign:", JSON.stringify(await st())); console.log("  screen:", await txt("main", 700)); await page.screenshot({ path: "tests/shots/t19-resign.png" });
await tap('[data-a="moves"][data-k="fa"]'); console.log("FA during resign: tags", await page.evaluate(() => [...document.querySelectorAll(".sub.good")].filter((x) => /You can sign/.test(x.innerText)).length), "|", await txt("main section:nth-of-type(2) p.note", 140));
// re-sign the best one, let the rest go
await tap('[data-a="moves"][data-k="resign"]'); const best = await page.evaluate(() => { const G = window.HG.G; return G.resign.map((id) => G.players.find((p) => p.id === id)).sort((a, b) => b.ovr - a.ovr)[0].n; }); await tap('main [data-a="resign"]'); console.log("re-signed first in list; best was", best, JSON.stringify(await st()));
await tap('[data-a="finishresign"]'); console.log("FA open:", JSON.stringify(await st())); console.log("  news:", await page.evaluate(() => window.HG.G.news[0].t));
console.log("  screen:", await txt("main", 600)); await page.screenshot({ path: "tests/shots/t19-fa.png" });
console.log("  tags:", await page.evaluate(() => [...document.querySelectorAll(".sub.good")].filter((x) => /You can sign/.test(x.innerText)).length));
await tap('[data-a="faonly"][data-k="1"]'); console.log("  only can-sign rows:", await page.evaluate(() => document.querySelectorAll("main table tr[data-a='player']").length), "all can?", await page.evaluate(() => [...document.querySelectorAll("main table tr[data-a='player']")].every((r) => r.querySelector(".sub.good"))));
await tap('[data-a="faonly"][data-k=""]');
// an unaffordable player's sheet
const exp = await page.evaluate(() => { const HG = window.HG, G = HG.G; const room = 80 - G.players.filter((p) => p.tid === G.userTid).reduce((a, p) => a + p.sal, 0); const p = G.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr).find((p) => p.ask > room + 1); if (!p) return null; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); return p.n; });
await sleep(400); console.log("unaffordable", exp, ":", await page.evaluate(() => [...document.querySelectorAll(".sheet p")].map((p) => p.innerText).filter((t) => /wants|fit|cap room/i.test(t)).join(" / ").slice(0, 400)));
await page.screenshot({ path: "tests/shots/t19-sheet.png" });
// sign an affordable one
const aff = await page.evaluate(() => { const HG = window.HG, G = HG.G; HG.UI.sheet = null; const tr = [...document.querySelectorAll("main table tr[data-a='player']")].find((r) => r.querySelector(".sub.good")); return tr ? +tr.dataset.id : null; });
await page.evaluate((id) => { const HG = window.HG; HG.UI.sheet = { k: "player", id }; HG.render(); }, aff); await sleep(300); await tap('.sheet [data-a="sign"]'); console.log("signed:", JSON.stringify(await st()), await page.evaluate(() => window.HG.UI.toast));
// next week
await tap('[data-a="play"]'); console.log("play sheet:", await txt(".sheet", 300));
const asks0 = await page.evaluate(() => Object.fromEntries(window.HG.G.players.filter((p) => p.tid === -1).map((p) => [p.id, p.ask])));
await tap('.sheet [data-a="go"][data-k="fa:7"]'); const s7 = await st(); console.log("after a week:", JSON.stringify(s7), await page.evaluate(() => window.HG.UI.toast));
console.log("  prices:", await page.evaluate((a0) => { const ps = window.HG.G.players.filter((p) => p.tid === -1 && a0[p.id] > 1.6); return ps.slice(0, 3).map((p) => `${p.n} ${a0[p.id]} -> ${p.ask}`).join(", "); }, asks0));
console.log("  news:", await page.evaluate(() => window.HG.G.news.slice(0, 6).map((n) => n.t).join(" | ").slice(0, 600)));
// short roster: release down to 10, then fill
await page.evaluate(() => { const HG = window.HG, G = HG.G; const mine = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 10) { const p = mine.shift(); p.tid = -1; HG.render(); } HG.UI.tab = "moves"; HG.UI.moves = "fa"; HG.render(); });
console.log("short:", await txt("main section:nth-of-type(1)", 200), "|", await page.evaluate(() => [...document.querySelectorAll("main p.bad")].map((p) => p.innerText).join(" ")));
await tap('[data-a="play"]'); await tap('.sheet [data-a="go"][data-k="fa:30"]'); console.log("finish blocked:", JSON.stringify(await st()), await page.evaluate(() => window.HG.UI.toast));
await tap('[data-a="fillmine"]'); console.log("filled:", JSON.stringify(await st()), await page.evaluate(() => window.HG.UI.toast));
await tap('[data-a="play"]'); await tap('.sheet [data-a="go"][data-k="fa:30"]'); const fin = await page.evaluate(() => { const G = window.HG.G; return { phase: G.phase, season: G.season, faDay: G.faDay, sizes: [...new Set(G.teams.map((t) => G.players.filter((p) => p.tid === t.tid).length))].sort().join(","), fa: G.players.filter((p) => p.tid === -1).length }; });
console.log("season started:", JSON.stringify(fin));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
