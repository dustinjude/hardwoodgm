import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(150); return ok; };
const rows = (n = 4) => page.evaluate((n) => [...document.querySelectorAll("main table tr")].slice(0, n).map((r) => r.innerText.replace(/\s+/g, " ")).join("\n   "), n);
for (const y of [1996, 2024]) {
  await page.evaluate((y) => { const HG = window.HG; HG.newGame(y, 3); HG.playDays(999); HG.UI.tab = "league"; HG.UI.league = "leaders"; HG.UI.pmode = "adv"; HG.UI.pf = "all"; HG.UI.sheet = null; HG.render(); }, y);
  console.log(y, "ADV by default sort:\n  ", await rows(5));
  for (const [k, l] of [[3, "EWA"], [6, "USG"], [7, "AST"], [8, "REB"], [9, "STL"], [10, "BLK"]]) { await tap(`[data-a="psort"][data-k="${k}"]`); console.log(" top", l, await page.evaluate(() => [...document.querySelectorAll("main table tr")].slice(1, 4).map((r) => r.querySelector(".nm").innerText.replace(/^\d+\. /, "") + " " + r.querySelector("td b").innerText).join(" | "))); }
  console.log(" league check:", await page.evaluate(() => { const HG = window.HG, G = HG.G, A = HG.advCtx(G.players.map((p) => p.s)); let m = 0, w = 0, ew = 0; for (const p of G.players) if (p.s[1] > 0) { const per = HG.ADV.per(p.s, A); w += per * p.s[1]; m += p.s[1]; ew += HG.ADV.ewa(p.s, A); } return `avg PER ${(w / m).toFixed(2)}, total EWA ${ew.toFixed(0)} (league wins ${G.teams.reduce((a, t) => a + t.w, 0)}), usg avg ${(G.players.filter((p) => p.s[1] > 500).reduce((a, p) => a + HG.ADV.usg(p.s, A) * p.s[1], 0) / G.players.filter((p) => p.s[1] > 500).reduce((a, p) => a + p.s[1], 0)).toFixed(1)}`; }));
  await tap('[data-a="pmode"][data-k="p36"]'); console.log(" P36:\n  ", await rows(3));
}
await tap('[data-a="pmode"][data-k="adv"]'); await page.screenshot({ path: "tests/shots/t14-adv.png" });
const id = await page.evaluate(() => window.HG.G.players.filter((p) => p.tid >= 0).sort((a, b) => b.ovr - a.ovr)[0].id);
await page.evaluate((id) => { const HG = window.HG; HG.UI.sheet = { k: "player", id }; HG.render(); }, id); console.log("player:", await page.evaluate(() => [...document.querySelectorAll(".sheet p.note")].map((p) => p.innerText).find((t) => /^Advanced/.test(t))));
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.UI.pmode = "stat"; HG.render(); }); console.log("stat mode:", (await rows(2)).slice(0, 200));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
