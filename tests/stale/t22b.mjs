import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 900));
console.log(await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(999); HG.playPlayoffs("all"); HG.render(); const G = HG.G, rows = G.prog.rows; const reb = rows.map((r) => r[2] - r[7]); const big = rows.filter((r) => Math.abs(r[2] - r[7]) >= 2).length; const top = rows.slice().sort((a, b) => b[1] - a[1]).slice(0, 5).map((r) => `${G.players.find((p) => p.id === r[0]).n} ${r[1]}→${r[7]}→${r[2]}`); return `rebalance avg ${(reb.reduce((a, b) => a + b, 0) / reb.length).toFixed(2)}, |≥2| ${big} of ${rows.length}; top: ${top.join(", ")}`; }));
await page.screenshot({ path: "tests/shots/t22-report.png" });
console.log("ERRORS", JSON.stringify(errors)); await browser.close();
