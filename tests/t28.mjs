// Team strategy sheet, roster style line, player "How he plays", box score game plans, coached game starting plan.
import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(800);
await page.evaluate(() => { const HG = window.HG; HG.UI.season = 2016; HG.newGame(2016, HG.DATA.s2016.teams.findIndex((t) => t[0] === "HOU")); HG.UI.tab = "roster"; HG.render(); });
const click = async (sel) => { await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) throw new Error("missing " + sel); e.click(); }, sel); await sleep(250); };
const text = (sel) => page.evaluate((sel) => (document.querySelector(sel) || { innerText: "" }).innerText, sel);
console.log("roster style:", (await page.evaluate(() => [...document.querySelectorAll("p.note")].map((p) => p.innerText).find((t) => t.startsWith("Style")) || "none")));
console.log("roster tags:", await page.evaluate(() => [...document.querySelectorAll("tr[data-a=player] .sub")].slice(0, 4).map((e) => e.innerText).join(" | ")));
await page.screenshot({ path: "tests/shots/s28-roster.png" });
await click('[data-a="strat"]'); await page.screenshot({ path: "tests/shots/s28-strat.png" });
console.log("sheet:", (await text(".sheet")).slice(0, 900).replace(/\n+/g, " / "));
await click('[data-a="stset"][data-k="pace"][data-v="1"]'); await click('[data-a="stset"][data-k="off"][data-v="star"]'); await click('[data-a="stset"][data-k="def"][data-v="press"]'); await click('[data-a="stset"][data-k="rot"][data-v="tight"]');
const st = await page.evaluate(() => JSON.stringify(window.HG.G.teams[window.HG.G.userTid].st)); console.log("saved:", st, "star select:", await page.evaluate(() => !!document.querySelector("#ststar")));
await page.screenshot({ path: "tests/shots/s28-strat2.png" });
const rot = await page.evaluate(() => { const HG = window.HG, G = HG.G, ps = G.players.filter((p) => p.tid === G.userTid); return HG.rotation(ps, G.userTid).map((x) => Math.round(x.m) + "/" + Math.round(x.mn)).join(" "); }); console.log("tight rotation min/normal:", rot);
await click('[data-a="close"]'); console.log("summary:", (await page.evaluate(() => [...document.querySelectorAll("p.note")].map((p) => p.innerText).find((t) => t.startsWith("Style")) || "none")));
// play and look at the box score
await page.evaluate(() => { window.HG.playDays(3); }); const lg = await page.evaluate(() => { const G = window.HG.G; return G.log.length; });
await page.evaluate((i) => { window.HG.UI.sheet = { k: "box", i }; window.HG.render(); }, lg - 1); await sleep(200);
console.log("box plans:", ((await text(".sheet")).match(/Game plans:[^\n]*/) || ["none"])[0]);
await page.screenshot({ path: "tests/shots/s28-box.png" });
// player page
await page.evaluate(() => { const G = window.HG.G, p = G.players.find((x) => x.n === "James Harden"); window.HG.UI.sheet = { k: "player", id: p.id }; window.HG.render(); }); await sleep(200);
const pt = await text(".sheet"); console.log("player:", (pt.match(/HOW HE PLAYS[\s\S]*?decide what he does in games\./i) || ["none"])[0].replace(/\n+/g, " / "));
await page.evaluate(() => { const e = [...document.querySelectorAll("h2")].find((h) => /How he plays/i.test(h.innerText)); if (e) e.scrollIntoView(); }); await sleep(150);
await page.screenshot({ path: "tests/shots/s28-player.png" });
// coached game starts from the plan
await page.evaluate(() => { window.HG.UI.sheet = null; window.HG.startCoach(false); }); await sleep(300);
const C = await page.evaluate(() => { const C = window.HG.UI.coach, us = C.game.T[C.side]; return { c: us.c, note: C.notes[0], star: us.pl[us.c.star].p.n }; }); console.log("coach:", JSON.stringify(C));
await page.screenshot({ path: "tests/shots/s28-coach.png" });
await page.evaluate(() => window.HG.coachSim()); await sleep(300);
// reset
await page.evaluate(() => { window.HG.UI.sheet = { k: "strat" }; window.HG.render(); }); await click('[data-a="stset"][data-k="reset"]'); console.log("reset:", await page.evaluate(() => JSON.stringify(window.HG.G.teams[window.HG.G.userTid].st)));
// another team's page
await page.evaluate(() => { const G = window.HG.G; window.HG.UI.sheet = null; window.HG.UI.viewTid = G.teams.findIndex((t) => t.ab === "SAC"); window.HG.UI.tab = "roster"; window.HG.render(); }); await sleep(200);
console.log("SAC style:", (await page.evaluate(() => [...document.querySelectorAll("p.note")].map((p) => p.innerText).find((t) => t.startsWith("Style")) || "none")));
console.log("ERRORS", JSON.stringify(errors)); await browser.close();
