import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.click(); }, sel); await sleep(120); };
await page.evaluate(() => { const HG = window.HG; HG.newGame(2010, HG.DATA.s2010.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(90); HG.UI.tab = "home"; HG.render(); });
for (const k of ["trade", "sign", "inj", "big", ""]) { await tap(`[data-a="nfilter"][data-k="${k}"]`); console.log("news", k || "all", await page.evaluate(() => { const s = [...document.querySelectorAll("main section")].find((x) => /news/i.test(x.querySelector("h2")?.innerText || "")); return s ? s.querySelectorAll(".list > div").length + " · " + [...s.querySelectorAll(".list > div")].slice(0, 2).map((x) => x.innerText.replace(/\s+/g, " ").slice(0, 80)).join(" / ") : null; })); }
console.log("total news", await page.evaluate(() => window.HG.G.news.length + " · kinds: " + [...new Set(window.HG.G.news.map((n) => n.t.replace(/[^A-Za-z ]/g, "").split(" ").slice(0, 2).join(" ")))].slice(0, 40).join(" | ")));
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.screenshot({ path: "tests/shots/t7-news.png" });
console.log("ERRORS", JSON.stringify(errors)); await browser.close();
