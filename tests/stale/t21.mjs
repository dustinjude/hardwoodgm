import puppeteer from "puppeteer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 300))); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200)); });
await page.goto("http://127.0.0.1:3400/index.html", { waitUntil: "networkidle2" }); await sleep(900);
const tap = async (sel) => { const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return false; el.click(); return true; }, sel); await sleep(250); return ok; };
const txt = (sel, n = 700) => page.evaluate((sel, n) => { const el = document.querySelector(sel); return el ? el.innerText.replace(/\s+/g, " ").slice(0, n) : null; }, sel, n);
await page.evaluate(() => { const HG = window.HG; HG.newGame(2003, HG.DATA.s2003.teams.findIndex((t) => t[0] === "ORL")); HG.playDays(999); HG.playPlayoffs("all"); HG.simDraft(false); HG.UI.toast = ""; HG.render(); });
console.log("header:", await txt("header .ph", 80));
const rp = await page.evaluate(() => { const HG = window.HG, G = HG.G, p = G.resign.map((id) => G.players.find((x) => x.id === id)).sort((a, b) => b.ovr - a.ovr)[0]; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); return { n: p.n, ask: HG.askFor(p, p.askY), y: p.askY }; });
await sleep(400); console.log("re-sign box:", JSON.stringify(rp), "\n  ", await page.evaluate(() => [...document.querySelectorAll(".sheet section")][0]?.innerText.replace(/\s+/g, " ").slice(0, 900)));
await page.screenshot({ path: "tests/shots/t21-resign.png" });
// re-sign at a length one away from what he wants
const y1 = rp.y === 1 ? 2 : rp.y - 1; await tap(`.sheet [data-a="resign"][data-y="${y1}"]`);
console.log("re-signed:", await page.evaluate((n) => { const p = window.HG.G.players.find((x) => x.n === n); return `#${p.id} ${p.sal} through ${p.exp} (season ${window.HG.G.season})`; }, rp.n), "| expected", Math.round(rp.ask * 1.05 * 10) / 10, "|", await page.evaluate(() => window.HG.UI.toast));
await page.evaluate(() => window.HG.finishResign()); console.log("header FA:", await txt("header .ph", 80));
console.log("FA top:", await txt("main section:nth-of-type(2)", 260)); console.log("tags:", await page.evaluate(() => ({ can: document.querySelectorAll(".tag.ok").length, short: [...document.querySelectorAll(".tag.no")].slice(0, 3).map((t) => t.innerText) })));
// make room tight so some players are short
await page.evaluate(() => { const G = window.HG.G; const p = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.sal - b.sal)[0]; p.sal += 22; window.BOOST = p.id; window.HG.render(); });
console.log("tags tight:", await page.evaluate(() => ({ can: document.querySelectorAll(".tag.ok").length, short: [...document.querySelectorAll(".tag.no")].slice(0, 3).map((t) => t.innerText) })));
await page.screenshot({ path: "tests/shots/t21-fa.png" });
// a free agent's page
const fp = await page.evaluate(() => { const HG = window.HG, G = HG.G; const p = G.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr)[0]; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); return p.n; });
await sleep(400); console.log("FA box for", fp, ":\n  ", await page.evaluate(() => [...document.querySelectorAll(".sheet section")][0]?.innerText.replace(/\s+/g, " ").slice(0, 900)));
await page.screenshot({ path: "tests/shots/t21-fasheet.png" });
await page.evaluate(() => { const G = window.HG.G; const p = G.players.find((x) => x.id === window.BOOST); p.sal -= 22; window.HG.UI.sheet = null; window.HG.render(); });
// one affordable mid-priced player: the lengths' buttons and signing at a chosen length
const mp = await page.evaluate(() => { const HG = window.HG, G = HG.G; const room = 80 - HG.committed(HG.capYear()); const p = G.players.filter((p) => p.tid === -1 && HG.askFor(p, p.askY) > 2 && HG.askFor(p, p.askY) < room).sort((a, b) => b.ovr - a.ovr)[0]; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); return { n: p.n, y: p.askY, prices: [1, 2, 3, 4].map((y) => HG.askFor(p, y)), ok: [1, 2, 3, 4].map((y) => HG.canSignAt(p, y)), room }; });
await sleep(300); console.log("mid player:", JSON.stringify(mp), "| buttons:", await page.evaluate(() => [...document.querySelectorAll('.sheet [data-a="sign"]')].map((b) => b.innerText + (b.disabled ? " (off)" : "")).join(" | ")));
const yy = mp.y === 4 ? 3 : mp.y + 1; await tap(`.sheet [data-a="sign"][data-y="${yy}"]`); console.log("signed:", await page.evaluate((n) => { const p = window.HG.G.players.find((x) => x.n === n); return `${p.n} ${p.sal} through ${p.exp}, tid ${p.tid === window.HG.G.userTid ? "mine" : p.tid}`; }, mp.n), "| expected", mp.prices[yy - 1]);
// cap sheet
console.log("roster now:", await page.evaluate(() => { const G = window.HG.G; return G.players.filter((p) => p.tid === G.userTid).sort((a, b) => b.sal - a.sal).map((p) => `${p.n}#${p.id} ${p.sal}/${p.exp}`).join(", "); }));
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.render(); }); await tap('main [data-a="cap"]'); console.log("cap sheet:", await txt(".sheet", 900));
await page.screenshot({ path: "tests/shots/t21-cap.png" });
// regular season: sign a free agent from his page still works
await page.evaluate(() => { const HG = window.HG, G = HG.G; HG.UI.sheet = null; let mine = G.players.filter((p) => p.tid === G.userTid).sort((a, b) => a.ovr - b.ovr); while (mine.length > 13) mine.shift().tid = -1; HG.faAdvance(30); HG.playDays(5); });
const rs = await page.evaluate(() => { const HG = window.HG, G = HG.G; const p = G.players.filter((p) => p.tid === -1 && HG.canSignAt(p, p.askY)).sort((a, b) => b.ovr - a.ovr)[0]; if (!p) return "none"; HG.UI.sheet = { k: "player", id: p.id }; HG.render(); return p.n; });
await sleep(300); await tap(`.sheet [data-a="sign"]:not([disabled])`); console.log("in-season signing:", rs, await page.evaluate(() => window.HG.UI.toast), "| header", await txt("header .ph", 60));
await page.evaluate(() => { const HG = window.HG; HG.UI.sheet = null; HG.UI.tab = "roster"; HG.render(); }); console.log("roster cap button:", await tap('main [data-a="cap"]'), await txt(".sheet h2", 60));
console.log("ERRORS", JSON.stringify(errors.slice(0, 8))); await browser.close();
