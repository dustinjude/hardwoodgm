// Old save (before tendencies) loads with real tendencies for real players and made-up ones for generated players.
import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];
const open = async (url) => { const page = await browser.newPage(); page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); await page.goto(url, { waitUntil: "networkidle2" }); await sleep(400); return page; };
const old = await open(`http://127.0.0.1:${process.argv[2] || 3421}/index.html`);
const sv = await old.evaluate(() => { const HG = window.HG; HG.newGame(2016, HG.DATA.s2016.teams.findIndex((t) => t[0] === "HOU")); HG.playDays(20); return localStorage.getItem("hardwoodgm1"); });
const page = await open("http://127.0.0.1:3400/index.html");
await page.evaluate((sv) => localStorage.setItem("hardwoodgm1", sv), sv); await page.reload({ waitUntil: "networkidle2" }); await sleep(500);
const r = await page.evaluate(() => { const HG = window.HG, G = HG.G, f = (n) => { const p = G.players.find((x) => x.n === n); return p && [p.r.length, p.r[15], p.r[16], HG.styleOf(p).map((x) => x[0]).join("/")]; };
  const short = G.players.filter((p) => p.r.length < 17).length, gen = G.players.filter((p) => p.gen).slice(0, 3).map((p) => [p.n, p.r[15], p.r[16]]);
  const real = (() => { const b = HG.DATA.s2016.rows.find((r) => HG.DATA.players[r[0]][0] === "James Harden"); return b.slice(23, 25); })();
  HG.playDays(5); return { harden: f("James Harden"), real, curry: f("Stephen Curry"), drummond: f("Andre Drummond"), korver: f("Kyle Korver"), rondo: f("Rajon Rondo"), short, gen, day: G.day, pv: G.teams.slice(0, 4).map((t) => [t.ab, +t.pv.toFixed(2)]) }; });
console.log(JSON.stringify(r)); console.log("ERRORS", JSON.stringify(errors)); await browser.close();
