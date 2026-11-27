import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300)));
// Simulate a viewer where IndexedDB is missing or never answers.
for (const mode of ["missing", "hangs"]) {
  await page.evaluateOnNewDocument((mode) => { if (mode === "missing") Object.defineProperty(window, "indexedDB", { get() { throw new Error("blocked"); } }); else Object.defineProperty(window, "indexedDB", { value: { open: () => ({}) } }); }, mode);
  await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
  const r = await page.evaluate(async () => { const HG = window.HG; HG.newGame(2010, 4); HG.playDays(12); HG.UI.tab = "league"; HG.UI.league = "scores"; HG.render(); const t0 = Date.now(); while (!HG.bxNeed() && Date.now() - t0 < 4000) await new Promise((res) => setTimeout(res, 100)); const id = HG.G.players.filter((p) => p.tid === HG.G.userTid).sort((a, b) => b.s[2] - a.s[2])[0].id; HG.UI.sheet = { k: "player", id }; HG.render(); return { waited: Date.now() - t0, ready: HG.bxNeed(), log: HG.gameLog(id).length, hasLog: /Game log/i.test(document.querySelector(".sheet").innerText), sub: !!document.querySelector("main .list .sub") }; });
  console.log(mode, JSON.stringify(r));
}
console.log("ERRORS", JSON.stringify(errors.slice(0, 5))); await browser.close();
