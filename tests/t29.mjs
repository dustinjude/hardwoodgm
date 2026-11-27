// Game recaps: the box score shows "Write a game recap"; tapping it posts the game's facts to /api/claude and shows the
// story that comes back. The function is stubbed here, so this needs no API key; a failed call shows a plain message.
import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
let posted = null, fail = false;
await page.setRequestInterception(true);
page.on("request", (rq) => {
	if (!rq.url().endsWith("/api/claude")) return rq.continue();
	posted = JSON.parse(rq.postData()).facts;
	if (fail) return rq.respond({ status: 503, body: "Not set up" });
	setTimeout(() => rq.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Rockets hold off the visitors\nA stand-in first paragraph.\nA stand-in second paragraph." }) }), 400);
});
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(800);
await page.evaluate(() => { const HG = window.HG; HG.UI.season = 2016; HG.newGame(2016, HG.DATA.s2016.teams.findIndex((t) => t[0] === "HOU")); HG.playDays(3); });
const n = await page.evaluate(() => window.HG.G.log.length);
await page.evaluate((i) => { window.HG.UI.sheet = { k: "box", i }; window.HG.render(); }, n - 1); await sleep(200);
console.log("button:", await page.evaluate(() => !!document.querySelector('[data-a="ai"][data-k^="recap:"]')));
await page.evaluate(() => document.querySelector('[data-a="ai"][data-k^="recap:"]').click()); await sleep(100);
console.log("waiting:", await page.evaluate(() => /Writing the recap/.test(document.querySelector(".sheet").innerText)));
await sleep(700);
console.log("recap:", await page.evaluate(() => (document.querySelector(".recap") || { innerText: "none" }).innerText.replace(/\n+/g, " / ")));
console.log("posted:", JSON.stringify(posted).slice(0, 400));
console.log("sideways scroll:", await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
await page.screenshot({ path: "tests/shots/s29-recap.png" });
// a failed call: the next game's recap shows the plain error line, and the button comes back to try again
fail = true;
await page.evaluate((i) => { window.HG.UI.sheet = { k: "box", i }; window.HG.render(); }, n - 2); await sleep(200);
await page.evaluate(() => document.querySelector('[data-a="ai"][data-k^="recap:"]').click()); await sleep(600);
console.log("on failure:", await page.evaluate(() => [...document.querySelectorAll(".sheet p.note")].map((p) => p.innerText).find((t) => /couldn.t be written/i.test(t)) || "none"), "button back:", await page.evaluate(() => !!document.querySelector('[data-a="ai"][data-k^="recap:"]')));
console.log("save untouched:", await page.evaluate(() => !JSON.stringify(window.HG.G).includes("stand-in")));
console.log("ERRORS", errors);
await browser.close();
