import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(160); return ok; };
const txt = (sel, n = 300) => page.evaluate((sel, n) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").slice(0, n) : null; }, sel, n);
const st = () => page.evaluate(() => { const HG = window.HG, G = HG.G, t = G.teams[G.userTid], C = HG.UI.coach; return { day: G.day, rec: t.w + "-" + t.l, log: G.log.length, coach: C ? { shown: C.shown, ev: C.game.ev.length, slice: C.game.slice, paused: C.paused, msg: C.msg, us: C.game.T[C.side].pts, them: C.game.T[1 - C.side].pts, done: C.done } : null }; });
await page.evaluate(() => { const HG = window.HG; HG.newGame(1996, HG.DATA.s1996.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(3); HG.UI.tab = "home"; HG.render(); });
await tap('[data-a="play"]'); console.log("play options:", await page.evaluate(() => [...document.querySelectorAll(".sheet [data-a='go']")].map((b) => b.innerText).join(" | ")));
await tap('.sheet [data-a="go"][data-k="coach"]'); console.log("opened:", await txt(".sheet", 260)); console.log("scouting:", await page.evaluate(() => [...document.querySelectorAll(".sheet .note")].map((n) => n.innerText).slice(-4).join(" / ").slice(0, 600)));
await page.screenshot({ path: "tests/shots/t17-tactics.png" });
const before = await st();
await tap('[data-a="cset"][data-k="def"][data-v="press"]'); await tap('[data-a="cset"][data-k="off"][data-v="three"]'); console.log("tactic note:", await page.evaluate(() => [...document.querySelectorAll(".sheet .note")].find((n) => /Pressure forces/.test(n.innerText))?.innerText.slice(0, 200)));
await tap('[data-a="cfast"]'); await tap('[data-a="cgo"]'); await tap('[data-a="ctab"][data-k="plays"]'); await sleep(2500);
console.log("running:", JSON.stringify(await st()), "|", await txt("#cscore", 120)); console.log("feed:", await txt("#cfeed", 200));
await page.screenshot({ path: "tests/shots/t17-plays.png" });
// sub: tap an on-floor player, then a bench player
await tap('[data-a="ctab"][data-k="line"]');
const sub = await page.evaluate(() => { const C = window.HG.UI.coach, us = C.game.T[C.side], on = us.on, out = on[0], inn = us.pl.find((x) => !on.includes(x) && x.L[13] < 6); return { out: out.k, inn: inn.k, outN: out.p.n, innN: inn.p.n }; });
await tap(`[data-a="csel"][data-k="${sub.out}"]`); console.log("selected:", await txt("#cpanel p.note", 120)); await tap(`[data-a="csel"][data-k="${sub.inn}"]`);
await sleep(1500); console.log("after sub:", await page.evaluate((sub) => { const C = window.HG.UI.coach, us = C.game.T[C.side]; return `auto ${us.c.auto}, ${sub.innN} on: ${us.pl[sub.inn].isOn}, ${sub.outN} on: ${us.pl[sub.out].isOn}, slice ${C.game.slice}`; }, sub));
await page.screenshot({ path: "tests/shots/t17-lineup.png" });
// timeout
const to0 = await page.evaluate(() => window.HG.UI.coach.game.T[window.HG.UI.coach.side].to); await tap('[data-a="cto"]'); console.log("timeout:", to0, "->", await page.evaluate(() => window.HG.UI.coach.game.T[window.HG.UI.coach.side].to), JSON.stringify((await st()).coach));
// run until a pause stops it
await tap('[data-a="cgo"]'); let s; for (let i = 0; i < 80; i++) { await sleep(500); s = await st(); if (s.coach.paused) break; } console.log("auto pause:", JSON.stringify(s.coach));
// leave: sim to the end
await tap('.sheet > button[data-a="close"]'); await sleep(400); const after = await st();
console.log("after sim:", JSON.stringify(after), "|", await txt(".sheet", 160));
const chk = await page.evaluate(() => { const HG = window.HG, G = HG.G, C = HG.UI.coach, g = G.log[G.log.length - 1], sc = G.sc[G.day - 1].find((x) => x[0] === G.userTid || x[1] === G.userTid); return { log: [g.us, g.them], coach: [C.game.T[C.side].pts, C.game.T[1 - C.side].pts], sc, box: g.b && g.b[0].reduce((a, r) => a + r[2], 0), COACH: HG.COACH }; });
console.log("recorded:", JSON.stringify(chk));
await tap('.sheet [data-a="box"]'); console.log("box:", await txt(".sheet h2", 60)); await tap('.sheet > button[data-a="close"]');
console.log("day moved by one:", before.day, "->", after.day, "| record", before.rec, "->", after.rec);
// reload mid-game does not record anything
await page.evaluate(() => { const HG = window.HG; HG.startCoach(false); HG.UI.coach.game.step(); HG.UI.coach.game.step(); });
const mid = await st(); await page.reload({ waitUntil: "networkidle2" }); await sleep(900); const re = await st(); console.log("reload mid-game: day", mid.day, "->", re.day, "log", mid.log, "->", re.log);
// playoffs: coach a playoff game
const po = await page.evaluate(() => { const HG = window.HG; HG.playDays(999); const G = HG.G; if (G.phase !== "playoffs") return { phase: G.phase }; const s = G.po.series.find((x) => x.a === G.userTid || x.b === G.userTid); if (!s) return { out: true }; const w0 = s.wa + s.wb; HG.startCoach(true); HG.coachSim(); const s2 = G.po.series.find((x) => x.a === G.userTid || x.b === G.userTid) || (G.po.done || []).find((x) => x.a === G.userTid || x.b === G.userTid); return { games: w0 + "->" + (s2.wa + s2.wb), pd: G.po.pd, lastPo: !!G.log[G.log.length - 1].po, ps: G.players.filter((p) => p.tid === G.userTid).reduce((a, p) => a + ((p.ps || [])[0] || 0), 0) }; });
console.log("playoffs:", JSON.stringify(po));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
