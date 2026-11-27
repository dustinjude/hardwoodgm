import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || undefined, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage(); await page.goto(`http://127.0.0.1:3400/index.html`, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 800));
const out = await page.evaluate(() => {
  const HG = window.HG, res = [];
  for (const [y, names] of [[1996, ["Michael Jordan", "Dennis Rodman", "Shaquille O'Neal", "John Stockton", "Reggie Miller", "Dikembe Mutombo", "Allen Iverson", "Gary Payton", "Steve Kerr", "Charles Barkley"]], [2016, ["James Harden", "Stephen Curry", "Andre Drummond", "Kyle Korver", "Draymond Green", "Kawhi Leonard", "DeMar DeRozan", "Rudy Gobert", "Russell Westbrook", "Dion Waiters", "Tony Allen", "Rajon Rondo"]], [2025, ["Shai Gilgeous-Alexander", "Nikola Jokić", "Giannis Antetokounmpo", "Luka Dončić", "Victor Wembanyama", "Jordan Poole", "Alex Caruso", "Duncan Robinson", "Jalen Brunson"]]]) {
    HG.UI.season = y; HG.newGame(y, 0); const G = HG.G;
    for (const n of names) { const p = G.players.find((x) => x.n === n); res.push(p ? `${y} ${n}: ${HG.styleOf(p).map((x) => x[0] + " (" + x[1] + ")").join(" | ") || "none"}` : `${y} ${n}: missing`); }
    const all = G.players.filter((p) => p.tid >= 0), c = {}; for (const p of all) for (const [l] of HG.styleOf(p)) c[l] = (c[l] || 0) + 1; res.push(y + " counts of " + all.length + ": " + JSON.stringify(c) + " none " + all.filter((p) => !HG.styleOf(p).length).length);
  }
  return res;
});
console.log(out.join("\n")); await browser.close();
