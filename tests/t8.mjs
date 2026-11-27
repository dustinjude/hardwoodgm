import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const r = await page.evaluate(() => { const HG = window.HG, out = []; for (const y of [1990, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 2000]) { HG.newGame(y, 3); HG.playDays(999); const c = {}; for (const t of HG.G.teams) c[t.w + t.l] = (c[t.w + t.l] || 0) + 1; out.push([y, HG.G.teams.length, HG.G.sched.length, JSON.stringify(c), HG.G.history.length ? HG.G.history[0].rec : HG.G.teams[HG.G.userTid].w + "-" + HG.G.teams[HG.G.userTid].l]); } return out; });
console.log(JSON.stringify(r)); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
