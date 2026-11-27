import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await page.evaluate(() => { localStorage.clear(); }); await page.reload({ waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(250); return ok; };
const heads = () => page.evaluate(() => [...document.querySelectorAll("main h1, main h2")].map((h) => h.innerText.replace(/\s+/g, " ")).join(" | "));
const state = () => page.evaluate(() => { const G = window.HG.G; return G ? `${G.teams[G.userTid].region} ${G.teams[G.userTid].name} ${G.season} day ${G.day} id ${G.id}` : "no league open"; });
console.log("first open:", await heads()); await page.screenshot({ path: "tests/shots/t23-first.png" });
await page.evaluate(() => { const s = document.querySelector("#season"); s.value = "1996"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await sleep(200);
await tap('[data-a="team"][data-tid="3"]'); console.log("summary:", await page.evaluate(() => [...document.querySelectorAll("main p.note b")].map((b) => b.innerText).pop()), "| button:", await page.evaluate(() => document.querySelector('[data-a="start"]').innerText));
await tap('[data-a="start"]'); console.log("started:", await state());
await page.evaluate(() => window.HG.playDays(10)); await page.evaluate(() => { window.HG.UI.tab = "home"; window.HG.render(); });
console.log("home leagues box:", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /^Leagues/i.test(x.querySelector("h2")?.innerText || "")); return s ? s.innerText.replace(/\s+/g, " ").slice(0, 200) : null; }));
await page.evaluate(() => { window.HG.UI.tab = "more"; window.HG.render(); }); console.log("office first section:", await page.evaluate(() => document.querySelector("main section h2").innerText));
// start a new league from Office
const first = await state(); await tap('main [data-a="newleague"]'); console.log("new league screen:", await heads()); await page.screenshot({ path: "tests/shots/t23-new.png" });
console.log("back button:", await page.evaluate(() => [...document.querySelectorAll('main [data-a="openleague"]')].map((b) => b.innerText).join(" / ")));
// cancel goes back to the same league
await tap('main [data-a="openleague"]'); console.log("cancel ->", await state(), "same as", first);
// new league with invented players and a fantasy draft
await tap('main [data-a="newleague"]'); await tap('[data-a="mode"][data-k="fake"]'); await tap('[data-a="team"][data-tid="10"]'); await tap('[data-a="diff"][data-k="2"]');
console.log("summary2:", await page.evaluate(() => [...document.querySelectorAll("main p.note b")].map((b) => b.innerText).pop())); await tap('[data-a="start"]'); const second = await state(); console.log("second league:", second);
await page.evaluate(() => { window.HG.UI.tab = "home"; window.HG.render(); }); console.log("other leagues listed:", await page.evaluate(() => [...document.querySelectorAll('main [data-a="openleague"]')].map((b) => b.closest("div").innerText.replace(/\s+/g, " ")).join(" / ")));
await page.screenshot({ path: "tests/shots/t23-home.png", fullPage: false });
// switch back to the first league
await tap('main [data-a="openleague"]'); console.log("switched ->", await state());
// reload: start screen is not shown (opens current league); go to the leagues list via old path and check the list view
await page.reload({ waitUntil: "networkidle2" }); await sleep(900); console.log("after reload:", await state());
await page.evaluate(() => { const HG = window.HG; HG.UI.newLeague = false; }); await tap('main [data-a="newleague"]'); await tap('main [data-a="openleague"]');
await page.evaluate(() => { document.querySelector('[data-a="leagues"]')?.click(); }); 
// simulate the start screen with leagues: G = null
await page.evaluate(() => { window.HG.save && window.HG.save(true); }); await page.evaluate(() => { const b = document.createElement("button"); b.dataset.a = "leagues"; document.body.appendChild(b); b.click(); }); await sleep(300);
console.log("list view:", await heads(), "| buttons:", await page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => b.innerText).join(", ").slice(0, 200)));
await tap('[data-a="newleaguestart"]'); console.log("setup from list:", await heads()); await tap('[data-a="leaguesback"]'); console.log("back to list:", await heads());
console.log("leagues saved:", await page.evaluate(() => JSON.parse(localStorage.getItem("hardwoodgm:index")).map((l) => l.name + " " + l.season).join(", ")));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
