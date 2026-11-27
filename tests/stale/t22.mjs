import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(250); return ok; };
const txt = (sel, n = 700) => page.evaluate((sel, n) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").slice(0, n) : null; }, sel, n);
await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(999); HG.UI.tab = "home"; HG.render(); });
console.log("before playoffs end, report button on roster?", await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "roster"; HG.render(); return !!document.querySelector('[data-a="prog"]'); }));
// finish the playoffs through the normal play sheet
await tap('[data-a="play"]'); const k = await page.evaluate(() => [...document.querySelectorAll('.sheet [data-a="go"]')].map((b) => b.dataset.k).find((x) => /po|all|end/.test(x))); console.log("play option used:", k); await tap(`.sheet [data-a="go"][data-k="${k}"]`); await sleep(400);
let st = await page.evaluate(() => { const G = window.HG.G; return { phase: G.phase, sheet: window.HG.UI.sheet && window.HG.UI.sheet.k, rows: G.prog && G.prog.rows.length, s: G.prog && G.prog.s }; });
console.log("after playoffs:", JSON.stringify(st)); if (st.phase === "playoffs") { await page.evaluate(() => { window.HG.playPlayoffs("all"); }); await sleep(300); st = await page.evaluate(() => ({ phase: window.HG.G.phase, sheet: window.HG.UI.sheet && window.HG.UI.sheet.k })); console.log("  then:", JSON.stringify(st)); }
console.log("report:", await txt(".sheet", 900)); await page.screenshot({ path: "tests/shots/t22-report.png" });
for (const f of ["up", "down", "young"]) { await tap(`[data-a="progf"][data-k="${f}"]`); console.log(f + ":", await page.evaluate(() => [...document.querySelectorAll(".sheet table tr")].slice(1, 4).map((r) => r.innerText.replace(/\s+/g, " ")).join(" / ").slice(0, 400))); }
// consistency: deltas match the players' ratings
console.log("check:", await page.evaluate(() => { const G = window.HG.G; let bad = 0, n = 0, sum = 0; for (const r of G.prog.rows) { const p = G.players.find((x) => x.id === r[0]); if (!p) continue; n++; if (p.ovr !== r[2] || p.dv !== r[2] - r[1]) bad++; sum += r[2] - r[1]; } const byAge = {}; for (const r of G.prog.rows) { const a = r[6] <= 23 ? "≤23" : r[6] <= 27 ? "24-27" : r[6] <= 31 ? "28-31" : "32+"; (byAge[a] = byAge[a] || []).push(r[2] - r[1]); } return { n, bad, avg: (sum / n).toFixed(2), byAge: Object.fromEntries(Object.entries(byAge).map(([k, v]) => [k, (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)])) }; }));
// player page, roster markers, home card
await tap('.sheet tr[data-a="player"]'); console.log("player line:", await page.evaluate(() => [...document.querySelectorAll(".sheet p.note")].map((p) => p.innerText).find((t) => /^After/.test(t))));
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.UI.tab = "roster"; HG.render(); }); console.log("roster markers:", await page.evaluate(() => [...document.querySelectorAll("main td.ovr")].slice(0, 8).map((t) => t.innerText.replace(/\s+/g, "")).join(" ")), "| buttons:", await page.evaluate(() => [...document.querySelectorAll("main [data-a='prog'], main [data-a='cap']")].map((b) => b.innerText).join(", ")));
await page.screenshot({ path: "tests/shots/t22-roster.png" });
await page.evaluate(() => { const HG = window.HG; HG.UI.tab = "home"; HG.render(); }); console.log("home card:", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /development/i.test(x.querySelector("h2")?.innerText || "")); return s ? s.innerText.replace(/\s+/g, " ").slice(0, 400) : null; }));
console.log("news:", await page.evaluate(() => window.HG.G.news.find((n) => /Player development/.test(n.t))?.t));
// the report does not pop up again; next season card stays for two weeks only
await page.evaluate(() => { const HG = window.HG; HG.render(); }); console.log("no second popup:", await page.evaluate(() => !window.HG.UI.sheet));
const later = await page.evaluate(() => { const HG = window.HG; HG.simDraft(false); if (HG.G.phase === "resign") HG.finishResign(); const g = HG.G; let mine = g.players.filter((p) => p.tid === g.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 15) mine.shift().tid = -1; HG.fillMine(); HG.faAdvance(30); HG.UI.tab = "home"; HG.render(); const a = !![...document.querySelectorAll("main section h2")].find((h) => /development/i.test(h.innerText)); HG.playDays(15); HG.render(); const b = !![...document.querySelectorAll("main section h2")].find((h) => /development/i.test(h.innerText)); const ro = (() => { HG.UI.tab = "roster"; HG.render(); return document.querySelectorAll("main td.ovr .dv").length; })(); return { phase: HG.G.phase, cardDay0: a, cardDay15: b, rosterMarkers: ro }; });
console.log("next season:", JSON.stringify(later));
// auto-play does not pop the report
const ap = await page.evaluate(async () => { const HG = window.HG; HG.UI.sheet = null; HG.autoPlay(1); for (let i = 0; i < 100 && HG.UI.autoN; i++) await new Promise((r) => setTimeout(r, 200)); return { season: HG.G.season, phase: HG.G.phase, sheet: HG.UI.sheet && HG.UI.sheet.k, prog: HG.G.prog.s }; });
console.log("auto-play:", JSON.stringify(ap));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
